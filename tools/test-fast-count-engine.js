"use strict";

const assert = require("node:assert/strict");
const engine = require("../src/training/fast-count-engine");

assert.equal(engine.getFastCount({ fastEnergy: 12, chargedCost: 45, currentEnergy: 0 }), 4);
assert.equal(engine.getFastCount({ fastEnergy: 12, chargedCost: 45, currentEnergy: 9 }), 3);
assert.equal(engine.getFastCount({ fastEnergy: 4, chargedCost: 35, currentEnergy: 35 }), 0);

assert.deepEqual(engine.deriveShortcut({ fastEnergy: 12, chargedCost: 45 }), {
  fastEnergy: 12,
  chargedCost: 45,
  base: 4,
  threshold: 9,
  gain: 3,
  shorterCount: 3,
  shorterCyclePossible: true
});
assert.deepEqual(engine.deriveShortcut({ fastEnergy: 10, chargedCost: 40 }), {
  fastEnergy: 10,
  chargedCost: 40,
  base: 4,
  threshold: 10,
  gain: 0,
  shorterCount: 3,
  shorterCyclePossible: false
});

const mixed = engine.resolveSequence({ fastEnergy: 12, chargedCosts: [45, 60, 45], startingEnergy: 0 });
assert.deepEqual(mixed.throws.map(entry => entry.fastCount), [4, 5, 4]);
assert.deepEqual(mixed.throws.map(entry => entry.energyAfter), [3, 3, 6]);

const capped = engine.resolveThrow({ fastEnergy: 14, chargedCost: 60, currentEnergy: 95 });
assert.equal(capped.fastCount, 0);
assert.equal(capped.energyAtThrow, 95);
assert.equal(capped.energyAfter, 35);
assert.equal(capped.capWaste, 0);
const capGain = engine.resolveThrow({ fastEnergy: 14, chargedCost: 100, currentEnergy: 95 });
assert.equal(capGain.fastCount, 1);
assert.equal(capGain.energyAtThrow, 100);
assert.equal(capGain.capWaste, 9);
assert.equal(capGain.energyAfter, 0);

const choices = engine.generateAnswerChoices({ correct: 1, random: () => 0.4 });
assert.equal(choices.length, 4);
assert.equal(new Set(choices).size, 4);
assert(choices.includes(1));
assert(choices.every(value => value >= 0));

for (let fastEnergy = 1; fastEnergy <= 20; fastEnergy += 1) {
  for (let chargedCost = 1; chargedCost <= 100; chargedCost += 1) {
    for (let currentEnergy = 0; currentEnergy <= 100; currentEnergy += 1) {
      const resolved = engine.resolveThrow({ fastEnergy, chargedCost, currentEnergy });
      assert(resolved.energyAtThrow >= chargedCost);
      assert(resolved.energyAfter >= 0 && resolved.energyAfter <= 100);
      if (resolved.fastCount > 0) {
        assert(Math.min(100, currentEnergy + ((resolved.fastCount - 1) * fastEnergy)) < chargedCost);
      }
    }
    const shortcut = engine.deriveShortcut({ fastEnergy, chargedCost });
    let bank = 0;
    for (let cycle = 0; cycle < 40; cycle += 1) {
      const direct = engine.resolveThrow({ fastEnergy, chargedCost, currentEnergy: bank });
      const compact = engine.resolveShortcutCycle({ fastEnergy, chargedCost, bank });
      if (direct.capWaste === 0) {
        assert.equal(compact.fastCount, direct.fastCount);
        assert.equal(compact.bankAfter, direct.energyAfter);
      }
      bank = direct.energyAfter;
      assert(bank < fastEnergy);
    }
    if (chargedCost % fastEnergy === 0) assert.equal(shortcut.shorterCyclePossible, false);
  }
}

assert.throws(() => engine.getFastCount({ fastEnergy: 0, chargedCost: 40 }), RangeError);
assert.throws(() => engine.resolveThrow({ fastEnergy: 5, chargedCost: 101 }), RangeError);
assert.throws(() => engine.resolveShortcutCycle({ fastEnergy: 12, chargedCost: 45, bank: 12 }), RangeError);
assert.throws(() => engine.resolveSequence({ fastEnergy: 5, chargedCosts: [] }), RangeError);

console.log("Fast Count engine tests passed.");
