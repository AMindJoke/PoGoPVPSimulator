"use strict";

const fs = require("fs");
const path = require("path");
const TurnEngine = require("../src/battle/turn-resolution-engine");
const Intelligence = require("../src/battle/battle-intelligence");
const { createRuntime, buildCaseConfig, runRegressionCase, winnerSide } = require("./run-battle-regressions");

const ROOT = path.resolve(__dirname, "..");
const CORPUS = path.join(ROOT, "data", "golden-corpus", "great-league.json");

const CALL_SITES = Object.freeze([
  { id: "normal-auto-action", path: "runBattleToEnd -> autoAction -> selectBattleIntelligenceAction", routed: true },
  { id: "matrix-worker", path: "matrix worker -> runAutomaticBattleToEnd -> autoAction", routed: true },
  { id: "browser-matrix-fallback", path: "simulateShieldMatrixCell -> runAutomaticBattleToEnd -> autoAction", routed: true },
  { id: "meta-fallback", path: "simulateMetaMatchupCell -> runAutomaticBattleToEnd -> autoAction", routed: true },
  { id: "offline-generation", path: "offline worker -> runAutomaticBattleToEnd -> autoAction", routed: true },
  { id: "scenario-review", path: "simulateTechnicalIssue -> runAutomaticBattleToEnd -> autoAction", routed: true },
  { id: "preview", path: "preview battle -> runAutomaticBattleToEnd -> autoAction", routed: true },
  { id: "shield-decision", path: "useCharge -> shieldDecisionForMove -> selectShieldAction", routed: true },
  { id: "smart-shield-counterfactual", path: "useCharge -> buildShieldCounterfactual -> selectShieldAction", routed: true },
  { id: "shield-continuation", path: "simulateShieldDecisionContinuation -> autoAction", routed: true },
  { id: "charged-continuation", path: "selectAction -> boundedContinuation -> simulateBattleIntelligenceContinuation", routed: true },
  { id: "timing-and-overfarm", path: "evaluateCandidate -> candidate score -> selectAction", routed: true },
  { id: "bait-and-self-debuff", path: "evaluateCandidate -> candidate score -> selectAction", routed: true }
]);

const REPRESENTATIVE_IDS = Object.freeze([
  "straight-bastiodon-altaria-0s",
  "extra-fast-flip-dewgong-azumarill-1s",
  "bait-malamar-pangoro-1s",
  "defense-buff-sableye-empoleon-1s",
  "attack-debuff-seaking-hawlucha-1s",
  "cmp-raikou-pachirisu-1s",
  "shield-dependent-dedenne-shadow-sableye-2s"
]);

function runAudit() {
  const corpus = JSON.parse(fs.readFileSync(CORPUS, "utf8"));
  const runtime = createRuntime();
  const startedAt = performance.now();
  const cases = corpus.cases.map((testCase, index) => summarizeCase(
    testCase,
    runRegressionCase(testCase, runtime, index + 1, { trace: true })
  ));
  const totals = cases.reduce((sum, item) => {
    sum.total += item.total;
    sum.intelligenceOwned += item.intelligenceOwned;
    sum.legacy += item.legacy;
    return sum;
  }, { total: 0, intelligenceOwned: 0, legacy: 0 });
  totals.runtimeCoverage = ratio(totals.intelligenceOwned, totals.intelligenceOwned + totals.legacy);

  const contextCase = corpus.cases.find(item => item.id === "straight-bastiodon-altaria-0s");
  const config = buildCaseConfig(contextCase, runtime);
  const contexts = Object.fromEntries([
    ["battle", "battle-regression"],
    ["matrix", "matrix-audit"],
    ["offline", "offline-ranking"],
    ["scenario-review", "scenario-review-audit"],
    ["preview", "preview-audit"]
  ].map(([name, source], index) => [name, summarizeContext(runtime, config, source, index + 1)]));

  const strict = runStrictCheck(contextCase);
  const pendingFast = runPendingFastFixture();
  const routedCallSites = CALL_SITES.filter(item => item.routed).length;

  return {
    generatedAt: new Date().toISOString(),
    callSiteCoverage: {
      routed: routedCallSites,
      total: CALL_SITES.length,
      rate: ratio(routedCallSites, CALL_SITES.length),
      sites: CALL_SITES
    },
    runtimeCoverage: totals,
    representativeCases: cases.filter(item => REPRESENTATIVE_IDS.includes(item.id)),
    contexts,
    strict,
    pendingFast,
    corpusParity: {
      cases: cases.length,
      passed: cases.filter(item => item.passed).length,
      failedIds: cases.filter(item => !item.passed).map(item => item.id)
    },
    performanceMs: Number((performance.now() - startedAt).toFixed(3))
  };
}

