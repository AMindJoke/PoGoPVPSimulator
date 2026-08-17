const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");

function includes(fragment, message) {
  assert.ok(html.includes(fragment), message || `Missing UI contract: ${fragment}`);
}

includes('id="compendiumTab"', "Compendium must be a first-class navigation destination");
includes('data-view-target="compendium"');
includes('id="compendiumView"');
includes('body[data-view="compendium"] #compendiumView { display: grid; }');
includes('"team-builder", "compendium"');
includes('if (next === "compendium") renderJudgeCompendium();');

includes('placeholder="Search moves, mechanics, rulings..."');
includes('role="status" aria-live="polite"');
includes('role="tablist"');
includes('aria-selected="${category.id === compendiumActiveCategory}"');
includes('window.PvPeakJudgeCompendium?.search(compendiumSearchIndex, normalized)');
includes('data/compendium/${type}.json');

includes('id="compendiumArticle"');
includes('window.PvPeakJudgeCompendium?.articleView(type, entry)');
includes('Official source');
includes('Compendium explanation');
includes('article.lastUpdated');
includes('article.related.length');

includes('.compendium-categories { display: flex;');
includes('overflow-x: auto;');
includes('.compendium-view { width: 100%; gap: 9px; }');
includes('.compendium-quick-grid { grid-template-columns: 1fr; }');
includes('.compendium-category { min-height: 44px; }');
includes('.compendium-view { width: min(100%, 1120px); min-width: 0;');

for (const view of ["simulator", "scenario-review", "meta", "analysis", "team-builder", "compendium"]) {
  includes(`data-view-target="${view}"`, `Navigation target missing: ${view}`);
}

assert.ok(!/data\/compendium\/moves\.json/.test(html), "Move Reference data must not be implemented in Phase 1");
console.log("Judge Compendium UI contract tests passed.");
