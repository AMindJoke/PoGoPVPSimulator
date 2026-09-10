"use strict";
const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const data = G.readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
const defaults = G.readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS");
defaults.rillaboom.fast = "RAZOR_LEAF";
defaults.vigoroth.fast = defaults.vigoroth_shadow.fast = "COUNTER";
const before = JSON.stringify(defaults);
const result = G.buildPreviewMovesets(defaults, data, { moveOverrides: { SCRATCH: { power: 3, energyGain: 4 } } });
for (const id of ["rillaboom", "vigoroth", "vigoroth_shadow"]) {
  assert.equal(result[id].fast, "SCRATCH", `${id}: evaluate damage and energy per turn`);
}
assert.equal(JSON.stringify(defaults), before, "Candidate selection must not mutate current defaults");
assert.equal(JSON.stringify(result.mimikyu), JSON.stringify(defaults.mimikyu), "Unaffected species must retain its default");
console.log("Fast move duration selection passed: Rillaboom and both Vigoroth forms select Scratch.");
