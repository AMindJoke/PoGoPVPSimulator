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

console.log("Matchup planner model tests passed.");
