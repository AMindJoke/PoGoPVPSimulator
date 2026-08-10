"use strict";

const assert = require("node:assert/strict");
const { gzipSync } = require("node:zlib");
const Branches = require("../src/battle/manual-branches.js");
const ManualMode = require("../src/battle/manual-mode.js");
const Comparison = require("../src/battle/scenario-comparison.js");
const IO = require("../src/battle/manual-scenario-io.js");
const Share = require("../src/battle/manual-scenario-share.js");
const { BATTLE_ENGINE_VERSION } = require("../src/reliability/battle-reliability.js");

function fixture() {
  const event = {
    id: "event-1",
    timelineEventId: "event-1",
    trainer: "A",
    kind: "fast",
    move: { id: "POWDER_SNOW", name: "Powder Snow" },
    start: 0,
    duration: 2,
    state: { A: { hp: 143, energy: 8 }, B: { hp: 156, energy: 0 } },
    stateHashAfter: "after-fast"
  };
  const timelineModel = {
    initialState: { A: { hp: 143, maxHp: 143 }, B: { hp: 160, maxHp: 160 } },
    initialStateHash: "initial",
    events: [event],
    terminalResult: null
  };
  let registry = Branches.createRegistry({ timelineModel, createdAt: "2026-08-10T00:00:00.000Z" });
  registry = Branches.execute(registry, {
    type: Branches.COMMAND_TYPE.CREATE_BRANCH,
    payload: {
      branchId: "MANUAL-1",
      timelineModel,
      branchPoint: { eventId: "event-1", boundary: "AFTER_EVENT" },
      createdAt: "2026-08-10T00:00:01.000Z"
    }
  });
  let manualMode = ManualMode.createState({ controlMode: ManualMode.CONTROL_MODE.BOTH_MANUAL, originalTimeline: [event] });
  manualMode = ManualMode.enable(manualMode, { originalTimeline: [event] });
  manualMode = ManualMode.selectBranchPoint(manualMode, {
    branchId: "MANUAL-1",
    parentBranchId: Branches.ORIGINAL_BRANCH_ID,
    turn: 2,
    eventId: "event-1",
    stateHash: "after-fast"
  });
  const applicationState = {
    controls: {
      p1Pokemon: "abomasnow",
      p1Fast: "POWDER_SNOW",
      p1Charged1: "WEATHER_BALL_ICE",
      p1Charged2: "ENERGY_BALL",
      p1Level: "23.5",
      p1IvAtk: "0",
      p1IvDef: "15",
      p1IvHp: "15",
      p1Cp: "1495",
      p1StartEnergy: "0",
      p1Shields: "1",
      p2Pokemon: "lickilicky",
      p2Fast: "ROLLOUT",
      p2Charged1: "BODY_SLAM",
      p2Charged2: "SHADOW_BALL",
      p2Level: "25",
      p2IvAtk: "0",
      p2IvDef: "15",
      p2IvHp: "15",
      p2Cp: "1498",
      p2StartEnergy: "0",
      p2Shields: "1"
    },
    battle: {
      left: {
        trainer: "A", p: { id: "abomasnow" }, initialFormId: "abomasnow",
        fast: { id: "POWDER_SNOW" }, charged: [{ id: "WEATHER_BALL_ICE" }, { id: "ENERGY_BALL" }],
        level: 23.5, cp: 1495, ivAtk: 0, ivDef: 15, ivHp: 15,
        hp: 143, maxHp: 143, energy: 8, shields: 1, attackStage: 0, defenseStage: 0
      },
      right: {
        trainer: "B", p: { id: "lickilicky" }, initialFormId: "lickilicky",
        fast: { id: "ROLLOUT" }, charged: [{ id: "BODY_SLAM" }, { id: "SHADOW_BALL" }],
        level: 25, cp: 1498, ivAtk: 0, ivDef: 15, ivHp: 15,
        hp: 156, maxHp: 160, energy: 0, shields: 1, attackStage: 0, defenseStage: 0
      },
      timeline: [event],
      initialTimelineState: timelineModel.initialState,
      battleTurns: { A: 2, B: 0 }
    },
    scenarioReview: { mode: "manual", state: { status: "active" }, history: { A: [], B: [] } }
  };
  return IO.serializeScenario({
    registry,
    battleEngineVersion: BATTLE_ENGINE_VERSION,
    reviewMode: "manual",
    applicationState,
    runtimeState: {
      left: applicationState.battle.left,
      right: applicationState.battle.right,
      battleTurns: { A: 2, B: 0 },
      manualPendingFastEvents: [],
      initialTimelineState: timelineModel.initialState
    },
    manualModeState: manualMode,
    timeline: [event],
    manualSession: { sessionControlMode: "BOTH_MANUAL", snapshots: [] }
  });
}

