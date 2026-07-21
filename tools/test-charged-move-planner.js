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
const standardMovesets = readWindowGlobal("pvpoke-default-movesets.js", "PVPOKE_DEFAULT_MOVESETS") || {};
const moveMap = new Map(gamemaster.moves.map(move => [move.moveId, normalizeMove(move)]));
const pokemonMap = new Map(gamemaster.pokemon
  .filter(pokemon => pokemon && pokemon.speciesId && pokemon.baseStats)
  .map(pokemon => normalizePokemon(pokemon, moveMap))
  .map(pokemon => [pokemon.id, pokemon]));
const adapter = createWorkerAdapter(extractLiveWorkerSource());
let sequence = 0;

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function battleConfig(aId, bId, options = {}) {
  const a = pokemonMap.get(aId);
  const b = pokemonMap.get(bId);
  assert(a, `Missing canonical Pokemon: ${aId}`);
  assert(b, `Missing canonical Pokemon: ${bId}`);
  const config = createBattleConfig(a, b, DEFAULT_PROFILE, moveMap, standardMovesets, pokemonMap);
  if (options.aFast) config.left.fast = clone(moveMap.get(options.aFast));
  if (options.bFast) config.right.fast = clone(moveMap.get(options.bFast));
  if (options.aCharged) config.left.charged = options.aCharged.map(id => clone(moveMap.get(id)));
  if (options.bCharged) config.right.charged = options.bCharged.map(id => clone(moveMap.get(id)));
  return config;
}

function simulate(config, shields = 1, options = {}) {
  sequence++;
  return adapter.simulate({
    id: sequence,
    key: `charged-planner-${sequence}`,
    aShields: shields,
    bShields: shields,
    includeSwing: !!options.includeSwing,
    debugChargedDecisions: false,
    trace: true,
    source: "battle-regression",
    config
  });
}

function decisionsFor(result, pokemonName) {
  const pokemonIds = {
    "Sableye": "sableye",
    "Sableye (Shadow)": "sableye_shadow",
    "Seaking": "seaking",
    "Raikou": "raikou"
  };
  return (result.decisionTrace?.decisions || [])
    .filter(entry => entry.pokemonId === pokemonIds[pokemonName] && entry.decisionType === "charged-move-selection")
    .map(entry => ({
      chosenMove: entry.chosenCandidate?.moveName || null,
      candidates: (entry.candidates || []).map(item => ({
        move: item.moveName,
        effects: item.statEffects,
        projectedResult: item.projectedOutcome,
        projectedScore: item.projectedRating,
        branchDepth: item.branchDepth || 0
      }))
    }));
}

function candidate(decision, moveName) {
  return decision && decision.candidates.find(item => item.move === moveName);
}

function firstChargedChoice(result, side) {
  return (result.decisionTrace?.decisions || []).find(decision =>
    decision.side === side && decision.decisionType === "charged-move-selection" && decision.chosenCandidate?.moveId
  )?.chosenCandidate?.moveId || null;
}

function assertBounded(result) {
  for (const decision of (result.decisionTrace?.decisions || []).filter(item => item.decisionType === "charged-move-selection")) {
    assert(decision.candidates.length <= 2, `${decision.pokemon} evaluated more than two charged branches.`);
    for (const item of decision.candidates) {
      assert((item.branchDepth || 0) <= 1, `${item.moveName} exceeded the continuation guard.`);
    }
  }
}

const startedAt = Date.now();
const sableyeConfig = battleConfig("sableye", "empoleon", {
  aCharged: ["FOUL_PLAY", "DRAIN_PUNCH"]
});
const sableyeOne = simulate(sableyeConfig, 1);
const sableyeDecision = decisionsFor(sableyeOne, "Sableye")[0];
assert(sableyeDecision, "Sableye should evaluate its charged continuations.");
assert.strictEqual(sableyeDecision.chosenMove, "Drain Punch");
assert.strictEqual(candidate(sableyeDecision, "Drain Punch").projectedResult, "win");
assert(candidate(sableyeDecision, "Drain Punch").projectedScore > candidate(sableyeDecision, "Foul Play").projectedScore);

const shadowSableye = simulate(battleConfig("sableye_shadow", "empoleon", {
  aCharged: ["FOUL_PLAY", "DRAIN_PUNCH"]
}), 1);
assert.strictEqual(decisionsFor(shadowSableye, "Sableye (Shadow)")[0].chosenMove, "Drain Punch");
const shadowSableyeZero = simulate(battleConfig("sableye_shadow", "empoleon", {
  aCharged: ["FOUL_PLAY", "DRAIN_PUNCH"]
}), 0);
const shadowSableyeTwo = simulate(battleConfig("sableye_shadow", "empoleon", {
  aCharged: ["FOUL_PLAY", "DRAIN_PUNCH"]
}), 2);
assert.strictEqual(decisionsFor(shadowSableyeZero, "Sableye (Shadow)")[0].chosenMove, "Foul Play");
assert.strictEqual(decisionsFor(shadowSableyeTwo, "Sableye (Shadow)")[0].chosenMove, "Drain Punch");
const equalCostSwing = simulate(battleConfig("sableye_shadow", "empoleon", {
  aCharged: ["FOUL_PLAY", "DRAIN_PUNCH"]
}), 1, { includeSwing: true });
const equalCostCandidates = equalCostSwing.details?.flipPotential?.candidates || [];
assert(!equalCostCandidates.some(item => item.lineType === "bait" || item.lineType === "opponent-bait"), "Equal-cost charged moves must not be classified as bait lines.");

