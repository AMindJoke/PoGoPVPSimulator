"use strict";

const assert = require("node:assert/strict");
const Collection = require("../src/battle/charged-move-collection.js");
const TurnEngine = require("../src/battle/turn-resolution-engine.js");

const ids = ["MOVE_1", "MOVE_2", "MOVE_3", "MOVE_4"];

assert.equal(Collection.selectedLimit({}), 2, "Ordinary Pokémon must keep the two-move default.");
assert.equal(Collection.selectedLimit({ battleCapabilities: { selectedChargedMoveLimit: 3 } }), 3);
assert.equal(Collection.selectedLimit({ selectedChargedMoveLimit: 4 }), 4, "The model must not hardcode a maximum of three.");
assert.deepEqual(Collection.normalizeIds(["MOVE_1", "MOVE_1", "MOVE_2"]), ["MOVE_1", "MOVE_2"]);
assert.deepEqual(Collection.selectedIds({
  pokemon: { battleCapabilities: { selectedChargedMoveLimit: 3 } },
  selectedIds: ["MOVE_2"],
  fallbackIds: ["MOVE_1", "MOVE_3"],
  availableIds: ids
}), ["MOVE_2", "MOVE_1", "MOVE_3"]);
assert.equal(Collection.validateSelection({ selectedIds: ["MOVE_1", "MOVE_1"] }).valid, false);
assert.equal(Collection.validateSelection({ selectedIds: ["MOVE_1", "UNKNOWN"], availableIds: ids }).valid, false);

const chargedMoves = [
  { id: "MOVE_1", energyCost: 35 },
  { id: "MOVE_2", energyCost: 45 },
  { id: "MOVE_3", energyCost: 55 }
];
const state = TurnEngine.createState({
  currentTurn: 0,
  sides: {
    A: { id: "mega", hp: 100, energy: 100, attack: 120, readyTurn: 0, fastMove: { id: "FAST", turns: 2 }, chargedMoves },
    B: { id: "target", hp: 100, energy: 0, attack: 100, readyTurn: 0, fastMove: { id: "FAST_B", turns: 2 }, chargedMoves: [] }
  }
});
assert.deepEqual(
  TurnEngine.getLegalActions(state, "A").filter(action => action.type === "charged").map(action => action.moveId),
  ["MOVE_1", "MOVE_2", "MOVE_3"],
  "The canonical turn engine must expose every affordable selected Charged Attack."
);
state.sides.A.energy = 44;
assert.deepEqual(
  TurnEngine.getLegalActions(state, "A").filter(action => action.type === "charged").map(action => action.moveId),
  ["MOVE_1"],
  "Energy legality must be evaluated independently for every move in the collection."
);

console.log("Charged move collection tests passed.");
