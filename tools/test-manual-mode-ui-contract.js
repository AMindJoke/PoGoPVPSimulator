"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");
const allIds = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
assert.equal(new Set(allIds).size, allIds.length, "Every simulator element id must be unique.");
for (const id of [
  "manualModeStatus",
  "manualSetup",
  "manualRuntimeToolbar",
  "manualRuntimeState",
  "manualRuntimeDetail",
  "manualRuntimeTurn",
  "manualMobileActionMount",
  "manualWorkspaceHeader",
  "manualOverlayScenario",
  "manualBackToSimulation",
  "manualWorkspaceExit",
  "manualDecisionPanel",
  "manualEditorWorkspace",
  "manualDecisionBanner",
  "manualCurrentDecisionTitle",
  "manualDecisionWhy",
  "manualDecisionTurn",
  "manualDecisionEnergy",
  "manualDecisionHp",
  "manualDecisionShields",
  "manualDecisionLegal",
  "manualDuelHud",
  "manualHudSpriteA",
  "manualHudSpriteB",
  "manualHudHpA",
  "manualHudHpB",
  "manualHudChargesA",
  "manualHudChargesB",
  "manualOverlayUndo",
  "manualOverlayRedo",
  "manualOverlayExit",
  "manualStateInspector",
  "manualInspectorPhase",
  "manualInspectorGrid",
  "manualInspectorAdvancedGrid",
  "manualInspectorDetailsToggle",
  "manualTimelineEventMenu",
  "manualEventMenuTitle",
  "manualEventInspect",
  "manualEventBranchBefore",
  "manualEventBranchAfter",
  "manualEventReturnLive",
  "manualVersionPanel",
  "manualVersionTree",
  "manualReturnOriginal",
  "manualRenameVersion",
  "manualDuplicateVersion",
  "manualDeleteVersion",
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

assert.match(html, /\.manual-editor-workspace\s*\{[\s\S]{0,220}grid-template-columns: minmax\(0, 1\.65fr\) minmax\(300px, \.85fr\)/);
assert.match(html, /\.manual-editor-workspace\s*\{[\s\S]{0,320}width: 100%;[\s\S]{0,80}max-width: none/);
assert.match(html, /\.manual-state-inspector\s*\{[\s\S]{0,180}grid-column: 2/);
assert.match(html, /\.manual-inspector-grid\s*\{[\s\S]{0,120}grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(html, /waitingSides\.flatMap\(side => actionLabels/);
assert.match(html, /@media \(min-width: 901px\)[\s\S]{0,400}body\.manual-mode-active #battleTimeline/);
assert.match(html, /box-shadow:[\s\S]{0,120}0 0 0 100vmax/);
assert.match(html, /body\.manual-mode-active \.modal\s*\{\s*z-index: 600/);
assert.match(html, /body\.manual-mode-active \.manual-state-inspector\s*\{[\s\S]{0,80}grid-area: sidebar/);
assert.match(html, /function renderManualDuelHud/);
assert.match(html, /setPokemonImage\(sprite, combatant\.p\)/);
assert.match(html, /energyMoveOrb\(move, combatant\.energy, prefix, index\)/);
assert.match(html, /function syncManualEditorPlacement/);
assert.match(html, /window\.matchMedia\("\(max-width: 900px\)"\)\.matches/);
assert.match(html, /mobileMount\.append\(actions\)/);
assert.match(html, /decisionPanel\.append\(actions\)/);
assert.match(html, /body\.manual-mode-active \.manual-editor-workspace\s*\{\s*display: none/);
assert.match(html, /body\.manual-mode-active \.manual-hud-charges \.energy-orb\s*\{[\s\S]{0,100}width: 46px/);
assert.match(html, /--timeline-track-height: 58px/);
assert.match(html, /grid-template-areas:[\s\S]{0,160}"header header"[\s\S]{0,160}"decision sidebar"/);
assert.match(html, /Continue Automatically/);
assert.match(html, /function toggleManualInspectorDetails/);
assert.match(html, /manualOverlayScenario"\)\.onchange/);
assert.match(html, /manualOverlayExit"\)\.onclick = exitLiveManualMode/);

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
assert.match(html, /\$\{left\.p\.name\} · Cooldown/);
assert.match(html, /\$\{right\.p\.name\} · Stages/);
assert.match(html, /function manualActionUnavailableReason/);
assert.match(html, /a shield decision is pending/);
assert.match(html, /cooldown active for/);
assert.match(html, /not enough energy/);
assert.match(html, /function timelineEditorMoveLabel/);
assert.match(html, /class="timeline-token-label"/);
assert.match(html, /class="app-wordmark">PvP <small>Simulator<\/small>/);
assert.match(html, /--timeline-side-zone-width: 92px/);
assert.match(html, /\.key-numbers\s*\{[\s\S]{0,90}width: min\(100%, var\(--battle-layout-width\)\)/);
assert.match(html, /\.log-panel\s*\{[\s\S]{0,90}width: min\(100%, var\(--battle-layout-width\)\)/);
assert.match(html, /body\.manual-mode-active \.timeline-label img\s*\{[\s\S]{0,80}width: 52px/);
assert.match(html, /const tokenWidth = size/);
assert.doesNotMatch(html, /timeline-block fast[\s\S]{0,300}<span class="timeline-token-label">/);
assert.match(html, /Registration Turn:/);
assert.match(html, /Resolution Turn:/);
assert.match(html, /Pending Events:/);
assert.match(html, /HP: \$\{Number\(event\.hpBefore\)\}/);
assert.match(html, /function updateManualTimelineEventMenu/);
assert.match(html, /function createManualAlternativeFromSelected/);
assert.match(html, /COMMAND_TYPE\.CREATE_BRANCH/);
assert.match(html, /label: `Alternative \$\{alternativeNumber\}`/);
assert.match(html, /manualEventInspect"\)\.onclick = inspectSelectedManualTimelineEvent/);
assert.match(html, /function renderManualVersionTree/);
assert.match(html, /function renameActiveManualTimeline/);
assert.match(html, /function duplicateActiveManualTimeline/);
assert.match(html, /function deleteActiveManualTimeline/);
assert.match(html, /Restore the last undone edit/);
assert.match(html, /function offerManualBuildToCharged/);
assert.match(html, /INSERTION_POLICY\.NEXT_LEGAL_TURN/);
assert.match(html, /pendingDecisionType !== "BUILD_TO_CHARGED"/);
assert.match(html, /revalidated after each/);
assert.match(html, /id="manualResumeAuto"/);
assert.match(html, /<strong>Continue Automatically<\/strong>/);
assert.match(html, /Simulator will proceed from here/);
assert.match(html, /function resumeAutomaticFromManualTimeline/);
assert.match(html, /steps = runAutomaticBattleToEnd\(1000\)/);
assert.match(html, /startTimelineReplayFromTurn\(replayStartTurn, timelineStart\)/);
assert.match(html, /function setTimelineReplayRangeProgress/);
assert.match(html, /The original simulation remains unchanged/);
assert.match(html, /actionType: "RESUME_AUTO"/);
assert.match(html, /function timelineMoveSummary/);
assert.match(html, /timelineMoveSummary\(event, isSwipe\)\.split/);
assert.match(html, /\$\{event\.move\.name\} blocked/);
assert.match(html, /\+\$\{event\.move\.energyGain \|\| 0\} energy/);
assert.match(html, /manualRuntimeToolbar"\)\.dataset\.statusTone/);
assert.match(html, /function renderManualSelectedEventSummary/);
assert.match(html, /manualSnapshotStore\?\.get\(event\.timelineEventId, snapshots\.BOUNDARY\.BEFORE\)/);
assert.match(html, /manualEventMetric\("HP"/);
assert.match(html, /manualEventMetric\("Energy"/);
assert.match(html, /manualEventMetric\("Shields"/);
assert.match(html, /This side continues automatically after your move/);
assert.match(html, /<strong>Timeline versions<\/strong>/);
assert.match(html, /label: "Original simulation"/);
assert.match(html, /label: "Current manual edit"/);
assert.match(html, /Read-only automatic result/);
assert.match(html, /from before the selected action/);
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
