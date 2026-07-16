"use strict";

(function exposeRankingDetails(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakRankingDetails = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createRankingDetailsApi() {
  function buildRankingRatings(entry = {}, analysis = {}) {
    const categories = entry.categoryScores || {};
    const complexity = analysis.complexity || {};
    return {
      overall: ratingFromScore(entry.competitiveScore || entry.overallScore || entry.weightedScore || 0, 1000),
      consistency: ratingFromScore(complexity.consistency ?? consistencyFromDeviation(entry.scoreStdDev), 100),
      shieldDependence: ratingFromScore(complexity.shieldDependency ?? shieldSpread(entry.shieldStates), 100),
      technicalDifficulty: ratingFromScore(complexity.score ?? 0, 100),
      closingPotential: ratingFromScore(categories.closer?.competitiveRating ?? categories.closer?.score ?? 0, 100)
    };
  }

  function selectRelevantMatchups(cells, rankById, limit = 3) {
    const rows = Array.isArray(cells) ? cells : [];
    const ranks = rankById && typeof rankById.get === "function"
      ? rankById
      : new Map(Object.entries(rankById || {}));
    const relevant = rows
      .filter(row => row && row.opponentId && Number.isFinite(Number(row.score)) && Number.isFinite(Number(ranks.get(row.opponentId))))
      .map(row => ({ ...row, opponentRank: Number(ranks.get(row.opponentId)) }))
      .sort((a, b) => a.opponentRank - b.opponentRank || Math.abs(a.score - 500) - Math.abs(b.score - 500) || a.opponentId.localeCompare(b.opponentId));
    return {
      wins: relevant.filter(row => row.score > 500).slice(0, limit),
      losses: relevant.filter(row => row.score < 500).slice(0, limit)
    };
  }

  function ratingFromScore(value, maximum) {
    const normalized = Math.max(0, Math.min(1, Number(value || 0) / maximum));
    return Math.max(0, Math.min(5, Math.round(normalized * 5)));
  }

  function consistencyFromDeviation(value) {
    return Math.max(0, 100 - Math.min(100, Number(value || 0) / 2));
  }

  function shieldSpread(states = {}) {
    const values = Object.values(states).map(state => Number(state?.averageScore)).filter(Number.isFinite);
    if (values.length < 2) return 0;
    return Math.min(100, Math.max(...values) - Math.min(...values));
  }

  return { buildRankingRatings, selectRelevantMatchups, ratingFromScore };
});
