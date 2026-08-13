const assert = require("node:assert/strict");
const BattleLink = require("../src/team-builder/team-builder-battle-link.js");

const payload = {
  version: 1,
  left: { pokemonId: "jumpluff_shadow", fastMoveId: "FAIRY_WIND", chargedMoveIds: ["ENERGY_BALL", "ACROBATICS"], ivAtk: 0, ivDef: 15, ivHp: 15, shields: 2, baiting: "selective", shieldMode: "smart", startEnergy: 0 },
  right: { pokemonId: "talonflame", fastMoveId: "INCINERATE", chargedMoveIds: ["FLY", "FLAME_CHARGE"], ivAtk: 0, ivDef: 15, ivHp: 15, shields: 2, baiting: "selective", shieldMode: "smart", startEnergy: 0 }
};

const token = BattleLink.encode(payload);
assert.match(token, /^[A-Za-z0-9_-]+$/, "Battle payloads must be URL-safe.");
assert.deepEqual(BattleLink.decode(token), BattleLink.normalizePayload(payload), "Battle payloads must round-trip every canonical setup field.");
const url = new URL(BattleLink.createUrl("https://example.test/PogoPvp.html#team=old", payload));
assert.equal(url.searchParams.get(BattleLink.PARAM), token);
assert.equal(url.hash, "", "A direct Battle link must not retain an unrelated shared-team hash.");
assert.deepEqual(BattleLink.readLocation({ search: url.search }), BattleLink.normalizePayload(payload));
assert.equal(BattleLink.decode("not-valid"), null, "Malformed payloads must fail closed.");
assert.equal(BattleLink.readLocation({ search: "?tbBattle=broken" }), null, "Malformed location payloads must not alter the simulator.");

console.log("Team Builder direct Battle link tests passed.");
