const assert = require("node:assert/strict");
const Analysis = require("../src/team-builder/team-builder-analysis.js");
assert.ok(Analysis.MAX_CACHE_ENTRIES >= 4000, "The cache must retain a practical replacement-candidate field without immediate churn.");

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
assert.equal(Analysis.normalizeResult(plan[0], { score: 0 }).score, 0, "A decisive zero rating must not be normalized to neutral.");
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

const scoreGroup = (opponentId, scores) => ({ opponentId, cells: scores.map(score => score == null ? null : ({ score })) });
const critical = Analysis.summarizeOpponent(scoreGroup("critical", [200, 200, 200, 200, 200, 200]));
assert.deepEqual(
  { answers: critical.answerCount, close: critical.closeCount, losses: critical.hardLossCount, average: critical.averageScore, severity: critical.severity, label: critical.severityLabel },
  { answers: 0, close: 0, losses: 6, average: 200, severity: 86, label: "Critical" },
  "Threat severity must combine missing answers with the magnitude of simulated losses."
);
assert.equal(Analysis.summarizeOpponent(scoreGroup("pending", [700, null, 500, 500, 500, 500])), null, "Partial rows must not produce misleading insights.");
const coverageInsights = Analysis.analyzeCoverage([
  scoreGroup("balanced", [700, 650, 550, 500, 350, 300]),
  scoreGroup("covered", [800, 750, 700, 650, 590, 580]),
  scoreGroup("critical", [200, 200, 200, 200, 200, 200]),
  scoreGroup("pending", [700, null, 500, 500, 500, 500])
]);
assert.equal(coverageInsights.completedOpponents, 3, "Only complete opponent rows may enter threat analysis.");
assert.equal(coverageInsights.noAnswerCount, 1);
assert.equal(coverageInsights.threats[0].opponentId, "critical", "The most severe simulated weakness must rank first.");
assert.equal(coverageInsights.bestCovered[0].opponentId, "covered", "The opponent with the most strong answers must rank first in best covered.");
assert.deepEqual(coverageInsights.bestCovered[0].answerSlots, [0, 1, 2, 3]);

const coreInsights = Analysis.analyzeCores([
  scoreGroup("shared-a", [250, 300, 700, 650, 500, 450]),
  scoreGroup("shared-b", [350, 150, 680, 620, 480, 410]),
  scoreGroup("fragile", [700, 350, 300, 250, 450, 390]),
  scoreGroup("pending", [200, 200, 500, 500, null, 500])
]);
assert.equal(coreInsights.completedOpponents, 3, "Core analysis must ignore incomplete matchup rows.");
assert.deepEqual(coreInsights.weakCores[0].slots, [0, 1], "The pair sharing the most hard losses must rank as the weakest core.");
assert.equal(coreInsights.weakCores[0].sharedLossCount, 2);
assert.deepEqual(coreInsights.weakCores[0].opponents.map(item => item.opponentId), ["shared-b", "shared-a"], "Shared threats must rank by simulated loss severity.");
assert.equal(coreInsights.fragileAnswers.length, 1, "Only opponents with exactly one favorable answer are structurally fragile.");
assert.deepEqual(
  { opponent: coreInsights.fragileAnswers[0].opponentId, answer: coreInsights.fragileAnswers[0].answerSlot, backup: coreInsights.fragileAnswers[0].backupSlot, backupScore: coreInsights.fragileAnswers[0].backupScore },
  { opponent: "fragile", answer: 0, backup: 4, backupScore: 450 }
);

const replacementBaseline = { threatA: { score: 300 }, threatB: { score: 450 }, threatC: { score: 650 } };
const replacement = Analysis.scoreReplacementCandidate("candidate-a", replacementBaseline, {
  threatA: { score: 700 }, threatB: { score: 620 }, threatC: { score: 350 }
});
assert.deepEqual(
  { baseline: replacement.baselineAverage, candidate: replacement.candidateAverage, delta: replacement.averageDelta, gained: replacement.favorableGained, fixed: replacement.hardLossesFixed, newLosses: replacement.newHardLosses, score: replacement.replacementScore },
  { baseline: 467, candidate: 557, delta: 90, gained: 2, fixed: 1, newLosses: 1, score: 130 },
  "Replacement scoring must transparently reward simulated gains and penalize newly introduced hard losses."
);
assert.equal(Analysis.scoreReplacementCandidate("incomplete", replacementBaseline, { threatA: { score: 700 } }), null, "Incomplete candidate simulations must not enter the ranking.");
const replacementRanking = Analysis.rankReplacementCandidates({
  baselineByOpponent: replacementBaseline,
  candidates: {
    "candidate-a": { threatA: { score: 700 }, threatB: { score: 620 }, threatC: { score: 350 } },
    "candidate-b": { threatA: { score: 650 }, threatB: { score: 650 }, threatC: { score: 700 } },
    incomplete: { threatA: { score: 900 } }
  }
});
assert.deepEqual(replacementRanking.map(item => item.candidateId), ["candidate-b", "candidate-a"], "Candidates must rank by deterministic targeted improvement.");

const comparisonA = [
  scoreGroup("gain", [300, 350, 450, 500, 550, 580]),
  scoreGroup("loss", [700, 650, 500, 450, 400, 350])
];
const comparisonB = [
  scoreGroup("gain", [700, 650, 600, 500, 550, 580]),
  scoreGroup("loss", [450, 430, 500, 450, 400, 350]),
  scoreGroup("incomplete", [700, null, 500, 500, 500, 500])
];
const comparison = Analysis.compareTeamCoverage(comparisonA, comparisonB);
assert.equal(comparison.comparableOpponents, 2, "Only opponents complete for both teams may enter comparison.");
assert.equal(comparison.gains[0].opponentId, "gain");
assert.equal(comparison.gains[0].answerDelta, 3);
assert.equal(comparison.losses[0].opponentId, "loss");
assert.deepEqual(
  comparison.deltas,
  { coverageRating: -40, averageRating: 32, favorableMatchups: 1, noAnswerCount: 0 },
  "Team comparison must expose deterministic aggregate deltas."
);
assert.equal(Analysis.summarizeTeamCoverage(comparisonA).favorableMatchups, 2);

console.log("Team Builder analysis planning tests passed.");
