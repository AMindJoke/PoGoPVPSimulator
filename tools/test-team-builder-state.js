const assert = require("node:assert/strict");
const TeamBuilder = require("../src/team-builder/team-builder-state.js");

const pokemon = (pokemonId, dex, moves = {}) => ({
  pokemonId,
  dex,
  name: pokemonId,
  types: ["normal"],
  shadow: pokemonId.includes("shadow"),
  fastMoveId: moves.fast || "FAST",
  chargedMoveIds: moves.charged || ["CHARGE_1", "CHARGE_2"],
  build: { profile: "default" }
});

let state = TeamBuilder.createState();
assert.equal(state.team.length, 6, "A Show 6 state must always contain exactly six slots.");
assert.equal(state.league, "great");
assert.deepEqual(TeamBuilder.validateState(state), []);

state = TeamBuilder.setMember(state, 0, pokemon("abomasnow", 460));
assert.equal(state.team[0].pokemonId, "abomasnow", "A Pokemon can be added to an empty slot.");
const independent = TeamBuilder.setMember(state, 1, pokemon("lickilicky", 463));
assert.equal(independent.team[0].pokemonId, "abomasnow");
assert.equal(independent.team[1].pokemonId, "lickilicky", "Each slot owns independent semantic state.");
assert.equal(state.team[1], null, "State transitions must not mutate the previous state.");

const replaced = TeamBuilder.setMember(independent, 1, pokemon("skarmory", 227));
assert.equal(replaced.team[1].pokemonId, "skarmory", "A populated slot can be replaced.");
const removed = TeamBuilder.removeMember(replaced, 0);
assert.equal(removed.team[0], null, "A team member can be removed.");
assert.equal(removed.team[1].pokemonId, "skarmory");

const shadow = TeamBuilder.setMember(removed, 2, pokemon("feraligatr_shadow", 160));
assert.equal(shadow.team[2].shadow, true, "Shadow form state must be preserved.");
assert.throws(() => TeamBuilder.setMember(shadow, 3, pokemon("feraligatr", 160)), /TEAM_SPECIES_DUPLICATE/, "Species Clause must reject normal/Shadow duplicates.");
assert.throws(() => TeamBuilder.setMember(shadow, 3, pokemon("feraligatr_shadow", 160)), /TEAM_SPECIES_DUPLICATE/);

const great = TeamBuilder.setLeague(shadow, "great");
assert.equal(great.league, "great", "League state must persist through normalization.");
assert.throws(() => TeamBuilder.setLeague(great, "ultra"), /TEAM_LEAGUE_UNAVAILABLE/, "Unavailable league providers must not be silently selected.");

const serialized = JSON.parse(JSON.stringify(great));
assert.deepEqual(TeamBuilder.normalizeState(serialized), great, "Team Builder state must be serializable for future sharing.");
assert.notEqual(great.team[2].chargedMoveIds, great.team[1]?.chargedMoveIds, "Member move arrays must not share mutable references.");

console.log("Team Builder state tests passed.");
