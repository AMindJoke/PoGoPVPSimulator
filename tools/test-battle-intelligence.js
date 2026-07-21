"use strict";

const assert = require("assert");
const TurnEngine = require("../src/battle/turn-resolution-engine");
const Intelligence = require("../src/battle/battle-intelligence");

function move(id, energyCost, damage, extra = {}) {
  return { id, name: id, energyCost, damage, ...extra };
}

function state(overrides = {}) {
  return TurnEngine.createState({
    currentTurn: overrides.currentTurn ?? 5,
    sides: {
      A: {
        id: "attacker",
        hp: overrides.hpA ?? 40,
        energy: overrides.energyA ?? 40,
        attack: overrides.attackA ?? 120,
        readyTurn: overrides.readyA ?? 5,
        fastMove: move("FAST_A", 0, 4, { turns: 2, energyGain: 8 }),
        chargedMoves: overrides.chargedA || [move("CHEAP", 35, 50), move("NUKE", 55, 90)]
      },
      B: {
        id: "defender",
        hp: overrides.hpB ?? 100,
        energy: overrides.energyB ?? 0,
        attack: overrides.attackB ?? 100,
        readyTurn: overrides.readyB ?? 7,
        fastMove: move("FAST_B", 0, 10, { turns: 3, energyGain: 8 }),
        chargedMoves: overrides.chargedB || [move("REPLY", 35, 60)]
      }
    },
    pendingEvents: overrides.pendingEvents || []
  });
}

function select(currentState, overrides = {}) {
  const legalActions = TurnEngine.getLegalActions(currentState, "A");
  return Intelligence.selectAction({
    state: currentState,
    side: "A",
    legalActions,
    policy: overrides.policy || "FAST",
    context: {
      estimateDamage: action => Number(action.move?.damage || 0),
      willOpponentShield: () => !!overrides.shielded,
      hasGuaranteedEffect: action => Number(action.move?.buffApplyChance || 0) >= 1,
      opponentLethalBeforeNextWindow: !!overrides.opponentLethalBeforeNextWindow,
      legacySelect: actions => overrides.legacySelect
        ? overrides.legacySelect(actions)
        : { moveId: actions.find(action => action.type === "charged_move")?.moveId, type: "charged_move", reason: "fixture adapter" },
      legacySelectCharged: actions => overrides.legacySelectCharged
        ? overrides.legacySelectCharged(actions)
        : { moveId: actions.find(action => action.type === "charged_move")?.moveId, type: "charged_move", reason: "fixture charged adapter" },
      evaluateContinuation: overrides.evaluateContinuation
    }
  });
}

Intelligence.clearCache();
Intelligence.resetStatistics();

const fastOnlyState = state({ energyA: 0 });
const fastOnly = select(fastOnlyState);
assert.equal(fastOnly.action.type, "fast_move");
assert.equal(fastOnly.fastPath, true);

const lethalState = state({ hpB: 45, energyA: 60 });
const lethal = select(lethalState);
assert.equal(lethal.action.moveId, "CHEAP");
assert(lethal.sourceRuleIds.includes("BI_GUARANTEED_LETHAL"));
assert(lethal.reasonCodes.includes("LETHAL_MOVE_AVAILABLE"));

const pending = TurnEngine.createFastImpactEvent({
  id: "lagged-fast",
  sourceSide: "B",
  targetSide: "A",
  moveId: "FAST_B",
  damage: 40,
  startTurn: 4,
  duration: 3,
  source: "one-turn-lag"
});
const lagState = state({ energyA: 40, pendingEvents: [pending] });
const lagDecision = select(lagState, {
  legacySelectCharged: actions => ({ moveId: actions.find(action => action.moveId === "CHEAP").moveId, type: "charged_move" })
});
assert.equal(lagDecision.action.moveId, "CHEAP");
assert(lagDecision.sourceRuleIds.includes("BI_THROW_BEFORE_FAINT"));

const noLagUnreachable = state({ energyA: 30, pendingEvents: [] });
assert.deepEqual(TurnEngine.getLegalActions(noLagUnreachable, "A").map(action => action.type), ["fast"]);
assert.equal(select(noLagUnreachable).action.type, "fast_move");
assert.notEqual(Intelligence.strategicStateKey(lagState), Intelligence.strategicStateKey(noLagUnreachable));

