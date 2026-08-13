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
  pokemonMap.get("tinkaton"),
  pokemonMap.get("dusclops_shadow"),
  DEFAULT_PROFILE,
  moveMap,
  movesets,
  pokemonMap
);
config.left.fast = clone(moveMap.get("FAIRY_WIND"));
config.left.charged = [clone(moveMap.get("GIGATON_HAMMER")), clone(moveMap.get("BULLDOZE"))];
config.right.fast = clone(moveMap.get("HEX"));
config.right.charged = [clone(moveMap.get("ICE_PUNCH")), clone(moveMap.get("SHADOW_PUNCH"))];
config.left.shieldMode = "smart";
config.right.shieldMode = "smart";

const result = adapter.simulate({
  id: "tinkaton-shadow-dusclops-straight-line",
  key: "tinkaton-shadow-dusclops-straight-line",
  source: "reported-matchup-regression",
  aShields: 1,
  bShields: 1,
  includeSwing: false,
  debugTimeline: true,
  trace: true,
  counterfactuals: false,
  config
});

const tinkatonCharges = result.timelineTrace
  .filter(event => event.kind === "charge" && event.trainer === "A")
  .map(event => event.moveId);

assert.strictEqual(result.decisionTrace.finalState.B.pokemonId, "dusclops_shadow",
  "the regression must exercise Shadow Dusclops");
assert.ok(result.details.winnerEdge > 0,
  `Tinkaton should win the 1-1; score=${result.score}, edge=${result.details.winnerEdge}`);
assert.strictEqual(tinkatonCharges.join(","), "GIGATON_HAMMER,GIGATON_HAMMER",
  `Tinkaton should stay on the straight Gigaton Hammer line, received ${tinkatonCharges.join(", ")}`);
assert.ok(result.decisionTrace.finalState.A.hp > 0,
  "Tinkaton should survive the straight Gigaton Hammer line");
assert.strictEqual(result.decisionTrace.finalState.B.hp, 0,
  "Shadow Dusclops should faint to the second Gigaton Hammer");

console.log("Tinkaton vs Shadow Dusclops straight-line regression tests passed.");
