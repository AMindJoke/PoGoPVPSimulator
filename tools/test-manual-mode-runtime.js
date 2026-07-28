"use strict";

const assert = require("node:assert/strict");
const Turn = require("../src/battle/turn-resolution-engine.js");
const ManualAction = require("../src/battle/manual-action.js");
const Runtime = require("../src/battle/manual-runtime.js");

let state = Turn.createState({
  currentTurn: 0,
  sides: {
    A: {
      id: "A",
      hp: 100,
      energy: 0,
      attack: 100,
      readyTurn: 0,
      fastMove: { id: "DRAGON_BREATH", energyGain: 3, turns: 1 },
      chargedMoves: [{ id: "SURF", energyCost: 45 }]
    },
    B: {
      id: "B",
      hp: 100,
      energy: 0,
      attack: 90,
      readyTurn: 0,
      fastMove: { id: "ROLLOUT", energyGain: 13, turns: 3 },
      chargedMoves: [{ id: "DRILL_RUN", energyCost: 45 }]
    }
  }
});
state.sides.A.shields = 1;
state.sides.B.shields = 1;

const traces = [];
const runtime = Runtime.createRuntime({
  getState: () => state,
  getBranchId: () => "MANUAL-1",
  getDecisionPoint: () => ManualAction.createDecisionPoint({
    state,
    legalActionsBySide: {
      A: Turn.getLegalActions(state, "A"),
      B: Turn.getLegalActions(state, "B")
    }
  }),
  getLegalActions: side => Turn.getLegalActions(state, side),
  resolveFast: ({ side, moveId }) => {
    assert.equal(side, "A");
    assert.equal(moveId, "DRAGON_BREATH");
    state = Turn.createState({
      ...state,
      currentTurn: 1,
      sides: {
        ...state.sides,
        A: { ...state.sides.A, energy: state.sides.A.energy + 3, readyTurn: 1 },
        B: { ...state.sides.B, hp: state.sides.B.hp - 4 }
      }
    });
    state.sides.A.shields = 1;
    state.sides.B.shields = 1;
    return true;
  },
  onTrace: entry => traces.push(entry)
});

const outcome = runtime.request({
  side: "A",
  actionType: ManualAction.ACTION_TYPE.FAST_MOVE,
  moveId: "DRAGON_BREATH"
});
assert.equal(outcome.ok, true);
assert.equal(state.sides.A.energy, 3);
assert.equal(state.sides.B.hp, 96);
assert.deepEqual(
  traces.map(entry => entry.traceState),
  [
    Runtime.TRACE_STATE.REQUESTED,
    Runtime.TRACE_STATE.VALIDATED,
    Runtime.TRACE_STATE.REGISTERED,
    Runtime.TRACE_STATE.RESOLVED
  ]
);
assert.equal(traces.at(-1).branchId, "MANUAL-1");
assert.equal(traces.at(-1).delta.A.energy, 3);
assert.equal(traces.at(-1).delta.B.hp, -4);
assert.notEqual(traces.at(-1).stateHashBefore, traces.at(-1).stateHashAfter);

const staleOutcome = runtime.request({
  side: "A",
  actionType: ManualAction.ACTION_TYPE.FAST_MOVE,
  moveId: "DRAGON_BREATH",
  metadata: { expectedStateHash: "fnv1a-stale" }
});
assert.equal(staleOutcome.ok, false);
assert.equal(staleOutcome.validation.reasonCode, ManualAction.REASON_CODE.STALE_STATE_HASH);
assert.equal(runtime.getTrace().at(-1).traceState, Runtime.TRACE_STATE.REJECTED);

console.log("Manual Mode runtime tests passed.");
