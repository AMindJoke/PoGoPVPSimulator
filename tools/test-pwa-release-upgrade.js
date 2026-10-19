"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { execFileSync } = require("node:child_process");
const { chromium } = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
const root = path.resolve(__dirname, "..");
const baseline = process.argv.find(arg => arg.startsWith("--baseline="))?.slice("--baseline=".length) || "135d9153";
const report = { baseline: execFileSync("git", ["rev-parse", baseline], { cwd: root, encoding: "utf8" }).trim(), runs: [] };
const output = path.join(root, "reports/prepush-v49/pwa-upgrade.json");
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
const snapshots = new Map();
let release = "old";
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, "http://localhost").pathname).slice(1);
  const file = path.resolve(root, name);
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
  let data;
  try {
    if (release === "old") {
      if (!snapshots.has(name)) {
        let content = null;
        try { content = execFileSync("git", ["show", `${report.baseline}:${name}`], { cwd: root, maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }); } catch (_) {}
        snapshots.set(name, content);
      }
      data = snapshots.get(name);
      if (!data) throw new Error("Missing baseline asset");
    } else data = fs.readFileSync(file);
  } catch (_) { res.writeHead(404).end(); return; }
  const mime = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
  res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
  // Retain a real HTTP cache as well as CacheStorage across the deployment.
  res.setHeader("Cache-Control", /(?:\.html|sw\.js)$/.test(name) ? "no-cache" : "max-age=3600");
  res.end(data);
});
async function snapshot(page) {
  return page.evaluate(async () => ({ engine: battleEngineVersion, ranking: metaRankingData?.metadata?.matrixVersion,
    details: metaRankingDetails?.sourceMatrixVersion, controller: navigator.serviceWorker.controller?.scriptURL,
    caches: await caches.keys(), team: teamBuilderState.team.filter(Boolean).map(member => member.pokemonId),
    rankingReady: window.PvPeakTeamBuilderAnalysis.rankingState?.(metaRankingData, battleEngineVersion, activeSeasonData.id),
    selectedBuild: teamBuilderState.team[0]?.build }));
}
async function ready(page, url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => typeof metaRankingData !== "undefined" && metaRankingData?.entries?.length && !!navigator.serviceWorker.controller, null, { timeout: 120000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
}
async function check(browser, origin, mobile) {
  release = "old";
  const context = await browser.newContext({ serviceWorkers: "allow", viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
  try {
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const url = origin + "/PogoPvp.html?view=team-builder";
    await ready(page, url);
    await page.evaluate(async () => {
      teamBuilderState = window.PvPeakTeamBuilder.createState({ team: ["florges", "kingdra", "melmetal"].map(id => teamBuilderDefaultMember(findPokemon(id))) });
      persistTeamBuilderState(); renderTeamBuilder();
      window.__oldJobs = teamBuilderCombinedCoveragePlan().slice(0, 3).map(job => job.key);
      for (const job of teamBuilderCombinedCoveragePlan().slice(0, 3)) storeTeamBuilderAnalysisResult(job, simulateTeamBuilderMatchupCell(job));
      teamBuilderAnalysisCache.persist(); await sharedMatchupCache.flush();
      localStorage.setItem("pwa-upgrade-old-job-keys", JSON.stringify(window.__oldJobs));
    });
    const run = { mobile, before: await snapshot(page) }; report.runs.push(run); save();
    assert.match(run.before.controller, /v190/); assert.equal(run.before.engine, "battle-planner-v46");
    release = "new";
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes("v196"), null, { timeout: 120000 });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => typeof metaRankingData !== "undefined" && metaRankingData?.metadata?.matrixVersion === "battle-planner-v49", null, { timeout: 120000 });
    run.after = await snapshot(page);
    assert.equal(run.after.engine, "battle-planner-v49"); assert.equal(run.after.details, run.after.engine);
    assert.equal(run.after.rankingReady, "ready"); assert.deepEqual(run.after.team, run.before.team);
    assert.deepEqual(run.after.selectedBuild, run.before.selectedBuild);
    assert.deepEqual(run.after.caches.filter(name => name.startsWith("pogo-pvp-simulator-")), ["pogo-pvp-simulator-2026-10-18-v196-meta-refresh"]);
    run.cacheIsolation = await page.evaluate(async () => {
      const oldKeys = JSON.parse(localStorage.getItem("pwa-upgrade-old-job-keys"));
      const jobs = teamBuilderCombinedCoveragePlan();
      const durable = await sharedMatchupCache.getMany(oldKeys.map(key => "team-builder-results-v1|" + key));
      return { currentHits: jobs.filter(job => teamBuilderAnalysisCache.has(job.key)).length, oldKeysRetained: durable.size, separated: jobs.every(job => !oldKeys.includes(job.key)) };
    });
    assert.equal(run.cacheIsolation.currentHits, 0); assert.equal(run.cacheIsolation.oldKeysRetained, 3); assert.ok(run.cacheIsolation.separated);
    await context.setOffline(true);
    await ready(page, url);
    run.offline = await snapshot(page);
    assert.equal(run.offline.engine, "battle-planner-v49"); assert.equal(run.offline.rankingReady, "ready");
    assert.deepEqual(run.offline.team, run.before.team);
    run.offlineBattle = await page.evaluate(async () => {
      const job = teamBuilderCombinedCoveragePlan()[0];
      const source = window.PvPeakCmpDependency.workerSource(buildMatrixComputeWorkerSource());
      const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      const worker = new Worker(url);
      try {
        const result = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("Offline worker timeout")), 10000);
          worker.onerror = error => { clearTimeout(timeout); reject(new Error(error.message)); };
          worker.onmessage = event => { clearTimeout(timeout); event.data.result ? resolve(event.data.result) : reject(new Error(event.data.message)); };
          worker.postMessage({ id: 1, source: "team-builder", key: job.key, signature: job.key,
            config: createTeamBuilderBattleConfig(job), aShields: 1, bShields: 1, includeSwing: false, checkCmpDependency: true });
        });
        return { score: result.score, engine: result.provenance?.currentEngineVersion, canonicalScore: simulateTeamBuilderMatchupCell(job).score, cmpStatus: result.cmpDependency?.status };
      } finally { worker.terminate(); URL.revokeObjectURL(url); }
    });
    assert.ok(Number.isFinite(run.offlineBattle.score)); assert.equal(run.offlineBattle.engine, "battle-planner-v49");
    assert.equal(run.offlineBattle.score, run.offlineBattle.canonicalScore);
    assert.ok(["checked", "dependent", "unverified"].includes(run.offlineBattle.cmpStatus), "Updated offline CMP module must instrument the v49 worker");
    run.errors = errors; assert.deepEqual(errors, []); save(); console.log(JSON.stringify(run));
  } finally { await context.close(); }
}
(async () => {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const mobile of [false, true]) await check(browser, `http://127.0.0.1:${server.address().port}`, mobile);
    report.passed = true; save();
  } finally { await browser.close(); server.close(); }
})().catch(error => { report.error = error.stack; save(); console.error(error); server.close(); process.exitCode = 1; });
