"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Promotion = require("../src/season/season-promotion");
const root = path.resolve(__dirname, "..");
function load(file, name) {
  const context = {};
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), context);
  return context[name];
}
function json(file) { return JSON.parse(fs.readFileSync(path.join(root, file), "utf8")); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + "\n");
}
function writeScript(file, name, value) {
  fs.writeFileSync(path.join(root, file), `window.${name} = ${JSON.stringify(value, null, 2)};\n`);
}
const next = load("data/seasons/next-season.js", "BATTLE_NEXT_SEASON");
if (!next?.enabled) throw new Error("An enabled, confirmed next season is required.");
const gm = load("battle-data.js", "BATTLE_GAMEMASTER");
const validation = Promotion.validateFinalPreview(next, gm, { requireGenerated: true });
if (validation.errors.length) throw new Error(validation.errors.join("\n"));
const source = `data/seasons/${next.id}/`;
const ranking = json(source + "great-league-rankings.json");
const details = json(source + "great-league-ranking-details.json");
const movesets = json(source + "default-movesets.json");
if (ranking.metadata.seasonId !== next.id || ranking.metadata.dataVersion !== next.dataVersion ||
    ranking.metadata.failedSimulations || details.sourceRankingGeneratedAt !== ranking.metadata.generatedAt ||
    ranking.entries.length !== Object.keys(details.entries).length) throw new Error("Season assets are not finalized and synchronized.");
if (!process.argv.includes("--apply")) {
  console.log(`Validated promotion of ${next.id}: ${ranking.entries.length} entries. Use --apply to write canonical assets.`);
} else {
  writeScript("battle-data.js", "BATTLE_GAMEMASTER", validation.resolvedGameMaster);
  writeScript("default-movesets.js", "BATTLE_DEFAULT_MOVESETS", movesets);
  writeJson("data/great-league-rankings.json", ranking);
  writeJson("data/rankings/great-league-full.json", ranking);
  writeScript("data/great-league-rankings.js", "GREAT_LEAGUE_RANKINGS", ranking);
  writeJson("data/great-league-ranking-details.json", details);
  writeScript("data/great-league-ranking-details.js", "GREAT_LEAGUE_RANKING_DETAILS", details);
  console.log(`Promoted canonical assets for ${next.id}. Update catalog, disable the preview and bump asset caches.`);
}
