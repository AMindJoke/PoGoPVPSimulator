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
assert(baseline.details.winnerEdge < 0, "The frozen baseline must reproduce the current incorrect Quagsire loss.");
assert.deepStrictEqual(chargedTurns(baseline, "A", "AQUA_TAIL"), [8, 17, 25, 33]);
assert.deepStrictEqual(chargedTurns(baseline, "B", "NIGHT_SHADE"), [18, 26, 40]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(baseline.decisionTrace.finalState.A)), {
  pokemonId: "quagsire_shadow",
  hp: 0,
  maxHp: 161,
  energy: 31,
  shields: 0,
  attackStage: 0,
  defenseStage: 0,
  fastMoveId: "MUD_SHOT",
  fastMoveName: "Mud Shot",
  fastMoveTurns: 2,
  readyTurn: 41
});

const guardedPlanner = simulate("quagsire-corsola-guarded-planner", null, {
  matchupPlannerV2: true,
  plannerPolicy: "FAST"
});
assert.deepStrictEqual(
  chargedTurns(guardedPlanner, "A", "AQUA_TAIL"),
  chargedTurns(baseline, "A", "AQUA_TAIL"),
  "An incomplete FAST plan must fall back without changing the canonical baseline timeline."
);
assert.deepStrictEqual(
  chargedTurns(guardedPlanner, "B", "NIGHT_SHADE"),
  chargedTurns(baseline, "B", "NIGHT_SHADE")
);
assert.strictEqual(guardedPlanner.details.winnerEdge < 0, true);
assert.strictEqual(
  guardedPlanner.decisionTrace.decisions.some(decision => String(decision.reasonCode || "").startsWith("MP_PROVEN_")),
  false,
  "A bounded planner result must not be presented as proven."
);

const verifiedLine = simulate("quagsire-corsola-verified-line", {
  defaultAction: "fast",
  steps: [
    ...[8, 17, 30, 37, 44].map(turn => ({ side: "A", turn, type: "charged_move", moveId: "AQUA_TAIL" })),
    ...[21, 34].map(turn => ({ side: "B", turn, type: "charged_move", moveId: "NIGHT_SHADE" }))
  ]
});

assert(verifiedLine.details.winnerEdge > 0, "The canonical engine must reproduce the legal Shadow Quagsire winning line.");
assert.deepStrictEqual(chargedTurns(verifiedLine, "A", "AQUA_TAIL"), [8, 17, 30, 37, 44]);
assert.deepStrictEqual(chargedTurns(verifiedLine, "B", "NIGHT_SHADE"), [21, 34]);
assert.strictEqual(verifiedLine.decisionTrace.finalState.A.hp, 19);
assert.strictEqual(verifiedLine.decisionTrace.finalState.A.energy, 5);
assert.strictEqual(verifiedLine.decisionTrace.finalState.B.hp, 0);
assert.strictEqual(verifiedLine.decisionTrace.finalState.B.energy, 50);

console.log("Matchup planner fixture passed.");
console.log("Baseline: Corsola wins; Quagsire faints with 31 stranded energy after four Aqua Tails.");
console.log("Verified line: Quagsire wins with 19 HP and 5 energy after five Aqua Tails.");
