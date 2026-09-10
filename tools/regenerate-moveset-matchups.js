"use strict";
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { Worker, isMainThread, workerData } = require("node:worker_threads");
const root = path.resolve(__dirname, "..");
const dir = path.join(root, "reports/moveset-refresh-20260910");
const ids = ["rillaboom", "vigoroth", "vigoroth_shadow"];
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const write = (name, data) => fs.writeFileSync(path.join(dir, name), JSON.stringify(data) + "\n");
fs.mkdirSync(dir, { recursive: true });
function run({ id, selected }) {
  const G = require("./build-great-league-meta-database");
  const runtime = require("./run-battle-regressions").createRuntime();
  const ranking = read("data/great-league-rankings.json");
  const reference = read(`data/seasons/twilight-trails/matchup-cache/great-league/rank1/${id}.json`);
  const signatures = new Map([[id, JSON.parse(reference.attackerSignature)]]);
  for (const key of Object.keys(reference.cells)) {
    const signature = JSON.parse(key.split("|")[0]);
    signatures.set(signature.id, signature);
  }
  const bases = new Map();
  for (const entry of ranking.entries) {
    const old = signatures.get(entry.id);
    const base = G.createCombatant(runtime.pokemonMap.get(entry.id), "A", G.RANK1_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
    base.fast = structuredClone(runtime.moveMap.get(old.moves[0].id));
    base.charged = old.moves.slice(1).map(m => structuredClone(runtime.moveMap.get(m.id)));
    assert.deepEqual(JSON.parse(G.combatantStateSignature(base)), old);
    const set = selected[entry.id];
    if (set) {
      base.fast = structuredClone(runtime.moveMap.get(set.fast));
      base.charged = set.charged.map(m => structuredClone(runtime.moveMap.get(m)));
    }
    bases.set(entry.id, base);
  }
  const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true });
  const rows = []; let seq = 0;
  function pair(a, b) {
    const left = structuredClone(bases.get(a)), right = structuredClone(bases.get(b));
    left.trainer = "A"; right.trainer = "B";
    const config = { left, right, startEnergyA: 0, startEnergyB: 0 };
    const row = { a, b, attackerSignature: G.combatantStateSignature(left), defenderSignature: G.combatantStateSignature(right), results: [] };
    for (const s of [0, 1, 2]) row.results.push(G.compactResult(adapter.simulate({ id: ++seq, config: G.cloneBattleConfig(config), aShields: s, bShields: s, includeSwing: false }), a, b));
    rows.push(row);
  }
  for (const opponent of ranking.entries) {
    if (opponent.id === id) continue;
    pair(id, opponent.id);
    if (!ids.includes(opponent.id)) pair(opponent.id, id);
    if (rows.length % 400 === 0) console.log(`${id}: ${rows.length} pairs`);
  }
  write(`${id}-pairs.json`, { completed: true, simulations: seq, rows });
  console.log(`${id}: complete ${seq} simulations`);
}
if (!isMainThread) run(workerData);
else {
  const ranking = read("data/great-league-rankings.json");
  const selected = {}, alternatives = {};
  for (const id of ids) {
    const audit = read(`reports/moveset-combinations-20260910/${id}.json`);
    assert.ok(audit.completed && audit.smartFull?.length >= 2);
    assert.equal(audit.sourceGeneratedAt, ranking.metadata.generatedAt);
    const best = audit.smartFull[0];
    selected[id] = best.set;
    alternatives[id] = audit.smartFull.map(row => {
      const baseline = audit.full.find(x => x.set.fast === row.set.fast && [...x.set.charged].sort().join() === [...row.set.charged].sort().join());
      assert.ok(baseline);
      return { ...row.set, smartScore: row.score, standardScore: baseline.score };
    });
  }
  Promise.all(ids.map(id => new Promise((resolve, reject) => {
    const worker = new Worker(__filename, { workerData: { id, selected } });
    worker.on("error", reject);
    worker.on("exit", code => code ? reject(new Error(`Worker ${id}: ${code}`)) : resolve());
  }))).then(() => {
    const overlays = new Map(); let simulations = 0;
    for (const id of ids) {
      const shard = JSON.parse(fs.readFileSync(path.join(dir, `${id}-pairs.json`), "utf8"));
      assert.ok(shard.completed); simulations += shard.simulations;
      for (const pair of shard.rows) {
        if (!overlays.has(pair.a)) overlays.set(pair.a, { attackerSignature: pair.attackerSignature, replaceAll: ids.includes(pair.a), cells: {} });
        const overlay = overlays.get(pair.a);
        assert.equal(overlay.attackerSignature, pair.attackerSignature);
        pair.results.forEach((result, s) => {
          const key = `${pair.defenderSignature}|${s}-${s}|standard`;
          assert.ok(!(key in overlay.cells)); overlay.cells[key] = result;
        });
      }
    }
    fs.mkdirSync(path.join(dir, "overlays"), { recursive: true });
    for (const [id, overlay] of overlays) {
      assert.equal(Object.keys(overlay.cells).length, ids.includes(id) ? 4623 : 9);
      write(`overlays/${id}.json`, overlay);
    }
    assert.equal(simulations, 27720);
    write("manifest.json", { completed: true, sourceGeneratedAt: ranking.metadata.generatedAt, engineVersion: ranking.metadata.engineVersion, dataVersion: ranking.metadata.dataVersion, selected, alternatives, simulations, rankingPolicy: "Existing standard policy for all cells; smart policy used only for moveset validation and selection" });
    console.log(`REFRESH COMPLETE: ${simulations} cells in both orientations`);
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
