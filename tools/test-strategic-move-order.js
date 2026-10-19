"use strict";

const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");
const Reliability = require("../src/reliability/battle-reliability");

const runtime = R.createRuntime();
const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true, strict: true });
const fixtures = [
  ["talonflame", "dewgong", 1, "FLY"],
  ["talonflame", "dewgong", 2, "FLY"],
  ["talonflame", "gastrodon", 1, "BRAVE_BIRD"],
  ["talonflame", "gastrodon", 2, "FLY"],
  ["talonflame", "marowak_alolan_shadow", 1, "BRAVE_BIRD"],
  ["talonflame", "corsola_galarian", 2, "FLY"],
  ["talonflame", "quagsire_shadow", 1, "BRAVE_BIRD", "B"],
  ["skeledirge", "azumarill", 1, "TORCH_SONG"],
  ["dewgong", "talonflame_shadow", 0, "DRILL_RUN", "B"]
];
let sequence = 0;
let comparisons = 0;
const ledger = result => JSON.stringify({
  finalState: result.decisionTrace.finalState,
  timeline: result.timelineTrace
});

for (const [attacker, defender, shields, opener, winner = "A"] of fixtures) {
  const key = `${attacker}-${defender}-${shields}`;
  const config = G.createBattleConfig(runtime.pokemonMap.get(attacker), runtime.pokemonMap.get(defender),
    G.DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
  config.left.shieldMode = config.right.shieldMode = "smart";
  const simulate = options => adapter.simulate({
    id: ++sequence, key, config, aShields: shields, bShields: shields,
    trace: true, debugTimeline: true, includeSwing: false, ...options
  });
  const result = simulate();
  assert.equal(result.details.outcome, winner, `${key}: verify the winning move order for both actors.`);
  assert.equal(result.timelineTrace.find(event => event.kind === "charge" && event.trainer === "A")?.moveId,
    opener, `${key}: verify the appropriate opener, including useful self-debuffing pressure.`);
  assert.deepEqual(Reliability.validateTrace(result.decisionTrace), [], key);
  for (const decision of result.decisionTrace.decisions) {
    if (decision.finalAuthority !== "PRINCIPLE_ENGINE" || !decision.principleResult?.action) continue;
    assert.equal(decision.finalAction?.moveId, decision.principleResult?.action?.moveId,
      `${key}: nested rollout memoization must not replace the selected move.`);
    assert.equal(decision.finalAction?.type, decision.principleResult?.action?.type);
    const comparison = decision.principleResult?.evidence?.compact?.postProcessing?.chargedComparison;
    if (!comparison) continue;
    comparisons++;
    assert.equal(comparison.alternatives.length, 2);
    assert(comparison.alternatives.every(branch => branch.complete), "Incomplete continuations cannot select a move.");
    const chosen = comparison.alternatives.find(branch => branch.moveId === comparison.moveId);
    const original = comparison.alternatives.find(branch => branch.moveId === comparison.originalMoveId);
    assert(chosen.outcome >= original.outcome, "Prefer outcome class over damage, HP or energy.");
    if (chosen.outcome === original.outcome && comparison.moveId !== comparison.originalMoveId) {
      assert.equal(chosen.outcome, 2, "Only an already projected configured-policy win may use response-wise tie-breaking.");
      const originalOutcome = id => original.responses.find(response => response.responseId === id).outcome;
      assert(chosen.responses.every(response => response.outcome >= originalOutcome(response.responseId)));
      assert(chosen.responses.some(response => response.outcome > originalOutcome(response.responseId)));
    }
  }
  if (attacker === "dewgong" && defender === "talonflame_shadow") {
    assert.equal(result.timelineTrace.find(event => event.kind === "charge" && event.trainer === "B")?.moveId,
      "FLAME_CHARGE", "The opponent can now throw its guaranteed buff before another long Fast.");
  }
  for (const options of [{ continuationMode: "flip-analysis" }, { counterfactuals: true }, {}]) {
    assert.equal(ledger(simulate(options)), ledger(result),
      `${key}: swing analysis, diagnostics and reused workers must preserve the battle.`);
  }
}
assert(comparisons >= 4, "Exercise completed comparisons rather than only the fallback policy.");
console.log(`Strategic move ordering passed: ${fixtures.length} matchups, ${comparisons} completed comparisons.`);
