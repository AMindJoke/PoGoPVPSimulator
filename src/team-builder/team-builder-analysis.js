(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakTeamBuilderAnalysis = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = "pvpeak-team-builder-analysis-v1";
  const MAX_CACHE_ENTRIES = 2400;

  function memberSignature(member) {
    if (!member) return "empty";
    const build = member.build || {};
    return [
      member.pokemonId,
      member.fastMoveId,
      ...(member.chargedMoveIds || []),
      build.profile,
      build.ivAtk,
      build.ivDef,
      build.ivHp,
      build.level,
      build.cp
    ].map(value => String(value ?? "")).join("~");
  }

  function jobKey(input) {
    return [
      `team-analysis-v${SCHEMA_VERSION}`,
      input.engineVersion,
      input.providerId,
      input.shields,
      memberSignature(input.member),
      input.opponentId,
      input.opponentSignature || input.opponentId
    ].join("|");
  }

  function createPlan(input = {}) {
    const team = Array.isArray(input.team) ? input.team : [];
    const opponentIds = [...new Set((input.opponentIds || []).filter(Boolean).map(String))];
    const jobs = [];
    team.forEach((member, slot) => {
      if (!member) return;
      opponentIds.forEach(opponentId => {
        const opponentSignature = input.opponentSignatures?.[opponentId] || opponentId;
        jobs.push(Object.freeze({
          key: jobKey({ ...input, member, opponentId, opponentSignature }),
          slot,
          member,
          opponentId,
          opponentSignature,
          shields: input.shields || "1-1"
        }));
      });
    });
    return Object.freeze(jobs);
  }

  function normalizeResult(job, result = {}) {
    const winnerEdge = Number(result.details?.winnerEdge || 0);
    const winner = winnerEdge > 0 ? "team" : winnerEdge < 0 ? "meta" : "draw";
    return Object.freeze({
      key: job.key,
      slot: job.slot,
      pokemonId: job.member.pokemonId,
      opponentId: job.opponentId,
      shields: job.shields,
      score: Math.max(0, Math.min(1000, Math.round(Number(result.score || 500)))),
      winner,
      teamHpRatio: Math.max(0, Math.min(1, Number(Number(result.details?.aHp || 0).toFixed(3)))),
      metaHpRatio: Math.max(0, Math.min(1, Number(Number(result.details?.bHp || 0).toFixed(3)))),
      engineVersion: String(result.provenance?.currentEngineVersion || "unknown")
    });
  }

  function createCache(storage = null) {
    const entries = new Map();
    try {
      const saved = JSON.parse(storage?.getItem?.(STORAGE_KEY) || "null");
      if (saved?.schemaVersion === SCHEMA_VERSION && Array.isArray(saved.entries)) {
        saved.entries.slice(-MAX_CACHE_ENTRIES).forEach(([key, value]) => { if (key && value) entries.set(key, value); });
      }
    } catch (_) {}
    function persist() {
      if (!storage?.setItem) return;
      try {
        const compact = [...entries.entries()].slice(-MAX_CACHE_ENTRIES);
        storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: SCHEMA_VERSION, entries: compact }));
      } catch (_) {}
    }
    return Object.freeze({
      get(key) { return entries.get(key) || null; },
      has(key) { return entries.has(key); },
      set(key, value) {
        if (entries.has(key)) entries.delete(key);
        entries.set(key, value);
        while (entries.size > MAX_CACHE_ENTRIES) entries.delete(entries.keys().next().value);
      },
      persist,
      clear() { entries.clear(); persist(); },
      size() { return entries.size; }
    });
  }

  function planProgress(plan, cache) {
    const cached = plan.reduce((count, job) => count + Number(cache?.has(job.key)), 0);
    return Object.freeze({ total: plan.length, cached, pending: plan.length - cached });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    STORAGE_KEY,
    MAX_CACHE_ENTRIES,
    memberSignature,
    jobKey,
    createPlan,
    normalizeResult,
    createCache,
    planProgress
  });
});
