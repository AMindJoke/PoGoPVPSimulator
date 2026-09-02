"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Forms = require("../src/battle/pokemon-form.js");
const Charged = require("../src/battle/charged-move-collection.js");
const TurnEngine = require("../src/battle/turn-resolution-engine.js");

const context = {};
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(require("node:path").join(__dirname, "..", "battle-data.js"), "utf8"), context);
const gm = context.BATTLE_GAMEMASTER;
const megaForms = gm.pokemon.filter(Forms.isMega);
assert.equal(megaForms.length, 55, "Canonical Mega forms must be discoverable through structured tags.");

const megaX = megaForms.find(pokemon => pokemon.speciesId === "charizard_mega_x");
const megaY = megaForms.find(pokemon => pokemon.speciesId === "charizard_mega_y");
assert(megaX && megaY);
assert.notEqual(megaX.speciesId, megaY.speciesId, "Mega X and Y must remain distinct simulation identities.");
assert.notDeepEqual(megaX.types, megaY.types, "Form-specific typing must remain canonical.");
assert.notDeepEqual(megaX.baseStats, megaY.baseStats, "Form-specific stats must not collapse onto the base species.");
assert.equal(Forms.describe(megaX).kind, "mega");

const selectedIds = Charged.selectedIds({
  pokemon: { ...megaX, battleCapabilities: { selectedChargedMoveLimit: 3 } },
  selectedIds: megaX.chargedMoves.slice(0, 3),
  availableIds: megaX.chargedMoves
});
assert.equal(selectedIds.length, 3);
const moveById = new Map(gm.moves.map(move => [move.moveId, move]));
const selectedMoves = selectedIds.map(id => ({ id, energyCost: Math.abs(Number(moveById.get(id)?.energy || 0)) }));
const state = TurnEngine.createState({ currentTurn: 0, sides: {
  A: { id: megaX.speciesId, hp: 150, energy: 100, attack: 200, readyTurn: 0, fastMove: { id: megaX.fastMoves[0], turns: 2 }, chargedMoves: selectedMoves },
  B: { id: "fixture", hp: 150, energy: 0, attack: 100, readyTurn: 0, fastMove: { id: "FAST", turns: 2 }, chargedMoves: [] }
} });
assert.deepEqual(TurnEngine.getLegalActions(state, "A").filter(action => action.type === "charged").map(action => action.moveId), selectedIds, "A tagged Mega fixture must expose all three selected Charged Attacks to the canonical engine.");

console.log("Mega form architecture tests passed.");
