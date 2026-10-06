"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Timing = require("../src/battle/manual-battle-timing.js");
const Switching = require("../src/battle/manual-switching.js");

const html = fs.readFileSync(path.resolve(__dirname, "..", "PogoPvp.html"), "utf8");
const clone = value => JSON.parse(JSON.stringify(value));
const pokemon = (side, id, extra = {}) => ({
  trainer: side,
  p: { id, name: id },
  hp: 120,
  maxHp: 150,
  energy: 40,
  attackStage: 0,
  defenseStage: 0,
  ...extra
});
function roster(side, active, bench) {
  return Switching.addBenchPokemon(Switching.createState(), side, active, bench);
}
function windowFor(actor, sourceEventId = `charge-${actor}`, extra = {}) {
  return Timing.openPostChargedSwitchWindow(Timing.advanceToTurn(Timing.createState(), 20), {
    turn: 20,
    sourceEventId,
    chargedAttackActor: actor,
    ...extra
  });
}

const activeA = pokemon("A", "talonflame");
const benchA = pokemon("A", "azumarill");
const stateA = roster("A", activeA, benchA);
const activeB = pokemon("B", "lickilicky");
const benchB = pokemon("B", "froslass");
const stateB = roster("B", activeB, benchB);

// 1 — own Charged → own 0-turn switch.
const ownWindow = windowFor("A");
const ownSwitch = Switching.switchActive({ side: "A", active: activeA, incomingId: "azumarill", switchState: stateA, timing: ownWindow });
assert.equal(ownSwitch.turnCost, 0);
assert.equal(ownSwitch.postCharged, true);

// 2 — opponent Charged → receiver may also use the zero-turn end window.
const receiverSwitch = Switching.switchActive({ side: "B", active: activeB, incomingId: "froslass", switchState: stateB, timing: ownWindow });
assert.equal(receiverSwitch.turnCost, 0);
assert.equal(receiverSwitch.postCharged, true);

// 3/4 — shielded and unshielded resolution retain the same receiver cost.
for (const shielded of [true, false]) {
  const resolvedWindow = windowFor("A", `charge-shield-${shielded}`, { shielded });
  const legal = Switching.legality({ side: "B", active: activeB, switchState: stateB, timing: resolvedWindow, actionReady: true, shielded });
  assert.equal(legal.turnCost, 0, `receiver cost changed for shielded=${shielded}`);
}

// 5 — shielding by the target does not remove the actor's own 0-turn window.
assert.equal(Switching.legality({ side: "A", active: activeA, switchState: stateA, timing: windowFor("A", "charge-own-shielded", { shielded: true }), actionReady: true }).turnCost, 0);

// 6/7 — partial Fast progress is neither switch-legal nor preserved on a later legal switch.
const midCycle = pokemon("A", "talonflame", { fastMoveCycleProgress: 1, timingPlanMoveId: "FLAME_CHARGE", timingPlanFastMovesRemaining: 2 });
const midBench = pokemon("A", "azumarill", { fastMoveCycleProgress: 1, timingPlanMoveId: "PLAY_ROUGH", timingPlanFastMovesRemaining: 1 });
const midState = roster("A", midCycle, midBench);
assert.equal(Switching.legality({ side: "A", active: midCycle, switchState: midState, timing: Timing.createState(), actionReady: false }).reason, Switching.REASON.ACTION_LOCKED);
const progressReset = Switching.switchActive({ side: "A", active: midCycle, incomingId: "azumarill", switchState: midState, timing: Timing.createState() });
assert.equal(progressReset.active.fastMoveCycleProgress, 0);
assert.equal(progressReset.switchState.A.bench[0].fastMoveCycleProgress, 0);

// 8 — timeline semantics inherit the exact deterministic switch duration.
const ownTimelineEvent = { kind: "switch", start: 20, duration: ownSwitch.turnCost, turnCost: ownSwitch.turnCost };
const receiverTimelineEvent = { kind: "switch", start: 20, duration: receiverSwitch.turnCost, turnCost: receiverSwitch.turnCost };
assert.equal(receiverTimelineEvent.start + receiverTimelineEvent.duration - (ownTimelineEvent.start + ownTimelineEvent.duration), 0);

// 9 — Undo/Redo snapshots reproduce the same causal result.
const before = clone({ timing: ownWindow, switchState: stateB, active: activeB, turn: 20 });
const firstResult = Switching.switchActive({ side: "B", active: before.active, incomingId: "froslass", switchState: before.switchState, timing: before.timing });
const undone = clone(before);
const redone = Switching.switchActive({ side: "B", active: undone.active, incomingId: "froslass", switchState: undone.switchState, timing: undone.timing });
assert.deepEqual(redone, firstResult);

