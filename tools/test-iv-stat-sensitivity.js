"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Intelligence = require("../src/battle/battle-intelligence");
const PlannerAdapter = require("../src/battle/matchup-planner-adapter");
const StatDiagnostics = require("../src/reliability/stat-sensitivity-diagnostics");
const {
  MATRIX_VERSION,
  DEFAULT_PROFILE,
  RANK1_PROFILE,
  readWindowGlobal,
  extractLiveWorkerSource,
  createWorkerAdapter,
  normalizeMove,
  normalizePokemon,
  createCombatant,
  statsForIvSpread,
  combatantStateSignature
} = require("./build-great-league-meta-database");

const ROOT = path.resolve(__dirname, "..");
const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "battle-regressions", "iv-sensitivity.json"), "utf8"));
const gamemaster = readWindowGlobal("gamemaster-data.js", "PVPOKE_GAMEMASTER");
const standardMovesets = readWindowGlobal("pvpoke-default-movesets.js", "PVPOKE_DEFAULT_MOVESETS") || {};
const moveMap = new Map(gamemaster.moves.map(move => [move.moveId, normalizeMove(move)]));
const pokemonMap = new Map(gamemaster.pokemon
  .filter(pokemon => pokemon && pokemon.speciesId && pokemon.baseStats)
  .map(pokemon => normalizePokemon(pokemon, moveMap))
  .map(pokemon => [pokemon.id, pokemon]));
const worker = createWorkerAdapter(extractLiveWorkerSource(), { strict: true });

const strong = {
  bug: ["dark", "grass", "psychic"], dark: ["ghost", "psychic"], dragon: ["dragon"], electric: ["flying", "water"],
  fairy: ["dark", "dragon", "fighting"], fighting: ["dark", "ice", "normal", "rock", "steel"], fire: ["bug", "grass", "ice", "steel"],
  flying: ["bug", "fighting", "grass"], ghost: ["ghost", "psychic"], grass: ["ground", "rock", "water"],
  ground: ["electric", "fire", "poison", "rock", "steel"], ice: ["dragon", "flying", "grass", "ground"], poison: ["fairy", "grass"],
  psychic: ["fighting", "poison"], rock: ["bug", "fire", "flying", "ice"], steel: ["fairy", "ice", "rock"], water: ["fire", "ground", "rock"]
};
const weak = {
  bug: ["fairy", "fighting", "fire", "flying", "ghost", "poison", "steel"], dark: ["dark", "fairy", "fighting"], dragon: ["steel"],
  electric: ["dragon", "electric", "grass", "ground"], fairy: ["fire", "poison", "steel"], fighting: ["bug", "fairy", "flying", "ghost", "poison", "psychic"],
  fire: ["dragon", "fire", "rock", "water"], flying: ["electric", "rock", "steel"], ghost: ["dark", "normal"],
  grass: ["bug", "dragon", "fire", "flying", "grass", "poison", "steel"], ground: ["bug", "flying", "grass"], ice: ["fire", "ice", "steel", "water"],
  normal: ["ghost", "rock", "steel"], poison: ["ghost", "ground", "poison", "rock", "steel"], psychic: ["dark", "psychic", "steel"],
  rock: ["fighting", "ground", "steel"], steel: ["electric", "fire", "steel", "water"], water: ["dragon", "grass", "water"]
};
const immune = { dragon: ["fairy"], electric: ["ground"], fighting: ["ghost"], ghost: ["normal"], ground: ["flying"], normal: ["ghost"], poison: ["steel"], psychic: ["dark"] };

function effectiveness(type, defenderTypes) {
  return defenderTypes.reduce((value, defenderType) => {
    if ((strong[type] || []).includes(defenderType)) value *= 1.6;
    if ((weak[type] || []).includes(defenderType)) value *= 0.625;
    if ((immune[type] || []).includes(defenderType)) value *= 0.625;
    return value;
  }, 1);
}

