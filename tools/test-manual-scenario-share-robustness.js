"use strict";

const assert = require("node:assert/strict");
const IO = require("../src/battle/manual-scenario-io.js");
const Share = require("../src/battle/manual-scenario-share.js");
const { BATTLE_ENGINE_VERSION } = require("../src/reliability/battle-reliability.js");
const { fixture } = require("./test-manual-scenario-share.js");

function clone(value) {
  return structuredClone(value);
}

function fastEvent(index) {
  const side = index % 2 ? "B" : "A";
  const move = side === "A"
    ? { id: "POWDER_SNOW", name: "Powder Snow" }
    : { id: "ROLLOUT", name: "Rollout" };
  return {
    id: `event-${index + 1}`,
    timelineEventId: `event-${index + 1}`,
    trainer: side,
    kind: "fast",
    move,
    start: index * 2,
    duration: side === "A" ? 2 : 3,
    damage: 3 + index % 7,
    energyDelta: side === "A" ? 8 : 13,
    state: {
      A: { hp: Math.max(1, 143 - index % 121), energy: index * 8 % 101, cooldown: index % 3 },
      B: { hp: Math.max(1, 160 - index % 139), energy: index * 13 % 101, cooldown: index % 4 }
    },
    stateHashAfter: `state-${index + 1}-${(index * 2654435761 >>> 0).toString(16)}`
  };
}

function scenarioWithEvents(count) {
  const scenario = fixture();
  const events = Array.from({ length: count }, (_, index) => fastEvent(index));
  scenario.timeline.events = clone(events);
  scenario.state.applicationState.battle.timeline = clone(events);
  scenario.state.applicationState.battle.battleTurns = { A: count * 2, B: count * 2 };
  scenario.state.runtimeState.battleTurns = { A: count * 2, B: count * 2 };
  scenario.state.currentTurn = count * 2;
  if (scenario.state.manualMode?.originalTimeline) scenario.state.manualMode.originalTimeline = clone(events);
  Object.values(scenario.branchModel.registry.branches).forEach(branch => {
    branch.timelineModel.events = clone(events);
    branch.stateHash = events.at(-1)?.stateHashAfter || branch.timelineModel.initialStateHash;
  });
  scenario.branchModel.registry.history = [];
  scenario.branchModel.registry.redoStack = [];
  return scenario;
}

function dreScenario() {
  const scenario = scenarioWithEvents(80);
  const lethalFast = {
    ...fastEvent(80),
    id: "dre-lethal-fast",
    timelineEventId: "dre-lethal-fast",
    trainer: "B",
    move: { id: "ROLLOUT", name: "Rollout" },
    drePending: true,
    fastImpactStatus: "pending"
  };
  const dreEvent = {
    id: "dre-window-1",
    timelineEventId: "dre-window-1",
    trainer: "A",
    kind: "technical-dre",
    issueType: "dre",
    start: lethalFast.start + 1,
    duration: 1,
    pendingFastEventId: "pending-fast-1",
    pendingFastMoveName: "Rollout",
    move: { id: "WEATHER_BALL_ICE", name: "Weather Ball" },
    state: { A: { hp: 4, energy: 35 }, B: { hp: 9, energy: 52 } }
  };
  const events = [...scenario.timeline.events, lethalFast, dreEvent];
  scenario.timeline.events = clone(events);
  scenario.state.applicationState.battle.timeline = clone(events);
  Object.values(scenario.branchModel.registry.branches).forEach(branch => {
    branch.timelineModel.events = clone(events);
    branch.stateHash = "dre-window-state";
  });
  const pendingFast = {
    id: "pending-fast-1",
    sourceSide: "B",
    targetSide: "A",
    moveId: "ROLLOUT",
    moveName: "Rollout",
    damage: 12,
    startTurn: lethalFast.start,
    resolveTurn: lethalFast.start + lethalFast.duration,
    status: "pending"
  };
  scenario.state.pendingFastEvents = [clone(pendingFast)];
  scenario.state.runtimeState.manualPendingFastEvents = [clone(pendingFast)];
  scenario.technicalIssues = {
    active: {
      type: "dre",
      trainer: "A",
      chosenMoveId: "WEATHER_BALL_ICE",
      pendingFast,
      awaitingChargeChoice: false,
      applied: true
    },
    eventIds: ["dre-lethal-fast", "dre-window-1"]
  };
  return scenario;
}

async function measure(name, scenario, maximumLength) {
  const token = await Share.encodeScenario(scenario);
  const repeated = await Share.encodeScenario(scenario);
  const decoded = await Share.decodeScenario(token);
  const imported = IO.deserializeScenario(decoded, {
    battleEngineVersion: BATTLE_ENGINE_VERSION,
    isPokemonId: () => true,
    isMoveId: () => true
  });
  const rawBytes = Buffer.byteLength(IO.stringifyScenario(scenario, 0));
  assert.equal(token, repeated, `${name} encoding must be deterministic.`);
  assert.match(token, /^v1\.g\.[A-Za-z0-9_-]+$/, `${name} should use compact URL-safe gzip encoding.`);
  assert.equal(imported.ok, true, `${name} must remain a valid canonical scenario after URL round-trip: ${imported.errors.join(", ")}`);
  assert.deepEqual(imported.scenario, scenario, `${name} must round-trip without semantic loss.`);
  assert(token.length <= maximumLength, `${name} token ${token.length} exceeds its ${maximumLength}-character robustness budget.`);
  return { name, events: scenario.timeline.events.length, rawBytes, tokenLength: token.length, ratio: token.length / rawBytes };
}

async function run() {
  const results = [
    await measure("short", fixture(), 15_000),
    await measure("long", scenarioWithEvents(250), 20_000),
    await measure("dense", scenarioWithEvents(1_000), 60_000),
    await measure("dre", dreScenario(), 15_000)
  ];
  const truncated = (await Share.encodeScenario(dreScenario())).slice(0, -20);
  await assert.rejects(() => Share.decodeScenario(truncated), error => error.code === "INVALID_COMPRESSED_SCENARIO");
  const malformedPack = `v1.r.${Buffer.from(JSON.stringify({ $pvpeakShare: 1, timeline: [], scenario: {} })).toString("base64url")}`;
  await assert.rejects(() => Share.decodeScenario(malformedPack), error => error.code === "INVALID_SCENARIO_PACK");
  const expansionPack = {
    $pvpeakShare: 1,
    timeline: ["x".repeat(1_100_000)],
    references: [["a"], ["b"], ["c"], ["d"]],
    scenario: { a: null, b: null, c: null, d: null }
  };
  const expansionToken = `v1.r.${Buffer.from(JSON.stringify(expansionPack)).toString("base64url")}`;
  await assert.rejects(() => Share.decodeScenario(expansionToken), error => error.code === "SHARED_SCENARIO_TOO_LARGE");
  assert(results.every(result => result.ratio < 0.25), "Every corpus scenario should compress below 25% of canonical JSON size.");
  assert(results.filter(result => result.events >= 80).every(result => result.ratio < 0.08), "Long and technical scenarios should compact below 8% of canonical JSON size.");
  console.table(results);
  console.log("Shareable Scenario URL robustness tests passed.");
}

if (require.main === module) {
  run().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { scenarioWithEvents, dreScenario };
