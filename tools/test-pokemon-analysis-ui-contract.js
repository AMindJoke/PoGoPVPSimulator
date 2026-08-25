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

console.log("Pokémon Analysis search UI contract tests passed.");
