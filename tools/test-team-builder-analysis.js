const assert = require("node:assert/strict");
const Analysis = require("../src/team-builder/team-builder-analysis.js");

const member = (pokemonId, fastMoveId = "FAST") => ({
  pokemonId,
  fastMoveId,
  chargedMoveIds: ["CHARGE_1", "CHARGE_2"],
  build: { profile: "custom", ivAtk: 1, ivDef: 15, ivHp: 14, level: 24, cp: 1498 }
});

const input = {
  engineVersion: "engine-test",
  providerId: "great-league-current",
  shields: "1-1",
  team: [member("azumarill"), member("dunsparce"), null, null, null, null],
  opponentIds: ["clodsire", "gastrodon", "clodsire"],
  opponentSignatures: { clodsire: "clodsire-build-v1", gastrodon: "gastrodon-build-v1" }
};
const plan = Analysis.createPlan(input);
assert.equal(plan.length, 4, "The plan must contain one deterministic job per populated Team × unique Meta pair.");
assert.equal(new Set(plan.map(job => job.key)).size, 4);
assert.equal(Analysis.createPlan({ ...input, shields: "2-2" })[0].key === plan[0].key, false, "Shield state must invalidate the cache signature.");
assert.equal(Analysis.createPlan({ ...input, team: [member("azumarill", "OTHER_FAST")] })[0].key === plan[0].key, false, "Moveset changes must invalidate the cache signature.");
assert.equal(Analysis.createPlan({ ...input, opponentSignatures: { ...input.opponentSignatures, clodsire: "clodsire-build-v2" } })[0].key === plan[0].key, false, "Meta opponent build changes must invalidate the cache signature.");

const storageData = new Map();
const storage = { getItem: key => storageData.get(key) || null, setItem: (key, value) => storageData.set(key, value) };
const cache = Analysis.createCache(storage);
assert.deepEqual(Analysis.planProgress(plan, cache), { total: 4, cached: 0, pending: 4 });
const normalized = Analysis.normalizeResult(plan[0], {
  score: 731,
  details: { winnerEdge: 171, aHp: 0.625, bHp: 0 },
  provenance: { currentEngineVersion: "engine-test" }
});
assert.deepEqual({ winner: normalized.winner, score: normalized.score, teamHpRatio: normalized.teamHpRatio, metaHpRatio: normalized.metaHpRatio }, { winner: "team", score: 731, teamHpRatio: 0.625, metaHpRatio: 0 });
cache.set(plan[0].key, normalized);
cache.persist();
const restored = Analysis.createCache(storage);
assert.deepEqual(restored.get(plan[0].key), normalized, "Compact matchup results must survive local cache restoration.");
assert.deepEqual(Analysis.planProgress(plan, restored), { total: 4, cached: 1, pending: 3 });
assert.equal(Analysis.resultTone({ score: 600 }), "favorable");
assert.equal(Analysis.resultTone({ score: 599 }), "close");
assert.equal(Analysis.resultTone({ score: 400 }), "unfavorable");
assert.equal(Analysis.resultTone({ score: 0 }), "unfavorable", "A zero rating must not fall back to the neutral default.");
assert.equal(Analysis.resultLabel({ score: 731 }), "Win", "Result labels must make matrix meaning accessible without color.");
const grouped = Analysis.groupResults(plan, restored);
assert.equal(grouped.length, 2, "Coverage results must group by unique meta opponent.");
assert.equal(grouped[0].cells.length, 6, "Every opponent row must preserve all six team slots.");
assert.deepEqual(grouped[0].cells[0], normalized);

console.log("Team Builder analysis planning tests passed.");
