"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");
const analysisGrid = html.match(/<div class="analysis-grid">([\s\S]*?)<\/div>\s*<\/div>\s*<div id="metaView"/);
assert(analysisGrid, "Battle results grid must remain present.");
const timelineIndex = analysisGrid[1].indexOf("id=\"battleTimeline\"");
const thresholdsIndex = analysisGrid[1].indexOf("id=\"fastThresholdPanel\"");
const matchupIndex = analysisGrid[1].indexOf("class=\"matrix-panel\"");
const battleReviewIndex = analysisGrid[1].indexOf("id=\"battleReview\"");
assert(timelineIndex >= 0 && matchupIndex > timelineIndex && battleReviewIndex > matchupIndex && thresholdsIndex > battleReviewIndex,
  "Breakpoints and Bulkpoints must appear below the Matchup panel and Battle Review.");
assert.match(html, /id="fastThresholdTitle">Breakpoints &amp; Bulkpoints/);
assert.match(html, /id="fastThresholdContent" class="fast-threshold-content" role="table"[^>]*aria-live="polite"/);
const compactRender = html.match(/function renderFastThresholdValues\([\s\S]*?function renderFastThresholdPanel\(/)?.[0] || "";
assert.doesNotMatch(compactRender, /Example spread|selected IVs|Rank #/,
  "The panel should keep IV examples and ranking details out of the way.");

for (const helper of [
  "fastThresholdSpreadRows",
  "fastBreakpointRows",
  "fastBulkpointRows",
  "renderFastThresholdValues",
  "renderFastThresholdPanel"
]) {
  assert.match(html, new RegExp(`function ${helper}\\(`), `${helper} must be part of the live simulator.`);
}
assert.match(html, /function fastThresholdSpreadRows\(pokemon\)[\s\S]*?ivAtk <= 15[\s\S]*?ivDef <= 15[\s\S]*?ivHp <= 15[\s\S]*?stats\.cp <= 1500/,
  "Threshold candidates must be drawn from legal Great League IV spreads.");
assert.match(html, /function fastBreakpointRows\([\s\S]*?damage <= currentDamage/,
  "Breakpoint rows must represent reachable increases over current damage.");
assert.match(html, /function fastBulkpointRows\([\s\S]*?damage >= currentDamage/,
  "Bulkpoint rows must represent reachable reductions from current incoming damage.");
assert.match(html, /function renderFastThresholdValues\([\s\S]*?rows\[0\][\s\S]*?next\.damage[\s\S]*?next\.threshold\.toFixed\(2\)/,
  "Each result should show only the post-threshold damage and minimum stat value.");
assert.match(html, /renderFastThresholdValues\("bulkpoint", bulkpoint\.rows, opponent\.fast\)/,
  "Bulkpoint cells must identify the opposing fast move, not only the row Pokemon's move.");
assert.match(html, /fast-threshold-damage">\$\{next\.damage\}<small>dmg<\/small>/);
assert.match(html, /fast-threshold-stat">\$\{next\.threshold\.toFixed\(2\)\}<small>\$\{isBreakpoint \? "ATK" : "DEF"\}<\/small>/);
const thresholdHelperSource = html.match(/function minimumDisplayedFastStat\([\s\S]*?\n    \}(?=\n\n    function fastBreakpointRows)/)?.[0];
assert(thresholdHelperSource, "Rounded threshold verification must be present.");
const minimumDisplayedFastStat = new Function(`${thresholdHelperSource}; return minimumDisplayedFastStat;`)();
assert.strictEqual(minimumDisplayedFastStat(100, 110, attack => Math.floor(attack / 100) + 1 >= 2), 100,
  "An exact attack breakpoint should not be rounded up unnecessarily.");
assert.strictEqual(minimumDisplayedFastStat(100.005, 110, attack => Math.floor(attack / 100.005) + 1 >= 2), 100.01,
  "A fractional attack breakpoint must round to a centesimal value that deals the advertised damage.");
assert.strictEqual(minimumDisplayedFastStat(100, 110, defense => Math.floor(100 / defense) + 1 <= 1), 100.01,
  "A bulkpoint requires defense strictly above the mathematical boundary.");
assert.strictEqual(minimumDisplayedFastStat(100, 99, defense => Math.floor(100 / defense) + 1 <= 1), null,
  "A threshold that no legal spread can reach must not be displayed.");
const thresholdRuntimeSource = html.match(/function fastMoveDamageForStats\([\s\S]*?(?=\n    function renderFastThresholdValues)/)?.[0];
assert(thresholdRuntimeSource, "Fast threshold calculations must be available for behavior tests.");
const thresholdRuntime = new Function(
  "estimate", "fastThresholdSpreadRows", "damageModifier", "statStageMultiplier",
  "effectiveAttack", "effectiveDefense", "damageBonus",
  `${thresholdRuntimeSource}; return { fastBreakpointRows, fastBulkpointRows };`
)(
  (attacker, defender, move) => Math.max(1, Math.floor(move.power * attacker.attack / defender.defense) + 1),
  pokemon => pokemon.id === "attacker"
    ? [{ attack: 101, defense: 100, rank: 1 }]
    : [{ attack: 100, defense: 100.01, rank: 1 }],
  () => 1, () => 1, combatant => combatant.attack, combatant => combatant.defense, 2
);
const attacker = { p: { id: "attacker" }, attack: 100, defense: 100, fast: { power: 100 } };
const defender = { p: { id: "defender" }, attack: 100, defense: 100 };
const breakpoint = thresholdRuntime.fastBreakpointRows(attacker, defender).rows[0];
const bulkpoint = thresholdRuntime.fastBulkpointRows(defender, attacker).rows[0];
assert.strictEqual(breakpoint.threshold, 101);
assert.strictEqual(bulkpoint.threshold, 100.01);
assert(breakpoint.spread.attack >= breakpoint.threshold && bulkpoint.spread.defense >= bulkpoint.threshold,
  "Displayed thresholds must remain reachable by the legal spread used to derive the row.");
assert.strictEqual(Math.floor(100 * breakpoint.threshold / 100) + 1, breakpoint.damage);
assert.strictEqual(Math.floor(100 * 100 / bulkpoint.threshold) + 1, bulkpoint.damage);
assert.match(compactRender, /data-threshold-kind="\$\{isBreakpoint \? "Breakpoint" : "Bulkpoint"\}"/,
  "Threshold cells must carry a visible label when the mobile column headings are hidden.");
assert.match(html, /class="fast-threshold-columns" role="row"><span aria-hidden="true"><\/span><span role="columnheader">Move<\/span><span role="columnheader">Breakpoint<\/span><span role="columnheader">Bulkpoint<\/span>/,
  "The visible table should start at Move and then show only Breakpoint and Bulkpoint.");
assert.doesNotMatch(html, /fast-threshold-subcolumns|fast-threshold-column-group/,
  "No secondary labels should appear below the Breakpoint and Bulkpoint headings.");
assert.match(html, /function render\(\)[\s\S]*?renderTimeline\(\);\s*renderFastThresholdPanel\(\);/,
  "The panel must refresh with battle setup and rendering.");
assert.match(html, /\.fast-threshold-panel \{[\s\S]*?grid-column: 1 \/ -1/,
  "The panel must span the battle results grid on desktop.");
assert.match(html, /body\.clarity-ui \.fast-threshold-panel \{ order: 4; \}/,
  "The panel must follow the Matchup panel, which contains Battle Review.");
assert.match(html, /\.setup \{\s*grid-template-columns: repeat\(2, 296px\);[\s\S]*?justify-content: center;\s*column-gap: 16px;/,
  "Desktop battle cards must stay centered and close enough to compare.");
assert.match(html, /@media \(max-width: 600px\) \{[\s\S]*?\.fast-threshold-columns \{ display: none; \}[\s\S]*?\.fast-threshold-row \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);\s*grid-template-areas: "pokemon pokemon" "move move" "breakpoint bulkpoint";/,
  "Phone layout must give Pokemon and move full-width lines above equal Breakpoint and Bulkpoint columns.");
assert.match(html, /\.fast-threshold-move span \{ overflow-wrap: normal; word-break: normal; \}/,
  "Phone move names must not break in the middle of a word.");
assert.match(html, /\.fast-threshold-values::before \{\s*content: attr\(data-threshold-kind\);\s*display: block;/,
  "Phone values must show their own column heading.");

const reviewRenderer = html.match(/function renderBattleReview\([\s\S]*?function scheduleHpSwingAnalysis\(/)?.[0] || "";
assert.doesNotMatch(reviewRenderer, /Key Moments|Swing Point|data-review-event/,
  "Battle Review should omit Key Moments and Swing Point.");

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(Boolean);
inlineScripts.forEach(source => new Function(source));

console.log("Fast-move threshold panel contract tests passed.");
