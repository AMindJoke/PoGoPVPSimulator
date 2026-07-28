"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");
for (const id of [
  "manualModeStatus",
  "manualControlMode",
  "manualStartPoint",
  "manualModeToggle",
  "manualBranchSelect",
  "manualUndo",
  "manualRedo",
  "manualSelectionHint",
  "p1UseFast",
  "p1UseCharge1",
  "p2UseFast",
  "p2UseCharge1"
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `Missing Manual Mode UI control ${id}.`);
}

for (const value of ["battle-start", "selected-before", "selected-after", "current"]) {
  assert.match(html, new RegExp(`value=["']${value}["']`), `Missing branch-point option ${value}.`);
}

assert.match(html, /manualModeToggle"\)\.onclick = toggleLiveManualMode/);
assert.match(html, /manualControlMode"\)\.onchange = changeLiveManualControlMode/);
assert.match(html, /manualStartPoint"\)\.onchange = updateManualBranchSelectionUi/);
assert.match(html, /manual-branch-selection-active/);
assert.match(html, /manual-branch-selection-active #simulatorView > :not\(\.analysis-grid\)/);
assert.match(html, /manual-branch-selection-active \.matrix-overview > :not\(\.manual-panel\)/);
assert.match(html, /manual-branch-selection-active #battleTimeline/);
assert.match(html, /selectedManualTimelineSourceEvent/);
assert.match(html, /Selection mode active/);
assert.match(html, /PvPeakManualHybrid\.coordinateDecision/);
assert.match(html, /PvPeakManualHybrid\.executeCoordinatedDecision/);
assert.match(html, /runtime\.prepare\(/);
assert.match(html, /runtime\.executePrepared\(/);
assert.match(html, /resolveSimultaneousFastActionPlans/);
assert.match(html, /recordedEvents\.forEach\(event => captureManualEventSnapshots\(event, manualRuntimeBefore\)\)/);
assert.match(html, /event\.registeredBeforeChargedKo = true;[\s\S]{0,300}captureManualEventSnapshots\(event, manualRuntimeBefore\)/);
assert.match(html, /runtime\.completePreparedExternal\(/);
assert.doesNotMatch(html, /SIMULTANEOUS_FAST_FAINT_REQUIRES_CANONICAL_PHASE_RESOLUTION/);
assert.match(html, /PvPeakManualSnapshots\.applyStartingShields/);
assert.match(html, /manualUndo"\)\.onclick = undoLiveManualCommand/);
assert.match(html, /manualRedo"\)\.onclick = redoLiveManualCommand/);
assert.match(html, /manualBranchSelect"\)\.onchange = switchLiveManualBranch/);
assert.match(html, /PvPeakManualSnapshots\.createRestorePlan/);
assert.match(html, /restoreManualRuntimePayload\(plan\.runtimeState, plan\.immutablePrefix\)/);
assert.match(html, /PvPeakManualBranches\.undo/);
assert.match(html, /PvPeakManualBranches\.redo/);

const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert(inlineScripts.length, "Expected the simulator inline runtime.");
assert.doesNotThrow(() => new Function(inlineScripts.at(-1)), "The simulator runtime must remain syntactically valid.");

console.log("Manual Mode UI contract tests passed.");
