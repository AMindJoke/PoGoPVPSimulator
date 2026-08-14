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
const standardMovesets = readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS") || {};
const moveMap = new Map(gamemaster.moves.map(move => [move.moveId, normalizeMove(move)]));
const pokemonMap = new Map(gamemaster.pokemon
  .filter(pokemon => pokemon?.speciesId && pokemon?.baseStats)
  .map(pokemon => normalizePokemon(pokemon, moveMap))
  .map(pokemon => [pokemon.id, pokemon]));
const adapter = createWorkerAdapter(extractLiveWorkerSource());

function battleConfig(aId, bId) {
  return createBattleConfig(
    pokemonMap.get(aId),
    pokemonMap.get(bId),
    DEFAULT_PROFILE,
    moveMap,
    standardMovesets,
    pokemonMap
  );
}

function setSingleCharged(combatant, moveId) {
  combatant.charged = [JSON.parse(JSON.stringify(moveMap.get(moveId))), null];
}

function simulate(config, aShields = 0, bShields = 0, id = "special-form") {
  return adapter.simulate({
    id,
    source: "special-form-regression",
    key: id,
    signature: id,
    aShields,
    bShields,
    includeSwing: false,
    trace: true,
    config
  });
}

{
  const config = battleConfig("morpeko_full_belly", "skarmory");
  setSingleCharged(config.left, "AURA_WHEEL_ELECTRIC");
  config.left.energy = config.startEnergyA = 100;
  const result = simulate(config, 0, 0, "morpeko-toggle");
  assert.equal(result.decisionTrace.finalState.A.pokemonId, "morpeko_full_belly");
  assert.equal(result.decisionTrace.decisions[0].chosenCandidate.moveId, "AURA_WHEEL_ELECTRIC");
  assert.equal(result.decisionTrace.decisions[1].chosenCandidate.moveId, "AURA_WHEEL_DARK");
}

{
  const config = battleConfig("aegislash_shield", "snorlax");
  setSingleCharged(config.left, "SHADOW_BALL");
  config.left.energy = config.startEnergyA = 100;
  const shieldMaxHp = config.left.maxHp;
  const result = simulate(config, 0, 0, "aegislash-charged-stance");
  assert.equal(result.decisionTrace.finalState.A.pokemonId, "aegislash_blade");
  assert.equal(result.decisionTrace.decisions[0].chosenCandidate.immediateDamage, 52);
  assert.equal(result.decisionTrace.finalState.A.maxHp, shieldMaxHp);
}

{
  const config = battleConfig("aegislash_shield", "feraligatr");
  const result = simulate(config, 1, 1, "aegislash-banks-before-blade");
  const aegislashDecisions = result.decisionTrace.decisions.filter(decision => decision.side === "A");
  const firstShield = aegislashDecisions.find(decision => decision.decisionType === "shield-decision");
  const charged = aegislashDecisions.filter(decision => decision.decisionType === "charged-move-selection");

  assert.equal(firstShield.chosenCandidate.action, "NO_SHIELD");
  assert.equal(firstShield.reasonCode, "SHIELD_RESERVED_FOR_FORM_RESTORE");
  assert.equal(charged[0].stateBefore.actor.energy, 100);
  assert.equal(charged[1].turn, charged[0].turn + 1);
  assert.equal(result.details.outcome, "A");
}

{
  const config = battleConfig("aegislash_shield", "cradily");
  const result = simulate(config, 2, 2, "aegislash-preserves-final-form-shield");
  const aegislashDecisions = result.decisionTrace.decisions.filter(decision => decision.side === "A");
  const shields = aegislashDecisions.filter(decision => decision.decisionType === "shield-decision");
  const firstChargedTurn = aegislashDecisions.find(decision => decision.decisionType === "charged-move-selection").turn;

  assert.equal(shields[0].chosenCandidate.action, "SHIELD");
  assert.equal(shields[1].chosenCandidate.action, "NO_SHIELD");
  assert.ok(shields.some(decision => decision.turn > firstChargedTurn && decision.chosenCandidate.action === "SHIELD"));
  assert.equal(result.details.outcome, "A");
}

{
  const config = battleConfig("swampert", "aegislash_blade");
  setSingleCharged(config.left, "HYDRO_CANNON");
  config.left.energy = config.startEnergyA = 100;
  config.right.charged = [null, null];
  const result = simulate(config, 0, 1, "aegislash-shield-stance");
  assert.equal(result.decisionTrace.finalState.B.pokemonId, "aegislash_shield");
}

{
  const config = battleConfig("swampert", "mimikyu");
  setSingleCharged(config.left, "HYDRO_CANNON");
  config.left.energy = config.startEnergyA = 100;
  const result = simulate(config, 0, 0, "mimikyu-disguise");
  assert.equal(result.decisionTrace.finalState.B.pokemonId, "mimikyu_busted");
  assert.equal(result.decisionTrace.finalState.B.defenseStage, -1);
}

{
  const config = battleConfig("swampert", "mimikyu");
  setSingleCharged(config.left, "HYDRO_CANNON");
  config.left.energy = config.startEnergyA = 100;
  config.left.hp = 1;
  const result = simulate(config, 0, 1, "mimikyu-regular-shield");
  assert.equal(result.decisionTrace.finalState.B.pokemonId, "mimikyu");
  assert.equal(result.decisionTrace.finalState.B.defenseStage, 0);
}

console.log("Special form mechanics regression checks passed.");
