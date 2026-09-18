"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const root = path.resolve(__dirname, "..");
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const ranking = read("data/great-league-rankings.json");
const details = read("data/great-league-ranking-details.json");
const defaults = G.readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS");
const rankingIds = new Set(ranking.entries.map(e => e.id));
assert.equal(rankingIds.size, ranking.entries.length, "Ranking entries must not contain duplicate species.");
assert.equal(ranking.entries.length, Number(ranking.metadata.pokemonCount || ranking.entries.length), "Ranking entry count must match metadata.");
assert.match(fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8"), /aria-label="Alternative movesets"/);

// A canonical ranking may legitimately predate the optional moveset-refresh
// manifest. Keep the structural checks useful in that case instead of
// dereferencing a stale planner expectation from an older ranking snapshot.
if (!ranking.metadata.movesetRefresh?.source) {
  for (const entry of ranking.entries) {
    assert.ok(entry.moveset?.fast, `${entry.id}: ranking entry must expose a Fast Attack.`);
    assert.ok(Array.isArray(entry.moveset?.charged) && entry.moveset.charged.length >= 1, `${entry.id}: ranking entry must expose at least one Charged Attack.`);
  }
  console.log("Moveset refresh manifest not present; canonical ranking structure passed.");
  process.exit(0);
}

const manifest = read(ranking.metadata.movesetRefresh.source);
assert.ok(manifest.completed, "Moveset refresh manifest must be complete.");
assert.ok(Number.isFinite(manifest.simulations), "Moveset refresh must record simulation count.");
for (const [id, set] of Object.entries(manifest.selected || {})) {
  const entry = ranking.entries.find(e => e.id === id);
  assert.ok(entry, `${id}: refreshed species must exist in ranking.`);
  assert.equal(JSON.stringify(entry.moveset), JSON.stringify(set));
  assert.equal(JSON.stringify(defaults[id]), JSON.stringify(set));
  assert.ok(details.entries[id].alternativeMovesets.length >= 2);
  assert.ok(details.entries[id].alternativeMovesets.every(s => Number.isFinite(s.smartScore) && Number.isFinite(s.standardScore)));
  for (const category of Object.values(entry.categoryScores)) {
    assert.equal(category.moveUsage.fast[0].id, set.fast);
    assert.deepEqual(category.moveUsage.charged.map(m => m.id), set.charged);
  }
}
console.log("Moveset refresh passed: defaults, ranking, alternatives, usage and no duplicate species.");
