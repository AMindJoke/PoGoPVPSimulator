const assert = require("assert");
const model = require("../src/compendium/move-reference.js");

const fixture = [
  { moveId: "INCINERATE", name: "Incinerate", type: "fire", power: 20, energy: 0, energyGain: 20, turns: 5 },
  { moveId: "MUD_SHOT", name: "Mud Shot", type: "ground", power: 4, energy: 0, energyGain: 7, cooldown: 1000 },
  { moveId: "HYDRO_CANNON", name: "Hydro Cannon", type: "water", power: 80, energy: 40, energyGain: 0 },
  { moveId: "ICY_WIND", name: "Icy Wind", type: "ice", power: 60, energy: 45, energyGain: 0, buffs: [-1, 0], buffTarget: "opponent", buffApplyChance: "1" },
  { moveId: "TRANSFORM", name: "Transform", type: "normal", power: 0, energy: 0, energyGain: 0, unlisted: true }
];

const reference = model.createReference(fixture);
assert.strictEqual(reference.all.length, 4);
assert.strictEqual(reference.fast.length, 2);
assert.strictEqual(reference.charged.length, 2);
assert.strictEqual(reference.byId.get("incinerate").turns, 5);
assert.strictEqual(reference.byId.get("incinerate").dpt, 4);
assert.strictEqual(reference.byId.get("incinerate").ept, 4);
assert.strictEqual(reference.byId.get("hydro-cannon").dpe, 2);
assert.strictEqual(model.effectLabel(reference.byId.get("icy-wind").effects[0]), "Opponent Attack -1 · 100%");

assert.deepStrictEqual(model.filterMoves(reference, { kind: "fast", turns: 5 }).map(move => move.id), ["incinerate"]);
assert.deepStrictEqual(model.filterMoves(reference, { kind: "charged", type: "water" }).map(move => move.id), ["hydro-cannon"]);
assert.deepStrictEqual(model.filterMoves(reference, { kind: "fast", sort: "energy" }).map(move => move.id), ["incinerate", "mud-shot"]);
assert.deepStrictEqual(model.filterMoves(reference, { kind: "charged", query: "icy" }).map(move => move.id), ["icy-wind"]);
assert.strictEqual(model.normalizeMove(fixture[4]), null);
const searchEntries = model.searchEntries(reference);
assert.strictEqual(searchEntries.length, 4);
assert.deepStrictEqual(
  Object.fromEntries(["id", "type", "title", "summary"].map(field => [field, searchEntries.find(entry => entry.id === "incinerate")[field]])),
  { id: "incinerate", type: "fast-move", title: "Incinerate", summary: "Fire · 20 damage · +20 energy · 5 turns" }
);
assert.ok(searchEntries.find(entry => entry.id === "icy-wind").summary.includes("Opponent Attack -1 · 100%"));

global.window = {};
require("../battle-data.js");
const canonical = model.createReference(window.BATTLE_GAMEMASTER.moves);
assert.ok(canonical.fast.length > 70, "Expected canonical listed Fast Move coverage");
assert.ok(canonical.charged.length > 220, "Expected canonical Charged Move coverage");
assert.deepStrictEqual(
  Object.fromEntries(["power", "energyGain", "turns", "dpt", "ept"].map(field => [field, canonical.byId.get("incinerate")[field]])),
  { power: 20, energyGain: 20, turns: 5, dpt: 4, ept: 4 }
);
assert.deepStrictEqual(
  Object.fromEntries(["power", "energyCost", "dpe"].map(field => [field, canonical.byId.get("hydro-cannon")[field]])),
  { power: 80, energyCost: 40, dpe: 2 }
);

console.log("Judge Compendium Move Reference tests passed.");
