"use strict";

const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");
const Audit = require("./audit-planner-alternatives");

const runtime = R.createRuntime();
let source = G.extractLiveWorkerSource();
const anchor = "const counterfactual = input.counterfactual || null;";
assert.equal(source.split(anchor).length, 2);
// A one-level forecast must reproduce an actual replay with the same future
// policy. Disable only the adaptive shield refinement for this comparison;
// the forecast still runs, records both outcomes and uses canonical mechanics.
source = source.replace(anchor, "const counterfactual = null;");
const worker = G.createWorkerAdapter(Audit.instrument(source), { dreStandard: true, strict: true });
const all = Audit.buildCases(runtime);
const cases = [...all.slice(0, 12), ...all.filter(item => item.id === "golden--defense-buff-sableye-empoleon-1s")];
for (const [a, b] of [["morpeko_full_belly", "skarmory"], ["aegislash_shield", "snorlax"], ["cramorant", "swampert"], ["swampert", "mimikyu"]]) {
  const config = G.createBattleConfig(runtime.pokemonMap.get(a), runtime.pokemonMap.get(b), G.DEFAULT_PROFILE,
    runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
  config.left.shieldMode = config.right.shieldMode = "smart";
  cases.push({ id: `form--${a}--${b}`, config, shields: 1 });
}
let comparisons = 0;
for (const [index, item] of cases.entries()) {
  const payload = { id: index, key: item.id, config: item.config, aShields: item.shields,
    bShields: item.shields, trace: true, debugTimeline: true, includeSwing: false };
  const base = worker.simulate(payload);
  for (const node of base.alternativeAudit.nodes.filter(node => node.kind === "shield")) {
    const forecast = base.decisionTrace.shieldCounterfactuals.find(record =>
      record.turn === node.turn && record.side === node.side && record.moveId === node.moveId);
    assert(forecast?.complete, `${item.id}: a normal automatic shield decision needs both complete forecasts.`);
    for (const type of ["shield", "no_shield"]) {
      const branch = type === node.chosen.type ? base : worker.simulate({ ...payload, auditTarget: { index: node.index, type } });
      const expected = type === "shield" ? forecast.withShield : forecast.withoutShield;
      const state = branch.decisionTrace.finalState[node.side];
      const outcome = branch.details.outcome === "draw" ? "draw" : branch.details.outcome === node.side ? "win" : "loss";
      assert.deepEqual([expected.outcome, expected.remainingHp, expected.remainingEnergy, expected.remainingShields],
        [outcome, state.hp, state.energy, state.shields], `${item.id} ${node.side} T${node.turn}: ${type} must reproduce the live result, including the previous shield in CMP.`);
      comparisons++;
    }
  }
}
assert(comparisons >= 60);
console.log(`Shield continuation parity passed: ${cases.length} cases, ${comparisons} forecasts/replays, including CMP and form changes.`);
