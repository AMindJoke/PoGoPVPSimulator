"use strict";

const assert = require("assert");
const Planner = require("../src/battle/matchup-planner");

const enormousLoss = Planner.createOutcomeVector({
  outcome: "loss",
  remainingHp: 999999,
  remainingShields: 999999,
  actionableEnergy: 999999,
  heuristicTieBreak: 999999
});
const minimalWin = Planner.createOutcomeVector({ outcome: "win" });
const minimalDraw = Planner.createOutcomeVector({ outcome: "draw" });
assert(Planner.compareOutcomeVectors(minimalWin, enormousLoss) < 0, "A proven win must always rank above a loss.");
assert(Planner.compareOutcomeVectors(minimalDraw, enormousLoss) < 0, "A draw must always rank above a loss.");
assert(Planner.compareOutcomeVectors(minimalWin, minimalDraw) < 0, "A win must always rank above a draw.");

const hashA = Planner.canonicalStateHash({ energy: 35, hp: 10, nested: { b: 2, a: 1 } }, "FAST", "fixture-v1");
const hashB = Planner.canonicalStateHash({ nested: { a: 1, b: 2 }, hp: 10, energy: 35 }, "FAST", "fixture-v1");
assert.strictEqual(hashA, hashB, "Canonical state hashing must ignore object insertion order.");

const graph = {
  root: { side: "A", edges: { greedy: "greedy-response", patient: "patient-response" } },
  "greedy-response": { side: "B", edges: { punish: "loss" } },
  "patient-response": { side: "B", edges: { best: "win-small", blunder: "win-large" } },
  loss: { outcome: "loss", hp: 90 },
  "win-small": { outcome: "win", hp: 1 },
  "win-large": { outcome: "win", hp: 80 }
};

const adapter = {
  hash(state) { return state; },
  terminal(state) {
    const node = graph[state];
    return node.outcome ? Planner.createOutcomeVector({ outcome: node.outcome, remainingHp: node.hp }) : null;
  },
  evaluate(state) {
    const node = graph[state];
    return Planner.createOutcomeVector({ outcome: node.outcome || "draw", remainingHp: node.hp || 0 });
  },
  candidates(state) {
    return Object.keys(graph[state].edges || {}).map(id => ({ id, action: { type: id } }));
  },
  apply(state, side, candidate) {
    const next = graph[state].edges[candidate.id];
    return { state: next, nextSide: graph[next].side || (side === "A" ? "B" : "A") };
  }
};

const plan = Planner.search({ state: "root", side: "A", perspective: "A", policy: "DEEP_REVIEW", adapter });
assert.strictEqual(plan.outcomeClass, "win");
assert.strictEqual(plan.principalVariation[0].action.type, "patient", "Planner must select the winning continuation over the locally attractive loss.");
assert.strictEqual(plan.principalVariation[0].expectedOpponentResponse.type, "best", "Planner must retain the opponent's minimizing best response.");
assert(plan.searchedNodes > 0);
assert.strictEqual(plan.completedDepth, 2, "Iterative deepening must retain the deepest complete root iteration.");
assert(plan.depthReached >= plan.completedDepth);
assert(Number.isFinite(plan.elapsedMs));
assert(Number.isInteger(plan.cacheHits));
assert(Number.isInteger(plan.prunedBranches));
assert.strictEqual(plan.incompleteHorizon, false, "A terminally solved graph must not report an incomplete horizon.");

const depthTrap = {
  root: { side: "A", edges: { apparent: "apparent-1", patient: "patient-1" } },
  "apparent-1": { side: "B", edges: { reply: "apparent-2" } },
  "apparent-2": { side: "A", edges: { finish: "deep-loss" } },
  "patient-1": { side: "B", edges: { reply: "patient-2" } },
  "patient-2": { side: "A", edges: { finish: "deep-win" } },
  "deep-loss": { outcome: "loss", hp: 100 },
  "deep-win": { outcome: "win", hp: 1 }
};
const depthAdapter = {
  hash(state) { return state; },
  terminal(state) {
    const node = depthTrap[state];
    return node.outcome ? Planner.createOutcomeVector({ outcome: node.outcome, remainingHp: node.hp }) : null;
  },
  evaluate(state) {
    return Planner.createOutcomeVector({
      outcome: "draw",
      heuristicTieBreak: state.startsWith("apparent") ? 100 : 0
    });
  },
  candidates(state) {
    return Object.keys(depthTrap[state].edges || {}).map(id => ({ id, action: { type: id } }));
  },
  apply(state, side, candidate) {
    const next = depthTrap[state].edges[candidate.id];
    return { state: next, nextSide: depthTrap[next].side || (side === "A" ? "B" : "A") };
  }
};
const deepPlan = Planner.search({ state: "root", side: "A", perspective: "A", policy: "DEEP_REVIEW", adapter: depthAdapter });
assert.strictEqual(deepPlan.outcomeClass, "win");
assert.strictEqual(deepPlan.principalVariation[0].action.type, "patient", "A complete deeper iteration must replace the attractive shallow line.");
assert.strictEqual(deepPlan.completedDepth, 3);

const boundedGraph = {
  root: { side: "A", edges: { continue: "loop" } },
  loop: { side: "B", edges: { continue: "root" } }
};
const boundedAdapter = {
  hash(state) { return state; },
  terminal() { return null; },
  evaluate() { return Planner.createOutcomeVector({ outcome: "draw", heuristicTieBreak: 1 }); },
  candidates(state) { return [{ id: "continue", action: { type: "fast_move" } }]; },
  apply(state) {
    const next = boundedGraph[state].edges.continue;
    return { state: next, nextSide: boundedGraph[next].side };
  }
};
const boundedPlan = Planner.search({ state: "root", side: "A", perspective: "A", policy: "FAST", adapter: boundedAdapter });
assert.strictEqual(boundedPlan.incompleteHorizon, true);
assert(boundedPlan.reasonCodes.includes("MP_SEARCH_HORIZON_INCOMPLETE"));
assert(!boundedPlan.reasonCodes.includes("MP_PROVEN_DRAW"), "A bounded draw-like evaluation must not be reported as a proven draw.");

console.log("Matchup planner model tests passed.");
