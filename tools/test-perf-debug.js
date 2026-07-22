"use strict";

const assert = require("assert");
const defaultApi = require("../src/performance/perf-debug.js");

assert.strictEqual(defaultApi.enabled, false, "PERF_DEBUG must be disabled by default in Node/production");

let disabledCalls = 0;
const disabledResult = defaultApi.measure("disabled", () => {
  disabledCalls++;
  return { winner: "A", score: 612 };
});
assert.deepStrictEqual(disabledResult, { winner: "A", score: 612 });
assert.strictEqual(disabledCalls, 1);
assert.deepStrictEqual(defaultApi.getHistory(), []);

let now = 0;
let epoch = 1_000;
const root = {
  performance: { now: () => now, memory: { usedJSHeapSize: 12_000_000 } },
  localStorage: { getItem: () => null, setItem: () => {} }
};
const perf = defaultApi.createApi({
  root,
  enabled: true,
  clock: () => now,
  epoch: () => epoch++,
  persist: false,
  dashboard: false
});

const first = perf.beginRun("battle", { fixture: "collector" });
const startup = perf.startSpan("battle.startup", first);
now += 12;
perf.endSpan(startup);
const planner = perf.startSpan("planner.search", first);
now += 18;
perf.endSpan(planner);
perf.gauge("planner.nodes", 684, first);
perf.gauge("planner.maxDepth", 7, first);
perf.recordCache("transposition", true, { count: 91, size: 64 }, first);
perf.recordCache("transposition", false, { count: 9, size: 64 }, first);
perf.recordClone("state", 18, first);
perf.recordClone("deep", 2, first);
perf.recordWorker("execution", 8, first);
perf.recordSerialization("serialize", 3, 1024, first);
const firstReport = perf.finishRun(first, { winner: "A" });

assert.strictEqual(firstReport.metrics["battle.startup"], 12);
assert.strictEqual(firstReport.metrics["planner.search"], 18);
assert.strictEqual(firstReport.gauges["planner.nodes"], 684);
assert.strictEqual(firstReport.caches.transposition.hitRate, 0.91);
assert.strictEqual(firstReport.counters["clone.state"], 18);
assert.strictEqual(firstReport.topOperations[0].name, "planner.search");

now += 5;
const second = perf.beginRun("battle", { fixture: "collector" });
const secondStartup = perf.startSpan("battle.startup", second);
now += 8;
perf.endSpan(secondStartup);
const secondReport = perf.finishRun(second);
assert.ok(secondReport.comparison, "matching runs should expose regression comparison data");
assert.ok(secondReport.comparison.metrics["battle.startup"].differencePercent < 0);
assert.strictEqual(perf.getHistory("battle").length, 2);

const merged = perf.beginRun("matrix");
perf.merge({
  metrics: { "worker.execution": 11 },
  counters: { "planner.candidates": 42 },
  gauges: { "planner.nodes": 310 },
  caches: { transposition: { hits: 7, misses: 3, size: 12 } }
}, merged);
const mergedReport = perf.finishRun(merged);
assert.strictEqual(mergedReport.metrics["worker.execution"], 11);
assert.strictEqual(mergedReport.counters["planner.candidates"], 42);
assert.strictEqual(mergedReport.caches.transposition.hitRate, 0.7);

delete globalThis.PvPeakPerfDebug;
const PlannerModule = require("../src/battle/matchup-planner.js");
const PlainPlanner = PlannerModule.createApi();
globalThis.PvPeakPerfDebug = perf;
const Planner = PlannerModule.createApi();
const plannerRun = perf.beginRun("planner-parity");
const graph = {
  root: { side: "A", edges: { lose: "loss", win: "win" } },
  loss: { outcome: "loss" },
  win: { outcome: "win" }
};
const adapter = {
  hash: state => state,
  terminal(state) {
    return graph[state].outcome ? Planner.createOutcomeVector({ outcome: graph[state].outcome }) : null;
  },
  evaluate(state) {
    return Planner.createOutcomeVector({ outcome: graph[state].outcome || "draw" });
  },
  candidates(state) {
    return Object.keys(graph[state].edges || {}).map(id => ({ id, action: { type: id } }));
  },
  apply(state, side, candidate) {
    const next = graph[state].edges[candidate.id];
    return { state: next, nextSide: side === "A" ? "B" : "A" };
  }
};
const plainPlan = PlainPlanner.search({ state: "root", side: "A", perspective: "A", policy: "DEEP_REVIEW", adapter });
const instrumentedPlan = Planner.search({ state: "root", side: "A", perspective: "A", policy: "DEEP_REVIEW", adapter });
const plannerReport = perf.finishRun(plannerRun);
assert.strictEqual(instrumentedPlan.outcomeClass, plainPlan.outcomeClass);
assert.strictEqual(instrumentedPlan.principalVariation[0]?.action.type, plainPlan.principalVariation[0]?.action.type);
assert.ok(plannerReport.gauges["planner.nodes"] > 0);
assert.ok(plannerReport.counters["planner.candidates"] >= 2);
PlainPlanner.search({ state: "root", side: "A", perspective: "A", policy: "FAST", adapter });
Planner.search({ state: "root", side: "A", perspective: "A", policy: "FAST", adapter });
const plainFastPlan = PlainPlanner.search({ state: "root", side: "A", perspective: "A", policy: "FAST", adapter });
const instrumentedFastPlan = Planner.search({ state: "root", side: "A", perspective: "A", policy: "FAST", adapter });
assert.strictEqual(instrumentedFastPlan.outcomeClass, plainFastPlan.outcomeClass, "PERF_DEBUG must not change a warmed FAST-policy result");
assert.strictEqual(instrumentedFastPlan.principalVariation[0]?.action.type, plainFastPlan.principalVariation[0]?.action.type);
delete globalThis.PvPeakPerfDebug;

console.log("PERF_DEBUG tests passed");
