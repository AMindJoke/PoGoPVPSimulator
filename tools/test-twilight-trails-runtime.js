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
  "data/seasons/twilight-trails/great-league-rankings.js",
  "data/seasons/twilight-trails/great-league-ranking-details.js",
  "data/seasons/twilight-trails/default-movesets.js",
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
  rankings: { entries: ["current-sentinel"] },
  rankingDetails: { entries: {} },
  location: { search: "?season=twilight-trails" }
});

assert.equal(context.previewAvailable, true);
assert.equal(context.activeSeasonData.id, "twilight-trails");
assert.equal(context.activeSeasonData.status, "preview");
assert.equal(context.activeSeasonData.rankings.entries.length, 1541);
assert.equal(Object.keys(context.activeSeasonData.rankingDetails.entries).length, 1541);
assert.equal(context.activeSeasonData.rankings.metadata.seasonId, "twilight-trails");
assert.equal(context.activeSeasonData.rankings.metadata.dataVersion, "twilight-trails-draft-2");
assert.equal(context.activeSeasonData.rankings.metadata.weightMode, "competitive");
assert.match(context.activeSeasonData.rankings.metadata.weightSource, /great-league-rankings-iteration-1\.json$/);
assert.equal(context.activeSeasonData.rankingDetails.sourceRankingGeneratedAt, context.activeSeasonData.rankings.metadata.generatedAt);
assert.equal(context.activeSeasonData.gameMaster.moves.find(move => move.moveId === "BODY_SLAM").energy, 40);
assert.equal(context.activeSeasonData.defaultMovesets.houndoom.fast, "INCINERATE");
assert.equal(currentBodySlam.energy, 35, "Resolving the preview must not mutate Current Season data.");
assert.equal(context.errors.length, 0);

console.log("Twilight Trails runtime integration tests passed.");
