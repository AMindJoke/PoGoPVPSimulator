"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakMetaQuickMatchupModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const scenarios = ["1-1", "0-0", "0-1", "0-2", "1-0", "1-2", "2-0", "2-1", "2-2"];

  function timelineModel(events = []) {
    const rows = events.filter(event => ["A", "B"].includes(event.trainer))
      .map(event => ({ ...event, start: Math.max(0, Number(event.start) || 0), duration: Math.max(1, Number(event.duration) || 1) }));
    const turns = Math.max(1, ...rows.map(event => event.start + event.duration));
    return { turns, seconds: turns / 2, rows };
  }

  function createRunner(makeWorker, timeoutMs = 20000) {
    let worker = null, timer = null, generation = 0, state = null, queue = [], callback = null;
    let currentId = 0;
    const cache = new Map();
    function cancel() {
      generation++;
      clearTimeout(timer);
      timer = null;
      if (worker) worker.terminate();
      worker = null;
      queue = [];
    }
    function emit() { callback?.({ ...state, cells: { ...state.cells } }); }
    function fail() {
      cancel();
      state.status = "error";
      emit();
    }
    function start(config, key, onUpdate) {
      cancel();
      callback = onUpdate;
      state = { key, status: "loading", cells: {} };
      if (cache.has(key)) {
        const cells = cache.get(key);
        cache.delete(key);
        cache.set(key, cells);
        state = { key, status: "ready", cells };
        emit();
        return;
      }
      const token = generation;
      queue = [...scenarios];
      emit();
      try { worker = makeWorker(); } catch (_) { fail(); return; }
      function next() {
        if (token !== generation) return;
        if (!queue.length) {
          cache.set(key, { ...state.cells });
          if (cache.size > 8) cache.delete(cache.keys().next().value);
          state.status = "ready";
          cancel();
          emit();
          return;
        }
        const shields = queue.shift();
        const id = ++currentId;
        worker.onmessage = event => {
          if (token !== generation || event.data?.id !== id) return;
          clearTimeout(timer);
          const message = event.data;
          if (message.type !== "matrixCellResult" || !Number.isFinite(message.result?.score)) { fail(); return; }
          state.cells[shields] = message.result;
          emit();
          next();
        };
        worker.onerror = () => { if (token === generation) fail(); };
        timer = setTimeout(() => { if (token === generation) fail(); }, timeoutMs);
        try {
          const [aShields, bShields] = shields.split("-").map(Number);
          worker.postMessage({ id, source: "live", signature: key, key: `${key}|${shields}`,
            config, aShields, bShields, includeSwing: true, debugTimeline: true });
        } catch (_) { fail(); }
      }
      next();
    }
    function prioritize(shields) {
      if (queue.includes(shields)) queue = [shields, ...queue.filter(item => item !== shields)];
    }
    return { start, cancel, prioritize };
  }
  // Charged attacks get the same visual pause as Battle. It is display space,
  // not extra simulation turns; opposing shields share their attack's slot.
  function compactTimelineModel(events = [], windowTurns = 7, pauseTurns = 9) {
    const timeline = timelineModel(events);
    const charges = timeline.rows.map((event, index) => ({ event, index }))
      .filter(({ event }) => event.kind === "charge" || event.kind === "charged");
    const before = (turn, index = Infinity) => charges.filter(item => item.event.start < turn || (item.event.start === turn && item.index < index)).length;
    const rows = timeline.rows.map((event, index) => {
      const kind = event.kind === "charged" ? "charge" : event.kind;
      if (!["fast", "charge", "shield", "form-protect"].includes(kind)) return null;
      const paired = ["shield", "form-protect"].includes(kind)
        ? [...charges].reverse().find(item => item.index < index && item.event.start === event.start && item.event.trainer !== event.trainer && item.event.moveId === event.moveId)
        : null;
      const attack = kind === "charge" ? { event, index } : paired;
      if (attack) {
        const start = attack.event.start + before(attack.event.start, attack.index) * pauseTurns;
        return { ...event, kind, visualStart: start, visualTurn: start + windowTurns };
      }
      const impact = kind === "fast" ? Math.max(event.start, event.start + event.duration - 1) : event.start;
      return { ...event, kind, visualTurn: impact + before(impact) * pauseTurns };
    }).filter(Boolean);
    const step = timeline.turns > 50 ? 10 : 5;
    const tickTurns = [...new Set([0, ...Array.from({ length: Math.floor(timeline.turns / step) }, (_, i) => (i + 1) * step).filter(turn => timeline.turns - turn >= step / 2), timeline.turns])];
    return { ...timeline, rows, visualTurns: timeline.turns + charges.length * pauseTurns + 2,
      minWidth: Math.max(240, timeline.turns * 4 + charges.length * 28 + 24),
      ticks: tickTurns.map(turn => ({ turn, visualTurn: turn + (turn === 0 ? 0 : before(turn)) * pauseTurns })) };
  }
  return { scenarios, timelineModel, compactTimelineModel, createRunner };
});
