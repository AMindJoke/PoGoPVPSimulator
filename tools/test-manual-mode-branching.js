"use strict";

const assert = require("node:assert/strict");
const Branches = require("../src/battle/manual-branches.js");

const originalTimeline = {
  initialStateHash: "initial",
  events: [{ id: "auto-1", stateHashAfter: "auto-final" }],
  terminalResult: { winner: "A" }
};
let registry = Branches.createRegistry({ timelineModel: originalTimeline, createdAt: "2026-01-01T00:00:00.000Z" });
assert.deepEqual(Branches.validateRegistry(registry), []);
assert.equal(registry.activeBranchId, Branches.ORIGINAL_BRANCH_ID);

registry = Branches.execute(registry, {
  id: "create-1",
  type: Branches.COMMAND_TYPE.CREATE_BRANCH,
  payload: {
    branchId: "MANUAL-1",
    label: "Shield",
    branchPoint: { eventId: "auto-1", boundary: "BEFORE_EVENT" },
    createdAt: "2026-01-01T00:01:00.000Z"
  }
});
assert.equal(registry.activeBranchId, "MANUAL-1");
assert.equal(registry.branches["MANUAL-1"].parentBranchId, Branches.ORIGINAL_BRANCH_ID);
assert.notEqual(registry.branches["MANUAL-1"].timelineModel, originalTimeline);

const editedTimeline = {
  initialStateHash: "initial",
  events: [{ id: "manual-1", stateHashAfter: "manual-final" }],
  terminalResult: { winner: "B" }
};
registry = Branches.execute(registry, {
  type: Branches.COMMAND_TYPE.UPDATE_BRANCH,
  payload: {
    branchId: "MANUAL-1",
    timelineModel: editedTimeline,
    edit: { type: "SHIELD_DECISION", action: "SHIELD" }
  }
});
assert.equal(Branches.activeBranch(registry).terminalResult.winner, "B");
assert.equal(Branches.activeBranch(registry).edits.length, 1);

registry = Branches.execute(registry, {
  type: Branches.COMMAND_TYPE.DUPLICATE_BRANCH,
  payload: { branchId: "MANUAL-1", newBranchId: "MANUAL-2", label: "No shield", createdAt: "2026-01-01T00:02:00.000Z" }
});
assert.equal(registry.activeBranchId, "MANUAL-2");
assert.equal(registry.branches["MANUAL-2"].parentBranchId, "MANUAL-1");

registry = Branches.execute(registry, {
  type: Branches.COMMAND_TYPE.RENAME_BRANCH,
  payload: { branchId: "MANUAL-2", label: "No shield branch" }
});
assert.equal(registry.branches["MANUAL-2"].label, "No shield branch");

const beforeDelete = registry;
registry = Branches.execute(registry, {
  type: Branches.COMMAND_TYPE.DELETE_BRANCH,
  payload: { branchId: "MANUAL-2" }
});
assert.equal(registry.branches["MANUAL-2"], undefined);
assert.equal(registry.activeBranchId, Branches.ORIGINAL_BRANCH_ID);

registry = Branches.undo(registry);
assert.deepEqual(registry.branches["MANUAL-2"], beforeDelete.branches["MANUAL-2"]);
assert.equal(registry.activeBranchId, "MANUAL-2");
registry = Branches.redo(registry);
assert.equal(registry.branches["MANUAL-2"], undefined);
assert.equal(registry.activeBranchId, Branches.ORIGINAL_BRANCH_ID);

assert.throws(() => Branches.execute(registry, {
  type: Branches.COMMAND_TYPE.DELETE_BRANCH,
  payload: { branchId: Branches.ORIGINAL_BRANCH_ID }
}), /ORIGINAL_BRANCH_IMMUTABLE/);
assert.throws(() => Branches.execute(registry, {
  type: Branches.COMMAND_TYPE.UPDATE_BRANCH,
  payload: { branchId: Branches.ORIGINAL_BRANCH_ID, timelineModel: editedTimeline }
}), /ORIGINAL_BRANCH_IMMUTABLE/);

assert.deepEqual(Branches.validateRegistry(registry), []);
console.log("Manual Mode branching and undo/redo tests passed.");
