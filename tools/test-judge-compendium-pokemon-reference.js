const assert = require("assert");
const PokemonReference = require("../src/compendium/pokemon-reference.js");

const moves = new Map([["BUBBLE", { id: "BUBBLE", name: "Bubble" }], ["PLAY_ROUGH", { id: "PLAY_ROUGH", name: "Play Rough" }]]);
const reference = PokemonReference.createReference([{ id: "azumarill", name: "Azumarill", dex: 184, types: ["water", "fairy"], atk: 112, def: 152, hp: 225, fast: ["BUBBLE"], charged: ["PLAY_ROUGH"] }], moves);
assert.equal(reference.all.length, 1);
assert.equal(reference.byId.get("azumarill").def, 152);
assert.equal(PokemonReference.filter(reference, { query: "azu" }).length, 1);
assert.equal(PokemonReference.filter(reference, { type: "fire" }).length, 0);
assert.equal(PokemonReference.learners(reference, "BUBBLE")[0].name, "Azumarill");
assert.equal(PokemonReference.searchEntries(reference)[0].type, "pokemon");
const learnerReference = PokemonReference.createReference([
  { id: "cradily", name: "Cradily", dex: 346, types: ["rock", "grass"], fast: ["BUBBLE"], charged: [] },
  { id: "cradily_rank1", name: "Cradily", dex: 346, types: ["rock", "grass"], fast: ["BUBBLE"], charged: [] },
  { id: "cradily_shadow", name: "Cradily (Shadow)", dex: 346, types: ["rock", "grass"], fast: ["BUBBLE"], charged: [] },
  { id: "lileep", name: "Lileep", dex: 345, types: ["rock", "grass"], fast: ["BUBBLE"], charged: [] }
], moves);
assert.deepEqual(PokemonReference.learnerSpecies(learnerReference, "BUBBLE").map(item => item.name), ["Cradily", "Lileep"], "Move learner displays should collapse duplicate and Shadow entries to one species.");
console.log("Judge Compendium Pokémon Reference tests passed.");
