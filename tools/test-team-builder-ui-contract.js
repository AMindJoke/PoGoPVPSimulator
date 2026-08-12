const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");

assert.match(html, /src="src\/team-builder\/team-builder-state\.js"/);
assert.match(html, /id="teamBuilderTab"[^>]+data-view-target="team-builder"/);
assert.match(html, /id="teamBuilderView" class="app-view team-builder-view"/);
assert.match(html, /id="teamBuilderRoster" class="team-roster-grid"/);
assert.match(html, /id="teamBuilderPickerModal"[^>]+role="dialog"[^>]+aria-modal="true"/);
assert.match(html, /function renderTeamBuilderSlot\(member, slot\)[\s\S]{0,700}data-team-add/);
assert.match(html, /teamBuilderState\.team\.map\(renderTeamBuilderSlot\)/, "The UI must render the six semantic state slots.");
assert.match(html, /renderPokemonSuggestionList\(\$\("teamBuilderPickerResults"\)/, "Team Builder must reuse the simulator Pokemon result component.");
assert.match(html, /teamBuilderDefaultMember[\s\S]{0,700}metaMovesForPokemon\(pokemon\)/, "Cards must use the existing default competitive moveset resolution.");
assert.match(html, /Species Clause: that Pokemon species is already on your team/);
assert.match(html, /@media \(max-width: 760px\)[\s\S]{0,900}team-roster-grid[\s\S]{0,100}repeat\(2/ , "Common mobile widths must use two comfortable columns.");
assert.match(html, /@media \(max-width: 430px\)[\s\S]{0,180}team-roster-grid[\s\S]{0,80}1fr/, "Very narrow mobile widths must use one column.");
assert.doesNotMatch(html, /team-builder-placeholder/);

console.log("Team Builder UI contract tests passed.");
