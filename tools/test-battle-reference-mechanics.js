"use strict";

// Controlled actions exercise the live worker, without treating its chosen
// strategy or a saved numerical rating as the source of truth.
const assert = require("node:assert/strict");
const { createRuntime } = require("./run-battle-regressions");
const { createBattleConfig, DEFAULT_PROFILE, createWorkerAdapter, extractLiveWorkerSource } = require("./build-great-league-meta-database");
const runtime = createRuntime({ strict: true });
runtime.adapter = createWorkerAdapter(extractLiveWorkerSource(), { strict: true, dreStandard: true });
const clone = value => JSON.parse(JSON.stringify(value));
let checked = 0;
function mirror(id, fastId) {
  const p = runtime.pokemonMap.get(id);
  const config = createBattleConfig(p, p, DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
  for (const side of [config.left, config.right]) {
    side.fast = clone(runtime.moveMap.get(fastId));
    side.shieldMode = "always";
  }
  return config;
}
function simulate(config, shields = 0, charged = {}) {
  const result = runtime.adapter.simulate({
    id: ++checked, config, aShields: shields, bShields: shields,
    includeSwing: false, counterfactuals: false, trace: true, debugTimeline: true,
    diagnosticPlan: { defaultAction: "fast", chargedSequences: charged }
  });
  for (const side of ["A", "B"]) {
    const final = result.decisionTrace.finalState[side];
    assert(final.hp >= 0 && final.hp <= final.maxHp, "HP must remain within bounds");
    assert(final.energy >= 0 && final.energy <= 100, "Energy must remain within bounds");
    assert(final.shields >= 0 && final.shields <= shields, "Shields cannot be created or overspent");
  }
  assert.equal(result.decisionTrace.intelligenceAudit.legacyFallbackDecisions, 0);
  return result;
}

for (const [id, fastId, turns] of [
  ["altaria", "DRAGON_BREATH", 1], ["florges", "FAIRY_WIND", 2],
  ["corsola_galarian", "ASTONISH", 3], ["hypno", "CONFUSION", 4],
  ["talonflame", "INCINERATE", 5]
]) {
  const config = mirror(id, fastId);
  config.startEnergyA = config.startEnergyB = 99;
  const result = simulate(config);
  assert.equal(result.details.outcome, "draw", `${id}: identical Fast-only mirrors must draw`);
  assert.equal(result.score, 500, `${id}: simultaneous faint must have a neutral rating`);
  for (const side of ["A", "B"]) {
    const events = result.timelineTrace.filter(e => e.kind === "fast" && e.trainer === side);
    assert(events.length >= 3);
    for (const [index, event] of events.slice(0, 3).entries()) {
      assert.equal(event.start, index * turns, `${id}: Fast cooldown`);
      assert.equal(event.resolutionTurn, event.start + turns - 1, `${id}: Fast impact turn`);
      assert.equal(event.energyAfter, 100, `${id}: energy cap, including subsequent Fast attacks`);
    }
    assert.equal(result.decisionTrace.finalState[side].hp, 0);
  }
}

// Unequal Attack CMP: the second queued Charged Attack must not fire after KO.
for (const winner of ["A", "B"]) {
  const config = mirror("florges", "FAIRY_WIND");
  config.startEnergyA = config.startEnergyB = 45;
  config.left.hp = config.right.hp = 1;
  config.left.attack = winner === "A" ? 140 : 100;
  config.right.attack = winner === "B" ? 140 : 100;
  config.left.charged = config.right.charged = [clone(runtime.moveMap.get("CHILLING_WATER"))];
  const result = simulate(config, 0, { A: ["CHILLING_WATER"], B: ["CHILLING_WATER"] });
  const charges = result.timelineTrace.filter(e => e.kind === "charge");
  assert.equal(result.details.outcome, winner);
  assert.equal(charges.length, 1, "A fainted CMP loser cannot execute the queued Charged Attack");
  assert.equal(charges[0].trainer, winner);
  assert.equal(charges[0].energyBefore, 45);
  assert.equal(charges[0].energyAfter, 0);
  assert.equal(charges[0].resolutionTurn, 1);
}

// Shielding spends one shield and deals one damage; guaranteed debuffs still apply.
for (const shields of [1, 2]) {
  const config = mirror("florges", "FAIRY_WIND");
  config.startEnergyA = config.startEnergyB = 100;
  config.left.charged = config.right.charged = [clone(runtime.moveMap.get("CHILLING_WATER"))];
  const sequence = Array(shields).fill("CHILLING_WATER");
  const result = simulate(config, shields, { A: sequence, B: sequence });
  for (const side of ["A", "B"]) {
    const charges = result.timelineTrace.filter(e => e.kind === "charge" && e.trainer === side);
    const uses = result.timelineTrace.filter(e => e.kind === "shield" && e.trainer === side);
    assert.equal(charges.length, shields);
    assert.equal(uses.length, shields);
    for (const charge of charges) {
      assert.equal(charge.energyBefore - charge.energyAfter, 45);
      assert.equal(charge.damage, 1);
      assert.equal(charge.hpBefore - charge.hpAfter, 1);
    }
    assert.equal(result.decisionTrace.finalState[side].shields, 0);
    assert.equal(result.decisionTrace.finalState[side].attackStage, -shields);
  }
}
console.log(`Live worker reference mechanics passed: ${checked} controlled battles (Fast 1–5 turns, mirrors, CMP, energy cap, shields and debuffs).`);
