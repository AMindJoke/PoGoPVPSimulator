"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Season = require("../src/season/season-context.js");

const root = path.resolve(__dirname, "..");
const browser = { console };
browser.window = browser;
browser.globalThis = browser;
vm.createContext(browser);
for (const relative of [
  "battle-data.js",
  "default-movesets.js",
  "data/great-league-rankings.js",
  "data/great-league-ranking-details.js",
  "data/seasons/next-season.js",
  "data/seasons/season-catalog.js"
]) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), browser, { filename: relative });
}

const currentBodySlam = browser.BATTLE_GAMEMASTER.moves.find(move => move.moveId === "BODY_SLAM");
const context = Season.create({
  catalog: browser.BATTLE_SEASON_CATALOG,
  gameMaster: browser.BATTLE_GAMEMASTER,
  defaultMovesets: browser.BATTLE_DEFAULT_MOVESETS,
  rankings: browser.GREAT_LEAGUE_RANKINGS,
  rankingDetails: browser.GREAT_LEAGUE_RANKING_DETAILS,
  location: { search: "?season=twilight-trails" }
});

assert.equal(context.previewAvailable, false);
assert.equal(context.activeSeasonData.id, "twilight-trails");
assert.equal(context.activeSeasonData.status, "current");
assert.equal(context.activeSeasonData.rankings.entries.length, 1542);
assert.equal(Object.keys(context.activeSeasonData.rankingDetails.entries).length, 1542);
assert.equal(context.activeSeasonData.rankings.metadata.seasonId, "twilight-trails");
assert.equal(context.activeSeasonData.rankings.metadata.dataVersion, "twilight-trails-confirmed-1");
const ranking = context.activeSeasonData.rankings;
const expectedCells = ranking.entries.length * (ranking.entries.length - 1) * 3;
assert.equal(ranking.metadata.completedSimulations, expectedCells);
assert.equal(ranking.metadata.cells, expectedCells);
assert.equal(ranking.metadata.matchupCache.hits, expectedCells);
assert.equal(ranking.metadata.matchupCache.misses, 0);
assert.equal(ranking.metadata.mergedFromChunks, undefined, "Weights must be finalized over the full field.");
assert.equal(new Set(ranking.entries.map(entry => entry.id)).size, ranking.entries.length);
for (const entry of ranking.entries) {
  assert.equal(entry.matchups, (ranking.entries.length - 1) * 3);
  assert.ok(context.activeSeasonData.rankingDetails.entries[entry.id]);
}
assert.equal(context.activeSeasonData.rankings.metadata.weightMode, "competitive");
assert.match(context.activeSeasonData.rankings.metadata.weightSource, /great-league-rankings-iteration-1\.json$/);
assert.equal(context.activeSeasonData.rankingDetails.sourceRankingGeneratedAt, context.activeSeasonData.rankings.metadata.generatedAt);
assert.equal(context.activeSeasonData.gameMaster.moves.find(move => move.moveId === "BODY_SLAM").energy, 40);
assert.equal(context.activeSeasonData.defaultMovesets.houndoom.fast, "INCINERATE");
assert.equal(currentBodySlam.energy, 40, "Confirmed move values must be canonical.");
for (const requested of ["", "?season=current-2026-06-28", "?season=twilight-trails", "?season=unknown"]) {
  const resolved = Season.create({ catalog: browser.BATTLE_SEASON_CATALOG, gameMaster: browser.BATTLE_GAMEMASTER,
    rankings: browser.GREAT_LEAGUE_RANKINGS, rankingDetails: browser.GREAT_LEAGUE_RANKING_DETAILS,
    location: { search: requested }, storage: { getItem: () => "current-2026-06-28" } });
  assert.equal(resolved.activeSeasonData.id, "twilight-trails");
  assert.equal(resolved.activeSeasonData.status, "current");
  assert.equal(resolved.previewAvailable, false);
  assert.equal(resolved.errors.length, 0);
}
assert.equal(context.errors.length, 0);

console.log("Twilight Trails runtime integration tests passed.");
