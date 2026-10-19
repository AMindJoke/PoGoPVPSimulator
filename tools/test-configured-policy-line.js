"use strict";

const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");
const Audit = require("./audit-planner-alternatives");
const Mechanics = require("./audit-automatic-battle");
const Reliability = require("../src/reliability/battle-reliability");

const runtime = R.createRuntime();
const source = G.extractLiveWorkerSource();
const worker = G.createWorkerAdapter(Audit.instrument(source), { dreStandard: true, strict: true });
const plain = G.createWorkerAdapter(source, { dreStandard: true, strict: true });
let sequence = 0;
let checked = 0;

function payload(a, b) {
  const config = G.createBattleConfig(runtime.pokemonMap.get(a), runtime.pokemonMap.get(b),
    G.DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
  config.left.shieldMode = config.right.shieldMode = "smart";
  return { key: `${a}/${b}/smart/1s`, config, aShields: 1, bShields: 1,
    trace: true, debugTimeline: true, includeSwing: false };
}

function simulate(request, auditTarget = null, adapter = worker) {
  const result = adapter.simulate({ ...request, id: ++sequence, auditTarget });
  assert.deepEqual(Reliability.validateTrace(result.decisionTrace), [], request.key);
  return result;
}

const ledger = result => JSON.stringify({ finalState: result.decisionTrace.finalState, events: result.timelineTrace });
const policy = alternative => alternative.responses.find(response => response.responseId === "policy");
function decisionAt(result, side, turn, type) {
  const decision = result.decisionTrace.decisions.find(item => item.side === side && item.turn === turn
    && (!type || item.decisionType === type));
  assert(decision, `Require an actual ${type || "action"} decision for ${side} at T${turn}.`);
  return decision;
}

function verifyActualShield(result, turn, moveId, shielded) {
  const decision = decisionAt(result, "B", turn, "shield-decision");
  const forecast = decision.counterfactual;
  assert.equal(decision.finalAction.type, shielded ? "shield" : "no_shield");
  assert.equal(decision.fallbackUsed, false, "The configured Smart choice must use its completed forecast.");
  assert.equal(decision.finalAuthority, "PRINCIPLE_ENGINE");
  assert.equal(decision.reasonCode, "SHIELD_PRESERVES_WIN_CONDITION");
  assert.equal(forecast?.complete, true, "The actual live root must complete both shield continuations.");
  assert.equal(forecast.moveId, moveId, "Forecast the actual prepared attack rather than a newly planned move.");
  assert.equal(forecast.shieldMode, "smart");
  assert.equal(forecast.shielded, shielded);
  assert.equal(forecast.withShield.complete, true);
  assert.equal(forecast.withoutShield.complete, true);
  assert.equal(forecast.outcomeWithShield, shielded ? "win" : "loss");
  assert.equal(forecast.outcomeWithoutShield, shielded ? "loss" : "win");
  const charge = result.timelineTrace.find(event => event.trainer === "A" && event.start === turn && event.kind === "charge");
  assert.equal(charge?.moveId, moveId);
  assert(shielded ? charge.damage === 1 : charge.damage > 1,
    "The actual damage ledger must apply the configured Smart shield decision.");
}

const selfBuffRequest = payload("skeledirge", "azumarill");
const selfBuff = simulate(selfBuffRequest);
assert.equal(ledger(selfBuff), ledger(simulate(selfBuffRequest, null, plain)),
  "Observational audit hooks must preserve the ordinary battle.");
const timing = decisionAt(selfBuff, "A", 15);
const timingComparison = timing.principleResult?.evidence?.timingComparison;
assert.equal(timing.finalAction.type, "fast_move");
assert.equal(timing.finalAction.moveId, "INCINERATE");
assert.equal(timingComparison?.complete, true);
assert.equal(timingComparison.reason, "ORIGINAL_CHOICE_RETAINED");
assert.equal(timingComparison.actionChanged, false);
const extraFast = timingComparison.alternatives.find(alternative => alternative.action.type === "fast_move");
const immediateBuff = timingComparison.alternatives.find(alternative => alternative.action.moveId === "TORCH_SONG");
assert(extraFast && immediateBuff, "Compare the extra Fast against the affordable self-buff.");
assert.equal(policy(extraFast).outcome, 0);
assert.equal(policy(immediateBuff).outcome, 0);
const forcedShieldBuff = immediateBuff.responses.find(response => response.responseId === "shield");
assert.equal(forcedShieldBuff?.outcome, 2, "Keep the off-policy win visible as diagnostic evidence.");
assert.equal(forcedShieldBuff.shieldResponseApplied, true);
assert.equal(timingComparison.id, extraFast.id,
  "A win that requires overriding Smart Shield must not break the configured-policy tie.");
// The bounded projections keep later strategy fixed; the real battle can
// reconsider timing at later windows. This fixture does not claim optimal play.
assert.equal(selfBuff.details.outcome, "A", "Preserve the actual winning adaptive line after retaining the T15 Fast.");
const firstBuff = selfBuff.timelineTrace.find(event => event.trainer === "A" && event.kind === "charge");
assert.equal(firstBuff?.moveId, "TORCH_SONG");
assert(firstBuff.start > 15, "The winning live line must not silently replace the retained T15 Fast with a Charged Move.");
checked++;

for (const [opponent, turn] of [["quagsire_shadow", 20], ["guzzlord", 15]]) {
  const request = payload("talonflame", opponent);
  const normal = simulate(request);
  assert.equal(ledger(normal), ledger(simulate(request, null, plain)), request.key);
  assert.equal(normal.details.outcome, "B", "Verify this concrete configured-policy outcome without claiming the losing line is optimal.");
  const root = decisionAt(normal, "A", turn, "charged-move-selection");
  assert.equal(root.finalAction.moveId, "BRAVE_BIRD");
  const comparison = root.principleResult?.evidence?.compact?.postProcessing?.chargedComparison;
  assert.equal(comparison?.complete, true);
  assert.equal(comparison.reason, "ORIGINAL_CHOICE_RETAINED");
  const bird = comparison.alternatives.find(alternative => alternative.moveId === "BRAVE_BIRD");
  const fly = comparison.alternatives.find(alternative => alternative.moveId === "FLY");
  assert(bird && fly);
  assert.equal(policy(bird).outcome, 0);
  assert.equal(policy(fly).outcome, 0);
  assert.equal(fly.responses.find(response => response.responseId === "shield")?.outcome, 2,
    "Expose the misleading Fly win when the opponent is forced to shield.");
  verifyActualShield(normal, turn, "BRAVE_BIRD", true);

  const node = normal.alternativeAudit.nodes.find(item => item.kind === "action" && item.side === "A" && item.turn === turn);
  assert(node?.legal.some(action => action.type === "charged_move" && action.moveId === "FLY"),
    "Fly must be a legal alternative at the same decision window.");
  const forced = simulate(request, { index: node.index, type: "charged_move", moveId: "FLY" });
  assert.equal(JSON.stringify(forced.alternativeAudit.nodes.slice(0, node.index + 1)),
    JSON.stringify(normal.alternativeAudit.nodes.slice(0, node.index + 1)),
    "Preserve the complete battle and prepared decision prefix before forcing Fly.");
  assert.equal(forced.alternativeAudit.applied.length, 1);
  assert.equal(forced.alternativeAudit.applied[0].moveId, "FLY");
  assert.equal(forced.details.outcome, "B",
    "Actual Smart Shield must reproduce the losing Fly continuation instead of shielding it through a replan fallback.");
  verifyActualShield(forced, turn, "FLY", false);
  assert.equal(ledger(simulate(request)), ledger(normal), "A forced diagnostic opener must not alter a later ordinary battle.");
  checked++;
}

const reportedCases = Mechanics.buildCases(runtime);
for (const [shields, turn] of [[0, 12], [1, 23]]) {
  const item = reportedCases.find(test => test.id === `reported-rosters--florges--florges--${shields}s`);
  assert(item, "Use the reported custom IV/moveset mirror instead of a different default build.");
  const request = { key: item.id, config: item.config, aShields: shields, bShields: shields,
    trace: true, debugTimeline: true, includeSwing: false };
  const result = simulate(request);
  assert.equal(result.details.outcome, "A", "Preserve the custom Florges mirror win.");
  const decision = decisionAt(result, "A", turn, "charged-move-selection");
  const comparison = decision.principleResult?.evidence?.compact?.postProcessing?.chargedComparison;
  assert.equal(comparison?.complete, true);
  assert.equal(comparison.reason, "ROBUST_WIN_PRESERVED");
  assert.equal(decision.finalAction.moveId, "CHILLING_WATER");
  assert.equal(comparison.originalMoveId, "MOONBLAST");
  const moonblast = comparison.alternatives.find(alternative => alternative.moveId === "MOONBLAST");
  const water = comparison.alternatives.find(alternative => alternative.moveId === "CHILLING_WATER");
  assert(moonblast && water);
  assert.equal(policy(moonblast).outcome, 2);
  assert.equal(policy(water).outcome, 2);
  const replyId = "reply:CHILLING_WATER";
  const originalReply = moonblast.responses.find(response => response.responseId === replyId);
  const improvedReply = water.responses.find(response => response.responseId === replyId);
  assert.equal(originalReply?.outcome, 0);
  assert.equal(improvedReply?.outcome, 2);
  assert.equal(improvedReply.opponentAction?.moveId, "CHILLING_WATER");
  assert(water.responses.every(response => response.outcome >= moonblast.responses
    .find(original => original.responseId === response.responseId).outcome),
  "Protect an already projected win only through response-wise dominance.");
  const legalReply = result.alternativeAudit.nodes.find(node => node.kind === "action" && node.side === "B" && node.turn === turn);
  assert(legalReply?.legal.some(action => action.type === "charged_move" && action.moveId === "CHILLING_WATER"),
    "The alternative opponent reply must be genuinely legal at this decision window.");
  const node = result.alternativeAudit.nodes.find(node => node.kind === "action" && node.side === "A" && node.turn === turn);
  assert(node?.legal.some(action => action.moveId === "MOONBLAST"));
  const forcedMoonblast = simulate(request, { index: node.index, type: "charged_move", moveId: "MOONBLAST" });
  assert.equal(JSON.stringify(forcedMoonblast.alternativeAudit.nodes.slice(0, node.index + 1)),
    JSON.stringify(result.alternativeAudit.nodes.slice(0, node.index + 1)),
    "The Moonblast counterexample must use the same actual battle prefix.");
  assert.equal(forcedMoonblast.details.outcome, "B",
    "The original Moonblast opener must not silently count as preserving this actual mirror win.");
  checked++;
}

const shadowRequest = payload("talonflame_shadow", "corsola_galarian");
const shadow = simulate(shadowRequest);
assert.equal(shadow.details.outcome, "B");
assert.equal(decisionAt(shadow, "A", 15).finalAction.type, "fast_move");
const shadowNode = shadow.alternativeAudit.nodes.find(node => node.kind === "action" && node.side === "A" && node.turn === 15);
assert(shadowNode?.legal.some(action => action.moveId === "FLAME_CHARGE"));
const forcedFlameCharge = simulate(shadowRequest, { index: shadowNode.index, type: "charged_move", moveId: "FLAME_CHARGE" });
assert.equal(JSON.stringify(forcedFlameCharge.alternativeAudit.nodes.slice(0, shadowNode.index + 1)),
  JSON.stringify(shadow.alternativeAudit.nodes.slice(0, shadowNode.index + 1)),
  "The historical Flame Charge opener must be tested from the same live prefix.");
assert.equal(forcedFlameCharge.details.outcome, "B",
  "The older Flame Charge opener also loses when the configured Smart policy faithfully saves its shield.");
verifyActualShield(forcedFlameCharge, 15, "FLAME_CHARGE", false);
checked++;

console.log(`Configured policy line passed: ${checked} concrete scenarios, configured-outcome priority, win protection and Smart Shield counterexamples.`);
