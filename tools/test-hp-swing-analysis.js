"use strict";

const assert = require("assert");
const {
  createRuntime,
  buildCaseConfig,
  winnerSide
} = require("./run-battle-regressions");

const runtime = createRuntime();
const testCase = {
  id: "abomasnow-lickilicky-hp-swing-1s",
  description: "HP Swing must match its clickable presentation preview",
  category: "analysis",
  league: "great",
  pokemonA: { id: "abomasnow", ivPreset: "default", hp: "full", energy: 0, shields: 1 },
  pokemonB: { id: "lickilicky", ivPreset: "default", hp: "full", energy: 0, shields: 1 },
  policy: { baiting: "selective", shieldMode: "always" },
  expectations: {}
};

const baseConfig = buildCaseConfig(testCase, runtime);
let sequence = 0;

function simulateWithReduction(reduction, continuationMode) {
  const config = JSON.parse(JSON.stringify(baseConfig));
  config.right.hp = Math.max(1, config.right.maxHp - reduction);
  return runtime.adapter.simulate({
    id: ++sequence,
    key: `hp-swing-${reduction}-${continuationMode}`,
    aShields: 1,
    bShields: 1,
    includeSwing: false,
    continuationMode,
    config
  });
}

function firstWinningReduction(continuationMode) {
  for (let reduction = 1; reduction < baseConfig.right.maxHp; reduction++) {
    if (winnerSide(simulateWithReduction(reduction, continuationMode)) === "A") return reduction;
  }
  return null;
}

const baseline = simulateWithReduction(0, "presentation");
assert.strictEqual(winnerSide(baseline), "B");

const internalThreshold = firstWinningReduction("flip-analysis");
const visibleThreshold = firstWinningReduction("presentation");
assert(Number.isInteger(internalThreshold) && internalThreshold > 0);
assert(internalThreshold <= visibleThreshold);
assert(Number.isInteger(visibleThreshold) && visibleThreshold > 0);
if (visibleThreshold > 1) {
  assert.notStrictEqual(winnerSide(simulateWithReduction(visibleThreshold - 1, "presentation")), "A");
}

const verifiedPreview = simulateWithReduction(visibleThreshold, "presentation");
assert.strictEqual(winnerSide(verifiedPreview), "A");
assert.strictEqual(verifiedPreview.details.winnerEdge > 0, true);

console.log("HP Swing analysis tests passed.");
