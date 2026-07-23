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
    pokemonMap.get("quagsire_shadow"),
    pokemonMap.get("corsola_galarian"),
    DEFAULT_PROFILE,
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

function chargedTimeline(result) {
  return Array.from(result.timelineTrace || [])
    .filter(event => event.kind === "charge")
    .map(event => ({
      side: event.trainer,
      turn: event.start,
      moveId: event.moveId || event.move?.id || null,
      damage: event.damage,
      hpAfter: event.hpAfter
    }));
}

function simulate(iteration) {
  const config = fixtureConfig();
  const result = adapter.simulate({
    id: `quagsire-corsola-default-pvpoke-${iteration}`,
    key: `quagsire-corsola-default-pvpoke-${iteration}`,
    source: "pvpoke-default-url-regression",
    aShields: 0,
    bShields: 0,
    includeSwing: false,
    debugTimeline: true,
    trace: true,
    counterfactuals: false,
    config
  });
  return { config, result, finalState: result.decisionTrace.finalState, charged: chargedTimeline(result) };
}

const runs = Array.from({ length: 12 }, (_, index) => simulate(index + 1));
for (const run of runs) {
  assert.equal(run.result.details.winnerEdge > 0, true, "Default PvPoke URL should be a Shadow Quagsire win.");
  assert.equal(run.finalState.A.hp, 13);
  assert.equal(run.finalState.A.energy, 2);
  assert.equal(run.finalState.B.hp, 0);
  assert.equal(run.finalState.B.energy, 45);
  assert.notDeepEqual(
    run.charged.filter(event => event.side === "A").map(event => event.moveId),
    ["AQUA_TAIL", "AQUA_TAIL", "AQUA_TAIL"],
    "Planner must not collapse the winning default line into three Aqua Tails."
  );
}

const { config, result, finalState, charged } = runs[0];

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({
    pvpokeUrl: "https://pvpoke.com/battle/1500/quagsire_shadow/corsola_galarian/00/0-2-6/0-1-2/",
    inputs: {
      quagsire: {
        level: config.left.level,
        cp: config.left.cp,
        ivs: [config.left.ivAtk, config.left.ivDef, config.left.ivHp],
        hp: config.left.maxHp,
        attack: config.left.attack,
        defense: config.left.defense
      },
      corsola: {
        level: config.right.level,
        cp: config.right.cp,
        ivs: [config.right.ivAtk, config.right.ivDef, config.right.ivHp],
        hp: config.right.maxHp,
        attack: config.right.attack,
        defense: config.right.defense
      }
    },
    result: {
      winner: "A",
      quagsireHp: finalState.A.hp,
      quagsireEnergy: finalState.A.energy,
      battleRating: result.score
    },
    charged,
    sampledLines: runs.map(run => run.charged.map(event => [event.side, event.turn, event.moveId]))
  }, null, 2));
} else {
  console.log("Quagsire/Corsola PvPoke default regression passed: Quagsire wins without the triple Aqua Tail line.");
}