function canonicalDamage(attacker, defender, move) {
  const stab = attacker.p.types.includes(move.type) ? 1.2 : 1;
  const modifier = stab * effectiveness(move.type, defender.p.types);
  const attack = attacker.attack * (attacker.shadowAtkMult || 1);
  const defense = defender.defense * (defender.shadowDefMult || 1);
  return Math.max(1, Math.floor(move.power * attack * 1.3 * 0.5 / defense * modifier) + 1);
}

function customCombatant(pokemon, trainer, ivs, profile = RANK1_PROFILE) {
  const combatant = createCombatant(pokemon, trainer, profile, moveMap, standardMovesets, pokemonMap);
  const stats = statsForIvSpread(pokemon, ivs[0], ivs[1], ivs[2]);
  Object.assign(combatant, {
    level: stats.level,
    cp: stats.cp,
    ivAtk: stats.ivAtk,
    ivDef: stats.ivDef,
    ivHp: stats.ivHp,
    attack: stats.attack,
    defense: stats.defense,
    maxHp: stats.hp,
    hp: stats.hp,
    cpm: stats.attack / Math.max(1, pokemon.atk + stats.ivAtk)
  });
  return combatant;
}

function simulate(left, right, shields = [0, 0], sequence = 1) {
  return worker.simulate({
    id: sequence,
    source: "iv-stat-sensitivity",
    key: `${left.p.id}-${right.p.id}-${sequence}`,
    signature: MATRIX_VERSION,
    aShields: shields[0],
    bShields: shields[1],
    includeSwing: false,
    trace: true,
    config: { left, right, startEnergyA: left.energy || 0, startEnergyB: right.energy || 0 }
  });
}

function winner(result) {
  const final = result.decisionTrace.finalState;
  return final.A.hp > 0 ? "A" : final.B.hp > 0 ? "B" : "Draw";
}

function principalVariation(result, side = "A") {
  return (result.decisionTrace.decisions || [])
    .filter(decision => decision.side === side && decision.chosenCandidate)
    .map(decision => decision.chosenCandidate.moveId || decision.chosenCandidate.action)
    .filter(Boolean);
}

function stateFor(combatantA, combatantB) {
  const side = combatant => ({
    id: combatant.p.id, formId: combatant.currentFormId || combatant.p.id,
    level: combatant.level, cp: combatant.cp, ivAtk: combatant.ivAtk, ivDef: combatant.ivDef, ivHp: combatant.ivHp,
    attack: combatant.attack, defense: combatant.defense, hp: combatant.hp, maxHp: combatant.maxHp,
    energy: combatant.energy, shields: combatant.shields, attackStage: combatant.attackStage, defenseStage: combatant.defenseStage,
    readyTurn: 0, fastMove: combatant.fast, chargedMoves: combatant.charged
  });
  return { currentTurn: 0, sides: { A: side(combatantA), B: side(combatantB) }, pendingEvents: [] };
}

