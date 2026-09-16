"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Generator = require("./build-great-league-meta-database");

const root = path.resolve(__dirname, "..");
const browser = { console };
browser.window = browser;
browser.globalThis = browser;
vm.createContext(browser);
for (const relative of ["battle-data.js", "default-movesets.js", "data/seasons/next-season.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), browser, { filename: relative });
}

const expected = {
  victreebel: { fast: "SUCKER_PUNCH", charged: ["LEAF_BLADE", "ACID_SPRAY"], alternative: ["ACID", "LEAF_BLADE", "SLUDGE_BOMB"] },
  victreebel_shadow: { fast: "SUCKER_PUNCH", charged: ["LEAF_BLADE", "ACID_SPRAY"], alternative: ["ACID", "LEAF_BLADE", "SLUDGE_BOMB"] },
  annihilape: { fast: "LOW_KICK", charged: ["RAGE_FIST", "ICE_PUNCH"], alternative: ["LOW_KICK", "SHADOW_BALL", "ICE_PUNCH"] },
  annihilape_shadow: { fast: "LOW_KICK", charged: ["RAGE_FIST", "ICE_PUNCH"], alternative: ["LOW_KICK", "SHADOW_BALL", "ICE_PUNCH"] },
  quagsire: { fast: "MUD_SHOT", charged: ["AQUA_TAIL", "STONE_EDGE"], alternative: ["MUD_SHOT", "AQUA_TAIL", "MUD_BOMB"] },
  quagsire_shadow: { fast: "MUD_SHOT", charged: ["AQUA_TAIL", "STONE_EDGE"], alternative: ["MUD_SHOT", "AQUA_TAIL", "MUD_BOMB"] }
};

const generated = Generator.buildPreviewMovesets(browser.BATTLE_DEFAULT_MOVESETS, browser.BATTLE_GAMEMASTER, browser.BATTLE_NEXT_SEASON);
const seasonalJson = JSON.parse(fs.readFileSync(path.join(root, "data/seasons/twilight-trails/default-movesets.json"), "utf8"));
const pokemonById = new Map(browser.BATTLE_GAMEMASTER.pokemon.map(pokemon => [pokemon.speciesId, pokemon]));
const moveIds = new Set(browser.BATTLE_GAMEMASTER.moves.map(move => move.moveId));

for (const [id, target] of Object.entries(expected)) {
  const pokemon = pokemonById.get(id);
  assert.ok(pokemon, `Missing Pokemon ${id}`);
  for (const source of [browser.BATTLE_DEFAULT_MOVESETS, seasonalJson, generated]) {
    const set = source[id];
    assert.equal(set.fast, target.fast, `${id} fast move`);
    assert.deepEqual(Array.from(set.charged), target.charged, `${id} charged moves`);
    assert.equal(set.metaOverride, true, `${id} Meta override marker`);
    assert.deepEqual([set.alternatives[0].fast, ...Array.from(set.alternatives[0].charged)], target.alternative, `${id} alternative moveset`);
  }
  assert.ok(pokemon.fastMoves.includes(target.fast));
  target.charged.forEach(moveId => assert.ok(pokemon.chargedMoves.includes(moveId)));
  [target.fast, ...target.charged, ...target.alternative].forEach(moveId => assert.ok(moveIds.has(moveId), `Missing move ${moveId}`));
}

const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
assert.match(html, /const source = standard\?\.metaOverride \? standard : rankingEntry\?\.moveset;/);
assert.match(html, /function metaAlternativeMovesets\(entry, detail\)/);
assert.match(html, /const movesetScoreStale = Boolean\(publishedMovesetKey && activeMovesetKey !== publishedMovesetKey\);/);
assert.match(html, /Live battles and Team Builder simulations use the updated moveset shown above\./);

console.log("Meta moveset override tests passed.");
