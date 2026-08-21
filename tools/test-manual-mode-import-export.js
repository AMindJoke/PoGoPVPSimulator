"use strict";

const assert = require("node:assert/strict");
const Branches = require("../src/battle/manual-branches.js");
const ManualMode = require("../src/battle/manual-mode.js");
const IO = require("../src/battle/manual-scenario-io.js");

function fastEvent(overrides = {}) {
  return {
    id: "event-1",
    timelineEventId: "event-1",
    trainer: "A",
    kind: "fast",
    move: { id: "MUD_SHOT", name: "Mud Shot" },
    start: 0,
    duration: 2,
    state: { A: { hp: 100, energy: 9 }, B: { hp: 96, energy: 0 } },
    stateHashAfter: "final",
    ...overrides
  };
}

function registryFor(events = [fastEvent()], initialState = { A: { hp: 100 }, B: { hp: 100 } }) {
  const timelineModel = {
    initialState,
    initialStateHash: "initial",
    events,
    terminalResult: null
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
  return registry;
}

function applicationState(overrides = {}) {
  const state = {
    controls: {
      p1Pokemon: "quagsire_shadow",
      p1Fast: "MUD_SHOT",
      p1Charged1: "AQUA_TAIL",
      p1Charged2: "STONE_EDGE",
      p1Level: "22.5",
      p1IvAtk: "0",
      p1IvDef: "15",
      p1IvHp: "15",
      p1Cp: "1498",
      p1StartEnergy: "12",
      p1Shields: "1",
      p2Pokemon: "corsola_galarian",
      p2Fast: "ASTONISH",
      p2Charged1: "POWER_GEM",
      p2Charged2: "NIGHT_SHADE",
      p2Level: "40",
      p2IvAtk: "0",
      p2IvDef: "15",
      p2IvHp: "15",
      p2Cp: "1499",
      p2StartEnergy: "0",
      p2Shields: "1"
    },
    battle: {
      left: {
        trainer: "A",
        p: { id: "quagsire_shadow" },
        initialFormId: "quagsire_shadow",
        level: 22.5,
        cp: 1498,
        ivAtk: 0,
        ivDef: 15,
        ivHp: 15,
        fast: { id: "MUD_SHOT" },
        charged: [{ id: "AQUA_TAIL" }, { id: "STONE_EDGE" }],
        maxHp: 150,
        hp: 73,
        energy: 47,
        shields: 1,
        attackStage: 1,
        defenseStage: -1
      },
      right: {
        trainer: "B",
        p: { id: "corsola_galarian" },
        level: 40,
        cp: 1499,
        ivAtk: 0,
        ivDef: 15,
        ivHp: 15,
        fast: { id: "ASTONISH" },
        charged: [{ id: "POWER_GEM" }, { id: "NIGHT_SHADE" }],
        maxHp: 140,
        hp: 88,
        energy: 34,
        shields: 0,
        attackStage: -2,
        defenseStage: 2
      },
      initialTimelineState: { A: { hp: 150, maxHp: 150 }, B: { hp: 140, maxHp: 140 } },
      battleTurns: { A: 8, B: 10 },
      timeline: [fastEvent()]
    },
    scenarioReview: { mode: "manual", state: { status: "active" }, history: { A: [], B: [] } }
  };
  return { ...state, ...overrides };
}

const simpleRegistry = registryFor();
const simple = IO.serializeScenario({
  registry: simpleRegistry,
  battleEngineVersion: "battle-planner-v27",
  reviewMode: "manual",
  pokemon: { A: "quagsire_shadow", B: "corsola_galarian" },
  timeline: [fastEvent()],
  applicationState: applicationState(),
  runtimeState: {
    battleTurns: { A: 2, B: 2 },
    manualPendingFastEvents: [],
    manualBattleTiming: { canonicalTurn: 2, chargedSequenceMs: 10000, elapsedBattleMs: 11000, nextSwitchAvailableAtMs: { A: 45000, B: 0 } },
    manualSwitchState: { A: { bench: [{ trainer: "A", p: { id: "azumarill", name: "Azumarill" }, hp: 121, maxHp: 191, energy: 33 }] }, B: { bench: [] } }
  },
  manualModeState: { selectedSide: "A", pendingDecision: { activeSide: "A" } }
});
assert.equal(simple.schema, IO.SCHEMA_ID);
assert.equal(simple.version, 1);
assert.equal(simple.mode, "scenario-review");
assert.deepEqual(simple.capabilities, [...IO.CAPABILITIES]);

const simpleJson = IO.stringifyScenario(simple);
const simpleImported = IO.deserializeScenario(simpleJson, { battleEngineVersion: "battle-planner-v27" });
assert.equal(simpleImported.ok, true);
assert.deepEqual(simpleImported.scenario, simple, "A canonical scenario must survive an exact round trip.");
assert.equal(simpleImported.scenario.state.runtimeState.manualBattleTiming.elapsedBattleMs, 11000);
assert.equal(simpleImported.scenario.state.runtimeState.manualSwitchState.A.bench[0].energy, 33);
assert.equal(IO.stableStringify(simple), IO.stableStringify(IO.serializeScenario({
  registry: simpleRegistry,
  battleEngineVersion: "battle-planner-v27",
  reviewMode: "manual",
  pokemon: { A: "quagsire_shadow", B: "corsola_galarian" },
  timeline: [fastEvent()],
  applicationState: applicationState(),
  runtimeState: {
    battleTurns: { A: 2, B: 2 },
    manualPendingFastEvents: [],
    manualBattleTiming: { canonicalTurn: 2, chargedSequenceMs: 10000, elapsedBattleMs: 11000, nextSwitchAvailableAtMs: { A: 45000, B: 0 } },
    manualSwitchState: { A: { bench: [{ trainer: "A", p: { id: "azumarill", name: "Azumarill" }, hp: 121, maxHp: 191, energy: 33 }] }, B: { bench: [] } }
  },
  manualModeState: { selectedSide: "A", pendingDecision: { activeSide: "A" } }
})), "The same scenario input must produce deterministic JSON.");

const advancedEvents = [
  fastEvent(),
  {
    id: "judge-2",
    timelineEventId: "judge-2",
    trainer: "B",
    kind: "manual-state",
    judgeEventType: "STATE_EDIT",
    start: 4,
    duration: 1,
    hiddenFromTimeline: true,
    details: { field: "energy", previousValue: 20, value: 34 },
    state: { A: { hp: 73, energy: 47 }, B: { hp: 88, energy: 34 } }
  }
];
const advancedRegistry = registryFor(advancedEvents);
const advanced = IO.serializeScenario({
  registry: advancedRegistry,
  battleEngineVersion: "battle-planner-v27",
  reviewMode: "manual",
  scenarioReview: { state: { status: "active" }, timelineStart: 1, history: { A: [], B: [] } },
  applicationState: applicationState(),
  runtimeState: { battleTurns: { A: 8, B: 10 }, manualPendingFastEvents: [] },
  manualModeState: { selectedSide: "A", pendingDecision: { activeSide: "A", phase: "BEFORE_ACTION_REGISTRATION" } },
  timeline: advancedEvents,
  manualSession: { sessionControlMode: "BOTH_MANUAL", rootSnapshotId: "manual-root-1", snapshots: [] }
});
const advancedImported = IO.deserializeScenario(IO.stringifyScenario(advanced), { battleEngineVersion: "battle-planner-v27" });
assert.equal(advancedImported.ok, true);
assert.equal(advancedImported.scenario.participants.A.current.hp, 73);
assert.equal(advancedImported.scenario.participants.A.current.energy, 47);
assert.equal(advancedImported.scenario.participants.A.current.attackStage, 1);
assert.equal(advancedImported.scenario.participants.B.current.defenseStage, 2);
assert.equal(advancedImported.scenario.participants.B.current.shields, 0);
assert.equal(advancedImported.scenario.state.currentTurn, 8);
assert.equal(advancedImported.scenario.state.readySide, "A");
assert.equal(advancedImported.scenario.timeline.events[1].judgeEventType, "STATE_EDIT");

const dreFast = fastEvent({
  id: "lethal-fast",
  timelineEventId: "lethal-fast",
  trainer: "B",
  move: { id: "INCINERATE", name: "Incinerate" },
  start: 5,
  duration: 5,
  drePending: true,
  fastImpactStatus: "pending"
});
const dreEvent = {
  id: "dre-1",
  timelineEventId: "dre-1",
  trainer: "A",
  kind: "technical-dre",
  issueType: "dre",
  start: 7,
  duration: 1,
  pendingFastEventId: "pending-fast-1",
  pendingFastMoveName: "Incinerate",
  move: { id: "SWIFT", name: "Swift" },
  state: { A: { hp: 15, energy: 35 }, B: { hp: 16, energy: 60 } }
};
const dreRegistry = registryFor([dreFast, dreEvent]);
const pendingFast = {
  id: "pending-fast-1",
  sourceSide: "B",
  targetSide: "A",
  moveId: "INCINERATE",
  moveName: "Incinerate",
  damage: 53,
  startTurn: 5,
  resolveTurn: 10,
  status: "pending"
};
const dre = IO.serializeScenario({
  registry: dreRegistry,
  battleEngineVersion: "battle-planner-v27",
  pokemon: { A: "furret", B: "talonflame_shadow" },
  timeline: [dreFast, dreEvent],
  applicationState: applicationState({
    controls: {
      ...applicationState().controls,
      p1Pokemon: "furret",
      p2Pokemon: "talonflame_shadow"
    },
    battle: {
      ...applicationState().battle,
      left: { ...applicationState().battle.left, p: { id: "furret" }, initialFormId: "furret" },
      right: { ...applicationState().battle.right, p: { id: "talonflame_shadow" } },
      timeline: [dreFast, dreEvent]
    }
  }),
  runtimeState: { battleTurns: { A: 7, B: 10 }, manualPendingFastEvents: [pendingFast] },
  manualModeState: { selectedSide: "A", pendingDecision: { activeSide: "A", phase: "SHIELD_DECISION" } },
  pendingFastEvents: [pendingFast],
  technicalIssue: {
    type: "dre",
    trainer: "A",
    chosenMoveId: "SWIFT",
    pendingFast,
    awaitingChargeChoice: false,
    applied: true
  }
});
const dreImported = IO.deserializeScenario(IO.stringifyScenario(dre), { battleEngineVersion: "battle-planner-v27" });
assert.equal(dreImported.ok, true);
assert.equal(dreImported.scenario.state.pendingFastEvents[0].id, "pending-fast-1");
assert.equal(dreImported.scenario.technicalIssues.active.type, "dre");
assert.deepEqual(dreImported.scenario.technicalIssues.eventIds, ["lethal-fast", "dre-1"]);
assert.equal(dreImported.scenario.timeline.events[0].drePending, true);

const mismatch = IO.deserializeScenario(simpleJson, { battleEngineVersion: "battle-planner-v28" });
assert.equal(mismatch.ok, false);
assert(mismatch.errors.includes("BATTLE_ENGINE_VERSION_MISMATCH"));
const allowedMismatch = IO.deserializeScenario(simpleJson, {
  battleEngineVersion: "battle-planner-v28",
  allowEngineMismatch: true
});
assert.equal(allowedMismatch.ok, true);
assert(allowedMismatch.warnings.includes("BATTLE_ENGINE_VERSION_MISMATCH"));

assert.deepEqual(IO.deserializeScenario("{not-json").errors, ["INVALID_JSON"]);
const invalidVersion = structuredClone(simple);
invalidVersion.version = 99;
assert(IO.deserializeScenario(invalidVersion).errors.includes("IMPORT_VERSION_UNSUPPORTED"));
const invalidEnergy = structuredClone(advanced);
invalidEnergy.participants.A.current.energy = 101;
assert(IO.deserializeScenario(invalidEnergy).errors.includes("INVALID_CURRENT_ENERGY_A"));
const invalidTimeline = structuredClone(simple);
delete invalidTimeline.timeline.events[0].move;
assert(IO.deserializeScenario(invalidTimeline).errors.includes("TIMELINE_MOVE_MISSING:0"));
const invalidPending = structuredClone(dre);
invalidPending.state.pendingFastEvents[0].targetSide = "B";
assert(IO.deserializeScenario(invalidPending).errors.includes("INVALID_PENDING_FAST_SIDES:0"));
const unknownPokemon = structuredClone(simple);
unknownPokemon.participants.A.pokemon.id = "missingno";
assert(IO.deserializeScenario(unknownPokemon, { isPokemonId: id => id !== "missingno" }).errors.includes("POKEMON_A_UNKNOWN"));

const legacy = {
  schemaVersion: 1,
  battleEngineVersion: "battle-planner-v27",
  plannerMode: "CANONICAL",
  reviewMode: "manual",
  scenarioReview: { state: { status: "active" }, history: { A: [], B: [] } },
  pokemon: { A: "quagsire_shadow", B: "corsola_galarian" },
  initialState: { A: { hp: 100 }, B: { hp: 100 } },
  timeline: [fastEvent()],
  terminalResult: null,
  branchRegistry: simpleRegistry,
  originalBranch: simpleRegistry.branches[Branches.ORIGINAL_BRANCH_ID],
  edits: [],
  applicationState: applicationState(),
  manualSession: { sessionControlMode: "BOTH_MANUAL", snapshots: [] }
};
const importedLegacy = IO.deserializeScenario(legacy, {
  battleEngineVersion: "battle-planner-v27",
  validateManualState: ManualMode.validateState
});
assert.equal(importedLegacy.ok, true, "Existing v1 local/exported scenarios must migrate into the canonical schema.");
assert.equal(importedLegacy.scenario.schema, IO.SCHEMA_ID);
assert.equal(importedLegacy.scenario.review.mode, "manual");
assert.equal(importedLegacy.scenario.state.manualMode.enabled, true);
assert.equal(importedLegacy.scenario.state.runtimeState.left.p.id, "quagsire_shadow");

console.log("Canonical Scenario Review serialization tests passed.");
