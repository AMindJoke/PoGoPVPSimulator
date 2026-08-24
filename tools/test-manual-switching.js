"use strict";

const assert = require("node:assert/strict");
const Timing = require("../src/battle/manual-battle-timing.js");
const Switching = require("../src/battle/manual-switching.js");

const pokemon = (id, hp, energy, attackStage = 0, defenseStage = 0, trainer = "A") => ({
  trainer, p: { id, name: id }, hp, maxHp: 150, energy, attackStage, defenseStage
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
assert.equal(switched.turnCost, 1, "a normal voluntary switch costs one turn");
assert.equal(switched.postCharged, false);
legal = Switching.legality({ side: "A", active: switched.active, switchState: switched.switchState, timing: switched.timing, actionReady: true });
assert.equal(legal.reason, Switching.REASON.COOLDOWN);
assert.equal(Switching.legality({ side: "A", active: { ...active, hp: 0 }, switchState, timing, actionReady: true }).reason, Switching.REASON.FAINTED_ACTIVE);

const postChargedTiming = Timing.openPostChargedSwitchWindow(timing, {
  turn: 20,
  sourceEventId: "charge-1",
  chargedAttackActor: "A"
});
const postChargedLegal = Switching.legality({ side: "A", active, switchState, timing: postChargedTiming, actionReady: true });
assert.equal(postChargedLegal.postCharged, true);
assert.equal(postChargedLegal.turnCost, 0);
const freeSwitch = Switching.switchActive({ side: "A", active, incomingId: "azumarill", switchState, timing: postChargedTiming });
assert.equal(freeSwitch.turnCost, 0, "a voluntary switch at the end of a Charged Attack costs zero turns");
assert.equal(freeSwitch.postCharged, true);
assert.equal(Timing.postChargedSwitchEligible(freeSwitch.timing, "A"), false);
assert.equal(Timing.postChargedSwitchEligible(freeSwitch.timing, "B"), false, "the Charged Attack receiver never receives a free switch window");
assert.equal(Timing.remainingSwitchMs(freeSwitch.timing, "A"), 45000, "a zero-turn switch still starts the normal cooldown");

let receiverSwitchState = Switching.createState();
const receiver = pokemon("lickilicky", 130, 40, 0, 0, "B");
const receiverBench = pokemon("froslass", 111, 12, 0, 0, "B");
receiverSwitchState = Switching.addBenchPokemon(receiverSwitchState, "B", receiver, receiverBench);
const receiverLegal = Switching.legality({
  side: "B",
  active: receiver,
  switchState: receiverSwitchState,
  timing: postChargedTiming,
  actionReady: true,
  shielded: false
});
assert.equal(receiverLegal.postCharged, false, "receiving an unshielded Charged Attack does not grant a free switch");
assert.equal(receiverLegal.turnCost, 1, "the receiver's switch costs exactly one turn");
const shieldedReceiverLegal = Switching.legality({
  side: "B",
  active: receiver,
  switchState: receiverSwitchState,
  timing: postChargedTiming,
  actionReady: true,
  shielded: true
});
assert.equal(shieldedReceiverLegal.turnCost, 1, "shielding does not change receiver switch timing");
const receiverSwitch = Switching.switchActive({
  side: "B",
  active: receiver,
  incomingId: "froslass",
  switchState: receiverSwitchState,
  timing: postChargedTiming
});
assert.equal(receiverSwitch.turnCost, 1);
assert.equal(receiverSwitch.postCharged, false);
const receiverAfterTurn = Timing.advanceToTurn(receiverSwitch.timing, 21);
assert.equal(receiverAfterTurn.elapsedBattleMs - receiverSwitch.timing.elapsedBattleMs, Timing.TURN_DURATION_MS, "the switch action advances deterministic time by one turn");
assert.equal(Timing.remainingSwitchMs(receiverAfterTurn, "B"), 44500, "the consumed turn progresses the 45 second switch cooldown");

const shieldedOwnWindow = Timing.openPostChargedSwitchWindow(timing, {
  turn: 20,
  sourceEventId: "charge-shielded",
  chargedAttackActor: "A",
  shielded: true
});
assert.equal(Switching.legality({ side: "A", active, switchState, timing: shieldedOwnWindow, actionReady: true }).turnCost, 0, "the actor keeps its free switch even when the target shields");

const plannedActive = { ...active, timingPlanMoveId: "FLAME_CHARGE", timingPlanFastMovesRemaining: 2, fastMoveCycleProgress: 1 };
let progressState = Switching.createState();
progressState = Switching.addBenchPokemon(progressState, "A", plannedActive, {
  ...pokemon("azumarill", 120, 35),
  timingPlanMoveId: "PLAY_ROUGH",
  timingPlanFastMovesRemaining: 1,
  fastMoveCycleProgress: 1
});
const resetProgress = Switching.switchActive({
  side: "A",
  active: plannedActive,
  incomingId: "azumarill",
  switchState: progressState,
  timing
});
assert.equal(resetProgress.active.fastMoveCycleProgress, 0, "an incoming Pokémon never resumes partial Fast Attack progress");
assert.equal(resetProgress.active.timingPlanMoveId, null);
assert.equal(resetProgress.switchState.A.bench[0].fastMoveCycleProgress, 0, "the outgoing Pokémon discards partial Fast Attack progress");
assert.equal(resetProgress.switchState.A.bench[0].timingPlanFastMovesRemaining, 0);

console.log("Manual voluntary switching tests passed.");
