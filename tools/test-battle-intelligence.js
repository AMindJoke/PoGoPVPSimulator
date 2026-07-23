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
      evaluateCandidate: overrides.evaluateCandidate,
      evaluateContinuation: overrides.evaluateContinuation,
      evaluateHybrid: overrides.evaluateHybrid,
      chargedTimingOptimization: overrides.chargedTimingOptimization,
      estimateFastDamage: overrides.estimateFastDamage,
      estimateOpponentDamage: overrides.estimateOpponentDamage,
      compactDamage: overrides.compactDamage,
      compactSurvivalProjection: overrides.compactSurvivalProjection,
      compactCmpAdvantage: overrides.compactCmpAdvantage,
      matchupPlannerV2: overrides.matchupPlannerV2,
      planMatchup: overrides.planMatchup
    }
  });
}

Intelligence.clearCache();
Intelligence.resetStatistics();

const fastOnlyState = state({ energyA: 0 });
const fastOnly = select(fastOnlyState);
assert.equal(fastOnly.action.type, "fast_move");
assert.equal(fastOnly.fastPath, true);
assert.equal(fastOnly.principleResolved, true);
assert.equal(fastOnly.finalAuthority, "PRINCIPLE_ENGINE");
assert(fastOnly.principlesTriggered.includes("AVAIL-002_CHEAPEST_CHARGED_NOT_AFFORDABLE"));
assert.equal(fastOnly.fallbackUsed, false);

const noActiveChargedState = state({ energyA: 0, chargedA: [] });
let availabilityHybridCalls = 0;
const noActiveCharged = select(noActiveChargedState, {
  evaluateHybrid() {
    availabilityHybridCalls++;
    throw new Error("Hybrid must not run for principle-resolved availability.");
  }
});
assert.equal(noActiveCharged.action.type, "fast_move");
assert(noActiveCharged.principlesTriggered.includes("AVAIL-001_NO_ACTIVE_CHARGED_MOVE"));
assert.equal(availabilityHybridCalls, 0);

const lethalState = state({ hpB: 45, energyA: 60 });
let lethalHybridCalls = 0;
const lethal = select(lethalState, {
  evaluateHybrid() {
    lethalHybridCalls++;
    throw new Error("Hybrid must not run for principle-selected immediate lethal.");
  }
});
assert.equal(lethal.action.moveId, "CHEAP");
assert(lethal.sourceRuleIds.includes("BI_GUARANTEED_LETHAL"));
assert(lethal.reasonCodes.includes("LETHAL_MOVE_AVAILABLE"));
assert.equal(lethal.finalAuthority, "PRINCIPLE_ENGINE");
assert(lethal.principlesTriggered.includes("TACTICAL-008_IMMEDIATE_UNSHIELDED_CHARGED_LETHAL"));
assert.equal(lethalHybridCalls, 0);

Intelligence.clearCache();
const compactBreakpointState = state({
  hpA: 13,
  hpB: 43,
  energyA: 38,
  energyB: 45,
  readyA: 5,
  readyB: 7,
  chargedA: [move("CHEAP", 35, 36), move("NUKE", 45, 42)]
});
let compactHybridCalls = 0;
const compactBreakpoint = select(compactBreakpointState, {
  compactDamage: (_side, compactMove) => Number(compactMove?.damage || 0),
  compactSurvivalProjection: () => ({ turnsToFaint: 3, damageTaken: 13, opponentChargedCount: 1 }),
  compactCmpAdvantage: 10,
  evaluateHybrid() {
    compactHybridCalls++;
    throw new Error("Hybrid must not run for a principle-owned compact route.");
  }
});
assert.equal(compactBreakpoint.action.type, "fast_move");
assert.equal(compactBreakpoint.finalAuthority, "PRINCIPLE_ENGINE");
assert.equal(compactBreakpoint.fallbackUsed, false);
assert.equal(compactHybridCalls, 0);
assert(compactBreakpoint.sourceRuleIds.includes("BI_PRINCIPLE_COMPACT_ROUTE"));
assert(compactBreakpoint.principlesTriggered.includes("COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE"));
assert(compactBreakpoint.principlesTriggered.includes("COMPACT-030_ORDER_SEARCH_BY_TIME_BREAKPOINT"));
assert.equal(
  compactBreakpoint.principleResult.evidence.compactRoute.bestRoute.sequence.at(-1).moveId,
  "NUKE"
);

