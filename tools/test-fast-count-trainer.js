"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const trainer = require("../src/training/fast-count-trainer");
const engine = require("../src/training/fast-count-engine");

const root = path.resolve(__dirname, "..");

function loadWindowScript(file) {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  return context.window;
}

const gameMaster = loadWindowScript("battle-data.js").BATTLE_GAMEMASTER;
const defaultMovesets = loadWindowScript("default-movesets.js").BATTLE_DEFAULT_MOVESETS;
const rankings = JSON.parse(fs.readFileSync(path.join(root, "data/great-league-rankings.json"), "utf8"));
const catalog = trainer.createCatalog({ gameMaster, defaultMovesets, rankings, rankingLimit: 150 });

assert(catalog.builds.length >= 100, "Expected a broad current meta training pool.");
assert(catalog.builds.every(build => build.rank <= 150));
assert(catalog.builds.every(build => build.fastMove.energyGain > 0));
assert(catalog.builds.every(build => build.chargedMoves.length >= 1));

const araquanid = catalog.byId.get("araquanid");
assert(araquanid, "Araquanid must remain a permanent regression case in the current meta pool.");
assert.equal(araquanid.fastMove.id, "INFESTATION");
assert.deepEqual(new Set(araquanid.chargedMoves.map(move => move.id)), new Set(["MIRROR_COAT", "WATER_PULSE"]));

const realPatterns = new Map();
for (const build of catalog.builds) {
  if (!realPatterns.has(build.fastMove.energyGain)) realPatterns.set(build.fastMove.energyGain, build);
}
assert(realPatterns.size >= 4, "Trainer should cover several real Fast energy patterns.");
for (const build of [...realPatterns.values()].slice(0, 6)) {
  for (const chargedMove of build.chargedMoves) {
    const exercise = engine.createExercise({
      fastEnergy: build.fastMove.energyGain,
      chargedCost: chargedMove.energyCost,
      currentEnergy: 0,
      fastMove: build.fastMove,
      chargedMove
    });
    assert(exercise.answer >= 0);
    assert(exercise.energyAtThrow >= chargedMove.energyCost);
  }
}

const synthetic = trainer.createCatalog({
  gameMaster: {
    moves: [
      { moveId: "FAST", name: "Fast", type: "normal", energyGain: 7 },
      { moveId: "ONE", name: "One", type: "normal", energy: 30 },
      { moveId: "TWO", name: "Two", type: "normal", energy: 45 },
      { moveId: "THREE", name: "Three", type: "normal", energy: 60 }
    ],
    pokemon: [{ speciesId: "test", speciesName: "Test", dex: 1, types: ["normal"], fastMoves: ["FAST"], chargedMoves: ["ONE", "TWO", "THREE"] }]
  },
  defaultMovesets: { test: { fast: "FAST", charged: ["ONE", "TWO", "THREE"] } },
  rankings: { entries: [{ id: "test", rank: 1, profile: "rank1" }] }
});
assert.equal(synthetic.builds[0].chargedMoves.length, 3, "Catalog must not assume exactly two Charged Moves.");

const first = trainer.weightedPick([
  { id: "one", weight: 10 },
  { id: "two", weight: 1 }
], () => 0);
assert.equal(first.id, "one");
const excluding = trainer.weightedPick([
  { id: "one", weight: 10 },
  { id: "two", weight: 1 }
], () => 0, "one");
assert.equal(excluding.id, "two");

console.log(`Fast Count Trainer data tests passed (${catalog.builds.length} current meta builds, ${realPatterns.size} Fast energy patterns).`);