const cheaperReachable = state({ energyA: 40, pendingEvents: [pending] });
const cheaperDecision = select(cheaperReachable);
assert.equal(cheaperDecision.action.moveId, "CHEAP");
assert(!TurnEngine.getLegalActions(cheaperReachable, "A").some(action => action.moveId === "NUKE"));

const overfarmDanger = select(state({ energyA: 40 }), {
  opponentLethalBeforeNextWindow: true,
  legacySelectCharged: actions => ({ moveId: actions[0].moveId, type: "charged_move" })
});
assert.equal(overfarmDanger.action.type, "charged_move");
assert(overfarmDanger.sourceRuleIds.includes("BI_AVOID_LETHAL_OVERFARM"));

const weak = move("WEAK", 40, 30);
const strong = move("STRONG", 40, 55);
const dominatedState = state({ energyA: 40, chargedA: [weak, strong] });
const dominatedCandidates = TurnEngine.getLegalActions(dominatedState, "A")
  .map(action => Intelligence.createCandidate(Intelligence.normalizeAction(action, "A")));
const pruned = Intelligence.pruneDominatedCandidates(dominatedCandidates, {
  estimateDamage: action => action.move.damage,
  hasGuaranteedEffect: () => false
});
assert(!pruned.some(candidate => candidate.action.moveId === "WEAK"));
assert(pruned.some(candidate => candidate.action.moveId === "STRONG"));

const buff = move("BUFF", 40, 20, { buffApplyChance: 1, buffs: [0, 1] });
const direct = move("DIRECT", 40, 45);
const effectState = state({ energyA: 40, chargedA: [buff, direct] });
const effectDecision = select(effectState, {
  policy: "STANDARD",
  evaluateContinuation: action => ({ score: action.moveId === "BUFF" ? 800 : 600, evaluatedStates: 4 })
});
assert.equal(effectDecision.action.moveId, "BUFF");
assert(effectDecision.sourceRuleIds.includes("BI_GUARANTEED_EFFECT"));

const secondBuff = move("SECOND_BUFF", 40, 25, { buffApplyChance: 1, buffs: [-1, 0] });
const budgetState = state({ energyA: 40, chargedA: [buff, secondBuff] });
const budgetFallback = select(budgetState, {
  policy: "FAST",
  evaluateContinuation: () => null,
  legacySelect: actions => ({ moveId: actions.find(action => action.type === "charged_move").moveId, type: "charged_move", reason: "deterministic budget fallback" })
});
assert.equal(budgetFallback.action.moveId, "BUFF");
assert(budgetFallback.sourceRuleIds.includes("BI_LEGACY_ADAPTER"));

const tacticalState = state({ energyA: 60 });
const tacticalActions = TurnEngine.getLegalActions(tacticalState, "A");
const tacticalDecision = Intelligence.selectAction({
  state: tacticalState,
  side: "A",
  legalActions: tacticalActions,
  policy: "FAST",
  context: {
    estimateDamage: action => Number(action.move?.damage || 0),
    tacticalAdvice: {
      type: Intelligence.ACTION_TYPES.CHARGED_MOVE,
      moveId: "NUKE",
      reason: "Projected continuation favors the nuke.",
      reasonCode: "BETTER_PROJECTED_OUTCOME",
      confidence: .91
    }
  }
});
assert.equal(tacticalDecision.action.moveId, "NUKE");
assert(tacticalDecision.sourceRuleIds.includes("BI_TACTICAL_PLAN"));
assert.equal(tacticalDecision.evidence.tacticalAdvice.moveId, "NUKE");

const alwaysShield = Intelligence.selectShieldAction({
  policy: "always",
  state: { shields: 1, chargedTaken: 0, hp: 100, maxHp: 100 },
  threat: { damage: 10, energyCost: 35 }
});
assert.equal(alwaysShield.shield, true);
assert(alwaysShield.sourceRuleIds.includes("BI_SHIELD_POLICY"));

const noFirstShield = Intelligence.selectShieldAction({
  policy: "no-first",
  state: { shields: 1, chargedTaken: 0, hp: 100, maxHp: 100 },
  threat: { damage: 100, energyCost: 55 }
});
assert.equal(noFirstShield.shield, false);

const smartKoShield = Intelligence.selectShieldAction({
  policy: "smart",
  state: { shields: 1, chargedTaken: 1, hp: 40, maxHp: 100 },
  threat: { damage: 40, energyCost: 35 }
});
assert.equal(smartKoShield.shield, true);
assert(smartKoShield.reasonCodes.includes("SHIELD_PREVENTS_KO"));