Intelligence.clearCache();
const twoCheapRouteState = state({
  hpA: 100,
  hpB: 100,
  energyA: 70,
  chargedA: [move("CHEAP", 35, 55), move("NUKE", 60, 90)]
});
let twoCheapHybridCalls = 0;
const twoCheapRoute = select(twoCheapRouteState, {
  compactDamage: (_side, compactMove) => Number(compactMove?.damage || 0),
  compactSurvivalProjection: () => ({ turnsToFaint: Infinity, damageTaken: 0, opponentChargedCount: 0 }),
  compactCmpAdvantage: 10,
  evaluateHybrid() {
    twoCheapHybridCalls++;
    throw new Error("Hybrid must not run when ROUTE-007 resolves the complete route value.");
  }
});
assert.equal(twoCheapRoute.action.moveId, "CHEAP");
assert.equal(twoCheapRoute.finalAuthority, "PRINCIPLE_ENGINE");
assert.equal(twoCheapHybridCalls, 0);
assert(twoCheapRoute.principlesTriggered.includes("ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE"));
assert.equal(twoCheapRoute.principleResult.evidence.twoCheapRoute.retained, true);

Intelligence.clearCache();
let unresolvedHybridCalls = 0;
const unresolvedHybrid = select(state({ energyA: 40, hpB: 120 }), {
  evaluateHybrid() {
    unresolvedHybridCalls++;
    return {
      action: { type: "charged_move", side: "A", moveId: "CHEAP", startTurn: 5 },
      decisive: true,
      fastPath: false,
      reasonCodes: ["BOUNDED_OFFENSIVE_ROUTE"]
    };
  }
});
assert.equal(unresolvedHybridCalls, 1);
assert.equal(unresolvedHybrid.action.moveId, "CHEAP");
assert.equal(unresolvedHybrid.fallbackUsed, true);
assert.equal(unresolvedHybrid.finalAuthority, "HYBRID_FALLBACK");
assert.equal(unresolvedHybrid.principleResolved, false);
assert.equal(unresolvedHybrid.principleDecisionPreserved, true);

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

const cappedEnergy = select(state({ energyA: 96, hpB: 120 }));
assert.equal(cappedEnergy.action.type, "charged_move");
assert.equal(cappedEnergy.action.moveId, "NUKE");
assert(cappedEnergy.principleIds.includes("TIMING-016_DO_NOT_WAIT_IF_ENERGY_OVERFLOWS"));
assert(!cappedEnergy.sourceRuleIds.includes("BI_HYBRID_BASELINE"));
assert.equal(cappedEnergy.principleResult.intent, "THROW_NOW");
assert.equal(cappedEnergy.finalAuthority, "PRINCIPLE_ENGINE_TIMING");

const timingPending = TurnEngine.createFastImpactEvent({
  id: "opponent-fast-in-flight",
  sourceSide: "B",
  targetSide: "A",
  moveId: "FAST_B",
  damage: 8,
  startTurn: 6,
  duration: 4,
  source: "timing-test"
});
let safeTimingHybridCalls = 0;
const safeTimingWait = select(state({
  energyA: 40,
  readyA: 5,
  readyB: 10,
  pendingEvents: [timingPending]
}), {
  chargedTimingOptimization: true,
  estimateFastDamage: () => 8,
  estimateOpponentDamage: move => Number(move?.damage || 0),
  evaluateHybrid() {
    safeTimingHybridCalls++;
    throw new Error("Hybrid timing must not run after WAIT_ONE_FAST is resolved.");
  }
});
assert.equal(safeTimingWait.action.type, "fast_move");
assert.equal(safeTimingWait.principleResult.intent, "WAIT_ONE_FAST");
assert(safeTimingWait.principlesTriggered.includes("TIMING-021_SAFE_TIMING_WAIT_MEANS_ONE_FAST_THEN_REPLAN"));
assert.equal(safeTimingWait.finalAuthority, "PRINCIPLE_ENGINE");
assert.equal(safeTimingHybridCalls, 0);

let blockedTimingOverrides = 0;
const constrainedTimingThrow = select(state({ energyA: 96, hpB: 120 }), {
  evaluateHybrid() {
    blockedTimingOverrides++;
    return {
      action: { type: "fast_move", side: "A", moveId: "FAST_A", startTurn: 5 },
      decisive: true,
      fastPath: true,
      reasonCodes: ["SAFE_EXTRA_FAST"]
    };
  }
});
assert.equal(blockedTimingOverrides, 1);
assert.equal(constrainedTimingThrow.action.type, "charged_move");
assert.equal(constrainedTimingThrow.principleResult.intent, "THROW_NOW");
assert.equal(constrainedTimingThrow.overrideBlocked, true);
assert.equal(constrainedTimingThrow.principleDecisionPreserved, true);
assert.equal(constrainedTimingThrow.fallbackUsed, true);

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
  evaluateContinuation: () => null
});
assert.equal(budgetFallback.action.moveId, "BUFF");
assert(budgetFallback.sourceRuleIds.includes("BI_CANDIDATE_EVIDENCE"));

