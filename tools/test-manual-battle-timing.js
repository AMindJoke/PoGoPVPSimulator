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

state = Timing.openPostChargedSwitchWindow(state, { turn: 55, sourceEventId: "charge-1", chargedAttackActor: "A" });
assert.equal(Timing.postChargedSwitchEligible(state, "A"), true);
assert.equal(Timing.postChargedSwitchEligible(state, "B"), false, "the Charged Attack receiver never inherits the actor's free switch");
state = Timing.consumePostChargedSwitch(state, "A");
assert.equal(Timing.postChargedSwitchEligible(state, "A"), false, "the free post-Charged switch is consumed independently per side");
assert.equal(Timing.postChargedSwitchEligible(state, "B"), false);
state = Timing.closePostChargedSwitchWindow(state);
assert.equal(state.postChargedSwitchWindow, null, "a later battle action closes the post-Charged window");

state = Timing.openPostChargedSwitchWindow(state, { turn: 55, sourceEventId: "charge-2", chargedAttackActor: "B" });

const restored = Timing.createState(JSON.parse(JSON.stringify(state)));
assert.deepEqual(restored, state, "timing state is serializable and deterministic");
assert.equal(restored.postChargedSwitchWindow.sourceEventId, "charge-2");
assert.equal(restored.postChargedSwitchWindow.chargedAttackActor, "B");
const ambiguousLegacy = Timing.createState({
  version: 2,
  postChargedSwitchWindow: { turn: 55, sourceEventId: "legacy-charge", eligibleSides: ["A", "B"] }
});
assert.equal(ambiguousLegacy.postChargedSwitchWindow, null, "ambiguous legacy state must not grant a free switch to both sides");
const singleSideLegacy = Timing.createState({
  version: 2,
  postChargedSwitchWindow: { turn: 55, sourceEventId: "legacy-charge-b", eligibleSides: ["B"] }
});
assert.equal(singleSideLegacy.postChargedSwitchWindow.chargedAttackActor, "B", "unambiguous legacy state remains compatible");
assert.equal(Timing.formatSeconds(31500), "31.5s");
assert.equal(Timing.formatSeconds(45000), "45s");

console.log("Manual battle timing tests passed.");
