"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const BattleIntelligence = require("../src/battle/battle-intelligence");
const { runPlannerBenchmark } = require("./run-planner-benchmark");

const ROOT = path.resolve(__dirname, "..");
const runtimeSources = {
  liveAndWorker: fs.readFileSync(path.join(ROOT, "PogoPvp.html"), "utf8"),
  principleEngine: fs.readFileSync(path.join(ROOT, "src", "battle", "battle-intelligence.js"), "utf8"),
  offlineAdapter: fs.readFileSync(path.join(ROOT, "tools", "build-great-league-meta-database.js"), "utf8")
};

for (const [name, source] of Object.entries(runtimeSources)) {
  for (const forbidden of [
    "PvPeakHybridBattleIntelligence",
    "createPvPeakHybridBattleIntelligenceApi",
    "evaluateHybridBattleAction",
    "ensureHybridEvaluation",
    "evaluateHybrid()",
    "hybridWasInvoked"
  ]) {
    assert(!source.includes(forbidden), `${name} still contains production hybrid entrypoint ${forbidden}.`);
  }
}
for (const forbidden of [
  "HYBRID_FALLBACK_WITH_LEGACY_COMPLETION",
  "LEGACY_CANDIDATE_EVALUATION",
  "applyHybridEvaluation",
  "resolveHybridEvaluation"
]) {
  assert(!runtimeSources.principleEngine.includes(forbidden), `Principle Engine still contains ${forbidden}.`);
}

const win = BattleIntelligence.createPrincipleOutcomeVector({
  certifiedOutcome: "win",
  complete: true,
  terminalLegal: true,
  survivingHp: 1,
  rawEnergy: 0,
  actionableEnergy: 0,
  tacticalEfficiency: -1000
});
const loss = BattleIntelligence.createPrincipleOutcomeVector({
  certifiedOutcome: "loss",
  complete: true,
  terminalLegal: true,
  survivingHp: 999,
  shields: 2,
  additionalChargedMoves: 10,
  rawEnergy: 100,
  actionableEnergy: 100,
  tacticalEfficiency: 100000
});
assert(
  BattleIntelligence.comparePrincipleOutcomeVectors(win, loss) < 0,
  "A certified loss must never outrank a certified win through resources or scalar preferences."
);
const energyVector = BattleIntelligence.createPrincipleOutcomeVector({
  rawEnergy: 80,
  actionableEnergy: 35
});
assert.equal(energyVector.rawEnergy, 80);
assert.equal(energyVector.actionableEnergy, 35);
assert.equal(energyVector.strandedEnergy, 45);

const output = runPlannerBenchmark({ writeReports: false, previous: null });
assert(output.cases.length >= 20, "Complete migration corpus must contain at least 20 real matchups.");
const requiredCases = [
  "cheap-vs-nuke-shadow-quagsire-corsola-0s",
  "charged-timing-shadow-quagsire-corsola-2s",
  "energy-kingdra-carbink-1s"
];
for (const id of requiredCases) {
  assert(output.cases.some(item => item.id === id), `Missing required real regression ${id}.`);
}

let totalAutomaticDecisions = 0;
let principleResolvedDecisions = 0;
let hybridFallbackDecisions = 0;
let unresolvedPrincipleDecisions = 0;
let legacyFallbackDecisions = 0;
let hybridSelections = 0;
const evaluatedPrinciples = new Set();

for (const item of output.cases) {
  const trace = item.trace;
  assert(trace, `${item.id} must expose a decision trace.`);
  const stats = trace.principleEngineStats || {};
  totalAutomaticDecisions += Number(stats.totalAutomaticDecisions || 0);
  principleResolvedDecisions += Number(stats.principleEngineResolvedDecisions || 0);
  hybridFallbackDecisions += Number(stats.hybridFallbackDecisions || 0);
  unresolvedPrincipleDecisions += Number(stats.unresolvedPrincipleDecisions || 0);
  legacyFallbackDecisions += Number(trace.intelligenceAudit?.legacyFallbackDecisions || 0);
  hybridSelections += Number(trace.hybridStats?.selections || 0);

  for (const decision of trace.decisions || []) {
    assert.equal(decision.principleEngineEvaluated, true, `${item.id}/${decision.decisionId} skipped the Principle Engine.`);
    assert.equal(decision.principleResolved, true, `${item.id}/${decision.decisionId} remained unresolved.`);
    assert.equal(decision.fallbackUsed, false, `${item.id}/${decision.decisionId} used fallback.`);
    assert.equal(decision.finalAuthority, "PRINCIPLE_ENGINE", `${item.id}/${decision.decisionId} has non-principle authority.`);
    assert((decision.principleIds || []).length > 0, `${item.id}/${decision.decisionId} has no direct principle owner.`);
    assert(!(decision.sourceRuleIds || []).some(id => id.startsWith("BI_")), `${item.id}/${decision.decisionId} is still owned by ${decision.sourceRuleIds}.`);
    for (const principleId of decision.principlesEvaluated || []) evaluatedPrinciples.add(principleId);
  }
}

assert(totalAutomaticDecisions > 0, "Corpus did not execute automatic decisions.");
assert.equal(hybridFallbackDecisions, 0);
assert.equal(unresolvedPrincipleDecisions, 0);
assert.equal(legacyFallbackDecisions, 0);
assert.equal(hybridSelections, 0);
assert.equal(principleResolvedDecisions, totalAutomaticDecisions);
assert.equal(principleResolvedDecisions / totalAutomaticDecisions, 1);
assert(evaluatedPrinciples.size >= 40, `Expected broad direct registry execution, saw ${evaluatedPrinciples.size}/43 principles.`);

console.log(JSON.stringify({
  cases: output.cases.length,
  passedExpectations: output.report.totals.passed,
  failedExpectations: output.report.totals.failed,
  totalAutomaticDecisions,
  principleResolvedDecisions,
  hybridFallbackDecisions,
  unresolvedPrincipleDecisions,
  legacyFallbackDecisions,
  hybridSelections,
  principleResolvedPercentage: principleResolvedDecisions / totalAutomaticDecisions,
  evaluatedPrinciples: evaluatedPrinciples.size
}, null, 2));