const tinkaton = pokemonMap.get("tinkaton");
const corsola = pokemonMap.get("corsola_galarian");
const corsolaDefault = createCombatant(corsola, "B", DEFAULT_PROFILE, moveMap, standardMovesets, pokemonMap);
const tinkatonResults = fixture.cases.map((testCase, index) => {
  const left = customCombatant(tinkaton, "A", testCase.ivs);
  const right = customCombatant(corsola, "B", [corsolaDefault.ivAtk, corsolaDefault.ivDef, corsolaDefault.ivHp], DEFAULT_PROFILE);
  const result = simulate(left, right, [0, 0], index + 1);
  const outgoingFast = canonicalDamage(left, right, left.fast);
  const incomingFast = canonicalDamage(right, left, right.fast);
  const chargedDamage = Object.fromEntries(left.charged.map(move => [move.id, canonicalDamage(left, right, move)]));
  const opponentChargedDamage = Object.fromEntries(right.charged.map(move => [move.id, canonicalDamage(right, left, move)]));
  const final = result.decisionTrace.finalState;
  const chargedThrown = result.decisionTrace.decisions.filter(decision => decision.side === "A" && decision.decisionType === "charged-move-selection").length;
  assert.strictEqual(winner(result), testCase.expectedWinner, `${testCase.id} produced the wrong canonical winner.`);
  assert.strictEqual(result.decisionTrace.intelligenceAudit.legacyFallbackDecisions, 0, `${testCase.id} used legacy strategic fallback.`);
  assert.strictEqual(result.decisionTrace.intelligenceAudit.runtimeCoverage, 1, `${testCase.id} lost Battle Intelligence ownership.`);
  return {
    id: testCase.id,
    ivs: testCase.ivs,
    level: left.level,
    cp: left.cp,
    attack: left.attack,
    defense: left.defense,
    maxHp: left.maxHp,
    outgoingFast,
    incomingFast,
    chargedDamage,
    opponentChargedDamage,
    fastMovesToKo: Math.ceil(right.maxHp / outgoingFast),
    incomingFastMovesToKo: Math.ceil(left.maxHp / incomingFast),
    chargedMovesReached: chargedThrown,
    cmp: left.attack > right.attack ? "A" : left.attack < right.attack ? "B" : "tie",
    principalVariation: principalVariation(result),
    winner: winner(result),
    finalHp: { A: final.A.hp, B: final.B.hp },
    finalEnergy: { A: final.A.energy, B: final.B.energy },
    hash: Intelligence.strategicStateKey(stateFor(left, right)),
    cacheSignature: combatantStateSignature(left)
  };
});

assert.strictEqual(new Set(tinkatonResults.map(row => row.hash)).size, tinkatonResults.length, "Every tested spread needs a distinct Battle Intelligence state hash.");
assert.strictEqual(new Set(tinkatonResults.map(row => row.cacheSignature)).size, tinkatonResults.length, "Every tested spread needs a distinct offline cache signature.");
assert.notDeepStrictEqual(tinkatonResults[3].principalVariation, tinkatonResults[4].principalVariation, "The one-HP survival breakpoint must change the principal variation.");
assert(tinkatonResults[4].maxHp > tinkatonResults[3].maxHp, "Nearby winning spread must carry the verified extra HP.");

const nearbyLoss = customCombatant(tinkaton, "A", [0, 12, 10]);
const nearbyWin = customCombatant(tinkaton, "A", [0, 12, 11]);
assert(canonicalDamage(corsolaDefault, nearbyWin, corsolaDefault.fast) <= canonicalDamage(corsolaDefault, nearbyLoss, corsolaDefault.fast), "Increasing bulk must not increase incoming canonical Fast Move damage.");
assert(Math.ceil(nearbyWin.maxHp / canonicalDamage(corsolaDefault, nearbyWin, corsolaDefault.fast)) >= Math.ceil(nearbyLoss.maxHp / canonicalDamage(corsolaDefault, nearbyLoss, corsolaDefault.fast)), "One extra HP must not reduce survival time.");
const nearbyDiagnostics = StatDiagnostics.compare({
  outgoingFastDamage: tinkatonResults[3].outgoingFast,
  incomingFastDamage: tinkatonResults[3].incomingFast,
  survivalFastCount: tinkatonResults[3].incomingFastMovesToKo,
  chargedMovesReachable: tinkatonResults[3].chargedMovesReached,
  cmp: tinkatonResults[3].cmp,
  winner: tinkatonResults[3].winner
}, {
  outgoingFastDamage: tinkatonResults[4].outgoingFast,
  incomingFastDamage: tinkatonResults[4].incomingFast,
  survivalFastCount: tinkatonResults[4].incomingFastMovesToKo,
  chargedMovesReachable: tinkatonResults[4].chargedMovesReached,
  cmp: tinkatonResults[4].cmp,
  winner: tinkatonResults[4].winner
});
assert(nearbyDiagnostics.reasonCodes.includes("STAT_REACHES_EXTRA_CHARGED"), "Nearby Tinkaton spread must expose the extra-Charged reachability diagnostic.");
assert(nearbyDiagnostics.reasonCodes.includes("STAT_TERMINAL_LINE_FLIPPED"), "Nearby Tinkaton spread must expose the terminal line flip diagnostic.");

