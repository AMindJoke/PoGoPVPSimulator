"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Season = require("../src/season/season-context.js");
const Generator = require("./build-great-league-meta-database.js");

const root = path.resolve(__dirname, "..");
function loadWindow(relative, name) {
  const context = { window: {}, console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), context, { filename: relative });
  return context.window[name] || context[name];
}

const canonical = loadWindow("battle-data.js", "BATTLE_GAMEMASTER");
const canonicalMovesets = loadWindow("default-movesets.js", "BATTLE_DEFAULT_MOVESETS");
const preview = loadWindow("data/seasons/next-season.js", "BATTLE_NEXT_SEASON");
const moveResolved = Season.applyMoveOverrides(canonical, preview.moveOverrides);
const resolved = Season.applyPokemonMoveOverrides(moveResolved, preview.pokemonMoveOverrides);
const previewMovesets = Generator.buildPreviewMovesets(canonicalMovesets, resolved, preview);

assert.equal(JSON.stringify(previewMovesets.lickilicky), JSON.stringify(canonicalMovesets.lickilicky), "An existing valid moveset must retain stable move ordering.");
assert.equal(resolved.pokemon.find(pokemon => pokemon.speciesId === "houndoom").fastMoves.includes("INCINERATE"), true);
assert.equal(resolved.pokemon.find(pokemon => pokemon.speciesId === "miltank").chargedMoves.includes("HIGH_HORSEPOWER"), true);
assert.equal(previewMovesets.houndoom.fast, "INCINERATE", "A newly available superior Fast Attack must be considered by preview generation.");
assert.equal(previewMovesets.miltank.charged.includes("HIGH_HORSEPOWER"), true, "A newly available superior Charged Attack must be considered by preview generation.");
assert.notEqual(previewMovesets, canonicalMovesets);
assert.equal(JSON.stringify(loadWindow("default-movesets.js", "BATTLE_DEFAULT_MOVESETS").lickilicky), JSON.stringify(canonicalMovesets.lickilicky), "Preview moveset generation must not mutate Current Season defaults.");

console.log("Season generation tests passed.");
