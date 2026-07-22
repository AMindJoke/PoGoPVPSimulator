"use strict";

(function exposePvPeakPerfDebug(root, factory) {
  const api = factory({ root });
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.createPvPeakPerfDebugApi = factory;
    root.PvPeakPerfDebug = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createPvPeakPerfDebugApi(options = {}) {
  const root = options.root || (typeof globalThis !== "undefined" ? globalThis : null);
  const enabled = options.enabled === undefined ? detectEnabled(root) : options.enabled === true;
  const noop = () => null;
  const disabledApi = Object.freeze({
    enabled: false,
    createApi: createPvPeakPerfDebugApi,
    beginRun: noop,
    finishRun: noop,
    startSpan: noop,
    endSpan: noop,
    measure: (_name, callback) => callback(),
    measureAsync: (_name, callback) => callback(),
    increment: noop,
    gauge: noop,
    recordCache: noop,
    recordClone: noop,
    recordSerialization: noop,
    recordWorker: noop,
    merge: noop,
    mark: noop,
    getRun: noop,
    getLatest: noop,
    getHistory: () => [],
    subscribe: () => noop,
    installDashboard: noop,
    dispose: noop
  });
  if (!enabled) return disabledApi;

  const clock = options.clock || (() => root?.performance?.now?.() ?? Date.now());
  const epoch = options.epoch || (() => Date.now());
  const context = String(options.context || "main");
  const historyLimit = Math.max(2, Number(options.historyLimit || 20));
  const storageKey = "pvpeak-perf-debug-history-v1";
  const runs = new Map();
  const listeners = new Set();
  const history = loadHistory();
  let currentRunId = null;
  let sequence = 0;
  let dashboard = null;
  let longTaskObserver = null;
  let gcObserver = null;

  function detectEnabled(target) {
    try {
      if (target?.PERF_DEBUG === true || target?.PERF_DEBUG === 1 || String(target?.PERF_DEBUG || "").toLowerCase() === "true") return true;
      const params = target?.location?.search ? new URLSearchParams(target.location.search) : null;
      if (params?.get("perfDebug") === "1") return true;
      return target?.localStorage?.getItem("PERF_DEBUG") === "1";
    } catch (_) {
      return false;
    }
  }

  function beginRun(name, metadata = {}) {
    const id = `${context}:${String(name || "run")}:${epoch()}:${++sequence}`;
    const memory = memoryBytes();
    const run = {
      id,
      name: String(name || "run"),
      context,
      metadata: shallowCopy(metadata),
      startedAt: clock(),
      startedEpoch: epoch(),
      finishedAt: null,
      durationMs: 0,
      metrics: Object.create(null),
      counters: Object.create(null),
      gauges: Object.create(null),
      caches: Object.create(null),
      events: [],
      spans: [],
      openSpans: new Map(),
      warnings: [],
      memoryStart: memory,
      memoryEnd: null,
      memoryPeak: memory,
      allocationsEstimate: 0
    };
    runs.set(id, run);
    currentRunId = id;
    notify("start", run);
    return id;
  }

  function finishRun(runId = currentRunId, metadata = {}) {
    const run = runs.get(runId);
    if (!run || run.finishedAt != null) return run ? publicRun(run) : null;
    const finishedAt = clock();
    for (const token of [...run.openSpans.values()]) endSpan(token);
    run.finishedAt = finishedAt;
    run.durationMs = Math.max(0, finishedAt - run.startedAt);
    run.metrics.total = Math.max(Number(run.metrics.total || 0), run.durationMs);
    run.metadata = { ...run.metadata, ...shallowCopy(metadata) };
    run.memoryEnd = memoryBytes();
    run.memoryPeak = Math.max(Number(run.memoryPeak || 0), Number(run.memoryEnd || 0));
    if (run.memoryStart != null && run.memoryEnd != null) run.gauges.memoryDeltaBytes = run.memoryEnd - run.memoryStart;
    run.gauges.peakMemoryBytes = run.memoryPeak || 0;
    finalizeCaches(run);
    run.warnings = buildWarnings(run);
    const snapshot = publicRun(run);
    appendHistory(snapshot);
    notify("finish", snapshot);
    if (currentRunId === runId) currentRunId = latestOpenRunId();
    return snapshot;
  }

  function startSpan(name, runId = currentRunId, metadata = {}) {
    const run = ensureRun(runId, "unscoped");
    if (!run) return null;
    const token = {
      id: `${run.id}:span:${++sequence}`,
      runId: run.id,
      name: String(name || "span"),
      startedAt: clock(),
      metadata: shallowCopy(metadata)
    };
    run.openSpans.set(token.id, token);
    return token;
  }

  function endSpan(token, metadata = {}) {
    if (!token) return 0;
    const run = runs.get(token.runId);
    if (!run || !run.openSpans.has(token.id)) return 0;
    const endedAt = clock();
    const durationMs = Math.max(0, endedAt - token.startedAt);
    run.openSpans.delete(token.id);
    run.metrics[token.name] = Number(run.metrics[token.name] || 0) + durationMs;
    run.spans.push({
      name: token.name,
      startMs: Math.max(0, token.startedAt - run.startedAt),
      durationMs,
      metadata: { ...token.metadata, ...shallowCopy(metadata) }
    });
    sampleMemory(run);
    return durationMs;
  }

  function measure(name, callback, runId = currentRunId, metadata = {}) {
    const span = startSpan(name, runId, metadata);
    try {
      return callback();
    } finally {
      endSpan(span);
    }
  }

  async function measureAsync(name, callback, runId = currentRunId, metadata = {}) {
    const span = startSpan(name, runId, metadata);
    try {
      return await callback();
    } finally {
      endSpan(span);
    }
  }

  function increment(name, amount = 1, runId = currentRunId) {
    const run = ensureRun(runId, "unscoped");
    if (!run) return;
    run.counters[name] = Number(run.counters[name] || 0) + Number(amount || 0);
  }

  function gauge(name, value, runId = currentRunId) {
    const run = ensureRun(runId, "unscoped");
    if (!run) return;
    const number = Number(value);
    if (Number.isFinite(number)) run.gauges[name] = number;
  }

  function recordCache(name, hit, details = {}, runId = currentRunId) {
    const run = ensureRun(runId, "unscoped");
    if (!run) return;
    const cache = run.caches[name] || (run.caches[name] = { hits: 0, misses: 0, lookupMs: 0, insertMs: 0, size: 0, memoryBytes: 0 });
    const count = Math.max(1, Math.floor(finite(details.count) || 1));
    if (hit) cache.hits += count; else cache.misses += count;
    cache.lookupMs += finite(details.lookupMs);
    cache.insertMs += finite(details.insertMs);
    if (Number.isFinite(Number(details.size))) cache.size = Number(details.size);
    if (Number.isFinite(Number(details.memoryBytes))) cache.memoryBytes = Number(details.memoryBytes);
  }

  function recordClone(kind = "state", count = 1, runId = currentRunId, estimatedBytes = 0) {
    increment(kind === "structured" ? "clone.structured" : kind === "deep" ? "clone.deep" : "clone.state", count, runId);
    const run = runs.get(runId);
    if (run) run.allocationsEstimate += Math.max(0, Number(estimatedBytes || 0));
  }

  function recordSerialization(kind, durationMs, bytes = 0, runId = currentRunId) {
    const run = ensureRun(runId, "unscoped");
    if (!run) return;
    const key = kind === "deserialize" ? "deserialization" : "serialization";
    run.metrics[key] = Number(run.metrics[key] || 0) + Math.max(0, Number(durationMs || 0));
    run.counters[`${key}.count`] = Number(run.counters[`${key}.count`] || 0) + 1;
    run.allocationsEstimate += Math.max(0, Number(bytes || 0));
  }

  function recordWorker(kind, durationMs, runId = currentRunId) {
    const run = ensureRun(runId, "unscoped");
    if (!run) return;
    const name = `worker.${String(kind || "execution")}`;
    run.metrics[name] = Number(run.metrics[name] || 0) + Math.max(0, Number(durationMs || 0));
  }

  function merge(report, runId = currentRunId, prefix = "") {
    const run = ensureRun(runId, "unscoped");
    if (!run || !report) return;
    const key = value => prefix ? `${prefix}.${value}` : value;
    for (const [name, value] of Object.entries(report.metrics || {})) {
      if (name === "total") continue;
      run.metrics[key(name)] = Number(run.metrics[key(name)] || 0) + finite(value);
    }
    for (const [name, value] of Object.entries(report.counters || {})) run.counters[key(name)] = Number(run.counters[key(name)] || 0) + finite(value);
    for (const [name, value] of Object.entries(report.gauges || {})) run.gauges[key(name)] = finite(value);
    for (const [name, value] of Object.entries(report.caches || {})) {
      const cache = run.caches[key(name)] || (run.caches[key(name)] = { hits: 0, misses: 0, lookupMs: 0, insertMs: 0, size: 0, memoryBytes: 0 });
      cache.hits += finite(value.hits);
      cache.misses += finite(value.misses);
      cache.lookupMs += finite(value.lookupMs);
      cache.insertMs += finite(value.insertMs);
      cache.size = Math.max(cache.size, finite(value.size));
      cache.memoryBytes = Math.max(cache.memoryBytes, finite(value.memoryBytes));
    }
    run.allocationsEstimate += finite(report.allocationsEstimate);
  }

  function mark(name, details = {}, runId = currentRunId) {
    const run = ensureRun(runId, "unscoped");
    if (!run) return;
    run.events.push({ name: String(name || "event"), atMs: Math.max(0, clock() - run.startedAt), details: shallowCopy(details) });
  }

  function getRun(id) {
    const run = runs.get(id);
    return run ? publicRun(run) : null;
  }

  function getLatest(name = null) {
    const candidates = [...runs.values()].filter(run => !name || run.name === name).sort((a, b) => b.startedEpoch - a.startedEpoch);
    return candidates[0] ? publicRun(candidates[0]) : history.find(item => !name || item.name === name) || null;
  }

  function getHistory(name = null) {
    return history.filter(item => !name || item.name === name).map(item => ({ ...item }));
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return noop;
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function ensureRun(runId, name) {
    if (runId && runs.has(runId)) return runs.get(runId);
    const id = beginRun(name, { implicit: true });
    return runs.get(id);
  }

  function finalizeCaches(run) {
    for (const cache of Object.values(run.caches)) {
      const total = cache.hits + cache.misses;
      cache.hitRate = total ? cache.hits / total : 0;
      cache.averageLookupMs = total ? cache.lookupMs / total : 0;
      cache.averageInsertionMs = cache.misses ? cache.insertMs / cache.misses : 0;
    }
  }

  function buildWarnings(run) {
    const warnings = [];
    const nodes = Number(run.gauges["planner.nodes"] || run.counters["planner.nodes"] || 0);
    const depth = Number(run.gauges["planner.maxDepth"] || 0);
    const deepClones = Number(run.counters["clone.deep"] || 0);
    const queueMs = Number(run.metrics["worker.queue"] || 0);
    const longTask = Number(run.gauges["main.longTaskMaxMs"] || 0);
    if (nodes > 3000) warnings.push(`Planner nodes unusually high (${Math.round(nodes)})`);
    if (depth > 12) warnings.push(`Planner depth unusually high (${Math.round(depth)})`);
    for (const [name, cache] of Object.entries(run.caches)) {
      if (cache.hits + cache.misses >= 4 && cache.hitRate < .5) warnings.push(`${name} cache hit below expected threshold (${Math.round(cache.hitRate * 100)}%)`);
    }
    if (deepClones > 10) warnings.push(`Deep clone spike detected (${deepClones})`);
    if (queueMs > 20) warnings.push(`Worker queue saturated (${queueMs.toFixed(1)} ms)`);
    if (longTask >= 50) warnings.push(`Main thread blocked for ${longTask.toFixed(1)} ms`);
    return warnings;
  }

  function publicRun(run) {
    const previous = history.find(item => item.name === run.name) || null;
    return {
      id: run.id,
      name: run.name,
      context: run.context,
      metadata: shallowCopy(run.metadata),
      startedEpoch: run.startedEpoch,
      durationMs: run.finishedAt == null ? Math.max(0, clock() - run.startedAt) : run.durationMs,
      metrics: { ...run.metrics },
      counters: { ...run.counters },
      gauges: { ...run.gauges },
      caches: JSON.parse(JSON.stringify(run.caches)),
      spans: run.spans.map(span => ({ ...span, metadata: shallowCopy(span.metadata) })),
      events: run.events.map(event => ({ ...event, details: shallowCopy(event.details) })),
      warnings: [...run.warnings],
      allocationsEstimate: run.allocationsEstimate,
      topOperations: Object.entries(run.metrics).filter(([name]) => name !== "total").sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, durationMs]) => ({ name, durationMs })),
      comparison: previous ? compareRuns(previous, run) : null
    };
  }

  function compareRuns(previous, current) {
    const metrics = {};
    const names = new Set([...Object.keys(previous.metrics || {}), ...Object.keys(current.metrics || {})]);
    for (const name of names) {
      const before = finite(previous.metrics?.[name]);
      const after = finite(current.metrics?.[name]);
      metrics[name] = { previous: before, current: after, differencePercent: before ? (after - before) / before * 100 : null };
    }
    return { previousRunId: previous.id, metrics };
  }

  function appendHistory(snapshot) {
    history.unshift(snapshot);
    history.splice(historyLimit);
    if (options.persist === false) return;
    try {
      root?.localStorage?.setItem(storageKey, JSON.stringify(history));
    } catch (_) {}
  }

  function loadHistory() {
    if (options.persist === false) return [];
    try {
      const parsed = JSON.parse(root?.localStorage?.getItem(storageKey) || "[]");
      return Array.isArray(parsed) ? parsed.slice(0, historyLimit) : [];
    } catch (_) {
      return [];
    }
  }

  function notify(type, run) {
    for (const listener of listeners) {
      try { listener(type, publicRunLike(run)); } catch (_) {}
    }
  }

  function publicRunLike(run) {
    return run?.topOperations ? run : publicRun(run);
  }

  function sampleMemory(run) {
    const value = memoryBytes();
    if (value != null) run.memoryPeak = Math.max(Number(run.memoryPeak || 0), value);
  }

  function memoryBytes() {
    const value = Number(root?.performance?.memory?.usedJSHeapSize);
    return Number.isFinite(value) ? value : null;
  }

  function installObservers() {
    const Observer = root?.PerformanceObserver;
    if (typeof Observer !== "function") return;
    try {
      const supported = Observer.supportedEntryTypes || [];
      if (supported.includes("longtask")) {
        longTaskObserver = new Observer(list => {
          for (const entry of list.getEntries()) {
            const run = runs.get(currentRunId);
            if (!run) continue;
            increment("main.longTaskCount", 1, run.id);
            gauge("main.longTaskMaxMs", Math.max(Number(run.gauges["main.longTaskMaxMs"] || 0), entry.duration), run.id);
          }
        });
        longTaskObserver.observe({ entryTypes: ["longtask"] });
      }
      if (supported.includes("gc")) {
        gcObserver = new Observer(list => {
          const run = runs.get(currentRunId);
          if (!run) return;
          for (const entry of list.getEntries()) {
            increment("gc.events", 1, run.id);
            run.metrics["gc.time"] = Number(run.metrics["gc.time"] || 0) + Number(entry.duration || 0);
          }
        });
        gcObserver.observe({ entryTypes: ["gc"] });
      }
    } catch (_) {}
  }

  function installDashboard() {
    const document = root?.document;
    if (!document || dashboard) return dashboard;
    const style = document.createElement("style");
    style.textContent = `.perf-debug-panel{position:fixed;right:12px;bottom:12px;z-index:10000;width:min(360px,calc(100vw - 24px));max-height:72vh;overflow:auto;background:#101827;color:#eef5ff;border:1px solid #3a526e;border-radius:6px;box-shadow:0 14px 34px rgba(0,0,0,.32);font:12px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace}.perf-debug-panel[hidden]{display:none}.perf-debug-head{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#17263a;position:sticky;top:0;z-index:1}.perf-debug-head strong{font-size:12px}.perf-debug-head button{border:0;background:transparent;color:#cce9ff;cursor:pointer;font:inherit}.perf-debug-body{padding:8px 10px}.perf-debug-grid{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 10px}.perf-debug-grid b{color:#fff}.perf-debug-grid span{color:#b9c8d8}.perf-debug-warning{margin:6px 0;padding:5px 7px;background:#4a2c17;color:#ffd39a;border-left:3px solid #ff9d35}.perf-debug-section{margin-top:9px;padding-top:7px;border-top:1px solid #30445b}.perf-debug-section summary{cursor:pointer;color:#8fd8ff}.perf-debug-flow{display:grid;gap:4px;margin-top:6px}.perf-debug-flow div{display:flex;justify-content:space-between;border-left:2px solid #2aa6c9;padding-left:7px}.perf-debug-delta.good{color:#68d391}.perf-debug-delta.bad{color:#ff8b8b}`;
    document.head.appendChild(style);
    dashboard = document.createElement("aside");
    dashboard.className = "perf-debug-panel";
    dashboard.setAttribute("aria-label", "Performance debug dashboard");
    dashboard.innerHTML = `<div class="perf-debug-head"><strong>PERF_DEBUG</strong><button type="button" data-perf-collapse>Hide</button></div><div class="perf-debug-body">Waiting for a measured run.</div>`;
    (document.body || document.documentElement).appendChild(dashboard);
    dashboard.querySelector("[data-perf-collapse]")?.addEventListener("click", event => {
      const body = dashboard.querySelector(".perf-debug-body");
      const hidden = body.hidden = !body.hidden;
      event.currentTarget.textContent = hidden ? "Show" : "Hide";
    });
    subscribe((type, run) => {
      if (type === "finish") renderDashboard(run);
    });
    return dashboard;
  }

  function renderDashboard(run) {
    if (!dashboard || !run) return;
    const body = dashboard.querySelector(".perf-debug-body");
    const rows = displayRows(run);
    const warnings = (run.warnings || []).map(text => `<div class="perf-debug-warning">&#9888; ${escapeHtml(text)}</div>`).join("");
    const flow = (run.spans || []).slice().sort((a, b) => a.startMs - b.startMs).map(span => `<div><span>${escapeHtml(labelFor(span.name))}</span><b>${formatMs(span.durationMs)}</b></div>`).join("");
    const top = (run.topOperations || []).map(item => `<div><span>${escapeHtml(labelFor(item.name))}</span><b>${formatMs(item.durationMs)}</b></div>`).join("");
    const comparison = comparisonRows(run);
    body.innerHTML = `<div class="perf-debug-grid">${rows}</div>${warnings}<details class="perf-debug-section"><summary>Timeline profiling</summary><div class="perf-debug-flow">${flow || "No completed spans"}</div></details><details class="perf-debug-section"><summary>Regression tracking</summary><div class="perf-debug-grid">${comparison || "No previous matching run"}</div></details><details class="perf-debug-section"><summary>Top operations</summary><div class="perf-debug-grid">${top || "No operations"}</div></details>`;
  }

  function comparisonRows(run) {
    const metrics = run.comparison?.metrics || {};
    return Object.entries(metrics)
      .filter(([, item]) => item.differencePercent != null && Math.abs(item.differencePercent) >= 1)
      .sort((a, b) => Math.abs(b[1].differencePercent) - Math.abs(a[1].differencePercent))
      .slice(0, 8)
      .map(([name, item]) => {
        const difference = Number(item.differencePercent || 0);
        const className = difference <= 0 ? "good" : "bad";
        const sign = difference > 0 ? "+" : "";
        return `<span>${escapeHtml(labelFor(name))}</span><b class="perf-debug-delta ${className}" title="Previous ${formatMs(item.previous)}; current ${formatMs(item.current)}">${sign}${difference.toFixed(0)}%</b>`;
      }).join("");
  }

  function displayRows(run) {
    const values = [
      ["Battle Startup", run.metrics["battle.startup"]], ["BattleState", run.metrics["battle.state"]],
      ["Combatants", run.metrics["combatants.create"]], ["Planner Init", run.metrics["planner.init"]],
      ["Planner Search", run.metrics["planner.search"]], ["Continuation", run.metrics["continuation.search"]],
      ["Planner Nodes", run.gauges["planner.nodes"]], ["Max Depth", run.gauges["planner.maxDepth"]],
      ["Transposition Hits", cacheRate(run.caches.transposition)], ["Planner Cache Hits", cacheRate(run.caches["battle-intelligence"])],
      ["State Clones", run.counters["clone.state"]], ["Deep Clones", run.counters["clone.deep"]],
      ["Worker Time", run.metrics["worker.execution"]], ["Worker Queue", run.metrics["worker.queue"]],
      ["Serialization", run.metrics.serialization], ["Timeline", run.metrics["timeline.generation"]],
      ["Matrix", run.metrics["matrix.generation"]], ["Swing", run.metrics["swing.generation"]],
      ["DOM Update", run.metrics["dom.update"]], ["Render", run.metrics.render],
      ["Total", run.durationMs], ["Peak Memory", formatBytes(run.gauges.peakMemoryBytes)]
    ];
    return values.filter(([, value]) => value !== undefined && value !== null).map(([label, value]) => {
      const formatted = typeof value === "string" ? value : label.includes("Nodes") || label.includes("Depth") || label.includes("Clones") ? Math.round(value) : formatMs(value);
      return `<span>${escapeHtml(label)}</span><b>${escapeHtml(String(formatted))}</b>`;
    }).join("");
  }

  function cacheRate(cache) {
    if (!cache || !Number.isFinite(Number(cache.hitRate))) return null;
    return `${Math.round(cache.hitRate * 100)}%`;
  }

  function labelFor(name) {
    return String(name || "").split(".").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }

  function formatMs(value) {
    return `${finite(value).toFixed(finite(value) >= 100 ? 0 : 1)} ms`;
  }

  function formatBytes(value) {
    const bytes = finite(value);
    if (!bytes) return "n/a";
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
  }

  function latestOpenRunId() {
    return [...runs.values()].filter(run => run.finishedAt == null).sort((a, b) => b.startedEpoch - a.startedEpoch)[0]?.id || null;
  }

  function shallowCopy(value) {
    return value && typeof value === "object" ? { ...value } : {};
  }

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function dispose() {
    longTaskObserver?.disconnect?.();
    gcObserver?.disconnect?.();
    dashboard?.remove?.();
    listeners.clear();
    runs.clear();
  }

  installObservers();
  if (options.dashboard !== false && root?.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", installDashboard, { once: true });
    else installDashboard();
  }

  return Object.freeze({
    enabled: true,
    createApi: createPvPeakPerfDebugApi,
    beginRun,
    finishRun,
    startSpan,
    endSpan,
    measure,
    measureAsync,
    increment,
    gauge,
    recordCache,
    recordClone,
    recordSerialization,
    recordWorker,
    merge,
    mark,
    getRun,
    getLatest,
    getHistory,
    subscribe,
    installDashboard,
    dispose
  });
});
