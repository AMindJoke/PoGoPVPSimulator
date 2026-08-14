"use strict";

const assert = require("assert");
const {
  pokemonIdFromSignature,
  cellTargetsPokemon
} = require("./refresh-great-league-matchup-cache");

const jsonSignature = JSON.stringify({
  id: "aegislash_shield",
  formId: "aegislash_shield",
  moves: [{ id: "AEGISLASH_CHARGE_PSYCHO_CUT" }]
});

assert.equal(pokemonIdFromSignature(jsonSignature), "aegislash_shield");
assert.equal(pokemonIdFromSignature("aegislash_shield:rank1:legacy"), "aegislash_shield");
assert.equal(
  cellTargetsPokemon(`${jsonSignature}|1-1|standard`, new Set(["aegislash_shield"])),
  true
);
assert.equal(
  cellTargetsPokemon(`${jsonSignature}|1-1|standard`, new Set(["mimikyu"])),
  false
);

console.log("Ranking cache refresh signature tests passed.");
