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
const config = createBattleConfig(
  pokemonMap.get("bastiodon"),
  pokemonMap.get("altaria"),
  DEFAULT_PROFILE,
  moveMap,
  movesets,
  pokemonMap
);

const result = adapter.simulate({
  id: "bastiodon-altaria-score",
  key: "bastiodon-altaria-score",
  source: "score-regression",
  aShields: 1,
  bShields: 1,
  includeSwing: true,
  trace: true,
  config
});

assert.equal(result.details.outcome, "A", "Bastiodon should win the modeled 1-shield battle.");
assert.equal(result.details.outpacePressureEdge, 0, "A fainted Altaria must not retain future outpace pressure.");
assert(result.score >= 660, `The surviving HP advantage should produce a clearly favorable score, got ${result.score}.`);
assert(result.decisionTrace.finalState.A.hp >= 40, "Bastiodon should retain a substantial HP advantage.");
console.log(`Bastiodon/Altaria score regression passed: ${result.score}, Bastiodon ${result.decisionTrace.finalState.A.hp} HP.`);
