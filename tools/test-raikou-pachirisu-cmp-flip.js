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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fixtureConfig() {
  const config = createBattleConfig(
    pokemonMap.get("raikou"),
    pokemonMap.get("pachirisu"),
    DEFAULT_PROFILE,
    moveMap,
    movesets,
    pokemonMap
  );
  config.left.fast = clone(moveMap.get("VOLT_SWITCH"));
  config.left.charged = [clone(moveMap.get("WILD_CHARGE")), clone(moveMap.get("AURA_SPHERE"))];
  config.right.fast = clone(moveMap.get("VOLT_SWITCH"));
  config.right.charged = [clone(moveMap.get("HYPER_FANG")), clone(moveMap.get("THUNDER_PUNCH"))];
  return config;
}

const result = adapter.simulate({
  id: "raikou-pachirisu-cmp-flip",
  key: "raikou-pachirisu-cmp-flip",
  source: "cmp-flip-regression",
  aShields: 1,
  bShields: 1,
  includeSwing: false,
  debugTimeline: true,
  trace: true,
  counterfactuals: false,
  config: fixtureConfig()
});

const chargedTimeline = (result.timelineTrace || [])
  .filter(event => event.kind === "charge")
  .map(event => ({
    side: event.trainer,
    turn: event.start,
    moveId: event.moveId || event.move?.id || null
  }));
const finalState = result.decisionTrace.finalState;

assert.equal(
  result.details.winnerEdge > 0,
  true,
  "Raikou should flip the 1-1 by taking the CMP-safe Volt Switch before the final Aura Sphere."
);
assert.equal(finalState.A.pokemonId, "raikou");
assert.equal(finalState.B.pokemonId, "pachirisu");
assert.equal(finalState.B.hp, 0);
assert(
  chargedTimeline.some(event => event.side === "A" && event.moveId === "AURA_SPHERE" && event.turn >= 32),
  "Raikou must throw the final Aura Sphere on the CMP-aligned turn."
);
assert.equal(
  chargedTimeline.some(event => event.side === "A" && event.moveId === "AURA_SPHERE" && event.turn === 28),
  false,
  "Raikou must not throw Aura Sphere immediately when one Volt Switch creates a winning CMP KO."
);

console.log("Raikou/Pachirisu CMP flip regression passed.");
