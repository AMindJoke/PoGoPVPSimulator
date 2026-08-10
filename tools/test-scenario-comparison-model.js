"use strict";

const assert = require("node:assert/strict");
const Branches = require("../src/battle/manual-branches.js");
const Comparison = require("../src/battle/scenario-comparison.js");
const IO = require("../src/battle/manual-scenario-io.js");
const { fixture } = require("./test-manual-scenario-share.js");

function event(id, trainer, kind, start, overrides = {}) {
  return {
    id,
    timelineEventId: id,
    trainer,
    kind,
    start,
    duration: 1,
    stateHashAfter: `${id}-state`,
    ...(kind === "fast" ? { move: { id: trainer === "A" ? "SUCKER_PUNCH" : "INCINERATE", name: trainer === "A" ? "Sucker Punch" : "Incinerate" } } : {}),
    ...overrides
  };
}

const initialState = { A: { hp: 160, energy: 0 }, B: { hp: 135, energy: 0 } };
const shared = [
  event("shared-1", "A", "fast", 0),
  event("shared-2", "B", "fast", 1, { duration: 5 })
];
const normalSuffix = [
  event("normal-impact", "B", "fast", 6),
  event("normal-faint", "A", "faint", 7, { faintedSide: "A" })
];
const dreSuffix = [
  event("dre-window", "A", "technical-dre", 6, { issueType: "dre", pendingFastEventId: "pending-1" }),
  event("swift", "A", "charge", 7, { move: { id: "SWIFT", name: "Swift" } }),
  event("dre-faint", "B", "faint", 8, { faintedSide: "B" })
];

const branchA = {
  branchId: Branches.ORIGINAL_BRANCH_ID,
  label: "Normal resolution",
  timelineModel: {
    initialState,
    initialStateHash: "initial-state",
    events: [...shared, ...normalSuffix],
    terminalResult: { winner: "B", hp: { A: 0, B: 39 } }
  },
  runtimeState: { battleTurns: { A: 7, B: 7 }, left: { hp: 0 }, right: { hp: 39 } },
  pendingFastEvents: [],
  edits: []
};
const branchB = {
  branchId: "MANUAL-1",
  label: "DRE resolution",
  timelineModel: {
    initialState,
    initialStateHash: "initial-state",
    events: [...shared, ...dreSuffix],
    terminalResult: { winner: "A", hp: { A: 17, B: 0 } }
  },
  runtimeState: { battleTurns: { A: 8, B: 8 }, left: { hp: 17 }, right: { hp: 0 } },
  pendingFastEvents: [],
  technicalIssue: { type: "dre", applied: true },
  edits: [{ type: "TECHNICAL_DRE" }]
};

const comparison = Comparison.deriveComparison({
  comparisonId: "comparison-1",
  sourceScenarioId: "scenario-1",
  createdAt: "2026-08-10T00:00:00.000Z",
  branchPointState: { battleTurns: { A: 6, B: 6 }, left: { hp: 16 }, right: { hp: 16 } },
  branches: [branchA, branchB]
});

assert.deepEqual(Comparison.validateComparison(comparison), []);
assert.equal(comparison.mode, Comparison.MODE);
assert.equal(comparison.branches.length, 2);
assert.equal(comparison.base.events.length, 2, "Shared history must be stored once in the comparison base.");
assert.deepEqual(comparison.branches[0].events, normalSuffix);
assert.deepEqual(comparison.branches[1].events, dreSuffix);
assert.equal(comparison.branchPoint.eventId, "shared-2");
assert.equal(comparison.branchPoint.sharedEventCount, 2);
assert.equal(comparison.branchPoint.turn, 6);
assert.deepEqual(Comparison.materializeTimeline(comparison, "A"), [...shared, ...normalSuffix]);
assert.deepEqual(Comparison.materializeTimeline(comparison, "MANUAL-1"), [...shared, ...dreSuffix]);
assert.deepEqual(Comparison.materializeTimelineModel(comparison, "B").terminalResult, branchB.timelineModel.terminalResult);
assert.notEqual(comparison.branches[0].runtimeState, branchA.runtimeState, "Branch state must not alias live Manual Mode state.");
const comparisonView = Comparison.comparisonViewModel(comparison);
assert.equal(comparisonView.sharedEvents.length, 2);
assert.equal(comparisonView.branches[0].outcome, "Pokemon B wins");
assert.equal(comparisonView.branches[0].finalTurn, 8);
assert.equal(comparisonView.branches[0].pokemon.A.hp, 0);
assert.equal(comparisonView.branches[0].pokemonRemaining, 1);
assert.equal(comparisonView.branches[1].outcome, "Pokemon A wins");
assert.equal(comparisonView.branches[1].pokemon.B.hp, 0);
assert.equal(comparisonView.branches[1].pokemonRemaining, 1);
assert.equal(comparisonView.difference.diverged, true);
assert.equal(comparisonView.difference.firstDivergence.turn, 6);
assert.equal(comparisonView.branches[0].events[0].difference, Comparison.EVENT_DIFFERENCE.ONLY_A);
assert.equal(comparisonView.branches[0].events[0].firstDivergence, true);
assert.equal(comparisonView.branches[1].events[0].difference, Comparison.EVENT_DIFFERENCE.ONLY_B);
assert.equal(comparisonView.branches[1].events[0].firstDivergence, true);
const semanticAlignment = Comparison.semanticEventAlignment([
  event("branch-a-only", "A", "fast", 6, { damage: 4 }),
  event("rejoined-a", "A", "fast", 10, { damage: 3 })
], [
  event("branch-b-only", "B", "fast", 6, { damage: 4 }),
  event("rejoined-b", "A", "fast", 10, { damage: 3 })
]);
assert.equal(semanticAlignment.counts.onlyA, 1);
assert.equal(semanticAlignment.counts.onlyB, 1);
assert.equal(semanticAlignment.counts.shared, 1, "Equivalent semantic events with different technical IDs must realign.");
assert.equal(semanticAlignment.branches.A[1].difference, Comparison.EVENT_DIFFERENCE.SHARED);
const identicalAlignment = Comparison.semanticEventAlignment(
  [event("same-a", "A", "fast", 14, { damage: 2 })],
  [event("same-b", "A", "fast", 14, { damage: 2 })]
);
assert.equal(identicalAlignment.diverged, false);
assert.equal(identicalAlignment.firstDivergence, null);
assert.notEqual(
  Comparison.semanticEventKey(event("damage-a", "A", "fast", 12, { damage: 2 })),
  Comparison.semanticEventKey(event("damage-b", "A", "fast", 12, { damage: 3 })),
  "Different battle results must remain divergent even when the action identity matches."
);
assert.equal(Comparison.stableStringify(comparison), Comparison.stableStringify(Comparison.deriveComparison({
  comparisonId: "comparison-1",
  sourceScenarioId: "scenario-1",
  createdAt: "2026-08-10T00:00:00.000Z",
  branchPointState: { battleTurns: { A: 6, B: 6 }, left: { hp: 16 }, right: { hp: 16 } },
  branches: [branchA, branchB]
})), "The comparison projection must be deterministic.");

