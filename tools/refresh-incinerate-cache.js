"use strict";

// Rebuild only the timing-sensitive Incinerate attacker rows with the current
// battle engine. Workers write disjoint attacker files, so they can run in
// parallel without contending on a shared cache file.
const fs = require("fs");
const path = require("path");
const G = require("./build-great-league-meta-database");
const { createRuntime } = require("./run-battle-regressions");

const ROOT = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const workerArg = process.argv.find(arg => arg.startsWith("--worker="));
const workersArg = process.argv.find(arg => arg.startsWith("--workers="));
const worker = Math.max(0, Number(workerArg?.split("=")[1] || 0));
const workers = Math.max(1, Number(workersArg?.split("=")[1] || 1));
const season = "twilight-trails";
const profile = G.RANK1_PROFILE;
const cacheDir = path.join(ROOT, "data", "seasons", season, "matchup-cache", "great-league", profile);

const runtime = createRuntime();
const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true });
const ranking = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "great-league-rankings.json"), "utf8"));
const opponents = ranking.entries
  .map(entry => runtime.pokemonMap.get(entry.id))
  .filter(Boolean);
const missingOnly = args.has("--missing");
const attackers = opponents
  .filter(p => !missingOnly || !fs.existsSync(path.join(cacheDir, `${p.id}.json`)))
  .filter(p => !missingOnly || p.fast.length)
  .filter(p => !missingOnly || opponents.some(candidate => candidate.id === p.id))
  .filter(p => missingOnly || p.fast.some(moveId => (runtime.moveMap.get(moveId)?.turns || 0) >= 5))
  .sort((a, b) => a.id.localeCompare(b.id));
const selected = attackers.filter((_, index) => index % workers === worker);

function cacheCellKey(config, shieldState) {
  const defenderSignature = G.combatantStateSignature(config.right);
  return [defenderSignature, shieldState, "standard"].join("|");
}

function compactCacheResult(result) {
  return [
    result.score, result.winnerSide, result.winnerId, result.hpRatioA,
    result.hpRatioB, result.winnerEdge, result.hpEdge, result.energyEdge,
    result.shieldEdge, result.readyEdge, result.dangerEdge,
    result.closingCostEdge, result.farmPressureEdge, result.outpacePressureEdge
  ];
}

function refreshAttacker(attacker, sequenceRef) {
  const cells = {};
  for (const opponent of opponents) {
    if (opponent.id === attacker.id) continue;
    const config = G.createBattleConfig(
      attacker,
      opponent,
      profile,
      runtime.moveMap,
      runtime.standardMovesets,
      runtime.pokemonMap
    );
    for (const shields of [0, 1, 2]) {
      const shieldState = `${shields}-${shields}`;
      const result = adapter.simulate({
        id: ++sequenceRef.value,
        source: "incinerate-cache-refresh",
        key: `incinerate-refresh-${attacker.id}-${opponent.id}-${shieldState}`,
        signature: G.MATRIX_VERSION,
        aShields: shields,
        bShields: shields,
        includeSwing: false,
        config
      });
      cells[cacheCellKey(config, shieldState)] = compactCacheResult(G.compactResult(result, attacker.id, opponent.id));
    }
  }
  const signatureConfig = G.createBattleConfig(
    attacker,
    attacker,
    profile,
    runtime.moveMap,
    runtime.standardMovesets,
    runtime.pokemonMap
  );
  const attackerSignature = G.combatantStateSignature(signatureConfig.left);
  fs.mkdirSync(cacheDir, { recursive: true });
  const target = path.join(cacheDir, `${attacker.id}.json`);
  fs.writeFileSync(target, JSON.stringify({
    schemaVersion: 1,
    league: "great",
    generatedAt: new Date().toISOString(),
    matrixVersion: G.MATRIX_VERSION,
    seasonId: season,
    dataVersion: null,
    attackerSignature,
    cells
  }) + "\n", "utf8");
  return Object.keys(cells).length;
}

if (worker >= workers) throw new Error(`Worker ${worker} is outside 0..${workers - 1}.`);
const sequenceRef = { value: 0 };
let cells = 0;
for (const attacker of selected) {
  const count = refreshAttacker(attacker, sequenceRef);
  cells += count;
  console.log(`[worker ${worker + 1}/${workers}] ${attacker.id}: ${count} cells`);
}
console.log(`[worker ${worker + 1}/${workers}] complete: ${selected.length} attackers, ${cells} cells.`);
