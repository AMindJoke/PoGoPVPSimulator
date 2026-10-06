"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const G = require("./build-great-league-meta-database");
const { verifyBundle, verifyPublished } = require("./refresh-current-meta");

const root = path.resolve(__dirname, "..");
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const ranking = read("data/great-league-rankings.json");
const details = read("data/great-league-ranking-details.json");
const seed = read("data/great-league-meta.json");
const sourceData = G.generationData("twilight-trails");
const first = ranking.entries[0].id;

verifyPublished(sourceData);
assert.equal(verifyBundle(ranking, details, seed, sourceData).length, ranking.entries.length);

const staleRanking = { ...ranking, metadata: { ...ranking.metadata, movesetHash: "old" } };
assert.throws(() => verifyBundle(staleRanking, details, seed, sourceData), /moveset hash is stale/);
assert.throws(() => verifyBundle({ ...ranking, metadata: { ...ranking.metadata, simulationSettings: undefined } }, details, seed, sourceData), /simulation settings/);
assert.throws(() => verifyBundle({ ...ranking, entries: ranking.entries.map((entry, index) => index ? entry : { ...entry, build: null }) }, details, seed, sourceData), /invalid saved build/);

const staleDetails = { ...details, entries: { ...details.entries,
  [first]: { ...details.entries[first], top50Coverage: 0 }
} };
assert.throws(() => verifyBundle(ranking, staleDetails, seed, sourceData), /incomplete top 50 cache/);

const wrongRank = { ...details, entries: { ...details.entries,
  [first]: { ...details.entries[first], wins: [{ id: ranking.entries[1].id, rank: -1, score: 700 }] }
} };
assert.throws(() => verifyBundle(ranking, wrongRank, seed, sourceData), /stale wins rank/);

assert.throws(() => verifyBundle(ranking, details,
  { ...seed, pokemon: [...seed.pokemon.slice(0, -1), seed.pokemon[0]] }, sourceData), /Duplicate meta opponents/);

// Replay published wins and losses through the canonical VM adapter, independently
// of the native offline generation cache. Include the best 20 and spread samples.
const moves = new Map(sourceData.gameMaster.moves.map(move => [move.moveId, G.normalizeMove(move)]));
const pokemon = new Map(sourceData.gameMaster.pokemon.filter(p => p?.speciesId && p.baseStats)
  .map(p => G.normalizePokemon(p, moves)).map(p => [p.id, p]));
const entries = [...ranking.entries].sort((a, b) => a.rank - b.rank);
const sample = [...new Set([...entries.slice(0, 20), ...entries.filter((_, index) => index % 100 === 0)])];
const byId = new Map(entries.map(entry => [entry.id, entry]));
const worker = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true, strict: true });
let count = 0;
for (const entry of sample) {
  const detail = details.entries[entry.id];
  for (const row of [...detail.wins.slice(0, 2), ...detail.losses.slice(0, 2)]) {
    const config = G.createBattleConfig(pokemon.get(entry.id), pokemon.get(row.id), G.RANK1_PROFILE,
      moves, sourceData.standardMovesets, pokemon);
    for (const [side, id] of [["left", entry.id], ["right", row.id]]) {
      const build = byId.get(id).build;
      for (const field of ["ivAtk", "ivDef", "ivHp", "level", "cp"]) {
        assert.equal(config[side][field], build[field], `${id}: published build differs from generation`);
      }
    }
    const result = worker.simulate({ id: ++count, key: `${entry.id}:${row.id}`, source: "meta-quick-matchup",
      config, aShields: 1, bShields: 1, includeSwing: false });
    assert.equal(result.score, row.score, `${entry.id}/${row.id}: saved score differs from canonical replay`);
  }
}
console.log(`Current meta release checks passed: all ${entries.length} entries and ${count} canonical saved-score replays.`);
