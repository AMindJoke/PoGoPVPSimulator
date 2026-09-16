"use strict";

// Repairs season cache files in place. Existing cells are retained; only
// current attacker/defender signatures that are absent are simulated.
const fs = require("fs");
const path = require("path");
process.argv.push("--season=twilight-trails");
const G = require("./build-great-league-meta-database");
const { createRuntime } = require("./run-battle-regressions");
const { MATCHUP_SCORE_VERSION } = require("../src/analysis/matchup-inspector");

const ROOT = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const worker = Math.max(0, Number(process.argv.find(a => a.startsWith("--worker="))?.split("=")[1] || 0));
const workers = Math.max(1, Number(process.argv.find(a => a.startsWith("--workers="))?.split("=")[1] || 1));
const scanOnly = args.has("--scan-only");
const season = "twilight-trails";
const profile = G.RANK1_PROFILE;
const cacheDir = path.join(ROOT, "data", "seasons", season, "matchup-cache", "great-league", profile);
const sourceData = G.generationData();
const moveMap = new Map(sourceData.gameMaster.moves.map(move => [move.moveId, G.normalizeMove(move)]));
const pokemonMap = new Map(sourceData.gameMaster.pokemon
  .filter(pokemon => pokemon && pokemon.speciesId && pokemon.baseStats)
  .map(pokemon => G.normalizePokemon(pokemon, moveMap))
  .map(pokemon => [pokemon.id, pokemon]));
const standardMovesets = sourceData.standardMovesets;
const adapter = scanOnly ? null : G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true });
const ranking = JSON.parse(fs.readFileSync(path.join(ROOT, "data/great-league-rankings.json"), "utf8"));
const pokemon = ranking.entries.map(entry => pokemonMap.get(entry.id)).filter(Boolean);

function key(config, shieldState) {
  return [G.combatantStateSignature(config.right), shieldState, "standard"].join("|");
}

function compact(result) {
  return [result.score, result.winnerSide, result.winnerId, result.hpRatioA,
    result.hpRatioB, result.winnerEdge, result.hpEdge, result.energyEdge,
    result.shieldEdge, result.readyEdge, result.dangerEdge,
    result.closingCostEdge, result.farmPressureEdge, result.outpacePressureEdge];
}

let totalMissing = 0;
let repairedFiles = 0;
let sequence = 0;
const selected = pokemon.filter((_, index) => index % workers === worker);
for (const attacker of selected) {
  const file = path.join(cacheDir, `${attacker.id}.json`);
  let cache = { schemaVersion: 1, league: "great", cells: {} };
  if (fs.existsSync(file)) {
    try { cache = JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { cache.cells = {}; }
  }
  if (!cache.cells || typeof cache.cells !== "object") cache.cells = {};
  const before = Object.keys(cache.cells).length;
  let missing = 0;
  for (const opponent of pokemon) {
    const config = G.createBattleConfig(attacker, opponent, profile, moveMap, standardMovesets, pokemonMap);
    for (const shields of [0, 1, 2]) {
      const shieldState = `${shields}-${shields}`;
      const cellKey = key(config, shieldState);
      if (cache.cells[cellKey]) continue;
      missing++;
      if (!scanOnly) {
        const result = adapter.simulate({
          id: ++sequence,
          source: "cache-compatibility-repair",
          key: `cache-repair-${attacker.id}-${opponent.id}-${shieldState}`,
          signature: G.MATRIX_VERSION,
          aShields: shields,
          bShields: shields,
          includeSwing: false,
          config
        });
        cache.cells[cellKey] = compact(G.compactResult(result, attacker.id, opponent.id));
      }
    }
  }
  totalMissing += missing;
  if (!scanOnly) {
    const signatureConfig = G.createBattleConfig(attacker, attacker, profile, moveMap, standardMovesets, pokemonMap);
    cache.generatedAt = new Date().toISOString();
    cache.matrixVersion = G.MATRIX_VERSION;
    cache.scoreVersion = MATCHUP_SCORE_VERSION;
    cache.seasonId = season;
    cache.dataVersion = "twilight-trails-confirmed-1";
    cache.attackerSignature = G.combatantStateSignature(signatureConfig.left);
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache) + "\n", "utf8");
    repairedFiles++;
  }
  if (missing) console.log(`[worker ${worker + 1}/${workers}] ${attacker.id}: missing=${missing}, before=${before}`);
}
console.log(`[worker ${worker + 1}/${workers}] complete: attackers=${selected.length}, files=${repairedFiles}, missing=${totalMissing}, scanOnly=${scanOnly}`);
