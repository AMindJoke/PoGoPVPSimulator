"use strict";

const assert = require("node:assert/strict");
const Turn = require("../src/battle/turn-resolution-engine.js");
const Action = require("../src/battle/manual-action.js");
const Runtime = require("../src/battle/manual-runtime.js");

(async function run() {
  let state = Turn.createState({
    currentTurn: 10,
    sides: {
      A: {
        id: "A", hp: 100, energy: 50, attack: 120, readyTurn: 10,
        fastMove: { id: "MUD_SHOT", energyGain: 9, turns: 2 },
        chargedMoves: [{ id: "MUD_BOMB", energyCost: 45 }]
      },
      B: {
        id: "B", hp: 80, energy: 20, attack: 110, readyTurn: 10,
        fastMove: { id: "ASTONISH", energyGain: 9, turns: 3 },
        chargedMoves: [{ id: "NIGHT_SHADE", energyCost: 55 }]
      }
    }
  });
  state.sides.A.shields = 1;
  state.sides.B.shields = 1;
  const phases = [];

  const runtime = Runtime.createRuntime({
    getState: () => state,
    getBranchId: () => "MANUAL-CHARGED",
    getDecisionPoint: () => Action.createDecisionPoint({
      state,
      legalActionsBySide: {
        A: Turn.getLegalActions(state, "A"),
        B: Turn.getLegalActions(state, "B")
      }
    }),
    getLegalActions: side => Turn.getLegalActions(state, side),
    resolveFast: () => false,
    getShieldDecisionPoint: ({ attackerSide, defenderSide, action }) => Action.createDecisionPoint({
      state,
      phase: Action.DECISION_PHASE.SHIELD_DECISION,
      shieldDecision: { attackerSide, defenderSide, moveId: action.moveId }
    }),
    requestShieldDecision: async () => true,
    onDecisionPhase: phase => phases.push(phase.phase),
    resolveCharged: async ({ shielded, moveId }) => {
      assert.equal(shielded, true);
      assert.equal(moveId, "MUD_BOMB");
      state = Turn.createState({
        currentTurn: 11,
        sides: {
          A: { ...state.sides.A, energy: 5, readyTurn: 11 },
          B: { ...state.sides.B, hp: 79, readyTurn: 11 }
        }
      });
      state.sides.A.shields = 1;
      state.sides.B.shields = 0;
      return true;
    }
  });

  const result = await runtime.request({
    side: "A",
    actionType: Action.ACTION_TYPE.CHARGED_MOVE,
    moveId: "MUD_BOMB"
  });
  assert.equal(result.ok, true);
  assert.deepEqual(phases, ["SHIELD_DECISION", "RESOLVING_CHARGED"]);
  assert.equal(state.sides.A.energy, 5);
  assert.equal(state.sides.B.hp, 79);
  assert.equal(state.sides.B.shields, 0);
  const trace = runtime.getTrace();
  assert(trace.some(entry => entry.actionType === Action.ACTION_TYPE.SHIELD && entry.traceState === Runtime.TRACE_STATE.RESOLVED));
  assert(trace.some(entry => entry.moveId === "MUD_BOMB" && entry.traceState === Runtime.TRACE_STATE.RESOLVED));
  assert.equal(trace.at(-1).delta.B.shields, -1);

  console.log("Manual Mode Charged and shield tests passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