const smartCounterfactual = Intelligence.selectShieldAction({
  policy: "smart",
  state: { shields: 1, chargedTaken: 1, hp: 80, maxHp: 100 },
  threat: { damage: 20, energyCost: 35 },
  counterfactual: { outcomeWithShield: "loss", outcomeWithoutShield: "win" }
});
assert.equal(smartCounterfactual.shield, false);
assert(smartCounterfactual.reasonCodes.includes("SHIELD_PRESERVES_WIN_CONDITION"));

for (const policy of ["FAST", "STANDARD", "DEEP_REVIEW"]) {
  assert.equal(select(lethalState, { policy }).action.moveId, "CHEAP");
}

assert.equal(Intelligence.resolvePolicy("FAST").maxDepth, 1);
assert(Intelligence.resolvePolicy("DEEP_REVIEW").maxStates > Intelligence.resolvePolicy("STANDARD").maxStates);
assert.deepEqual(TurnEngine.orderReadySides(state({ readyB: 5, energyB: 40, attackA: 130, attackB: 110 })), ["A", "B"]);

Intelligence.clearCache();
Intelligence.resetStatistics();
const repeatState = state({ hpB: 45, energyA: 60 });
const first = select(repeatState);
const second = select(repeatState);
assert.equal(first.action.moveId, second.action.moveId);
assert(second.reasonCodes.includes("MEMOIZED_RESULT"));
assert.equal(Intelligence.getStatistics().cacheHits, 1);

const changedTiming = state({ hpB: 45, energyA: 60, currentTurn: 6 });
select(changedTiming);
assert.equal(Intelligence.getStatistics().cacheMisses, 2);

Intelligence.clearCache();
Intelligence.resetAudit();
Intelligence.configureAudit({ enabled: true, strict: false, retainEvents: true });
const auditedLethal = Intelligence.selectAction({
  state: lethalState,
  side: "A",
  legalActions: TurnEngine.getLegalActions(lethalState, "A"),
  policy: "FAST",
  context: {
    callerContext: "battle",
    estimateDamage: action => Number(action.move?.damage || 0),
    willOpponentShield: () => false
  }
});
assert.equal(auditedLethal.source, "battle-intelligence");
assert(auditedLethal.decisionCategories.includes("guaranteed-lethal"));

const auditedTactical = Intelligence.selectAction({
  state: tacticalState,
  side: "A",
  legalActions: tacticalActions,
  policy: "FAST",
  context: {
    callerContext: "matrix",
    estimateDamage: action => Number(action.move?.damage || 0),
    tacticalAdvice: { type: Intelligence.ACTION_TYPES.CHARGED_MOVE, moveId: "NUKE", reason: "bait continuation", confidence: .9 }
  }
});
assert.equal(auditedTactical.source, "legacy-fallback");
assert.equal(auditedTactical.fallbackReasonCode, "LEGACY_CONTINUATION_NOT_MIGRATED");
const auditReport = Intelligence.getAuditReport();
assert.equal(auditReport.totalDecisions, 2);
assert.equal(auditReport.battleIntelligenceDecisions, 1);
assert.equal(auditReport.legacyFallbackDecisions, 1);
assert.equal(auditReport.byContext.matrix.legacyFallback, 1);
assert.equal(auditReport.fallbackRate, .5);
assert.equal(auditReport.intelligenceOwnedDecisions, 1);
assert.equal(auditReport.bypassedStrategicDecisions, 1);
assert.equal(auditReport.runtimeCoverage, .5);

Intelligence.configureAudit({ strict: true });
assert.throws(() => Intelligence.selectAction({
  state: tacticalState,
  side: "A",
  legalActions: tacticalActions,
  policy: "FAST",
  context: {
    callerContext: "scenario-review",
    estimateDamage: action => Number(action.move?.damage || 0),
    tacticalAdvice: { type: Intelligence.ACTION_TYPES.CHARGED_MOVE, moveId: "NUKE", reason: "legacy continuation" }
  }
}), error => error && error.code === "LEGACY_CONTINUATION_NOT_MIGRATED");
Intelligence.configureAudit({ enabled: false, strict: false, retainEvents: false });

console.log("Battle Intelligence tests passed.");
