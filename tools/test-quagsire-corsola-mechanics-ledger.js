"use strict";

const assert = require("assert");
const {
  RANK1_PROFILE,
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
    pokemonMap.get("quagsire_shadow"),
    pokemonMap.get("corsola_galarian"),
    RANK1_PROFILE,
    moveMap,
    movesets,
    pokemonMap
  );
  config.left.fast = clone(moveMap.get("MUD_SHOT"));
  config.left.charged = [clone(moveMap.get("AQUA_TAIL")), clone(moveMap.get("MUD_BOMB"))];
  config.right.fast = clone(moveMap.get("ASTONISH"));
  config.right.charged = [clone(moveMap.get("NIGHT_SHADE")), clone(moveMap.get("POWER_GEM"))];
  return config;
}

function simulate(id, quagsireSequence, steps = [], corsolaSequence = ["NIGHT_SHADE", "NIGHT_SHADE", "NIGHT_SHADE", "NIGHT_SHADE"]) {
  return adapter.simulate({
    id,
    key: id,
    source: "quagsire-corsola-mechanics-ledger",
    aShields: 0,
    bShields: 0,
    includeSwing: false,
    debugTimeline: true,
    trace: true,
    counterfactuals: false,
    diagnosticPlan: {
      defaultAction: "fast",
      chargedSequences: {
        A: quagsireSequence,
        B: corsolaSequence
      },
      steps
    },
    config: fixtureConfig()
  });
}

function timelineMoveId(event) {
  return event.moveId || event.move?.id || null;
}

function ledger(result) {
  return Array.from(result.timelineTrace || [])
    .filter(event => event.kind === "fast" || event.kind === "charge")
    .map(event => ({
      turn: event.start,
      actor: event.trainer,
      actionStarted: `${event.kind}:${timelineMoveId(event)}`,
      actionRegistered: event.registrationTurn ?? event.start,
      pendingImpact: event.kind === "fast" ? (event.resolveTurn ?? event.start + event.duration - 1) : null,
      damage: event.damage,
      energyBefore: event.energyBefore,
      energyAfter: event.energyAfter,
      hpBefore: event.hpBefore,
      hpAfter: event.hpAfter,
      readyTurn: event.kind === "fast"
        ? event.start + Math.max(1, Number(event.duration || 1))
        : event.start + 1,
      queuedActionId: event.queuedActionId || null,
      resolvedActionId: event.resolvedActionId || null
    }));
}

function summary(id, result) {
  const charged = ledger(result).filter(row => row.actionStarted.startsWith("charge:"));
  return {
    id,
    winner: result.details.winnerEdge > 0 ? "A" : result.details.winnerEdge < 0 ? "B" : "tie",
    finalState: result.decisionTrace.finalState,
    charged,
    damage: {
      A: ledger(result).filter(row => row.actor === "A").reduce((sum, row) => sum + row.damage, 0),
      B: ledger(result).filter(row => row.actor === "B").reduce((sum, row) => sum + row.damage, 0)
    },
    ledger: ledger(result)
  };
}

const lineAResult = simulate("quagsire-corsola-line-a", ["AQUA_TAIL", "AQUA_TAIL", "AQUA_TAIL"]);
const lineBResult = simulate("quagsire-corsola-line-b", ["AQUA_TAIL", "AQUA_TAIL", "MUD_BOMB"]);
const pvpokeSteps = [
  { side: "A", turn: 8, type: "charged_move", moveId: "AQUA_TAIL" },
  { side: "A", turn: 17, type: "charged_move", moveId: "AQUA_TAIL" },
  { side: "A", turn: 28, type: "charged_move", moveId: "MUD_BOMB" },
  { side: "B", turn: 21, type: "charged_move", moveId: "NIGHT_SHADE" },
  { side: "B", turn: 28, type: "charged_move", moveId: "NIGHT_SHADE" }
];
const lineCResult = simulate("quagsire-corsola-line-c-pvpoke", [], pvpokeSteps, []);
const lineA = summary("line-a", lineAResult);
const lineB = summary("line-b", lineBResult);
const lineC = summary("line-c-pvpoke", lineCResult);

assert.deepEqual(
  lineA.charged.filter(row => row.actor === "A").map(row => row.actionStarted),
  ["charge:AQUA_TAIL", "charge:AQUA_TAIL", "charge:AQUA_TAIL"]
);
assert.deepEqual(
  lineB.charged.filter(row => row.actor === "A").map(row => row.actionStarted),
  ["charge:AQUA_TAIL", "charge:AQUA_TAIL"]
);
assert.equal(lineB.finalState.A.hp, 0);
assert.deepEqual(
  lineC.charged.map(row => [row.actor, row.turn, row.actionStarted]),
  [
    ["A", 8, "charge:AQUA_TAIL"],
    ["A", 17, "charge:AQUA_TAIL"],
    ["B", 21, "charge:NIGHT_SHADE"],
    ["A", 28, "charge:MUD_BOMB"],
    ["B", 28, "charge:NIGHT_SHADE"]
  ]
);
assert.equal(lineC.winner, "B");
assert.equal(lineC.finalState.A.hp, 0);
assert.equal(lineC.finalState.A.energy, 2);
assert.equal(lineC.finalState.B.hp, 6);
assert.equal(lineC.finalState.B.energy, 0);
assert.deepEqual(lineC.damage, { A: 137, B: 204 });

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    inputs: {
      quagsire: {
        level: fixtureConfig().left.level,
        cp: fixtureConfig().left.cp,
        ivs: [fixtureConfig().left.ivAtk, fixtureConfig().left.ivDef, fixtureConfig().left.ivHp],
        hp: fixtureConfig().left.maxHp,
        attack: fixtureConfig().left.attack,
        defense: fixtureConfig().left.defense
      },
      corsola: {
        level: fixtureConfig().right.level,
        cp: fixtureConfig().right.cp,
        ivs: [fixtureConfig().right.ivAtk, fixtureConfig().right.ivDef, fixtureConfig().right.ivHp],
        hp: fixtureConfig().right.maxHp,
        attack: fixtureConfig().right.attack,
        defense: fixtureConfig().right.defense
      }
    },
    pvpokeReference: {
      displayedTurns: {
        A: [["AQUA_TAIL", 9], ["AQUA_TAIL", 18], ["MUD_BOMB", 29]],
        B: [["NIGHT_SHADE", 22], ["NIGHT_SHADE", 29]]
      },
      simulatorZeroBasedSteps: pvpokeSteps,
      result: { winner: "B", corsolaHp: 6, ratingA: 479 }
    },
    lines: [lineA, lineB, lineC]
  }, null, 2));
} else {
  console.log(`Quagsire/Corsola raw mechanics ledger passed: Line A ${lineA.winner}; Line B ${lineB.winner}; PvPoke line ${lineC.winner}.`);
}
