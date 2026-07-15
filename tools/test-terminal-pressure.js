"use strict";

const assert = require("assert");
const {
  createRuntime,
  runRegressionCase,
  winnerSide
} = require("./run-battle-regressions");

const runtime = createRuntime();
const testCase = {
  id: "terminal-pressure-charjabug-abomasnow",
  description: "A fainted Pokemon must not retain farm or charged-move pressure.",
  category: ["matchup-scoring", "terminal-state"],
  league: "great",
  pokemonA: { id: "charjabug", moves: {}, ivPreset: "default", hp: "full", energy: 0, shields: 1 },
  pokemonB: { id: "abomasnow", moves: {}, ivPreset: "default", hp: "full", energy: 0, shields: 1 },
  policy: { baiting: "selective", shieldMode: "always" },
  expectations: { winner: "B" }
};

const output = runRegressionCase(testCase, runtime, 1, { trace: true });
assert.strictEqual(winnerSide(output.result), "B");
assert.strictEqual(output.result.details.farmPressureEdge, 0);
assert.strictEqual(output.result.details.dangerEdge, 0);
assert(output.result.score < 500);
console.log("Terminal matchup pressure tests passed.");
