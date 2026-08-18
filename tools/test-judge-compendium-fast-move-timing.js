const assert = require("assert");
const Timing = require("../src/compendium/fast-move-timing.js");

const model = Timing.build(
  { id: "INCINERATE", name: "Incinerate", turns: 5, energyGain: 20, power: 20, type: "fire" },
  { id: "SUCKER_PUNCH", name: "Sucker Punch", turns: 2, energyGain: 7, power: 5, type: "dark" },
  { turnCount: 12 }
);
assert.equal(model.turnCount, 12);
assert.equal(model.alignment, 10);
assert.deepEqual(model.rows[0].events.map(event => event.start), [1, 6, 11]);
assert.deepEqual(model.rows[1].events.slice(0, 3).map(event => event.impact), [2, 4, 6]);
assert.equal(model.rows[0].events[0].energyAfter, 20);
assert.ok(model.candidateWindows.includes(1));
assert.match(model.insight, /realign every 10 turns/);
console.log("Judge Compendium Fast Move Timing tests passed.");
