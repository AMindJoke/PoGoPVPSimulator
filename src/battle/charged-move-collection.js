(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakChargedMoveCollection = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_SELECTED_LIMIT = 2;

  function positiveInteger(value, fallback) {
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric < 1) return fallback;
    return numeric;
  }

  function selectedLimit(pokemon, fallback = DEFAULT_SELECTED_LIMIT) {
    const defaultLimit = positiveInteger(fallback, DEFAULT_SELECTED_LIMIT);
    return positiveInteger(
      pokemon?.battleCapabilities?.selectedChargedMoveLimit
        ?? pokemon?.selectedChargedMoveLimit,
      defaultLimit
    );
  }

  function moveId(value) {
    const id = typeof value === "string" ? value : value?.id ?? value?.moveId;
    return id == null ? "" : String(id).trim();
  }

  function normalizeIds(values, options = {}) {
    const source = Array.isArray(values) ? values : [];
    const limit = options.limit == null
      ? Number.POSITIVE_INFINITY
      : positiveInteger(options.limit, DEFAULT_SELECTED_LIMIT);
    const allowed = options.allowedIds
      ? new Set([...options.allowedIds].map(moveId).filter(Boolean))
      : null;
    const result = [];
    const seen = new Set();
    for (const value of source) {
      const id = moveId(value);
      if (!id || seen.has(id) || (allowed && !allowed.has(id))) continue;
      seen.add(id);
      result.push(id);
      if (result.length >= limit) break;
    }
    return result;
  }

  function normalizeMoves(values, options = {}) {
    const source = Array.isArray(values) ? values : [];
    const ids = normalizeIds(source, options);
    const byId = new Map(source.map(move => [moveId(move), move]).filter(([id]) => id));
    return ids.map(id => byId.get(id));
  }

  function selectedIds(input = {}) {
    const pokemon = input.pokemon || null;
    const limit = input.limit ?? selectedLimit(pokemon);
    const preferred = normalizeIds(input.selectedIds, {
      limit,
      allowedIds: input.availableIds
    });
    if (preferred.length >= limit || input.fill === false) return preferred;
    return normalizeIds([
      ...preferred,
      ...(Array.isArray(input.fallbackIds) ? input.fallbackIds : []),
      ...(Array.isArray(input.availableIds) ? input.availableIds : [])
    ], { limit, allowedIds: input.availableIds });
  }

  function validateSelection(input = {}) {
    const raw = Array.isArray(input.selectedIds) ? input.selectedIds.map(moveId).filter(Boolean) : [];
    const normalized = normalizeIds(raw, {
      limit: input.limit ?? selectedLimit(input.pokemon),
      allowedIds: input.availableIds
    });
    const errors = [];
    if (new Set(raw).size !== raw.length) errors.push("CHARGED_MOVE_SELECTION_DUPLICATE");
    if (raw.length > (input.limit ?? selectedLimit(input.pokemon))) errors.push("CHARGED_MOVE_SELECTION_LIMIT_EXCEEDED");
    if (input.availableIds) {
      const allowed = new Set([...input.availableIds].map(moveId).filter(Boolean));
      raw.filter(id => !allowed.has(id)).forEach(id => errors.push(`CHARGED_MOVE_UNKNOWN:${id}`));
    }
    if (input.required != null && normalized.length < Math.max(0, Number(input.required) || 0)) {
      errors.push("CHARGED_MOVE_SELECTION_INCOMPLETE");
    }
    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors), ids: Object.freeze(normalized) });
  }

  return Object.freeze({
    DEFAULT_SELECTED_LIMIT,
    selectedLimit,
    normalizeIds,
    normalizeMoves,
    selectedIds,
    validateSelection
  });
});
