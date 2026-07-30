(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakEnergyTrainer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createTileModel({ energy = 0, fastEnergy = 1, maxEnergy = 100 } = {}) {
    const ceiling = Math.max(1, Number(maxEnergy) || 100);
    const gain = Math.max(1, Number(fastEnergy) || 1);
    let remaining = Math.max(0, Math.min(ceiling, Number(energy) || 0));
    const count = Math.ceil(ceiling / gain);
    const tiles = Array.from({ length: count }, (_, index) => {
      const capacity = index === count - 1 ? ceiling - gain * (count - 1) : gain;
      const amount = Math.max(0, Math.min(capacity, remaining));
      remaining -= amount;
      const complete = amount === capacity;
      return Object.freeze({
        index,
        capacity,
        amount,
        fill: amount / capacity,
        state: complete ? "full" : amount > 0 ? "partial" : "empty",
        complete
      });
    });
    return Object.freeze({ energy: Math.max(0, Math.min(ceiling, Number(energy) || 0)), fastEnergy: gain, maxEnergy: ceiling, tiles });
  }

  function createChargedThresholdModel(moves = [], energy = 0) {
    return moves.slice(0, 2)
      .map(move => ({ move, cost: Math.max(0, Math.min(100, Number(move?.energyCost || 0))) }))
      .sort((a, b) => a.cost - b.cost)
      .map((entry, index, sorted) => Object.freeze({
        ...entry,
        positionPercent: entry.cost,
        lane: index && Math.abs(entry.cost - sorted[index - 1].cost) < 24 ? 1 : 0,
        edge: entry.cost < 18 ? "start" : entry.cost > 82 ? "end" : "middle",
        ready: Number(energy) >= entry.cost
      }));
  }

  function shouldAnimateCompletion({ previous, current, eventKind, eventId, suppressed = false } = {}) {
    if (suppressed || !previous || !current || eventKind !== "fast" || eventId === previous.eventId) return false;
    const expectedGain = Math.min(current.fastEnergy, current.maxEnergy - previous.energy);
    return previous.side === current.side
      && previous.fastId === current.fastId
      && current.completeCount === previous.completeCount + 1
      && current.energy - previous.energy === expectedGain;
  }

  return Object.freeze({ createTileModel, createChargedThresholdModel, shouldAnimateCompletion });
});
