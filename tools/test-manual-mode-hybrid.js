"use strict";

const assert = require("node:assert/strict");
const Hybrid = require("../src/battle/manual-hybrid.js");

function state(overrides = {}) {
  return {
    currentTurn: 10,
    sides: {
      A: {
        hp: 100,
        energy: 100,
        attack: 120,
        readyTurn: 10,
        fastMove: { id: "FAST_A", energyGain: 8, cooldown: 2 },
        chargedMoves: [{ id: "CHARGE_A", energyCost: 40 }]
      },
      B: {
        hp: 100,
        energy: 100,
        attack: 110,
        readyTurn: 10,
        fastMove: { id: "FAST_B", energyGain: 9, cooldown: 1 },
        chargedMoves: [{ id: "CHARGE_B", energyCost: 45 }]
      }
    },
    ...overrides
  };
}

let decision = Hybrid.coordinateDecision({
  turnState: state(),
  controlledSides: ["A"],
  automaticIntent: { side: "B", type: "charged", moveId: "CHARGE_B" }
});
assert.equal(decision.status, Hybrid.STATUS.AWAITING_MANUAL);
assert.deepEqual(decision.registrations, [], "Automatic play must not pre-empt a ready manual side.");
assert.deepEqual(decision.missingManualSides, ["A"]);

decision = Hybrid.coordinateDecision({
  turnState: state(),
  controlledSides: ["A"],
  manualIntent: { side: "A", type: "charged", moveId: "CHARGE_A" },
  automaticIntent: { side: "B", type: "charged", moveId: "CHARGE_B" }
});
assert.equal(decision.status, Hybrid.STATUS.JOINT_REGISTERED);
assert.equal(decision.collision, "CHARGED_VS_CHARGED");
assert.equal(decision.cmp.winnerSide, "A");
assert.deepEqual(decision.registrations.map(item => item.sideId), ["A", "B"]);

decision = Hybrid.coordinateDecision({
  turnState: state({
    currentTurn: 12,
    sides: {
      ...state().sides,
      A: { ...state().sides.A, attack: 100, readyTurn: 12 },
      B: { ...state().sides.B, attack: 130, readyTurn: 12 }
    }
  }),
  controlledSides: ["A"],
  manualIntent: { side: "A", type: "charged", moveId: "CHARGE_A" },
  automaticIntent: { side: "B", type: "charged", moveId: "CHARGE_B" }
});
assert.equal(decision.cmp.winnerSide, "B");
assert.deepEqual(decision.registrations.map(item => item.sideId), ["B", "A"]);

decision = Hybrid.coordinateDecision({
  turnState: state(),
  controlledSides: ["A"],
  manualIntent: { side: "A", type: "fast", moveId: "FAST_A" },
  automaticIntent: { side: "B", type: "charged", moveId: "CHARGE_B" }
});
assert.equal(decision.collision, "CHARGED_VS_FAST");
assert.deepEqual(decision.registrations.map(item => [item.sideId, item.type]), [
  ["B", "charged"],
  ["A", "fast"]
]);
assert.equal(decision.registrations[1].registrationTurn, 10);

decision = Hybrid.coordinateDecision({
  turnState: state(),
  controlledSides: ["A"],
  manualIntent: { side: "A", type: "fast", moveId: "FAST_A" },
  automaticIntent: { side: "B", type: "fast", moveId: "FAST_B" }
});
assert.equal(decision.collision, "FAST_VS_FAST");
assert.deepEqual(decision.registrations.map(item => item.sideId), ["A", "B"]);

decision = Hybrid.coordinateDecision({
  turnState: state({
    sides: {
      ...state().sides,
      A: { ...state().sides.A, readyTurn: 11 }
    }
  }),
  controlledSides: ["A"],
  automaticIntent: { side: "B", type: "fast", moveId: "FAST_B" }
});
assert.equal(decision.status, Hybrid.STATUS.AUTO_ADVANCE);
assert.deepEqual(decision.registrations.map(item => item.sideId), ["B"]);

decision = Hybrid.coordinateDecision({
  turnState: state(),
  controlledSides: ["A"],
  manualIntent: { side: "A", type: "fast", moveId: "FAST_A" },
  automaticIntent: { side: "B", type: "fast", moveId: "FAST_B" },
  pendingDecision: { phase: "SHIELD_DECISION", defenderSide: "A" }
});
assert.equal(decision.status, Hybrid.STATUS.BLOCKED);
assert.equal(decision.reason, Hybrid.BLOCK_REASON.SHIELD_DECISION);
assert.deepEqual(decision.registrations, []);

decision = Hybrid.coordinateDecision({
  turnState: state(),
  controlledSides: ["A"],
  manualIntent: { side: "A", type: "fast", moveId: "NOT_LEGAL" },
  automaticIntent: { side: "B", type: "fast", moveId: "FAST_B" }
});
assert.equal(decision.status, Hybrid.STATUS.BLOCKED);
assert.equal(decision.reason, Hybrid.BLOCK_REASON.INVALID_STATE);

console.log("Manual Mode hybrid coordinator tests passed.");
