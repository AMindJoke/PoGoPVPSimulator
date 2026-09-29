const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");

assert.match(html, /function ensureChargedMoveSelects\(prefix, pokemon\)/);
assert.match(html, /selectedChargedMoveLimit\(pokemon\)/);
assert.match(html, /while \(selects\.length < limit\)/);
assert.match(html, /charged: selectedChargedMoves\(prefix\)/);
assert.match(html, /chargedIds\.map\(moveDataFingerprint\)/);
assert.match(html, /function syncManualChargeButtons\(side, combatant\)/);
assert.match(html, /while \(buttons\.length < moves\.length\)/);
assert.match(html, /manualActionButtons\(side\)\.forEach/);
assert.match(html, /energyCollectionMarkup\(combatant\.charged, combatant\.energy, prefix/);
assert.match(html, /function ensureTeamBuilderChargedMoveSelects\(pokemon\)/);
assert.match(html, /teamBuilderEditorDraft\.chargedMoveIds = chargedSelects\.map/);
assert.doesNotMatch(html, /charged:\s*\[moveMap\.get\(\$\(`\$\{prefix\}Charged1`\)/);
assert.match(html, /body\[data-view="simulator"\] \.trainer-card \.moves-stack label > span \{[\s\S]*?position: absolute; width: 1px; height: 1px;/,
  "Redundant mobile move labels should remain available to assistive technology.");
assert.match(html, /body\[data-view="simulator"\] \.trainer-card \.moves-stack label select\.move-select \{[\s\S]*?width: 100%;[\s\S]*?min-height: 38px;/,
  "Mobile move selectors should use the full card width and a readable touch target.");
assert.match(html, /body\[data-view="simulator"\] \.trainer-card \.moves-stack > \.setup-kicker \{ display: none; \}/,
  "The redundant Moves heading should not consume space in mobile battle cards.");
assert.match(html, /body\[data-view="simulator"\] \.trainer-card \.shield-count-toggle button \{[\s\S]*?min-height: 38px;/,
  "Mobile shield choices should remain easy to tap.");

console.log("Variable Charged Move UI contract tests passed.");
