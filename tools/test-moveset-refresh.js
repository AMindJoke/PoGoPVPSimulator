"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const root = path.resolve(__dirname, "..");
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const ranking = read("data/great-league-rankings.json");
const manifest = read(ranking.metadata.movesetRefresh.source);
const details = read("data/great-league-ranking-details.json");
const defaults = G.readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS");
assert.equal(manifest.simulations, 27720);
assert.equal(new Set(ranking.entries.map(e => e.id)).size, 1542);
for (const [id, set] of Object.entries(manifest.selected)) {
  const entry = ranking.entries.find(e => e.id === id);
  assert.equal(JSON.stringify(entry.moveset), JSON.stringify(set));
  assert.equal(JSON.stringify(defaults[id]), JSON.stringify(set));
  assert.ok(details.entries[id].alternativeMovesets.length >= 2);
  assert.ok(details.entries[id].alternativeMovesets.every(s => Number.isFinite(s.smartScore) && Number.isFinite(s.standardScore)));
  for (const category of Object.values(entry.categoryScores)) {
    assert.equal(category.moveUsage.fast[0].id, set.fast);
    assert.deepEqual(category.moveUsage.charged.map(m => m.id), set.charged);
  }
}
assert.match(fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8"), /aria-label="Alternative movesets"/);
console.log("Moveset refresh passed: defaults, ranking, alternatives, usage and no duplicate species.");