const seaking = simulate(battleConfig("seaking", "hawlucha", {
  aCharged: ["DRILL_RUN", "ICY_WIND"]
}), 1);
const seakingDecision = decisionsFor(seaking, "Seaking")[0];
assert(seakingDecision, "Seaking should compare Drill Run with the one-fast Icy Wind wait.");
assert.strictEqual(seakingDecision.chosenMove, "Icy Wind");
assert.strictEqual(candidate(seakingDecision, "Icy Wind").effects, "opponent ATK -1");
assert.strictEqual(candidate(seakingDecision, "Icy Wind").projectedResult, "win");
assert.strictEqual(candidate(seakingDecision, "Drill Run").projectedResult, "loss");

const dewgongSwing = simulate(battleConfig("dewgong", "azumarill"), 1, { includeSwing: true });
assert.strictEqual(dewgongSwing.swingReady, true);
assert(dewgongSwing.details && dewgongSwing.details.flipPotential, "Dewgong vs Azumarill should complete worker-side swing analysis.");

const noEffectConfig = battleConfig("quagsire", "corsola_galarian", {
  aCharged: ["AQUA_TAIL", "MUD_BOMB"]
});
const noEffectFirst = simulate(noEffectConfig, 0);
const noEffectSecond = simulate(noEffectConfig, 0);
assert((noEffectFirst.decisionTrace?.decisions || [])
  .filter(item => item.decisionType === "charged-move-selection")
  .every(item => item.candidates.every(candidate => (candidate.branchDepth || 0) === 0)));
assert.strictEqual(noEffectFirst.score, noEffectSecond.score);
assert.strictEqual(noEffectFirst.details.winnerEdge, noEffectSecond.details.winnerEdge);

const selfDebuff = simulate(battleConfig("raikou", "pachirisu", {
  aFast: "VOLT_SWITCH",
  bFast: "VOLT_SWITCH",
  aCharged: ["WILD_CHARGE", "AURA_SPHERE"],
  bCharged: ["HYPER_FANG", "THUNDER_PUNCH"]
}), 1);
const selfDebuffDecision = decisionsFor(selfDebuff, "Raikou")[0];
assert(selfDebuffDecision, "Raikou should evaluate the guaranteed Wild Charge self-debuff.");
assert(candidate(selfDebuffDecision, "Wild Charge").effects.includes("self DEF -2"));
assert.strictEqual(selfDebuffDecision.chosenMove, "Aura Sphere");

const swampertSingleMoveOpponent = simulate(battleConfig("swampert", "abomasnow", {
  aFast: "MUD_SHOT",
  aCharged: ["HYDRO_CANNON", "SLUDGE"],
  bFast: "POWDER_SNOW",
  bCharged: ["ICY_WIND"]
}), 1, { trace: true });
const swampertTwoMoveOpponent = simulate(battleConfig("swampert", "abomasnow", {
  aFast: "MUD_SHOT",
  aCharged: ["HYDRO_CANNON", "SLUDGE"],
  bFast: "POWDER_SNOW",
  bCharged: ["ICY_WIND", "OUTRAGE"]
}), 1, { trace: true });
const swampertCheaperBait = simulate(battleConfig("swampert", "abomasnow", {
  aFast: "MUD_SHOT",
  aCharged: ["HYDRO_CANNON", "SLUDGE_WAVE"],
  bFast: "POWDER_SNOW",
  bCharged: ["ICY_WIND"]
}), 1, { trace: true });
assert.strictEqual(firstChargedChoice(swampertSingleMoveOpponent, "A"), "SLUDGE");
assert.strictEqual(firstChargedChoice(swampertTwoMoveOpponent, "A"), "SLUDGE");
assert.strictEqual(firstChargedChoice(swampertCheaperBait, "A"), "HYDRO_CANNON");

const sableyeZero = simulate(sableyeConfig, 0);
const sableyeTwo = simulate(sableyeConfig, 2);
assert.strictEqual(decisionsFor(sableyeZero, "Sableye")[0].chosenMove, "Foul Play");
assert.strictEqual(decisionsFor(sableyeTwo, "Sableye")[0].chosenMove, "Drain Punch");
const lateSableyeDecision = decisionsFor(sableyeOne, "Sableye")[1];
assert(lateSableyeDecision, "Expected a later Sableye decision after the defensive boost has had time to matter.");
assert.strictEqual(lateSableyeDecision.chosenMove, "Foul Play");
assert(candidate(lateSableyeDecision, "Foul Play").projectedScore >= candidate(lateSableyeDecision, "Drain Punch").projectedScore);

[sableyeOne, shadowSableye, shadowSableyeZero, shadowSableyeTwo, equalCostSwing, seaking, dewgongSwing, noEffectFirst, selfDebuff, swampertSingleMoveOpponent, swampertTwoMoveOpponent, swampertCheaperBait, sableyeZero, sableyeTwo].forEach(assertBounded);

console.log(`Charged continuation planner regressions passed in ${Date.now() - startedAt}ms.`);
console.log(`Sableye 1-1: ${sableyeDecision.chosenMove}; Seaking 1-1: ${seakingDecision.chosenMove}; Raikou 1-1: ${selfDebuffDecision.chosenMove}.`);
