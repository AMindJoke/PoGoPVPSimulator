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
    pokemonMap.get("tinkaton"),
    pokemonMap.get("lickilicky"),
    DEFAULT_PROFILE,
    moveMap,
    movesets,
    pokemonMap
  );
  config.left.fast = clone(moveMap.get("FAIRY_WIND"));
  config.left.charged = [clone(moveMap.get("GIGATON_HAMMER")), clone(moveMap.get("BULLDOZE"))];
  config.right.fast = clone(moveMap.get("ROLLOUT"));
  config.right.charged = [clone(moveMap.get("BODY_SLAM")), clone(moveMap.get("SHADOW_BALL"))];
  config.startEnergyB = Number(config.right.fast.energyGain || 0);
  return config;
}

const result = adapter.simulate({
  id: "tinkaton-lickilicky-one-rollout-advantage",
  key: "tinkaton-lickilicky-one-rollout-advantage",
  source: "turn-advantage-regression",
  aShields: 0,
  bShields: 0,
  includeSwing: false,
  debugTimeline: true,
  trace: true,
  counterfactuals: false,
  config: fixtureConfig()
});

const finalState = result.decisionTrace.finalState;
const chargedTimeline = (result.timelineTrace || [])
  .filter(event => event.kind === "charge")
  .map(event => ({
    side: event.trainer,
    turn: event.start,
    moveId: event.moveId || event.move?.id || null
  }));

assert.equal(
  result.details.winnerEdge > 0,
  true,
  "Tinkaton should still win when Lickilicky has one Rollout of starting energy."
);
assert.equal(finalState.A.pokemonId, "tinkaton");
assert.equal(finalState.B.pokemonId, "lickilicky");
assert.equal(finalState.B.hp, 0);
assert(
  chargedTimeline.some(event => event.side === "A" && event.moveId === "GIGATON_HAMMER" && event.turn > 18),
  "Tinkaton must build to the second Gigaton Hammer instead of conceding with Bulldoze."
);
assert.equal(
  chargedTimeline.some(event => event.side === "A" && event.moveId === "BULLDOZE" && event.turn >= 25),
  false,
  "Tinkaton must not throw late Bulldoze when one Fairy Wind reaches a CMP-safe lethal Gigaton Hammer."
);

console.log("Tinkaton/Lickilicky turn-advantage regression passed.");
