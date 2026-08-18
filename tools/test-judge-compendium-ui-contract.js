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
includes('if (next === "compendium") {');
includes('renderJudgeCompendium();');

includes('placeholder="Search the Compendium..."');
includes('role="status" aria-live="polite"');
includes('role="tablist"');
includes('aria-selected="${category.id === compendiumActiveCategory}"');
includes('window.PvPeakJudgeCompendium?.search(compendiumSearchIndex, normalized)');
includes('data/compendium/${type}.json');
includes('src/compendium/move-reference.js');
includes('src/compendium/quick-reference.js');
includes('src/compendium/compendium-routing.js');
includes('src/compendium/pokemon-reference.js');
includes('src/compendium/fast-move-timing.js');
includes('api.createReference(gm.moves');
includes('window.PvPeakMoveReference.filterMoves(reference');
includes('window.PvPeakMoveReference.searchEntries(reference)');
includes('rebuildCompendiumSearchIndex();');
includes('Fast Moves · ${reference.fast.length}');
includes('Charged Moves · ${reference.charged.length}');
includes('data-move-turns="${value}"');
includes('id="compendiumMoveType"');
includes('id="compendiumMoveSort"');
includes('renderCompendiumMoveDetail(selected)');
includes('function renderCompendiumPokemonReference()');
includes('function refreshCompendiumPokemonResults()');
includes('compendiumPokemonFilters.query = event.target.value; compendiumPokemonVisibleCount = 120; refreshCompendiumPokemonResults();');
includes('function renderCompendiumPokemonDetail(pokemon)');
includes('Default Great League build');
includes('source?.defaultIVs?.cp1500');
includes('pokemonStatsAtLevel(source, ivAtk, ivDef, ivHp, defaultLevel, defaultCpm)');
includes('function renderCompendiumTimingVisualizer()');
includes('data-linked-pokemon="${pokemon.id}"');
includes('data-linked-move="${move.id}"');
includes('id="compendiumOpenPokemonBattle"');
includes('No stat-stage effect in the canonical move data.');
includes('role="combobox"');
includes('aria-controls="compendiumSearchResults"');
includes('function handleCompendiumSearchKeydown(event)');
includes('event.key === "ArrowDown"');
includes('event.key === "ArrowUp"');
includes('event.key === "Home"');
includes('event.key === "End"');
includes('event.key === "Enter"');
includes('function openCompendiumSearchResult(index)');
includes('selectCompendiumCategory("moves")');
includes('data-compendium-card="${card.id}"');
includes('class="compendium-quick-icon"');
includes('stage.querySelectorAll("[data-compendium-card]")');
includes('{ id: "glossary", icon: "Aa", title: "Glossary"');
assert.ok(!html.includes('Judge Quick Reference'), "The Quick Reference landing should contain navigation cards only.");

includes('id="compendiumArticle"');
includes('window.PvPeakJudgeCompendium?.articleView(type, entry)');
includes('Official source');
includes('Compendium explanation');
includes('article.lastUpdated');
includes('article.related.length');
includes('function renderCompendiumEntryButton(entry, entryType)');
includes('entryType === "glossary"');
includes('class="compendium-glossary-expanded"');
includes('data-usage="${escapeHtml(entry.usage || "competitive")}"');
includes('data-source-type="${escapeHtml(entry.sourceType || "compendium")}"');
includes('function renderCompendiumSource(article)');
includes('The linked document is official. This article is a concise Compendium summary, not an official quotation.');
includes('target="_blank" rel="noopener noreferrer"');
includes('Source revised ${escapeHtml(article.sourceUpdated)}');
includes('article.aliases.join(" · ")');
includes('function renderCompendiumTimelineDiagram(diagram)');
includes('window.PvPeakJudgeCompendium?.validTimelineDiagram(diagram)');
includes('data-section-kind="${kind}"');
includes('class="compendium-article-steps"');
includes('class="compendium-related-button"');
includes('data-related-id="${item.entry.id}"');
includes('function loadCompendiumFromLocation()');
includes('window.PvPeakCompendiumRouting?.readLocation?.(window.location)');
includes('function applyCompendiumRoute(route)');
includes('window.addEventListener("popstate"');
includes('function copyCompendiumLink()');
includes('aria-label="Copy a direct link to this reference"');
includes('class="compendium-copy-feedback" role="status" aria-live="polite"');
includes('syncCompendiumRoute({ category: "moves", item: compendiumSelectedMoveId })');
includes('syncCompendiumRoute({ category: type, item: entryId })');
includes('else loadCompendiumFromLocation();');

includes('.compendium-workspace { display: grid; grid-template-columns: 210px minmax(0, 1fr);');
includes('.compendium-sidebar { position: sticky;');
includes('.compendium-categories { display: grid;');
includes('overflow-x: auto;');
includes('.compendium-view { width: 100%; gap: 9px; }');
includes('.compendium-quick-grid { grid-template-columns: 1fr; }');
includes('.compendium-category { min-height: 44px; }');
includes('.compendium-view { width: min(100%, 1260px); min-width: 0;');
includes('.move-reference-toolbar { grid-template-columns: minmax(0, 1fr) minmax(0, .75fr); }');
includes('.move-reference-row { grid-template-columns: minmax(0, 1fr) auto;');
includes('.move-detail-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
includes('.compendium-search-results { display: grid; gap: 6px; max-height: min(430px, 55vh);');
includes('.compendium-search-result[aria-selected="true"]');
includes('.mechanics-timeline-scroll { width: 100%; min-width: 0; max-width: 100%;');
includes('overflow-x: auto; overscroll-behavior-inline: contain;');
includes('.mechanics-timeline-track { display: grid; grid-template-columns: repeat(var(--mechanic-turns), minmax(34px, 1fr));');
includes('.compendium-article-source { display: grid; gap: 7px;');
includes('.compendium-source-badge { padding: 4px 7px;');
includes('.compendium-entry-list.is-glossary { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
includes('.compendium-entry-list.is-glossary { grid-template-columns: 1fr; }');

for (const view of ["simulator", "scenario-review", "meta", "analysis", "team-builder", "compendium"]) {
  includes(`data-view-target="${view}"`, `Navigation target missing: ${view}`);
}

assert.ok(!/data\/compendium\/moves\.json/.test(html), "Move Reference data must not be implemented in Phase 1");
console.log("Judge Compendium UI contract tests passed.");
