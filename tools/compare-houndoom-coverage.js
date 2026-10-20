"use strict";

const fs = require("node:fs");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");
const Reliability = require("../src/reliability/battle-reliability");
const ranking = require("../data/great-league-rankings.json");
const meta = require("../data/great-league-meta.json").pokemon;
const runtime = R.createRuntime();
const worker = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true, strict: true });
const opponents = [...new Set([...ranking.entries.slice(0, 100).map(entry => entry.id), ...meta])];
const report = { engineVersion: Reliability.BATTLE_ENGINE_VERSION, generatedAt: new Date().toISOString(),
  scope: "Published top 100 plus configured meta; fresh simulations, zero starting energy, equal shields", rows: [] };
let sequence = 0;
for (const pokemonId of ["houndoom_shadow", "houndoom"]) {
  for (const [profile, label] of [[G.DEFAULT_PROFILE, "default"], [G.RANK1_PROFILE, "rank1"]]) {
    for (const shieldMode of ["always", "smart"]) {
      const rows = [];
      for (const coverage of ["FLAMETHROWER", "TRAILBLAZE"]) {
        const cells = [];
        for (const opponentId of opponents.filter(id => id !== pokemonId)) {
          const config = G.createBattleConfig(runtime.pokemonMap.get(pokemonId), runtime.pokemonMap.get(opponentId),
            profile, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
          config.left.fast = runtime.moveMap.get("INCINERATE");
          config.left.charged = ["FOUL_PLAY", coverage].map(id => runtime.moveMap.get(id));
          config.left.shieldMode = config.right.shieldMode = shieldMode;
          for (const shields of [0, 1, 2]) {
            const result = worker.simulate({ id: ++sequence, config, aShields: shields, bShields: shields, includeSwing: false });
            cells.push({ opponentId, shields, outcome: result.details.outcome, score: result.score });
          }
        }
        rows.push({ coverage, cells, wins: [0, 1, 2].map(s => cells.filter(c => c.shields === s && c.outcome === "A").length),
          averageScore: cells.reduce((sum, c) => sum + c.score, 0) / cells.length });
      }
      const [before, after] = rows;
      const flips = after.cells.flatMap((cell, index) => {
        const old = before.cells[index];
        return cell.outcome === old.outcome ? [] : [{ ...cell, previousOutcome: old.outcome, previousScore: old.score }];
      });
      const entry = { pokemonId, profile: label, shieldMode, opponents: before.cells.length / 3,
        sets: rows.map(({ cells, ...row }) => row), flips };
      report.rows.push(entry);
      console.log(JSON.stringify(entry));
    }
  }
}
report.simulations = sequence;
fs.mkdirSync("reports/houndoom-coverage", { recursive: true });
fs.writeFileSync("reports/houndoom-coverage/comparison.json", JSON.stringify(report, null, 2) + "\n");
