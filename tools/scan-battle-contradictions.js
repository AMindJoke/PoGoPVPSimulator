"use strict";

const fs = require("fs");
const path = require("path");
const { BATTLE_ENGINE_VERSION } = require("../src/reliability/battle-reliability");
const { scanBattleContradictions } = require("../src/reliability/contradiction-scanner");
const { runRegressionSuite } = require("./run-battle-regressions");

const ROOT = path.resolve(__dirname, "..");
const REPORT_ROOT = path.join(ROOT, "reports", "battle-contradictions");

function runScanner(options = {}) {
  const regression = options.regression || runRegressionSuite({ writeReports: false });
  const records = regression.cases.map(testCase => ({
    id: testCase.id,
    trace: testCase.trace,
    result: testCase.result
  }));
  const report = scanBattleContradictions(records, {
    orientationRecords: options.orientationRecords || []
  });
  report.engineVersion = BATTLE_ENGINE_VERSION;
  report.scannedCases = records.length;
  if (options.writeReports !== false) writeScannerReport(report, options.reportRoot || REPORT_ROOT);
  return report;
}

function writeScannerReport(report, reportRoot) {
  fs.mkdirSync(path.join(reportRoot, "findings"), { recursive: true });
  fs.writeFileSync(path.join(reportRoot, "summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const lines = [
    "# Battle Contradiction Scan",
    "",
    `- Engine: ${report.engineVersion}`,
    `- Regression cases scanned: ${report.scannedCases}`,
    `- Potential planner contradictions: ${report.findingCount}`,
    ""
  ];
  for (const [rule, count] of Object.entries(report.counts)) lines.push(`- ${rule}: ${count}`);
  if (!report.findingCount) lines.push("- No evidence-backed contradictions found in this small corpus.");
  fs.writeFileSync(path.join(reportRoot, "summary.md"), `${lines.join("\n")}\n`, "utf8");
  for (const finding of report.findings) {
    fs.writeFileSync(path.join(reportRoot, "findings", `${safeName(finding.id)}.json`), `${JSON.stringify(finding, null, 2)}\n`, "utf8");
  }
}

function safeName(value) {
  return String(value).replace(/[^a-z0-9_.-]+/gi, "_");
}

function printReport(report) {
  console.log(`Potential planner contradictions: ${report.findingCount}`);
  for (const [rule, count] of Object.entries(report.counts)) console.log(`${rule}: ${count}`);
  if (!report.findingCount) console.log("No evidence-backed contradictions found in the current regression corpus.");
}

if (require.main === module) printReport(runScanner());

module.exports = { REPORT_ROOT, runScanner, writeScannerReport };