let registry = Branches.createRegistry({ timelineModel: branchA.timelineModel, createdAt: "2026-08-10T00:00:00.000Z" });
registry = Branches.execute(registry, {
  type: Branches.COMMAND_TYPE.CREATE_BRANCH,
  payload: { branchId: "MANUAL-1", timelineModel: branchB.timelineModel, branchPoint: comparison.branchPoint, createdAt: "2026-08-10T00:00:01.000Z" }
});
const fromRegistry = Comparison.comparisonFromRegistry(registry, {
  branchIds: [Branches.ORIGINAL_BRANCH_ID, "MANUAL-1"],
  branchStates: {
    [Branches.ORIGINAL_BRANCH_ID]: { runtimeState: branchA.runtimeState },
    "MANUAL-1": { runtimeState: branchB.runtimeState, technicalIssue: branchB.technicalIssue }
  }
});
assert.deepEqual(Comparison.materializeTimeline(fromRegistry, "A"), branchA.timelineModel.events);
assert.deepEqual(Comparison.materializeTimeline(fromRegistry, "B"), branchB.timelineModel.events);

const scenario = fixture();
scenario.comparison = comparison;
const comparisonRoundTrip = IO.deserializeScenario(IO.stringifyScenario(scenario), {
  battleEngineVersion: scenario.engine.battleVersion,
  isPokemonId: () => true,
  isMoveId: () => true
});
assert.equal(comparisonRoundTrip.ok, true, comparisonRoundTrip.errors.join(", "));
assert.deepEqual(comparisonRoundTrip.scenario.comparison, comparison);
assert(scenario.capabilities.includes("scenario-comparison-v1"));

const legacyCompatible = fixture();
delete legacyCompatible.comparison;
legacyCompatible.capabilities = legacyCompatible.capabilities.filter(capability => capability !== "scenario-comparison-v1");
assert.equal(IO.deserializeScenario(legacyCompatible, {
  battleEngineVersion: legacyCompatible.engine.battleVersion,
  isPokemonId: () => true,
  isMoveId: () => true
}).ok, true, "Canonical scenarios created before comparison support must remain valid.");

const unknownSource = structuredClone(scenario);
unknownSource.comparison.branches[1].sourceBranchId = "MISSING-BRANCH";
assert(IO.deserializeScenario(unknownSource, {
  battleEngineVersion: unknownSource.engine.battleVersion,
  isPokemonId: () => true,
  isMoveId: () => true
}).errors.includes("COMPARISON_SOURCE_BRANCH_MISSING:B"));
const invalidDivergentEvent = structuredClone(scenario);
delete invalidDivergentEvent.comparison.branches[1].events[1].move;
assert(IO.deserializeScenario(invalidDivergentEvent, {
  battleEngineVersion: invalidDivergentEvent.engine.battleVersion,
  isPokemonId: () => true,
  isMoveId: () => true
}).errors.includes("TIMELINE_MOVE_MISSING:comparison-B-1"));

const oneBranch = structuredClone(comparison);
oneBranch.branches.pop();
assert(Comparison.validateComparison(oneBranch).includes("COMPARISON_REQUIRES_TWO_BRANCHES"));
const duplicateIds = structuredClone(comparison);
duplicateIds.branches[1].branchId = duplicateIds.branches[0].branchId;
assert(Comparison.validateComparison(duplicateIds).includes("COMPARISON_BRANCH_IDS_DUPLICATED"));
const mismatchedPoint = structuredClone(comparison);
mismatchedPoint.branchPoint.sharedEventCount = 1;
assert(Comparison.validateComparison(mismatchedPoint).includes("COMPARISON_SHARED_EVENT_COUNT_MISMATCH"));
assert.throws(() => Comparison.deriveComparison({ branches: [branchA] }), /COMPARISON_REQUIRES_TWO_BRANCHES/);
assert.throws(() => Comparison.deriveComparison({
  branches: [branchA, { ...branchB, timelineModel: { ...branchB.timelineModel, initialState: { A: { hp: 1 }, B: { hp: 1 } } } }]
}), /COMPARISON_INITIAL_STATE_MISMATCH/);

console.log("Scenario Comparison branch model tests passed.");
