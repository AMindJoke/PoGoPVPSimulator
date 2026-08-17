const assert = require("assert");
const QuickReference = require("../src/compendium/quick-reference.js");
const MoveReference = require("../src/compendium/move-reference.js");

const rawMoves = [
  { moveId: "ONE", name: "One", type: "normal", power: 3, energyGain: 3, energy: 0, turns: 1, cooldown: 500 },
  { moveId: "TWO", name: "Two", type: "normal", power: 6, energyGain: 6, energy: 0, turns: 2, cooldown: 1000 },
  { moveId: "FIVE", name: "Five", type: "fire", power: 20, energyGain: 20, energy: 0, turns: 5, cooldown: 2500 },
  { moveId: "CHARGE", name: "Charge", type: "water", power: 80, energyGain: 0, energy: 40, turns: 1, cooldown: 500 }
];
const reference = MoveReference.createReference(rawMoves);
const model = QuickReference.create({ settings: { maxBuffStages: 4, partySize: 3 }, rawMoves, reference });

assert.strictEqual(model.maxEnergy, 100);
assert.strictEqual(model.maxShields, 2);
assert.strictEqual(model.minStatStage, -4);
assert.strictEqual(model.maxStatStage, 4);
assert.strictEqual(model.partySize, 3);
assert.strictEqual(model.turnMilliseconds, 500);
assert.strictEqual(model.turnSeconds, 0.5);
assert.deepStrictEqual(model.fastDurations, [
  { turns: 1, seconds: 0.5, moveCount: 1 },
  { turns: 2, seconds: 1, moveCount: 1 },
  { turns: 5, seconds: 2.5, moveCount: 1 }
]);

global.window = {};
require("../battle-data.js");
const canonicalMoves = MoveReference.createReference(window.BATTLE_GAMEMASTER.moves);
const canonical = QuickReference.create({ settings: window.BATTLE_GAMEMASTER.settings, rawMoves: window.BATTLE_GAMEMASTER.moves, reference: canonicalMoves });
assert.strictEqual(canonical.turnMilliseconds, 500);
assert.deepStrictEqual(canonical.fastDurations.map(item => item.turns), [1, 2, 3, 4, 5]);
assert.strictEqual(canonical.fastDurations.reduce((sum, item) => sum + item.moveCount, 0), canonicalMoves.fast.length);

console.log("Judge Compendium Quick Reference tests passed.");
