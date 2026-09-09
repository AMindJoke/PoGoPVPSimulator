"use strict";

const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const G = require("./build-great-league-meta-database");
const { createRuntime } = require("./run-battle-regressions");
const { inflateCacheResult, rescoreCachedResult } = require("../src/analysis/matchup-inspector");

const legacy = inflateCacheResult([360, "B", "cradily", 0, 0, -171, -1.8493150684931505, 0, 0, .98, 0, 0, 0, 32]);
assert.equal(legacy.score, 480);
assert.deepEqual(rescoreCachedResult(legacy), legacy, "Legacy migration must be idempotent");
const zeroHpLegacy = inflateCacheResult([671, "A", "a", 0, 0, 171, 0, 0, 0, 0, 0, 0, 0, 0]);
assert.equal(zeroHpLegacy.score, 518, "Zero HP edge alone must not classify an old score as modern");
const modernDraw = inflateCacheResult([500, "tie", null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
assert.equal(modernDraw.score, 500);
const legacyKnownHp = inflateCacheResult([779, "A", "a", .4, 0, 171, 108, 0, 0, 0, 0, 0, 0, 0]);
assert.equal(legacyKnownHp.hpEdge, 180);
assert.equal(legacyKnownHp.score, 698);
assert.deepEqual(rescoreCachedResult(legacyKnownHp), legacyKnownHp);
const precise = inflateCacheResult([390, "B", "mimikyu", 0, .463, -18, -208.33333333333334, 36.8, 0, 61.6, 0, 18, 0, 0]);
assert.equal(precise.score, 390, "Rounded ratios must not cause double HP migration");
const runtime = createRuntime();
const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true });
let seq = 0;
for (const [a, b] of [["regidrago", "mimikyu"], ["throh", "melmetal"], ["marowak", "carbink"], ["gastrodon", "azumarill"]]) {
  const config = G.createBattleConfig(runtime.pokemonMap.get(a), runtime.pokemonMap.get(b), G.RANK1_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
  for (const shields of [0, 1, 2]) {
    const fresh = G.compactResult(adapter.simulate({ id: ++seq, config: G.cloneBattleConfig(config), aShields: shields, bShields: shields, includeSwing: false }), a, b);
    const inflated = inflateCacheResult(fresh);
    assert.equal(inflated.score, fresh.score, `${a}/${b}/${shields}: score`);
    assert.equal(inflated.hpEdge, fresh.hpEdge, `${a}/${b}/${shields}: hpEdge`);
    assert.deepEqual(rescoreCachedResult(inflated), inflated);
  }
}
let checked = 0;
for (const id of ["throh", "throh_shadow", "marowak", "marowak_shadow", "gastrodon", "diggersby", "diggersby_shadow", "machoke_shadow", "hariyama", "hariyama_shadow"]) {
  const file = path.join(__dirname, "..", "data/seasons/twilight-trails/matchup-cache/great-league/rank1", `${id}.json`);
  if (!fs.existsSync(file)) continue;
  for (const value of Object.values(JSON.parse(fs.readFileSync(file, "utf8")).cells)) {
    assert.equal(inflateCacheResult(value).score, value[0], `${id}: stored score parity`);
    checked++;
  }
}
console.log(`PASS: 12 fresh battles, legacy migration and idempotence, ${checked} stored cells`);
