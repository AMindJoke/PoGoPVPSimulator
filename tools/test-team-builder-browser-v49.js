"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
const root = path.resolve(__dirname, "..");
const report = { environment: "Local Chromium desktop/mobile emulation, not physical phone timing", runs: [] };
const output = path.join(root, "reports/prepush-v49/browser-benchmark.json");
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
const server = http.createServer((req, res) => {
  const file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    const mime = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
    res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream"); res.end(data);
  });
});

async function instrument(page) {
  await page.addInitScript(() => {
    window.__tbDispatched = 0;
    const Original = window.Worker;
    window.Worker = class extends Original {
      postMessage(message, ...args) {
        const requests = message?.simulationBatch || [message];
        window.__tbDispatched += requests.filter(job => job?.source === "team-builder").length;
        return super.postMessage(message, ...args);
      }
    };
  });
}
async function ready(page, url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => typeof teamBuilderState !== "undefined" && !!teamBuilderMetaDefinition && metaRankingData?.entries?.length, null, { timeout: 60000 });
  assert.equal(await page.evaluate(() => window.PvPeakTeamBuilderAnalysis.rankingState(metaRankingData, battleEngineVersion, activeSeasonData.id)), "ready", "Browser must use regenerated rankings");
}
async function runAnalysis(page, kind) {
  const started = performance.now();
  await page.evaluate(() => { window.__tbDispatched = 0; });
  if (kind === "coverage") await page.locator("#teamBuilderAnalyze").click();
  else await page.locator("#teamBuilderReplacementAnalyze").click();
  await page.waitForFunction(() => !teamBuilderAnalysisActive && !teamBuilderAnalysisPending.size, null, { timeout: 240000 });
  const result = await page.evaluate(() => ({ dispatched: window.__tbDispatched, failed: teamBuilderAnalysisFailed, done: teamBuilderAnalysisDone, cacheHits: teamBuilderAnalysisCacheHits, context: teamBuilderAnalysisContext, total: teamBuilderAnalysisContext === "coverage" ? teamBuilderCombinedCoveragePlan().length : teamBuilderReplacementPlan.length, status: document.getElementById(teamBuilderAnalysisContext === "coverage" ? "teamBuilderAnalysisStatus" : "teamBuilderReplacementStatus").textContent }));
  result.ms = Math.round(performance.now() - started);
  assert.equal(result.failed, 0); assert.equal(result.done, result.total);
  return result;
}
async function runViewport(browser, url, mobile) {
  const context = await browser.newContext({ serviceWorkers: "block", viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await instrument(page); await ready(page, url);
  await page.evaluate(() => {
    const ids = ["melmetal", "sableye_shadow", "altaria", "victreebel_shadow", "quagsire_shadow", "carbink"];
    teamBuilderState = window.PvPeakTeamBuilder.createState({ team: ids.map(id => teamBuilderDefaultMember(findPokemon(id))) });
    persistTeamBuilderState(); renderTeamBuilder();
  });
  const run = { mobile, coverageJobs: await page.evaluate(() => teamBuilderCombinedCoveragePlan().length) };
  report.runs.push(run); save();
  assert.equal(run.coverageJobs, 720);
  await page.locator("#teamBuilderAnalyze").click();
  await page.waitForFunction(() => teamBuilderAnalysisDone >= 8, null, { timeout: 30000 });
  run.cancel = await page.evaluate(() => {
    const oldToken = teamBuilderAnalysisRunToken; cancelTeamBuilderAnalysis();
    return { oldToken, token: teamBuilderAnalysisRunToken, done: teamBuilderAnalysisDone, active: teamBuilderAnalysisActive };
  });
  assert.equal(run.cancel.active, false); assert.ok(run.cancel.token > run.cancel.oldToken);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => teamBuilderAnalysisDone), run.cancel.done, "Late cancelled worker results must be ignored");
  run.coverageResume = await runAnalysis(page, "coverage"); save();
  assert.ok(run.coverageResume.cacheHits >= run.cancel.done);
  run.parity = await page.evaluate(() => {
    const plan = teamBuilderCombinedCoveragePlan();
    const samples = [plan[0], plan[12], plan[119], plan[239], plan[359], plan[479], plan[599], plan[719]];
    return samples.map(job => {
      const cached = teamBuilderAnalysisCache.get(job.key);
      const battle = simulateTeamBuilderMatchupCell(job);
      return { member: job.member.pokemonId, opponent: job.opponentId, cached: cached.score, battle: battle.score };
    });
  });
  for (const cell of run.parity) assert.equal(cell.cached, cell.battle);
  await page.evaluate(async () => { persistTeamBuilderCachedPlan(teamBuilderCombinedCoveragePlan()); await sharedMatchupCache.flush(); localStorage.removeItem(window.PvPeakTeamBuilderAnalysis.STORAGE_KEY); });
  await ready(page, url);
  run.coveragePersistentWarm = await runAnalysis(page, "coverage");
  assert.equal(run.coveragePersistentWarm.dispatched, 0, "IndexedDB coverage reload must not recompute"); save();
  await page.evaluate(() => { teamBuilderReplacementSlot = 0; teamBuilderReplacementTargets = ["kingdra", "talonflame", "clodsire"]; teamBuilderReplacementCustomThreatIds = [...teamBuilderReplacementTargets]; teamBuilderReplacementTargetsInitialized = true; renderTeamBuilderReplacementTool(); });
  run.replacementCold = await runAnalysis(page, "replacement"); save();
  assert.ok(run.replacementCold.total >= 1800);
  await page.evaluate(async () => { persistTeamBuilderCachedPlan(teamBuilderReplacementPlan); await sharedMatchupCache.flush(); localStorage.removeItem(window.PvPeakTeamBuilderAnalysis.STORAGE_KEY); });
  await ready(page, url);
  await page.evaluate(() => { teamBuilderReplacementSlot = 0; teamBuilderReplacementTargets = ["kingdra", "talonflame", "clodsire"]; teamBuilderReplacementCustomThreatIds = [...teamBuilderReplacementTargets]; teamBuilderReplacementTargetsInitialized = true; renderTeamBuilderReplacementTool(); });
  run.replacementPersistentWarm = await runAnalysis(page, "replacement");
  assert.equal(run.replacementPersistentWarm.dispatched, 0, "IndexedDB candidate reload must not recompute");
  run.errors = errors; assert.deepEqual(errors, []); save();
  console.log(JSON.stringify(run)); await context.close();
}
(async () => {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const url = `http://127.0.0.1:${server.address().port}/PogoPvp.html?view=team-builder`;
    for (const mobile of [false, true]) await runViewport(browser, url, mobile);
    report.passed = true; save();
  } finally { await browser.close(); server.close(); }
})().catch(error => { report.error = error.stack; save(); console.error(error); server.close(); process.exitCode = 1; });
