"use strict";
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const ranking = read("data/great-league-rankings.json");
const approved = read(ranking.metadata.weightSource);
const details = read("data/great-league-ranking-details.json");
assert.equal(ranking.metadata.scoreVersion, "resource-score-v4");
assert.equal(details.scoreVersion, ranking.metadata.scoreVersion);
assert.equal(details.sourceRankingGeneratedAt, ranking.metadata.generatedAt);
assert.deepEqual(ranking.entries.map(e => [e.id, e.rank, e.overallScore]), approved.entries.map(e => [e.id, e.rank, e.overallScore]));
assert.deepEqual(read("data/rankings/great-league-full.json"), ranking);
for (const [file, name, expected] of [["data/great-league-rankings.js", "GREAT_LEAGUE_RANKINGS", ranking], ["data/great-league-ranking-details.js", "GREAT_LEAGUE_RANKING_DETAILS", details]]) {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.window[name])), expected);
}
const byId = new Map(ranking.entries.map(e => [e.id, e]));
const expectedMatchups = (ranking.entries.length - 1) * 3;
for (const entry of ranking.entries) {
  assert.equal(entry.matchups, expectedMatchups);
  assert.equal(entry.wins + entry.losses + entry.ties, entry.matchups);
  assert.equal(entry.overallScore, entry.competitiveScore);
  for (const row of details.entries[entry.id].wins) { assert.ok(row.score > 500); assert.equal(row.rank, byId.get(row.id).rank); }
  for (const row of details.entries[entry.id].losses) { assert.ok(row.score < 500); assert.equal(row.rank, byId.get(row.id).rank); }
}
console.log(`Approved ranking publication passed: ${ranking.entries.length} entries, aliases, details and provenance.`);
