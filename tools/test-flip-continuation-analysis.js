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
  return JSON.parse(JSON.stringify(value));
}

function canonicalConfig(aId, bId) {
  const a = pokemonMap.get(aId);
  const b = pokemonMap.get(bId);
  assert(a, `Missing canonical Pokemon: ${aId}`);
  assert(b, `Missing canonical Pokemon: ${bId}`);
  return createBattleConfig(a, b, DEFAULT_PROFILE, moveMap, standardMovesets, pokemonMap);
}

function controlledContinuationConfig({ strongCost = 45, strongPower = 100, startEnergy = 35 } = {}) {
  const config = canonicalConfig("quagsire", "corsola_galarian");
  config.left.charged = [
    {
      ...clone(moveMap.get("AQUA_TAIL")),
      id: "CHEAP_TEST",
      name: "Cheap Test",
      type: "water",
      power: 10,
      energyCost: 35,
      buffs: null,
      buffsSelf: null,
      buffsOpponent: null,
      buffTarget: null,
      buffApplyChance: 0
    },
    {
      ...clone(moveMap.get("MUD_BOMB")),
      id: "STRONG_TEST",
      name: "Strong Test",
      type: "water",
      power: strongPower,
      energyCost: strongCost,
      buffs: null,
      buffsSelf: null,
      buffsOpponent: null,
      buffTarget: null,
      buffApplyChance: 0
    }
  ];
  config.left.hp = config.left.maxHp = 20;
  config.right.hp = config.right.maxHp = 40;
  config.right.fast = { ...config.right.fast, power: 20, energyGain: 1 };
  config.right.charged = [];
  config.startEnergyA = startEnergy;
  config.startEnergyB = 0;
  return config;
}

function simulate(config, options = {}) {
  sequence++;
  return adapter.simulate({
    id: sequence,
    key: `flip-continuation-${sequence}`,
    aShields: options.aShields || 0,
    bShields: options.bShields || 0,
    includeSwing: !!options.includeSwing,
    trace: !!options.trace,
    preFastAdvantage: options.preFastAdvantage || null,
    continuationMode: options.continuationMode || "presentation",
    config
  });
}

function winnerSide(result) {
  if (result.details.winnerEdge > 0) return "A";
  if (result.details.winnerEdge < 0) return "B";
  return null;
}

function firstChargedDecision(result, side = "A") {
  return result.decisionTrace?.decisions?.find(decision =>
    decision.side === side && decision.decisionType === "charged-move-selection"
  ) || null;
}

function firstPlannerDecision(result, side = "A") {
  return result.decisionTrace?.decisions?.find(decision =>
    decision.side === side && ["charged-move-selection", "farm-vs-throw"].includes(decision.decisionType)
  ) || null;
}

const startedAt = Date.now();

// The displayed baseline uses its only affordable move. Flip analysis restarts
// from the modified state and discovers the stronger winning continuation.
const unlockConfig = controlledContinuationConfig();
const displayedBaseline = simulate(unlockConfig, { trace: true });
assert.strictEqual(winnerSide(displayedBaseline), "B");
assert.strictEqual(firstChargedDecision(displayedBaseline).chosenCandidate.moveName, "Cheap Test");

const detectedUnlock = simulate(unlockConfig, { includeSwing: true });
assert.strictEqual(detectedUnlock.details.flipPotential.visible, true);
assert.strictEqual(detectedUnlock.details.flipPotential.best.side, "A");
assert.strictEqual(detectedUnlock.details.flipPotential.best.fastMoveCount, 1);

const modifiedContinuation = simulate(unlockConfig, {
  trace: true,
  preFastAdvantage: { side: "A", fastMoves: 1 },
  continuationMode: "flip-analysis"
});
const modifiedDecision = firstPlannerDecision(modifiedContinuation);
assert.strictEqual(winnerSide(modifiedContinuation), "A");
assert.strictEqual(modifiedDecision.chosenCandidate.moveName, "Strong Test");

// Extra energy must not manufacture a flip while the stronger move remains out of reach.
const unreachable = simulate(controlledContinuationConfig({ strongCost: 100 }), { includeSwing: true });
assert.strictEqual(winnerSide(unreachable), "B");
assert.strictEqual(unreachable.details.flipPotential.visible, false);

// Access to a stronger move is not itself a flip; the projected battle still has to be won.
const insufficient = simulate(controlledContinuationConfig({ strongPower: 20 }), { includeSwing: true });
assert.strictEqual(winnerSide(insufficient), "B");
assert.strictEqual(insufficient.details.flipPotential.visible, false);

// When several charged moves are legal, analysis compares their projected continuations.
const multipleReady = simulate(controlledContinuationConfig({ strongPower: 40, startEnergy: 45 }), {
  trace: true,
  continuationMode: "flip-analysis"
});
const multipleReadyDecision = firstChargedDecision(multipleReady);
assert.strictEqual(multipleReadyDecision.candidates.length, 2);
assert.strictEqual(multipleReadyDecision.chosenCandidate.moveName, "Strong Test");
assert(multipleReadyDecision.candidates.some(candidate => candidate.moveName === "Cheap Test"));

// Keep a canonical pre-existing flip covered while enforcing the visible timing limit.
// Dewgong needs two Ice Shards (six turns), so the line remains available for
// analysis but must not create a matrix marker.
const existingFlip = simulate(canonicalConfig("dewgong", "azumarill"), {
  aShields: 1,
  bShields: 1,
  includeSwing: true
});
assert.strictEqual(existingFlip.details.flipPotential.visible, false);
assert(existingFlip.details.flipPotential.candidates.some(candidate =>
  candidate.side === "A"
  && candidate.fastMoveCount === 2
  && candidate.totalTurnCost === 6
  && candidate.excludedReason === "medium-hard-timing"
), "Expected the Dewgong/Azumarill flip to remain available as a hidden analysis candidate.");

console.log(`Flip continuation analysis regressions passed in ${Date.now() - startedAt}ms.`);
