"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), http = require("node:http"), crypto = require("node:crypto");
const { chromium } = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
const root = path.resolve(__dirname, ".."), output = path.join(root, "reports/team-workspace-readability");
const captureOnly = process.argv.includes("--capture-only");
const server = http.createServer((req, res) => {
  const file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, body) => {
    if (error) { res.writeHead(404).end(); return; }
    const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp" };
    res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream"); res.end(body);
  });
});
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const report = { viewports: [] };
  try {
    const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/PogoPvp.html?view=team-builder`, { waitUntil: "load" });
    await page.waitForFunction(() => typeof teamWorkspaceUI !== "undefined" && !!teamWorkspaceUI);
    await page.evaluate(() => {
      const make = ids => window.PvPeakTeamBuilder.createState({ team: ids.map(id => teamBuilderDefaultMember(findPokemon(id))) });
      teamBuilderState = make(["melmetal", "sableye_shadow", "altaria", "victreebel_shadow", "quagsire_shadow", "carbink"]);
      teamBuilderOpponentState = make(["mimikyu", "tinkaton", "corviknight", "clodsire", "kingdra", "talonflame"]);
      teamBuilderTrioIds = [];
      Object.assign(teamBuilderOpponentShields, { A: 1, B: 1 }); Object.assign(teamBuilderOpponentEnergy, { A: 0, B: 0 });
      persistTeamBuilderState(); persistTeamOpponent(); refreshTeamOpponentPlan(); renderTeamBuilder(); teamOpponentUIController.render(); teamWorkspaceUI.sync();
    });
    await page.locator("#teamMode-team").click();
    await page.locator("#teamWorkspaceActions [data-analyze]").click();
    await page.waitForFunction(() => ["complete", "error"].includes(teamRolesAnalysis.state().phase), null, { timeout: 180000 });
    assert.equal(await page.evaluate(() => teamRolesAnalysis.state().phase), "complete");
    await page.waitForFunction(() => document.getElementById("teamWorkspaceSetup").hidden);
    report.analysis = await page.evaluate(() => {
      const state = teamRolesAnalysis.state();
      return { suggestions: state.analysis.suggestions, results: [...state.results].map(([key, value]) => [key, value.score, value.details.outcome]) };
    });
    report.digest = crypto.createHash("sha256").update(JSON.stringify(report.analysis)).digest("hex");
    const baseline = path.join(output, "baseline.json");
    if (!captureOnly && fs.existsSync(baseline)) assert.equal(report.digest, JSON.parse(fs.readFileSync(baseline, "utf8")).digest, "Presentation changes must preserve every score, suggestion and role assignment");
    for (const width of [1440, 390, 360]) {
      await page.setViewportSize({ width, height: 1000 });
      const cards = page.locator("#teamRolesResults .team-role-trio:not([hidden])");
      assert.ok(await cards.count() >= 2);
      if (!captureOnly) {
        assert.equal(await cards.locator(".team-workspace-explanation").count(), await cards.count());
        assert.ok((await cards.nth(1).locator(".team-workspace-tradeoff").textContent()).length > 0);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert.equal(overflow, false);
      await cards.first().screenshot({ path: path.join(output, `${captureOnly ? "before" : "after"}-${width}.png`) });
      report.viewports.push({ width, cards: await cards.count(), overflow });
    }
    if (!captureOnly) {
      await page.locator("#teamRolesResults .team-role-trio").first().locator(".team-workspace-replies").click();
      assert.equal(await page.evaluate(() => document.getElementById("teamAnalysisWorkspace").dataset.workspaceView), "matchups");
      await page.locator(".team-role-trio:not([hidden]) [data-role-panel=replies]").waitFor({ state: "visible" });
      const reply = page.locator(".team-role-trio:not([hidden]) .team-role-tested-reply").first();
      for (const theme of ["light", "dark", "neo"]) {
        await page.evaluate(theme => { document.body.dataset.theme = theme; }, theme);
        await page.mouse.move(0, 0);
        await page.waitForTimeout(250);
        const normal = await reply.evaluate(element => {
          const style = getComputedStyle(element);
          return { background: style.backgroundColor, color: style.color };
        });
        await reply.hover();
        await page.waitForTimeout(250);
        const hovered = await reply.evaluate(element => {
          const style = getComputedStyle(element);
          return { background: style.backgroundColor, color: style.color };
        });
        assert.deepEqual(hovered, normal, `${theme}: reply hover must preserve the readable surface and text colors`);
        await page.keyboard.press("Tab");
        await reply.focus();
        assert.equal(await reply.evaluate(element => getComputedStyle(element).outlineStyle), "solid");
        await reply.screenshot({ path: path.join(output, `reply-hover-${theme}.png`) });
      }
      await page.evaluate(() => { document.body.dataset.theme = "light"; });
      await page.locator("#teamWorkspaceNav [data-workspace-view=trios]").click();
      const selected = report.analysis.suggestions[1];
      await page.locator("#teamRolesResults .team-role-trio").nth(1).locator("[data-role-trio]").click();
      assert.equal(await page.evaluate(() => document.getElementById("teamAnalysisWorkspace").dataset.workspaceView), "matchups");
      const actual = await page.evaluate(() => teamBuilderTrioIds);
      const expected = await page.evaluate(slots => slots.map(slot => teamBuilderState.team[slot].pokemonId), selected.slots);
      assert.deepEqual(actual, expected);
      await page.locator(".team-role-trio:not([hidden]) [data-role-open=switch]").click();
      await page.locator(".team-role-trio:not([hidden]) [data-role-panel=switch] .team-role-matchup:not([disabled])").first().click();
      await page.locator("#teamWorkspaceMatchupDialog").waitFor({ state: "visible" });
      await page.locator("#teamWorkspaceMatchupDialog [data-dialog-close]").click();
    }
    assert.deepEqual(errors, []); report.errors = errors; report.passed = true;
    fs.writeFileSync(captureOnly ? baseline : path.join(output, "checks.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ passed: true, digest: report.digest, viewports: report.viewports, suggestions: report.analysis.suggestions.map(c => ({ style: c.style, slots: c.slots, covered: c.covered, backups: c.backups, switchHolds: c.sensitivity?.switchHolds, gaps: c.gaps, sole: c.sole })) }));
    await context.close();
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
