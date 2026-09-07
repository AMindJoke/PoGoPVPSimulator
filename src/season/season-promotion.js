(function (root, factory) {
  const api = factory(root.PvPeakSeasonContext);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakSeasonPromotion = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Season) {
  "use strict";

  function record(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function cleanId(value) { return String(value || "").trim(); }

  function correctionMoves(corrections) {
    if (!record(corrections)) return {};
    return corrections.moves || corrections.moveOverrides || corrections.confirmedMoves || {};
  }

  function applyConfirmedCorrections(preview, corrections = {}, options = {}) {
    const next = clone(preview || {});
    next.moveOverrides = { ...(next.moveOverrides || {}) };
    const supplied = correctionMoves(corrections);
    Object.entries(supplied).forEach(([moveId, values]) => {
      if (!record(values)) return;
      next.moveOverrides[moveId] = {
        ...(next.moveOverrides[moveId] || {}),
        ...clone(values),
        status: "confirmed",
        note: values.note || "Official value supplied after the live update."
      };
    });
    const confirmUnchanged = options.confirmUnchanged === true || corrections.confirmUnchanged === true;
    if (confirmUnchanged) {
      Object.entries(next.moveOverrides).forEach(([moveId, values]) => {
        if (values?.status !== "estimated") return;
        next.moveOverrides[moveId] = {
          ...values,
          status: "confirmed",
          note: "Official update confirmed the provisional value unchanged."
        };
      });
    }
    if (options.dataVersion) next.dataVersion = options.dataVersion;
    if (options.rankingVersion) next.rankingVersion = options.rankingVersion;
    return next;
  }

  function resolvePreviewGameMaster(gameMaster, preview) {
    const moved = Season.applyMoveOverrides(gameMaster, preview?.moveOverrides || {});
    return Season.applyPokemonMoveOverrides(moved, preview?.pokemonMoveOverrides || {});
  }

  function validateFinalPreview(preview, gameMaster, options = {}) {
    const errors = [];
    const warnings = [];
    if (!preview) return { errors: ["PREVIEW_DESCRIPTOR_MISSING"], warnings, resolvedGameMaster: gameMaster };
    errors.push(...Season.validatePreview(preview, gameMaster, {
      requireGenerated: options.requireGenerated === true,
      requireConfirmed: options.requireConfirmed !== false
    }));
    if (Array.isArray(preview.pendingValues) && preview.pendingValues.length) errors.push("PREVIEW_VALUES_PENDING");
    const resolvedGameMaster = resolvePreviewGameMaster(gameMaster, preview);
    errors.push(...Season.validateCanonicalData(resolvedGameMaster));
    if (options.requireGenerated === true && !record(preview.generated) && !record(preview.generatedAssets)) {
      errors.push("PREVIEW_GENERATED_OUTPUTS_MISSING");
    }
    if (options.requireGenerated !== true) warnings.push("GENERATED_OUTPUTS_NOT_REQUIRED_IN_PREPARATION_MODE");
    return { errors: [...new Set(errors)], warnings: [...new Set(warnings)], resolvedGameMaster };
  }

  function buildPromotedCatalog(catalog, preview, options = {}) {
    const current = {
      ...(catalog?.current || {}),
      id: preview.id,
      label: preview.label,
      dataVersion: options.dataVersion || preview.dataVersion,
      rankingVersion: options.rankingVersion || preview.rankingVersion
    };
    return { schemaVersion: 1, current, next: null };
  }

  function buildPromotionPlan(preview, options = {}) {
    const root = options.root || "data";
    return {
      canonicalGameMaster: options.gameMasterPath || "battle-data.js",
      canonicalCatalog: options.catalogPath || "data/seasons/season-catalog.js",
      canonicalNextDescriptor: options.nextPath || "data/seasons/next-season.js",
      canonicalRankings: `${root}/great-league-rankings.json`,
      canonicalRankingScript: `${root}/great-league-rankings.js`,
      canonicalRankingDetails: `${root}/great-league-ranking-details.json`,
      canonicalRankingDetailsScript: `${root}/great-league-ranking-details.js`,
      canonicalMovesets: `${root}/default-movesets.js`,
      previewRoot: `data/seasons/${cleanId(preview?.id)}`,
      cacheVersionBump: true
    };
  }

  return Object.freeze({
    applyConfirmedCorrections,
    resolvePreviewGameMaster,
    validateFinalPreview,
    buildPromotedCatalog,
    buildPromotionPlan
  });
});
