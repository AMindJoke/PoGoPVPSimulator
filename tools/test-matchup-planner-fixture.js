"use strict";

const assert = require("assert");
const {
  DEFAULT_PROFILE,
  readWindowGlobal,
  extractLiveWorkerSource,
  createWorkerAdapter,
  normalizeMove,
  normalizePokemon,
  createBattleConfig
} = require("./build-great-league-meta-database");

const gamemaster = readWindowGlobal("gamemaster-data.js", "PVPOKE_GAMEMASTER");
const movesets = readWindowGlobal("pvpoke-default-movesets.js", "PVPOKE_DEFAULT_MOVESETS") || {};
const moveMap = new Map(gamemaster.moves.map(move => [move.moveId, normalizeMove(move)]));
const pokemonMap = new Map(gamemaster.pokemon
  .filter(pokemon => pokemon?.speciesId && pokemon.baseStats)
  .map(pokemon => normalizePokemon(pokemon, moveMap))
  .map(pokemon => [pokemon.id, pokemon]));
const adapter = createWorkerAdapter(extractLiveWorkerSource());

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixtureConfig() {
  const config = createBattleConfig(
    pokemonMap.get("quagsire_shadow"),
    pokemonMap.get("corsola_galarian"),
    DEFAULT_PROFILE,
    moveMap,
    movesets,
    pokemonMap
  );
  config.left.fast = clone(moveMap.get("MUD_SHOT"));
  config.left.charged = [clone(moveMap.get("AQUA_TAIL")), clone(moveMap.get("MUD_BOMB"))];
  config.right.fast = clone(moveMap.get("ASTONISH"));
  config.right.charged = [clone(moveMap.get("NIGHT_SHADE")), clone(moveMap.get("POWER_GEM"))];
  return config;
}

function simulate(key, diagnosticPlan = null, options = {}) {
  return adapter.simulate({
    id: key,
    key,
    source: "matchup-planner-fixture",
    aShields: 2,
    bShields: 2,
    includeSwing: false,
    debugTimeline: true,
    trace: true,
    continuationMode: "presentation",
    diagnosticPlan,
    ...options,
    config: fixtureConfig()
  });
}

function chargedTurns(result, side, moveId) {
  return Array.from(result.timelineTrace || [])
    .filter(event => event.trainer === side && event.kind === "charge" && event.moveId === moveId)
    .map(event => event.start);
}

const baseline = simulate("quagsire-corsola-baseline");
assert(baseline.details.winnerEdge > 0, "Shadow Quagsire must adapt to Corsola's charged timing and win.");
assert.deepStrictEqual(chargedTurns(baseline, "A", "AQUA_TAIL"), [8, 17, 34, 37, 44]);
assert.deepStrictEqual(chargedTurns(baseline, "B", "NIGHT_SHADE"), [21, 31]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(baseline.decisionTrace.finalState.A)), {
  pokemonId: "quagsire_shadow",
  hp: 19,
  maxHp: 161,
  energy: 5,
  shields: 0,
  attackStage: 0,
  defenseStage: 0,
  fastMoveId: "MUD_SHOT",
  fastMoveName: "Mud Shot",
  fastMoveTurns: 2,
  readyTurn: 45
});
assert.strictEqual(baseline.decisionTrace.finalState.B.hp, 0);
assert.strictEqual(baseline.decisionTrace.finalState.B.energy, 50);

assert.strictEqual(
  baseline.decisionTrace.decisions.some(decision => String(decision.reasonCode || "").startsWith("MP_PROVEN_")),
  false,
  "The optional Matchup Planner V2 must remain disabled by default."
);

const publishedFixedLine = simulate("quagsire-corsola-published-fixed-line", {
  defaultAction: "fast",
  steps: [
    ...[8, 17, 30, 37, 44].map(turn => ({ side: "A", turn, type: "charged_move", moveId: "AQUA_TAIL" })),
    ...[21, 34].map(turn => ({ side: "B", turn, type: "charged_move", moveId: "NIGHT_SHADE" }))
  ]
});

assert(publishedFixedLine.details.winnerEdge > 0, "The engine must reproduce the published cooperative line.");
assert.deepStrictEqual(chargedTurns(publishedFixedLine, "A", "AQUA_TAIL"), [8, 17, 30, 37, 44]);
assert.deepStrictEqual(chargedTurns(publishedFixedLine, "B", "NIGHT_SHADE"), [21, 34]);
assert.strictEqual(publishedFixedLine.decisionTrace.finalState.A.hp, 19);
assert.strictEqual(publishedFixedLine.decisionTrace.finalState.A.energy, 5);
assert.strictEqual(publishedFixedLine.decisionTrace.finalState.B.hp, 0);
assert.strictEqual(publishedFixedLine.decisionTrace.finalState.B.energy, 50);

function actionSteps(result, side) {
  return Array.from(result.timelineTrace || [])
    .filter(event => event.trainer === side && (event.kind === "fast" || event.kind === "charge"))
    .map(event => ({
      side,
      turn: event.start,
      type: event.kind === "fast" ? "fast_move" : "charged_move",
      ...(event.kind === "charge" ? { moveId: event.moveId } : {})
    }));
}

const rationalResponse = simulate("quagsire-corsola-rational-response", {
  steps: [
    ...actionSteps(publishedFixedLine, "A"),
    { side: "B", turn: 21, type: "charged_move", moveId: "NIGHT_SHADE" },
    { side: "B", turn: 31, type: "charged_move", moveId: "NIGHT_SHADE" }
  ]
});
assert(
  rationalResponse.details.winnerEdge < 0,
  "The published fixed line must not be described as proven: Corsola's legal T31 Night Shade flips it."
);
assert.strictEqual(rationalResponse.decisionTrace.finalState.A.hp, 0);
assert.strictEqual(rationalResponse.decisionTrace.finalState.B.hp, 23);
assert.deepStrictEqual(chargedTurns(rationalResponse, "B", "NIGHT_SHADE"), [21, 31, 44]);

console.log("Matchup planner fixture passed.");
console.log("Adaptive line: Quagsire wins with 19 HP after Aqua Tails at 8/17/34/37/44.");
console.log("Counterexample: the fixed 8/17/30/37/44 line loses to Corsola's legal T31 Night Shade.");
