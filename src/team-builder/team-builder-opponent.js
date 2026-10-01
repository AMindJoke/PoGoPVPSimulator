(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./team-builder-analysis") : root.PvPeakTeamBuilderAnalysis);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakTeamOpponent = api;
})(globalThis, function (Analysis) {
  "use strict";
  const STORAGE_KEY = "pvpeak-opponent-team-v1";
  function createPlan(input) {
    const jobs = [];
    input.team.forEach((member, slot) => {
      if (!member) return;
      input.opponentTeam.forEach((opponentMember, opponentSlot) => {
        if (!opponentMember) return;
        const opponentSignature = input.opponentSignatures?.[opponentSlot] || Analysis.memberSignature(opponentMember);
        const job = { slot, member, opponentSlot, opponentMember, opponentId: opponentMember.pokemonId, opponentSignature, shields: input.shields || "1-1" };
        jobs.push(Object.freeze({ ...job, key: Analysis.jobKey({ ...input, ...job, providerId: "opponent-team" }) }));
      });
    });
    return Object.freeze(jobs);
  }
  function rows(plan, cache) {
    const grouped = new Map();
    plan.forEach(job => {
      if (!grouped.has(job.opponentSlot)) grouped.set(job.opponentSlot, { slot: job.opponentSlot, member: job.opponentMember, cells: Array(6).fill(null), expected: 0 });
      const row = grouped.get(job.opponentSlot);
      row.expected++; row.cells[job.slot] = cache.get(job.key);
    });
    return [...grouped.values()].sort((a, b) => a.slot - b.slot).map(row => {
      const results = row.cells.filter(Boolean), ready = results.length === row.expected;
      const wins = results.filter(result => result.winner === "team" || (!result.winner && result.score > 500));
      const draws = results.filter(result => result.winner === "draw" || (!result.winner && result.score === 500));
      const bestResult = ready && wins.length ? wins.reduce((a, b) => a.score >= b.score ? a : b) : null;
      const best = bestResult ? row.cells.indexOf(bestResult) : null;
      return { ...row, ready, wins: wins.length, draws: draws.length, best };
    });
  }
  return Object.freeze({ STORAGE_KEY, createPlan, rows });
});
