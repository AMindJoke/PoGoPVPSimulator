const assert = require("assert");
const Timing = require("../src/compendium/fast-move-timing.js");

const model = Timing.build(
  { id: "INCINERATE", name: "Incinerate", turns: 5, energyGain: 20, power: 20, type: "fire" },
  { id: "SUCKER_PUNCH", name: "Sucker Punch", turns: 2, energyGain: 7, power: 5, type: "dark" },
  { turnCount: 12 }
);
assert.equal(model.requestedTurnCount, 12);
assert.equal(model.turnCount, 15, "A Fast Attack begun in the selected range must render through its complete impact.");
assert.equal(model.alignment, 10);
assert.deepEqual(model.rows[0].events.map(event => event.start), [1, 6, 11]);
assert.deepEqual(model.rows[1].events.slice(0, 3).map(event => event.impact), [2, 4, 6]);
assert.deepEqual(model.rows[1].events.map(event => event.start), [1, 3, 5, 7, 9, 11, 13], "The opposite Fast Attack row must fill the extended range with complete attacks.");
assert.equal(model.rows[1].events.at(-1).impact, 14);
assert.equal(model.rows[0].events[0].energyAfter, 20);
assert.equal(model.rows[0].events.at(-1).impact, 15);
assert.deepEqual(model.candidateWindows, [5], "A landmark requires both Move A to be ready and Move B to be one turn from impact.");
assert.match(model.insight, /realign every 10 turns/);

const extended = Timing.build(
  { id: "INCINERATE", name: "Incinerate", turns: 5, energyGain: 20, power: 20, type: "fire" },
  { id: "SUCKER_PUNCH", name: "Sucker Punch", turns: 2, energyGain: 7, power: 5, type: "dark" },
  { turnCount: 24 }
);
assert.deepEqual(extended.candidateWindows, [5, 15]);
assert.equal(extended.turnCount, 25, "The extended range must also complete an attack begun before its requested endpoint.");
console.log("Judge Compendium Fast Move Timing tests passed.");
