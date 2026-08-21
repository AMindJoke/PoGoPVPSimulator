"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");
assert.match(html, /class="app-title-lockup"[\s\S]{0,220}id="themeToggle" class="header-theme-toggle"/, "The desktop theme control must live beside the application logo.");
assert.match(html, /class="battle-cta-row"[\s\S]{0,180}id="battleCta"[\s\S]{0,180}id="reset" class="secondary battle-reset"/, "Reset must be grouped with the battle action instead of the global header.");
assert.match(html, /function filteredBaseList\(\)\s*\{\s*return allPokemon;\s*\}/, "Battle selection must always include unreleased Pokemon and duplicate forms.");
assert.doesNotMatch(html, /id="(?:releasedOnly|showForms|presetMatchup|loadPreset|mobileReset)"/, "The obsolete Battle toolbar, Quick Matchup, duplicate-form filter, released filter, and header reset must be removed.");
assert.match(html, /src\/battle\/manual-branches\.js[\s\S]{0,150}src\/battle\/scenario-comparison\.js[\s\S]{0,150}src\/battle\/manual-scenario-io\.js/, "Scenario Comparison must load between the branch registry and canonical Scenario IO.");
assert.match(html, /id="manualScenarioCompare"[^>]+data-scenario-command="compare"[^>]*>[^<]*Create Comparison/, "Scenario controls must expose Create Comparison through the shared desktop/mobile Scenario panel.");
assert.match(html, /id="scenarioSetupBack"[^>]*>Back to Battle Setup/, "Scenario Review setup must expose a visible way back to the battle setup before a review starts.");
assert.match(html, /function leaveScenarioReviewSetup\(\)[\s\S]{0,260}scenarioState \|\| manualModeState\?\.enabled/, "The setup escape must leave only before a live review is active.");
assert.match(html, /function createManualScenarioComparison\(\)[\s\S]{0,2200}COMMAND_TYPE\.CREATE_COMPARISON/, "Create Comparison must use the atomic branch-registry command.");
assert.match(html, /comparison: manualScenarioComparison/, "Scenario persistence must include the active comparison projection.");
assert.match(html, /manualScenarioComparison = cloneTechnicalValue\(scenarioDocument\.comparison \|\| null\)/, "Opening a scenario must restore comparison state.");
assert.match(html, /id="manualComparisonPanel"[^>]+aria-labelledby="manualComparisonForkTitle"[^>]+hidden/, "Manual Mode must expose one semantic branched comparison timeline.");
assert.match(html, /function renderManualComparisonPanel\(\)[\s\S]{0,1400}comparisonViewModel\(comparison\)[\s\S]{0,6000}data-comparison-branch-id/, "The branched timeline must render the canonical projection and reuse live branch switching.");
assert.match(html, /class="manual-comparison-fork"[^>]+aria-label="Branched timeline comparison"/, "Scenario Comparison must render as one compact branched timeline.");
assert.match(html, /class="manual-comparison-fork-track" data-slot="shared"[\s\S]{0,320}data-slot="A"[\s\S]{0,320}data-slot="B"/, "Shared, Branch A, and Branch B tracks must be visible together.");
assert.match(html, /First divergence at Turn \$\{forkTurn\}/, "The first divergence must be announced in text, not through color alone.");
assert.match(html, /has no corresponding event/, "An unmatched branch event must be explained accessibly.");
assert.match(html, /manual-comparison-fork-connector/, "The split point must have a visible branch connector.");
assert.match(html, /manual-comparison-fork-event\.is-first/, "First divergent events must receive explicit visual treatment.");
assert.match(html, /manualComparisonForkLabel\(branchA, activeBranchId\)[\s\S]{0,120}manualComparisonForkLabel\(branchB, activeBranchId\)/, "Both branch outcomes must remain directly selectable without a separate screen.");
assert.match(html, /manual-comparison-fork-viewport\s*\{[^}]*overflow-x: auto/, "The full comparison must remain available through horizontal scrolling on narrow screens.");
assert.match(html, /@media \(max-width: 900px\)[\s\S]{0,900}manual-comparison-fork-grid/, "The branched comparison must retain a dedicated compact mobile layout.");
assert.match(html, /const visibleComparisonEvent = event => !event\.hiddenFromTimeline/, "Hidden judge setup edits must not pollute the visual branch timeline.");
assert.match(html, /const forkTurn = divergence \? Math\.max\(0, Number\(divergence\.turn \|\| 0\)\) : branchPointTurn/, "Hidden judge edits must not push the visual split beyond the actual first divergent battle turn.");
assert.match(html, /function manualComparisonTechnicalFork\(comparison, viewModel\)[\s\S]{0,1800}selectedEventId[\s\S]{0,900}actionOrdinal/, "A technical comparison must recover its selected Fast Move instead of using incidental runtime-state differences.");
assert.match(html, /const technicalFork = manualComparisonTechnicalFork\(comparison, viewModel\);[\s\S]{0,100}const divergence = technicalFork \|\| semanticDivergence/, "DRE and 1-Turn Lag targets must take priority over generic semantic divergence.");
assert.match(html, /technicalFork \|\| event\.difference === "shared"/, "All visible actions before an explicit technical issue must remain in shared history.");
assert.match(html, /\$\{technicalFork\.type\} diverges at Turn \$\{forkTurn\} on \$\{technicalFork\.moveName\}/, "The branch header must identify the actual technical issue point and affected Fast Move.");
assert.match(html, /\(!divergence \|\| Number\(event\.start \|\| 0\) < forkTurn\) && \(technicalFork \|\| event\.difference === "shared"\)/, "Shared history must stop permanently at the first divergence.");
assert.match(html, /visibleComparisonEvent\(event\) && !!divergence && Number\(event\.start \|\| 0\) >= forkTurn/, "Every visible post-divergence event must be rendered inside its own branch even when semantically repeated.");
assert.match(html, /manual-comparison-fork-event\.is-fast\s*\{[^}]*width: 14px/, "Fast Moves must remain compact timeline tokens instead of overlapping text labels.");
assert.match(html, /function timelineStateSummaryLines\(event\)[\s\S]{0,900}`\$\{side\} · \$\{timelineStatePokemonName\(side, sideState\)\}: \$\{hp\}\/\$\{maxHp\} HP · \$\{energy\} energy`/, "Timeline hover details must expose both Pokemon HP and energy at the selected event state.");
assert.doesNotMatch(html, /pokemonMap\.get\(/, "Timeline tooltips must use an initialized Pokemon lookup source.");
assert.match(html, /\["fast", "charge", "shield", "form-protect", "technical-lag", "technical-dre"\]/, "Manual timeline hover details must cover normal and technical battle events.");
assert.match(html, /data-timeline-tooltip="\$\{escapeHtml\(tooltipSummary\)\}"/, "Branched comparison events must carry the same timeline state summary.");
assert.match(html, /id="manualComparisonMoveTooltip" class="timeline-move-tooltip manual-comparison-move-tooltip"/, "Scenario Comparison must render a dedicated unclipped hover tooltip.");
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
  "manualMobileReviewShell",
  "manualMobileHudArea",
  "manualMobileTimelineArea",
  "manualMobileBottomSheetShell",
  "manualMobileSheetHandle",
  "manualMobileSheetStatus",
  "manualMobileTabMoves",
  "manualMobileTabJudge",
  "manualMobileTabScenario",
  "manualMobileBattleStateNav",
  "manualMobileBattleStateA",
  "manualMobileBattleStateB",
  "manualMobileBattleStateClose",
  "manualMobileTabsShell",
  "manualMobileControlsArea",
  "manualWorkspaceHeader",
  "manualOverlayScenario",
  "manualBackToSimulation",
  "manualWorkspaceExit",
  "manualDecisionPanel",
  "manualEditorWorkspace",
  "manualDecisionBanner",
  "manualCurrentDecisionTitle",
  "manualDecisionWhy",
  "manualScenarioPanel",
  "manualScenarioName",
  "manualScenarioStatus",
  "manualScenarioOpen",
  "manualScenarioSave",
  "manualScenarioCopyLink",
  "manualScenarioShareFeedback",
  "manualScenarioMore",
  "manualScenarioMenu",
  "manualScenarioLibraryModal",
  "manualScenarioLibraryList",
  "manualScenarioImportFile",
  "manualDuelHud",
  "manualHudPokemonSearchA",
  "manualHudPokemonSearchB",
  "manualHudPokemonSuggestionsA",
  "manualHudPokemonSuggestionsB",
  "manualHudMatchupDone",
  "manualHudSpriteA",
  "manualHudSpriteB",
  "manualHudStatusA",
  "manualHudStatusB",
  "manualHudMobileActor",
  "manualHudComparisonView",
  "manualTimelineGrid",
  "manualHudHpA",
  "manualHudHpB",
  "manualHudChargesA",
  "manualHudChargesB",
  "manualOverlayUndo",
  "manualOverlayRedo",
  "manualOverlayExit",
  "manualStateInspector",
  "manualBattleStatePanel",
  "manualBattleStateTitle",
  "manualBattleStateEditor",
  "manualEnergyTrainerHead",
  "manualEnergyTrainerTitle",
  "manualEnergyTrainer",
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
  "manualRestartTimeline",
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
assert.match(html, /\.energy-trainer-tiles\s*\{[\s\S]{0,160}repeat\(var\(--tile-count\), minmax\(0, 1fr\)\)/);
assert.match(html, /\.energy-trainer-next-cycle-slot\s*\{[\s\S]{0,80}min-width: 0/);
assert.match(html, /\.energy-trainer-next-cycle-dots\s*\{[\s\S]{0,140}flex-wrap: wrap/);
const nextCycleCss = html.match(/\.energy-trainer-next-cycle\s*\{([^}]+)\}/)?.[1] || "";
assert.doesNotMatch(nextCycleCss, /transition|opacity|transform/, "Persistent Next Cycle feedback must not fade or move.");
assert.match(html, /waitingSides\.flatMap\(side => actionLabels/);
assert.match(html, /@media \(min-width: 901px\)[\s\S]{0,400}body\.manual-mode-active #battleTimeline/);
assert.match(html, /box-shadow:[\s\S]{0,120}0 0 0 100vmax/);
assert.match(html, /body\.manual-mode-active \.modal\s*\{\s*z-index: 600/);
assert.match(html, /body\.manual-mode-active \.manual-state-inspector\s*\{[\s\S]{0,80}grid-area: sidebar/);
assert.match(html, /function renderManualDuelHud/);
assert.match(html, /function resetForManualBattle\(\)[\s\S]{0,1100}keepDesktopScenarioWorkspace[\s\S]{0,1100}ensureScenarioReviewWorkspaceMode\(\)/, "Scenario Review reset must preserve the desktop Manual Mode workspace while Pokemon are changed.");
assert.match(html, /function applyManualHudPokemonSelection\(side, pokemonId = null\)[\s\S]{0,1600}selectPokemon\(prefix, pokemon\.id, true\)/, "Inline HUD selection must reuse the canonical Pokemon setup flow.");
assert.match(html, /function renderManualHudPokemonSuggestions\(side, list\)[\s\S]{0,500}renderPokemonSuggestionList\(box, list/, "Inline HUD suggestions must reuse the shared Pokemon result renderer.");
assert.match(html, /function renderPokemonSuggestionList\(box, list, options = \{\}\)[\s\S]{0,1600}setPokemonImage\(button\.querySelector\("img"\), pokemon\)/, "Shared Pokemon suggestions must reuse Pokemon sprites, including Shadow presentation.");
assert.match(html, /\.pokemon-suggestion img\.shadow-pokemon\s*\{[\s\S]{0,500}radial-gradient[\s\S]{0,500}drop-shadow/, "Shadow Pokemon suggestions must retain their purple aura treatment.");
assert.match(html, /manualMatchupEditMode[\s\S]{0,700}button\.disabled = true[\s\S]{0,250}Finish choosing both Pokemon/, "Battle actions must remain unavailable while the desktop matchup is being edited.");
assert.match(html, /setPokemonImage\(sprite, combatant\.p\)/);
assert.match(html, /function finalFallbackImageUrl/);
const pokemonImageLoader = html.match(/function setPokemonImage[\s\S]+?function spriteSlug/)?.[0] || "";
assert(pokemonImageLoader.indexOf("img.onerror =") < pokemonImageLoader.lastIndexOf("img.src ="), "Pokemon image fallbacks must be installed before assigning src.");
assert.match(html, /energyMoveOrb\(move, combatant\.energy, prefix, index\)/);
assert.match(html, /function syncManualEditorPlacement/);
assert.match(html, /window\.matchMedia\("\(max-width: 900px\)"\)\.matches/);
assert.match(html, /\.manual-mobile-review-shell\s*\{\s*display: none;\s*\}/, "The mobile shell must not affect desktop layout.");
assert.match(html, /@media \(max-width: 900px\)[\s\S]*?body\.manual-mode-active \.manual-mobile-review-shell:not\(\[hidden\]\)[\s\S]{0,360}display: contents;/, "The mobile shell must activate only inside the mobile breakpoint.");
assert.match(html, /id="manualMobileHudArea"[^>]+data-mobile-source="manualMobileFocusMount manualDuelHud"/, "The mobile HUD area must reuse the existing HUD nodes.");
assert.match(html, /id="manualMobileTimelineArea"[^>]+data-mobile-source="manualTimelineStage"/, "The mobile Timeline area must reuse the existing Timeline stage.");
assert.match(html, /id="manualMobileBottomSheetShell"[^>]+data-state="collapsed"[^>]+data-mobile-source="manualDecisionPanel manualStateInspector manualTechnicalIssuesMount manualTimelineEventMenu manualRuntimeToolbar"/, "The bottom sheet must reference the existing controls.");
const mobileShellMarkup = html.match(/<section id="manualMobileReviewShell"[\s\S]*?<\/section>\s*<\/section>/)?.[0] || "";
const mobileShellInteractiveIds = [...mobileShellMarkup.matchAll(/<(?:button|input|select|textarea)\b[^>]*\bid="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(mobileShellInteractiveIds, ["manualMobileSheetHandle", "manualMobileTabMoves", "manualMobileTabJudge", "manualMobileTabScenario"], "The bottom sheet may add only its navigation controls; review controls must be reparented rather than duplicated.");
for (const functionName of ["syncManualEditorPlacement", "renderManualDuelHud", "renderManualDecisionBanner", "renderManualBattleStateEditor"]) {
  const declarations = html.match(new RegExp(`function\\s+${functionName}\\s*\\(`, "g")) || [];
  assert.equal(declarations.length, 1, `${functionName} must not be duplicated for mobile.`);
}
assert.match(html, /focusMount\.append\(workspaceHeader\)/);
assert.match(html, /mobileReview && modeExit\.parentElement !== workspaceNav[\s\S]{0,100}workspaceNav\.insertBefore\(modeExit, workspaceExit\)/, "Mobile Scenario Review must place Exit beside Guide in the primary header.");
assert.match(html, /modeExitHome\.after\(modeExit\)/, "Leaving the mobile review layout must restore Exit Manual to its canonical toolbar home.");
assert.match(html, /focusMount\.append\(duelHud\)/);
assert.match(html, /decisionPanel\.append\(actions\)/);
assert.match(html, /secondaryMount\.append\(runtimeToolbar\)/);
assert.match(html, /mobileControls\.append\(decisionPanel\)/);
assert.match(html, /mobileControls\.append\(technicalMount\)/);
assert.match(html, /mobileControls\.append\(inspector\)/);
assert.match(html, /mobileControls\.append\(eventMenu\)/);
assert.match(html, /mobileControls\.append\(runtimeToolbar\)/);
assert.match(html, /const mobileReview = mobile && document\.body\.dataset\.view === "scenario-review"/, "The bottom sheet must remain exclusive to mobile Scenario Review.");
assert.match(html, /function restoreManualReviewControlHomes\(\)/, "Desktop and non-review mobile layouts need canonical control restoration.");
assert.match(html, /body\[data-view="scenario-review"\]\.manual-mode-active \.manual-mobile-bottom-sheet-shell\s*\{[\s\S]{0,100}position: fixed;[\s\S]{0,100}bottom: 0;/, "The Scenario Review sheet must be fixed to the mobile viewport bottom.");
assert.match(html, /manual-mobile-bottom-sheet-shell\[data-state="half"\][\s\S]{0,120}height: var\(--manual-mobile-half-height, min\(52dvh, 460px\)\)/);
assert.match(html, /manual-mobile-bottom-sheet-shell\[data-state="expanded"\][\s\S]{0,120}height: min\(88dvh/);
assert.match(html, /manual-mobile-controls-shell\s*\{[\s\S]{0,220}overflow-y: auto;[\s\S]{0,100}overscroll-behavior: contain;/, "Bottom sheet content must scroll internally.");
assert.match(html, /manual-mobile-controls-shell \.manual-state-inspector\.mobile-details-open\s*\{[^}]*position: static;[^}]*box-shadow: none;[^}]*\}/, "Battle State details must expand inside the sheet rather than opening a nested mobile overlay.");
assert.match(html, /env\(safe-area-inset-bottom, 0px\)/, "The mobile sheet must respect the device bottom safe area.");
assert.match(html, /function setManualMobileSheetState\(state/);
assert.match(html, /function cycleManualMobileSheetState\(\)/);
assert.match(html, /MANUAL_MOBILE_SHEET_STATES = Object\.freeze\(\["collapsed", "half", "expanded"\]\)/);
assert.match(html, /MANUAL_MOBILE_REVIEW_TABS = Object\.freeze\(\["moves", "judge", "scenario"\]\)/);
assert.match(html, /function setManualMobileReviewTab\(tab/);
assert.match(html, /data-active-tab="moves"/, "Moves must be the initial mobile review tab.");
assert.match(html, /role="tab" data-manual-mobile-tab="moves"[^>]+aria-selected="true"/, "Moves must be selected initially.");
assert.match(html, /data-manual-mobile-tab="judge"/);
assert.match(html, /data-manual-mobile-tab="scenario"/);
assert.match(html, /manualMobileReviewTab = "moves"/);
assert.match(html, /setManualMobileReviewTab\(manualMobileReviewTab\)/, "Rendering must preserve the active tab instead of remounting controls.");
assert.match(html, /data-active-tab="moves"\] #manualTechnicalIssuesMount/);
assert.match(html, /data-active-tab="judge"\] #manualDecisionPanel/);
assert.match(html, /data-active-tab="scenario"\] #manualEditorActions/);
assert.match(html, /data-manual-hud-side="A" role="button" tabindex="0"[^>]+aria-controls="manualStateInspector"/);
assert.match(html, /data-manual-hud-side="B" role="button" tabindex="0"[^>]+aria-controls="manualStateInspector"/);
assert.match(html, /function openManualMobileBattleState\(side\)/);
assert.match(html, /function setManualMobileBattleStateSide\(side/);
assert.match(html, /setManualMobileReviewTab\("judge"\)/, "Opening Battle State from the HUD must reveal the Judge tab.");
assert.match(html, /setManualMobileSheetState\("half"\)/, "Opening Battle State must reveal a collapsed sheet.");
assert.match(html, /manualMobileBattleStateSide = null/, "Only one optional mobile Battle State side may be active.");
assert.match(html, /data-mobile-side="A"\] \.manual-battle-state-side\[data-side="B"\]/);
assert.match(html, /data-mobile-side="B"\] \.manual-battle-state-side\[data-side="A"\]/);
assert.match(html, /function syncManualMobileTechnicalIndicator\(\)/);
assert.match(html, /function revealManualMobileTechnicalDraft\(\)/);
assert.match(html, /setManualMobileSheetState\("collapsed"\)/, "Starting a mobile technical selection must uncover the timeline.");
assert.match(html, /revealManualMobileTechnicalDraft\(\)/, "Selecting an eligible timeline event must return to the Judge confirmation flow.");
assert.match(html, /data-technical-active="true"/, "The Judge tab needs a non-text-independent active issue indicator.");
assert.match(html, /Select a highlighted Fast Move/, "Collapsed selection mode must explain the next timeline action.");
assert.match(html, /data-active-tab="moves"\] #manualDecisionBanner\s*\{[^}]*order: 2;/, "Current Decision and history actions must follow the legal moves.");
assert.match(html, /data-active-tab="moves"\] #manualEditorActions\s*\{[^}]*order: 1;/, "Legal moves must be the first interactive content in the Moves tab.");
assert.match(html, /function syncManualMobileSheetGeometry\(\)[\s\S]{0,320}querySelector\("\.timeline-grid"\)/, "Half-height placement must follow the rendered Timeline rows rather than the full panel.");
assert.match(html, /viewportBottom - timelineBottom - 6/, "The open sheet must leave a small gap below the Timeline.");
assert.match(html, /data-active-tab="moves"\] \.manual-overlay-controls\s*\{[^}]*grid-template-columns: repeat\(2, 44px\)/, "Undo and Redo must remain compact and directly reachable.");
assert.match(html, /data-active-tab="moves"\] \.manual-continue-auto\s*\{[^}]*width: auto;[^}]*background: var\(--soft\);/, "Continue Automatically must remain a secondary, non-fixed action.");
assert.match(html, /data-active-tab="scenario"\] #manualRuntimeToolbar/, "Scenario and timeline management must remain confined to the Scenario tab.");
assert.match(html, /manual-mobile-bottom-sheet-shell\s*\{[^}]*border-radius: 22px 22px 0 0;[^}]*transition: height \.2s ease/, "The mobile sheet needs restrained rounded corners and motion.");
assert.match(html, /manual-mobile-tabs-shell button\s*\{[^}]*min-height: 44px;/, "Primary mobile tab targets must be at least 44px tall.");
assert.match(html, /function handleManualMobileTabKeydown\(event\)/, "Mobile tabs must support keyboard navigation.");
assert.match(html, /\["ArrowLeft", "ArrowRight", "Home", "End"\]/);
assert.match(html, /@media \(max-width: 900px\) and \(prefers-reduced-motion: reduce\)[\s\S]{0,420}transition: none;[\s\S]{0,220}scroll-behavior: auto;/, "Reduced-motion users must not receive sheet or scroll animation.");
assert.match(html, /timeline-zoom-control button \{ min-height: 40px; \}/, "Compact timeline zoom controls must remain touchable.");
assert.match(html, /const levels = \[50, 75, 100, 125, 150, 200\]/, "Timeline zoom must offer 50% and 75% overview levels.");
assert.match(html, /Math\.max\(50, Math\.min\(200, number\)\)/, "Timeline zoom must retain the complete 50%-200% range.");
assert.match(html, /timelineZoomOut"\)\.disabled = value <= 50/, "Timeline zoom-out must remain available below 100%.");
assert.match(html, /classList\.toggle\("overview-mode", timelineZoomPercent\(\) < 100\)/, "Sub-100% zoom must activate the compact timeline overview.");
assert.match(html, /timeline-scroll\.overview-mode \.timeline-token-label\s*\{\s*display: none;/, "Overview zoom must hide overlapping move text while preserving timeline events.");
assert.match(html, /manual-mobile-bottom-sheet-shell \.actions button\[id\*="UseCharge"\]:disabled,[\s\S]{0,180}button\[id\*="UseCharge"\]\.build-available[\s\S]{0,80}display: none;/, "Mobile Charged buttons must appear only when the canonical action is legal and affordable.");
assert.match(html, /event\.key !== "Escape" \|\| manualMobileSheetState === "collapsed"/, "Escape must collapse an open mobile sheet.");
assert.match(html, /id="manualMobileFocusMount"/);
assert.match(html, /id="manualMobileSecondaryMount"/);
assert.match(html, /body\.manual-mode-active \.manual-timeline-stage\s*\{[\s\S]{0,160}position: sticky/);
assert.match(html, /body\.manual-mode-active #battleTimeline\s*\{[\s\S]{0,140}--timeline-track-height: 46px;[\s\S]{0,80}--timeline-lane-height: 30px;/, "Mobile Manual Mode must keep readable timeline lanes.");
assert.match(html, /body\.manual-mode-active \.timeline-scroll\s*\{[\s\S]{0,260}overflow-x: auto;[\s\S]{0,180}overscroll-behavior-x: contain;/, "Timeline scrolling must remain inside the mobile timeline.");
assert.match(html, /body\.manual-mode-active \.timeline-scroll\.fit-mode\s*\{[\s\S]{0,100}overflow-x: auto;/, "Fit mode must remain horizontally scrollable on mobile.");
assert.match(html, /function manualMobileTimelineScrollEnabled\(\)/);
assert.match(html, /manualMobileTimelineScrollEnabled\(\) \? Math\.max\(18, fit\) : fit/, "Mobile timeline turns must keep a readable minimum width.");
assert.match(html, /if \(isFit && !mobileManualScroll\) scroll\.scrollLeft = 0;/, "Mobile renders must preserve the judge's timeline scroll position.");
assert.match(html, /const mobileScrollKey = `\$\{manualRootSnapshotId \|\| "manual"\}/, "Mobile timeline position must be scoped to the active review.");
assert.match(html, /if \(mobileManualScroll && !sameMobileTimeline\) scroll\.scrollLeft = 0;/, "A new mobile review must open at turn zero.");
assert.match(html, /else if \(mobileManualScroll\) scroll\.scrollLeft = Math\.min\(previousScrollLeft/, "Timeline re-renders must preserve the judge's position.");
assert.match(html, /technical-event[^`]+aria-label="\$\{escapeHtml\(title\)\}"/, "Technical timeline events need an accessible label.");
assert.match(html, /body\.manual-mode-active \.manual-mobile-focus-mount\s*\{[\s\S]{0,120}position: sticky/);
assert.match(html, /\.manual-hud-status,\s*\.manual-hud-mobile-actor\s*\{\s*display: none;\s*\}/, "Mobile-only HUD status must stay hidden on desktop.");
assert.match(html, /@media \(max-width: 900px\)[\s\S]*?body\.manual-mode-active \.manual-hud-status\s*\{[\s\S]{0,180}display: inline-flex/, "Compact status chips must activate only on mobile.");
assert.match(html, /body\.manual-mode-active \.manual-hud-center \.manual-hud-mobile-actor\s*\{[\s\S]{0,100}display: inline-flex/, "The acting-side summary must be visible in the mobile HUD.");
assert.match(html, /grid-template-columns: minmax\(0, 1fr\) 48px minmax\(0, 1fr\)/, "The mobile HUD must reserve a compact center column.");
assert.match(html, /status\.textContent = fainted \? "Fainted" : "Active"/, "HUD faint state must come from canonical combatant HP.");
assert.match(html, /\? `\$\{activeSide\} to act`/, "The mobile HUD must expose the current acting side.");
assert.match(html, /body\.manual-mode-active \.manual-editor-workspace\s*\{[\s\S]{0,80}order: 3/);
assert.match(html, /body\.manual-mode-active \.manual-editor-actions\s*\{\s*order: 1/);
assert.match(html, /body\.manual-mode-active \.manual-decision-banner\s*\{\s*order: 2/);
assert.match(html, /body\.manual-mode-active \.manual-editor-actions\s*\{[\s\S]{0,140}grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(html, /body\.manual-mode-active \.manual-editor-command-bar\s*\{[\s\S]{0,80}grid-column: 1 \/ -1/);
assert.match(html, /body\.manual-mode-active main\s*\{[\s\S]{0,90}136px/);
assert.match(html, /manual-hud-types\s*\{[\s\S]{0,90}grid-column: 1 \/ -1/);
assert.match(html, /body\.manual-mode-active \.manual-hud-charges \.energy-orb\s*\{[\s\S]{0,100}width: 32px/);
assert.match(html, /body\.manual-mode-active \.manual-hud-hp\s*\{[\s\S]{0,100}height: 24px/);
assert.match(html, /body\.manual-mode-active \.manual-hud-side\s*\{[\s\S]{0,180}border: 0;[\s\S]{0,80}background: transparent/);
assert.match(html, /body\.manual-mode-active \.manual-hud-shield-control\s*\{[\s\S]{0,120}grid-template-columns: repeat\(3, 34px\)/);
assert.match(html, /body\.manual-mode-active \.manual-editor-actions \.actions button\s*\{[\s\S]{0,140}min-height: 58px/);
assert.match(html, /body\.manual-mode-active \.manual-editor-actions \.move-button-label > span\s*\{[\s\S]{0,80}color: inherit/);
assert.match(html, /grid-template-columns: repeat\(10, minmax\(0, 1fr\)\)/);
assert.match(html, /"actions-a actions-a actions-a actions-a actions-a actions-b actions-b actions-b actions-b actions-b"/);
assert.match(html, /data-manual-charge-slot="A-0"[\s\S]{0,180}id="manualHudEnergyA"[\s\S]{0,180}data-manual-charge-slot="A-1"/);
assert.match(html, /data-manual-charge-slot="B-0"[\s\S]{0,180}id="manualHudEnergyB"[\s\S]{0,180}data-manual-charge-slot="B-1"/);
assert.match(html, /id="manualHudTypesA"/);
assert.match(html, /id="manualHudTypesB"/);
assert.match(html, /--timeline-track-height: 48px/);
assert.match(html, /grid-template-areas:[\s\S]{0,160}"header header"[\s\S]{0,160}"decision sidebar"/);
assert.match(html, /body\[data-view="scenario-review"\]\.manual-mode-active main\s*\{[\s\S]{0,100}padding: 8px/);
assert.match(html, /width: min\(1220px, calc\(100vw - 16px\)\)/);
assert.match(html, /body\.manual-mode-active \.manual-timeline-stage\s*\{[\s\S]{0,160}grid-template-rows: auto 128px auto auto/);
assert.match(html, /grid-template-rows: auto auto auto auto auto/);
assert.match(html, /body\.manual-mode-active \.manual-state-number-row\s*\{[\s\S]{0,100}repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(html, /body\[data-view="scenario-review"\]\.manual-mode-active #battleTimeline\s*\{[\s\S]{0,240}min-height: 0/);
assert.match(html, /Continue Automatically/);
assert.match(html, /src\/battle\/energy-trainer\.js/);
assert.match(html, /src\/scenario\/manual-battle-state\.js/);
assert.match(html, /scenarioManualMode/);
assert.match(html, /scenarioAutoMode/);
assert.match(html, /function ensureScenarioReviewWorkspaceMode/);
assert.match(html, /No simulation starts automatically/);
assert.match(html, /function commitManualBattleStateEdit/);
assert.match(html, /function registerManualFast/);
assert.match(html, /function resolveManualFastImpactsThrough/);
assert.match(html, /manualPendingFastEvents = api\.scheduleEvent/);
assert.match(html, /manualModeState\?\.enabled && !technicalIssueInjection/);
assert.match(html, /function recordManualJudgeEvent/);
assert.match(html, /manualBattleStateStageStepper\(side, "attackStage", state\.attackStage\)/);
assert.match(html, /manualBattleStateStageStepper\(side, "defenseStage", state\.defenseStage\)/);
assert.match(html, /class="manual-state-stepper" role="group"/);
assert.match(html, /data-manual-state-value="\$\{value - 1\}"/);
assert.match(html, /data-manual-state-value="\$\{value \+ 1\}"/);
assert.match(html, /value <= -4 \? " disabled"/);
assert.match(html, /value >= 4 \? " disabled"/);
assert.doesNotMatch(html, /manualBattleStateShieldControl/);
assert.doesNotMatch(html, /data-manual-state-shields/);
assert.match(html, /type="number" min="0" max="\$\{state\.maxHp\}"/);
assert.match(html, /class="manual-state-input-shell"/);
assert.match(html, /function shieldControlButtonMarkup/);
assert.match(html, /shieldControlButtonMarkup\(\{/);
assert.match(html, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
assert.doesNotMatch(html, /active: slot <= count/);
assert.match(html, /function renderManualHudShieldControl/);
assert.match(html, /setManualStartingShieldCount\(side, count\)/);
assert.match(html, /combatant\.shields = normalized/);
assert.match(html, /manualBackToSimulation"\)\.hidden = scenarioReviewWorkspace/);
assert.match(html, /manualWorkspaceExit"\)\.hidden = scenarioReviewWorkspace/);
assert.match(html, /manualOverlayExit"\)\.hidden = scenarioReviewWorkspace/);
assert.match(html, /dataset\.reviewContext = scenarioReviewWorkspace \? "scenario-review" : "battle-simulator"/);
assert.match(html, /body\[data-view="scenario-review"\] #manualEnergyTrainerHead/);
assert.match(html, /body\[data-view="scenario-review"\]\.manual-mode-active #battleTimeline\s*\{[\s\S]{0,120}position: relative/);
assert.match(html, /canEnterWorkspaceDirectly[\s\S]{0,260}ensureScenarioReviewWorkspaceMode\(\)/);
assert.match(html, /if \(!scenarioState\) scenarioReviewMode = "manual";/);
assert.match(html, /scenario-manual-setup \.battle-cta-row/);
assert.match(html, /Choose both Pokémon · the manual workspace opens automatically/);
assert.match(html, /clearManualEnergyTrainerNextCycle\(\)/);
assert.match(html, /captureManualEventSnapshots\(event, beforeState\)/);
assert.match(html, /syncManualBranchAfterAction\(\{/);
assert.match(html, /id="manualBringNextModal"/);
assert.match(html, /function openManualBringNext/);
assert.match(html, /function manualBringNextAvailability/);
assert.match(html, /replacementAvailability\(combatant, candidates, scenarioState, side\)/);
assert.match(html, /if \(availability\.needsScenarioLock\) lockScenarioState/);
assert.match(html, /function cancelManualBringNext/);
assert.match(html, /manualBringNextCancel"\)\.onclick = cancelManualBringNext/);
assert.match(html, /scenarioState\?\.status === "awaiting-incoming"/);
assert.match(html, /function confirmManualBringNext/);
assert.match(html, /prepareIncomingCombatant\(incoming/);
assert.match(html, /"manual-entry", entryLabel, pendingIncoming\.beforeState/);
assert.match(html, /eventType: "POKEMON_ENTRY"/);
assert.match(html, /scenarioHistory,\s+p1Shields/);
assert.match(html, /restored\.scenarioHistory\?\.A/);
assert.match(html, /function renderManualJudgeTimelineEvent/);
assert.match(html, /event\.source === "judge-manual"/);
assert.match(html, /timeline-block judge-event/);
assert.match(html, /scenarioReview:\s*\{\s*mode: scenarioReviewMode/);
assert.match(html, /scenarioReviewMode = normalizedScenarioReviewMode\(review\?\.mode\)/);
assert.match(html, /applyManualBattleState\?\.\(combatant/);
assert.match(html, /id="manualBattleStateFeedback" class="sr-only" aria-live="polite"/);
assert.match(html, /function handleManualBringNextKeydown/);
assert.match(html, /event\.key === "Escape"/);
assert.match(html, /event\.key !== "Tab"/);
assert.match(html, /context\?\.returnFocus\?\.isConnected/);
assert.match(html, /@media \(max-width: 900px\)[\s\S]*?\.manual-state-segmented \{ grid-template-columns: repeat\(5/);
assert.match(html, /@media \(max-width: 900px\)[\s\S]*?\.manual-state-stepper \{ grid-template-columns: minmax\(0, 1fr\) 44px 44px 44px/);
assert.match(html, /@media \(max-width: 900px\)[\s\S]*?\.manual-bring-next-modal \.modal-card \{ width: 100%; max-height:/);
assert.match(html, /manualOverlayScenario"\)\.onchange/);
assert.match(html, /manualOverlayExit"\)\.onclick = exitLiveManualMode/);
assert.match(html, /manualBackToSimulation"\)\.onclick = backToSimulationFromManual/);
assert.match(html, /function backToSimulationFromManual/);
assert.match(html, /manualModeMinimized = true/);
assert.match(html, /function scrollManualMobileEditorToTop/);
assert.match(html, /window\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/);
assert.match(html, /body\.manual-mode-active \.manual-timeline-stage \.timeline \{\s*--timeline-side-zone-width: 48px;/);
assert.match(html, /let manualSessionControlMode = null/);
assert.match(html, /controlMode = Object\.values\(controlModes\)\.includes\(manualSessionControlMode\)/);
assert.match(html, /manualSessionControlMode = selectedControlMode/);
assert.match(html, /function keepLatestManualTimelineEventVisible/);
assert.match(html, /scroll\.scrollBy\(/);
assert.match(html, /function syncTimelineReplacementSpace/);
assert.match(html, /classList\.toggle\("has-replacement-transition", hasTransition\)/);
assert.match(html, /--timeline-replacement-side-zone-width/);
assert.match(html, /style\.setProperty\("--timeline-side-zone-width", `\$\{reservedWidth\}px`\)/);
assert.match(html, /style\.removeProperty\("--timeline-side-zone-width"\)/);
assert.match(html, /Math\.ceil\(label\.scrollWidth \+ 10\)/);
assert.match(html, /syncTimelineReplacementSpace\(\);/);
assert.match(html, /syncManualBranchAfterAction\(result\.action \|\| \{[\s\S]{0,360}render\(\);\s*return true;/);
assert.match(html, /@media \(max-width: 900px\) and \(max-height: 620px\)/);
assert.match(html, /id="manualMobileVersionsToggle"/);
assert.match(html, /function toggleManualMobileVersions/);
assert.match(html, /mobile-versions-open/);

for (const value of ["battle-start", "selected-before", "selected-after", "current"]) {
  assert.match(html, new RegExp(`value=["']${value}["']`), `Missing branch-point option ${value}.`);
}

assert.match(html, /manualModeToggle"\)\.onclick = toggleLiveManualMode/);
assert.match(html, /manualModeExit"\)\.onclick = exitLiveManualMode/);
assert.match(html, /function resetBattleStateFromSetup\(\)[\s\S]{0,3200}lastBattleInitialSimulatorState = cloneTechnicalValue\(snapshotFullSimulatorState\(\)\)/);
assert.match(html, /if \(startMode === "battle-start"\)[\s\S]{0,650}document\.body\.classList\.add\("battle-results-visible"\)/);
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
assert.match(html, /function askManualShieldDecision/);
assert.match(html, /class="shield-decision-arena"/);
assert.match(html, /data-shield-decision-defender/);
assert.match(html, /data-shield-decision-attacker/);
assert.match(html, /Unshielded damage/);
assert.match(html, /Shields remaining/);
assert.match(html, /modal\.classList\.toggle\("shield-decision-modal", options\.kind === "shield"\)/);
assert.match(html, /function renderManualDecisionBanner/);
assert.match(html, /function renderManualScenarioPanel/);
assert.match(html, /function saveManualScenario/);
assert.match(html, /function manualScenarioSnapshot\(\)[\s\S]{0,2200}PvPeakManualScenarioIO\.serializeScenario/, "Scenario Review saves must use the canonical serializer.");
assert.match(html, /pendingFastEvents: manualPendingFastEvents,[\s\S]{0,100}technicalIssue: technicalIssueInjection/, "Canonical saves must include pending Fast and Technical Issue state.");
assert.match(html, /function openStoredManualScenario\(id\)[\s\S]{0,500}deserializeScenario\(entry\.payload, manualScenarioValidationOptions\(\)\)/, "Open Scenario must validate and deserialize before restoring application state.");
assert.match(html, /src\/battle\/manual-scenario-share\.js/, "The client-side shared Scenario codec must load with Scenario Review.");
assert.match(html, /function restoreCanonicalManualScenario\(scenarioDocument, options = \{\}\)/, "Stored and shared scenarios must use one canonical restore path.");
assert.match(
  html,
  /restoreManualRuntimePayload\(\s*cloneTechnicalValue\(scenarioDocument\.state\.runtimeState\),\s*cloneTechnicalValue\(scenarioDocument\.timeline\.events\)\s*\)/,
  "Canonical scenario restore must apply the saved Manual Mode runtime and semantic timeline."
);
assert.ok(
  html.indexOf('if (options.activateView) setAppView("scenario-review");', html.indexOf("function restoreCanonicalManualScenario"))
    < html.indexOf("restoreManualRuntimePayload(", html.indexOf("function restoreCanonicalManualScenario")),
  "Scenario Review view activation must happen before restoring the canonical runtime."
);
assert.match(html, /function loadSharedScenarioFromLocation\(\)[\s\S]{0,700}decodeScenario\(token\)[\s\S]{0,500}deserializeScenario\(payload, manualScenarioValidationOptions\(\)\)/, "Shared links must decode and validate before restoration.");
assert.match(html, /void loadSharedScenarioFromLocation\(\);/, "Shared Scenario loading must run after application initialization.");
assert.match(html, /This shared scenario could not be loaded\./, "Invalid shared links need a clear user-facing error.");
assert.match(html, /id="sharedScenarioStartNew"[\s\S]{0,120}Start a new scenario/, "Invalid shared links must provide a recovery action.");
assert.match(html, /id="manualScenarioCopyLink"[^>]*>Copy Share Link<\/button>/, "Scenario controls must expose a compact Copy Share Link action.");
assert.match(html, /id="manualScenarioShareFeedback"[^>]+role="status"[^>]+aria-live="polite"/, "Share feedback must be announced accessibly.");
assert.match(html, /function copyManualScenarioShareLink\(\)[\s\S]{0,700}manualScenarioSnapshot\(\)[\s\S]{0,260}buildScenarioUrl\(payload, window\.location\)[\s\S]{0,180}writeManualScenarioLinkToClipboard\(url\)/, "Copy Share Link must encode the current canonical Scenario Review and copy the resulting URL.");
assert.match(html, /function manualScenarioShareButtonLabel\(kind[\s\S]{0,180}Copy Comparison Link/, "An active comparison must expose an explicit Copy Comparison Link label.");
assert.match(html, /share\.dataset\.shareKind = shareKind[\s\S]{0,180}manualScenarioShareButtonLabel\(shareKind\)/, "Scenario controls must switch share affordance without adding a second serialization path.");
assert.match(html, /copyManualScenarioShareLink\(\)[\s\S]{0,900}manualScenarioShareKind\(payload\)[\s\S]{0,500}Comparison link copied/, "Comparison sharing must use the canonical snapshot and provide specific success feedback.");
assert.match(html, /restoreCanonicalManualScenario\(imported\.scenario,[\s\S]{0,180}comparisonView: imported\.scenario\.comparison\?\.branches\?\.length === 2 \? "diff" : "A"/, "Opening a shared comparison must enter the comparison presentation directly.");
assert.match(html, /manualMobileComparisonView = MANUAL_MOBILE_COMPARISON_VIEWS\.includes\(options\.comparisonView\)[\s\S]{0,120}: "A"/, "Temporary mobile comparison view must be chosen at restore time rather than persisted canonically.");
assert.match(html, /navigator\.clipboard\?\.writeText[\s\S]{0,800}document\.execCommand\("copy"\)/, "Clipboard API must have a dependency-free fallback.");
assert.match(html, /manual-mobile-bottom-sheet-shell\[data-active-tab="scenario"\] \.manual-scenario-share\s*\{[^}]*grid-column: 1 \/ -1;/, "The shared Scenario control must span a readable mobile row inside the Scenario tab.");
assert.match(html, /function openStoredManualScenario/);
assert.match(html, /localStorage/);
assert.match(html, /manual-scenario-library\.js/);
assert.match(html, /manual-mode-active/);
assert.match(html, /actorName} to act/);
assert.match(html, /legalBattleActions\(actor/);
assert.match(html, /function renderManualStateInspector/);
assert.match(html, /tileApi\.createTileModel/);
assert.match(html, /energy-trainer-threshold/);
assert.match(html, /manualEnergyTrainerSuppressPop/);
assert.match(html, /tileApi\.shouldAnimateCompletion/);
assert.match(html, /function captureManualEnergyTrainerNextCycle/);
assert.match(html, /function presentManualEnergyTrainerNextCycle/);
assert.match(html, /createNextCycleController\?\.\(\{\s*persistent: true/);
assert.match(html, /role="status" aria-live="polite" aria-atomic="true"/);
assert.match(html, /energy-trainer-next-cycle-dot/);
assert.match(html, /energy-trainer-next-cycle-ready/);
assert.match(html, /nextCycle\.pokemonId !== combatant\.p\?\.id/);
const energyTrainerRender = html.match(/function renderManualStateInspector[\s\S]+?function toggleManualInspectorDetails/)?.[0] || "";
assert(
  energyTrainerRender.indexOf('class="energy-trainer-pokemon"') < energyTrainerRender.indexOf('class="energy-trainer-scale"')
  && energyTrainerRender.indexOf('class="energy-trainer-scale"') < energyTrainerRender.indexOf("manualEnergyTrainerNextCycleMarkup(nextCycle)"),
  "Energy Trainer must render Pokemon, then tiles/threshold scale, then Next Cycle."
);
assert.match(html, /function manualActionUnavailableReason/);
assert.match(html, /a shield decision is pending/);
assert.match(html, /cooldown active for/);
assert.match(html, /not enough energy/);
assert.match(html, /function timelineEditorMoveLabel/);
assert.match(html, /class="timeline-token-label"/);
assert.match(html, /class="app-wordmark">PvP <small>Simulator<\/small>/);
assert.match(html, /--timeline-side-zone-width: 74px/);
assert.match(html, /\.key-numbers\s*\{[\s\S]{0,90}width: min\(100%, var\(--battle-layout-width\)\)/);
assert.match(html, /\.log-panel\s*\{[\s\S]{0,90}width: min\(100%, var\(--battle-layout-width\)\)/);
assert.match(html, /body\.manual-mode-active \.timeline-label img\s*\{[\s\S]{0,80}width: 42px/);
assert.match(html, /const tokenWidth = size/);
assert.doesNotMatch(html, /timeline-block fast[\s\S]{0,300}<span class="timeline-token-label">/);
assert.match(html, /Registration Turn:/);
assert.match(html, /Resolution Turn:/);
assert.match(html, /Pending Events:/);
assert.match(html, /HP: \$\{Number\(event\.hpBefore\)\}/);
assert.match(html, /function updateManualTimelineEventMenu/);
assert.match(html, /function createManualAlternativeFromSelected/);
assert.match(html, /COMMAND_TYPE\.CREATE_BRANCH/);
assert.match(html, /function automaticManualBranchLabel/);
assert.match(html, /function uniqueManualBranchLabel/);
assert.match(html, /Before" : "After"\} Turn/);
assert.match(html, /id="manualGuideOpen"/);
assert.match(html, /id="manualGuideModal"/);
assert.match(html, /Manual Mode Guide/);
assert.match(html, /function openManualGuide/);
assert.match(html, /function keepLatestManualTimelineEventVisible/);
assert.match(html, /manual-event-focus/);
assert.match(html, /BATTLE COMPLETE/);
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
assert.match(html, /function restartManualTimeline/);
assert.match(html, /Restart this Manual Mode timeline from the beginning/);
assert.match(html, /Timeline:/);
assert.match(html, /id="manualHudShieldControlA"/);
assert.match(html, /id="manualHudShieldControlB"/);
assert.match(html, /id="manualMobileShieldSetup"/);
assert.match(html, /id="manualMobileShieldControlA"/);
assert.match(html, /id="manualMobileShieldControlB"/);
assert.match(html, /function renderManualHudShieldControl/);
assert.match(html, /function setManualStartingShieldCount/);
assert.match(html, /data-manual-shields/);
assert.match(html, /class="manual-hud-hp"><i id="manualHudHpA"><\/i><span id="manualHudHpTextA"/);
assert.match(html, /class="manual-hud-hp"><i id="manualHudHpB"><\/i><span id="manualHudHpTextB"/);
assert.match(html, /function handleManualActionDamagePreviewOver/);
assert.match(html, /data-manual-preview-prefix/);
assert.match(html, /manual-hud-hp\.damage-preview::after/);
assert.match(html, /manual-hud-center::before/);
assert.match(html, /grid-template-columns: minmax\(0, 1fr\) 48px minmax\(0, 1fr\)/);
assert.match(html, /manual-hud-copy \{ display: contents; \}/);
assert.match(html, /manual-hud-hp \{\s*grid-column: 1 \/ -1;/);
assert.match(html, /manual-hud-resource-row \{\s*grid-column: 1 \/ -1;/);
assert.doesNotMatch(html, /setShieldCount\(prefix, count\);\s*await restartManualTimeline/);
assert.match(html, /steps = runAutomaticBattleToEnd\(1000\)/);
assert.match(html, /startTimelineReplayFromTurn\(replayStartTurn, timelineStart\)/);
assert.match(html, /function setTimelineReplayRangeProgress/);
assert.match(html, /The original simulation remains unchanged/);
assert.match(html, /actionType: "RESUME_AUTO"/);
assert.match(html, /function timelineMoveSummary/);
assert.match(html, /timelineTooltipSummaryHtml\(timelineMoveSummary\(event, isSwipe\)\)/);
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
assert.match(html, /\? "unchanged"[\s\S]{0,180}\? `comparison \$\{branch\.comparisonSlot\}`[\s\S]{0,80}: "your changes"/);
assert.doesNotMatch(html, /moves from external service|external planner policy/i);
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
assert.match(html, /const result = await runtime\.executePrepared\(preparedManual\);[\s\S]{0,420}captureManualEnergyTrainerNextCycle/);
assert.match(html, /async function executeLiveManualCharge[\s\S]{0,2600}captureManualEnergyTrainerNextCycle/);
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
assert.match(html, /function resetBattleStateFromSetup\(\)\s*\{\s*clearManualEnergyTrainerNextCycle\(\)/);
assert.match(html, /function restoreManualRuntimePayload[\s\S]{0,180}clearManualEnergyTrainerNextCycle\(\)/);
assert.match(html, /function restoreActiveManualBranch[\s\S]{0,220}clearManualEnergyTrainerNextCycle\(\)/);
assert.match(html, /function restoreActiveManualBranch[\s\S]{0,800}if \(active\.runtimeState\)[\s\S]{0,140}restoreManualRuntimePayload\(active\.runtimeState, events\)/, "Branch switching must restore the runtime owned by that branch before falling back to shared snapshots.");
assert.match(html, /async function executeLiveManualFast[\s\S]{0,900}const canonicalResolutionCommitted = timeline\.length > timelineLengthBeforeRequest;[\s\S]{0,160}if \(!result\.ok && !canonicalResolutionCommitted\)/, "A terminal Fast resolution that mutates the canonical timeline must still be committed to its branch.");
assert.match(html, /async function executeLiveManualFast[\s\S]{0,1800}syncManualBranchAfterAction\(result\.action \|\| \{/, "A terminal Fast resolution must persist its branch even when the runtime has no successful action envelope.");
assert.match(html, /function exitLiveManualMode\(\)\s*\{\s*clearManualEnergyTrainerNextCycle\(\)/);
assert.match(html, /function openStoredManualScenario[\s\S]{0,180}clearManualEnergyTrainerNextCycle\(\)/);
assert.match(html, /function manualTechnicalIssuesMarkup/);
assert.match(html, /Technical Issues/);
assert.match(html, /data-manual-technical-issue="one-turn-lag"/);
assert.match(html, /data-manual-technical-issue="dre"/);
assert.match(html, /data-manual-dre-comparison>Compare with\/without DRE</, "A valid DRE window must expose the comparison shortcut.");
assert.match(html, /function manualDreComparisonShortcutEligibleEventIndexes\(\)[\s\S]{0,700}manualTechnicalEligibleEventIndexes\(dreType\)/, "The shortcut must reuse canonical DRE eligibility.");
assert.match(html, /function createManualDreComparisonShortcut\(\)[\s\S]{0,1000}branchALabel: "Normal Resolution"[\s\S]{0,120}branchBLabel: "DRE Resolution"/, "The shortcut must create the named normal and DRE branches.");
assert.match(html, /function createManualDreComparisonShortcut\(\)[\s\S]{0,1300}setTechnicalReviewMode\(window\.PvPeakTechnicalReview\.ISSUE_TYPES\.DRE/, "The DRE branch must enter the existing reconstruction selection flow.");
assert.match(html, /function createManualScenarioComparisonFromCurrent\(options = \{\}\)[\s\S]{0,2600}COMMAND_TYPE\.CREATE_COMPARISON/, "Generic and DRE comparison creation must share the atomic comparison command.");
assert.match(html, /const runtimeState = active[\s\S]{0,220}branch\.runtimeState \|\| previousBranch\?\.runtimeState \|\| manualRuntimeSnapshotForBranch\(branch\)/, "An inactive comparison outcome must retain its own canonical runtime while the other branch rewinds.");
assert.match(html, /const sourceBranch = manualBranchRegistry\?\.branches\?\.\[sourceBranchId\][\s\S]{0,1200}sourceBranch\?\.comparisonId[\s\S]{0,500}COMMAND_TYPE\.UPDATE_BRANCH/, "Technical reconstruction inside a comparison must update its existing branch.");
assert.match(html, /Select the Fast Move affected by the one-turn lag\./);
assert.match(html, /Select the Fast Move that created the DRE window\./);
assert.match(html, /function manualTechnicalEligibleEventIndexes/);
assert.match(html, /No valid DRE target in this segment\./);
assert.match(html, /data-technical-target-label/);
assert.match(html, /DRE target/);
assert.match(html, /function cancelTechnicalIssueSelection/);
assert.match(html, /function confirmManualTechnicalIssue/);
assert.match(html, /restoreManualRuntimePayload\(plan\.runtimeState, plan\.immutablePrefix\)[\s\S]{0,420}rebuildManualModeStateForBranch\(sourceBranch\)/, "Technical reconstruction must leave an observed terminal branch through the restored canonical decision state.");
assert.match(html, /kind: "technical-lag"/);
assert.match(html, /kind: "technical-dre"/);
assert.match(html, /manualChoiceRequired: true/);
assert.match(html, /function resolveManualTechnicalDreCharge/);
assert.match(html, /manualModeState = window\.PvPeakManualMode\.beginResolution\(manualModeState\);/);
assert.match(html, /const chargeTimelineStart = timeline\.length;/);
assert.match(html, /timeline\.slice\(chargeTimelineStart\)\.find\(event => \(/);
assert.match(html, /if \(!chargedEvent\) throw new Error\("DRE_CHARGED_REJECTED"\);/);
assert.match(html, /function restoreManualRuntimePayload[\s\S]{0,2400}return true;/);
assert.match(html, /event\.key !== "Escape" \|\| document\.body\.dataset\.view !== "scenario-review"/);

const inlineScripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
assert(inlineScripts.length, "Expected the simulator inline runtime.");
assert.doesNotThrow(() => new Function(inlineScripts.at(-1)), "The simulator runtime must remain syntactically valid.");

console.log("Manual Mode UI contract tests passed.");
