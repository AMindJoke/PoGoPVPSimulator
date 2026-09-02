(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakSeasonContext = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "go-pvp-active-season-v1";
  const STATUS = Object.freeze({ CURRENT: "current", PREVIEW: "preview" });
  const VALUE_STATUS = new Set(["estimated", "confirmed"]);
  const MOVE_FIELDS = new Set(["power", "energy", "energyGain", "turns", "cooldown", "buffApplyChance"]);

  function record(value) { return !!value && typeof value === "object" && !Array.isArray(value); }
  function cleanId(value) { return String(value || "").trim(); }
  function descriptorErrors(descriptor, prefix) {
    const errors = [];
    if (!record(descriptor)) return [`${prefix}_DESCRIPTOR_MISSING`];
    if (!cleanId(descriptor.id)) errors.push(`${prefix}_ID_MISSING`);
    if (!cleanId(descriptor.label)) errors.push(`${prefix}_LABEL_MISSING`);
    if (!cleanId(descriptor.dataVersion)) errors.push(`${prefix}_DATA_VERSION_MISSING`);
    return errors;
  }

  function validatePreview(preview, gameMaster, options = {}) {
    if (!preview) return [];
    const errors = descriptorErrors(preview, "PREVIEW");
    const moveIds = new Set((gameMaster?.moves || []).map(move => cleanId(move?.moveId)).filter(Boolean));
    const overrides = preview.moveOverrides;
    if (!record(overrides)) errors.push("PREVIEW_MOVE_OVERRIDES_MISSING");
    else Object.entries(overrides).forEach(([moveId, override]) => {
      const code = cleanId(moveId);
      if (!moveIds.has(code)) errors.push(`PREVIEW_MOVE_UNKNOWN:${code}`);
      if (!record(override)) { errors.push(`PREVIEW_MOVE_INVALID:${code}`); return; }
      if (!VALUE_STATUS.has(override.status)) errors.push(`PREVIEW_MOVE_STATUS_INVALID:${code}`);
      const changedFields = Object.keys(override).filter(field => MOVE_FIELDS.has(field));
      if (!changedFields.length) errors.push(`PREVIEW_MOVE_VALUE_MISSING:${code}`);
      changedFields.forEach(field => {
        if (!Number.isFinite(Number(override[field]))) errors.push(`PREVIEW_MOVE_NUMBER_INVALID:${code}:${field}`);
      });
      if (override.status === "estimated" && !cleanId(override.note)) errors.push(`PREVIEW_MOVE_ESTIMATE_NOTE_MISSING:${code}`);
    });
    if (options.requireGenerated !== false) {
      if (!record(preview.generated)) errors.push("PREVIEW_GENERATED_OUTPUTS_MISSING");
      else {
        if (!preview.generated.rankings) errors.push("PREVIEW_RANKINGS_MISSING");
        if (!preview.generated.rankingDetails) errors.push("PREVIEW_RANKING_DETAILS_MISSING");
      }
    }
    return [...new Set(errors)];
  }

  function validateCatalog(catalog, gameMaster, options = {}) {
    const errors = [];
    if (!record(catalog) || catalog.schemaVersion !== 1) return ["SEASON_CATALOG_INVALID"];
    errors.push(...descriptorErrors(catalog.current, "CURRENT"));
    if (catalog.next) {
      errors.push(...validatePreview(catalog.next, gameMaster, options));
      if (cleanId(catalog.next.id) === cleanId(catalog.current?.id)) errors.push("SEASON_IDS_DUPLICATE");
    }
    return [...new Set(errors)];
  }

  function applyMoveOverrides(gameMaster, overrides) {
    if (!overrides || !Object.keys(overrides).length) return gameMaster;
    const moves = (gameMaster.moves || []).map(move => {
      const override = overrides[move.moveId];
      if (!override) return move;
      const next = { ...move };
      MOVE_FIELDS.forEach(field => { if (Object.hasOwn(override, field)) next[field] = Number(override[field]); });
      return Object.freeze(next);
    });
    return Object.freeze({ ...gameMaster, moves: Object.freeze(moves) });
  }

  function querySeason(locationLike) {
    try { return cleanId(new URLSearchParams(locationLike?.search || "").get("season")); }
    catch (_) { return ""; }
  }

  function storedSeason(storage) {
    try { return cleanId(storage?.getItem?.(STORAGE_KEY)); }
    catch (_) { return ""; }
  }

  function create(input = {}) {
    const catalog = input.catalog || {};
    const gameMaster = input.gameMaster;
    const catalogErrors = validateCatalog(catalog, gameMaster, input.validation);
    const previewErrors = catalog.next ? validatePreview(catalog.next, gameMaster, input.validation) : [];
    const previewAvailable = !!(catalog.next?.enabled && !previewErrors.length);
    const allowed = new Set([cleanId(catalog.current?.id)]);
    if (previewAvailable) allowed.add(cleanId(catalog.next.id));
    const requested = querySeason(input.location) || storedSeason(input.storage);
    const selectedId = allowed.has(requested) ? requested : cleanId(catalog.current?.id);
    const isPreview = previewAvailable && selectedId === cleanId(catalog.next.id);
    const descriptor = isPreview ? catalog.next : catalog.current;
    const resolvedGameMaster = isPreview ? applyMoveOverrides(gameMaster, catalog.next.moveOverrides) : gameMaster;
    const generated = isPreview ? catalog.next.generated : null;
    const metadata = isPreview ? Object.freeze(Object.fromEntries(Object.entries(catalog.next.moveOverrides || {}).map(([id, value]) => [id, Object.freeze({ status: value.status, note: value.note || "" })]))) : Object.freeze({});
    const identity = `${descriptor.id}:${descriptor.dataVersion}`;
    const data = Object.freeze({
      id: descriptor.id,
      label: descriptor.label,
      status: isPreview ? STATUS.PREVIEW : STATUS.CURRENT,
      dataVersion: descriptor.dataVersion,
      rankingVersion: descriptor.rankingVersion || "unversioned",
      identity,
      gameMaster: resolvedGameMaster,
      defaultMovesets: input.defaultMovesets || {},
      rankings: generated?.rankings || input.rankings || null,
      rankingDetails: generated?.rankingDetails || input.rankingDetails || null,
      moveMetadata: metadata
    });
    return Object.freeze({
      activeSeasonData: data,
      current: catalog.current,
      next: previewAvailable ? catalog.next : null,
      previewAvailable,
      requestedSeasonId: requested || null,
      selectionWasInvalid: !!requested && !allowed.has(requested),
      errors: Object.freeze(catalogErrors),
      cacheIdentity(engineVersion) { return `${identity}:${cleanId(engineVersion) || "engine-unversioned"}`; },
      persist(seasonId) {
        const nextId = allowed.has(cleanId(seasonId)) ? cleanId(seasonId) : cleanId(catalog.current?.id);
        try { input.storage?.setItem?.(STORAGE_KEY, nextId); } catch (_) {}
        return nextId;
      }
    });
  }

  return Object.freeze({ STORAGE_KEY, STATUS, MOVE_FIELDS, validatePreview, validateCatalog, applyMoveOverrides, create });
});
