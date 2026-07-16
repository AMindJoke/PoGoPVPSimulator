"use strict";

const assert = require("assert");
const { buildIvImpact } = require("../src/analysis/iv-impact");
const { buildRankingRatings, selectRelevantMatchups } = require("../src/analysis/ranking-details");

const impact = buildIvImpact({
  damage: { moveName: "Fast Move", opponentName: "Target", currentDamage: 5, referenceDamage: 4 },
  cmp: { opponentName: "Target", currentOutcome: "win", referenceOutcome: "loss" },
  bulk: { moveName: "Charged Move", opponentName: "Target", currentDamage: 40, referenceDamage: 41, currentSurvives: true, referenceSurvives: true }
});
assert.deepStrictEqual(impact.map(item => item.key), ["damage", "cmp", "bulk"]);
assert.strictEqual(buildIvImpact({ damage: { moveName: "Move", currentDamage: 4, referenceDamage: 4 } }).length, 0);

const ratings = buildRankingRatings({ competitiveScore: 600, scoreStdDev: 20, categoryScores: { closer: { score: 80 } } }, { complexity: { score: 60, consistency: 75, shieldDependency: 40 } });
Object.values(ratings).forEach(value => assert(value >= 0 && value <= 5));

const matchups = selectRelevantMatchups([
  { opponentId: "top", score: 550 },
  { opponentId: "lower", score: 700 },
  { opponentId: "loss", score: 450 }
], new Map([["top", 1], ["lower", 10], ["loss", 2]]), 3);
assert.strictEqual(matchups.wins[0].opponentId, "top");
assert.strictEqual(matchups.losses[0].opponentId, "loss");
console.log("UX presenter tests passed.");
