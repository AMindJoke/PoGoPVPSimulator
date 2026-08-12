(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakTeamBuilder = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const TEAM_SIZE = 6;
  const DEFAULT_LEAGUE = "great";
  const LEAGUES = Object.freeze({
    great: Object.freeze({ id: "great", name: "Great League", cpCap: 1500, available: true }),
    ultra: Object.freeze({ id: "ultra", name: "Ultra League", cpCap: 2500, available: false }),
    master: Object.freeze({ id: "master", name: "Master League", cpCap: null, available: false })
  });

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function emptyTeam() {
    return Array.from({ length: TEAM_SIZE }, () => null);
  }

  function normalizeLeague(league) {
    return LEAGUES[league]?.available ? league : DEFAULT_LEAGUE;
  }

  function speciesKey(member) {
    if (!member) return null;
    if (Number(member.dex) > 0) return `dex:${Math.round(Number(member.dex))}`;
    return String(member.speciesKey || member.pokemonId || "")
      .replace(/_shadow/g, "")
      .replace(/_(alolan|galarian|hisuian|paldean|mega|primal)$/g, "") || null;
  }

  function normalizeMember(member) {
    if (!member?.pokemonId) throw new Error("TEAM_MEMBER_POKEMON_REQUIRED");
    const chargedMoveIds = [...new Set((member.chargedMoveIds || []).filter(Boolean))].slice(0, 2);
    if (!member.fastMoveId || !chargedMoveIds.length) throw new Error("TEAM_MEMBER_MOVESET_REQUIRED");
    return Object.freeze({
      pokemonId: String(member.pokemonId),
      speciesKey: speciesKey(member),
      dex: Math.max(0, Math.round(Number(member.dex || 0))),
      name: String(member.name || member.pokemonId),
      types: Object.freeze((member.types || []).filter(Boolean).slice(0, 2).map(String)),
      shadow: !!member.shadow,
      fastMoveId: String(member.fastMoveId),
      chargedMoveIds: Object.freeze(chargedMoveIds.map(String)),
      build: Object.freeze(clone(member.build || { profile: "default" }))
    });
  }

  function normalizeState(input = {}) {
    const sourceTeam = Array.isArray(input.team) ? input.team.slice(0, TEAM_SIZE) : [];
    const team = emptyTeam().map((_, index) => sourceTeam[index] ? normalizeMember(sourceTeam[index]) : null);
    const state = {
      schemaVersion: SCHEMA_VERSION,
      league: normalizeLeague(input.league),
      team,
      analysisConfig: clone(input.analysisConfig || { shields: "1-1", meta: null })
    };
    const errors = validateState(state);
    if (errors.length) throw new Error(errors.join(","));
    return clone(state);
  }

  function createState(input = {}) {
    return normalizeState(input);
  }

  function validateSlot(slot) {
    const index = Number(slot);
    if (!Number.isInteger(index) || index < 0 || index >= TEAM_SIZE) throw new Error("TEAM_SLOT_INVALID");
    return index;
  }

  function duplicateSlot(state, member, ignoredSlot = null) {
    const key = speciesKey(member);
    return state.team.findIndex((candidate, index) => index !== ignoredSlot && candidate && speciesKey(candidate) === key);
  }

  function setMember(state, slot, member) {
    const next = normalizeState(state);
    const index = validateSlot(slot);
    const normalized = normalizeMember(member);
    const duplicate = duplicateSlot(next, normalized, index);
    if (duplicate >= 0) {
      const error = new Error("TEAM_SPECIES_DUPLICATE");
      error.duplicateSlot = duplicate;
      throw error;
    }
    next.team[index] = clone(normalized);
    return normalizeState(next);
  }

  function removeMember(state, slot) {
    const next = normalizeState(state);
    next.team[validateSlot(slot)] = null;
    return normalizeState(next);
  }

  function setLeague(state, league) {
    if (!LEAGUES[league]?.available) throw new Error("TEAM_LEAGUE_UNAVAILABLE");
    return normalizeState({ ...clone(state), league });
  }

  function validateState(state) {
    const errors = [];
    if (!state || typeof state !== "object") return ["TEAM_STATE_INVALID"];
    if (state.schemaVersion !== SCHEMA_VERSION) errors.push("TEAM_SCHEMA_UNSUPPORTED");
    if (!LEAGUES[state.league]?.available) errors.push("TEAM_LEAGUE_INVALID");
    if (!Array.isArray(state.team) || state.team.length !== TEAM_SIZE) errors.push("TEAM_SIZE_INVALID");
    const keys = new Set();
    (state.team || []).forEach((member, index) => {
      if (!member) return;
      const key = speciesKey(member);
      if (!key) errors.push(`TEAM_MEMBER_INVALID:${index}`);
      else if (keys.has(key)) errors.push(`TEAM_SPECIES_DUPLICATE:${index}`);
      else keys.add(key);
    });
    return errors;
  }

  return Object.freeze({
    SCHEMA_VERSION,
    TEAM_SIZE,
    DEFAULT_LEAGUE,
    LEAGUES,
    createState,
    normalizeState,
    normalizeMember,
    speciesKey,
    duplicateSlot,
    setMember,
    removeMember,
    setLeague,
    validateState
  });
});
