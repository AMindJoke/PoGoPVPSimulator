"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "data", "seasons", "season-generated-loader.js"), "utf8");
function rendered(search, stored = "", next = null) {
  let html = "";
  const context = {
    URLSearchParams,
    setTimeout,
    clearTimeout,
    window: {
      BATTLE_NEXT_SEASON: next,
      location: { search },
      localStorage: { getItem: () => stored }
    },
    document: { write: value => { html += value; } }
  };
  context.globalThis = context.window;
  vm.createContext(context);
  vm.runInContext(source, context);
  return { html, loader: context.window.PvPeakSeasonGeneratedLoader, window: context.window, document: context.document };
}

assert.equal(rendered("").html, "", "Home must not write blocking ranking scripts.");
assert.ok(rendered("").loader);
assert.equal(rendered("?season=twilight-trails").html, "");
assert.equal(rendered("", "twilight-trails").html, "");
const next = { id: "future-season", enabled: true, generatedAssets: { rankings: "future/rankings.js", rankingDetails: "future/details.js", defaultMovesets: "future/moves.js" } };
assert.match(rendered("?season=future-season", "", next).html, /future\/rankings.js/);
assert.match(rendered("", "future-season", next).html, /future\/moves.js/);
assert.doesNotMatch(rendered("?season=future-season", "", { ...next, enabled: false }).html, /future\//);
assert.equal(rendered("?season=current-2026-06-28", "twilight-trails").html, "");

async function checkBackgroundLoading() {
  const app = rendered("");
  const scripts = [];
  app.document.createElement = () => ({ remove() {} });
  app.document.head = { appendChild: script => scripts.push(script) };
  const first = app.loader.load();
  assert.equal(app.loader.load(), first, "Concurrent sections share one download.");
  assert.equal(scripts.length, 2);
  app.window.GREAT_LEAGUE_RANKINGS = { entries: [{ id: "mimikyu" }] };
  scripts[0].onload();
  let ready = false;
  first.then(() => { ready = true; });
  await Promise.resolve();
  assert.equal(ready, false, "Publish rankings and details together.");
  app.window.GREAT_LEAGUE_RANKING_DETAILS = { entries: { mimikyu: {} } };
  scripts[1].onload();
  const data = await first;
  assert.equal(data.rankings, app.window.GREAT_LEAGUE_RANKINGS);
  await app.loader.load();
  assert.equal(scripts.length, 2, "Revisiting a section does not download again.");

  const failed = rendered("");
  const attempts = [];
  failed.document.createElement = () => ({ remove() {} });
  failed.document.head = { appendChild: script => attempts.push(script) };
  const rejected = failed.loader.load();
  attempts[0].onload();
  attempts[1].onerror();
  await assert.rejects(rejected, /Refresh/);
  await assert.rejects(failed.loader.load(), /Refresh/);
  assert.equal(attempts.length, 2, "Failure must not start a render/retry loop.");
  const retry = failed.loader.load({ retry: true });
  assert.equal(attempts.length, 3, "Retry only the failed asset.");
  failed.window.GREAT_LEAGUE_RANKINGS = { entries: [] };
  failed.window.GREAT_LEAGUE_RANKING_DETAILS = { entries: {} };
  attempts[2].onload();
  await retry;
  console.log("Season generated-data loader tests passed (background, deduplication, atomic readiness, retry, preview).");
}
checkBackgroundLoading().catch(error => { console.error(error); process.exitCode = 1; });
