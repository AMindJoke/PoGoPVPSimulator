(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakTeamBuilderAnalysis = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = "pvpeak-team-builder-analysis-v1";
  const MAX_CACHE_ENTRIES = 4800;

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
      score: Math.max(0, Math.min(1000, Math.round(Number(result.score ?? 500)))),
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
    return resultPresentation(result).tone;
  }

  function resultPresentation(result) {
    const score = Math.max(0, Math.min(1000, Number(result?.score ?? 500)));
    if (score === 500) return Object.freeze({ tone: "neutral", tier: "neutral" });
    if (score > 500) return Object.freeze({
      tone: "favorable",
      tier: score >= 751 ? "dominant" : score >= 651 ? "clear" : "slight"
    });
    return Object.freeze({
      tone: "unfavorable",
      tier: score <= 249 ? "dominant" : score <= 349 ? "clear" : "slight"
    });
  }

  function resultLabel(result) {
    const tone = resultTone(result);
    return tone === "favorable" ? "Win" : tone === "unfavorable" ? "Loss" : "Neutral";
  }

  function groupResults(plan, cache) {
    const groups = new Map();
    const activeSlots = [...new Set((plan || []).map(job => job.slot).filter(Number.isInteger))].sort((a, b) => a - b);
    plan.forEach(job => {
      if (!groups.has(job.opponentId)) groups.set(job.opponentId, { opponentId: job.opponentId, cells: Array(6).fill(null) });
      groups.get(job.opponentId).cells[job.slot] = cache?.get(job.key) || null;
    });
    return [...groups.values()].map(group => Object.freeze({ opponentId: group.opponentId, cells: Object.freeze(group.cells), activeSlots: Object.freeze([...activeSlots]) }));
  }

  function summarizeOpponent(group) {
    const cells = Array.isArray(group?.cells) ? group.cells : [];
    const activeSlots = Array.isArray(group?.activeSlots) ? group.activeSlots : cells.map((_, slot) => slot);
    if (!activeSlots.length || activeSlots.some(slot => !cells[slot])) return null;
    const completed = activeSlots.map(slot => Object.freeze({ result: cells[slot], slot }));
    if (!completed.length) return null;
    const scores = completed.map(item => Math.max(0, Math.min(1000, Number(item.result.score ?? 500))));
    const answerSlots = [];
    const closeSlots = [];
    const hardLossSlots = [];
    scores.forEach((score, index) => {
      const slot = completed[index].slot;
      if (score > 500) answerSlots.push(slot);
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

  function rankThreatGroups(groups) {
    return Object.freeze((groups || []).map((group, index) => ({ group, index, summary: summarizeOpponent(group) })).sort((a, b) => {
      if (a.summary && !b.summary) return -1;
      if (!a.summary && b.summary) return 1;
      if (!a.summary && !b.summary) return a.index - b.index;
      return a.summary.answerCount - b.summary.answerCount
        || b.summary.severity - a.summary.severity
        || a.summary.bestScore - b.summary.bestScore
        || a.summary.averageScore - b.summary.averageScore
        || a.group.opponentId.localeCompare(b.group.opponentId);
    }).map(item => Object.freeze({ ...item.group, threatSummary: item.summary })));
  }

  function analyzeCores(groups, teamSize = 6) {
    const completeGroups = (groups || []).filter(group =>
      Array.isArray(group?.cells) && group.cells.length >= teamSize && group.cells.slice(0, teamSize).every(Boolean)
    );
    const weakCores = [];
    for (let firstSlot = 0; firstSlot < teamSize; firstSlot += 1) {
      for (let secondSlot = firstSlot + 1; secondSlot < teamSize; secondSlot += 1) {
        const sharedLosses = completeGroups.map(group => {
          const firstScore = Number(group.cells[firstSlot].score ?? 500);
          const secondScore = Number(group.cells[secondSlot].score ?? 500);
          if (firstScore > 400 || secondScore > 400) return null;
          return Object.freeze({
            opponentId: group.opponentId,
            averageScore: Math.round((firstScore + secondScore) / 2),
            severity: Math.round(((500 - firstScore) + (500 - secondScore)) / 10)
          });
        }).filter(Boolean).sort((a, b) => b.severity - a.severity || a.averageScore - b.averageScore || a.opponentId.localeCompare(b.opponentId));
        if (!sharedLosses.length) continue;
        weakCores.push(Object.freeze({
          slots: Object.freeze([firstSlot, secondSlot]),
          sharedLossCount: sharedLosses.length,
          averageLossScore: Math.round(sharedLosses.reduce((sum, loss) => sum + loss.averageScore, 0) / sharedLosses.length),
          opponents: Object.freeze(sharedLosses)
        }));
      }
    }
    weakCores.sort((a, b) => b.sharedLossCount - a.sharedLossCount || a.averageLossScore - b.averageLossScore || a.slots[0] - b.slots[0] || a.slots[1] - b.slots[1]);

    const fragileAnswers = completeGroups.map(group => {
      const summary = summarizeOpponent(group);
      if (!summary || summary.answerCount !== 1) return null;
      const answerSlot = summary.answerSlots[0];
      const answerScore = Number(group.cells[answerSlot].score ?? 500);
      const alternatives = group.cells.map((result, slot) => ({ slot, score: Number(result.score ?? 500) })).filter(item => item.slot !== answerSlot).sort((a, b) => b.score - a.score);
      return Object.freeze({
        opponentId: group.opponentId,
        answerSlot,
        answerScore,
        backupSlot: alternatives[0]?.slot ?? null,
        backupScore: alternatives[0]?.score ?? 0,
        hardLossCount: summary.hardLossCount,
        severity: summary.severity,
        severityLabel: summary.severityLabel
      });
    }).filter(Boolean).sort((a, b) => b.severity - a.severity || b.hardLossCount - a.hardLossCount || a.backupScore - b.backupScore || a.opponentId.localeCompare(b.opponentId));

    return Object.freeze({
      completedOpponents: completeGroups.length,
      weakCores: Object.freeze(weakCores),
      fragileAnswers: Object.freeze(fragileAnswers)
    });
  }

  function scoreReplacementCandidate(candidateId, baselineByOpponent, candidateByOpponent) {
    const targets = Object.keys(baselineByOpponent || {});
    if (!targets.length || targets.some(opponentId => !baselineByOpponent[opponentId] || !candidateByOpponent?.[opponentId])) return null;
    let baselineTotal = 0;
    let candidateTotal = 0;
    let favorableGained = 0;
    let hardLossesFixed = 0;
    let newHardLosses = 0;
    const changes = targets.map(opponentId => {
      const baselineScore = Number(baselineByOpponent[opponentId].score ?? 500);
      const candidateScore = Number(candidateByOpponent[opponentId].score ?? 500);
      baselineTotal += baselineScore;
      candidateTotal += candidateScore;
      if (baselineScore < 600 && candidateScore >= 600) favorableGained += 1;
      if (baselineScore <= 400 && candidateScore > 400) hardLossesFixed += 1;
      if (baselineScore > 400 && candidateScore <= 400) newHardLosses += 1;
      return Object.freeze({ opponentId, baselineScore, candidateScore, delta: candidateScore - baselineScore });
    }).sort((a, b) => b.delta - a.delta || a.opponentId.localeCompare(b.opponentId));
    const baselineAverage = Math.round(baselineTotal / targets.length);
    const candidateAverage = Math.round(candidateTotal / targets.length);
    const averageDelta = candidateAverage - baselineAverage;
    const replacementScore = averageDelta + (hardLossesFixed * 40) + (favorableGained * 25) - (newHardLosses * 50);
    return Object.freeze({
      candidateId,
      targetCount: targets.length,
      baselineAverage,
      candidateAverage,
      averageDelta,
      favorableGained,
      hardLossesFixed,
      newHardLosses,
      replacementScore,
      changes: Object.freeze(changes)
    });
  }

  function rankReplacementCandidates(input = {}) {
    return Object.entries(input.candidates || {}).map(([candidateId, results]) =>
      scoreReplacementCandidate(candidateId, input.baselineByOpponent || {}, results)
    ).filter(Boolean).sort((a, b) =>
      b.replacementScore - a.replacementScore || b.averageDelta - a.averageDelta || b.hardLossesFixed - a.hardLossesFixed || a.newHardLosses - b.newHardLosses || a.candidateId.localeCompare(b.candidateId)
    );
  }

  function summarizeTeamCoverage(groups) {
    const opponents = (groups || []).map(group => {
      const summary = summarizeOpponent(group);
      if (!summary) return null;
      return Object.freeze({ ...summary, bestScore: Math.max(...group.cells.map(result => Number(result.score ?? 500))) });
    }).filter(Boolean);
    if (!opponents.length) return Object.freeze({ opponentCount: 0, coverageRating: 0, averageRating: 0, favorableMatchups: 0, noAnswerCount: 0, opponents: Object.freeze([]) });
    const cellCount = opponents.reduce((count, item) => count + item.teamSize, 0);
    return Object.freeze({
      opponentCount: opponents.length,
      coverageRating: Math.round(opponents.reduce((sum, item) => sum + item.bestScore, 0) / opponents.length),
      averageRating: Math.round(opponents.reduce((sum, item) => sum + (item.averageScore * item.teamSize), 0) / cellCount),
      favorableMatchups: opponents.reduce((sum, item) => sum + item.answerCount, 0),
      noAnswerCount: opponents.filter(item => item.answerCount === 0).length,
      opponents: Object.freeze(opponents)
    });
  }

  function compareTeamCoverage(groupsA, groupsB) {
    const teamA = summarizeTeamCoverage(groupsA);
    const teamB = summarizeTeamCoverage(groupsB);
    const byA = new Map(teamA.opponents.map(item => [item.opponentId, item]));
    const byB = new Map(teamB.opponents.map(item => [item.opponentId, item]));
    const changes = [...byA.keys()].filter(id => byB.has(id)).map(opponentId => {
      const a = byA.get(opponentId);
      const b = byB.get(opponentId);
      const answerDelta = b.answerCount - a.answerCount;
      const bestScoreDelta = b.bestScore - a.bestScore;
      const averageDelta = b.averageScore - a.averageScore;
      const impact = (answerDelta * 100) + bestScoreDelta;
      return Object.freeze({ opponentId, answerCountA: a.answerCount, answerCountB: b.answerCount, bestScoreA: a.bestScore, bestScoreB: b.bestScore, answerDelta, bestScoreDelta, averageDelta, impact });
    });
    const gains = changes.filter(item => item.impact > 0).sort((a, b) => b.impact - a.impact || b.bestScoreDelta - a.bestScoreDelta || a.opponentId.localeCompare(b.opponentId));
    const losses = changes.filter(item => item.impact < 0).sort((a, b) => a.impact - b.impact || a.bestScoreDelta - b.bestScoreDelta || a.opponentId.localeCompare(b.opponentId));
    return Object.freeze({
      comparableOpponents: changes.length,
      teamA,
      teamB,
      deltas: Object.freeze({ coverageRating: teamB.coverageRating - teamA.coverageRating, averageRating: teamB.averageRating - teamA.averageRating, favorableMatchups: teamB.favorableMatchups - teamA.favorableMatchups, noAnswerCount: teamB.noAnswerCount - teamA.noAnswerCount }),
      gains: Object.freeze(gains),
      losses: Object.freeze(losses),
      unchangedCount: changes.filter(item => item.impact === 0).length
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
    resultPresentation,
    resultTone,
    resultLabel,
    groupResults,
    summarizeOpponent,
    analyzeCoverage,
    rankThreatGroups,
    analyzeCores,
    scoreReplacementCandidate,
    rankReplacementCandidates,
    summarizeTeamCoverage,
    compareTeamCoverage
  });
});
