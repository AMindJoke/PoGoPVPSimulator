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
  pokemonMap.get("mimikyu"),
  pokemonMap.get("cradily"),
  DEFAULT_PROFILE,
  moveMap,
  movesets,
  pokemonMap
);
config.right.fast = JSON.parse(JSON.stringify(moveMap.get("BULLET_SEED")));

const result = adapter.simulate({
  id: "mimikyu-cradily-score",
  key: "mimikyu-cradily-score",
  source: "score-regression",
  aShields: 1,
  bShields: 1,
  includeSwing: true,
  trace: true,
  config
});
const finalState = result.decisionTrace.finalState;

assert.equal(result.details.outcome, "B", "Cradily should narrowly win the modeled 1-shield battle.");
assert.ok(finalState.B.hp > 0 && finalState.B.hp / finalState.B.maxHp <= .25, "Cradily should survive with low HP.");
assert.ok(finalState.B.energy < 15, "Cradily should finish with little stored energy.");
assert.ok(result.swing && result.swing.side === "A" && result.swing.fastMoveCount === 1, "One extra Shadow Claw should flip the result for Mimikyu.");
assert.ok(result.score >= 465 && result.score < 500, `A one-Fast flip with limited winner resources must be scored as a slight loss, received ${result.score}.`);
assert.ok(result.details.winnerEdge < 0, "Dynamic terminal scoring must preserve Cradily as the winner.");

console.log(`Mimikyu/Cradily score regression passed: ${result.score}, Cradily ${finalState.B.hp} HP / ${finalState.B.energy} energy.`);
