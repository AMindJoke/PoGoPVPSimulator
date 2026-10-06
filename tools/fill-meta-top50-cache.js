"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const { MATCHUP_SCORE_VERSION } = require("../src/analysis/matchup-inspector");
const root = path.resolve(__dirname, "..");
const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1) || fallback;

function fill(options) {
  const cacheRoot = path.resolve(root, options.cacheRoot);
  const relative = path.relative(path.join(root, "reports"), cacheRoot);
  assert.ok(!relative.startsWith("..") && !path.isAbsolute(relative), "Cache must be inside reports.");
  const ranking = JSON.parse(fs.readFileSync(path.resolve(root, options.ranking), "utf8"));
  assert.equal(ranking.metadata.matrixVersion, G.MATRIX_VERSION);
  const data = G.generationData(ranking.metadata.seasonId);
  assert.equal(G.movesetHash(data.standardMovesets), ranking.metadata.movesetHash);
  const moves = new Map(data.gameMaster.moves.map(move => [move.moveId, G.normalizeMove(move)]));
  const pokemon = new Map(data.gameMaster.pokemon.filter(p => p?.speciesId && p.baseStats)
    .map(p => G.normalizePokemon(p, moves)).map(p => [p.id, p]));
  const entries = [...ranking.entries].sort((a, b) => a.rank - b.rank);
  const opponents = entries.slice(0, 50);
  const selected = entries.slice(options.offset || 0, options.limit ? (options.offset || 0) + options.limit : undefined);
  const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true, native: true, strict: true });
  let simulations = 0, reused = 0;
  for (const [index, entry] of selected.entries()) {
    const file = path.join(cacheRoot, "rank1", `${entry.id}.json`);
    const cache = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(cache.matrixVersion, G.MATRIX_VERSION);
    assert.equal(cache.scoreVersion, MATCHUP_SCORE_VERSION);
    const attacker = G.createCombatant(pokemon.get(entry.id), "A", G.RANK1_PROFILE, moves, data.standardMovesets, pokemon);
    assert.equal(cache.attackerSignature, G.combatantStateSignature(attacker));
    let changed = false;
    for (const opponent of opponents) {
      if (opponent.id === entry.id) continue;
      const config = G.createBattleConfig(pokemon.get(entry.id), pokemon.get(opponent.id), G.RANK1_PROFILE, moves, data.standardMovesets, pokemon);
      const key = `${G.combatantStateSignature(config.right)}|1-1|standard`;
      if (cache.cells[key]) { reused++; continue; }
      const result = adapter.simulate({ id: ++simulations, key, source: "offline-ranking", config, aShields: 1, bShields: 1, includeSwing: false });
      assert.ok(Number.isFinite(result.score), `${entry.id}: non-finite score`);
      cache.cells[key] = G.compactCacheResult(G.compactResult(result, entry.id, opponent.id));
      changed = true;
    }
    if (changed) {
      cache.generatedAt = new Date().toISOString();
      fs.writeFileSync(file, `${JSON.stringify(cache)}\n`);
    }
    if ((index + 1) % 100 === 0 || index + 1 === selected.length) console.log(`Top 50 coverage: ${index + 1}/${selected.length}; ${simulations} simulated, ${reused} reused.`);
  }
  return { simulations, reused, entries: selected.length };
}

if (require.main === module) fill({ ranking: option("--ranking", ""), cacheRoot: option("--cache-root", ""), offset: Number(option("--offset", "0")), limit: Number(option("--limit", "0")) });
module.exports = { fill };
