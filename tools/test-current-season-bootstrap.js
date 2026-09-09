"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
const stop = scripts.findIndex(file => file.startsWith("src/season/season-context.js"));
assert.ok(stop >= 0);
for (const [search, stored] of [["", ""], ["", "twilight-trails"], ["", "current-2026-06-28"],
  ["?season=twilight-trails", ""], ["?season=current-2026-06-28", "twilight-trails"]]) {
  const loaded = [];
  const browser = { console, URLSearchParams, location: { search }, localStorage: { getItem: () => stored } };
  browser.window = browser;
  browser.globalThis = browser;
  const context = vm.createContext(browser);
  function load(url) {
    const file = url.split("?")[0];
    loaded.push(file);
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
  browser.document = { write(markup) {
    for (const match of markup.matchAll(/<script src="([^"]+)"/g)) load(match[1]);
  } };
  scripts.slice(0, stop + 1).forEach(load);
  const season = browser.PvPeakSeasonContext.create({ catalog: browser.BATTLE_SEASON_CATALOG,
    gameMaster: browser.BATTLE_GAMEMASTER, defaultMovesets: browser.BATTLE_DEFAULT_MOVESETS,
    rankings: browser.GREAT_LEAGUE_RANKINGS, rankingDetails: browser.GREAT_LEAGUE_RANKING_DETAILS,
    location: browser.location, storage: browser.localStorage });
  assert.equal(season.errors.length, 0);
  assert.equal(season.previewAvailable, false);
  assert.equal(season.next, null);
  assert.equal(season.activeSeasonData.id, "twilight-trails");
  assert.equal(season.activeSeasonData.status, "current");
  assert.equal(season.activeSeasonData.rankings.entries.length, 1542);
  assert.equal(season.activeSeasonData.rankings.entries[0].overallScore, 591);
  assert.equal(season.activeSeasonData.rankings.metadata.scoreVersion, "resource-score-v4");
  assert.equal(season.activeSeasonData.gameMaster.moves.find(move => move.moveId === "BODY_SLAM").energy, 40);
  assert.equal(season.activeSeasonData.defaultMovesets.houndoom.fast, "INCINERATE");
  assert.ok(!loaded.some(file => file.startsWith("data/seasons/twilight-trails/")), "Current must load canonical assets directly.");
}
console.log("Current season HTML bootstrap tests passed (5 URL/storage combinations).");
