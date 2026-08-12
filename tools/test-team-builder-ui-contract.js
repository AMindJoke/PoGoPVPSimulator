const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");

assert.match(html, /src="src\/team-builder\/team-builder-state\.js"/);
assert.match(html, /id="teamBuilderTab"[^>]+data-view-target="team-builder"/);
assert.match(html, /id="teamBuilderView" class="app-view team-builder-view"/);
assert.match(html, /id="teamBuilderRoster" class="team-roster-grid"/);
assert.match(html, /id="teamBuilderPickerModal"[^>]+role="dialog"[^>]+aria-modal="true"/);
assert.match(html, /id="teamBuilderEditorModal"[^>]+role="dialog"[^>]+aria-modal="true"/, "Build editing must use a focused accessible modal.");
assert.match(html, /id="teamBuilderFastMove"/);
assert.match(html, /id="teamBuilderChargedMove1"/);
assert.match(html, /id="teamBuilderChargedMove2"/);
assert.match(html, /data-team-build-profile="default"[\s\S]{0,300}data-team-build-profile="rank1"[\s\S]{0,300}data-team-build-profile="custom"/);
assert.match(html, /id="teamBuilderShadowToggle"[^>]+aria-pressed="false"/);
assert.match(html, /function renderTeamBuilderSlot\(member, slot\)[\s\S]{0,700}data-team-add/);
assert.match(html, /teamBuilderState\.team\.map\(renderTeamBuilderSlot\)/, "The UI must render the six semantic state slots.");
assert.match(html, /renderPokemonSuggestionList\(\$\("teamBuilderPickerResults"\)/, "Team Builder must reuse the simulator Pokemon result component.");
assert.match(html, /teamBuilderDefaultMember[\s\S]{0,700}metaMovesForPokemon\(pokemon\)/, "Cards must use the existing default competitive moveset resolution.");
assert.match(html, /function teamBuilderResolvedBuild[\s\S]{0,1400}rankingsForPokemon\(pokemon\)[\s\S]{0,1400}statsForIvSpread\(pokemon/, "Team Builder must reuse the simulator's IV optimization and stat calculation.");
assert.match(html, /function saveTeamBuilderEditor[\s\S]{0,1200}PvPeakTeamBuilder\.setMember/, "Moves and builds must commit atomically to semantic state.");
assert.match(html, /function toggleTeamBuilderShadow[\s\S]{0,1400}teamBuilderShadowCounterpart/, "Shadow editing must use existing Pokemon form records.");
assert.match(html, /charged\.length !== 2/, "The editor must require two distinct Charged Moves.");
assert.match(html, /Species Clause: that Pokemon species is already on your team/);
assert.match(html, /@media \(max-width: 760px\)[\s\S]{0,900}team-roster-grid[\s\S]{0,100}repeat\(2/ , "Common mobile widths must use two comfortable columns.");
assert.match(html, /@media \(max-width: 760px\)[\s\S]{0,1800}team-editor-moves[\s\S]{0,80}1fr/, "The mobile build editor must stack move controls instead of compressing them.");
assert.match(html, /@media \(max-width: 430px\)[\s\S]{0,180}team-roster-grid[\s\S]{0,80}1fr/, "Very narrow mobile widths must use one column.");
assert.match(html, /#teamBuilderEditorModal \.team-editor-section \{[^}]*max-width: none/, "Global section sizing must not compress the build editor.");
assert.doesNotMatch(html, /team-builder-placeholder/);

console.log("Team Builder UI contract tests passed.");
