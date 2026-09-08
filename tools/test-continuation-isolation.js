"use strict";

const assert = require("assert");
const { createRuntime } = require("./run-battle-regressions");
const { DEFAULT_PROFILE, createBattleConfig, createWorkerAdapter, extractLiveWorkerSource } = require("./build-great-league-meta-database");

const runtime = createRuntime();
const adapter = createWorkerAdapter(extractLiveWorkerSource(), { dreStandard: true });
let sequence = 0;
let checked = 0;
for (const [a, b] of [
  ["furret", "talonflame_shadow"], ["melmetal", "corsola_galarian"],
  ["cramorant", "azumarill"], ["dewgong", "dunsparce"]
]) {
  for (const reverse of [false, true]) {
    const pair = reverse ? [b, a] : [a, b];
    const config = createBattleConfig(...pair.map(id => runtime.pokemonMap.get(id)), DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
    config.left.shieldMode = config.right.shieldMode = "always";
    for (const shields of [1, 2]) {
      const simulate = (counterfactuals, includeSwing = false) => adapter.simulate({
        id: ++sequence, key: `${pair.join("/")}/${shields}`, config,
        aShields: shields, bShields: shields, trace: true, debugTimeline: true,
        includeSwing, counterfactuals
      });
      const baseline = simulate(false), observed = simulate(true), matrix = simulate(false, true), repeated = simulate(false);
      for (const result of [observed, matrix, repeated]) {
        assert.deepStrictEqual(result.decisionTrace.finalState, baseline.decisionTrace.finalState,
          "Diagnostic shield continuations must not alter HP, energy, shields, stages or ready turns.");
        const events = battle => Array.from(battle.timelineTrace, event => ({
          side: event.trainer, kind: event.kind, move: event.moveId, start: event.start,
          damage: event.damage, energyBefore: event.energyBefore, energyAfter: event.energyAfter,
          hpBefore: event.hpBefore, hpAfter: event.hpAfter
        }));
        assert.deepStrictEqual(events(result), events(baseline), "Observing a battle must not change its actions or damage ledger.");
      }
      checked++;
    }
  }
}
console.log(`Continuation isolation passed: ${checked} cases, diagnostics on/off and repeated worker use.`);
