"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Mega = require("../src/battle/mega-rules.js");

const root = path.resolve(__dirname, "..");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, "battle-data.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "data/mega-overlay-20261013.js"), "utf8"), context);
const overlay = context.window.BATTLE_MEGA_OVERLAY;
assert.equal(overlay.pokemon.length, 62);
assert.equal(overlay.moves.length, 16);
assert(overlay.sourceSha256 && overlay.sourceTimestamp);
assert.equal(new Set(overlay.pokemon.map(p => p.speciesId)).size, 62);
const moveIds = new Set([...context.window.BATTLE_GAMEMASTER.moves, ...overlay.moves].map(move => move.moveId));
for (const form of overlay.pokemon) {
  assert(form.tags.includes("mega"), `${form.speciesId} must be a Mega form`);
  assert(form.fastMoves.length && form.chargedMoves.length, `${form.speciesId} needs a usable moveset`);
  for (const id of [...form.fastMoves, ...form.chargedMoves, ...(form.extraChargedMoves || [])]) {
    assert(moveIds.has(id), `${form.speciesId} references unknown move ${id}`);
  }
}
assert.equal(overlay.pokemon.filter(p => p.extraChargedMoves?.length).length, 16);
assert(overlay.moves.every(move => move.isMegaMove === true));

const mega = overlay.pokemon.find(p => p.speciesId === "raichu_mega_x");
const plus = overlay.moves.find(m => m.moveId === "VOLT_TACKLE_PLUS");
assert(mega && plus?.isMegaMove);
const normal = [{ id: "WILD_CHARGE", power: 100 }, { id: "SURF", power: 55 }];
const moves = new Map([[plus.moveId, { id: plus.moveId, name: plus.name, power: plus.power, energyCost: plus.energy, isMegaMove: plus.isMegaMove }]]);
const pokemon = { tags: mega.tags, charged: mega.chargedMoves, extraChargedMoves: mega.extraChargedMoves };
for (const [level, expected] of [[1, 65], [2, 71.5], [3, 78], [4, 84.5]]) {
  const selected = Mega.selectedChargedMoves(pokemon, normal, level, moves);
  assert.deepEqual(selected.map(move => move.id), ["WILD_CHARGE", "SURF", "VOLT_TACKLE_PLUS"]);
  assert.equal(selected[2].power, expected);
  assert.equal(selected[0].power, 100);
}
assert.equal(Mega.isEligible(pokemon, "standard"), true);
assert.equal(Mega.isEligible(pokemon, "mega-great"), true);
assert.equal(Mega.isEligible({ ...pokemon, released: false }, "standard"), false);
assert.equal(Mega.canonicalFormatId("mega-great"), "standard");
assert.equal(Mega.canonicalFormatId("mega-ultra"), "ultra");
assert.equal(Mega.format("ultra").cpCap, 2500);
assert.equal(Mega.format("master").cpCap, Infinity);
assert.equal(Mega.format("mega-ultra").cpCap, 2500);
assert.equal(Mega.format("mega-master").cpCap, Infinity);
assert.equal(Mega.level("invalid"), 3);
assert.equal(Mega.selectedChargedMoves({ tags: [], charged: ["SURF"] }, normal, 4, moves).length, 1);
assert.equal(Mega.selectedChargedMoves({ ...pokemon, extraChargedMoves: [] }, normal, 4, moves).length, 2);

const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
assert.match(html, /id="battleFormat"/);
assert.doesNotMatch(html, /<option value="mega-great">/);
assert.match(html, /id="p1MegaLevel" type="hidden" value="3"/);
assert.match(html, /id="p1MegaMove" class="mega-charged-move move-select"/);
assert.match(html, /title="Super Max Level[^"]*"><span class="mega-level-icon"[^>]*><img src="assets\/mega-level\/mega-center\.png"/);
assert.match(html, /data-mega-level="4" aria-pressed="false"/);
assert.doesNotMatch(html, /<select id="p1MegaLevel"/);
assert.match(html, /function selectedChargedMoves\(prefix\)[\s\S]*?megaRules\.selectedChargedMoves/);
assert.match(html, /function selectedStats\(prefix, p\)[\s\S]*?cpCap: battleCpCap\(\)/);
assert.match(html, /function matrixInputIdentity\(\)[\s\S]*?MegaLevel/);
console.log("Mega Battle tests passed.");
