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
const mobileGrid = html.match(/@media \(max-width: 900px\)[\s\S]*?\.fast-threshold-columns,\s*\.fast-threshold-row \{ grid-template-columns: ([^;]+); gap: 5px; \}/);
assert(mobileGrid, "The compact table must define aligned columns on mobile.");
const mobileTracks = mobileGrid[1].match(/minmax\([^)]+\)/g) || [];
assert.strictEqual(mobileTracks.length, 4, "The compact table must keep four columns on mobile.");
assert.strictEqual(mobileTracks[2], mobileTracks[3], "Breakpoint and Bulkpoint must have equal column widths on mobile.");

const reviewRenderer = html.match(/function renderBattleReview\([\s\S]*?function scheduleHpSwingAnalysis\(/)?.[0] || "";
assert.doesNotMatch(reviewRenderer, /Key Moments|Swing Point|data-review-event/,
  "Battle Review should omit Key Moments and Swing Point.");

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(Boolean);
inlineScripts.forEach(source => new Function(source));

console.log("Fast-move threshold panel contract tests passed.");
