(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./manual-branches.js") : root.PvPeakManualBranches
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualScenarioIO = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Branches) {
  "use strict";

  const SCHEMA_VERSION = 1;

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function exportScenario(input = {}) {
    if (!Branches || Branches.validateRegistry(input.registry).length) {
      throw new Error("INVALID_BRANCH_REGISTRY");
    }
    const active = Branches.activeBranch(input.registry);
    return {
      schemaVersion: SCHEMA_VERSION,
      battleEngineVersion: String(input.battleEngineVersion || ""),
      plannerMode: input.plannerMode || "PVPOKE_PARITY",
      reviewMode: input.reviewMode === "automatic" ? "automatic" : "manual",
      scenarioReview: clone(input.scenarioReview || null),
      exportedAt: input.exportedAt || new Date().toISOString(),
      pokemon: clone(input.pokemon || null),
      initialState: clone(input.initialState || active?.timelineModel?.initialState || null),
      originalBranch: clone(input.registry.branches[Branches.ORIGINAL_BRANCH_ID]),
      manualBranch: active?.branchId === Branches.ORIGINAL_BRANCH_ID ? null : clone(active),
      activeBranchId: input.registry.activeBranchId,
      edits: clone(active?.edits || []),
      timeline: clone(active?.timelineModel?.events || []),
      terminalResult: clone(active?.terminalResult || null),
      branchRegistry: clone(input.registry)
    };
  }

  function stringifyScenario(input, spacing = 2) {
    return JSON.stringify(exportScenario(input), null, spacing);
  }

  function validateScenario(document, options = {}) {
    const errors = [];
    if (!document || typeof document !== "object" || Array.isArray(document)) return ["INVALID_IMPORT_DOCUMENT"];
    if (document.schemaVersion !== SCHEMA_VERSION) errors.push("IMPORT_SCHEMA_MISMATCH");
    if (!document.battleEngineVersion) errors.push("BATTLE_ENGINE_VERSION_MISSING");
    if (
      options.battleEngineVersion
      && document.battleEngineVersion !== options.battleEngineVersion
      && options.allowEngineMismatch !== true
    ) {
      errors.push("BATTLE_ENGINE_VERSION_MISMATCH");
    }
    if (document.plannerMode !== "PVPOKE_PARITY") errors.push("UNSUPPORTED_PLANNER_MODE");
    if (!document.branchRegistry) errors.push("BRANCH_REGISTRY_MISSING");
    else errors.push(...Branches.validateRegistry(document.branchRegistry));
    if (!document.originalBranch || document.originalBranch.branchId !== Branches.ORIGINAL_BRANCH_ID) {
      errors.push("ORIGINAL_BRANCH_MISSING");
    }
    if (!Array.isArray(document.timeline)) errors.push("INVALID_TIMELINE");
    if (!Array.isArray(document.edits)) errors.push("INVALID_EDITS");
    return [...new Set(errors)];
  }

  function importScenario(serialized, options = {}) {
    let document;
    try {
      document = typeof serialized === "string" ? JSON.parse(serialized) : clone(serialized);
    } catch (_) {
      return { ok: false, errors: ["INVALID_JSON"], scenario: null };
    }
    const errors = validateScenario(document, options);
    if (errors.length) return { ok: false, errors, scenario: null };
    if (document.reviewMode !== "automatic" && document.reviewMode !== "manual") {
      document.reviewMode = "manual";
    }
    if (!Object.prototype.hasOwnProperty.call(document, "scenarioReview")) {
      document.scenarioReview = null;
    }
    return {
      ok: true,
      errors: [],
      warnings: (
        options.battleEngineVersion
        && document.battleEngineVersion !== options.battleEngineVersion
      ) ? ["BATTLE_ENGINE_VERSION_MISMATCH"] : [],
      scenario: clone(document)
    };
  }

  return Object.freeze({
    SCHEMA_VERSION,
    exportScenario,
    stringifyScenario,
    validateScenario,
    importScenario
  });
});
