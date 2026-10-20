"use strict";
const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const Ranking = require("../src/analysis/ranking-details");
const Analysis = require("../src/team-builder/team-builder-analysis");
const fs = require("node:fs");
const vm = require("node:vm");
const data = G.generationData("twilight-trails");
const moves = new Map(data.gameMaster.moves.map(move => [move.moveId, G.normalizeMove(move)]));
const pokemon = new Map(data.gameMaster.pokemon.filter(p => p?.speciesId && p.baseStats)
  .map(p => G.normalizePokemon(p, moves)).map(p => [p.id, p]));
const realPokemon = [...pokemon.values()];
G.addRankingVariants(pokemon, data.standardMovesets);
const rows = [];
for (const id of ["houndoom", "houndoom_shadow"]) {
  const variantId = `${id}__flamethrower`;
  assert.equal(realPokemon.some(p => p.id === variantId), false, "Variants must not become selectable species.");
  const main = G.createCombatant(pokemon.get(id), "A", G.RANK1_PROFILE, moves, data.standardMovesets, pokemon);
  const variant = G.createCombatant(pokemon.get(variantId), "A", G.RANK1_PROFILE, moves, data.standardMovesets, pokemon);
  assert.equal(main.p.id, id);
  assert.equal(variant.p.id, id, "The worker must still simulate the real Pokemon.");
  assert.deepEqual(main.charged.map(m => m.id), ["FOUL_PLAY", "TRAILBLAZE"]);
  assert.deepEqual(variant.charged.map(m => m.id), ["FOUL_PLAY", "FLAMETHROWER"]);
  assert.equal(variant.shadowAtkMult, main.shadowAtkMult);
  assert.equal(variant.shadowDefMult, main.shadowDefMult);
  assert.equal(variant.attack, main.attack);
  assert.equal(variant.defense, main.defense);
  assert.equal(variant.hp, main.hp);
  assert.notEqual(G.combatantStateSignature(main), G.combatantStateSignature(variant), "Movesets require distinct cache signatures.");
  rows.push({ id, profile: "rank1", rank: rows.length + 1, competitiveScore: 500 },
    { id: variantId, pokemonId: id, variantId: "flamethrower", profile: "rank1", rank: rows.length + 2, competitiveScore: 510 });
}
const visible = Ranking.buildOverallRankingEntries(rows, [], {}, id => realPokemon.find(p => p.id === id), "rank1");
assert.equal(visible.length, 4, "Both real movesets must survive ranking deduplication.");
assert.equal(new Set(visible.map(row => row.id)).size, 4);
assert.deepEqual(Analysis.rankedOptimizationPokemon(realPokemon, rows).map(p => p.id).sort(), ["houndoom", "houndoom_shadow"],
  "Team Builder must not suggest ranked moveset rows as separate team members.");
const html = fs.readFileSync(require("node:path").join(__dirname, "../PogoPvp.html"), "utf8");
const lookup = html.slice(html.indexOf("    function metaRankingMoves("), html.indexOf("    function setupMetaMobileToolbar("));
const context = { moveMap: moves, standardMovesetFor: () => ({ metaOverride: true, fast: "INCINERATE", charged: ["FOUL_PLAY", "TRAILBLAZE"] }),
  selectedChargedMoveLimit: () => 2, metaMovesForPokemon: () => { throw new Error("Unexpected fallback"); } };
vm.createContext(context);
vm.runInContext(lookup, context);
const selected = context.metaRankingMoves({ variantId: "flamethrower", moveset: {
  fast: "INCINERATE", charged: ["FOUL_PLAY", "FLAMETHROWER"] } }, pokemon.get("houndoom"));
assert.deepEqual(Array.from(selected.charged, move => move.id), ["FOUL_PLAY", "FLAMETHROWER"],
  "An explicit ranking variant must override the species default in previews.");
console.log("Ranked moveset variants passed: real identity, Shadow modifiers, IVs, cache signatures, four ranking rows and two candidates.");
