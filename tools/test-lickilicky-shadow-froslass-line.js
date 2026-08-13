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

const gamemaster = readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
const movesets = readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS") || {};
const moveMap = new Map(gamemaster.moves.map(move => [move.moveId, normalizeMove(move)]));
const pokemonMap = new Map(gamemaster.pokemon
  .filter(pokemon => pokemon?.speciesId && pokemon.baseStats)
  .map(pokemon => normalizePokemon(pokemon, moveMap))
  .map(pokemon => [pokemon.id, pokemon]));
const adapter = createWorkerAdapter(extractLiveWorkerSource());
const clone = value => JSON.parse(JSON.stringify(value));

const config = createBattleConfig(
  pokemonMap.get("lickilicky"),
  pokemonMap.get("froslass_shadow"),
  DEFAULT_PROFILE,
  moveMap,
  movesets,
  pokemonMap
);
config.left.fast = clone(moveMap.get("ROLLOUT"));
config.left.charged = [clone(moveMap.get("BODY_SLAM")), clone(moveMap.get("SHADOW_BALL"))];
config.right.fast = clone(moveMap.get("POWDER_SNOW"));
config.right.charged = [clone(moveMap.get("AVALANCHE")), clone(moveMap.get("SHADOW_BALL"))];
config.left.shieldMode = "smart";
config.right.shieldMode = "smart";

const result = adapter.simulate({
  id: "lickilicky-shadow-froslass-straight-line",
  key: "lickilicky-shadow-froslass-straight-line",
  source: "reported-matchup-regression",
  aShields: 1,
  bShields: 1,
  includeSwing: false,
  debugTimeline: true,
  trace: true,
  counterfactuals: false,
  config
});

const lickilickyCharges = result.timelineTrace
  .filter(event => event.kind === "charge" && event.trainer === "A")
  .map(event => event.moveId);
const timingFasts = result.decisionTrace.decisions
  .filter(decision => decision.side === "A"
    && decision.decisionType === "charged-timing-selection"
    && decision.chosenCandidate?.action === "FAST_THEN_REEVALUATE");

assert.strictEqual(result.decisionTrace.finalState.B.pokemonId, "froslass_shadow",
  "the regression must exercise Shadow Froslass");
assert.ok(result.details.winnerEdge > 0,
  `Lickilicky should win the 1-1; score=${result.score}, edge=${result.details.winnerEdge}`);
assert.strictEqual(lickilickyCharges.join(","), "SHADOW_BALL,SHADOW_BALL",
  `Lickilicky should preserve the straight Shadow Ball line, received ${lickilickyCharges.join(", ")}`);
assert.strictEqual(timingFasts.length, 1,
  "charged timing may add one Fast Move before re-planning, not repeat indefinitely");
assert.ok(result.decisionTrace.finalState.A.hp > 0,
  "Lickilicky should survive the straight Shadow Ball line");
assert.strictEqual(result.decisionTrace.finalState.B.hp, 0,
  "Shadow Froslass should faint to the second Shadow Ball");

console.log("Lickilicky vs Shadow Froslass straight-line regression tests passed.");