// 10 — export/import preserves the two-sided window and the Charged Attack actor provenance.
const imported = Timing.createState(JSON.parse(JSON.stringify(windowFor("B", "charge-export"))));
assert.equal(imported.postChargedSwitchWindow.chargedAttackActor, "B");
assert.equal(Timing.postChargedSwitchEligible(imported, "A"), true);
assert.equal(Timing.postChargedSwitchEligible(imported, "B"), true);

// 11 — a KO Charged never opens a voluntary switch window; Bring Next remains separate.
assert.match(html, /Number\(left\?\.hp \|\| 0\) <= 0 \|\| Number\(right\?\.hp \|\| 0\) <= 0/);
assert.match(html, /kind: "switch"/);
assert.match(html, /manualBringNext/);

// 12 — the next battle turn advances deterministic time and cooldown by 0.5s.
assert.equal(Timing.TURN_DURATION_MS, 500);
const afterReceiverTurn = Timing.advanceToTurn(receiverSwitch.timing, 21);
assert.equal(afterReceiverTurn.elapsedBattleMs - receiverSwitch.timing.elapsedBattleMs, 500);
assert.equal(Timing.remainingSwitchMs(afterReceiverTurn, "B"), 44500);

// Back-to-back Charged Attacks replace the source event while reopening both opportunities.
const replacedWindow = Timing.openPostChargedSwitchWindow(ownWindow, { turn: 21, sourceEventId: "charge-B", chargedAttackActor: "B" });
assert.equal(Timing.postChargedSwitchEligible(replacedWindow, "A"), true);
assert.equal(Timing.postChargedSwitchEligible(replacedWindow, "B"), true);

// Legacy post-Charged windows migrate to the current two-sided rule.
const legacy = Timing.createState({ version: 2, postChargedSwitchWindow: { turn: 20, sourceEventId: "legacy", eligibleSides: ["A", "B"] } });
assert.deepEqual(legacy.postChargedSwitchWindow.eligibleSides, ["A", "B"]);

// Exercise the actual page adapter: registering the thrower's next Fast must
// not consume the receiver's simultaneous zero-turn switch opportunity.
const closeAdapter = html.slice(html.indexOf("    function closeManualPostChargedSwitchWindow("),
  html.indexOf("    function openManualPostChargedSwitchWindow("));
for (const actor of ["A", "B"]) for (const shielded of [false, true]) {
  const receiver = actor === "A" ? "B" : "A";
  const context = {
    window: { PvPeakManualBattleTiming: Timing }, manualModeState: { enabled: true },
    chargedContinuationDepth: 0, manualBattleTiming: windowFor(actor, "charge-boundary", { shielded })
  };
  context.syncManualBattleTiming = () => context.manualBattleTiming;
  vm.createContext(context);
  vm.runInContext(closeAdapter, context);
  context.closeManualPostChargedSwitchWindow(actor);
  assert.equal(Timing.postChargedSwitchEligible(context.manualBattleTiming, actor), false);
  assert.equal(Timing.postChargedSwitchEligible(context.manualBattleTiming, receiver), true,
    `${actor} Fast must preserve ${receiver}'s switch at the same boundary`);
  const state = receiver === "A" ? stateA : stateB;
  const active = receiver === "A" ? activeA : activeB;
  const incomingId = receiver === "A" ? "azumarill" : "froslass";
  const result = Switching.switchActive({ side: receiver, active, incomingId, switchState: state,
    timing: context.manualBattleTiming });
  assert.equal(result.turnCost, 0);
  assert.equal(result.timing.elapsedBattleMs, context.manualBattleTiming.elapsedBattleMs);
}

// A window cannot survive actual battle-time progression, or be resurrected
// by a serialized state. Charged trigger time and the next decision differ.
const sequenceEnd = Timing.advanceToTurn(Timing.createState(), 21);
const boundaryWindow = Timing.openPostChargedSwitchWindow(sequenceEnd,
  { turn: 20, sourceEventId: "charge-trigger-20", chargedAttackActor: "A" });
assert.equal(Timing.postChargedSwitchEligible(boundaryWindow, "B"), true);
assert.equal(Timing.postChargedSwitchEligible(Timing.advanceToTurn(boundaryWindow, 21), "B"), true);
const later = Timing.advanceToTurn(boundaryWindow, 22);
assert.equal(Timing.postChargedSwitchEligible(later, "B"), false);
assert.equal(Timing.createState(JSON.parse(JSON.stringify(later))).postChargedSwitchWindow, null);
assert.equal(Switching.legality({ side: "B", active: activeB, switchState: stateB,
  timing: later, actionReady: true }).turnCost, 1);
for (const functionName of ["useFast", "useTimingWait"]) {
  const start = html.indexOf(`    function ${functionName}(`);
  assert.match(html.slice(start, start + 900), /closeManualPostChargedSwitchWindow\(attacker\.trainer\)/);
}

console.log("Post-Charged switch timing regression matrix passed.");
