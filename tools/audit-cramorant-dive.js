"use strict";

const fs = require("fs");
const path = require("path");

// Keep the season explicit when this script is run outside the normal build command.
if (!process.argv.some(arg => arg.startsWith("--season="))) process.argv.push("--season=twilight-trails");

const root = path.resolve(__dirname, "..");
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const write = (relative, value) => {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + "\n");
};

const G = require("./build-great-league-meta-database");
const { createRuntime } = require("./run-battle-regressions");

const ranking = read("data/great-league-rankings.json");
const runtime = createRuntime();
const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true });
const pokemon = runtime.pokemonMap.get("cramorant");
const cache = read("data/seasons/twilight-trails/matchup-cache/great-league/rank1/cramorant.json");
const signatures = new Map();
for (const [key] of Object.entries(cache.cells)) {
  const [signature, , mode] = key.split("|");
  if (mode !== "standard") continue;
  const parsed = JSON.parse(signature);
  signatures.set(parsed.id, { signature, parsed });
}

const field = ranking.entries.filter(entry => entry.id !== "cramorant");
const sets = [
  { name: "surf", fast: "PECK", charged: ["FLY", "SURF"] },
  { name: "dive", fast: "PECK", charged: ["FLY", "DIVE"] },
];
let simulations = 0;

function keyFor(set) { return [set.fast, ...set.charged].join("/"); }

function configFor(opponent, set) {
  const config = G.createBattleConfig(
    pokemon,
    runtime.pokemonMap.get(opponent.id),
    G.RANK1_PROFILE,
    runtime.moveMap,
    runtime.standardMovesets,
    runtime.pokemonMap,
  );
  const old = signatures.get(opponent.id);
  if (!old) throw new Error(`Missing frozen cache signature for ${opponent.id}`);
  config.right.fast = structuredClone(runtime.moveMap.get(old.parsed.moves[0].id));
  config.right.charged = old.parsed.moves.slice(1).map(move => structuredClone(runtime.moveMap.get(move.id)));
  config.left.fast = structuredClone(runtime.moveMap.get(set.fast));
  config.left.charged = set.charged.map(move => structuredClone(runtime.moveMap.get(move)));
  return config;
}

function simulate(opponent, set, shields, mode) {
  const config = configFor(opponent, set);
  if (mode === "smart" || mode === "both-smart") config.right.shieldMode = "smart";
  if (mode === "both-smart") config.left.shieldMode = "smart";
  const battle = adapter.simulate({
    id: ++simulations,
    config,
    aShields: shields,
    bShields: shields,
    includeSwing: false,
  });
  const compact = G.compactResult(battle, "cramorant", opponent.id);
  return { score: compact.score, winner: compact.winnerSide };
}

function measure(set, opponents, mode) {
  const sums = [0, 0, 0];
  const wins = [0, 0, 0];
  const losses = [0, 0, 0];
  for (const opponent of opponents) {
    for (const shields of [0, 1, 2]) {
      const result = simulate(opponent, set, shields, mode);
      sums[shields] += result.score;
      if (result.winner === "A") wins[shields]++;
      if (result.winner === "B") losses[shields]++;
    }
  }
  const shieldScores = sums.map(sum => sum / opponents.length);
  const score = Math.round(shieldScores.reduce((sum, value) => sum + value, 0) / 3);
  return { set: keyFor(set), mode, score, shieldScores, wins, losses, opponents: opponents.length };
}

const result = {
  generatedAt: new Date().toISOString(),
  seasonId: ranking.metadata.seasonId,
  engineVersion: ranking.metadata.engineVersion,
  dataVersion: ranking.metadata.dataVersion,
  fieldSize: field.length,
  methodology: "Equal-weight comparison against the published full field; opponent moves frozen from Cramorant rank1 cache.",
  results: [],
};

for (const mode of ["baseline", "smart", "both-smart"]) {
  for (const set of sets) {
    const measured = measure(set, field, mode);
    result.results.push(measured);
    console.log(`${mode} ${measured.set}: score ${measured.score}; shields ${measured.shieldScores.map(value => value.toFixed(2)).join(", ")}; wins ${measured.wins.join(", ")}`);
  }
}

const top100 = field.filter(entry => entry.rank <= 100);
result.top100 = [];
for (const mode of ["baseline", "smart", "both-smart"]) {
  for (const set of sets) result.top100.push(measure(set, top100, mode));
}

result.simulations = simulations;
write("reports/cramorant-surf-vs-dive-20260911.json", result);
console.log(`COMPLETE ${simulations} simulations`);
