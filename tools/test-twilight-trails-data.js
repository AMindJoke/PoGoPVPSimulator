"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Season = require("../src/season/season-context.js");

const browser = {};
browser.window = browser;
browser.globalThis = browser;
vm.createContext(browser);
for (const relative of ["battle-data.js", "data/seasons/next-season.js", "data/seasons/season-catalog.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", relative), "utf8"), browser, { filename: relative });
}
const gm = browser.BATTLE_GAMEMASTER;
const draft = browser.BATTLE_NEXT_SEASON;
assert.equal(draft.id, "twilight-trails");
assert.equal(draft.enabled, false, "The preview must stay unavailable while official numeric fields are pending.");
assert.equal(draft.pendingValues.length, 18);
assert.deepEqual(Season.validateCatalog(browser.BATTLE_SEASON_CATALOG, gm), []);

const runnablePreview = {
  ...draft,
  enabled: true,
  pendingValues: [],
  generated: { rankings: { entries: [] }, rankingDetails: { entries: {} } }
};
const context = Season.create({
  catalog: { schemaVersion: 1, current: browser.BATTLE_SEASON_CATALOG.current, next: runnablePreview },
  gameMaster: gm,
  rankings: { entries: ["current"] },
  rankingDetails: { entries: {} },
  location: { search: "?season=twilight-trails" }
});
assert.equal(context.activeSeasonData.status, "preview");
const currentMove = id => gm.moves.find(move => move.moveId === id);
const previewMove = id => context.activeSeasonData.gameMaster.moves.find(move => move.moveId === id);
assert.equal(currentMove("LUNGE").power, 60);
assert.equal(previewMove("LUNGE").power, 70);
assert.equal(previewMove("BULLDOZE").power, 80);
assert.equal(previewMove("BULLDOZE").buffApplyChance, 1);
assert.equal(previewMove("DRAINING_KISS").power, 80);
assert.deepEqual(Array.from(previewMove("DRAINING_KISS").buffs), [0, 1]);

const pokemon = id => context.activeSeasonData.gameMaster.pokemon.find(entry => entry.speciesId === id);
assert(pokemon("volbeat").fastMoves.includes("INFESTATION"));
assert(pokemon("volbeat").chargedMoves.includes("LUNGE"));
assert(pokemon("muk_alolan_shadow").chargedMoves.includes("ICE_PUNCH"));
assert(pokemon("aerodactyl_mega").chargedMoves.includes("BRUTAL_SWING"));
assert(pokemon("skarmory_shadow").chargedMoves.includes("DRILL_RUN"));
assert(pokemon("toxtricity_low_key").chargedMoves.includes("SWIFT"));
assert(!gm.pokemon.find(entry => entry.speciesId === "volbeat").chargedMoves.includes("LUNGE"), "Availability overrides must not mutate Current Season.");

console.log("Twilight Trails draft data tests passed.");
