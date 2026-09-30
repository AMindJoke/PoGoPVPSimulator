"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { overallScore, buildOverallRankingEntries, movesetScoreStale } = require("../src/analysis/ranking-details");
const { normalizePokemonAnalysisViewModel } = require("../src/analysis/pokemon-analysis-view-model");
const { PokemonHeroCard } = require("../src/ui/pokemon-analysis");

assert.equal(overallScore({ competitiveScore: 928, metaViabilityScore: 949 }, { candidatePriorWeight: .3 }), 949);
assert.equal(overallScore({ competitiveScore: 928, metaViabilityScore: 949 }), 928);
assert.equal(overallScore({ competitiveScore: 0, overallScore: 900 }), 0, "Zero is a valid score, not a missing value.");
assert.equal(overallScore({ competitiveScore: "invalid", overallScore: 700 }), 700);

const root = path.resolve(__dirname, "..");
const browser = {};
browser.window = browser;
vm.createContext(browser);
vm.runInContext(fs.readFileSync(path.join(root, "battle-data.js"), "utf8"), browser);
const pokemon = new Map(browser.BATTLE_GAMEMASTER.pokemon.map(p => [p.speciesId, p]));
const resolve = id => pokemon.get(id);
const source = [
  { id: "cradily_b", profile: "rank1", rank: 1, competitiveScore: 900 },
  { id: "cradily", profile: "rank1", rank: 2, competitiveScore: 800 },
  { id: "cradily_shadow", profile: "rank1", rank: 3, competitiveScore: 700 }
];
const rows = buildOverallRankingEntries(source, [], {}, resolve, "rank1");
assert.deepEqual(rows.map(row => row.id), ["cradily", "cradily_shadow"], "Cosmetic aliases collapse; Shadow remains distinct.");
assert.deepEqual(rows.map(row => row.rank), [1, 2]);
assert.equal(rows[0].displayScore, 800, "Use the canonical record, not an alias with a different score.");
assert.equal(source[1].rank, 2, "Presentation must not mutate the source dataset.");
const merged = buildOverallRankingEntries(source, [{ id: "cradily", profile: "rank1", competitiveScore: 820, metaViabilityScore: 850 }], { candidatePriorWeight: .3 }, resolve, "rank1");
assert.equal(merged[0].displayScore, 850);

const published = { fast: "CHARGE_BEAM", charged: ["AURA_WHEEL", "PSYCHIC_FANGS"] };
assert.equal(movesetScoreStale(published, { ...published, charged: [...published.charged].reverse() }), false);
assert.equal(movesetScoreStale(published, { ...published, fast: "THUNDER_SHOCK" }), true);
assert.equal(movesetScoreStale(published, { ...published, charged: ["AURA_WHEEL"] }), true);

const model = normalizePokemonAnalysisViewModel({ id: "cradily", rating: merged[0].displayScore, rank: 1, movesetScoreStale: true });
assert.equal(model.identity.rating, 850);
assert.equal(model.identity.movesetScoreStale, true);
const hero = PokemonHeroCard(model);
assert.match(hero, /Overall Meta score/);
assert.match(hero, /Score reflects the previous moveset/);

const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
const legend = html.slice(html.indexOf("    function metaRankingLegend()"), html.indexOf("    function metaStatsForPokemon(p)"));
const legendContext = {
  metaRankingRole: "overall",
  metaRoleRankingAvailable: () => true,
  metaRankingRoleLabel: () => "Lead",
  activeMetaRankingSource: () => ({ metadata: { rankingModel: { mode: "role", candidatePrior: { weight: .3 } } } })
};
vm.createContext(legendContext);
vm.runInContext(legend, legendContext);
assert.match(legendContext.metaRankingLegend(), /Scores blend the role score \(70%\)/);
legendContext.metaRankingRole = "lead";
assert.doesNotMatch(legendContext.metaRankingLegend(), /Scores blend/);
assert.match(legendContext.metaRankingLegend(), /Individual role scores do not include/);
console.log("Ranking presentation tests passed.");
