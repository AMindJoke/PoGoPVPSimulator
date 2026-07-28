"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");
for (const id of [
  "manualModeStatus",
  "manualSetup",
  "manualRuntimeToolbar",
  "manualRuntimeState",
  "manualRuntimeDetail",
  "manualRuntimeTurn",
  "manualEditorWorkspace",
  "manualDecisionBanner",
  "manualDecisionTitle",
  "manualDecisionWhy",
  "manualDecisionTurn",
  "manualDecisionEnergy",
  "manualDecisionLegal",
  "manualStateInspector",
  "manualInspectorPhase",
  "manualInspectorGrid",
  "manualTimelineEventMenu",
  "manualEventMenuTitle",
  "manualEventInspect",
  "manualEventBranchBefore",
  "manualEventBranchAfter",
  "manualEventReturnLive",
  "manualControlMode",
  "manualStartPoint",
  "manualModeToggle",
  "manualBranchSelect",
  "manualUndo",
  "manualRedo",
  "manualSelectionHint",
  "manualSelectionHintText",
  "manualSelectionCancel",
  "manualEventSummary",
  "manualModeExit",
  "manualActionsA",
  "manualActionsB",
  "manualAutoA",
  "manualAutoB",
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
assert.match(html, /manualModeExit"\)\.onclick = exitLiveManualMode/);
assert.match(html, /manualControlMode"\)\.onchange = changeLiveManualControlMode/);
assert.match(html, /data-manual-start-anchor="selected"/);
assert.match(html, /data-manual-boundary="selected-before"/);
assert.match(html, /data-manual-control-mode="BOTH_MANUAL"/);
assert.match(html, /function syncManualSegmentedControls/);
assert.match(html, /manualSetup"\)\.hidden = enabled/);
assert.match(html, /manualRuntimeToolbar"\)\.hidden = !enabled/);
assert.match(html, /manualActionsA"\)\.hidden = !enabled/);
assert.match(html, /class="manual-auto-response"><strong>Automatic response/);
assert.match(html, /shield decision/);
assert.match(html, /function manualRuntimeStatusPresentation/);
assert.match(html, /function renderManualDecisionBanner/);
assert.match(html, /manual-mode-active/);
assert.match(html, /actorName} to act/);
assert.match(html, /legalBattleActions\(actor/);
assert.match(html, /function renderManualStateInspector/);
assert.match(html, /Pending Fast/);
assert.match(html, /Pending events/);
assert.match(html, /A · Cooldown/);
assert.match(html, /B · Stages/);
assert.match(html, /function manualActionUnavailableReason/);
assert.match(html, /a shield decision is pending/);
assert.match(html, /cooldown active for/);
assert.match(html, /not enough energy/);
assert.match(html, /function timelineEditorMoveLabel/);
assert.match(html, /class="timeline-token-label"/);
assert.match(html, /Registration Turn:/);
assert.match(html, /Resolution Turn:/);
assert.match(html, /Pending Events:/);
assert.match(html, /HP: \$\{Number\(event\.hpBefore\)\}/);
assert.match(html, /function updateManualTimelineEventMenu/);
assert.match(html, /function createManualAlternativeFromSelected/);
assert.match(html, /COMMAND_TYPE\.CREATE_BRANCH/);
assert.match(html, /label: `Manual alternative \$\{alternativeNumber\}`/);
assert.match(html, /manualEventInspect"\)\.onclick = inspectSelectedManualTimelineEvent/);
assert.match(html, /manualRuntimeToolbar"\)\.dataset\.statusTone/);
assert.match(html, /function renderManualSelectedEventSummary/);
assert.match(html, /manualSnapshotStore\?\.get\(event\.timelineEventId, snapshots\.BOUNDARY\.BEFORE\)/);
assert.match(html, /manualEventMetric\("HP"/);
assert.match(html, /manualEventMetric\("Energy"/);
assert.match(html, /manualEventMetric\("Shields"/);
assert.match(html, /The simulator chooses this side after your action/);
assert.match(html, />Timeline<\/span><select id="manualBranchSelect"/);
assert.match(html, /label: "Manual playthrough"/);
assert.match(html, /\? "unchanged"[\s\S]{0,80}: "your changes"/);
assert.doesNotMatch(html, /moves from PvPoke|PvPoke policy/i);
assert.match(html, /Need \$\{missingEnergy\} more energy/);
assert.match(html, /manualStartPoint"\)\.value = "battle-start"/);
assert.match(html, /Charged · \$\{c\.charged\[0\]\.energyCost\} energy/);
assert.match(html, /manualStartPoint"\)\.onchange = updateManualBranchSelectionUi/);
assert.match(html, /manualSelectionCancel"\)\.onclick = cancelManualBranchSelection/);
assert.match(html, /event\.key === "Escape"[\s\S]{0,200}cancelManualBranchSelection/);
assert.match(html, /manual-branch-selection-active/);
assert.match(html, /manual-branch-selection-active #simulatorView > :not\(\.analysis-grid\)/);
assert.match(html, /manual-branch-selection-active \.matrix-overview > :not\(\.manual-panel\)/);
assert.match(html, /manual-branch-selection-active #battleTimeline/);
assert.match(html, /selectedManualTimelineSourceEvent/);
assert.match(html, /option\.disabled = !selectableTimeline/);
assert.match(html, /startControl\.value = "battle-start"/);
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
