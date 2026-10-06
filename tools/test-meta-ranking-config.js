"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const G = require("./build-great-league-meta-database");
const data = G.generationData("twilight-trails");
const moves = new Map(data.gameMaster.moves.map(move => [move.moveId, G.normalizeMove(move)]));
const pokemon = new Map(data.gameMaster.pokemon.filter(p => p?.speciesId && p.baseStats)
  .map(p => G.normalizePokemon(p, moves)).map(p => [p.id, p]));
const ids = ["mimikyu", "electrode_hisuian", "morpeko_full_belly", "aegislash_shield", "cramorant"];
const builds = new Map(ids.map(id => [id, G.rank1Stats(pokemon.get(id))]));
let settings = { ivProfile: "rank1", baiting: "selective", shieldMode: "always", startEnergy: 0 };
const html = fs.readFileSync("PogoPvp.html", "utf8");
const helper = html.slice(html.indexOf("    function createMetaRankingBattleConfig("), html.indexOf("    function createMetaCombatant("));
const context = {
  createMetaBattleConfig: (a, b) => G.createBattleConfig(a, b, G.DEFAULT_PROFILE, moves, data.standardMovesets, pokemon),
  activeMetaRankingSource: () => ({ metadata: { simulationSettings: settings } }),
  metaRankingDatasetEntry: id => ({ build: builds.get(id) }),
  statsForIvSpread: (p, a, d, h) => {
    const stats = G.statsForIvSpread(p, a, d, h);
    return { ...stats, cpm: stats.attack / (p.atk + a) };
  }
};
vm.createContext(context);
vm.runInContext(helper, context);
const fields = ["ivAtk", "ivDef", "ivHp", "level", "cp", "attack", "defense", "maxHp", "hp", "energy", "cpm", "baiting", "shieldMode"];
for (const id of ids) {
  const opponent = "electrode_hisuian";
  const actual = context.createMetaRankingBattleConfig(pokemon.get(id), pokemon.get(opponent));
  const expected = G.createBattleConfig(pokemon.get(id), pokemon.get(opponent), G.RANK1_PROFILE, moves, data.standardMovesets, pokemon);
  for (const side of ["left", "right"]) for (const field of fields) assert.equal(actual[side][field], expected[side][field], `${id} ${side} ${field}`);
}
settings = undefined;
const fallback = context.createMetaRankingBattleConfig(pokemon.get("mimikyu"), pokemon.get("electrode_hisuian"));
assert.equal(fallback.left.ivDef, G.defaultStats(pokemon.get("mimikyu")).ivDef);
settings = { ivProfile: "rank1" };
builds.delete("mimikyu");
assert.throws(() => context.createMetaRankingBattleConfig(pokemon.get("mimikyu"), pokemon.get("electrode_hisuian")), /Rank 1 build unavailable/);
// Seasonal published moves may differ from the older global defaults. The
// card and quick preview must show the moves that produced the saved score.
context.standardMovesetFor = p => p.id === "morpeko_full_belly"
  ? { fast: "CHARGE_BEAM", charged: ["AURA_WHEEL_ELECTRIC", "PSYCHIC_FANGS"] } : data.standardMovesets[p.id];
context.moveMap = moves;
context.selectedChargedMoveLimit = () => 2;
context.metaMovesForPokemon = () => { throw new Error("Unexpected fallback to global moves"); };
context.findPokemon = id => pokemon.get(id);
context.window = { PvPeakRankingDetails: require("../src/analysis/ranking-details") };
vm.runInContext(html.slice(html.indexOf("    function metaRankingMoves("), html.indexOf("    function setupMetaMobileToolbar(")), context);
vm.runInContext(html.slice(html.indexOf("    function metaOfflineRankingEntry("), html.indexOf("    function greatLeagueMetaPool(")), context);
const published = { id: "morpeko_full_belly", displayScore: 777, moveset: { fast: "BITE", charged: ["AURA_WHEEL_ELECTRIC", "PSYCHIC_FANGS"] } };
const card = context.metaOfflineRankingEntry(published, 4, 397320);
assert.equal(card.moves.fast.id, "BITE");
assert.equal(card.movesetScoreStale, false);
console.log("Meta ranking config tests passed: exact saved IVs/stats, forms, shields and legacy defaults.");
