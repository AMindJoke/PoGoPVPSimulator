"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { pathToFileURL } = require("node:url");
const { chromium } = require(path.join(process.env.USERPROFILE, ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"));
const root = path.resolve(__dirname, "..");
const output = path.join(root, "reports/home-news");
const report = { viewports: [] };
const server = http.createServer((request, response) => {
  const file = path.resolve(root, "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname));
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, content) => {
    if (error) { response.writeHead(404).end(); return; }
    const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
    response.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream"); response.end(content);
  });
});
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [360, 390, 768, 1440]) {
      const context = await browser.newContext({ serviceWorkers: "block", viewport: { width, height: 900 }, timezoneId: "America/Los_Angeles" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/PogoPvp.html?view=home`, { waitUntil: "load" });
      await page.locator("#homeNews").waitFor({ state: "visible" });
      assert.equal(await page.locator(".home-news-entry").count(), 3);
      assert.equal(await page.locator(".home-news-date").first().textContent(), "19 Oct 2026");
      for (const theme of ["light", "dark", "neo"]) {
        await page.evaluate(theme => { document.body.dataset.theme = theme; }, theme);
        const layout = await page.evaluate(() => {
          const section = document.getElementById("homeNews"), style = getComputedStyle(section);
          const clipped = Array.from(section.querySelectorAll("h3, .home-news-changes li, time")).filter(node => {
            const box = node.getBoundingClientRect(); return box.left < 0 || box.right > document.documentElement.clientWidth + 1;
          }).map(node => node.textContent);
          const lastTool = document.querySelector('.home-tool-grid-all > :last-child').getBoundingClientRect();
          return { clipped, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            followsTools: section.getBoundingClientRect().top >= lastTool.bottom,
            bodyFont: getComputedStyle(section.querySelector(".home-news-changes")).fontSize,
            background: style.backgroundImage, surface: style.backgroundColor, shadow: style.boxShadow };
        });
        assert.deepEqual(layout.clipped, []); assert.equal(layout.overflow, false);
        assert.ok(layout.followsTools); assert.ok(parseFloat(layout.bodyFont) >= 14);
        assert.equal(layout.background, "none"); assert.equal(layout.shadow, "none");
        assert.notEqual(layout.surface, "rgba(0, 0, 0, 0)", "News needs a solid reading surface");
        report.viewports.push({ width, theme, ...layout });
        if ([390, 1440].includes(width)) {
          await page.locator("#homeNews").screenshot({ path: path.join(output, `${width}-${theme}.png`) });
          if (theme === "light") await page.screenshot({ path: path.join(output, `${width}-home.png`), fullPage: true });
        }
      }
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const bottom = await page.evaluate(() => {
        const text = document.querySelector(".home-news-entry:last-child .home-news-changes li:last-child").getBoundingClientRect();
        const nav = document.querySelector(".home-lab-bottom-nav");
        return { textBottom: text.bottom, visibleBottom: nav && getComputedStyle(nav).display !== "none" ? nav.getBoundingClientRect().top : innerHeight };
      });
      assert.ok(bottom.textBottom <= bottom.visibleBottom + 1, "The final news item must scroll clear of fixed navigation");
      await page.evaluate(() => {
        const api = window.PvPeakSiteUpdates;
        api.render(document, []);
        if (!document.getElementById("homeNews").hidden) throw new Error("Empty news must stay hidden");
        api.render(document, [{ ...window.BATTLE_SITE_UPDATES[0], title: '<img src=x onerror="window.newsInjected=true">' }]);
        if (document.querySelector("#homeNews img") || window.newsInjected) throw new Error("News must render text, not markup");
        api.render(document, window.BATTLE_SITE_UPDATES);
      });
      await page.locator('[data-home-target="simulator"]').click();
      assert.equal(await page.locator("#homeNews").isVisible(), false);
      assert.deepEqual(errors, []); await context.close();
    }
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(root, "PogoPvp.html")).href + "?view=home", { waitUntil: "load" });
    assert.equal(await page.locator(".home-news-entry").count(), 3, "The local HTML preview must work without a dev server");
    await page.close(); report.passed = true;
    console.log("Home news browser checks passed: four widths, three themes, safe text rendering, navigation and local-file preview.");
  } finally { await browser.close(); server.close(); fs.writeFileSync(path.join(output, "checks.json"), JSON.stringify(report, null, 2) + "\n"); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
