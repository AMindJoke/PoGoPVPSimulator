"use strict";

const assert = require("node:assert/strict");
const Manual = require("../src/battle/manual-mode.js");

const originalTimeline = [{ id: "event-1", turn: 0, nested: { hp: 100 } }];
let state = Manual.createState({ originalTimeline });

assert.deepEqual(Manual.validateState(state), []);
assert.equal(state.status, Manual.STATUS.DISABLED);
assert.equal(state.enabled, false);
assert.equal(state.controlMode, Manual.CONTROL_MODE.BOTH_MANUAL);
assert.deepEqual(state.controlledSides, ["A", "B"]);
assert.equal(state.legalityMode, Manual.LEGALITY_MODE.STRICT);
assert.equal(state.revision, 0);

originalTimeline[0].nested.hp = 1;
assert.equal(state.originalTimeline[0].nested.hp, 100, "The model must not retain caller-owned timeline references.");

const enabled = Manual.enable(state);
assert.notEqual(enabled, state, "State transitions must be immutable.");
assert.equal(state.status, Manual.STATUS.DISABLED);
assert.equal(enabled.status, Manual.STATUS.SELECTING_BRANCH_POINT);
assert.equal(enabled.plannerPaused, true);
assert.equal(enabled.revision, 1);
assert.deepEqual(Manual.validateState(enabled), []);

assert.throws(
  () => Manual.selectBranchPoint(enabled, { turn: 3 }),
  /INVALID_BRANCH_POINT/
);

state = Manual.selectBranchPoint(enabled, {
  branchId: "MANUAL-1",
  turn: 3,
  eventId: "event-1",
  stateHash: "hash-1",
  decisionPoint: { phase: "BEFORE_ACTION_REGISTRATION", readySides: ["A", "B"] }
});
assert.equal(state.status, Manual.STATUS.AWAITING_ACTION);
assert.equal(state.branchId, "MANUAL-1");
assert.equal(state.parentBranchId, "AUTO-ORIGINAL");
assert.equal(state.branchTurn, 3);
assert.equal(state.cursorMode, Manual.CURSOR_MODE.LIVE);
assert.deepEqual(Manual.validateState(state), []);

state = Manual.setControlMode(state, Manual.CONTROL_MODE.PLAYER_A_MANUAL);
assert.deepEqual(state.controlledSides, ["A"]);
assert.equal(state.autoPolicyBySide.A, Manual.AUTO_POLICY.MANUAL);
assert.equal(state.autoPolicyBySide.B, Manual.AUTO_POLICY.PVPOKE_PARITY);
assert.throws(() => Manual.setSelectedSide(state, "B"), /SIDE_NOT_MANUALLY_CONTROLLED/);

state = Manual.setSelectedSide(state, "A");
state = Manual.setLegalityMode(state, Manual.LEGALITY_MODE.REVIEW_OVERRIDE);
assert.equal(state.legalityMode, Manual.LEGALITY_MODE.REVIEW_OVERRIDE);

state = Manual.beginResolution(state);
assert.equal(state.status, Manual.STATUS.RESOLVING);
state = Manual.completeResolution(state, {
  timeline: [{ id: "manual-fast-1" }],
  cursorTurn: 4,
  cursorEventId: "manual-fast-1",
  pendingDecision: { phase: "SHIELD_DECISION" }
});
assert.equal(state.status, Manual.STATUS.AWAITING_SHIELD_DECISION);
assert.equal(state.cursorTurn, 4);
assert.equal(state.activeTimeline[0].id, "manual-fast-1");

state = Manual.beginResolution(state);
state = Manual.completeResolution(state, {
  timeline: [{ id: "manual-fast-1" }, { id: "terminal-1" }],
  terminal: true,
  terminalResult: { winner: "A" },
  cursorTurn: 5,
  cursorEventId: "terminal-1"
});
assert.equal(state.status, Manual.STATUS.TERMINAL);
assert.equal(state.activeTerminalResult.winner, "A");
assert.equal(state.cursorMode, Manual.CURSOR_MODE.EDIT);

state = Manual.setCursor(state, { turn: 2, eventId: "manual-fast-1", mode: Manual.CURSOR_MODE.VIEW });
assert.equal(state.cursorTurn, 2);
assert.equal(state.cursorMode, Manual.CURSOR_MODE.VIEW);

state = Manual.fail(state, { code: "STALE_STATE_HASH" });
assert.equal(state.status, Manual.STATUS.ERROR);
assert.equal(state.error.code, "STALE_STATE_HASH");
assert.deepEqual(Manual.validateState(state), []);

state = Manual.disable(state);
assert.equal(state.status, Manual.STATUS.DISABLED);
assert.equal(state.enabled, false);
assert.equal(state.plannerPaused, false);
assert.deepEqual(Manual.validateState(state), []);

assert.throws(
  () => Manual.transition(state, Manual.STATUS.RESOLVING),
  /INVALID_MANUAL_MODE_TRANSITION/
);

const shieldState = Manual.selectBranchPoint(
  Manual.enable(Manual.createState()),
  {
    turn: 8,
    eventId: "charge-1",
    stateHash: "hash-2",
    phase: "SHIELD_DECISION",
    decisionPoint: { phase: "SHIELD_DECISION" }
  }
);
assert.equal(shieldState.status, Manual.STATUS.AWAITING_SHIELD_DECISION);

console.log("Manual Mode model tests passed.");
