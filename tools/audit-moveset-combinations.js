"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { Worker, isMainThread, workerData } = require("node:worker_threads");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "reports/moveset-combinations-20260910");
const ids = ["rillaboom", "vigoroth", "vigoroth_shadow"];
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + "\n");
fs.mkdirSync(out, { recursive: true });

function audit(id) {
  const G = require("./build-great-league-meta-database");
  const { createRuntime } = require("./run-battle-regressions");
  const ranking = read("data/great-league-rankings.json");
  const weights = ranking.metadata.weightUpdate.weights;
  const runtime = createRuntime();
  const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true });
  const pokemon = runtime.pokemonMap.get(id);
  const source = ranking.entries.find(e => e.id === id);
  const cache = read(`data/seasons/twilight-trails/matchup-cache/great-league/rank1/${id}.json`);
  assert.equal(cache.matrixVersion, ranking.metadata.engineVersion);
  assert.equal(cache.dataVersion, ranking.metadata.dataVersion);
  const signatures = new Map();
  const baseline = new Map();
  for (const [key, value] of Object.entries(cache.cells)) {
    const [signature, state, mode] = key.split("|");
    if (mode !== "standard") continue;
    const parsed = JSON.parse(signature);
    signatures.set(parsed.id, { signature, parsed });
    baseline.set(`${parsed.id}/${state}`, value);
  }
  const top = ranking.entries.slice(0, 100).filter(e => e.id !== id);
  const field = ranking.entries.filter(e => e.id !== id);
  const keyFor = set => [set.fast, ...set.charged].join("/");
  const sets = [];
  for (const fast of pokemon.fast) for (let i = 0; i < pokemon.charged.length; i++) for (let j = i + 1; j < pokemon.charged.length; j++) {
    sets.push({ fast, charged: [pokemon.charged[i], pokemon.charged[j]] });
  }
  const scratch = { ...source.moveset, fast: "SCRATCH" };
  for (const set of [source.moveset, scratch]) if (!sets.some(s => keyFor(s) === keyFor(set))) sets.push(set);
  const previousPath = path.join(out, `${id}.json`);
  const previous = fs.existsSync(previousPath) ? JSON.parse(fs.readFileSync(previousPath, "utf8")) : null;
  if (previous) {
    assert.equal(previous.sourceGeneratedAt, ranking.metadata.generatedAt);
    assert.equal(previous.engineVersion, ranking.metadata.engineVersion);
  }
  let simulations = previous?.simulations || 0;
  const memo = new Map();
  for (const row of [...(previous?.screen || []), ...(previous?.full || []), ...(previous?.smartFull || []), ...(previous?.reversedSlots ? [previous.reversedSlots] : [])]) {
    for (const cell of row.cells) memo.set(`${keyFor(row.set)}|${cell.opponent}|${cell.shields}|${row.mode || "baseline"}`, { score: cell.score, winner: cell.winner });
  }
  for (const row of previous?.robustness || []) for (const cell of row.rows) {
    for (const [mode, value] of Object.entries(cell.modes)) memo.set(`${keyFor(row.set)}|${cell.opponent}|${cell.shields}|${mode}`, value);
  }
  const result = { id, sourceGeneratedAt: ranking.metadata.generatedAt, engineVersion: ranking.metadata.engineVersion, dataVersion: ranking.metadata.dataVersion, weightsFrozen: true, baseline: source.moveset, scratchBaseline: scratch, screen: [], full: [], robustness: [], completed: false };
  const save = stage => { result.stage = stage; result.simulations = simulations; write(`${id}.json`, result); };
  function configFor(opponent, set) {
    const config = G.createBattleConfig(pokemon, runtime.pokemonMap.get(opponent.id), G.RANK1_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
    // Freeze opponent slots to the published cache, independently of fallback heuristics.
    const old = signatures.get(opponent.id);
    config.right.fast = structuredClone(runtime.moveMap.get(old.parsed.moves[0].id));
    config.right.charged = old.parsed.moves.slice(1).map(m => structuredClone(runtime.moveMap.get(m.id)));
    assert.equal(G.combatantStateSignature(config.right), old.signature);
    config.left.fast = structuredClone(runtime.moveMap.get(set.fast));
    config.left.charged = set.charged.map(m => structuredClone(runtime.moveMap.get(m)));
    return config;
  }
  function simulate(opponent, set, shields, mode = "baseline") {
    const key = `${keyFor(set)}|${opponent.id}|${shields}|${mode}`;
    if (memo.has(key)) return memo.get(key);
    const config = configFor(opponent, set);
    if (mode === "smart" || mode === "both-smart") config.right.shieldMode = "smart";
    if (mode === "both-smart") config.left.shieldMode = "smart";
    if (mode === "no-bait") config.left.baiting = "off";
    const battle = adapter.simulate({ id: ++simulations, config, aShields: shields, bShields: shields, includeSwing: false });
    const compact = G.compactResult(battle, id, opponent.id);
    const cell = { score: compact.score, winner: compact.winnerSide };
    memo.set(key, cell);
    return cell;
  }
  function measure(set, opponents, mode = "baseline") {
    const total = opponents.reduce((s, e) => s + weights[e.id], 0);
    const sums = [0, 0, 0], wins = [0, 0, 0];
    const cells = [];
    for (const opponent of opponents) {
      for (const shields of [0, 1, 2]) {
        const cell = simulate(opponent, set, shields, mode);
        sums[shields] += cell.score * weights[opponent.id] / total;
        wins[shields] += cell.winner === "A" ? 1 : 0;
        cells.push({ opponent: opponent.id, rank: opponent.rank, shields, ...cell });
      }
    }
    const score = Math.round(Math.exp(sums.map(s => Math.log(Math.round(Math.max(1, Math.min(100, s / 10))))).reduce((a, b) => a + b) / 3) * 10);
    return { set, mode, score, shieldScores: sums, wins, opponents: opponents.length, cells };
  }
  for (const opponent of top.slice(0, 3)) for (const shields of [0, 1, 2]) {
    assert.equal(simulate(opponent, source.moveset, shields).score, baseline.get(`${opponent.id}/${shields}-${shields}`)[0], `${id}: fresh baseline must match`);
  }
  for (const set of sets) {
    result.screen.push(measure(set, top));
    save("screen");
    console.log(`${id} screen ${result.screen.length}/${sets.length}: ${keyFor(set)} ${result.screen.at(-1).score}`);
  }
  result.screen.sort((a, b) => b.score - a.score || b.shieldScores.reduce((s, v) => s + v) - a.shieldScores.reduce((s, v) => s + v));
  const uniquePairs = new Set();
  const finalists = result.screen.filter(row => {
    const key = [row.set.fast, ...[...row.set.charged].sort()].join("/");
    if (uniquePairs.has(key)) return false;
    uniquePairs.add(key);
    return true;
  }).slice(0, 2).map(r => r.set);
  if (!finalists.some(s => keyFor(s) === keyFor(scratch))) finalists.push(scratch);
  for (const set of finalists) {
    const measured = measure(set, field);
    result.full.push(measured);
    save("full-field");
    console.log(`${id} full: ${keyFor(set)} ${measured.score}`);
  }
  result.full.sort((a, b) => b.score - a.score || b.shieldScores.reduce((s, v) => s + v) - a.shieldScores.reduce((s, v) => s + v));
  const best = result.full[0];
  const reversed = { fast: best.set.fast, charged: [...best.set.charged].reverse() };
  result.reversedSlots = measure(reversed, top);
  for (const candidate of result.full) {
    const rows = [];
    for (const opponent of top.slice(0, 30)) for (const shields of [1, 2]) {
      const modes = {};
      for (const mode of ["baseline", "smart", "both-smart", "no-bait"]) modes[mode] = simulate(opponent, candidate.set, shields, mode);
      rows.push({ opponent: opponent.id, shields, modes });
    }
    result.robustness.push({ set: candidate.set, rows });
  }
  if (process.argv.includes("--smart-full")) {
    result.smartFull = [];
    const pairs = new Set();
    for (const candidate of result.full) {
      const pair = [candidate.set.fast, ...[...candidate.set.charged].sort()].join("/");
      if (pairs.has(pair)) continue;
      pairs.add(pair);
      result.smartFull.push(measure(candidate.set, field, "smart"));
      save("smart-full");
      console.log(`${id} SMART: ${keyFor(candidate.set)} ${result.smartFull.at(-1).score}`);
    }
    result.smartFull.sort((a, b) => b.score - a.score || b.shieldScores.reduce((s, v) => s + v) - a.shieldScores.reduce((s, v) => s + v));
  }
  result.completed = true;
  save("complete");
  console.log(`${id} COMPLETE: ${keyFor(best.set)} ${best.score}; ${simulations} simulations`);
}

if (!isMainThread) audit(workerData);
else {
  Promise.all(ids.map(id => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: id, argv: process.argv.slice(2) });
    worker.on("error", reject);
    worker.on("exit", code => code === 0 ? resolve() : reject(new Error(`${id} exited ${code}`)));
  }))).then(() => {
    const results = ids.map(id => JSON.parse(fs.readFileSync(path.join(out, `${id}.json`), "utf8")));
    assert.ok(results.every(r => r.completed));
    write("summary.json", { completed: true, simulations: results.reduce((s, r) => s + r.simulations, 0), candidates: results.map(r => ({ id: r.id, best: { set: r.full[0].set, score: r.full[0].score }, full: r.full.map(({ cells, ...row }) => row) })) });
    console.log("ALL MOVESET AUDITS COMPLETE");
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
