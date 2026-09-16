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
  .filter(pokemon => pokemon?.speciesId && pokemon.baseStats)
  .map(pokemon => normalizePokemon(pokemon, moveMap))
  .map(pokemon => [pokemon.id, pokemon]));
const adapter = createWorkerAdapter(extractLiveWorkerSource(), { dreStandard: true });
let sequence = 0;

for (const opponentId of ["marowak", "marowak_shadow"]) {
  const config = createBattleConfig(
    pokemonMap.get("skeledirge"),
    pokemonMap.get(opponentId),
    DEFAULT_PROFILE,
    moveMap,
    standardMovesets,
    pokemonMap
  );
  const result = adapter.simulate({
    id: ++sequence,
    key: `skeledirge-${opponentId}-timing`,
    source: "skeledirge-marowak-timing-regression",
    aShields: 1,
    bShields: 1,
    includeSwing: false,
    trace: true,
    debugTimeline: true,
    config
  });
  assert.strictEqual(result.details.outcome, "B", `${opponentId}: Marowak must win the 1-1 line.`);
  assert.strictEqual(result.details.aHp, 0, `${opponentId}: Skeledirge must be KO.`);
  assert(result.details.bHp > 0, `${opponentId}: Marowak must survive.`);
  const firstMarowakCharge = result.timelineTrace.find(event => event.trainer === "B" && event.kind === "charge");
  assert(firstMarowakCharge, `${opponentId}: Marowak must register a Charged Move.`);
  assert(firstMarowakCharge.start <= (opponentId === "marowak" ? 12 : 15),
    `${opponentId}: planner must not overfarm past the winning timing window.`);
}

console.log("Skeledirge vs Marowak timing regressions passed.");
