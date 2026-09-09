"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "reports", "twilight-trails-regeneration-confirmed");
const statusPath = path.join(output, "status.json");
const node = process.execPath;
const offsets = [0, 400, 800, 1200];
const limit = 400;
const seasonRoot = "data/seasons/twilight-trails/";
fs.mkdirSync(output, { recursive: true });

const sourceFiles = ["PogoPvp.html", "data/seasons/next-season.js", "tools/build-great-league-meta-database.js"];
for (const folder of ["src/battle", "src/season", "src/reliability"]) {
  for (const entry of fs.readdirSync(path.join(root, folder))) {
    if (entry.endsWith(".js")) sourceFiles.push(path.join(folder, entry));
  }
}
function fingerprint() {
  const hash = crypto.createHash("sha256");
  for (const file of sourceFiles.sort()) hash.update(file).update(fs.readFileSync(path.join(root, file)));
  return hash.digest("hex");
}
const sourceHash = fingerprint();
const status = { pid: process.pid, startedAt: new Date().toISOString(), state: "running", completed: [], sourceHash };
function save() {
  status.updatedAt = new Date().toISOString();
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2) + "\n");
}
function run(name, args, logName = name) {
  if (fingerprint() !== sourceHash) return Promise.reject(new Error("Source files changed during regeneration."));
  status.stage = name;
  save();
  const logPath = path.join(output, logName + ".log");
  const log = fs.openSync(logPath, "w");
  return new Promise((resolve, reject) => {
    const child = spawn(node, args, { cwd: root, windowsHide: true, stdio: ["ignore", log, log] });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(`${name} exited with code ${code}`)));
  }).finally(() => fs.closeSync(log));
}
function chunkArgs(offset, extra = []) {
  return ["tools/build-great-league-meta-database.js", "--season=twilight-trails", "--all-pokemon", "--ranking-only", "--profiles=rank1", "--opponents=all", "--ranking-model=equal-shields", "--matchup-cache", "--chunk-output", `--offset=${offset}`, `--limit=${limit}`, ...extra];
}
async function runChunks(stage, extra = []) {
  status.stage = stage;
  status.workers = offsets.map(offset => ({ offset, state: "running" }));
  save();
  await Promise.all(offsets.map(async (offset, index) => {
    try {
      await run(`${stage}-${String(offset).padStart(4, "0")}`, chunkArgs(offset, extra), `${stage}-${String(offset).padStart(4, "0")}`);
      status.workers[index].state = "complete";
      status.completed.push(`${stage}-${String(offset).padStart(4, "0")}`);
      save();
    } catch (error) {
      status.workers[index].state = "failed";
      status.error = error.stack || String(error);
      save();
      throw error;
    }
  }));
}
async function main() {
  save();
  await run("01-data-test", ["tools/test-twilight-trails-data.js"]);
  status.completed.push("01-data-test"); save();
  await runChunks("02-matchups-ranking");
  const globalArgs = ["tools/build-great-league-meta-database.js", "--season=twilight-trails", "--all-pokemon", "--ranking-only", "--profiles=rank1", "--opponents=all", "--ranking-model=equal-shields", "--matchup-cache", "--cache-only", "--full-output"];
  await run("03-global-first", globalArgs);
  fs.copyFileSync(path.join(root, seasonRoot, "great-league-rankings.json"), path.join(output, "great-league-rankings-iteration-1.json"));
  await run("05-global-final", [...globalArgs, `--weight-source=${path.join(output, "great-league-rankings-iteration-1.json")}`, "--weight-mode=competitive"]);
  await run("06-analysis", ["tools/analyze-great-league-dataset.js", "--input=" + seasonRoot + "great-league-rankings.json", "--output=" + seasonRoot + "analysis/great-league-analysis.json"]);
  await run("07-details", ["tools/build-ranking-details.js", "--season=twilight-trails"]);
  const ranking = JSON.parse(fs.readFileSync(path.join(root, seasonRoot, "great-league-rankings.json"), "utf8"));
  if (ranking.entries.length !== ranking.metadata.fullCandidateCount || ranking.metadata.dataVersion !== "twilight-trails-confirmed-1" || ranking.metadata.failedSimulations) throw new Error("Final ranking metadata validation failed.");
  status.entries = ranking.entries.length;
  status.state = "complete-awaiting-review-and-publication";
}
main().catch(error => { status.state = "failed"; status.error = error.stack || String(error); process.exitCode = 1; }).finally(save);
