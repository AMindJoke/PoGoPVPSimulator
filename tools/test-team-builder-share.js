"use strict";

const assert = require("node:assert/strict");
const State = require("../src/team-builder/team-builder-state.js");
const Share = require("../src/team-builder/team-builder-share.js");

function member(index) {
  return {
    pokemonId: `pokemon-${index}`,
    dex: index + 1,
    name: `Pokemon ${index}`,
    types: ["Normal"],
    shadow: index === 0,
    fastMoveId: `FAST_${index}`,
    chargedMoveIds: [`CHARGED_${index}_A`, `CHARGED_${index}_B`],
    build: { profile: index === 1 ? "custom" : "rank1", league: "great", ivAtk: index, ivDef: 15, ivHp: 14, level: 20 + index / 2, cp: 1490 + index }
  };
}

const state = State.createState({
  league: "great",
  team: Array.from({ length: 6 }, (_, index) => member(index)),
  analysisConfig: { meta: "great-league-current", shields: "2-2" }
});
const baseline = state.team.map((entry, index) => index === 0 ? member(10) : entry);
const payload = { schemaVersion: 1, state, comparisonBaseline: baseline };
const token = Share.encodeTeam(payload);
assert.match(token, /^v1\.r\.[A-Za-z0-9_-]+$/);
assert.deepEqual(Share.decodeTeam(token), Share.normalizePayload(payload), "Team links must preserve forms, moves, builds, league, analysis settings, and comparison baseline.");
const url = Share.buildTeamUrl(payload, { origin: "https://example.test", pathname: "/PogoPvp.html", search: "?preview=1" });
assert.match(url, /^https:\/\/example\.test\/PogoPvp\.html\?preview=1#team=v1\.r\./);
assert.equal(Share.teamTokenFromLocation(new URL(url)), token);
assert.equal(Share.locationWithoutTeam(new URL(url)), "https://example.test/PogoPvp.html?preview=1");
assert.equal(Share.teamTokenFromLocation({ hash: "#scenario=v1.r.example" }), null);
assert.throws(() => Share.decodeTeam("v2.r.e30"), error => error.code === "SHARED_TEAM_VERSION_UNSUPPORTED");
assert.throws(() => Share.decodeTeam("v1.x.e30"), error => error.code === "INVALID_TEAM_TOKEN");
assert.throws(() => Share.decodeTeam("v1.r.***"), error => error.code === "INVALID_TEAM_TOKEN_DATA");
assert.throws(() => Share.decodeTeam("v1.r.bm90LWpzb24"), error => error.code === "INVALID_TEAM_JSON");
assert.throws(() => Share.encodeTeam({ schemaVersion: 1, state: State.createState() }), error => error.code === "SHARED_TEAM_INCOMPLETE");
assert.throws(() => Share.decodeTeam("x".repeat(Share.MAX_TOKEN_LENGTH + 1)), error => error.code === "INVALID_TEAM_TOKEN");

console.log("Team Builder share-link tests passed.");
