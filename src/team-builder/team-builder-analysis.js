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

  function resultTone(result) {
    const score = Number(result?.score ?? 500);
    if (score >= 600) return "favorable";
    if (score <= 400) return "unfavorable";
    return "close";
  }

  function resultLabel(result) {
    const tone = resultTone(result);
    return tone === "favorable" ? "Win" : tone === "unfavorable" ? "Loss" : "Close";
  }

  function groupResults(plan, cache) {
    const groups = new Map();
    plan.forEach(job => {
      if (!groups.has(job.opponentId)) groups.set(job.opponentId, { opponentId: job.opponentId, cells: Array(6).fill(null) });
      groups.get(job.opponentId).cells[job.slot] = cache?.get(job.key) || null;
    });
    return [...groups.values()].map(group => Object.freeze({ opponentId: group.opponentId, cells: Object.freeze(group.cells) }));
  }

  function summarizeOpponent(group) {
    const cells = Array.isArray(group?.cells) ? group.cells : [];
    if (!cells.length || cells.some(result => !result)) return null;
    const scores = cells.map(result => Math.max(0, Math.min(1000, Number(result.score ?? 500))));
    const answerSlots = [];
    const closeSlots = [];
    const hardLossSlots = [];
    scores.forEach((score, slot) => {
      if (score >= 600) answerSlots.push(slot);
      else if (score <= 400) hardLossSlots.push(slot);
      else closeSlots.push(slot);
    });
    const teamSize = scores.length;
    const averageScore = Math.round(scores.reduce((sum, score) => sum + score, 0) / teamSize);
    const effectiveAnswers = answerSlots.length + (closeSlots.length * 0.5);
    const answerGap = 1 - (effectiveAnswers / teamSize);
    const lossIntensity = scores.reduce((sum, score) => sum + Math.max(0, 500 - score) / 500, 0) / teamSize;
    const severity = Math.max(0, Math.min(100, Math.round((answerGap * 65) + (lossIntensity * 35))));
    const severityLabel = severity >= 75 ? "Critical" : severity >= 55 ? "Major" : severity >= 35 ? "Moderate" : "Low";
    return Object.freeze({
      opponentId: group.opponentId,
      teamSize,
      answerCount: answerSlots.length,
      closeCount: closeSlots.length,
      hardLossCount: hardLossSlots.length,
      answerSlots: Object.freeze(answerSlots),
      closeSlots: Object.freeze(closeSlots),
      hardLossSlots: Object.freeze(hardLossSlots),
      averageScore,
      worstScore: Math.min(...scores),
      bestScore: Math.max(...scores),
      severity,
      severityLabel
    });
  }

  function analyzeCoverage(groups) {
    const summaries = (groups || []).map(summarizeOpponent).filter(Boolean);
    const threats = [...summaries].sort((a, b) =>
      b.severity - a.severity || a.answerCount - b.answerCount || a.averageScore - b.averageScore || a.opponentId.localeCompare(b.opponentId)
    );
    const bestCovered = [...summaries].sort((a, b) =>
      b.answerCount - a.answerCount || b.averageScore - a.averageScore || a.severity - b.severity || a.opponentId.localeCompare(b.opponentId)
    );
    return Object.freeze({
      completedOpponents: summaries.length,
      noAnswerCount: summaries.filter(summary => summary.answerCount === 0).length,
      threats: Object.freeze(threats),
      bestCovered: Object.freeze(bestCovered)
    });
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
    planProgress,
    resultTone,
    resultLabel,
    groupResults,
    summarizeOpponent,
    analyzeCoverage
  });
});
