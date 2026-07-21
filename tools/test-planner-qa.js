"use strict";

const assert = require("assert");
const {
  TACTICAL_CATEGORIES,
  loadGoldenCorpusObject,
  validateGoldenCorpus,
  aggregateTacticalCoverage
} = require("../src/qa/golden-corpus");
const {
  buildPlannerReport,
  comparePlannerReports,
  plannerReportMarkdown
} = require("../src/qa/planner-report");
const { loadGoldenCorpus, runPlannerBenchmark, parseArguments } = require("./run-planner-benchmark");

const corpus = loadGoldenCorpus();
assert.strictEqual(corpus.cases.length, 29);
assert.strictEqual(validateGoldenCorpus(corpus).length, 0);
assert.strictEqual(loadGoldenCorpusObject(JSON.stringify(corpus)).id, corpus.id);
assert.throws(() => loadGoldenCorpusObject({ schemaVersion: 1, cases: [{ id: "broken" }] }), /Invalid Golden Corpus/);

const duplicate = JSON.parse(JSON.stringify(corpus));
duplicate.cases[1].id = duplicate.cases[0].id;
assert(validateGoldenCorpus(duplicate).some(error => error.includes("duplicates")));

const coverage = aggregateTacticalCoverage([
  { id: "one", tacticalCategory: "straight-play", passed: true },
  { id: "two", tacticalCategory: "straight-play", passed: false },
  { id: "three", tacticalCategory: "closing-move", passed: true }
]);
assert.strictEqual(coverage.byCategory["straight-play"].total, 2);
assert.strictEqual(coverage.byCategory["straight-play"].passRate, 50);
assert(coverage.conceptsWithKnownWeaknesses.includes("straight-play"));
assert(coverage.conceptsMissingCoverage.includes("cmp-sensitive"));

const previous = {
  generatedAt: "previous",
  engineVersion: "old-engine",
  totals: { passRate: 50 },
  cases: [
    { id: "fixed", passed: false },
    { id: "regressed", passed: true }
  ]
};
const current = {
  generatedAt: "current",
  engineVersion: "new-engine",
  totals: { passRate: 75 },
  cases: [
    { id: "fixed", passed: true },
    { id: "regressed", passed: false }
  ]
};
const comparison = comparePlannerReports(current, previous);
assert.strictEqual(comparison.deltaPassRate, 25);
assert.deepStrictEqual(comparison.newFailures, ["regressed"]);
assert.deepStrictEqual(comparison.fixedRegressions, ["fixed"]);

const benchmark = runPlannerBenchmark({ writeReports: false, previous: null });
assert.strictEqual(benchmark.report.totals.cases, corpus.cases.length);
assert.strictEqual(benchmark.report.tacticalCoverage.conceptsCovered, Object.keys(TACTICAL_CATEGORIES).length);
assert.strictEqual(benchmark.report.comparison, null);
assert(benchmark.report.cases.every(item => item.tacticalCategory));

const rebuilt = buildPlannerReport({
  corpus,
  caseResults: benchmark.cases,
  engineVersion: benchmark.report.engineVersion,
  durationMs: benchmark.report.totals.durationMs,
  previous: benchmark.report
});
assert.strictEqual(rebuilt.comparison.deltaPassRate, 0);
const markdown = plannerReportMarkdown(rebuilt);
assert(markdown.includes("# Planner Reliability Report"));
assert(markdown.includes("## Tactical Coverage"));
assert(markdown.includes("## Comparison"));
assert(markdown.includes("New failures: none"));

const parsed = parseArguments(["--no-write", "--strict"]);
assert.strictEqual(parsed.writeReports, false);
assert.strictEqual(parsed.strict, true);

console.log(`Planner QA tests passed with ${benchmark.report.totals.cases} Golden Corpus cases.`);
