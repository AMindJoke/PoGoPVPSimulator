const assert = require("node:assert/strict");
const Season = require("../src/season/season-context.js");

const gm = Object.freeze({ moves: Object.freeze([
  Object.freeze({ moveId: "FAST", power: 3, energyGain: 8 }),
  Object.freeze({ moveId: "CHARGE", power: 80, energy: -45 })
]), pokemon: [] });
const current = { id: "live-a", label: "Current Season", dataVersion: "gm-a", rankingVersion: "rank-a" };
const preview = {
  id: "preview-b", label: "Next Season", dataVersion: "gm-b", rankingVersion: "rank-b", enabled: true,
  moveOverrides: { FAST: { energyGain: 9, status: "estimated", note: "Announced energy increase" } },
  generated: { rankings: { entries: ["next"] }, rankingDetails: { entries: { next: true } } }
};
const storage = { value: "preview-b", getItem() { return this.value; }, setItem(_key, value) { this.value = value; } };
const context = Season.create({ catalog: { schemaVersion: 1, current, next: preview }, gameMaster: gm, rankings: { entries: ["current"] }, rankingDetails: { entries: {} }, storage, location: { search: "" } });
assert.equal(context.previewAvailable, true);
assert.equal(context.activeSeasonData.status, "preview");
assert.equal(context.activeSeasonData.gameMaster.moves[0].energyGain, 9);
assert.equal(gm.moves[0].energyGain, 8, "Preview overrides must not mutate Current Season data.");
assert.deepEqual(context.activeSeasonData.moveMetadata.FAST, { status: "estimated", note: "Announced energy increase" });
assert.match(context.cacheIdentity("engine-v1"), /^preview-b:gm-b:engine-v1$/);

const urlCurrent = Season.create({ catalog: { schemaVersion: 1, current, next: preview }, gameMaster: gm, storage, location: { search: "?season=live-a" } });
assert.equal(urlCurrent.activeSeasonData.status, "current", "Explicit URL state must win over the persisted preference.");
assert.strictEqual(urlCurrent.activeSeasonData.gameMaster, gm, "Current data should not be cloned or rewritten.");

const unavailable = Season.create({ catalog: { schemaVersion: 1, current, next: { ...preview, generated: null } }, gameMaster: gm, storage, location: { search: "?season=preview-b" } });
assert.equal(unavailable.previewAvailable, false);
assert.equal(unavailable.activeSeasonData.id, "live-a");
assert(unavailable.errors.includes("PREVIEW_GENERATED_OUTPUTS_MISSING"));

assert(Season.validatePreview({ ...preview, moveOverrides: { MISSING: { power: 1, status: "confirmed" } } }, gm).includes("PREVIEW_MOVE_UNKNOWN:MISSING"));
assert(Season.validatePreview({ ...preview, moveOverrides: { FAST: { energyGain: 9, status: "estimated" } } }, gm).includes("PREVIEW_MOVE_ESTIMATE_NOTE_MISSING:FAST"));
assert(Season.validateCatalog({ schemaVersion: 1, current, next: { ...preview, id: current.id } }, gm).includes("SEASON_IDS_DUPLICATE"));

console.log("Season context tests passed.");
