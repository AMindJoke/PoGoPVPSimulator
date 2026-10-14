"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const G = require("./build-great-league-meta-database");

const root = path.resolve(__dirname, "..");
const input = process.argv[2];
if (!input) throw new Error("Usage: node tools/build-mega-overlay.js <PvPoke gamemaster.json>");
const source = fs.readFileSync(path.resolve(input), "utf8");
const gm = JSON.parse(source);
const pokemon = gm.pokemon.filter(entry => entry.tags?.includes("mega"));
const requiredMoves = new Set(pokemon.flatMap(entry => [
  ...entry.fastMoves, ...entry.chargedMoves, ...(entry.extraChargedMoves || [])
]));
const canonicalMoves = new Set(G.readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER").moves.map(entry => entry.moveId));
const moves = gm.moves.filter(entry => requiredMoves.has(entry.moveId) && !canonicalMoves.has(entry.moveId));
if (canonicalMoves.size + moves.length < requiredMoves.size ||
    [...requiredMoves].some(id => !canonicalMoves.has(id) && !moves.some(move => move.moveId === id))) {
  throw new Error("Mega overlay has unresolved move IDs");
}
const overlay = {
  source: "https://github.com/pvpoke/pvpoke/blob/master/src/data/gamemaster.json",
  sourceTimestamp: gm.timestamp,
  sourceSha256: crypto.createHash("sha256").update(source).digest("hex"),
  pokemon,
  moves
};
const output = path.join(root, "data", "mega-overlay-20261013.js");
fs.writeFileSync(output, `window.BATTLE_MEGA_OVERLAY = ${JSON.stringify(overlay, null, 2)};\n`);
console.log(`Wrote ${path.relative(root, output)}: ${pokemon.length} Mega forms, ${moves.length} moves.`);
