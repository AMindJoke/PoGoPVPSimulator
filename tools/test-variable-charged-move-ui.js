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

console.log("Variable Charged Move UI contract tests passed.");
