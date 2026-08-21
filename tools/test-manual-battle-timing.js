"use strict";

const assert = require("node:assert/strict");
const Timing = require("../src/battle/manual-battle-timing.js");

let state = Timing.createState();
assert.equal(state.elapsedBattleMs, 0);
state = Timing.advanceToTurn(state, 5);
assert.equal(state.elapsedBattleMs, 2500, "canonical turns advance deterministic battle time");
state = Timing.startSwitchCooldown(state, "A");
assert.equal(Timing.remainingSwitchMs(state, "A"), 45000);
assert.equal(Timing.remainingSwitchMs(state, "B"), 0, "cooldowns are independent");
state = Timing.advanceToTurn(state, 35);
assert.equal(Timing.remainingSwitchMs(state, "A"), 30000);
state = Timing.addChargedSequence(state);
assert.equal(state.elapsedBattleMs, 27500);
assert.equal(Timing.remainingSwitchMs(state, "A"), 20000, "Charged Attack time advances the switch clock");
state = Timing.addChargedSequence(state);
state = Timing.advanceToTurn(state, 55);
assert.equal(Timing.remainingSwitchMs(state, "A"), 0, "switch unlocks at the exact elapsed-time boundary");
assert.equal(Timing.canSwitch(state, "A"), true);

const restored = Timing.createState(JSON.parse(JSON.stringify(state)));
assert.deepEqual(restored, state, "timing state is serializable and deterministic");
assert.equal(Timing.formatSeconds(31500), "31.5s");
assert.equal(Timing.formatSeconds(45000), "45s");

console.log("Manual battle timing tests passed.");
