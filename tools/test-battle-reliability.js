"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  BATTLE_ENGINE_VERSION,
  REASON_CODES,
  createMatchupProvenance,
  validateTrace
} = require("../src/reliability/battle-reliability");
const {
  scanBattleContradictions,
  scanOrientationMismatches
} = require("../src/reliability/contradiction-scanner");
const {
  createRuntime,
  loadRegressionFixtures,
  buildCaseConfig,
  runRegressionSuite,
  writeRegressionReports
} = require("./run-battle-regressions");

const ROOT = path.resolve(__dirname, "..");

function simulate(runtime, testCase, trace) {
  return runtime.adapter.simulate({
    id: 1,
    source: "reliability-test",
    key: testCase.id,
    signature: BATTLE_ENGINE_VERSION,
    aShields: testCase.pokemonA.shields,
    bShields: testCase.pokemonB.shields,
    includeSwing: false,
    trace,
    config: buildCaseConfig(testCase, runtime)
  });
}

function testTrace(runtime, fixture) {
  const testCase = fixture.cases[0];
  const withoutTrace = simulate(runtime, testCase, false);
  const tracedA = simulate(runtime, testCase, true);
  const tracedB = simulate(runtime, testCase, true);
  assert.strictEqual(withoutTrace.decisionTrace, undefined, "Trace must be disabled by default.");
  assert.strictEqual(withoutTrace.score, tracedA.score, "Tracing must not change the battle score.");
  assert.deepStrictEqual(tracedA.decisionTrace, tracedB.decisionTrace, "Trace output must be deterministic.");
  assert.strictEqual(tracedA.decisionTrace.engineVersion, BATTLE_ENGINE_VERSION);
  assert.strictEqual(validateTrace(tracedA.decisionTrace).length, 0);
  assert(tracedA.decisionTrace.decisions.length > 0);
  assert(tracedA.decisionTrace.decisions.every(decision => REASON_CODES.includes(decision.reasonCode)));
  assert(Array.isArray(tracedA.decisionTrace.shieldCounterfactuals));
  assert(Array.isArray(tracedA.decisionTrace.terminalSnapshots));
  assert(tracedA.decisionTrace.terminalSnapshots.length > 0, "A completed battle must expose a terminal snapshot.");
}

function testRegressionSuite(runtime) {
  const output = runRegressionSuite({ runtime, writeReports: false });
  assert.strictEqual(output.summary.total, loadRegressionFixtures().cases.length);
  assert.strictEqual(output.summary.failed, 0, JSON.stringify(output.summary.cases, null, 2));
}

function testFailureTraceReport() {
  const reportRoot = path.join(ROOT, "reports", "battle-regressions-test");
  const failedCase = {
    id: "synthetic-failure",
    passed: false,
    failures: ["Expected a different result."],
    trace: {
      schemaVersion: 1,
      engineVersion: BATTLE_ENGINE_VERSION,
      source: "test",
      decisions: []
    }
  };
  const summary = {
    engineVersion: BATTLE_ENGINE_VERSION,
    total: 1,
    passed: 0,
    failed: 1,
    durationMs: 0,
    cases: [{ id: failedCase.id, passed: false, failures: failedCase.failures }]
  };
  writeRegressionReports(summary, [failedCase], reportRoot);
  const failureFile = path.join(reportRoot, "failures", "synthetic-failure.json");
  assert(fs.existsSync(failureFile));
  assert(JSON.parse(fs.readFileSync(failureFile, "utf8")).trace);
  fs.rmSync(reportRoot, { recursive: true, force: true });
}

function testProvenance() {
  const live = createMatchupProvenance({ source: "live" });
  const current = createMatchupProvenance({ source: "cached", datasetEngineVersion: BATTLE_ENGINE_VERSION });
  const old = createMatchupProvenance({ source: "offline", datasetEngineVersion: "older-planner" });
  const missing = createMatchupProvenance({ source: "cached" });
  assert.strictEqual(live.stale, false);
  assert.strictEqual(current.stale, false);
  assert.strictEqual(old.stale, true);
  assert.strictEqual(old.staleReason, "ENGINE_VERSION_MISMATCH");
  assert.strictEqual(missing.stale, true);
  assert.strictEqual(missing.staleReason, "MISSING_ENGINE_VERSION");
}

