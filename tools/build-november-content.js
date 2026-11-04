"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const source = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json";
const ids = ["chandelure_mega", "sableye_mega", "zekrom_shadow", "pancham_shadow", "pangoro_shadow",
  "fomantis_shadow", "lurantis_shadow", "wimpod_shadow", "golisopod_shadow", "sandygast_shadow",
  "palossand_shadow", "minior_core", "minior_meteor", "arrokuda", "barraskewda", "maschiff",
  "mabosstiff", "brambleghast"];

async function main() {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Game Master request failed: ${response.status}`);
  const text = await response.text();
  const gm = JSON.parse(text);
  const pokemon = ids.map(id => {
    const entry = gm.pokemon.find(p => p.speciesId === id);
    if (!entry) throw new Error(`Missing ${id}`);
    return entry;
  });
  const moves = ["KOWTOW_CLEAVE", "NIGHT_SHADE_PLUS", "OMINOUS_WIND_PLUS"].map(id => {
    const move = gm.moves.find(m => m.moveId === id);
    if (!move) throw new Error(`Missing ${id}`);
    return move;
  });
  const data = { source, sourceTimestamp: gm.timestamp,
    sourceSha256: crypto.createHash("sha256").update(text).digest("hex"), pokemon, moves };
  const output = `// Scoped release snapshot. Regenerate with tools/build-november-content.js.\n` +
    `(function (root) {\n  "use strict";\n  const data = ${JSON.stringify(data, null, 2)};\n` +
    `  root.BATTLE_NOVEMBER_CONTENT = data;\n` +
    `  const gm = root.BATTLE_GAMEMASTER;\n  if (!gm) return;\n` +
    `  const pokemon = new Map(gm.pokemon.map(p => [p.speciesId, p]));\n` +
    `  const moves = new Map(gm.moves.map(m => [m.moveId, m]));\n` +
    `  data.pokemon.forEach(p => pokemon.set(p.speciesId, p));\n` +
    `  data.moves.forEach(m => moves.set(m.moveId, m));\n` +
    `  gm.pokemon = [...pokemon.values()];\n  gm.moves = [...moves.values()];\n` +
    `  gm.contentVersion = "20261104-content1";\n` +
    `  if (root.BATTLE_MEGA_OVERLAY) {\n` +
    `    const mega = root.BATTLE_MEGA_OVERLAY;\n` +
    `    const forms = new Map(mega.pokemon.map(p => [p.speciesId, p]));\n` +
    `    data.pokemon.filter(p => p.tags?.includes("mega")).forEach(p => forms.set(p.speciesId, p));\n` +
    `    const extra = new Map(mega.moves.map(m => [m.moveId, m]));\n` +
    `    data.moves.filter(m => m.isMegaMove).forEach(m => extra.set(m.moveId, m));\n` +
    `    mega.pokemon = [...forms.values()];\n    mega.moves = [...extra.values()];\n  }\n` +
    `})(typeof window !== "undefined" ? window : globalThis);\n`;
  fs.writeFileSync(path.resolve(__dirname, "../data/content-update-20261104.js"), output);
  console.log(`November snapshot: ${pokemon.length} forms, ${moves.length} moves (${gm.timestamp}).`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
