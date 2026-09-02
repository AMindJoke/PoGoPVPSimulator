(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakSeasonContext = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "go-pvp-active-season-v1";
  const STATUS = Object.freeze({ CURRENT: "current", PREVIEW: "preview" });
  const VALUE_STATUS = new Set(["estimated", "confirmed"]);
  const MOVE_FIELDS = new Set(["power", "energy", "energyGain", "turns", "cooldown", "buffApplyChance", "buffs", "buffsSelf", "buffsOpponent", "buffTarget"]);
  const NUMERIC_MOVE_FIELDS = new Set(["power", "energy", "energyGain", "turns", "cooldown", "buffApplyChance"]);

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

  function validateCanonicalData(gameMaster) {
    const errors = [];
    if (!Array.isArray(gameMaster?.moves)) errors.push("CANONICAL_MOVES_MISSING");
    if (!Array.isArray(gameMaster?.pokemon)) errors.push("CANONICAL_POKEMON_MISSING");
    const moveIds = new Set();
    (gameMaster?.moves || []).forEach((move, index) => {
      const id = cleanId(move?.moveId);
      if (!id) errors.push(`MOVE_ID_MISSING:${index}`);
      else if (moveIds.has(id)) errors.push(`MOVE_ID_DUPLICATE:${id}`);
      else moveIds.add(id);
      ["power", "energy", "energyGain", "turns", "cooldown"].forEach(field => {
        if (move?.[field] != null && !Number.isFinite(Number(move[field]))) errors.push(`MOVE_NUMBER_INVALID:${id || index}:${field}`);
      });
    });
    const pokemonIds = new Set();
    (gameMaster?.pokemon || []).forEach((pokemon, index) => {
      const id = cleanId(pokemon?.speciesId);
      if (!id) errors.push(`POKEMON_ID_MISSING:${index}`);
      else if (pokemonIds.has(id)) errors.push(`POKEMON_ID_DUPLICATE:${id}`);
      else pokemonIds.add(id);
      ["atk", "def", "hp"].forEach(field => {
        if (!Number.isFinite(Number(pokemon?.baseStats?.[field]))) errors.push(`POKEMON_STAT_INVALID:${id || index}:${field}`);
      });
      [...(pokemon?.fastMoves || []), ...(pokemon?.chargedMoves || [])].forEach(moveId => {
        if (!moveIds.has(cleanId(moveId))) errors.push(`POKEMON_MOVE_UNKNOWN:${id || index}:${cleanId(moveId)}`);
      });
      const charged = (pokemon?.chargedMoves || []).map(cleanId).filter(Boolean);
      if (new Set(charged).size !== charged.length) errors.push(`POKEMON_CHARGED_DUPLICATE:${id || index}`);
    });
    return [...new Set(errors)];
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
        if (NUMERIC_MOVE_FIELDS.has(field) && !Number.isFinite(Number(override[field]))) errors.push(`PREVIEW_MOVE_NUMBER_INVALID:${code}:${field}`);
      });
      if (override.status === "estimated" && !cleanId(override.note)) errors.push(`PREVIEW_MOVE_ESTIMATE_NOTE_MISSING:${code}`);
    });
    const pokemonIds = new Set((gameMaster?.pokemon || []).map(pokemon => cleanId(pokemon?.speciesId)).filter(Boolean));
    if (preview.pokemonMoveOverrides != null && !record(preview.pokemonMoveOverrides)) errors.push("PREVIEW_POKEMON_OVERRIDES_INVALID");
    else Object.entries(preview.pokemonMoveOverrides || {}).forEach(([pokemonId, override]) => {
      if (!pokemonIds.has(cleanId(pokemonId))) errors.push(`PREVIEW_POKEMON_UNKNOWN:${cleanId(pokemonId)}`);
      if (!record(override)) { errors.push(`PREVIEW_POKEMON_OVERRIDE_INVALID:${cleanId(pokemonId)}`); return; }
      ["fast", "charged"].forEach(kind => (override[kind]?.add || []).forEach(moveId => {
        if (!moveIds.has(cleanId(moveId))) errors.push(`PREVIEW_POKEMON_MOVE_UNKNOWN:${cleanId(pokemonId)}:${cleanId(moveId)}`);
      }));
    });
    if (preview.enabled && Array.isArray(preview.pendingValues) && preview.pendingValues.length) errors.push("PREVIEW_VALUES_PENDING");
    if (preview.enabled && options.requireGenerated !== false) {
      const generatedLoaded = record(preview.generated) && preview.generated.rankings && preview.generated.rankingDetails;
      const generatedDeferred = record(preview.generatedAssets)
        && cleanId(preview.generatedAssets.rankings)
        && cleanId(preview.generatedAssets.rankingDetails);
      if (!generatedLoaded && !generatedDeferred) errors.push("PREVIEW_GENERATED_OUTPUTS_MISSING");
      else if (record(preview.generated)) {
        if (!preview.generated.rankings) errors.push("PREVIEW_RANKINGS_MISSING");
        if (!preview.generated.rankingDetails) errors.push("PREVIEW_RANKING_DETAILS_MISSING");
      }
    }
    return [...new Set(errors)];
  }

  function validateCatalog(catalog, gameMaster, options = {}) {
    const errors = [];
    if (!record(catalog) || catalog.schemaVersion !== 1) return ["SEASON_CATALOG_INVALID"];
    errors.push(...validateCanonicalData(gameMaster));
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
      MOVE_FIELDS.forEach(field => {
        if (!Object.hasOwn(override, field)) return;
        next[field] = NUMERIC_MOVE_FIELDS.has(field) ? Number(override[field]) : override[field];
      });
      return Object.freeze(next);
    });
    return Object.freeze({ ...gameMaster, moves: Object.freeze(moves) });
  }

  function applyPokemonMoveOverrides(gameMaster, overrides) {
    if (!overrides || !Object.keys(overrides).length) return gameMaster;
    const pokemon = (gameMaster.pokemon || []).map(entry => {
      const override = overrides[entry.speciesId];
      if (!override) return entry;
      const fastMoves = [...new Set([...(entry.fastMoves || []), ...(override.fast?.add || [])])];
      const chargedMoves = [...new Set([...(entry.chargedMoves || []), ...(override.charged?.add || [])])];
      return Object.freeze({ ...entry, fastMoves: Object.freeze(fastMoves), chargedMoves: Object.freeze(chargedMoves) });
    });
    return Object.freeze({ ...gameMaster, pokemon: Object.freeze(pokemon) });
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
    const previewRequested = previewAvailable && selectedId === cleanId(catalog.next.id);
    const previewDataLoaded = !!(catalog.next?.generated?.rankings && catalog.next?.generated?.rankingDetails);
    const isPreview = previewRequested && previewDataLoaded;
    const descriptor = isPreview ? catalog.next : catalog.current;
    const moveResolved = isPreview ? applyMoveOverrides(gameMaster, catalog.next.moveOverrides) : gameMaster;
    const resolvedGameMaster = isPreview ? applyPokemonMoveOverrides(moveResolved, catalog.next.pokemonMoveOverrides) : gameMaster;
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
      defaultMovesets: isPreview ? (generated?.defaultMovesets || input.defaultMovesets || {}) : (input.defaultMovesets || {}),
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
      selectionWasInvalid: (!!requested && !allowed.has(requested)) || (previewRequested && !previewDataLoaded),
      errors: Object.freeze(previewRequested && !previewDataLoaded ? [...catalogErrors, "PREVIEW_GENERATED_ASSETS_NOT_LOADED"] : catalogErrors),
      cacheIdentity(engineVersion) { return `${identity}:${cleanId(engineVersion) || "engine-unversioned"}`; },
      persist(seasonId) {
        const nextId = allowed.has(cleanId(seasonId)) ? cleanId(seasonId) : cleanId(catalog.current?.id);
        try { input.storage?.setItem?.(STORAGE_KEY, nextId); } catch (_) {}
        return nextId;
      }
    });
  }

  return Object.freeze({ STORAGE_KEY, STATUS, MOVE_FIELDS, validateCanonicalData, validatePreview, validateCatalog, applyMoveOverrides, applyPokemonMoveOverrides, create });
});
