(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./team-builder-analysis") : root.PvPeakTeamBuilderAnalysis);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakTeamOpponent = api;
})(globalThis, function (Analysis) {
  "use strict";
  const STORAGE_KEY = "pvpeak-opponent-team-v1";
  function energy(value) {
    const number = Number(value ?? 0);
    if (!Number.isInteger(number) || number < 0 || number > 100) throw new Error("Starting energy must be between 0 and 100.");
    return number;
  }
  function createPlan(input) {
    const jobs = [];
    input.team.forEach((member, slot) => {
      if (!member) return;
      input.opponentTeam.forEach((opponentMember, opponentSlot) => {
        if (!opponentMember) return;
        const opponentSignature = input.opponentSignatures?.[opponentSlot] || Analysis.memberSignature(opponentMember);
        const startEnergyA = energy(input.startEnergyA), startEnergyB = energy(input.startEnergyB);
        const job = { slot, member, opponentSlot, opponentMember, opponentId: opponentMember.pokemonId, opponentSignature, shields: input.shields || "1-1", startEnergyA, startEnergyB };
        const key = Analysis.jobKey({ ...input, ...job, providerId: "opponent-team" });
        jobs.push(Object.freeze({ ...job, key: startEnergyA || startEnergyB ? `${key}|energy:${startEnergyA}-${startEnergyB}` : key }));
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
  function isWin(result) { return !!result && (result.winner === "team" || (!result.winner && result.score > 500)); }
  function analyzeTrio(rows, slots) {
    const selected = [...new Set(slots)].sort((a,b) => a-b);
    const ready = selected.length === 3 && selected.every(slot => Number.isInteger(slot) && slot >= 0 && slot < 6)
      && rows.length > 0 && rows.every(row => selected.every(slot => row.cells[slot]));
    if (!ready) return { slots:selected, ready:false };
    const matchups = rows.map(row => {
      const answers = selected.filter(slot => isWin(row.cells[slot]));
      const draws = selected.filter(slot => row.cells[slot].winner === "draw" || (!row.cells[slot].winner && row.cells[slot].score === 500));
      const best = selected.reduce((a,b) => row.cells[a].score >= row.cells[b].score ? a : b);
      return { opponentSlot:row.slot, member:row.member, answers, draws, best, rating:row.cells[best].score };
    });
    return { slots:selected, ready:true, total:rows.length, covered:matchups.filter(row => row.answers.length).length,
      backups:matchups.filter(row => row.answers.length >= 2).length,
      weakest:Math.min(...matchups.map(row => row.rating)),
      average:Math.round(matchups.reduce((sum,row) => sum+row.rating,0)/rows.length),
      gaps:matchups.filter(row => !row.answers.length), matchups };
  }
  function suggestTrios(rows, availableSlots) {
    if (!rows.length || !rows.every(row => row.ready)) return [];
    const slots = [...new Set(availableSlots)].filter(slot => Number.isInteger(slot) && slot >= 0 && slot < 6).sort((a,b) => a-b);
    const candidates = [];
    for (let i=0;i<slots.length-2;i++) for (let j=i+1;j<slots.length-1;j++) for (let k=j+1;k<slots.length;k++) {
      const summary = analyzeTrio(rows,[slots[i],slots[j],slots[k]]);
      if (summary.ready) candidates.push(summary);
    }
    return candidates.sort((a,b) => b.covered-a.covered || b.weakest-a.weakest || b.backups-a.backups || b.average-a.average || a.slots.join('').localeCompare(b.slots.join('')));
  }
  return Object.freeze({ STORAGE_KEY, energy, createPlan, rows, analyzeTrio, suggestTrios });
});
