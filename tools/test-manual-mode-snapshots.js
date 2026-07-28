"use strict";

const assert = require("node:assert/strict");
const Snapshots = require("../src/battle/manual-snapshots.js");

const store = Snapshots.createStore();
const before = {
  left: { hp: 100, energy: 45, shields: 1 },
  right: { hp: 80, energy: 30, shields: 1 },
  battleTurns: { A: 10, B: 10 }
};
const after = {
  left: { hp: 100, energy: 0, shields: 1 },
  right: { hp: 79, energy: 30, shields: 0 },
  battleTurns: { A: 11, B: 11 }
};
const beforeEntry = store.capture("charge-1", Snapshots.BOUNDARY.BEFORE, before, { turn: 10, timelineIndex: 1 });
store.capture("charge-1", Snapshots.BOUNDARY.AFTER, after, { turn: 11, timelineIndex: 1 });
before.left.hp = 1;
assert.equal(store.get("charge-1", Snapshots.BOUNDARY.BEFORE).state.left.hp, 100);

const timeline = [
  { timelineEventId: "fast-1", kind: "fast" },
  { timelineEventId: "charge-1", kind: "charge" },
  { timelineEventId: "shield-1", kind: "shield", chargeIndex: 1 },
  { timelineEventId: "fast-2", kind: "fast" }
];
const beforePlan = Snapshots.createRestorePlan({
  timeline, store, eventId: "charge-1", boundary: Snapshots.BOUNDARY.BEFORE,
  expectedStateHash: beforeEntry.stateHash
});
assert.equal(beforePlan.prefixEnd, 1);
assert.deepEqual(beforePlan.immutablePrefix.map(event => event.timelineEventId), ["fast-1"]);
assert.equal(beforePlan.runtimeState.left.hp, 100);

const afterPlan = Snapshots.createRestorePlan({
  timeline, store, eventId: "charge-1", boundary: Snapshots.BOUNDARY.AFTER
});
assert.equal(afterPlan.prefixEnd, 3, "After-Charged restore must retain its dependent shield event.");
assert.deepEqual(afterPlan.discardedEvents.map(event => event.timelineEventId), ["fast-2"]);
assert.equal(afterPlan.runtimeState.right.shields, 0);

const exported = store.exportEntries();
const importedStore = Snapshots.createStore();
importedStore.importEntries(exported);
assert.deepEqual(importedStore.get("charge-1", Snapshots.BOUNDARY.AFTER).state, after);
assert.throws(() => importedStore.importEntries([{ ...exported[0], stateHash: "stale" }]), /STALE_STATE_HASH/);

console.log("Manual Mode runtime snapshot tests passed.");
