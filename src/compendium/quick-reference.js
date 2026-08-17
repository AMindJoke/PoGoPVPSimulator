(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakQuickReference = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function deriveTurnMilliseconds(rawMoves, reference) {
    const listedFastIds = new Set((reference?.fast || []).map(move => move.sourceId));
    const frequencies = new Map();
    (rawMoves || []).forEach(move => {
      if (!listedFastIds.has(move.moveId)) return;
      const turns = Math.max(1, Math.round(finite(move.turns, 0)));
      const cooldown = finite(move.cooldown, 0);
      if (!cooldown) return;
      const interval = Math.round(cooldown / turns);
      frequencies.set(interval, (frequencies.get(interval) || 0) + 1);
    });
    return [...frequencies.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] || 500;
  }

  function create({ settings = {}, rawMoves = [], reference = null, maxEnergy = 100, maxShields = 2 } = {}) {
    const maxStatStage = Math.max(1, Math.round(finite(settings.maxBuffStages, 4)));
    const turnMilliseconds = deriveTurnMilliseconds(rawMoves, reference);
    const durationCounts = new Map();
    (reference?.fast || []).forEach(move => durationCounts.set(move.turns, (durationCounts.get(move.turns) || 0) + 1));
    const fastDurations = Object.freeze([...durationCounts.entries()].sort((a, b) => a[0] - b[0]).map(([turns, moveCount]) => Object.freeze({
      turns,
      seconds: turns * turnMilliseconds / 1000,
      moveCount
    })));
    return Object.freeze({
      maxEnergy: Math.max(1, Math.round(finite(maxEnergy, 100))),
      maxShields: Math.max(0, Math.round(finite(maxShields, 2))),
      maxStatStage,
      minStatStage: -maxStatStage,
      partySize: Math.max(1, Math.round(finite(settings.partySize, 3))),
      turnMilliseconds,
      turnSeconds: turnMilliseconds / 1000,
      fastDurations
    });
  }

  return Object.freeze({ deriveTurnMilliseconds, create });
});
