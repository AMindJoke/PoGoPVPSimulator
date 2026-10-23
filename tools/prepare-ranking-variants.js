"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const G = require("./build-great-league-meta-database");
const root = path.resolve(__dirname, "..");
const version = G.MATRIX_VERSION.replace("battle-planner-", "");
const folder = path.join(root, "reports", `ranking-variants-${version}`);
fs.mkdirSync(folder, { recursive: true });
const state = { engine: G.MATRIX_VERSION, status: "generating", jobs: [] };
const save = () => fs.writeFileSync(path.join(folder, "state.json"), JSON.stringify(state, null, 2) + "\n");
function run(label, script, args) {
  return new Promise((resolve, reject) => {
    const log = fs.openSync(path.join(folder, `${label}.log`), "a");
    const child = spawn(process.execPath, [path.join(root, "tools", script), ...args],
      { cwd: root, windowsHide: true, stdio: ["ignore", log, log] });
    fs.closeSync(log);
    const job = { label, args, pid: child.pid, status: "running" };
    state.jobs.push(job); save();
    child.on("error", reject);
    child.on("exit", code => {
      job.status = code === 0 ? "complete" : "failed"; save();
      console.log(`${label}: ${job.status}`);
      code === 0 ? resolve() : reject(new Error(`${label}: exit ${code}`));
    });
  });
}
async function main() {
  await Promise.all([0, 400, 800, 1200].map(offset => run(`chunk-${offset}`, "build-great-league-meta-database.js", [
    "--season=twilight-trails", "--all-pokemon", "--opponents=meta", "--profiles=rank1",
    "--ranking-only", "--matchup-cache", "--native-worker", `--matchup-cache-root=reports/meta-refresh-cache-${G.MATRIX_VERSION}`,
    "--weight-source=data/ranking-inputs/twilight-trails/weights-ranked-core.json", "--weight-mode=prevalence",
    "--candidate-prior-source=data/ranking-inputs/twilight-trails/expert-candidate-prior.json", "--candidate-prior-weight=0.3",
    `--offset=${offset}`, "--limit=400", `--ranking-output=reports/ranking-variants-${version}/chunk-${offset}.json`
  ])));
  state.status = "preparing"; save();
  await run("prepare", "refresh-current-meta.js", ["--prepare", "--cache-only"]);
  state.status = "prepared"; save();
}
main().catch(error => { state.status = "failed"; state.error = error.message; save(); console.error(error); process.exitCode = 1; });
