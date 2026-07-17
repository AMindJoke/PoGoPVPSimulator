(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PvPeakPokemonAnalysisViewModel = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function list(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }

  function normalizePokemonAnalysisViewModel(input = {}) {
    const moves = list(input.moves);
    const alternatives = [
      ...list(input.availableMoves?.fast),
      ...list(input.availableMoves?.charged)
    ].filter(move => !move.recommended);
    const profiles = list(input.ivProfiles);
    const breakpoints = list(input.breakpoints);
    const bulkpoints = list(input.bulkpoints);
    const facts = list(input.quickFacts).slice(0, 4);
    const playItems = list(input.playPlan).filter(item => item?.text);

    return {
      id: input.id || "",
      identity: {
        name: input.name || "Unknown Pokemon",
        image: input.image || "",
        fallbackImage: input.fallbackImage || "",
        shadow: !!input.shadow,
        types: list(input.types),
        league: "Great League",
        rank: input.rank ?? "-",
        rating: Number.isFinite(Number(input.rating)) ? Math.round(Number(input.rating)) : null,
        role: input.role || "Competitive pick"
      },
      summary: {
        statement: input.identitySummary || "Competitive summary is not available for this Pokemon.",
        facts
      },
      competitiveIdentity: {
        role: input.role || "Competitive pick",
        statement: input.identitySummary || "Competitive identity data is not available.",
        traits: list(input.identityTraits).slice(0, 4),
        categories: list(input.categories).slice(0, 3)
      },
      recommendedMoves: {
        primary: moves,
        alternatives
      },
      keyMatchups: {
        shieldState: "1 shield",
        wins: list(input.keyWins).slice(0, 4),
        losses: list(input.keyLosses).slice(0, 4)
      },
      ivAnalysis: {
        profiles,
        recommendedProfileId: profiles.find(profile => profile.id === "balanced")?.id || profiles[0]?.id || null
      },
      playGuidance: {
        items: playItems
      },
      advancedAnalysis: {
        breakpoints,
        bulkpoints
      },
      availability: {
        ranking: input.rank != null && input.rating != null,
        summary: facts.length > 0,
        moves: moves.length > 0,
        matchups: list(input.keyWins).length > 0 || list(input.keyLosses).length > 0,
        ivAnalysis: profiles.length > 0,
        playGuidance: playItems.length > 0,
        technicalAnalysis: breakpoints.length > 0 || bulkpoints.length > 0
      },
      provenance: {
        identity: "Pokemon and move metadata",
        ranking: "PvPeak Great League ranking dataset",
        matchups: "PvPeak precomputed 1-shield matchup details",
        ivAnalysis: "PvPeak IV optimization and sampled matchup thresholds",
        playGuidance: "Derived from ranking role ratings and move mechanics"
      }
    };
  }

  return { normalizePokemonAnalysisViewModel };
});
