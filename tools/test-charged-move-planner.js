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
  .filter(pokemon => pokemon?.speciesId && pokemon.baseStats)
  .map(pokemon => normalizePokemon(pokemon, moveMap))
  .map(pokemon => [pokemon.id, pokemon]));
const adapter = createWorkerAdapter(extractLiveWorkerSource());
let sequence = 0;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function configFor(aId, bId, chargedIds) {
  const config = createBattleConfig(
    pokemonMap.get(aId),
    pokemonMap.get(bId),
    DEFAULT_PROFILE,
    moveMap,
    standardMovesets,
    pokemonMap
  );
  config.left.charged = chargedIds.map(id => clone(moveMap.get(id)));
  return config;
}

function simulate(config, shields) {
  sequence++;
  return adapter.simulate({
    id: sequence,
    key: `charged-principle-${sequence}`,
    source: "charged-principle-test",
    aShields: shields,
    bShields: shields,
    includeSwing: false,
    trace: true,
    config
  });
}

function chargedDecisions(result) {
  return (result.decisionTrace?.decisions || [])
    .filter(decision => decision.decisionType === "charged-move-selection");
}

function assertDirectParityOwnership(result) {
  const decisions = chargedDecisions(result);
  assert(decisions.length > 0, "The battle must expose at least one Charged decision.");
  assert.strictEqual(result.decisionTrace.intelligenceAudit.legacyFallbackDecisions, 0);
  assert.strictEqual(result.decisionTrace.intelligenceAudit.runtimeCoverage, 1);
  for (const decision of decisions) {
    assert.strictEqual(decision.finalAuthority, "PRINCIPLE_ENGINE");
    assert.strictEqual(decision.fallbackUsed, false);
    assert.strictEqual(decision.principleResult?.evidence?.plannerMode, "PVPOKE_PARITY");
    assert.strictEqual(decision.principlesEvaluated.length, 43);
    assert(decision.candidates.length <= 2, "Only the actor's legal Charged Moves may be compared.");
    assert(decision.candidates.every(candidate => (candidate.branchDepth || 0) === 0),
      "Legacy continuation search must not own a parity-mode decision.");
  }
}

const sableyeConfig = configFor("sableye", "empoleon", ["FOUL_PLAY", "DRAIN_PUNCH"]);
const sableyeFirst = simulate(sableyeConfig, 1);
const sableyeSecond = simulate(sableyeConfig, 1);
assertDirectParityOwnership(sableyeFirst);
assertDirectParityOwnership(sableyeSecond);
assert.deepStrictEqual(sableyeFirst.decisionTrace.finalState, sableyeSecond.decisionTrace.finalState,
  "Parity mode must be deterministic for the same complete state.");

const effectDecision = chargedDecisions(sableyeFirst).find(decision =>
  decision.side === "A" && decision.chosenCandidate?.moveId === "DRAIN_PUNCH"
);
assert(effectDecision, "The approved guaranteed-effect adaptation must remain reachable.");
assert(effectDecision.principlesTriggered.includes("EFFECT-031_APPLY_GUARANTEED_ATTACK_DEFENSE_EFFECTS"));

const quagsire = simulate(configFor(
  "quagsire_shadow",
  "corsola_galarian",
  ["AQUA_TAIL", "MUD_BOMB"]
), 0);
assertDirectParityOwnership(quagsire);
const quagsireSequence = Array.from(chargedDecisions(quagsire)
  .filter(decision => decision.side === "A")
  .map(decision => decision.chosenCandidate?.moveId));
assert.deepStrictEqual(quagsireSequence, ["AQUA_TAIL", "MUD_BOMB", "AQUA_TAIL"]);

console.log("Charged Principle Engine parity tests passed.");
