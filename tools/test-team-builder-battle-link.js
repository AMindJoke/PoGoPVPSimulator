const assert = require("node:assert/strict");
const BattleLink = require("../src/team-builder/team-builder-battle-link.js");

const payload = {
  version: 1,
  left: { pokemonId: "jumpluff_shadow", fastMoveId: "FAIRY_WIND", chargedMoveIds: ["ENERGY_BALL", "ACROBATICS"], ivAtk: 0, ivDef: 15, ivHp: 15, shields: 2, baiting: "selective", shieldMode: "smart", startEnergy: 0 },
  right: { pokemonId: "talonflame", fastMoveId: "INCINERATE", chargedMoveIds: ["FLY", "FLAME_CHARGE"], ivAtk: 0, ivDef: 15, ivHp: 15, shields: 2, baiting: "selective", shieldMode: "smart", startEnergy: 0 }
};
payload.left.chargedMoveIds.push("MOONBLAST");

const token = BattleLink.encode(payload);
assert.match(token, /^[A-Za-z0-9_-]+$/, "Battle payloads must be URL-safe.");
assert.deepEqual(BattleLink.decode(token), BattleLink.normalizePayload(payload), "Battle payloads must round-trip every canonical setup field.");
assert.deepEqual(BattleLink.decode(token).left.chargedMoveIds, ["ENERGY_BALL", "ACROBATICS", "MOONBLAST"], "Battle links must preserve an N-move Charged Attack collection.");
const url = new URL(BattleLink.createUrl("https://example.test/PogoPvp.html#team=old", payload));
assert.equal(url.searchParams.get(BattleLink.PARAM), token);
assert.equal(url.hash, "", "A direct Battle link must not retain an unrelated shared-team hash.");
assert.deepEqual(BattleLink.readLocation({ search: url.search }), BattleLink.normalizePayload(payload));
assert.equal(BattleLink.decode("not-valid"), null, "Malformed payloads must fail closed.");
assert.equal(BattleLink.readLocation({ search: "?tbBattle=broken" }), null, "Malformed location payloads must not alter the simulator.");
const configured = { ...payload, seasonId: "twilight-trails", left: { ...payload.left, ivAtk: 5, startEnergy: 37, shields: 0, baiting: "off", shieldMode: "no-first", startingFastCount: 2 } };
assert.deepEqual(BattleLink.decode(BattleLink.encode(configured)), BattleLink.normalizePayload(configured));
const routed = new URL(BattleLink.createUrl("https://example.test/PogoPvp.html?view=team-builder&compendium=pokemon&item=old#scenario=old", configured));
assert.equal(routed.searchParams.get("view"), "simulator");
assert.equal(routed.searchParams.get("season"), "twilight-trails");
assert.equal(routed.searchParams.has("compendium"), false);
assert.equal(routed.searchParams.has("item"), false);
assert.throws(() => BattleLink.encode({ ...payload, left: { ...payload.left, shields: 3 } }), /INVALID/);
assert.throws(() => BattleLink.encode({ ...payload, left: { ...payload.left, startEnergy: -1 } }), /INVALID/);
assert.equal(BattleLink.decode("a".repeat(20001)), null);

console.log("Team Builder direct Battle link tests passed.");