function comparisonFixture() {
  const scenario = fixture();
  const sharedEvents = structuredClone(scenario.timeline.events);
  const branchPoint = {
    eventId: sharedEvents.at(-1).timelineEventId,
    boundary: "AFTER_EVENT",
    turn: 2,
    stateHash: sharedEvents.at(-1).stateHashAfter
  };
  let registry = Branches.execute(scenario.branchModel.registry, {
    type: Branches.COMMAND_TYPE.CREATE_COMPARISON,
    payload: {
      comparisonId: "shared-comparison-1",
      parentBranchId: scenario.branchModel.registry.activeBranchId,
      branchPoint,
      timelineModel: structuredClone(scenario.branchModel.registry.branches[scenario.branchModel.registry.activeBranchId].timelineModel),
      branches: [
        { slot: "A", branchId: "COMPARISON-A", label: "Normal Resolution" },
        { slot: "B", branchId: "COMPARISON-B", label: "DRE Resolution" }
      ]
    }
  });
  const branchEvent = (slot, trainer, move, start) => ({
    id: `comparison-${slot.toLowerCase()}-event`,
    timelineEventId: `comparison-${slot.toLowerCase()}-event`,
    trainer,
    kind: "fast",
    move,
    start,
    duration: trainer === "A" ? 2 : 3,
    damage: trainer === "A" ? 5 : 7,
    stateHashAfter: `comparison-${slot.toLowerCase()}-state`
  });
  const eventA = branchEvent("A", "A", { id: "POWDER_SNOW", name: "Powder Snow" }, 2);
  const eventB = branchEvent("B", "B", { id: "ROLLOUT", name: "Rollout" }, 2);
  const initialState = structuredClone(scenario.branchModel.registry.branches[scenario.branchModel.registry.activeBranchId].timelineModel.initialState);
  const timelineModelA = { initialState, initialStateHash: "initial", events: [...sharedEvents, eventA], terminalResult: null };
  const timelineModelB = { initialState, initialStateHash: "initial", events: [...sharedEvents, eventB], terminalResult: null };
  registry = Branches.execute(registry, {
    type: Branches.COMMAND_TYPE.UPDATE_BRANCH,
    payload: { branchId: "COMPARISON-A", timelineModel: timelineModelA, edit: { type: "USE_FAST", side: "A" } }
  });
  registry = Branches.execute(registry, {
    type: Branches.COMMAND_TYPE.UPDATE_BRANCH,
    payload: { branchId: "COMPARISON-B", timelineModel: timelineModelB, edit: { type: "USE_FAST", side: "B" } }
  });
  const runtimeA = structuredClone(scenario.state.runtimeState);
  runtimeA.left.energy = 16;
  runtimeA.battleTurns = { A: 4, B: 2 };
  const runtimeB = structuredClone(scenario.state.runtimeState);
  runtimeB.right.energy = 13;
  runtimeB.battleTurns = { A: 2, B: 5 };
  const comparison = Comparison.comparisonFromRegistry(registry, {
    comparisonId: "shared-comparison-1",
    sourceScenarioId: "shared-scenario-1",
    createdAt: "2026-08-10T00:00:02.000Z",
    branchIds: ["COMPARISON-A", "COMPARISON-B"],
    branchStates: {
      "COMPARISON-A": { runtimeState: runtimeA },
      "COMPARISON-B": { runtimeState: runtimeB }
    },
    branchPoint
  });
  scenario.branchModel.registry = registry;
  scenario.branchModel.activeBranchId = registry.activeBranchId;
  scenario.timeline.events = structuredClone(timelineModelA.events);
  scenario.state.applicationState.battle.timeline = structuredClone(timelineModelA.events);
  scenario.state.runtimeState = runtimeA;
  scenario.state.currentTurn = 2;
  scenario.comparison = comparison;
  return scenario;
}

