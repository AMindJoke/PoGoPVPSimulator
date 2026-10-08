(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakSimulationWorkerPool = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function workerLimit({ cores = 2, memory = 4, mobile = false } = {}) {
    return Math.max(1, Math.min(mobile ? 2 : 4, Math.floor(Number(cores) || 2) - 1, Number(memory) <= 2 ? 1 : 4));
  }
  // Every entry still goes through the unchanged, synchronous Battle handler.
  function batchWorkerSource(source) {
    return source + "\nconst handleSingleSimulation = self.onmessage;\nself.onmessage = event => {\n  const jobs = event.data?.simulationBatch;\n  if (!Array.isArray(jobs)) return handleSingleSimulation(event);\n  for (const job of jobs) handleSingleSimulation({data: job});\n};\n";
  }
  function createPool({ size, createWorker, onResult, onFailure, timeoutMs = 6000, setTimer = setTimeout, clearTimer = clearTimeout }) {
    const slots = [];
    let closed = false;
    function arm(slot) {
      clearTimer(slot.timer);
      slot.timer = setTimer(() => fail(slot), timeoutMs);
    }
    function fail(slot) {
      if (slot.dead) return;
      slot.dead = true;
      clearTimer(slot.timer);
      slot.worker.terminate();
      const unfinished = [...slot.pending.values()];
      slot.pending.clear();
      if (!closed && unfinished.length) onFailure(unfinished);
    }
    for (let i = 0; i < size; i++) {
      try {
        const worker = createWorker();
        const slot = { worker, pending: new Map(), timer: null, dead: false };
        worker.onmessage = event => {
          if (closed || slot.dead) return;
          const message = event.data || {};
          const job = slot.pending.get(message.id);
          if (!job || job.key !== message.key) return;
          slot.pending.delete(message.id);
          if (slot.pending.size) arm(slot);
          else { clearTimer(slot.timer); slot.timer = null; }
          onResult(message);
        };
        worker.onerror = () => fail(slot);
        slots.push(slot);
      } catch (_) { break; }
    }
    return {
      available: () => closed ? 0 : slots.filter(s => !s.dead && !s.pending.size).length,
      alive: () => !closed && slots.some(s => !s.dead),
      dispatch(jobs) {
        const slot = !closed && slots.find(s => !s.dead && !s.pending.size);
        if (!slot || !jobs.length) return false;
        for (const job of jobs) slot.pending.set(job.id, job);
        arm(slot);
        try { slot.worker.postMessage({ simulationBatch: jobs }); }
        catch (_) { fail(slot); }
        return true;
      },
      dispose() {
        closed = true;
        for (const slot of slots) { clearTimer(slot.timer); slot.worker.terminate(); slot.pending.clear(); slot.dead = true; }
      }
    };
  }
  return Object.freeze({ workerLimit, batchWorkerSource, createPool });
});