const altaria = pokemonMap.get("altaria");
const lickilicky = pokemonMap.get("lickilicky");
const altariaRank = customCombatant(altaria, "A", [0, 14, 15]);
const altariaAttack = customCombatant(altaria, "A", [15, 0, 0]);
const lickilickyRank = createCombatant(lickilicky, "B", RANK1_PROFILE, moveMap, standardMovesets, pokemonMap);
assert.strictEqual(canonicalDamage(altariaRank, lickilickyRank, altariaRank.fast), 2, "Rank-1 Altaria fixture must remain below the Dragon Breath breakpoint.");
assert.strictEqual(canonicalDamage(altariaAttack, lickilickyRank, altariaAttack.fast), 3, "High-Attack Altaria fixture must hit the Dragon Breath breakpoint.");
assert.strictEqual(canonicalDamage(lickilickyRank, altariaRank, lickilickyRank.fast), 5, "Rank-1 Altaria fixture must hold the incoming Rollout bulkpoint.");
assert.strictEqual(canonicalDamage(lickilickyRank, altariaAttack, lickilickyRank.fast), 6, "High-Attack Altaria fixture must lose the incoming Rollout bulkpoint.");

const swampert = pokemonMap.get("swampert");
const swampertAttack = customCombatant(swampert, "A", [15, 0, 0]);
const swampertRank = createCombatant(swampert, "B", RANK1_PROFILE, moveMap, standardMovesets, pokemonMap);
const swampertMirror = simulate(swampertAttack, swampertRank, [1, 1], 100);
assert(swampertAttack.attack > swampertRank.attack, "High-Attack fixture must win CMP.");
assert(swampertAttack.maxHp < swampertRank.maxHp, "High-Attack fixture must trade away bulk.");
assert.strictEqual(winner(swampertMirror), "A", "Rank 1 must not be assumed optimal in a CMP-sensitive head-to-head.");

const restored = simulate(customCombatant(tinkaton, "A", [0, 10, 14]), customCombatant(corsola, "B", [corsolaDefault.ivAtk, corsolaDefault.ivDef, corsolaDefault.ivHp], DEFAULT_PROFILE), [0, 0], 200);
assert.strictEqual(winner(restored), tinkatonResults[0].winner, "Restoring IVs must restore the original result.");
assert.deepStrictEqual(restored.decisionTrace.finalState, simulate(customCombatant(tinkaton, "A", [0, 10, 14]), customCombatant(corsola, "B", [corsolaDefault.ivAtk, corsolaDefault.ivDef, corsolaDefault.ivHp], DEFAULT_PROFILE), [0, 0], 201).decisionTrace.finalState, "Identical full states must be deterministic.");

const compactRank = PlannerAdapter.compactBattleState(stateFor(customCombatant(tinkaton, "A", [0, 10, 14]), corsolaDefault));
const compactAttack = PlannerAdapter.compactBattleState(stateFor(customCombatant(tinkaton, "A", [15, 0, 0]), corsolaDefault));
assert.notDeepStrictEqual(compactRank, compactAttack, "Planner compact states must retain exact spread data.");

const report = {
  engineVersion: MATRIX_VERSION,
  tinkatonCorsola: tinkatonResults,
  diagnostics: {
    reasonCodes: [
      "STAT_FAST_DAMAGE_BREAKPOINT",
      "STAT_FAST_DAMAGE_BULKPOINT",
      "STAT_SURVIVES_EXTRA_FAST",
      "STAT_REACHES_EXTRA_CHARGED",
      "STAT_CMP_CHANGED",
      "STAT_TERMINAL_LINE_FLIPPED"
    ],
    altariaLickilicky: { rankFastDamage: 2, attackFastDamage: 3, rankIncomingDamage: 5, attackIncomingDamage: 6 },
    swampertMirror: { winner: winner(swampertMirror), attackA: swampertAttack.attack, attackB: swampertRank.attack, hpA: swampertAttack.maxHp, hpB: swampertRank.maxHp }
  }
};

if (require.main === module) console.log(JSON.stringify(report, null, 2));
module.exports = report;
