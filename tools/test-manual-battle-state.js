"use strict";

const assert = require("node:assert/strict");
const State = require("../src/scenario/manual-battle-state.js");

const combatant = {
  trainer: "A",
  p: { id: "whiscash", name: "Whiscash" },
  hp: 120,
  maxHp: 140,
  energy: 25,
  shields: 2,
  attackStage: 0,
  defenseStage: 0
};

assert.equal(State.normalizeReviewMode(undefined), State.REVIEW_MODE.MANUAL);
assert.equal(State.normalizeReviewMode(State.REVIEW_MODE.AUTOMATIC), State.REVIEW_MODE.AUTOMATIC);
assert.equal(State.normalizeReviewMode("unknown"), State.REVIEW_MODE.MANUAL);

const normalized = State.normalizeManualBattleState(combatant, {
  hp: 999,
  energy: -7,
  shields: 8,
  attackStage: -12,
  defenseStage: 12
});
assert.deepEqual(normalized, {
  pokemonId: "whiscash",
  hp: 140,
  maxHp: 140,
  energy: 0,
  attackStage: -4,
  defenseStage: 4,
  shields: 2,
  fainted: false
});

const fainted = State.applyManualBattleState(combatant, {
  hp: "not-a-number",
  energy: 47.4,
  shields: 1,
  attackStage: 1,
  defenseStage: -2
});
assert.equal(fainted.hp, 120);
assert.equal(combatant.energy, 47);
assert.equal(combatant.shields, 1);
assert.equal(combatant.attackStage, 1);
assert.equal(combatant.defenseStage, -2);
assert.equal(fainted.fainted, false);

assert.equal(State.applyManualBattleState(combatant, { hp: 0 }).fainted, true);
assert.throws(() => State.normalizeManualBattleState({}, {}), /ACTIVE_POKEMON_REQUIRED/);

console.log("Manual Battle State normalization tests passed.");