const timingTieState = state({ energyA: 40 });
const timingTie = select(timingTieState, {
  policy: "STANDARD",
  evaluateCandidate: () => ({
    components: {},
    ruleIds: ["BI_TIMING_CONTINUATION"],
    requiresContinuationSearch: true
  }),
  evaluateContinuation: action => ({
    score: 500,
    evaluatedStates: 4,
    timingQuality: {
      score: action.type === "fast_move" ? 1 : 0,
      classification: action.type === "fast_move" ? "optimal" : "alignment"
    }
  })
});
assert.equal(timingTie.action.type, "fast_move", "Equal continuations should prefer the action that produces better Charged Move timing.");

const tacticalState = state({ energyA: 60 });
const tacticalActions = TurnEngine.getLegalActions(tacticalState, "A");
const tacticalDecision = Intelligence.selectAction({
  state: tacticalState,
  side: "A",
  legalActions: tacticalActions,
  policy: "FAST",
  context: {
    estimateDamage: action => Number(action.move?.damage || 0),
    evaluateCandidate: action => ({
      components: { futureDamage: action.moveId === "NUKE" ? 500 : 0 },
      reasons: action.moveId === "NUKE" ? ["highest future damage"] : []
    })
  }
});
assert.equal(tacticalDecision.action.moveId, "NUKE");
assert(tacticalDecision.sourceRuleIds.includes("BI_CANDIDATE_EVIDENCE"));
assert.equal(tacticalDecision.evidence.candidateEvaluation.components.futureDamage, 500);

Intelligence.clearCache();
const plannedDecision = select(tacticalState, {
  matchupPlannerV2: true,
  planMatchup: ({ legalActions }) => ({
    selectedAction: legalActions.find(action => action.moveId === "CHEAP"),
    incompleteHorizon: false,
    principalLine: { completeness: "complete", actions: [legalActions.find(action => action.moveId === "CHEAP")] },
    confidence: .96,
    outcomeClass: "win",
    reasonCodes: ["MP_PROVEN_WIN"],
    explanation: "The cheaper move starts the only proven winning line."
  })
});
assert.equal(plannedDecision.action.moveId, "CHEAP");
assert(plannedDecision.sourceRuleIds.includes("BI_MATCHUP_PLAN"));

const boundedPlanDecision = select(tacticalState, {
  matchupPlannerV2: true,
  planMatchup({ legalActions }) {
    const cheap = legalActions.find(action => action.moveId === "CHEAP");
    return {
      selectedAction: cheap,
      incompleteHorizon: true,
      principalLine: { completeness: "bounded", actions: [cheap] },
      reasonCodes: ["MP_SEARCH_HORIZON_INCOMPLETE"]
    };
  }
});
assert.notStrictEqual(boundedPlanDecision.action.moveId, "CHEAP", "An incomplete matchup plan must not override the deterministic fallback action.");
assert(!boundedPlanDecision.sourceRuleIds.includes("BI_MATCHUP_PLAN"));
assert(plannedDecision.reasonCodes.includes("MP_PROVEN_WIN"));
assert.equal(plannedDecision.evidence.matchupPlan.outcomeClass, "win");

const disabledPlannerDecision = select(tacticalState, {
  matchupPlannerV2: false,
  evaluateCandidate: action => ({ components: { damage: Number(action.move?.damage || 0) } }),
  planMatchup: () => ({ selectedAction: { type: "charged_move", moveId: "CHEAP", side: "A" } })
});
assert.equal(disabledPlannerDecision.action.moveId, "NUKE");

const invalidPlannerDecision = select(tacticalState, {
  matchupPlannerV2: true,
  evaluateCandidate: action => ({ components: { damage: Number(action.move?.damage || 0) } }),
  planMatchup: () => ({ selectedAction: { type: "charged_move", moveId: "NOT_LEGAL", side: "A" } })
});
assert.equal(invalidPlannerDecision.action.moveId, "NUKE");

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