function summarizeCase(testCase, result) {
  const audit = result.trace?.intelligenceAudit || {};
  return {
    id: testCase.id,
    category: testCase.tacticalCategory,
    passed: result.passed,
    winner: result.actual?.winner || null,
    total: Number(audit.totalDecisions || 0),
    intelligenceOwned: Number(audit.intelligenceOwnedDecisions || 0),
    legacy: Number(audit.legacyFallbackDecisions || 0),
    forcedPolicy: Number(audit.forcedPolicyDecisions || 0),
    runtimeCoverage: Number(audit.runtimeCoverage || 0),
    fallbackReasons: audit.fallbackReasons || {}
  };
}

function summarizeContext(runtime, config, source, id) {
  const result = runtime.adapter.simulate({
    id,
    source,
    key: source,
    signature: "battle-intelligence-audit",
    aShields: 0,
    bShields: 0,
    includeSwing: false,
    trace: true,
    config
  });
  const audit = result.decisionTrace?.intelligenceAudit || {};
  return {
    detectedContext: Object.keys(audit.byContext || {})[0] || null,
    winner: winnerSide(result),
    score: Number(result.score || 0),
    finalHp: { A: result.decisionTrace?.finalState?.A?.hp ?? null, B: result.decisionTrace?.finalState?.B?.hp ?? null },
    finalEnergy: { A: result.decisionTrace?.finalState?.A?.energy ?? null, B: result.decisionTrace?.finalState?.B?.energy ?? null },
    total: Number(audit.totalDecisions || 0),
    intelligenceOwned: Number(audit.intelligenceOwnedDecisions || 0),
    legacy: Number(audit.legacyFallbackDecisions || 0),
    runtimeCoverage: Number(audit.runtimeCoverage || 0),
    fallbackReasons: audit.fallbackReasons || {}
  };
}

function runStrictCheck(testCase) {
  const runtime = createRuntime({ strict: true });
  try {
    const result = runRegressionCase(testCase, runtime, 1, { trace: true });
    const audit = result.trace?.intelligenceAudit || {};
    return {
      rejectedFallback: false,
      reasonCode: null,
      legacyFallbackDecisions: Number(audit.legacyFallbackDecisions || 0),
      runtimeCoverage: Number(audit.runtimeCoverage || 0)
    };
  } catch (error) {
    return { rejectedFallback: true, reasonCode: error.code || null, message: error.message };
  }
}

function runPendingFastFixture() {
  const move = (id, energyCost, damage, extra = {}) => ({ id, name: id, energyCost, damage, ...extra });
  const state = TurnEngine.createState({
    currentTurn: 5,
    sides: {
      A: { id: "A", hp: 30, maxHp: 100, energy: 40, attack: 120, defense: 100, readyTurn: 5, fastMove: move("FAST_A", 0, 4, { turns: 2, energyGain: 8 }), chargedMoves: [move("CHEAP", 35, 50)] },
      B: { id: "B", hp: 100, maxHp: 100, energy: 0, attack: 100, defense: 100, readyTurn: 7, fastMove: move("FAST_B", 0, 40, { turns: 3, energyGain: 8 }), chargedMoves: [] }
    },
    pendingEvents: [TurnEngine.createFastImpactEvent({ id: "pending-lethal", sourceSide: "B", targetSide: "A", moveId: "FAST_B", damage: 40, startTurn: 4, duration: 3, source: "one-turn-lag" })]
  });
  Intelligence.resetAudit();
  Intelligence.configureAudit({ enabled: true, strict: false, retainEvents: true });
  const result = Intelligence.selectAction({
    state,
    side: "A",
    legalActions: TurnEngine.getLegalActions(state, "A"),
    policy: "DEEP_REVIEW",
    context: { callerContext: "scenario-review", estimateDamage: action => action.move?.damage || 0, willOpponentShield: () => false }
  });
  const audit = Intelligence.getAuditReport();
  Intelligence.configureAudit({ enabled: false, strict: false, retainEvents: false });
  return {
    action: result.action,
    ruleIds: result.sourceRuleIds,
    reasonCodes: result.reasonCodes,
    source: result.source,
    runtimeCoverage: audit.runtimeCoverage
  };
}

function ratio(value, total) {
  return total ? value / total : 0;
}

if (require.main === module) console.log(JSON.stringify(runAudit(), null, 2));

module.exports = { CALL_SITES, REPRESENTATIVE_IDS, runAudit };