async function run() {
  const scenario = fixture();
  const compressed = await Share.encodeScenario(scenario);
  assert.match(compressed, /^v1\.[gr]\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(await Share.decodeScenario(compressed), scenario, "Compressed scenario tokens must round-trip exactly.");

  const raw = await Share.encodeScenario(scenario, { compression: false });
  assert.match(raw, /^v1\.r\./);
  assert.deepEqual(await Share.decodeScenario(raw), scenario, "The dependency-free raw fallback must remain reversible.");
  const comparison = comparisonFixture();
  const comparisonToken = await Share.encodeScenario(comparison);
  const comparisonDecoded = await Share.decodeScenario(comparisonToken);
  assert.deepEqual(comparisonDecoded, comparison, "A complete comparison link must preserve shared history, branch point, Branch A, and Branch B.");
  const comparisonImported = IO.deserializeScenario(comparisonDecoded, {
    battleEngineVersion: BATTLE_ENGINE_VERSION,
    isPokemonId: () => true,
    isMoveId: () => true
  });
  assert.equal(comparisonImported.ok, true, comparisonImported.errors.join(", "));
  assert.equal(comparisonImported.scenario.comparison.branches.length, 2);
  assert.equal(comparisonImported.scenario.comparison.branchPoint.eventId, "event-1");
  assert.deepEqual(
    comparisonImported.scenario.comparison.branches.map(branch => branch.label),
    ["Normal Resolution", "DRE Resolution"]
  );
  const legacyJson = IO.stringifyScenario(scenario, 0);
  const legacyRaw = `v1.r.${Buffer.from(legacyJson).toString("base64url")}`;
  const legacyGzip = `v1.g.${gzipSync(Buffer.from(legacyJson)).toString("base64url")}`;
  assert.deepEqual(await Share.decodeScenario(legacyRaw), scenario, "Existing unpacked raw v1 links must remain compatible.");
  assert.deepEqual(await Share.decodeScenario(legacyGzip), scenario, "Existing unpacked gzip v1 links must remain compatible.");

  const url = await Share.buildScenarioUrl(scenario, {
    origin: "https://po-go-pvp-simulator.vercel.app",
    pathname: "/PogoPvp.html",
    search: "?preview=1"
  });
  assert.match(url, /^https:\/\/po-go-pvp-simulator\.vercel\.app\/PogoPvp\.html\?preview=1#scenario=v1\./);
  assert.equal(Share.scenarioTokenFromLocation(new URL(url)), url.split("#scenario=")[1]);
  assert.equal(
    Share.locationWithoutScenario(new URL(url)),
    "https://po-go-pvp-simulator.vercel.app/PogoPvp.html?preview=1"
  );
  assert.equal(Share.scenarioTokenFromLocation({ hash: "#other=value" }), null);

  await assert.rejects(() => Share.decodeScenario("v2.r.e30"), error => error.code === "SHARED_SCENARIO_VERSION_UNSUPPORTED");
  await assert.rejects(() => Share.decodeScenario("v1.x.e30"), error => error.code === "INVALID_SCENARIO_TOKEN");
  await assert.rejects(() => Share.decodeScenario("v1.r.***"), error => error.code === "INVALID_SCENARIO_TOKEN_DATA");
  await assert.rejects(() => Share.decodeScenario("v1.r.bm90LWpzb24"), error => error.code === "INVALID_SCENARIO_JSON");
  await assert.rejects(() => Share.decodeScenario("x".repeat(Share.MAX_TOKEN_LENGTH + 1)), error => error.code === "INVALID_SCENARIO_TOKEN");
  const compressedBomb = `v1.g.${gzipSync(Buffer.from(`{"value":"${"x".repeat(Share.MAX_JSON_BYTES)}"}`)).toString("base64url")}`;
  await assert.rejects(() => Share.decodeScenario(compressedBomb), error => error.code === "SHARED_SCENARIO_TOO_LARGE");

  console.log("Shareable Scenario URL encoding tests passed.");
}

module.exports = { fixture, comparisonFixture };

if (require.main === module) {
  run().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