const statSensitiveA = state({ hpB: 45, energyA: 60 });
Object.assign(statSensitiveA.sides.A, {
  level: 26, cp: 1500, ivAtk: 0, ivDef: 10, ivHp: 14,
  attack: 105.58, defense: 140.32, maxHp: 40, shields: 1,
  attackStage: 0, defenseStage: 0, linePolicy: "balanced"
});
statSensitiveA.mechanicsVersion = "fixture-v1";
const statSensitiveB = JSON.parse(JSON.stringify(statSensitiveA));
Object.assign(statSensitiveB.sides.A, {
  level: 25, cp: 1492, ivAtk: 15, ivDef: 0, ivHp: 0,
  attack: 113.55, defense: 130.92
});
assert.notEqual(
  Intelligence.strategicStateKey(statSensitiveA),
  Intelligence.strategicStateKey(statSensitiveB),
  "Derived stats and IV metadata must participate in Battle Intelligence memoization."
);
const baselineStrategicKey = Intelligence.strategicStateKey(statSensitiveA);
for (const [label, mutate] of [
  ["current HP", current => { current.sides.A.hp -= 1; }],
  ["max HP", current => { current.sides.A.maxHp += 1; }],
  ["energy", current => { current.sides.A.energy += 1; }],
  ["shields", current => { current.sides.A.shields = 0; }],
  ["Attack stage", current => { current.sides.A.attackStage = 1; }],
  ["Defense stage", current => { current.sides.A.defenseStage = -1; }],
  ["ready turn", current => { current.sides.A.readyTurn += 1; }],
  ["move mechanics", current => { current.sides.A.fastMove.power = Number(current.sides.A.fastMove.power || 0) + 1; }],
  ["form", current => { current.sides.A.formId = "alternate"; }],
  ["policy", current => { current.sides.A.linePolicy = "straight"; }],
  ["mechanics version", current => { current.mechanicsVersion = "fixture-v2"; }],
  ["pending impact", current => { current.pendingEvents = [{ id: "impact", type: "fast", sourceSide: "B", targetSide: "A", moveId: "FAST", startTurn: 1, resolveTurn: 2, damage: 3 }]; }]
]) {
  const changed = JSON.parse(JSON.stringify(statSensitiveA));
  mutate(changed);
  assert.notEqual(Intelligence.strategicStateKey(changed), baselineStrategicKey, `${label} must participate in strategic identity.`);
}
select(statSensitiveA);
select(statSensitiveB);
assert.equal(Intelligence.getStatistics().cacheMisses, 4, "Different stat spreads must occupy distinct strategic cache entries.");

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

const auditedCandidate = Intelligence.selectAction({
  state: tacticalState,
  side: "A",
  legalActions: tacticalActions,
  policy: "FAST",
  context: {
    callerContext: "matrix",
    estimateDamage: action => Number(action.move?.damage || 0),
    evaluateCandidate: action => ({ components: { baitValue: action.moveId === "NUKE" ? 100 : 0 }, reasons: ["candidate evidence"] })
  }
});
assert.equal(auditedCandidate.source, "battle-intelligence");
assert.equal(auditedCandidate.fallbackReasonCode, null);
const auditReport = Intelligence.getAuditReport();
assert.equal(auditReport.totalDecisions, 2);
assert.equal(auditReport.battleIntelligenceDecisions, 2);
assert.equal(auditReport.legacyFallbackDecisions, 0);
assert.equal(auditReport.byContext.matrix.battleIntelligence, 1);
assert.equal(auditReport.fallbackRate, 0);
assert.equal(auditReport.intelligenceOwnedDecisions, 2);
assert.equal(auditReport.bypassedStrategicDecisions, 0);
assert.equal(auditReport.runtimeCoverage, 1);

Intelligence.configureAudit({ strict: true });
const strictDecision = Intelligence.selectAction({
  state: tacticalState,
  side: "A",
  legalActions: tacticalActions,
  policy: "FAST",
  context: {
    callerContext: "scenario-review",
    estimateDamage: action => Number(action.move?.damage || 0),
    evaluateCandidate: action => ({ components: { immediateDamage: Number(action.move?.damage || 0) } })
  }
});
assert.equal(strictDecision.source, "battle-intelligence");
Intelligence.configureAudit({ enabled: false, strict: false, retainEvents: false });

const metricsApi = Intelligence.createApi();
const metricsAvailabilityState = state({ energyA: 0 });
metricsApi.selectAction({
  state: metricsAvailabilityState,
  side: "A",
  legalActions: TurnEngine.getLegalActions(metricsAvailabilityState, "A"),
  policy: "FAST",
  context: { estimateDamage: action => Number(action.move?.damage || 0) }
});
const metricsFallbackState = state({ energyA: 40, hpB: 120 });
metricsApi.selectAction({
  state: metricsFallbackState,
  side: "A",
  legalActions: TurnEngine.getLegalActions(metricsFallbackState, "A"),
  policy: "FAST",
  context: {
    estimateDamage: action => Number(action.move?.damage || 0),
    evaluateHybrid() {
      return {
        action: { type: "charged_move", side: "A", moveId: "CHEAP", startTurn: 5 },
        decisive: true,
        reasonCodes: ["BOUNDED_OFFENSIVE_ROUTE"]
      };
    }
  }
});
const principleMetrics = metricsApi.getPrincipleStatistics();
assert.equal(principleMetrics.totalAutomaticDecisions, 2);
assert.equal(principleMetrics.principleEngineResolvedDecisions, 1);
assert.equal(principleMetrics.hybridFallbackDecisions, 1);
assert.equal(principleMetrics.resolvedByCategory.availability, 1);
assert.equal(principleMetrics.fallbackPercentage, .5);
assert.deepEqual(principleMetrics.migratedCategories, ["availability", "tactical", "timing", "route", "compact-planner"]);

console.log("Battle Intelligence tests passed.");
