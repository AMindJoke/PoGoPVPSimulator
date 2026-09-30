"use strict";

(function exposeRankingDetails(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakRankingDetails = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createRankingDetailsApi() {
  function overallScore(entry = {}, metadata = {}) {
    const priorActive = Number(metadata.candidatePriorWeight ?? metadata.rankingModel?.candidatePrior?.weight ?? 0) > 0;
    const values = priorActive
      ? [entry.metaViabilityScore, entry.overallScore, entry.competitiveScore, entry.weightedScore, entry.averageScore]
      : [entry.competitiveScore, entry.overallScore, entry.weightedScore, entry.averageScore];
    const value = values.find(value => value != null && Number.isFinite(Number(value)));
    return value == null ? null : Math.round(Number(value));
  }

  function canonicalPokemonId(id, resolvePokemon) {
    const seen = new Set();
    let current = id;
    while (current && !seen.has(current)) {
      seen.add(current);
      const alias = resolvePokemon(current)?.aliasId;
      if (!alias || !resolvePokemon(alias)) break;
      current = alias;
    }
    return current;
  }

  function buildOverallRankingEntries(baseEntries, roleEntries, metadata, resolvePokemon, profile) {
    const preferred = baseEntries.filter(entry => entry.profile === profile);
    const roles = new Map(roleEntries.filter(entry => entry.profile === profile).map(entry => [entry.id, entry]));
    const canonical = new Map();
    for (const base of preferred.length ? preferred : baseEntries) {
      if (!base?.id || !resolvePokemon(base.id)) continue;
      const id = canonicalPokemonId(base.id, resolvePokemon);
      const entry = { ...base, ...(roles.get(base.id) || {}) };
      const previous = canonical.get(id);
      // Prefer the actual species record over its cosmetic aliases, regardless of input order.
      if (!previous || base.id === id) canonical.set(id, entry);
    }
    return [...canonical.values()]
      .map(entry => ({ ...entry, displayScore: overallScore(entry, metadata) }))
      .sort((a, b) => (b.displayScore ?? -1) - (a.displayScore ?? -1)
        || Number(a.rank || 9999) - Number(b.rank || 9999) || a.id.localeCompare(b.id))
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  function movesetScoreStale(published, active) {
    if (!published?.fast) return false;
    return published.fast !== active?.fast
      || [...(published.charged || [])].sort().join("|") !== [...(active?.charged || [])].sort().join("|");
  }

  function buildRankingRatings(entry = {}, analysis = {}) {
    const categories = entry.categoryScores || {};
    const complexity = analysis.complexity || {};
    return {
      overall: ratingFromScore(entry.displayScore ?? overallScore(entry) ?? 0, 1000),
      consistency: ratingFromScore(complexity.consistency ?? consistencyFromDeviation(entry.scoreStdDev), 100),
      shieldDependence: ratingFromScore(complexity.shieldDependency ?? shieldSpread(entry.shieldStates), 100),
      technicalDifficulty: ratingFromScore(complexity.score ?? 0, 100),
      closingPotential: ratingFromScore(categories.closer?.competitiveRating ?? categories.closer?.score ?? 0, 100)
    };
  }

  // Key matchups describe the current competitive field, not the full
  // simulator candidate pool. Keep only the configured top slice and then
  // rank wins/losses by the actual matchup margin so stale rank ordering
  // cannot surface a lower-ranked or obsolete opponent as a key result.
  function selectRelevantMatchups(cells, rankById, limit = 3, topLimit = 50) {
    const rows = Array.isArray(cells) ? cells : [];
    const ranks = rankById && typeof rankById.get === "function"
      ? rankById
      : new Map(Object.entries(rankById || {}));
    const maxRank = Number.isFinite(Number(topLimit)) ? Number(topLimit) : Infinity;
    const relevant = rows
      .filter(row => row && row.opponentId && Number.isFinite(Number(row.score)) && Number.isFinite(Number(ranks.get(row.opponentId))))
      .map(row => ({ ...row, opponentRank: Number(ranks.get(row.opponentId)) }))
      .filter(row => row.opponentRank > 0 && row.opponentRank <= maxRank);
    return {
      wins: relevant
        .filter(row => row.score > 500)
        .sort((a, b) => b.score - a.score || a.opponentRank - b.opponentRank || a.opponentId.localeCompare(b.opponentId))
        .slice(0, limit),
      losses: relevant
        .filter(row => row.score < 500)
        .sort((a, b) => a.score - b.score || a.opponentRank - b.opponentRank || a.opponentId.localeCompare(b.opponentId))
        .slice(0, limit)
    };
  }

  function orientMatchupScore(score, reversed = false) {
    const value = Number(score);
    if (!Number.isFinite(value)) return NaN;
    return reversed ? 1000 - value : value;
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

  return { overallScore, canonicalPokemonId, buildOverallRankingEntries, movesetScoreStale, buildRankingRatings, selectRelevantMatchups, orientMatchupScore, ratingFromScore };
});
