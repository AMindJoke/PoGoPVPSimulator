"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const G = require("./build-great-league-meta-database");

const root = path.resolve(__dirname, "..");
const season = "december-2026";
const output = `data/seasons/${season}`;
const report = `reports/december-preview-${G.MATRIX_VERSION}`;
const cache = `${report}/cache`;
const offsets = [0, 400, 800, 1200];
fs.mkdirSync(path.join(root, report), { recursive: true });

function run(label, script, args) {
  return new Promise((resolve, reject) => {
    const log = fs.openSync(path.join(root, report, `${label}.log`), "w");
    const child = spawn(process.execPath, [path.join(root, "tools", script), ...args], {
      cwd: root, windowsHide: true, stdio: ["ignore", log, log]
    });
    fs.closeSync(log);
    child.on("error", reject);
    child.on("exit", code => {
      console.log(`${label}: ${code === 0 ? "complete" : "failed"}`);
      if (code === 0) resolve();
      else reject(new Error(`${label} exited with ${code}. See ${report}/${label}.log`));
    });
  });
}

async function main() {
  const args = [
    `--season=${season}`, "--all-pokemon", "--opponents=meta", "--profiles=rank1",
    "--ranking-only", "--matchup-cache", "--native-worker", `--matchup-cache-root=${cache}`,
    "--weight-source=data/ranking-inputs/twilight-trails/weights-ranked-core.json", "--weight-mode=prevalence",
    "--candidate-prior-source=data/ranking-inputs/twilight-trails/expert-candidate-prior.json", "--candidate-prior-weight=0.3"
  ];
  await Promise.all(offsets.map(offset => run(`ranking-${offset}`, "build-great-league-meta-database.js", [
    ...args, "--chunk-output", `--offset=${offset}`, "--limit=400"
  ])));
  // Recompute scores across the full candidate pool after warming the cache.
  // Individual chunk scores have different opponent/candidate distributions.
  await run("ranking-final", "build-great-league-meta-database.js", [...args, "--cache-only"]);
  await Promise.all(offsets.map(offset => run(`top50-${offset}`, "fill-meta-top50-cache.js", [
    `--ranking=${output}/great-league-rankings.json`, `--cache-root=${cache}`,
    `--offset=${offset}`, "--limit=400"
  ])));
  await run("analysis", "analyze-great-league-dataset.js", [
    `--input=${output}/great-league-rankings.json`, `--output=${report}/analysis.json`
  ]);
  await run("details", "build-ranking-details.js", [
    `--season=${season}`, `--ranking-input=${output}/great-league-rankings.json`,
    `--analysis-input=${report}/analysis.json`, `--cache-root=${cache}/rank1`
  ]);
  console.log(`December preview generated in ${output}.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
