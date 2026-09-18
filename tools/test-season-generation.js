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
assert.match(Generator.movesetHash(canonicalMovesets), /^[a-f0-9]{64}$/, "Moveset provenance hash must be a SHA-256 digest.");
assert.notEqual(Generator.movesetHash(previewMovesets), Generator.movesetHash(canonicalMovesets), "A preview moveset change must produce a new provenance hash.");
const prevalenceWeights = Generator.normalizeExplicitOpponentWeights({ common: 3, rare: 1 });
assert.equal(Math.round((prevalenceWeights.get("common") / prevalenceWeights.get("rare")) * 100) / 100, 3, "Explicit prevalence weights must preserve relative frequency.");
assert.throws(() => Generator.normalizeExplicitOpponentWeights({}), /at least one positive value/, "Empty prevalence weights must fail clearly.");
assert.equal(Generator.blendCandidateScore(500, 600, .3), 530, "Candidate prior blending must keep the configured role/prior proportions.");
assert.equal(Generator.blendCandidateScore(500, 600, 0), 500, "A zero candidate-prior weight must preserve the role score.");
assert.equal(Generator.fastEnergyInTurns({ turns: 5, energyGain: 20 }, 6), 20, "A five-turn Fast Attack completes once in a six-turn advantage window.");
assert.equal(Generator.fastEnergyInTurns({ turns: 2, energyGain: 9 }, 6), 27, "A two-turn Fast Attack completes three times in a six-turn advantage window.");
assert.equal(Generator.fastEnergyInTurns({ turns: 7, energyGain: 20 }, 6), 0, "A Fast Attack longer than the advantage window grants no premature energy.");

console.log("Season generation tests passed.");
