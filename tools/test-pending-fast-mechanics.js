"use strict";

const assert = require("node:assert/strict");
const TurnEngine = require("../src/battle/turn-resolution-engine.js");

const defenseMultiplier = stage => stage >= 0
  ? (4 + stage) / 4
  : 4 / (4 - stage);

function stateFor(defenseStage, pendingEvents = []) {
  return TurnEngine.createState({
    currentTurn: 2,
    sides: {
      A: { id: "fast-user", pokemonId: "fast-user", hp: 100, energy: 0, attack: 120, readyTurn: 2, fastMove: { id: "LONG_FAST", turns: 3, energyGain: 9 }, chargedMoves: [] },
      B: { id: "target", pokemonId: "target", hp: 100, energy: 50, attack: 100, defenseStage, readyTurn: 2, fastMove: { id: "OTHER_FAST", turns: 1, energyGain: 5 }, chargedMoves: [{ id: "SELF_DEF_DROP", energyCost: 50 }] }
    },
    pendingEvents
  });
}

function dynamicDamage(event, state) {
  const target = state.sides[event.targetSide];
  return Math.max(1, Math.floor(10 / defenseMultiplier(target.defenseStage)));
}

const pending = TurnEngine.createFastImpactEvent({
  id: "pending-long-fast",
  sourceSide: "A",
  targetSide: "B",
  moveId: "LONG_FAST",
  moveName: "Long Fast",
  damage: 10,
  startTurn: 0,
  duration: 3,
  timelineIndex: 0
});
assert.equal(pending.resolveTurn, 2);
assert.equal(pending.damageAtRegistration, 10);

// Test A: B registers/resolves a self-Defense debuff before A's impact.
const control = TurnEngine.resolveFastImpact(stateFor(0, [pending]), pending, { damageResolver: dynamicDamage });
const debuffedState = stateFor(-2, [pending]);
const debuffed = TurnEngine.resolveFastImpact(debuffedState, pending, { damageResolver: dynamicDamage });
assert.equal(control.event.damage, 10, "control impact uses neutral Defense");
assert.equal(debuffed.event.damage, 15, "pending opponent Fast uses post-debuff Defense");
assert.equal(control.state.sides.B.hp, 90);
assert.equal(debuffed.state.sides.B.hp, 85);
assert.equal(debuffed.event.damageAtRegistration, 10, "registration trace remains available");

// Test B: the pending event targets the side's active combatant at impact.
const transferEvent = TurnEngine.createFastImpactEvent({
  id: "pending-transfer",
  sourceSide: "A",
  targetSide: "B",
  moveId: "LONG_FAST",
  damage: 10,
  startTurn: 0,
  duration: 5,
  timelineIndex: 1
});
const incoming = TurnEngine.createState({
  currentTurn: 4,
  sides: {
    A: { id: "fast-user", pokemonId: "fast-user", hp: 100, readyTurn: 4 },
    B: { id: "incoming", pokemonId: "incoming", hp: 100, defenseStage: 0, readyTurn: 4 }
  },
  pendingEvents: [transferEvent]
});
const transfer = TurnEngine.resolveDueFastImpacts(incoming, 4, { damageResolver: (event, state) => state.sides[event.targetSide].pokemonId === "incoming" ? 10 : 0 });
assert.equal(transfer.events[0].resolveTurn, 4);
assert.equal(transfer.state.sides.B.pokemonId, "incoming");
assert.equal(transfer.state.sides.B.hp, 90, "impact lands on the incoming active Pokemon");
assert.equal(transfer.events[0].status, "resolved");
const swapBeforeImpact = TurnEngine.eventsDue([
  TurnEngine.createSwapEvent({ id: "latest-valid-switch", side: "B", turn: 3, incomingId: "incoming" }),
  transferEvent
], 4);
assert.deepEqual(swapBeforeImpact.map(event => event.id), ["latest-valid-switch", "pending-transfer"], "the latest valid switch resolves one turn before the Fast impact");
const lateOutgoing = TurnEngine.resolveFastImpact(TurnEngine.createState({
  ...incoming,
  sides: { ...incoming.sides, B: { ...incoming.sides.B, pokemonId: "outgoing", id: "outgoing" } }
}), transferEvent, { damageResolver: () => 10 });
assert.equal(lateOutgoing.state.sides.B.pokemonId, "outgoing");
assert.equal(lateOutgoing.state.sides.B.hp, 90, "a switch after the impact boundary cannot transfer the already-due Fast");

// Automatic and manual entry points share the same resolver semantics.
const manual = TurnEngine.resolveFastImpact(stateFor(-2, [pending]), pending, { damageResolver: dynamicDamage });
const automatic = TurnEngine.resolveDueFastImpacts(stateFor(-2, [pending]), 2, { damageResolver: dynamicDamage });
assert.equal(manual.event.damage, automatic.events[0].damage);
assert.equal(manual.state.sides.B.hp, automatic.state.sides.B.hp);

console.log("Pending Fast mechanics tests passed.");
