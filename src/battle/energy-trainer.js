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

  function displayMoveName(value) {
    const name = String(value || "");
    return /^Weather Ball \((?:Fire|Ice|Normal|Rock|Water)\)$/i.test(name) ? "Weather Ball" : name;
  }

  function createNextCycleModel({ usedMove, chargedMoves = [], remainingEnergy = 0, fastMove } = {}) {
    const fastEnergy = Number(fastMove?.energyGain || 0);
    const validCharged = chargedMoves.slice(0, 2).filter(move =>
      move && Number.isFinite(Number(move.energyCost)) && Number(move.energyCost) > 0
    );
    if (!usedMove || !Number.isFinite(fastEnergy) || fastEnergy <= 0 || !validCharged.length) return null;
    const residual = Math.max(0, Number(remainingEnergy) || 0);
    // Whole Fast-Move gains in the residual are overfarm; Next Cycle teaches the
    // repeating cycle, so only the irreducible carry influences the next count.
    const cycleCarryEnergy = residual % fastEnergy;
    const rows = validCharged.map(move => {
      const cost = Math.max(0, Number(move.energyCost));
      const fastMovesNeeded = Math.max(0, Math.ceil((cost - cycleCarryEnergy) / fastEnergy));
      return Object.freeze({
        moveId: move.id || null,
        name: displayMoveName(move.name || move.id),
        type: move.type || null,
        cost,
        fastMovesNeeded,
        ready: fastMovesNeeded === 0
      });
    });
    return Object.freeze({
      usedMoveId: usedMove.id || null,
      usedMoveName: displayMoveName(usedMove.name || usedMove.id),
      fastMoveId: fastMove.id || null,
      fastMoveName: displayMoveName(fastMove.name || fastMove.id),
      fastEnergy,
      remainingEnergy: residual,
      cycleCarryEnergy,
      rows: Object.freeze(rows)
    });
  }

  function shouldPresentNextCycle({ executionOk = false, actionType, actionSide, trackedSide, model } = {}) {
    return executionOk === true
      && ["charged", "charged_move", "CHARGED_MOVE"].includes(actionType)
      && !!actionSide
      && actionSide === trackedSide
      && !!model;
  }

  function createNextCycleController(options = {}) {
    const schedule = options.schedule || ((callback, delay) => setTimeout(callback, delay));
    const cancel = options.cancel || (timer => clearTimeout(timer));
    const onChange = typeof options.onChange === "function" ? options.onChange : () => {};
    const entranceMs = Math.max(0, Number(options.entranceMs ?? 190));
    const visibleMs = Math.max(0, Number(options.visibleMs ?? 2500));
    const exitMs = Math.max(0, Number(options.exitMs ?? 220));
    const persistent = options.persistent === true;
    let state = null;
    let sequence = 0;
    let entranceTimer = null;
    let hideTimer = null;
    let clearTimer = null;

    function cancelTimers() {
      [entranceTimer, hideTimer, clearTimer].forEach(timer => {
        if (timer !== null) cancel(timer);
      });
      entranceTimer = null;
      hideTimer = null;
      clearTimer = null;
    }

    function publish() {
      onChange(state);
      return state;
    }

    function clear({ notify = true } = {}) {
      cancelTimers();
      state = null;
      if (notify) publish();
      return null;
    }

    function show(payload) {
      if (!payload) return clear();
      cancelTimers();
      const token = ++sequence;
      state = Object.freeze({ ...payload, token, phase: persistent ? "visible" : "entering" });
      publish();
      if (persistent) return state;
      entranceTimer = schedule(() => {
        entranceTimer = null;
        if (!state || state.token !== token) return;
        state = Object.freeze({ ...state, phase: "visible" });
        publish();
      }, entranceMs);
      hideTimer = schedule(() => {
        hideTimer = null;
        if (!state || state.token !== token) return;
        state = Object.freeze({ ...state, phase: "leaving" });
        publish();
        clearTimer = schedule(() => {
          clearTimer = null;
          if (!state || state.token !== token) return;
          state = null;
          publish();
        }, exitMs);
      }, entranceMs + visibleMs);
      return state;
    }

    return Object.freeze({
      show,
      clear,
      getState: () => state
    });
  }

  return Object.freeze({
    createTileModel,
    createChargedThresholdModel,
    shouldAnimateCompletion,
    displayMoveName,
    createNextCycleModel,
    shouldPresentNextCycle,
    createNextCycleController
  });
});
