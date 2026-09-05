"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createRuntime,
  loadRegressionFixtures,
  runRegressionCase,
  winnerSide
} = require("./run-battle-regressions.js");
const { compactResult } = require("./build-great-league-meta-database.js");

const root = path.resolve(__dirname, "..");
const fixture = loadRegressionFixtures().cases.find(
  testCase => testCase.id === "shadow-sableye-mirror-simultaneous-fast-ko-0s"
);
assert.ok(fixture, "The simultaneous Fast draw regression fixture is required.");

const runtime = createRuntime({ strict: true });
const result = runRegressionCase(fixture, runtime, 1).result;
assert.equal(winnerSide(result), "draw");
assert.equal(result.details.winnerEdge, 0);
assert.equal(result.details.aHp, 0);
assert.equal(result.details.bHp, 0);
assert.equal(result.details.outcome, "draw");
assert.equal(result.details.simultaneousFaint, true);
assert.equal(result.score, 500, "A terminal simultaneous faint must be neutral in the matrix.");

const compact = compactResult({
  score: result.score,
  details: {
    simultaneousFaint: true,
    winnerEdge: -18,
    aHpRatio: 0,
    bHpRatio: 0
  }
}, "a", "b");
assert.equal(compact.winnerSide, "tie", "A simultaneous faint must remain a tie when compacted.");
assert.equal(compact.winnerId, null, "A simultaneous faint cannot have a winner id.");

const compactDecisive = compactResult({
  score: 0,
  details: {
    winnerEdge: -18,
    aHp: 0.125,
    bHp: 0
  }
}, "a", "b");
assert.equal(compactDecisive.score, 0, "A zero score must not be coerced to neutral.");
assert.equal(compactDecisive.hpRatioA, 0.125);
assert.equal(compactDecisive.hpRatioB, 0);

const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
assert.match(html, /matrix-v17:/, "The persisted matrix cache must be invalidated for the new score semantics.");

console.log("Matrix simultaneous Fast draw test passed.");
