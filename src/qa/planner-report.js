"use strict";

const { aggregateTacticalCoverage } = require("./golden-corpus");

function buildPlannerReport({ corpus, caseResults, engineVersion, durationMs, generatedAt = new Date().toISOString(), previous = null }) {
  const cases = caseResults.map(item => ({
    id: item.id,
    description: item.description,
    tacticalCategory: item.tacticalCategory,
    confidence: item.confidence,
    passed: item.passed,
    durationMs: item.durationMs,
    failures: item.failures,
    actual: item.actual
  }));
  const passed = cases.filter(item => item.passed).length;
  const failed = cases.length - passed;
  const tacticalCoverage = aggregateTacticalCoverage(cases);
  const findings = caseResults.flatMap(item => item.tacticalSummary?.findings || []);
  const report = {
    schemaVersion: 1,
    generatedAt,
    engineVersion,
    corpus: {
      id: corpus.id,
      version: corpus.version,
      league: corpus.league,
      total: cases.length
    },
    totals: {
      cases: cases.length,
      passed,
      failed,
      passRate: cases.length ? percent(passed / cases.length) : 0,
      durationMs: Number(Number(durationMs || 0).toFixed(3))
    },
    tacticalCoverage,
    plannerConfidence: {
      averageFindingConfidence: averageFindingConfidence(findings),
      findings: findings.length,
      unknownCases: caseResults.filter(item => !(item.tacticalSummary?.findings || []).length).length
    },
    qualitySignals: {
      expectationFailures: caseResults.reduce((sum, item) => sum + item.failures.length, 0),
      criticalTacticalFailures: cases.filter(item => !item.passed && item.confidence === "high").map(item => item.id)
    },
    cases
  };
  report.comparison = comparePlannerReports(report, previous);
  return report;
}

function comparePlannerReports(current, previous) {
  if (!previous?.totals || !Array.isArray(previous.cases)) return null;
  const previousFailures = new Set(previous.cases.filter(item => !item.passed).map(item => item.id));
  const currentFailures = new Set(current.cases.filter(item => !item.passed).map(item => item.id));
  return {
    previousGeneratedAt: previous.generatedAt || null,
    previousEngineVersion: previous.engineVersion || null,
    previousPassRate: Number(previous.totals.passRate || 0),
    currentPassRate: Number(current.totals.passRate || 0),
    deltaPassRate: Number((Number(current.totals.passRate || 0) - Number(previous.totals.passRate || 0)).toFixed(1)),
    newFailures: [...currentFailures].filter(id => !previousFailures.has(id)),
    fixedRegressions: [...previousFailures].filter(id => !currentFailures.has(id))
  };
}

function plannerReportMarkdown(report) {
  const lines = [
    "# Planner Reliability Report",
    "",
    `- Engine: \`${report.engineVersion}\``,
    `- Corpus: ${report.corpus.id} v${report.corpus.version}`,
    `- Cases: ${report.totals.cases}`,
    `- Pass: ${report.totals.passed}`,
    `- Fail: ${report.totals.failed}`,
    `- Pass rate: ${report.totals.passRate}%`,
    `- Duration: ${report.totals.durationMs} ms`,
    "",
    "## Tactical Coverage",
    "",
    `- Concepts covered: ${report.tacticalCoverage.conceptsCovered}/${report.tacticalCoverage.catalogSize}`,
    `- Concepts with full coverage: ${report.tacticalCoverage.conceptsWithFullCoverage}`,
    `- Concepts missing coverage: ${report.tacticalCoverage.conceptsMissingCoverage.length}`,
    `- Concepts with known planner weaknesses: ${report.tacticalCoverage.conceptsWithKnownWeaknesses.length}`,
    "",
    "| Tactical concept | Coverage | Pass | Fail | Pass rate |",
    "| --- | ---: | ---: | ---: | ---: |"
  ];
  for (const row of Object.values(report.tacticalCoverage.byCategory)) {
    lines.push(`| ${row.label} | ${row.total} | ${row.passed} | ${row.failed} | ${row.passRate == null ? "-" : `${row.passRate}%`} |`);
  }
  lines.push("", "## Planner Confidence", "");
  lines.push(`- Average finding confidence: ${report.plannerConfidence.averageFindingConfidence}%`);
  lines.push(`- Tactical findings: ${report.plannerConfidence.findings}`);
  lines.push(`- Cases without detected findings: ${report.plannerConfidence.unknownCases}`);
  lines.push("", "## Comparison", "");
  if (!report.comparison) {
    lines.push("No previous benchmark was available for comparison.");
  } else {
    const delta = report.comparison.deltaPassRate;
    lines.push(`- Previous pass rate: ${report.comparison.previousPassRate}%`);
    lines.push(`- Change: ${delta >= 0 ? "+" : ""}${delta}%`);
    lines.push(`- New failures: ${report.comparison.newFailures.length ? report.comparison.newFailures.map(id => `\`${id}\``).join(", ") : "none"}`);
    lines.push(`- Fixed regressions: ${report.comparison.fixedRegressions.length ? report.comparison.fixedRegressions.map(id => `\`${id}\``).join(", ") : "none"}`);
  }
  lines.push("", "## Cases", "");
  for (const item of report.cases) {
    lines.push(`- ${item.passed ? "PASS" : "FAIL"} \`${item.id}\` - ${item.description}${item.failures.length ? ` (${item.failures.join(" ")})` : ""}`);
  }
  return `${lines.join("\n")}\n`;
}

function averageFindingConfidence(findings) {
  if (!findings.length) return 0;
  const weights = { high: 100, medium: 70, low: 35 };
  return Number((findings.reduce((sum, finding) => sum + (weights[finding.confidence?.level] || 0), 0) / findings.length).toFixed(1));
}

function percent(value) {
  return Number((Number(value || 0) * 100).toFixed(1));
}

module.exports = {
  buildPlannerReport,
  comparePlannerReports,
  plannerReportMarkdown,
  averageFindingConfidence
};
