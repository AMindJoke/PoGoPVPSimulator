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
const { BATTLE_PRINCIPLES } = require("../src/battle/battle-principles");

const principleIds = new Set(BATTLE_PRINCIPLES.map(principle => principle.id));
const gamemaster = readWindowGlobal("gamemaster-data.js", "PVPOKE_GAMEMASTER");
const movesets = readWindowGlobal("pvpoke-default-movesets.js", "PVPOKE_DEFAULT_MOVESETS") || {};
const moveMap = new Map(gamemaster.moves.map(move => [move.moveId, normalizeMove(move)]));
const pokemonMap = new Map(gamemaster.pokemon
  .filter(pokemon => pokemon?.speciesId && pokemon.baseStats)
  .map(pokemon => normalizePokemon(pokemon, moveMap))
  .map(pokemon => [pokemon.id, pokemon]));

const adapter = createWorkerAdapter(extractLiveWorkerSource());
const config = createBattleConfig(
  pokemonMap.get("lanturn"),
  pokemonMap.get("talonflame"),
  DEFAULT_PROFILE,
  moveMap,
  movesets,
  pokemonMap
);

const result = adapter.simulate({
  id: "principle-trace-contract",
  key: "principle-trace-contract",
  source: "principle-trace-contract",
  aShields: 1,
  bShields: 1,
  includeSwing: false,
  debugTimeline: true,
  trace: true,
  counterfactuals: false,
  config
});

const decisions = result.decisionTrace?.decisions || [];
assert(decisions.length > 0, "Expected traced Battle Intelligence decisions.");
assert(
  decisions.some(decision => decision.decisionType === "charged-move-selection"),
  "Expected at least one charged move selection."
);
assert(
  decisions.some(decision => decision.decisionType === "shield-decision"),
  "Expected at least one shield decision."
);

for (const decision of decisions) {
  assert(Array.isArray(decision.sourceRuleIds), `${decision.decisionId} must expose sourceRuleIds.`);
  assert(Array.isArray(decision.principleIds), `${decision.decisionId} must expose principleIds.`);
  assert(decision.principleIds.length > 0, `${decision.decisionId} must be attributed to at least one principle.`);
  for (const principleId of decision.principleIds) {
    assert(principleIds.has(principleId), `${decision.decisionId} references unknown principle ${principleId}.`);
  }
}

console.log("Principle trace contract passed.");
