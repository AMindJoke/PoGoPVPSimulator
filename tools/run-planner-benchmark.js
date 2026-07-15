"use strict";

const fs = require("fs");
const path = require("path");
const { BATTLE_ENGINE_VERSION } = require("../src/reliability/battle-reliability");
const { loadGoldenCorpusObject } = require("../src/qa/golden-corpus");
const { buildPlannerReport, plannerReportMarkdown } = require("../src/qa/planner-report");
const { createRuntime, runRegressionCase } = require("./run-battle-regressions");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_CORPUS = path.join(ROOT, "data", "golden-corpus", "great-league.json");
const DEFAULT_REPORT_ROOT = path.join(ROOT, "reports", "planner-benchmark");

function loadGoldenCorpus(file = DEFAULT_CORPUS) {
  return loadGoldenCorpusObject(fs.readFileSync(file, "utf8"));
}

function runPlannerBenchmark(options = {}) {
  const corpusPath = options.corpusPath || DEFAULT_CORPUS;
  const reportRoot = options.reportRoot || DEFAULT_REPORT_ROOT;
  const corpus = loadGoldenCorpus(corpusPath);
  const runtime = options.runtime || createRuntime();
  const previous = options.previous === undefined
    ? readJsonIfPresent(path.join(reportRoot, "summary.json"))
    : options.previous;
  const startedAt = performance.now();
  const caseResults = corpus.cases.map((testCase, index) => {
    const result = runRegressionCase(testCase, runtime, index + 1, { trace: true });
    return {
      ...result,
      tacticalCategory: testCase.tacticalCategory,
      confidence: testCase.confidence,
      expectedPlannerBehavior: testCase.expectedPlannerBehavior,
      expectedImportantDecision: testCase.expectedImportantDecision
    };
  });
  const report = buildPlannerReport({
    corpus,
    caseResults,
    engineVersion: BATTLE_ENGINE_VERSION,
    durationMs: performance.now() - startedAt,
    previous
  });
  if (options.writeReports !== false) writePlannerReports(report, caseResults, reportRoot);
  return { report, cases: caseResults };
}

function writePlannerReports(report, cases, reportRoot = DEFAULT_REPORT_ROOT) {
  const failuresRoot = path.join(reportRoot, "failures");
  fs.mkdirSync(failuresRoot, { recursive: true });
  fs.writeFileSync(path.join(reportRoot, "summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(reportRoot, "summary.md"), plannerReportMarkdown(report), "utf8");
  for (const item of cases.filter(testCase => !testCase.passed)) {
    const output = {
      id: item.id,
      tacticalCategory: item.tacticalCategory,
      failures: item.failures,
      actual: item.actual,
      tacticalSummary: item.tacticalSummary,
      trace: item.trace
    };
    fs.writeFileSync(path.join(failuresRoot, `${item.id}.json`), `${JSON.stringify(output, null, 2)}\n`, "utf8");
  }
}

function readJsonIfPresent(file) {
  if (!file || !fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseArguments(argv) {
  const options = {};
  for (const arg of argv) {
    if (arg.startsWith("--corpus=")) options.corpusPath = path.resolve(ROOT, arg.slice("--corpus=".length));
    if (arg.startsWith("--report-root=")) options.reportRoot = path.resolve(ROOT, arg.slice("--report-root=".length));
    if (arg.startsWith("--compare=")) options.previous = readJsonIfPresent(path.resolve(ROOT, arg.slice("--compare=".length)));
    if (arg === "--no-write") options.writeReports = false;
    if (arg === "--strict") options.strict = true;
  }
  return options;
}

function printPlannerSummary(report) {
  console.log("Planner Benchmark");
  console.log(`Golden Corpus: ${report.totals.cases} matchups`);
  console.log(`PASS ${report.totals.passed}`);
  console.log(`FAIL ${report.totals.failed}`);
  console.log(`Pass rate ${report.totals.passRate}%`);
  console.log(`Tactical concepts ${report.tacticalCoverage.conceptsCovered}/${report.tacticalCoverage.catalogSize}`);
  if (report.comparison) console.log(`Change ${report.comparison.deltaPassRate >= 0 ? "+" : ""}${report.comparison.deltaPassRate}%`);
}

if (require.main === module) {
  const options = parseArguments(process.argv.slice(2));
  const output = runPlannerBenchmark(options);
  printPlannerSummary(output.report);
  if (options.strict && output.report.totals.failed) process.exitCode = 1;
}

module.exports = {
  DEFAULT_CORPUS,
  DEFAULT_REPORT_ROOT,
  loadGoldenCorpus,
  runPlannerBenchmark,
  writePlannerReports,
  readJsonIfPresent,
  parseArguments,
  printPlannerSummary
};
