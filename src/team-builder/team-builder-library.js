(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./team-builder-state.js") : root.PvPeakTeamBuilder);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakTeamLibrary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Team) {
  "use strict";
  const KEY = "pvpeak-saved-teams-v1", LIMIT = 100, MAX_BYTES = 1024 * 1024;
  const clone = value => JSON.parse(JSON.stringify(value));
  function name(value) {
    const result = String(value || "").trim();
    if (!result || result.length > 64) throw new Error("Enter a team name (up to 64 characters).");
    return result;
  }
  function snapshot(value) {
    const state = value?.state;
    if (state?.schemaVersion !== 1 || !Array.isArray(state.team) || state.team.length !== 6 || !Team.LEAGUES[state.league]?.available) throw new Error("This team file is incompatible.");
    if (!["0-0", "1-1", "2-2"].includes(state.analysisConfig?.shields) || !state.analysisConfig?.meta) throw new Error("This team configuration is invalid.");
    if (value.comparisonBaseline != null && (!Array.isArray(value.comparisonBaseline) || value.comparisonBaseline.length !== 6)) throw new Error("This team comparison is invalid.");
    const members = [...state.team, ...(value.comparisonBaseline || [])].filter(Boolean);
    members.forEach(member => {
      if (![member.build?.ivAtk, member.build?.ivDef, member.build?.ivHp].every(iv => Number.isInteger(iv) && iv >= 0 && iv <= 15)
        || !Array.isArray(member.chargedMoveIds) || !member.chargedMoveIds.length || member.chargedMoveIds.length > (member.selectedChargedMoveLimit || 2)
        || new Set(member.chargedMoveIds).size !== member.chargedMoveIds.length) throw new Error("This team's moves or IVs are invalid.");
    });
    const normalized = Team.normalizeState(state);
    const baseline = value.comparisonBaseline == null ? null : Team.normalizeState({ ...state, team: value.comparisonBaseline }).team;
    return { state: normalized, comparisonBaseline: baseline };
  }
  function normalize(value) {
    if (value?.schemaVersion !== 1 || !Array.isArray(value.teams) || value.teams.length > LIMIT) throw new Error("This saved-team library is incompatible or too large.");
    const ids = new Set();
    return { schemaVersion: 1, teams: value.teams.map(entry => {
      if (!entry?.id || typeof entry.id !== "string" || entry.id.length > 100 || ids.has(entry.id)) throw new Error("This team file contains invalid entries.");
      ids.add(entry.id);
      return { id: entry.id, name: name(entry.name), ...snapshot(entry) };
    }) };
  }
  function parse(text) {
    if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_BYTES) throw new Error("Choose a team JSON file smaller than 1 MB.");
    try { return normalize(JSON.parse(text)); }
    catch (error) { if (error instanceof SyntaxError) throw new Error("This is not a valid team JSON file."); throw error; }
  }
  function createStore(storage, makeId = () => globalThis.crypto.randomUUID()) {
    let current;
    function read() {
      const saved = storage.getItem(KEY);
      current = saved ? parse(saved) : { schemaVersion: 1, teams: [] };
      return clone(current);
    }
    function commit(next) {
      const normalized = normalize(next);
      const text = JSON.stringify(normalized);
      if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error("Your library is full. Export a backup before removing teams.");
      // Persist before publishing: a quota error must leave the old library intact.
      try { storage.setItem(KEY, text); } catch (_) { throw new Error("Could not save on this device. Check browser storage or export a backup."); }
      current = normalized;
      return clone(current);
    }
    function requireCurrent() { return read(); }
    function uniqueName(requested, teams) {
      const base = name(requested);
      let candidate = base, count = 2;
      while (teams.some(entry => entry.name.toLowerCase() === candidate.toLowerCase())) candidate = `${base.slice(0, 57)} (${count++})`;
      return candidate;
    }
    function add(requested, value) {
      const next = requireCurrent();
      const entry = { id: makeId(), name: uniqueName(requested, next.teams), ...snapshot(value) };
      next.teams.unshift(entry);
      return commit(next);
    }
    function rename(id, requested) {
      const next = requireCurrent(), entry = next.teams.find(team => team.id === id);
      if (!entry) throw new Error("Team no longer available.");
      entry.name = uniqueName(requested, next.teams.filter(team => team.id !== id));
      return commit(next);
    }
    function remove(id) {
      const next = requireCurrent();
      next.teams = next.teams.filter(team => team.id !== id);
      return commit(next);
    }
    function merge(imported) {
      const next = requireCurrent();
      const incoming = normalize(imported);
      for (const entry of incoming.teams) {
        // A repeated import should not create duplicates; conflicts never overwrite local teams.
        if (next.teams.some(team => team.name === entry.name && JSON.stringify(snapshot(team)) === JSON.stringify(snapshot(entry)))) continue;
        next.teams.push({ ...entry, id: makeId(), name: uniqueName(entry.name, next.teams) });
      }
      return commit(next);
    }
    return { read, add, rename, remove, merge, restore: commit, export: () => JSON.stringify(requireCurrent(), null, 2) };
  }
  return Object.freeze({ KEY, LIMIT, MAX_BYTES, snapshot, normalize, parse, createStore });
});
