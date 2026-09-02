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

const configured = TeamBuilder.updateMember(great, 2, {
  fastMoveId: "SHADOW_CLAW",
  chargedMoveIds: ["HYDRO_CANNON", "ICE_BEAM"],
  build: { profile: "custom", ivAtk: 2, ivDef: 14, ivHp: 15, level: 24.5, cp: 1499, rank: 37 }
});
assert.equal(configured.team[2].fastMoveId, "SHADOW_CLAW", "Fast Move editing must update only the chosen member.");
assert.deepEqual(configured.team[2].chargedMoveIds, ["HYDRO_CANNON", "ICE_BEAM"], "Both Charged Move slots must persist in order.");
assert.deepEqual(configured.team[2].build, { profile: "custom", league: "great", ivAtk: 2, ivDef: 14, ivHp: 15, level: 24.5, cp: 1499, rank: 37 });
assert.equal(configured.team[1].pokemonId, "skarmory", "Editing one build must not affect another slot.");
assert.equal(great.team[2].fastMoveId, "FAST", "Build updates must remain immutable.");
assert.throws(() => TeamBuilder.updateMember(great, 0, { fastMoveId: "FAST" }), /TEAM_MEMBER_MISSING/);

const analysisConfigured = TeamBuilder.setAnalysisConfig(configured, { meta: "great-league-current", shields: "2-2" });
assert.deepEqual(analysisConfigured.analysisConfig, { meta: "great-league-current", shields: "2-2" });
assert.equal(configured.analysisConfig.shields, "1-1", "Analysis configuration updates must remain immutable.");
assert.equal(TeamBuilder.setAnalysisConfig(configured, { shields: "invalid" }).analysisConfig.shields, "1-1");

const serialized = JSON.parse(JSON.stringify(analysisConfigured));
assert.deepEqual(TeamBuilder.normalizeState(serialized), analysisConfigured, "Movesets, builds and analysis configuration must survive serialization.");
assert.notEqual(great.team[2].chargedMoveIds, great.team[1]?.chargedMoveIds, "Member move arrays must not share mutable references.");

const megaMember = pokemon("mega_test", 9999, { charged: ["CHARGE_1", "CHARGE_2", "CHARGE_3"] });
megaMember.selectedChargedMoveLimit = 3;
const withMega = TeamBuilder.setMember(TeamBuilder.createState(), 0, megaMember);
assert.deepEqual(withMega.team[0].chargedMoveIds, ["CHARGE_1", "CHARGE_2", "CHARGE_3"], "A form capability must preserve three selected Charged Attacks.");
assert.equal(withMega.team[0].selectedChargedMoveLimit, 3);

console.log("Team Builder state tests passed.");
