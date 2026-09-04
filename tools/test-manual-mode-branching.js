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
assert.equal(registry.branches[Branches.ORIGINAL_BRANCH_ID].label, "Original battle");

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
assert.equal(Branches.activeBranch(registry).labelSource, "AUTO");

registry = Branches.execute(registry, {
  type: Branches.COMMAND_TYPE.UPDATE_BRANCH,
  payload: { branchId: "MANUAL-1", timelineModel: editedTimeline, label: "Use Surf", labelSource: "AUTO" }
});
assert.equal(registry.branches["MANUAL-1"].label, "Use Surf");
registry = Branches.execute(registry, {
  type: Branches.COMMAND_TYPE.RENAME_BRANCH,
  payload: { branchId: "MANUAL-1", label: "Closing line" }
});
registry = Branches.execute(registry, {
  type: Branches.COMMAND_TYPE.UPDATE_BRANCH,
  payload: { branchId: "MANUAL-1", timelineModel: editedTimeline, label: "Use Swift", labelSource: "AUTO" }
});
assert.equal(registry.branches["MANUAL-1"].label, "Closing line", "Manual branch names must survive later automatic updates.");

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

let comparisonRegistry = Branches.createRegistry({ timelineModel: originalTimeline, createdAt: "2026-01-01T00:00:00.000Z" });
comparisonRegistry = Branches.execute(comparisonRegistry, {
  id: "comparison-command",
  type: Branches.COMMAND_TYPE.CREATE_COMPARISON,
  payload: {
    comparisonId: "comparison-1",
    branchPoint: { eventId: "auto-1", boundary: "AFTER_EVENT", turn: 1 },
    branches: [
      { slot: "A", branchId: "COMPARE-A", label: "Branch A" },
      { slot: "B", branchId: "COMPARE-B", label: "Branch B" }
    ],
    timelineModel: originalTimeline,
    runtimeState: { left: { hp: 14 }, right: { hp: 35 }, battleTurns: { A: 0, B: 0 } },
    createdAt: "2026-01-01T00:03:00.000Z"
  }
});
assert.equal(comparisonRegistry.activeBranchId, "COMPARE-A");
assert.equal(comparisonRegistry.branches["COMPARE-A"].comparisonSlot, "A");
assert.equal(comparisonRegistry.branches["COMPARE-B"].comparisonSlot, "B");
assert.equal(comparisonRegistry.branches["COMPARE-A"].parentBranchId, Branches.ORIGINAL_BRANCH_ID);
assert.notEqual(comparisonRegistry.branches["COMPARE-A"].timelineModel, comparisonRegistry.branches["COMPARE-B"].timelineModel);
assert.equal(comparisonRegistry.history.length, 1, "Both comparison branches must be created by one atomic command.");
assert.deepEqual(comparisonRegistry.branches["COMPARE-A"].runtimeState.left, { hp: 14 });
assert.notEqual(comparisonRegistry.branches["COMPARE-A"].runtimeState, comparisonRegistry.branches["COMPARE-B"].runtimeState, "Each comparison branch must own its runtime snapshot.");
const updatedRuntimeRegistry = Branches.execute(comparisonRegistry, {
  type: Branches.COMMAND_TYPE.UPDATE_BRANCH,
  payload: {
    branchId: "COMPARE-A",
    timelineModel: editedTimeline,
    runtimeState: { left: { hp: 0 }, right: { hp: 21 }, battleTurns: { A: 5, B: 5 } },
    terminalResult: { winner: "B" },
    edit: { type: "FAST_MOVE" }
  }
});
assert.equal(updatedRuntimeRegistry.branches["COMPARE-A"].runtimeState.left.hp, 0);
assert.equal(updatedRuntimeRegistry.branches["COMPARE-B"].runtimeState.left.hp, 14, "Updating A must not mutate B runtime.");
assert.equal(Branches.undo(updatedRuntimeRegistry).branches["COMPARE-A"].runtimeState.left.hp, 14, "Undo must restore the branch-owned runtime.");
assert.equal(Branches.redo(Branches.undo(updatedRuntimeRegistry)).branches["COMPARE-A"].runtimeState.left.hp, 0, "Redo must restore the same branch-owned runtime.");
const anomalyEditRegistry = Branches.execute(comparisonRegistry, {
  type: Branches.COMMAND_TYPE.UPDATE_BRANCH,
  payload: {
    branchId: "COMPARE-A",
    timelineModel: { ...editedTimeline, events: [{ id: "timing-anomaly-1", kind: "technical-anomaly" }] },
    runtimeState: { left: { hp: 0 }, right: { hp: 21 }, battleTurns: { A: 5, B: 5 } },
    terminalResult: { winner: "B" },
    edit: { type: "INSERT_TIMING_ANOMALY", subtype: "resolvePendingFastFirst" }
  }
});
assert.equal(anomalyEditRegistry.branches["COMPARE-A"].edits.at(-1).type, "INSERT_TIMING_ANOMALY");
assert.equal(Branches.undo(anomalyEditRegistry).branches["COMPARE-A"].edits.length, 0, "Undo must remove the anomaly edit.");
assert.equal(Branches.redo(Branches.undo(anomalyEditRegistry)).branches["COMPARE-A"].edits.at(-1).type, "INSERT_TIMING_ANOMALY", "Redo must restore the anomaly edit.");
let dreShortcutRegistry = Branches.createRegistry({ timelineModel: originalTimeline, createdAt: "2026-01-01T00:00:00.000Z" });
dreShortcutRegistry = Branches.execute(dreShortcutRegistry, {
  type: Branches.COMMAND_TYPE.CREATE_COMPARISON,
  payload: {
    comparisonId: "dre-comparison",
    activeSlot: "B",
    branches: [
      { slot: "A", branchId: "NORMAL-RESOLUTION", label: "Normal Resolution" },
      { slot: "B", branchId: "DRE-RESOLUTION", label: "DRE Resolution" }
    ],
    timelineModel: originalTimeline
  }
});
assert.equal(dreShortcutRegistry.activeBranchId, "DRE-RESOLUTION", "A shortcut may open directly on the branch that will diverge.");
assert.equal(dreShortcutRegistry.branches["NORMAL-RESOLUTION"].label, "Normal Resolution");
assert.equal(dreShortcutRegistry.branches["DRE-RESOLUTION"].label, "DRE Resolution");
assert.throws(() => Branches.execute(comparisonRegistry, {
  type: Branches.COMMAND_TYPE.DELETE_BRANCH,
  payload: { branchId: "COMPARE-A" }
}), /COMPARISON_BRANCH_LOCKED/);
assert.throws(() => Branches.execute(comparisonRegistry, {
  type: Branches.COMMAND_TYPE.CREATE_COMPARISON,
  payload: {}
}), /COMPARISON_ALREADY_EXISTS/);
const comparisonUndone = Branches.undo(comparisonRegistry);
assert.equal(comparisonUndone.branches["COMPARE-A"], undefined);
assert.equal(comparisonUndone.branches["COMPARE-B"], undefined);
const comparisonRedone = Branches.redo(comparisonUndone);
assert.equal(comparisonRedone.branches["COMPARE-A"].comparisonSlot, "A");
assert.equal(comparisonRedone.branches["COMPARE-B"].comparisonSlot, "B");
const duplicatedComparisonBranch = Branches.execute(comparisonRegistry, {
  type: Branches.COMMAND_TYPE.DUPLICATE_BRANCH,
  payload: { branchId: "COMPARE-A", newBranchId: "OUTSIDE-COMPARISON" }
});
assert.equal(duplicatedComparisonBranch.branches["OUTSIDE-COMPARISON"].comparisonId, null);
assert.equal(duplicatedComparisonBranch.branches["OUTSIDE-COMPARISON"].classification, "CANONICAL");
assert.deepEqual(Branches.validateRegistry(comparisonRegistry), []);

assert.deepEqual(Branches.validateRegistry(registry), []);
console.log("Manual Mode branching and undo/redo tests passed.");
