"use strict";

const fs = require("fs");
const path = require("path");
if (!process.argv.some(arg => arg.startsWith("--season="))) process.argv.push("--season=twilight-trails");

const root = path.resolve(__dirname, "..");
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const write = (relative, value) => fs.writeFileSync(path.join(root, relative), JSON.stringify(value, null, 2) + "\n");
const G = require("./build-great-league-meta-database");
const { createRuntime } = require("./run-battle-regressions");

const ranking = read("data/great-league-rankings.json");
const runtime = createRuntime();
const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true });
const signatureCache = read("data/seasons/twilight-trails/matchup-cache/great-league/rank1/cramorant.json");
const signatures = new Map();
for (const [key] of Object.entries(signatureCache.cells)) {
  const [signature, , mode] = key.split("|");
  if (mode !== "standard") continue;
  const parsed = JSON.parse(signature);
  signatures.set(parsed.id, { signature, parsed });
}

const opponents = ranking.entries.filter(entry => !["vigoroth", "vigoroth_shadow"].includes(entry.id));
const formsArg = process.argv.find(arg => arg.startsWith("--forms="));
const selectedForms = (formsArg ? formsArg.slice("--forms=".length) : "vigoroth,vigoroth_shadow").split(",").filter(Boolean);
const modesArg = process.argv.find(arg => arg.startsWith("--modes="));
const selectedModes = (modesArg ? modesArg.slice("--modes=".length) : "baseline,smart,both-smart").split(",").filter(Boolean);
const sets = [
  ["BODY_SLAM", "BULLDOZE"],
  ["BODY_SLAM", "ROCK_SLIDE"],
  ["BRICK_BREAK", "BULLDOZE"],
  ["BRICK_BREAK", "ROCK_SLIDE"],
];
let simulations = 0;

function configFor(attacker, opponent, charged) {
  const config = G.createBattleConfig(attacker, runtime.pokemonMap.get(opponent.id), G.RANK1_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
  const old = signatures.get(opponent.id);
  if (!old) throw new Error(`Missing frozen signature for ${opponent.id}`);
  config.right.fast = structuredClone(runtime.moveMap.get(old.parsed.moves[0].id));
  config.right.charged = old.parsed.moves.slice(1).map(move => structuredClone(runtime.moveMap.get(move.id)));
  config.left.fast = structuredClone(runtime.moveMap.get("SCRATCH"));
  config.left.charged = charged.map(move => structuredClone(runtime.moveMap.get(move)));
  return config;
}

function simulate(attacker, opponent, charged, shields, mode) {
  const config = configFor(attacker, opponent, charged);
  if (mode === "smart" || mode === "both-smart") config.right.shieldMode = "smart";
  if (mode === "both-smart") config.left.shieldMode = "smart";
  const battle = adapter.simulate({ id: ++simulations, config, aShields: shields, bShields: shields, includeSwing: false });
  const compact = G.compactResult(battle, attacker.id, opponent.id);
  return { score: compact.score, winner: compact.winnerSide };
}

function measure(attacker, charged, pool, mode) {
  const sums = [0, 0, 0];
  const wins = [0, 0, 0];
  const losses = [0, 0, 0];
  for (const opponent of pool) for (const shields of [0, 1, 2]) {
    const result = simulate(attacker, opponent, charged, shields, mode);
    sums[shields] += result.score;
    if (result.winner === "A") wins[shields]++;
    if (result.winner === "B") losses[shields]++;
  }
  const shieldScores = sums.map(sum => sum / pool.length);
  return {
    set: charged,
    mode,
    score: Math.round(shieldScores.reduce((sum, value) => sum + value, 0) / 3),
    shieldScores,
    wins,
    losses,
    opponents: pool.length,
  };
}

const result = {
  generatedAt: new Date().toISOString(),
  seasonId: ranking.metadata.seasonId,
  engineVersion: ranking.metadata.engineVersion,
  dataVersion: ranking.metadata.dataVersion,
  methodology: "Equal-weight comparison with frozen published opponent signatures; all four charged-move pairs tested on both forms.",
  forms: {},
};

for (const id of selectedForms) {
  const attacker = runtime.pokemonMap.get(id);
  result.forms[id] = { full: [], top100: [] };
  for (const mode of selectedModes) {
    for (const charged of sets) {
      result.forms[id].full.push(measure(attacker, charged, opponents, mode));
      console.log(`${id} ${mode} ${charged.join("/")}: ${result.forms[id].full.at(-1).score}`);
    }
  }
  const top100 = opponents.filter(entry => entry.rank <= 100);
  for (const mode of selectedModes) {
    for (const charged of sets) result.forms[id].top100.push(measure(attacker, charged, top100, mode));
  }
}

result.simulations = simulations;
write("reports/vigoroth-movesets-20260911.json", result);
console.log(`COMPLETE ${simulations} simulations`);
