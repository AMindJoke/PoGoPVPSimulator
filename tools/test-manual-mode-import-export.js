"use strict";

const assert = require("node:assert/strict");
const Branches = require("../src/battle/manual-branches.js");
const IO = require("../src/battle/manual-scenario-io.js");

const timelineModel = {
  initialState: { A: { hp: 100 }, B: { hp: 100 } },
  initialStateHash: "initial",
  events: [{ id: "event-1", stateHashAfter: "final" }],
  terminalResult: { winner: "A" }
};
let registry = Branches.createRegistry({ timelineModel, createdAt: "2026-01-01T00:00:00.000Z" });
registry = Branches.execute(registry, {
  type: Branches.COMMAND_TYPE.CREATE_BRANCH,
  payload: {
    branchId: "MANUAL-1",
    timelineModel,
    branchPoint: { eventId: "event-1", boundary: "BEFORE_EVENT" },
    edits: [{ type: "REPLACE_ACTION" }],
    createdAt: "2026-01-01T00:01:00.000Z"
  }
});

const json = IO.stringifyScenario({
  registry,
  battleEngineVersion: "battle-planner-v27",
  reviewMode: "manual",
  scenarioReview: {
    state: { status: "active", mode: "manual" },
    history: { A: [{ pokemonId: "swampert", hp: 0 }], B: [] }
  },
  pokemon: { A: "quagsire_shadow", B: "corsola_galarian" },
  exportedAt: "2026-01-01T00:02:00.000Z"
});
const imported = IO.importScenario(json, { battleEngineVersion: "battle-planner-v27" });
assert.equal(imported.ok, true);
assert.equal(imported.scenario.activeBranchId, "MANUAL-1");
assert.equal(imported.scenario.originalBranch.branchId, Branches.ORIGINAL_BRANCH_ID);
assert.equal(imported.scenario.manualBranch.branchId, "MANUAL-1");
assert.deepEqual(imported.scenario.pokemon, { A: "quagsire_shadow", B: "corsola_galarian" });
assert.equal(imported.scenario.reviewMode, "manual");
assert.equal(imported.scenario.scenarioReview.state.status, "active");
assert.equal(imported.scenario.scenarioReview.history.A[0].pokemonId, "swampert");

const legacy = JSON.parse(json);
delete legacy.reviewMode;
delete legacy.scenarioReview;
const importedLegacy = IO.importScenario(legacy, { battleEngineVersion: "battle-planner-v27" });
assert.equal(importedLegacy.ok, true);
assert.equal(importedLegacy.scenario.reviewMode, "manual");
assert.equal(importedLegacy.scenario.scenarioReview, null);

const mismatch = IO.importScenario(json, { battleEngineVersion: "battle-planner-v28" });
assert.equal(mismatch.ok, false);
assert(mismatch.errors.includes("BATTLE_ENGINE_VERSION_MISMATCH"));
const allowedMismatch = IO.importScenario(json, {
  battleEngineVersion: "battle-planner-v28",
  allowEngineMismatch: true
});
assert.equal(allowedMismatch.ok, true);
assert(allowedMismatch.warnings.includes("BATTLE_ENGINE_VERSION_MISMATCH"));

assert.deepEqual(IO.importScenario("{not-json").errors, ["INVALID_JSON"]);
const corrupted = JSON.parse(json);
delete corrupted.branchRegistry.branches[Branches.ORIGINAL_BRANCH_ID];
const corruptedResult = IO.importScenario(corrupted, { battleEngineVersion: "battle-planner-v27" });
assert.equal(corruptedResult.ok, false);
assert(corruptedResult.errors.includes("ORIGINAL_BRANCH_MISSING"));

console.log("Manual Mode import/export tests passed.");
