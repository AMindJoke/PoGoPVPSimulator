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
const movesets = readWindowGlobal("pvpoke-default-movesets.js", "PVPOKE_DEFAULT_MOVESETS") || {};
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
    pokemonMap.get("feraligatr_shadow"),
    pokemonMap.get("cradily"),
    DEFAULT_PROFILE,
    moveMap,
    movesets,
    pokemonMap
  );
  config.left.fast = clone(moveMap.get("SHADOW_CLAW"));
  config.left.charged = [clone(moveMap.get("HYDRO_CANNON")), clone(moveMap.get("ICE_BEAM"))];
  config.right.fast = clone(moveMap.get("ACID"));
  config.right.charged = [clone(moveMap.get("ROCK_TOMB")), clone(moveMap.get("GRASS_KNOT"))];
  return config;
}

function simulate(cradilySequence = null) {
  return adapter.simulate({
    id: "feraligatr-shadow-cradily-rock-tomb",
    key: "feraligatr-shadow-cradily-rock-tomb",
    source: "reported-matchup-regression",
    aShields: 1,
    bShields: 1,
    includeSwing: false,
    debugTimeline: true,
    trace: true,
    counterfactuals: false,
    diagnosticPlan: cradilySequence ? {
      defaultAction: "fast",
      chargedSequences: {
        A: ["HYDRO_CANNON", "ICE_BEAM"],
        B: cradilySequence
      }
    } : null,
    config: fixtureConfig()
  });
}

const result = simulate();
const rockTombResult = simulate(["ROCK_TOMB", "ROCK_TOMB"]);
const grassKnotResult = simulate(["GRASS_KNOT", "GRASS_KNOT"]);
const cradilyCharges = result.timelineTrace
  .filter(event => event.kind === "charge" && event.trainer === "B")
  .map(event => event.moveId || event.move?.id || null);
const cradilyDecisions = result.decisionTrace.decisions
  .filter(decision => decision.side === "B" && decision.decisionType === "charged-move-selection")
  .map(decision => ({
    turn: decision.turn,
    chosen: decision.chosenCandidate?.moveId,
    intent: decision.principleResult?.intent,
    principles: decision.principlesTriggered,
    evidence: decision.principleResult?.evidence,
    candidates: decision.candidates?.map(candidate => ({
      moveId: candidate.moveId,
      score: candidate.score,
      projectedOutcome: candidate.projectedOutcome,
      projectedRating: candidate.projectedRating
    }))
  }));

if (process.argv.includes("--diagnose")) {
  console.log(JSON.stringify({
    winnerEdge: result.details.winnerEdge,
    score: result.score,
    finalState: result.decisionTrace.finalState,
    allCharges: result.timelineTrace
      .filter(event => event.kind === "charge")
      .map(event => [event.trainer, event.start, event.moveId || event.move?.id || null]),
    cradilyCharges,
    cradilyDecisions,
    rockTombLine: {
      winnerEdge: rockTombResult.details.winnerEdge,
      score: rockTombResult.score,
      finalState: rockTombResult.decisionTrace.finalState,
      charges: rockTombResult.timelineTrace
        .filter(event => event.kind === "charge" && event.trainer === "B")
        .map(event => event.moveId || event.move?.id || null)
    },
    grassKnotLine: {
      winnerEdge: grassKnotResult.details.winnerEdge,
      score: grassKnotResult.score,
      finalState: grassKnotResult.decisionTrace.finalState
    }
  }, null, 2));
} else {
  assert(result.details.winnerEdge < 0, "Cradily should win the default 1-1 matchup.");
  assert.deepEqual(
    cradilyCharges,
    ["ROCK_TOMB", "ROCK_TOMB"],
    "Cradily should preserve the winning straight Rock Tomb route."
  );
  assert.equal(
    cradilyDecisions[0]?.chosen,
    "ROCK_TOMB",
    "Immediate Grass Knot damage must not override a repeated guaranteed attack-debuff route."
  );
  assert.equal(
    cradilyDecisions[0]?.evidence?.compact?.postProcessing?.repeatedGuaranteedAttackDebuffRoute,
    true,
    "The regression must be owned by the repeated guaranteed-effect route rule."
  );
  assert(rockTombResult.details.winnerEdge < 0, "The forced Rock Tomb line should win for Cradily.");
  assert(grassKnotResult.details.winnerEdge > 0, "The forced Grass Knot line should lose for Cradily.");
  console.log("Feraligatr/Cradily regression passed: Cradily preserves straight Rock Tomb and wins the 1-1.");
}
