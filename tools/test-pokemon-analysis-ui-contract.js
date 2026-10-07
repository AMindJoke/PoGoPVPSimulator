const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");

function includes(fragment, message) {
  assert.ok(html.includes(fragment), message || `Missing Pokémon Analysis UI contract: ${fragment}`);
}

includes('id="analysisPokemonSearch"');
includes('placeholder="Search Pokemon"');
includes('role="combobox"');
includes('aria-controls="analysisPokemonSuggestions"');
includes('id="analysisPokemonSuggestions" class="pokemon-suggestions" role="listbox"');
includes('id="analysisPokemon" class="pokemon-select-hidden" aria-hidden="true" tabindex="-1"');
includes('setupAnalysisPokemonPicker();');
includes('function openAnalysisPokemonSuggestions(showAll = false)');
includes('renderPokemonSuggestionList(box, visibleChoices.map(item => item.pokemon)');
includes('function selectAnalysisPokemon(pokemonId)');
includes('syncAnalysisPokemonPickerInput(entry);');
includes('event.key === "Escape"');
includes('event.key === "Enter"');
includes('event.key === "ArrowDown"');
includes('.analysis-pokemon-picker .pokemon-suggestions { width: 100%; min-width: 0; }');
includes('#analysisView header { color: var(--ink); }', 'Pokémon Analysis headers must keep readable contrast on light textured surfaces.');

assert.ok(!html.includes('<select id="analysisPokemon" aria-label="Choose a Pokemon to analyze">'), "The old visible Analysis combobox must not remain.");

const UI = require('../src/ui/pokemon-analysis');
const { normalizePokemonAnalysisViewModel: normalize } = require('../src/analysis/pokemon-analysis-view-model');
const fixture = {
  id: 'mimikyu', name: 'Mimikyu', role: 'Switch specialist', rating: 925,
  quickFacts: [{ label: 'Best role', value: 'Switch (632)' }, { label: 'Shield plan', value: 'Shield dependent' }],
  categories: [{ label: 'Switch', score: 632 }],
  keyWins: [{ id: 'test', name: '<Opponent>', score: 500 }],
  ivProfiles: [{ id: 'attack', label: 'Attack', ivs: '15 / 1 / 1', deltas: [{ label: 'HP vs Balanced', value: '-8' }], insights: ['Gain', 'Loss', 'CMP', 'Survival'], hasPracticalImpact: true }]
};
const page = UI.PokemonAnalysisPage(normalize(fixture));
assert.strictEqual((page.match(/Switch specialist/g) || []).length, 1, 'Role identity must not repeat.');
assert.match(page, /id="analysisPanel-overview"[^>]*class="analysis-dossier-grid">/);
for (const id of ['matchups', 'build']) assert.match(page, new RegExp(`id="analysisPanel-${id}"[^>]* hidden>`));
assert.match(page, /Ranking index · not a win probability/);
assert.match(page, /Battle rating: 500 is even/);
assert.match(page, /&lt;Opponent&gt;/);
assert.match(page, /<small>Even<\/small>/);
assert.match(page, /More sampled changes \(1\)/);
assert.match(page, /data-analysis-use-build="attack"/);
assert.match(page, /<dd>-8<\/dd>/);
assert.doesNotMatch(page, /Detected impact/);
const stale = normalize({ ...fixture, movesetScoreStale: true });
assert.strictEqual(stale.availability.matchups, false);
assert.deepStrictEqual(stale.keyMatchups.wins, []);
assert.doesNotMatch(UI.PokemonAnalysisPage(stale), /data-analysis-matchup=/);
assert.match(UI.PokemonAnalysisPage(normalize()), /No current matchup snapshot available/);
includes('loadAnalysisPokemon(model.id, button.dataset.analysisUseBuild)');
includes('applyIvOptimizationProfile("p1", profileId)');

// Reproduce Battle's view refresh resetting defaults, then verify the requested
// profile survives the complete analysis -> Battle handoff.
const vm = require('node:vm');
const handoffSource = html.slice(html.indexOf('    function loadAnalysisPokemon('), html.indexOf('    function ensureMetaRankingData()', html.indexOf('    function loadAnalysisPokemon(')));
let selectedBuild;
const calls = [];
const context = {
  findPokemon: () => true,
  setAppView: () => { selectedBuild = 'default'; calls.push('view'); },
  setPokemonSelection: () => calls.push('pokemon'),
  applyIvOptimizationProfile: (side, profile) => { selectedBuild = profile; calls.push('iv'); },
  applyMetaRankingMoves: () => calls.push('moves'),
  resetBattleStateFromSetup: () => calls.push('reset'),
  window: { scrollTo() {} }
};
vm.createContext(context);
vm.runInContext(`${handoffSource}\nloadAnalysisPokemon('mimikyu', 'attack');`, context);
assert.strictEqual(selectedBuild, 'attack', 'Opening Battle must preserve the selected IV profile.');
assert.deepStrictEqual(calls, ['view', 'pokemon', 'iv', 'moves', 'reset']);

const tradeoffStart = html.indexOf('      const baselineIvProfile = ivProfiles.find');
const tradeoffSource = html.slice(tradeoffStart, html.indexOf('      const ratings = detailEntry?.ratings', tradeoffStart));
const tradeoffContext = {
  ivProfiles: [
    { id: 'balanced', attackValue: 10, defenseValue: 10, hpValue: 10 },
    { id: 'defense', attackValue: 8, defenseValue: 8, hpValue: 8 }
  ],
  selectedCombatant: { attack: 10, defense: 10, maxHp: 10, fast: {} },
  thresholdCombatants: [{ opponent: { name: 'Counter' }, combatant: { attack: 9, defense: 10, fast: {}, charged: [] } }],
  estimate: (attacker, defender) => Math.floor(attacker.attack / defender.defense * 10)
};
vm.createContext(tradeoffContext);
vm.runInContext(tradeoffSource, tradeoffContext);
const tradeoffs = tradeoffContext.ivProfiles[1].insights.join('\n');
assert.match(tradeoffs, /Fast move loses 2 damage/);
assert.match(tradeoffs, /Loses CMP priority/);
assert.match(tradeoffs, /Takes 2 more fast-move damage/);
assert.strictEqual(tradeoffContext.ivProfiles[1].hasPracticalImpact, true, 'A negative threshold change is still a detected difference.');

console.log("Pokémon Analysis search UI contract tests passed.");
