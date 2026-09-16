"use strict";
const assert = require("node:assert/strict");
const { METHOD, targetWeight, updateWeights } = require("../src/analysis/ranking-weight-update");
assert.ok(Math.abs(targetWeight(520.001) - targetWeight(519.999)) < .001, "The old 520 threshold must be continuous.");
let last = 0;
for (let score = 1; score <= 1000; score++) {
  const value = targetWeight(score);
  assert.ok(value >= .12 && value <= 3.2 && value >= last);
  last = value;
}
const first = updateWeights({ entries: [{ id: "a", overallScore: 600 }] });
assert.equal(first.get("a"), targetWeight(600));
const secondInput = { entries: [{ id: "a", overallScore: 400 }], metadata: {
  weightUpdate: { method: METHOD, weights: Object.fromEntries(first) }
} };
const second = updateWeights(secondInput);
assert.equal(second.get("a"), (targetWeight(600) + targetWeight(400)) / 2);
const resumed = JSON.parse(JSON.stringify({ entries: secondInput.entries,
  metadata: { weightUpdate: { method: METHOD, weights: Object.fromEntries(second) } } }));
assert.equal(updateWeights(resumed).get("a"), (second.get("a") + targetWeight(400)) / 2, "Continuation must use persisted actual weights.");
assert.throws(() => updateWeights({ ...secondInput, metadata: { weightUpdate: { method: METHOD, weights: {} } } }));
assert.throws(() => updateWeights({ entries: [{ id: "a", overallScore: NaN }] }));
console.log("Gradual ranking weight tests passed.");
