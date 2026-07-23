"use strict";

const fs = require("fs");
const path = require("path");
const { runPlannerBenchmark } = require("./run-planner-benchmark");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_REPORT_ROOT = path.join(ROOT, "reports", "hybrid-battle-intelligence");
const FROZEN_BASELINE = Object.freeze({
  engineVersion: "battle-planner-v17",
  cases: 30,
  passed: 22,
  failed: 8,
  durationMs: 15798.26
});

function runHybridBattleIntelligenceBenchmark(options = {}) {
  const output = runPlannerBenchmark({
    writeReports: false,
    corpusPath: options.corpusPath,
    previous: null
  });
  const traces = output.cases.map(item => item.trace).filter(Boolean);
  const intelligenceSamples = traces.flatMap(trace =>
    trace.intelligencePerformance?.decisionDurationSamples || []
  );
  const hybridSamples = traces.flatMap(trace =>
    trace.hybridPerformance?.decisionDurationSamples || []
  );
  const hybridCacheHits = sum(traces, trace => trace.hybridStats?.cacheHits);
  const hybridCacheMisses = sum(traces, trace => trace.hybridStats?.cacheMisses);
  const intelligenceCacheHits = sum(traces, trace => trace.intelligenceStats?.cacheHits);
  const intelligenceCacheMisses = sum(traces, trace => trace.intelligenceStats?.cacheMisses);
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baseline: FROZEN_BASELINE,
    current: {
      engineVersion: output.report.engineVersion,
      cases: output.report.totals.cases,
      passed: output.report.totals.passed,
      failed: output.report.totals.failed,
      passRate: output.report.totals.passRate,
      durationMs: output.report.totals.durationMs
    },
    comparison: {
      passDelta: output.report.totals.passed - FROZEN_BASELINE.passed,
      durationDeltaMs: output.report.totals.durationMs - FROZEN_BASELINE.durationMs,
      durationReductionPercent: round(
        (FROZEN_BASELINE.durationMs - output.report.totals.durationMs)
          / FROZEN_BASELINE.durationMs * 100
      )
    },
    search: {
      candidateRoutesEvaluated: sum(traces, trace => trace.hybridStats?.routesEvaluated),
      compactPlannerNodes: sum(traces, trace => trace.hybridStats?.plannerNodes),
      compactPlannerCalls: sum(traces, trace => trace.hybridStats?.plannerCalls),
      incompleteCompactPlans: sum(traces, trace => trace.hybridStats?.incompletePlans),
      ambiguousSelections: sum(traces, trace => trace.hybridStats?.ambiguousSelections),
      continuationSearchesTriggered: sum(traces, trace => trace.intelligenceStats?.continuationSearches),
      continuationCandidatesEvaluated: sum(traces, trace => trace.intelligenceStats?.evaluatedCandidates)
    },
    cache: {
      hybrid: cacheSummary(hybridCacheHits, hybridCacheMisses),
      battleIntelligence: cacheSummary(intelligenceCacheHits, intelligenceCacheMisses)
    },
    latencyMs: {
      hybrid: latencySummary(hybridSamples),
      battleIntelligence: latencySummary(intelligenceSamples)
    },
    failures: output.cases
      .filter(item => !item.passed)
      .map(item => ({ id: item.id, failures: item.failures }))
  };
  if (options.writeReports) writeReport(report, options.reportRoot || DEFAULT_REPORT_ROOT);
  return { report, benchmark: output };
}

function sum(values, select) {
  return values.reduce((total, value) => total + Number(select(value) || 0), 0);
}

function cacheSummary(hits, misses) {
  return {
    hits,
    misses,
    hitRate: hits + misses ? round(hits / (hits + misses)) : 0
  };
}

function latencySummary(samples) {
  const sorted = samples.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const total = sorted.reduce((sumValue, value) => sumValue + value, 0);
  return {
    samples: sorted.length,
    average: sorted.length ? round(total / sorted.length) : 0,
    median: round(percentile(sorted, .5)),
    p95: round(percentile(sorted, .95)),
    worst: round(sorted[sorted.length - 1] || 0)
  };
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function round(value) {
  return Number(Number(value || 0).toFixed(3));
}

function writeReport(report, reportRoot = DEFAULT_REPORT_ROOT) {
  fs.mkdirSync(reportRoot, { recursive: true });
  fs.writeFileSync(path.join(reportRoot, "performance.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(reportRoot, "performance.md"), reportMarkdown(report), "utf8");
}

function reportMarkdown(report) {
  const current = report.current;
  const comparison = report.comparison;
  const search = report.search;
  return [
    "# Hybrid Battle Intelligence Performance",
    "",
    `- Corpus: ${current.cases} matchups`,
    `- Quality: ${current.passed}/${current.cases} (${comparison.passDelta >= 0 ? "+" : ""}${comparison.passDelta} passes)`,
    `- Runtime: ${round(current.durationMs)} ms (${comparison.durationReductionPercent}% reduction)`,
    `- Candidate routes: ${search.candidateRoutesEvaluated}`,
    `- Compact nodes: ${search.compactPlannerNodes}`,
    `- Continuation searches: ${search.continuationSearchesTriggered}`,
    `- Hybrid latency avg/median/p95/worst: ${Object.values(report.latencyMs.hybrid).slice(1).join(" / ")} ms`,
    `- Battle Intelligence latency avg/median/p95/worst: ${Object.values(report.latencyMs.battleIntelligence).slice(1).join(" / ")} ms`,
    ""
  ].join("\n");
}

if (require.main === module) {
  const output = runHybridBattleIntelligenceBenchmark({
    writeReports: process.argv.includes("--write")
  });
  console.log(reportMarkdown(output.report));
}

module.exports = {
  FROZEN_BASELINE,
  DEFAULT_REPORT_ROOT,
  runHybridBattleIntelligenceBenchmark,
  latencySummary,
  reportMarkdown,
  writeReport
};
