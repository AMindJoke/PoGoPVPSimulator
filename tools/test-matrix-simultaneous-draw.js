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

const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
assert.match(html, /matrix-v16:/, "The persisted matrix cache must be invalidated for the new outcome semantics.");

console.log("Matrix simultaneous Fast draw test passed.");
