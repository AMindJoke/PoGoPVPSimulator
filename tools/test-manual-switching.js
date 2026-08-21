"use strict";

const assert = require("node:assert/strict");
const Timing = require("../src/battle/manual-battle-timing.js");
const Switching = require("../src/battle/manual-switching.js");

const pokemon = (id, hp, energy, attackStage = 0, defenseStage = 0) => ({
  trainer: "A", p: { id, name: id }, hp, maxHp: 150, energy, attackStage, defenseStage
});
const active = pokemon("talonflame", 91, 44, 2, -1);
let switchState = Switching.createState();
switchState = Switching.addBenchPokemon(switchState, "A", active, pokemon("azumarill", 120, 35, -2, 1));
switchState = Switching.addBenchPokemon(switchState, "A", active, pokemon("dunsparce", 140, 0));
assert.equal(Switching.validBench(switchState, "A").length, 2);

let timing = Timing.advanceToTurn(Timing.createState(), 20);
let legal = Switching.legality({ side: "A", active, switchState, timing, actionReady: true });
assert.equal(legal.legal, true);
assert.equal(Switching.legality({ side: "A", active, switchState, timing, actionReady: false }).reason, Switching.REASON.ACTION_LOCKED);

const switched = Switching.switchActive({ side: "A", active, incomingId: "azumarill", switchState, timing });
assert.equal(switched.active.p.id, "azumarill");
assert.equal(switched.active.hp, 120);
assert.equal(switched.active.energy, 35);
assert.equal(switched.active.attackStage, 0, "temporary stages reset on entry");
assert.equal(switched.switchState.A.bench[0].p.id, "talonflame");
assert.equal(switched.switchState.A.bench[0].hp, 91);
assert.equal(switched.switchState.A.bench[0].energy, 44);
assert.equal(switched.switchState.A.bench[0].attackStage, 0, "temporary stages reset on exit");
assert.equal(Timing.remainingSwitchMs(switched.timing, "A"), 45000);
assert.equal(Timing.remainingSwitchMs(switched.timing, "B"), 0);
legal = Switching.legality({ side: "A", active: switched.active, switchState: switched.switchState, timing: switched.timing, actionReady: true });
assert.equal(legal.reason, Switching.REASON.COOLDOWN);
assert.equal(Switching.legality({ side: "A", active: { ...active, hp: 0 }, switchState, timing, actionReady: true }).reason, Switching.REASON.FAINTED_ACTIVE);

console.log("Manual voluntary switching tests passed.");
