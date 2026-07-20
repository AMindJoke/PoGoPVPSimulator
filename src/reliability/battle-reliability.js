"use strict";

(function exposeBattleReliability(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakBattleReliability = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBattleReliabilityApi() {
  const BATTLE_ENGINE_VERSION = "battle-planner-v7";
  const TRACE_SCHEMA_VERSION = 1;
  const REGRESSION_SCHEMA_VERSION = 1;

  const REASON_CODES = Object.freeze([
    "BETTER_PROJECTED_OUTCOME",
    "GUARANTEED_DEFENSE_BUFF_VALUE",
    "GUARANTEED_ATTACK_DEBUFF_VALUE",
    "LETHAL_MOVE_AVAILABLE",
    "SAVE_ENERGY_FOR_NEXT_MOVE",
    "AVOID_EARLY_SELF_DEBUFF",
    "SHIELD_PRESERVES_WIN_CONDITION",
    "SHIELD_PREVENTS_KO",
    "SHIELD_AVOIDS_FARM_RANGE",
    "SHIELD_HEAVY_PRESSURE",
    "SHIELD_SAVED_LOW_THREAT",
    "SHIELD_POLICY_ALWAYS",
    "BAIT_REQUIRED",
    "STRAIGHT_PLAY_SUFFICIENT",
    "FARM_FOR_CLOSER",
    "CMP_WIN_SETUP",
    "FORCED_BY_OPPONENT_PRESSURE",
    "PENDING_FAST_IMPACT",
    "BEST_IMMEDIATE_DAMAGE",
    "FASTEST_KO_SEQUENCE",
    "DOMINATED_BRANCH",
    "DEPTH_LIMIT_REACHED",
    "MEMOIZED_RESULT",
    "HEURISTIC_FALLBACK"
  ]);

  const BUG_CATEGORIES = Object.freeze([
    "charged-move-choice",
    "buff-debuff-valuation",
    "shielding",
    "baiting",
    "energy-management",
    "overfarm",
    "cmp",
    "timing",
    "self-debuff-sequencing",
    "move-data",
    "iv-breakpoint",
    "state-corruption",
    "cache-staleness",
    "orientation",
    "ui-engine-mismatch"
  ]);

  const reasonCodeSet = new Set(REASON_CODES);
  const categorySet = new Set(BUG_CATEGORIES);

  function isValidReasonCode(value) {
    return reasonCodeSet.has(value);
  }

  function isValidBugCategory(value) {
    return categorySet.has(value);
  }

  function createMatchupProvenance(input = {}) {
    const source = normalizeSource(input.source);
    const currentEngineVersion = input.currentEngineVersion || BATTLE_ENGINE_VERSION;
    const datasetEngineVersion = input.datasetEngineVersion || input.matrixVersion || null;
    const versionComparable = source !== "live";
    const stale = versionComparable && datasetEngineVersion !== currentEngineVersion;
    return {
      source,
      currentEngineVersion,
      datasetEngineVersion,
      datasetVersion: input.datasetVersion ?? null,
      generatedAt: input.generatedAt || null,
      stale,
      staleReason: !stale
        ? null
        : datasetEngineVersion
          ? "ENGINE_VERSION_MISMATCH"
          : "MISSING_ENGINE_VERSION"
    };
  }

  function normalizeSource(source) {
    const value = String(source || "live").toLowerCase();
    if (value.includes("cache")) return "cached";
    if (value.includes("offline") || value.includes("precomputed") || value.includes("dataset")) return "offline-generated";
    return "live";
  }

  function validateTrace(trace) {
    const errors = [];
    if (!trace || typeof trace !== "object") return ["Trace must be an object."];
    if (trace.schemaVersion !== TRACE_SCHEMA_VERSION) errors.push("Unsupported trace schema version.");
    if (!trace.engineVersion) errors.push("Trace engineVersion is required.");
    if (!Array.isArray(trace.decisions)) errors.push("Trace decisions must be an array.");
    if (trace.shieldCounterfactuals !== undefined && !Array.isArray(trace.shieldCounterfactuals)) {
      errors.push("Trace shieldCounterfactuals must be an array when present.");
    }
    if (trace.terminalSnapshots !== undefined && !Array.isArray(trace.terminalSnapshots)) {
      errors.push("Trace terminalSnapshots must be an array when present.");
    }
    for (const [index, decision] of (trace.decisions || []).entries()) {
      if (!decision || typeof decision !== "object") {
        errors.push(`Decision ${index} must be an object.`);
        continue;
      }
      if (!decision.decisionType) errors.push(`Decision ${index} is missing decisionType.`);
      if (!isValidReasonCode(decision.reasonCode)) errors.push(`Decision ${index} has invalid reasonCode ${decision.reasonCode}.`);
      if (!Array.isArray(decision.candidates)) errors.push(`Decision ${index} candidates must be an array.`);
    }
    return errors;
  }

  function validateRegressionCase(testCase) {
    const errors = [];
    if (!testCase || typeof testCase !== "object") return ["Regression case must be an object."];
    if (!testCase.id) errors.push("Regression case id is required.");
    if (!testCase.league) errors.push(`${testCase.id || "Case"}: league is required.`);
    if (!testCase.pokemonA?.id || !testCase.pokemonB?.id) errors.push(`${testCase.id || "Case"}: both Pokemon ids are required.`);
    for (const category of testCase.category || []) {
      if (!isValidBugCategory(category)) errors.push(`${testCase.id || "Case"}: invalid category ${category}.`);
    }
    return errors;
  }

  return Object.freeze({
    BATTLE_ENGINE_VERSION,
    TRACE_SCHEMA_VERSION,
    REGRESSION_SCHEMA_VERSION,
    REASON_CODES,
    BUG_CATEGORIES,
    isValidReasonCode,
    isValidBugCategory,
    createMatchupProvenance,
    validateTrace,
    validateRegressionCase
  });
});