function testContradictionRules() {
  const report = scanBattleContradictions([{
    id: "synthetic-choice",
    trace: {
      engineVersion: BATTLE_ENGINE_VERSION,
      decisions: [{
        turn: 12,
        side: "A",
        pokemonId: "alpha",
        decisionType: "charged-move-selection",
        chosenCandidate: { moveId: "WEAK", moveName: "Weak", statEffects: "none", projectedOutcome: "loss", projectedRating: 300 },
        candidates: [
          { moveId: "WEAK", moveName: "Weak", statEffects: "none", projectedOutcome: "loss", projectedRating: 300 },
          { moveId: "DEBUFF", moveName: "Debuff", statEffects: "opponent ATK -1", projectedOutcome: "win", projectedRating: 700 }
        ]
      }]
    }
  }]);
  assert(report.findings.some(finding => finding.rule === "MISSED_WINNING_MOVE"));
  assert(report.findings.some(finding => finding.rule === "GUARANTEED_EFFECT_IGNORED"));

  const insufficient = scanBattleContradictions([{ id: "insufficient", trace: { decisions: [] } }]);
  assert.strictEqual(insufficient.findingCount, 0, "Missing counterfactual evidence must not create findings.");

  const counterfactualEvidence = scanBattleContradictions([{
    id: "synthetic-counterfactuals",
    trace: {
      decisions: [],
      shieldCounterfactuals: [{
        turn: 20,
        side: "B",
        shielded: true,
        outcomeWithShield: "loss",
        outcomeWithoutShield: "loss",
        hpGain: 0,
        energyGain: 0,
        moveAccessGain: 0
      }, {
        turn: 24,
        side: "A",
        shieldMode: "smart",
        shielded: false,
        outcomeWithShield: "win",
        outcomeWithoutShield: "loss",
        hpGain: 0.2,
        energyGain: 0,
        moveAccessGain: 0
      }],
      terminalSnapshots: [{
        turn: 30,
        side: "A",
        fainted: true,
        legalMoveCouldChangeOutcome: true,
        demonstratedMove: { moveId: "CLOSER", moveName: "Closer" }
      }]
    }
  }]);
  assert(counterfactualEvidence.findings.some(finding => finding.rule === "WASTEFUL_SHIELD"));
  assert(counterfactualEvidence.findings.some(finding => finding.rule === "MISSED_WINNING_SHIELD"));
  assert(counterfactualEvidence.findings.some(finding => finding.rule === "UNUSED_LETHAL_ENERGY"));

  const observationalOnly = scanBattleContradictions([{
    id: "observational-terminal",
    trace: {
      decisions: [],
      terminalSnapshots: [{
        turn: 30,
        side: "A",
        fainted: true,
        legalMoveCouldChangeOutcome: false,
        affordableMoves: [{ moveId: "CLOSER", moveName: "Closer" }]
      }]
    }
  }]);
  assert.strictEqual(observationalOnly.findingCount, 0, "Affordable energy alone must not be treated as a confirmed legal opportunity.");
}

function testOrientationHandling() {
  const consistent = scanOrientationMismatches([
    { aId: "a", bId: "b", aShields: 1, bShields: 0, score: 620 },
    { aId: "b", bId: "a", aShields: 0, bShields: 1, score: 380 }
  ]);
  const inconsistent = scanOrientationMismatches([
    { aId: "a", bId: "b", aShields: 1, bShields: 0, score: 620 },
    { aId: "b", bId: "a", aShields: 0, bShields: 1, score: 460 }
  ]);
  assert.strictEqual(consistent.length, 0);
  assert.strictEqual(inconsistent.length, 1);
  assert.strictEqual(inconsistent[0].category, "orientation");
}

function run() {
  const fixture = loadRegressionFixtures();
  const runtime = createRuntime();
  testTrace(runtime, fixture);
  testRegressionSuite(runtime);
  testFailureTraceReport();
  testProvenance();
  testContradictionRules();
  testOrientationHandling();
  console.log("Battle reliability tests passed.");
}

if (require.main === module) run();

module.exports = { run };
