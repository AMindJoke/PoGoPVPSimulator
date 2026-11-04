"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const G = require("./build-great-league-meta-database");
const Announced = require("../src/battle/announced-moves");
const Mega = require("../src/battle/mega-rules");
const gm = G.readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
const raw = new Map(gm.pokemon.map(p => [p.speciesId, p]));
const moves = new Map(gm.moves.map(m => [m.moveId, G.normalizeMove(m)]));
const pokemon = new Map(gm.pokemon.map(p => G.normalizePokemon(p, moves)).map(p => [p.id, p]));
const released = ["chandelure_mega", "zekrom_shadow", "pancham_shadow", "pangoro_shadow",
  "fomantis_shadow", "lurantis_shadow", "wimpod_shadow", "golisopod_shadow", "sandygast_shadow",
  "palossand_shadow", "minior_core", "arrokuda", "barraskewda", "maschiff", "mabosstiff", "brambleghast"];
for (const id of released) {
  const p = raw.get(id);
  assert.equal(p?.released, true, id);
  for (const move of [...p.fastMoves, ...p.chargedMoves, ...(p.extraChargedMoves || [])]) assert(moves.has(move), `${id}: ${move}`);
}
assert.equal(raw.get("minior_meteor").released, false, "Meteor is an internal form, not a second independent build.");
assert.equal(Mega.isEligible(pokemon.get("minior_meteor"), "standard"), false);
for (const [id, extra, power] of [["sableye_mega", "NIGHT_SHADE_PLUS", 55], ["chandelure_mega", "OMINOUS_WIND_PLUS", 50]]) {
  const p = pokemon.get(id);
  for (const level of [1, 2, 3, 4]) {
    const selected = Mega.selectedChargedMoves(p, p.charged.slice(0, 2).map(id => moves.get(id)), level, moves);
    assert.equal(selected.length, 3);
    assert.equal(selected[2].id, extra);
    assert.equal(selected[2].power, power * Mega.bonus(level));
  }
}
for (const [id, move] of [["kingambit", "KOWTOW_CLEAVE"], ["magnezone", "MAGNET_BOMB"], ["magnezone_shadow", "MAGNET_BOMB"]]) {
  const p = raw.get(id), before = JSON.stringify(p.chargedMoves);
  assert(!p.chargedMoves.includes(move), "Unreleased previews must not enter live ranking pools.");
  assert(Announced.chargedIds(p).includes(move));
  assert.match(Announced.label(p, move, new Date(2026, 10, 4)), /Upcoming/);
  assert.match(Announced.label(p, move, new Date(2026, 11, 1)), /Preview/, "A date alone must not silently promote an attack.");
  assert.equal(JSON.stringify(p.chargedMoves), before);
}
const html = fs.readFileSync("PogoPvp.html", "utf8");
const helpers = html.slice(html.indexOf("    function initializeBattleForm("), html.indexOf("    function resetCombatantFormOnSwitch("));
const ctx = vm.createContext({ changes: [] });
ctx.applyFormChange = (c, trigger) => {
  const target = c.p.formChange.alternativeFormId;
  ctx.changes.push(trigger);
  c.p = target === "minior_meteor" ? { id: target, formChange: { trigger: "hp", amount: .5, alternativeFormId: "minior_core" } }
    : { id: target, formChange: { trigger: "battle_start", alternativeFormId: "minior_meteor" } };
  return { trigger, toId: target };
};
vm.runInContext(helpers, ctx);
const c = { p: { id: "minior_core", atk: 218, formChange: { trigger: "battle_start", alternativeFormId: "minior_meteor" } },
  attack: 109, ivAtk: 0, hp: 100, maxHp: 100, energy: 73, shields: 1, level: 20 };
ctx.initializeBattleForm(c);
assert.equal(c.p.id, "minior_meteor");
c.hp = 50; assert.equal(ctx.applyHpFormChange(c), null);
c.hp = 49; assert.equal(ctx.applyHpFormChange(c).toId, "minior_core");
ctx.initializeBattleForm(c); assert.equal(c.p.id, "minior_core", "A continuation must not reset Core back to Meteor.");
assert.equal(c.cpm, .5); assert.equal(c.energy, 73); assert.equal(c.shields, 1); assert.equal(c.level, 20);
const dead = { p: { formChange: { trigger: "hp", amount: .5 } }, hp: 0, maxHp: 100 };
assert.equal(ctx.applyHpFormChange(dead), null);
const defaults = G.readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS");
const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true, strict: true });
for (const id of ["sableye_mega", "chandelure_mega"]) {
  const p = pokemon.get(id);
  const config = G.createBattleConfig(p, pokemon.get("azumarill"), G.RANK1_PROFILE, moves, defaults, pokemon);
  config.left.charged = Mega.selectedChargedMoves(p, config.left.charged, 3, moves);
  const result = adapter.simulate({ id, key: id, signature: id, aShields: 1, bShields: 1, trace: true, includeSwing: false, config });
  assert(Number.isFinite(result.score));
  assert.equal(config.left.charged.length, 3);
  assert.equal(result.provenance.currentEngineVersion, G.MATRIX_VERSION);
}
for (const [opponent, finalForm] of [["azumarill", "minior_core"], ["registeel", "minior_meteor"], ["corviknight", "minior_core"]]) {
  const config = G.createBattleConfig(pokemon.get("minior_core"), pokemon.get(opponent), G.RANK1_PROFILE, moves, defaults, pokemon);
  const result = adapter.simulate({ id: opponent, key: opponent, signature: opponent, aShields: 1, bShields: 1, trace: true, includeSwing: false, config });
  assert(Number.isFinite(result.score));
  const decisions = result.decisionTrace.decisions.filter(d => d.side === "A");
  assert(decisions.some(d => d.pokemonId === "minior_meteor"), "Minior must actually start the simulation in Meteor.");
  assert.equal(result.decisionTrace.finalState.A.pokemonId, finalForm,
    "Registeel KOs directly from above half HP; surviving threshold crossings must become Core.");
  if (opponent === "azumarill") assert(decisions.some(d => d.pokemonId === "minior_core"));
}
console.log("November content passed: released forms, complete move pools, Mega levels, isolated previews, Minior boundary and 5 canonical battles.");
