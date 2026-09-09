"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Season = require("../src/season/season-context.js");
const Promotion = require("../src/season/season-promotion.js");
const PromotionTool = require("./season-promotion.js");

const root = path.resolve(__dirname, "..");
function loadWindow(relative, name) {
  const context = { window: {}, console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), context, { filename: relative });
  return context.window[name] || context[name];
}

const gameMaster = loadWindow("battle-data.js", "BATTLE_GAMEMASTER");
const catalog = loadWindow("data/seasons/season-catalog.js", "BATTLE_SEASON_CATALOG");
const draft = loadWindow("data/seasons/next-season.js", "BATTLE_NEXT_SEASON");

assert.deepEqual(Promotion.validateFinalPreview(draft, gameMaster, { requireGenerated: false }).errors, []);
const provisionalFixture = { ...draft, moveOverrides: { ...draft.moveOverrides, AIR_CUTTER: { ...draft.moveOverrides.AIR_CUTTER, status: "estimated" } } };
const provisional = Promotion.validateFinalPreview(provisionalFixture, gameMaster, { requireGenerated: false });
assert(provisional.errors.some(error => error.startsWith("PREVIEW_MOVE_UNCONFIRMED:")), "Unconfirmed provisional values must block promotion.");

const unresolved = Promotion.applyConfirmedCorrections(draft, {
  moves: { AIR_CUTTER: { power: null } }
}, { confirmUnchanged: true });
const unresolvedValidation = Promotion.validateFinalPreview(unresolved, gameMaster, { requireGenerated: false });
assert(unresolvedValidation.errors.includes("PREVIEW_MOVE_VALUE_UNRESOLVED:AIR_CUTTER:power"), "Null official values must block promotion.");

const confirmed = Promotion.applyConfirmedCorrections(draft, { confirmUnchanged: true }, { confirmUnchanged: true });
const finalValidation = Promotion.validateFinalPreview(confirmed, gameMaster, { requireGenerated: false });
assert.deepEqual(finalValidation.errors, [], "Confirming unchanged provisional values should produce a valid final dataset.");

const promotedCatalog = Promotion.buildPromotedCatalog(catalog, confirmed);
assert.equal(promotedCatalog.current.id, "twilight-trails");
assert.equal(promotedCatalog.next, null);

const storage = new Map([[Season.STORAGE_KEY, "twilight-trails"]]);
const promotedContext = Season.create({
  catalog: promotedCatalog,
  gameMaster: finalValidation.resolvedGameMaster,
  rankings: { entries: [] },
  rankingDetails: { entries: {} },
  location: { search: "?season=twilight-trails" },
  storage
});
assert.equal(promotedContext.activeSeasonData.id, "twilight-trails");
assert.equal(promotedContext.activeSeasonData.status, "current");
assert.equal(promotedContext.previewAvailable, false);
assert.equal(promotedContext.selectionWasInvalid, false, "The promoted season id remains valid as Current Season.");
assert.equal(promotedContext.persist("twilight-trails"), "twilight-trails");

const simulated = PromotionTool.run({ mode: "simulate", allowProvisional: true });
assert.equal(simulated.simulatedCurrentAfter, "twilight-trails");
assert.equal(simulated.simulatedNextAfter, null);
assert.equal(simulated.writesPerformed, false);

const futureCatalog = {
  schemaVersion: 1,
  current: promotedCatalog.current,
  next: { ...draft, enabled: true, id: "future-season", label: "Future Season", dataVersion: "future-draft-1", generated: { rankings: { entries: [] }, rankingDetails: { entries: {} } } }
};
const futureContext = Season.create({
  catalog: futureCatalog,
  gameMaster,
  rankings: { entries: [] },
  rankingDetails: { entries: {} },
  location: { search: "?season=future-season" },
  validation: { requireGenerated: false }
});
assert.equal(futureContext.previewAvailable, true, "A future preview must remain supported after promotion.");
assert.equal(futureContext.activeSeasonData.status, "preview");

console.log("Season promotion preparation tests passed.");
