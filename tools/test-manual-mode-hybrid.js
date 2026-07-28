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
  turnState: state(),
  controlledSides: ["A"],
  manualIntent: { side: "A", type: "fast", moveId: "FAST_A" },
  automaticIntent: {
    side: "B",
    type: "wait",
    metadata: { timingWindow: { waitTurns: 1 } }
  }
});
assert.equal(decision.status, Hybrid.STATUS.JOINT_REGISTERED);
assert.deepEqual(decision.registrations.map(item => [item.sideId, item.type]), [
  ["A", "fast"],
  ["B", "wait"]
]);

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

async function testExecution() {
  const calls = [];
  const cmpDecision = Hybrid.coordinateDecision({
    turnState: state(),
    controlledSides: ["A"],
    manualIntent: { side: "A", type: "charged", moveId: "CHARGE_A" },
    automaticIntent: { side: "B", type: "charged", moveId: "CHARGE_B" }
  });
  let finalized = 0;
  let execution = await Hybrid.executeCoordinatedDecision(cmpDecision, {
    executeManual: async registration => {
      calls.push(`manual:${registration.sideId}`);
      return { ok: true };
    },
    executeAutomatic: async registration => {
      calls.push(`auto:${registration.sideId}`);
      return { ok: true };
    },
    isTerminal: () => false,
    finalizeTurn: () => {
      finalized++;
      return "finalized";
    }
  });
  assert.equal(execution.ok, true);
  assert.deepEqual(calls, ["manual:A", "auto:B"]);
  assert.equal(finalized, 1, "A joint turn must be finalized exactly once.");
  assert.equal(execution.finalized, "finalized");

  const fastVsCharge = Hybrid.coordinateDecision({
    turnState: state(),
    controlledSides: ["A"],
    manualIntent: { side: "A", type: "fast", moveId: "FAST_A" },
    automaticIntent: { side: "B", type: "charged", moveId: "CHARGE_B" }
  });
  let terminal = false;
  const collisionCalls = [];
  execution = await Hybrid.executeCoordinatedDecision(fastVsCharge, {
    executeManual: () => {
      throw new Error("The ordinary Fast executor must not run after the preceding Charged caused a faint.");
    },
    executeAutomatic: async registration => {
      collisionCalls.push(`auto:${registration.type}`);
      terminal = true;
      return true;
    },
    isTerminal: () => terminal,
    resolveRegisteredFastAfterCharged: async registration => {
      collisionCalls.push(`registered:${registration.type}`);
      return true;
    },
    finalizeTurn: () => true
  });
  assert.equal(execution.ok, true);
  assert.deepEqual(collisionCalls, ["auto:charged", "registered:fast"]);

  const pausedShieldCalls = [];
  execution = await Hybrid.executeCoordinatedDecision(cmpDecision, {
    executeManual: async registration => {
      pausedShieldCalls.push(`manual-start:${registration.sideId}`);
      await Promise.resolve();
      pausedShieldCalls.push(`manual-shield-complete:${registration.sideId}`);
      return true;
    },
    executeAutomatic: registration => {
      pausedShieldCalls.push(`auto:${registration.sideId}`);
      return true;
    },
    isTerminal: () => false,
    finalizeTurn: () => true
  });
  assert.equal(execution.ok, true);
  assert.deepEqual(pausedShieldCalls, [
    "manual-start:A",
    "manual-shield-complete:A",
    "auto:B"
  ], "The registered automatic intent must wait for the shield decision without being replanned.");

  execution = await Hybrid.executeCoordinatedDecision(
    { status: Hybrid.STATUS.AWAITING_MANUAL, registrations: [] },
    {
      executeManual: () => true,
      executeAutomatic: () => true
    }
  );
  assert.equal(execution.ok, false);
  assert.equal(execution.reason, "DECISION_NOT_EXECUTABLE");
}

testExecution()
  .then(() => console.log("Manual Mode hybrid coordinator and executor tests passed."))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
