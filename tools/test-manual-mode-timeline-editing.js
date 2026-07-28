"use strict";

const assert = require("node:assert/strict");
const Action = require("../src/battle/manual-action.js");
const Timeline = require("../src/battle/manual-timeline.js");

const initial = {
  A: { hp: 100, energy: 0 },
  B: { hp: 100, energy: 0 }
};
const source = [
  {
    trainer: "A", kind: "fast", move: { id: "MUD_SHOT" }, start: 0, duration: 2,
    state: { A: { hp: 100, energy: 9 }, B: { hp: 97, energy: 0 } }
  },
  {
    trainer: "B", kind: "fast", move: { id: "ASTONISH" }, start: 0, duration: 3,
    state: { A: { hp: 95, energy: 9 }, B: { hp: 97, energy: 9 } }
  },
  {
    trainer: "A", kind: "charge", move: { id: "MUD_BOMB" }, start: 4, duration: 1,
    state: { A: { hp: 90, energy: 0 }, B: { hp: 60, energy: 18 } }
  }
];

const original = Timeline.createModel({ initialState: initial, timeline: source, terminalResult: { winner: "A" } });
assert.equal(original.events.length, 3);
assert(original.events.every(event => event.id && event.stateHashBefore && event.stateHashAfter));
assert.deepEqual(original.events[0].stateBefore, initial);

const target = original.events[1];
const before = Timeline.decisionBoundary(original, target.id, Timeline.BOUNDARY.BEFORE);
const after = Timeline.decisionBoundary(original, target.id, Timeline.BOUNDARY.AFTER);
assert.equal(before.stateHash, original.events[0].stateHashAfter);
assert.equal(after.stateHash, target.stateHashAfter);
assert.equal(before.phase, Action.DECISION_PHASE.BEFORE_ACTION_REGISTRATION);

const manualAction = Action.createManualAction({
  side: "B",
  actionType: Action.ACTION_TYPE.FAST_MOVE,
  moveId: "ROLLOUT",
  requestedAtTurn: before.turn
});
let rebuildInput = null;
const edited = Timeline.editTimeline({
  model: original,
  eventId: target.id,
  operation: Timeline.EDIT_OPERATION.REPLACE,
  manualAction,
  validation: { legal: true },
  expectedStateHash: before.stateHash,
  rebuild: input => {
    rebuildInput = input;
    return {
      timeline: [
        ...input.immutablePrefix,
        {
          trainer: "B", kind: "fast", move: { id: "ROLLOUT" }, start: 2, duration: 3,
          state: { A: { hp: 96, energy: 9 }, B: { hp: 97, energy: 13 } }
        },
        {
          trainer: "A", kind: "charge", move: { id: "AQUA_TAIL" }, start: 5, duration: 1,
          state: { A: { hp: 96, energy: 0 }, B: { hp: 70, energy: 13 } }
        }
      ],
      terminalResult: { winner: "A" }
    };
  }
});

assert.equal(rebuildInput.immutablePrefix.length, 1, "Replacement must discard the target and every downstream event.");
assert.equal(edited.removedEvents.length, 2);
assert.equal(edited.model.events[1].move.id, "ROLLOUT");
assert.equal(edited.model.revision, 1);
assert.equal(edited.trace.traceState, "BRANCH_REBUILT");
assert.deepEqual(original.events.map(event => event.move.id), ["MUD_SHOT", "ASTONISH", "MUD_BOMB"], "The original timeline must remain immutable.");

const divergence = Timeline.firstDivergentEvent(original, edited.model);
assert.equal(divergence.index, 1);
assert.equal(divergence.left.move.id, "ASTONISH");
assert.equal(divergence.right.move.id, "ROLLOUT");

assert.throws(() => Timeline.editTimeline({
  model: original,
  eventId: target.id,
  operation: Timeline.EDIT_OPERATION.REPLACE,
  manualAction,
  validation: { legal: true },
  expectedStateHash: "stale",
  rebuild: () => ({ timeline: [] })
}), /STALE_STATE_HASH/);

assert.throws(() => Timeline.editTimeline({
  model: original,
  eventId: target.id,
  operation: Timeline.EDIT_OPERATION.REPLACE,
  manualAction,
  validation: { legal: false },
  rebuild: () => ({ timeline: [] })
}), /MANUAL_ACTION_NOT_VALIDATED/);

console.log("Manual Mode timeline editing tests passed.");
