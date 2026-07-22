"use strict";

function createPvPeakBattleIntelligenceApi() {
  const STRATEGIC_STATE_SCHEMA_VERSION = "strategic-state-v2";
  const ACTION_TYPES = Object.freeze({
    FAST_MOVE: "fast_move",
    CHARGED_MOVE: "charged_move",
    SHIELD: "shield",
    NO_SHIELD: "no_shield",
    WAIT: "wait",
    SWITCH: "switch"
  });

  const PRIORITY_CLASSES = Object.freeze({
    LEGALITY: 0,
    SURVIVAL_LETHAL: 10,
    OUTCOME_EFFECT: 20,
    CONTINUATION: 30,
    RESOURCE: 40,
    FALLBACK: 50
  });

  const POLICIES = Object.freeze({
    FAST: Object.freeze({ id: "FAST", maxDepth: 1, maxCandidates: 2, maxStates: 96, timeBudgetMs: 4, tracing: false }),
    STANDARD: Object.freeze({ id: "STANDARD", maxDepth: 2, maxCandidates: 4, maxStates: 384, timeBudgetMs: 15, tracing: true }),
    DEEP_REVIEW: Object.freeze({ id: "DEEP_REVIEW", maxDepth: 4, maxCandidates: 6, maxStates: 2000, timeBudgetMs: 75, tracing: true })
  });

  const RULES = Object.freeze([
    rule("BI_ONLY_LEGAL_ACTION", "Only legal action", PRIORITY_CLASSES.LEGALITY, "HEURISTIC_FALLBACK"),
    rule("BI_THROW_BEFORE_FAINT", "Throw before fainting", PRIORITY_CLASSES.SURVIVAL_LETHAL, "PENDING_FAST_IMPACT"),
    rule("BI_REACHABLE_CHARGED", "Use reachable charged move", PRIORITY_CLASSES.SURVIVAL_LETHAL, "PENDING_FAST_IMPACT"),
    rule("BI_GUARANTEED_LETHAL", "Prefer guaranteed lethal", PRIORITY_CLASSES.SURVIVAL_LETHAL, "LETHAL_MOVE_AVAILABLE"),
    rule("BI_AVOID_LETHAL_OVERFARM", "Avoid lethal overfarm", PRIORITY_CLASSES.SURVIVAL_LETHAL, "FORCED_BY_OPPONENT_PRESSURE"),
    rule("BI_GUARANTEED_EFFECT", "Value guaranteed effects", PRIORITY_CLASSES.FALLBACK, "BETTER_PROJECTED_OUTCOME", true),
    rule("BI_CMP_AWARE", "Respect CMP order", PRIORITY_CLASSES.SURVIVAL_LETHAL, "CMP_WIN_SETUP"),
    rule("BI_MATCHUP_PLAN", "Execute the best matchup plan", PRIORITY_CLASSES.OUTCOME_EFFECT, "MATCHUP_PLAN_SELECTED"),
    rule("BI_CONTINUATION", "Prefer strongest continuation", PRIORITY_CLASSES.CONTINUATION, "BETTER_PROJECTED_OUTCOME"),
    rule("BI_PCSV", "Prefer strongest projected charged sequence", PRIORITY_CLASSES.CONTINUATION, "PROJECTED_CHARGED_SEQUENCE_VALUE"),
    rule("BI_TIMING_CONTINUATION", "Compare throw timing continuations", PRIORITY_CLASSES.CONTINUATION, "OPTIMAL_CHARGE_TIMING", true),
    rule("BI_OVERFARM", "Preserve safe overfarm", PRIORITY_CLASSES.RESOURCE, "ENERGY_PRESERVATION"),
    rule("BI_BAIT_VALUE", "Value credible bait pressure", PRIORITY_CLASSES.RESOURCE, "SHIELD_PRESSURE"),
    rule("BI_TIMING_VALUE", "Improve charged move timing", PRIORITY_CLASSES.RESOURCE, "OPTIMAL_MOVE_TIMING"),
    rule("BI_SELF_DEBUFF_RISK", "Delay unsafe self debuff", PRIORITY_CLASSES.RESOURCE, "SELF_DEBUFF_TIMING"),
    rule("BI_SELF_DEBUFF_AVOIDANCE", "Preserve stats before self debuff", PRIORITY_CLASSES.OUTCOME_EFFECT, "AVOID_EARLY_SELF_DEBUFF"),
    rule("BI_CANDIDATE_EVIDENCE", "Evaluate strategic evidence", PRIORITY_CLASSES.CONTINUATION, "BETTER_PROJECTED_OUTCOME"),
    rule("BI_SHIELD_POLICY", "Respect explicit shield policy", PRIORITY_CLASSES.LEGALITY, "SHIELD_POLICY_ALWAYS"),
    rule("BI_SHIELD_PREVENTS_KO", "Shield to prevent knockout", PRIORITY_CLASSES.SURVIVAL_LETHAL, "SHIELD_PREVENTS_KO"),
    rule("BI_SHIELD_PRESERVES_WIN", "Shield preserves winning continuation", PRIORITY_CLASSES.OUTCOME_EFFECT, "SHIELD_PRESERVES_WIN_CONDITION", true),
    rule("BI_SHIELD_AVOIDS_FARM", "Shield avoids farm range", PRIORITY_CLASSES.OUTCOME_EFFECT, "SHIELD_AVOIDS_FARM_RANGE"),
    rule("BI_SHIELD_HEAVY_PRESSURE", "Shield heavy pressure", PRIORITY_CLASSES.RESOURCE, "SHIELD_HEAVY_PRESSURE"),
    rule("BI_SAVE_SHIELD_LOW_THREAT", "Save shield against low threat", PRIORITY_CLASSES.RESOURCE, "SHIELD_SAVED_LOW_THREAT")
  ]);

  const ruleMap = new Map(RULES.map(item => [item.id, item]));
  const fastPathCache = new Map();
  const MAX_CACHE_ENTRIES = 2048;
  const statistics = createStatistics();
  const strictByDefault = readStrictModeDefault();
  const auditConfiguration = { enabled: strictByDefault, strict: strictByDefault, retainEvents: strictByDefault };
  let audit = createAuditState();

  function rule(id, name, priorityClass, reasonCode, requiresContinuationSearch = false) {
    return Object.freeze({ id, name, description: name, priorityClass, reasonCode, requiresContinuationSearch });
  }

  function createStatistics() {
    return {
      selections: 0,
      fastPathSelections: 0,
      continuationSearches: 0,
      evaluatedCandidates: 0,
      cacheHits: 0,
      cacheMisses: 0,
      maxDecisionMs: 0,
      totalDecisionMs: 0
    };
  }

  function resetStatistics() {
    Object.assign(statistics, createStatistics());
  }

  function getStatistics() {
    return {
      ...statistics,
      averageDecisionMs: statistics.selections ? statistics.totalDecisionMs / statistics.selections : 0,
      cacheHitRate: statistics.cacheHits + statistics.cacheMisses
        ? statistics.cacheHits / (statistics.cacheHits + statistics.cacheMisses)
        : 0,
      cacheSize: fastPathCache.size
    };
  }

  function clearCache() {
    fastPathCache.clear();
  }

  function createAuditState() {
    return {
      totalDecisions: 0,
      battleIntelligenceDecisions: 0,
      legacyFallbackDecisions: 0,
      manualDecisions: 0,
      forcedPolicyDecisions: 0,
      intelligenceOwnedDecisions: 0,
      bypassedStrategicDecisions: 0,
      byCategory: {},
      byContext: {},
      fallbackReasons: {},
      events: []
    };
  }

  function configureAudit(options = {}) {
    if (Object.prototype.hasOwnProperty.call(options, "enabled")) auditConfiguration.enabled = !!options.enabled;
    if (Object.prototype.hasOwnProperty.call(options, "strict")) auditConfiguration.strict = !!options.strict;
    if (Object.prototype.hasOwnProperty.call(options, "retainEvents")) auditConfiguration.retainEvents = !!options.retainEvents;
    if (auditConfiguration.strict) auditConfiguration.enabled = true;
    return getAuditReport();
  }

  function resetAudit() {
    audit = createAuditState();
  }

  function getAuditReport() {
    const strategic = audit.battleIntelligenceDecisions + audit.legacyFallbackDecisions + audit.forcedPolicyDecisions;
    return {
      ...audit,
      byCategory: cloneCounters(audit.byCategory),
      byContext: cloneCounters(audit.byContext),
      fallbackReasons: { ...audit.fallbackReasons },
      events: audit.events.map(event => ({ ...event, ruleIds: [...event.ruleIds], categories: [...event.categories] })),
      fallbackRate: strategic ? audit.legacyFallbackDecisions / strategic : 0,
      runtimeCoverage: strategic ? audit.intelligenceOwnedDecisions / strategic : 0,
      configuration: { ...auditConfiguration }
    };
  }

  function recordExternalDecision(input = {}) {
    return recordAuditDecision({
      source: input.source || "manual",
      action: input.action || null,
      ruleIds: input.ruleIds || [],
      policy: input.policy || null,
      callerContext: input.callerContext || "battle",
      categories: input.categories || ["manual"],
      fallbackReasonCode: input.fallbackReasonCode || null,
      intelligenceOwned: input.intelligenceOwned === true
    });
  }

  function resolvePolicy(input) {
    if (input && typeof input === "object" && input.id && POLICIES[input.id]) return POLICIES[input.id];
    const id = String(input || "FAST").toUpperCase();
    return POLICIES[id] || POLICIES.FAST;
  }

  function normalizeAction(action = {}, side = null) {
    const type = action.type === "fast" ? ACTION_TYPES.FAST_MOVE
      : action.type === "charged" ? ACTION_TYPES.CHARGED_MOVE
        : action.type;
    return {
      type,
      side: action.side || side || null,
      moveId: action.moveId || action.move?.id || null,
      target: action.target || null,
      timing: action.startTurn == null ? action.timing || null : { startTurn: Number(action.startTurn) },
      metadata: action.metadata || null,
      move: action.move || null,
      moveIndex: Number.isInteger(action.moveIndex) ? action.moveIndex : null,
      originalAction: action
    };
  }

  function createCandidate(action, input = {}) {
    return {
      action,
      legal: input.legal !== false,
      priorityClass: input.priorityClass ?? PRIORITY_CLASSES.FALLBACK,
      sourceRuleIds: [...(input.sourceRuleIds || [])],
      tacticalScore: Number(input.tacticalScore || 0),
      continuationScore: input.continuationScore == null ? null : Number(input.continuationScore),
      continuationPenalty: Math.max(0, Number(input.continuationPenalty || 0)),
      strategicallyExcluded: !!input.strategicallyExcluded,
      confidence: Number(input.confidence ?? .5),
      reasonCodes: [...(input.reasonCodes || [])],
      requiresContinuationSearch: !!input.requiresContinuationSearch,
      evidence: input.evidence || null
    };
  }

  function normalizeState(input = {}) {
    const sides = {};
    for (const sideId of ["A", "B"]) {
      const side = input.sides?.[sideId] || {};
      sides[sideId] = {
        id: side.id || side.pokemonId || null,
        formId: side.formId || side.currentFormId || null,
        level: numeric(side.level),
        cp: numeric(side.cp),
        ivAtk: numeric(side.ivAtk),
        ivDef: numeric(side.ivDef),
        ivHp: numeric(side.ivHp),
        hp: numeric(side.hp),
        maxHp: numeric(side.maxHp),
        energy: clamp(numeric(side.energy), 0, 100),
        shields: clamp(numeric(side.shields), 0, 2),
        attack: numeric(side.attack),
        defense: numeric(side.defense),
        attackStage: numeric(side.attackStage),
        defenseStage: numeric(side.defenseStage),
        readyTurn: Math.max(0, numeric(side.readyTurn)),
        fastMove: side.fastMove || null,
        chargedMoves: (side.chargedMoves || []).filter(Boolean),
        baiting: side.baiting || null,
        shieldMode: side.shieldMode || null,
        linePolicy: side.linePolicy || null,
        mechanicState: stableObject(side.mechanicState || side.formState || null)
      };
    }
    return {
      mechanicsVersion: input.mechanicsVersion || null,
      currentTurn: Math.max(0, numeric(input.currentTurn)),
      sides,
      pendingEvents: [...(input.pendingEvents || [])]
        .filter(Boolean)
        .map(event => ({
          id: event.id || null,
          type: event.type || null,
          sourceSide: event.sourceSide || null,
          targetSide: event.targetSide || null,
          moveId: event.moveId || null,
          startTurn: numeric(event.startTurn ?? event.start),
          damage: numeric(event.damage),
          resolveTurn: numeric(event.resolveTurn),
          status: event.status || "pending",
          source: event.source || null,
          metadata: stableObject(event.metadata || null)
        }))
        .sort(compareEvents),
      cmpState: stableObject(input.cmpState || null),
      delayState: stableObject(input.delayState || null)
    };
  }

  function strategicStateKey(input, policy = "FAST") {
    const state = normalizeState(input);
    return strategicStateKeyFromNormalized(state, policy);
  }

  function strategicStateKeyFromNormalized(state, policy = "FAST") {
    const compact = {
      schema: STRATEGIC_STATE_SCHEMA_VERSION,
      mechanicsVersion: state.mechanicsVersion,
      policy: resolvePolicy(policy).id,
      turn: state.currentTurn,
      sides: Object.fromEntries(["A", "B"].map(sideId => {
        const side = state.sides[sideId];
        return [sideId, {
          id: side.id,
          form: side.formId,
          level: side.level,
          cp: side.cp,
          ivs: [side.ivAtk, side.ivDef, side.ivHp],
          attack: side.attack,
          defense: side.defense,
          hp: side.hp,
          maxHp: side.maxHp,
          energy: side.energy,
          shields: side.shields,
          stages: [side.attackStage, side.defenseStage],
          ready: side.readyTurn,
          fast: moveKey(side.fastMove),
          charged: side.chargedMoves.map(moveKey),
          baiting: side.baiting,
          shieldMode: side.shieldMode,
          linePolicy: side.linePolicy,
          mechanicState: side.mechanicState
        }];
      })),
      pending: state.pendingEvents,
      cmp: state.cmpState,
      delay: state.delayState
    };
    return JSON.stringify(compact);
  }

  function selectAction(input = {}) {
    const startedAt = now();
    const policy = resolvePolicy(input.policy);
    const side = input.side;
    const context = input.context || {};
    const legalActions = (input.legalActions || []).map(action => normalizeAction(action, side));
    const candidates = legalActions.map(action => createCandidate(action));
    const auditMeta = {
      callerContext: context.callerContext || "unknown",
      cmp: Array.isArray(input.state?.cmpState?.readySides) && input.state.cmpState.readySides.length > 1
    };
    candidates.forEach(candidate => { candidate.auditMeta = auditMeta; });
    statistics.selections++;
    statistics.evaluatedCandidates += candidates.length;

    if (!candidates.length) {
      const result = selectionResult(null, candidates, policy, false, ["NO_LEGAL_ACTION"], "No legal action is available.");
      finishTiming(startedAt);
      return result;
    }

    if (candidates.length === 1) {
      const chosen = applyRule(candidates[0], "BI_ONLY_LEGAL_ACTION", 100, .99);
      const result = selectionResult(chosen, candidates, policy, true, chosen.reasonCodes, "Only one legal action is available.");
      finishTiming(startedAt);
      return result;
    }

    const charged = candidates.filter(candidate => candidate.action.type === ACTION_TYPES.CHARGED_MOVE);
    const fast = candidates.filter(candidate => candidate.action.type === ACTION_TYPES.FAST_MOVE);
    if (!charged.length && fast.length) {
      const chosen = applyRule(fast[0], "BI_ONLY_LEGAL_ACTION", 100, .99);
      const result = selectionResult(chosen, candidates, policy, true, chosen.reasonCodes, "Fast Move is the only legal progression.");
      finishTiming(startedAt);
      return result;
    }

    const state = normalizeState(input.state);
    const plannedSelection = selectMatchupPlanAction({
      state,
      side,
      legalActions,
      candidates,
      policy,
      context
    });
    if (plannedSelection) {
      finishTiming(startedAt);
      return plannedSelection;
    }
    const cacheKey = `${strategicStateKeyFromNormalized(state, policy)}|${legalActions.map(actionKey).join(",")}`;
    const cached = fastPathCache.get(cacheKey);
    if (cached) {
      const action = legalActions.find(item => actionKey(item) === cached.actionKey);
      if (action) {
        statistics.cacheHits++;
        const result = resultFromCached(action, candidates, cached, policy);
        finishTiming(startedAt);
        return result;
      }
    }
    statistics.cacheMisses++;

    const lethal = charged
      .filter(candidate => isGuaranteedLethal(candidate, state, side, context))
      .sort((a, b) => actionEnergyCost(a.action) - actionEnergyCost(b.action) || damageFor(b, context) - damageFor(a, context) || stableCandidateOrder(a, b))[0];
    if (lethal) {
      const chosen = applyRule(lethal, "BI_GUARANTEED_LETHAL", 1000, .99, {
        damage: damageFor(lethal, context),
        targetHp: state.sides[opponentOf(side)]?.hp || 0
      });
      const result = selectionResult(chosen, candidates, policy, true, chosen.reasonCodes, "Lowest-cost legal Charged Move guarantees the knockout.");
      cacheFastPath(cacheKey, result);
      finishTiming(startedAt);
      return result;
    }

    const pendingLethal = nextPendingLethal(state, side);
    if (pendingLethal && charged.length) {
      const chosen = [...charged].sort((a, b) => damageFor(b, context) - damageFor(a, context) || actionEnergyCost(a.action) - actionEnergyCost(b.action) || stableCandidateOrder(a, b))[0];
      applyRule(chosen, "BI_THROW_BEFORE_FAINT", 900, .98, { pendingEventId: pendingLethal.id, resolveTurn: pendingLethal.resolveTurn });
      applyRule(chosen, "BI_REACHABLE_CHARGED", 100, .98);
      const result = selectionResult(chosen, candidates, policy, true, chosen.reasonCodes, `Pending ${pendingLethal.moveId || "Fast Move"} damage creates a final Charged Move window.`);
      cacheFastPath(cacheKey, result);
      finishTiming(startedAt);
      return result;
    }

    if (charged.length && context.opponentLethalBeforeNextWindow === true) {
      const chosen = [...charged].sort(stableCandidateOrder)[0];
      applyRule(chosen, "BI_AVOID_LETHAL_OVERFARM", 800, .9);
      const result = selectionResult(chosen, candidates, policy, true, chosen.reasonCodes, "Another Fast Move gives the opponent a lethal action window.");
      cacheFastPath(cacheKey, result);
      finishTiming(startedAt);
      return result;
    }

    const meaningful = pruneDominatedCandidates(candidates, context);
    for (const candidate of meaningful) {
      if (candidate.action.type !== ACTION_TYPES.CHARGED_MOVE || !hasGuaranteedEffect(candidate, context)) continue;
      applyRule(candidate, "BI_GUARANTEED_EFFECT", 25, .75);
    }

    for (const candidate of meaningful) {
      const evidence = typeof context.evaluateCandidate === "function"
        ? context.evaluateCandidate(candidate.action, { state, policy: policy.id })
        : null;
      applyCandidateEvidence(candidate, evidence);
    }

    const selectable = meaningful.filter(candidate => !candidate.strategicallyExcluded);

    if (typeof context.evaluateContinuation === "function") {
      const timingComparison = selectable.some(candidate =>
        candidate?.evidence?.candidateEvaluation?.ruleIds?.includes("BI_TIMING_CONTINUATION")
      );
      // PCSV normally compares only Charged candidates. A timing window is a
      // stricter decision: it must keep Fast/Wait alternatives in the set, or
      // the engine silently loses the alignment line before it is evaluated.
      const fullChargedComparison = context.forceChargedContinuation === true && !timingComparison;
      // A timing decision can contain throw-now, a safe Fast, a one-turn
      // alignment wait, and the other legal Charged Move. Retain that small
      // complete set rather than letting the normal candidate budget silently
      // remove the exact timing branch we need to compare.
      const continuationLimit = timingComparison
        ? Math.max(policy.maxCandidates, Math.min(4, selectable.length))
        : policy.maxCandidates;
      const searchCandidates = selectable
        .filter(candidate => fullChargedComparison
          ? candidate.action.type === ACTION_TYPES.CHARGED_MOVE
          : candidate.requiresContinuationSearch)
        .sort(compareCandidates)
        .slice(0, continuationLimit);
      if (searchCandidates.length > 1) {
        statistics.continuationSearches++;
        const searched = boundedContinuation(searchCandidates, state, policy, context, now(), {
          // PCSV is only trustworthy when both legal charged alternatives are
          // simulated from the same state. Timing additionally includes Fast
          // and, where legal, a one-turn alignment wait.
          minimumComparableCandidates: timingComparison
            ? Math.min(4, searchCandidates.length)
            : fullChargedComparison ? Math.min(2, searchCandidates.length) : 1
        });
        if (searched) {
          applyRule(searched, searched.evidence?.continuation?.pcsv ? "BI_PCSV" : "BI_CONTINUATION", 0, .92);
        }
      }
    }

    const fallback = [...selectable].sort(compareCandidates)[0] || candidates[0];
    applyRule(fallback, "BI_CANDIDATE_EVIDENCE", 0, .7);
    const result = selectionResult(fallback, candidates, policy, false, fallback.reasonCodes, explainSelection(fallback));
    finishTiming(startedAt);
    return result;
  }

  function selectMatchupPlanAction(input) {
    const { state, side, legalActions, candidates, policy, context } = input;
    if (!matchupPlannerEnabled(context) || typeof context.planMatchup !== "function") return null;

    let plan = null;
    try {
      plan = context.planMatchup({ state, side, legalActions, policy: policy.id });
    } catch (_) {
      return null;
    }
    const provenPlan = plan?.principalLine?.completeness === "complete" && plan?.incompleteHorizon !== true;
    if (!provenPlan && context.allowBoundedMatchupPlan !== true) return null;
    const plannedAction = normalizeAction(
      plan?.selectedAction || plan?.principalVariation?.[0]?.action || plan?.principalLine?.actions?.[0],
      side
    );
    const legalAction = legalActions.find(action => actionKey(action) === actionKey(plannedAction));
    if (!legalAction) return null;

    const chosen = candidates.find(candidate => actionKey(candidate.action) === actionKey(legalAction))
      || createCandidate(legalAction);
    chosen.evidence = { ...(chosen.evidence || {}), matchupPlan: plan };
    applyRule(chosen, "BI_MATCHUP_PLAN", 0, Number(plan?.confidence || .8));
    const reasonCodes = [...new Set([...(plan?.reasonCodes || []), ...chosen.reasonCodes])];
    return selectionResult(
      chosen,
      candidates,
      policy,
      false,
      reasonCodes,
      plan?.explanation || "Selected the first legal action of the best reachable matchup plan."
    );
  }

  function matchupPlannerEnabled(context = {}) {
    if (context.matchupPlannerV2 === true) return true;
    if (context.matchupPlannerV2 === false) return false;
    try {
      const value = typeof globalThis !== "undefined" ? globalThis.MATCHUP_PLANNER_V2 : null;
      if (value === true || String(value || "").toLowerCase() === "true" || value === "1") return true;
    } catch (_) {}
    try {
      const value = typeof process !== "undefined" ? process.env?.MATCHUP_PLANNER_V2 : null;
      return value === "true" || value === "1";
    } catch (_) {
      return false;
    }
  }

  function applyCandidateEvidence(candidate, input) {
    if (!candidate || !input || typeof input !== "object") return candidate;
    const components = Object.fromEntries(Object.entries(input.components || {})
      .filter(([, value]) => Number.isFinite(Number(value)))
      .map(([key, value]) => [key, Number(value)]));
    candidate.scoreComponents = components;
    candidate.tacticalScore += Object.values(components).reduce((sum, value) => sum + value, 0);
    candidate.continuationPenalty = Math.max(0, Number(input.continuationPenalty || candidate.continuationPenalty || 0));
    candidate.strategicallyExcluded ||= input.strategicallyExcluded === true;
    candidate.requiresContinuationSearch ||= input.requiresContinuationSearch === true;
    candidate.evidence = {
      ...(candidate.evidence || {}),
      candidateEvaluation: {
        ...input,
        components,
        reasons: [...(input.reasons || [])]
      }
    };
    const newReasonCodes = (input.reasonCodes || []).filter(reasonCode => !candidate.reasonCodes.includes(reasonCode));
    candidate.reasonCodes = [...newReasonCodes, ...candidate.reasonCodes];
    for (const ruleId of input.ruleIds || []) applyRule(candidate, ruleId, 0, input.confidence || .8);
    return candidate;
  }

  function explainSelection(candidate) {
    const evaluation = candidate?.evidence?.candidateEvaluation || {};
    const continuation = candidate?.evidence?.continuation || null;
    const reasons = [...(evaluation.reasons || [])];
    if (continuation?.pcsv && Number.isFinite(Number(continuation.pcsv.value))) {
      reasons.unshift(`strongest projected charged sequence (${continuation.pcsv.chargedMoveCount} Charged Moves, PCSV ${Math.round(Number(continuation.pcsv.value))})`);
    } else if (continuation && Number.isFinite(Number(continuation.score))) {
      reasons.unshift(`highest continuation score ${Math.round(Number(continuation.score))}`);
    }
    if (!reasons.length) reasons.push("highest deterministic candidate score");
    return `Selected ${actionLabel(candidate?.action)}: ${reasons.slice(0, 4).join("; ")}.`;
  }

  function actionLabel(action) {
    if (!action) return "no action";
    if (action.type === ACTION_TYPES.FAST_MOVE) return action.move?.name || "Fast Move";
    if (action.type === ACTION_TYPES.CHARGED_MOVE) return action.move?.name || action.moveId || "Charged Move";
    return action.type || "action";
  }

  function selectShieldAction(input = {}) {
    const policy = String(input.policy || "always").toLowerCase();
    const state = input.state || {};
    const threat = input.threat || {};
    const counterfactual = input.counterfactual || null;
    const shields = Math.max(0, numeric(state.shields));
    const chargedTaken = Math.max(0, numeric(state.chargedTaken));
    const hp = Math.max(0, numeric(state.hp));
    const maxHp = Math.max(1, numeric(state.maxHp, hp || 1));
    const damage = Math.max(0, numeric(threat.damage));
    const energyCost = Math.max(0, numeric(threat.energyCost));

    const done = result => finalizeShieldResult(result, input, policy);
    if (!shields) return done(shieldResult(false, "BI_SAVE_SHIELD_LOW_THREAT", "No shield is available.", .99));
    if (policy === "no-first" && chargedTaken === 0) {
      return done(shieldResult(false, "BI_SHIELD_POLICY", "No First shield logic lets the first charged move through.", .99));
    }
    if (policy === "always") {
      return done(shieldResult(true, "BI_SHIELD_POLICY", "Always shield logic uses a shield.", .99));
    }
    if (policy === "nuke") {
      const shield = damage >= hp || damage >= maxHp * .35 || energyCost >= 55;
      return done(shieldResult(
        shield,
        shield ? "BI_SHIELD_HEAVY_PRESSURE" : "BI_SAVE_SHIELD_LOW_THREAT",
        shield ? "Nuke shield logic blocks high-threat damage." : "Nuke shield logic lets low-threat damage through.",
        .9
      ));
    }

    if (counterfactual) {
      const withShield = outcomeRank(counterfactual.outcomeWithShield);
      const withoutShield = outcomeRank(counterfactual.outcomeWithoutShield);
      if (withShield !== withoutShield) {
        const shield = withShield > withoutShield;
        return done(shieldResult(
          shield,
          "BI_SHIELD_PRESERVES_WIN",
          shield
            ? "Smart shield preserves a winning continuation."
            : "Smart shield preserves a winning continuation by saving the shield.",
          .98,
          { counterfactual }
        ));
      }
    }

    if (damage >= hp) return done(shieldResult(true, "BI_SHIELD_PREVENTS_KO", "Smart shield blocks a KO.", .98));
    if (threat.preBuffDefenseWindow && shields >= 2 && damage / maxHp >= .12) {
      return done(shieldResult(true, "BI_SHIELD_PRESERVES_WIN", "Smart shield preserves HP before activating a guaranteed Defense boost.", .9));
    }
    if (threat.entersFarmRange) return done(shieldResult(true, "BI_SHIELD_AVOIDS_FARM", "Smart shield avoids farm range.", .9));
    if (threat.losesChargedThreat) {
      return done(shieldResult(true, "BI_SHIELD_AVOIDS_FARM", "Smart shield preserves charged-move threat.", .88));
    }
    const damageRatio = damage / maxHp;
    if (shields >= 2 && (damageRatio >= .42 || energyCost >= 55)) {
      return done(shieldResult(true, "BI_SHIELD_HEAVY_PRESSURE", "Smart shield spends from 2 shields against heavy pressure.", .82));
    }
    if (damageRatio >= .55) return done(shieldResult(true, "BI_SHIELD_HEAVY_PRESSURE", "Smart shield blocks major damage.", .82));
    if (damageRatio <= .25 && energyCost < 55) {
      return done(shieldResult(false, "BI_SAVE_SHIELD_LOW_THREAT", "Smart shield calls low-impact bait.", .78));
    }
    return done(shieldResult(false, "BI_SAVE_SHIELD_LOW_THREAT", "Smart shield saves shield for higher threat.", .72));
  }

  function finalizeShieldResult(result, input, policy) {
    const source = policy === "always" || policy === "no-first" ? "forced-policy" : "battle-intelligence";
    const categories = ["shield-selection"];
    if (result.reasonCodes.includes("SHIELD_PRESERVES_WIN_CONDITION")) categories.push("continuation-search");
    return attachAudit(result, {
      source,
      action: result.action,
      ruleIds: result.sourceRuleIds,
      policy: String(input.intelligencePolicy || input.policy || "FAST").toUpperCase(),
      callerContext: input.callerContext || "unknown",
      categories,
      intelligenceOwned: true
    });
  }

  function shieldResult(shield, ruleId, explanation, confidence, evidence = null) {
    const definition = ruleMap.get(ruleId);
    return {
      action: {
        type: shield ? ACTION_TYPES.SHIELD : ACTION_TYPES.NO_SHIELD,
        side: null,
        moveId: null,
        target: null,
        timing: null,
        metadata: null
      },
      shield: !!shield,
      sourceRuleIds: definition ? [definition.id] : [],
      reasonCodes: definition?.reasonCode ? [definition.reasonCode] : [],
      explanation,
      confidence,
      evidence
    };
  }

  function outcomeRank(value) {
    return ({ loss: 0, draw: 1, win: 2 })[value] ?? -1;
  }

  function pruneDominatedCandidates(candidates, context = {}) {
    return candidates.filter(candidate => {
      if (candidate.action.type !== ACTION_TYPES.CHARGED_MOVE || hasGuaranteedEffect(candidate, context)) return true;
      const cost = actionEnergyCost(candidate.action);
      const damage = damageFor(candidate, context);
      return !candidates.some(other =>
        other !== candidate
        && other.action.type === ACTION_TYPES.CHARGED_MOVE
        && actionEnergyCost(other.action) === cost
        && !hasGuaranteedEffect(other, context)
        && !hasHarmfulSelfEffect(other.action)
        && damageFor(other, context) > damage
      );
    });
  }

  function hasHarmfulSelfEffect(action) {
    const move = action?.move || {};
    if (Number(move.buffApplyChance || 0) <= 0) return false;
    const hasNegative = values => Array.isArray(values) && values.some(value => Number(value || 0) < 0);
    if (move.buffTarget === "both") return hasNegative(move.buffsSelf);
    if (move.buffTarget === "opponent") return false;
    return hasNegative(move.buffs);
  }

  function boundedContinuation(candidates, state, policy, context, startedAt, options = {}) {
    let best = null;
    let explored = 0;
    let evaluatedCandidates = 0;
    const minimumComparableCandidates = Math.max(1, Math.min(
      candidates.length,
      Number(options.minimumComparableCandidates || 1)
    ));
    for (const candidate of candidates) {
      // A timing decision is only meaningful if throw-now and the principal
      // alternative both receive a continuation from the same state. Budget
      // limits apply after that minimum comparable pair, never before it.
      if (evaluatedCandidates >= minimumComparableCandidates
        && (explored >= policy.maxStates || now() - startedAt >= policy.timeBudgetMs)) break;
      const evaluation = context.evaluateContinuation(candidate.action, {
        state,
        maxDepth: policy.maxDepth,
        maxStates: policy.maxStates - explored,
        timeBudgetMs: Math.max(0, policy.timeBudgetMs - (now() - startedAt))
      });
      evaluatedCandidates++;
      explored += Math.max(1, Number(evaluation?.evaluatedStates || 1));
      if (!evaluation || !Number.isFinite(Number(evaluation.score))) continue;
      candidate.continuationScore = Number(evaluation.pcsv?.value ?? evaluation.score) - Math.max(0, Number(candidate.continuationPenalty || 0));
      candidate.evidence = { ...(candidate.evidence || {}), continuation: evaluation };
      if (!best || compareCandidates(candidate, best) < 0) best = candidate;
    }
    return best;
  }

  function isGuaranteedLethal(candidate, state, side, context) {
    const target = state.sides[opponentOf(side)];
    if (!target || target.hp <= 0) return false;
    const damage = damageFor(candidate, context);
    if (damage < target.hp) return false;
    return typeof context.willOpponentShield === "function" ? !context.willOpponentShield(candidate.action) : target.shields <= 0;
  }

  function nextPendingLethal(state, side) {
    const hp = state.sides[side]?.hp || 0;
    return state.pendingEvents.find(event =>
      event.status === "pending"
      && event.targetSide === side
      && event.damage >= hp
      && event.resolveTurn >= state.currentTurn
    ) || null;
  }

  function hasGuaranteedEffect(candidate, context) {
    if (typeof context.hasGuaranteedEffect === "function") return !!context.hasGuaranteedEffect(candidate.action);
    const move = candidate.action.move || {};
    if (Number(move.buffApplyChance || 0) < 1) return false;
    return [move.buffs, move.buffsSelf, move.buffsOpponent]
      .some(values => Array.isArray(values) && values.some(value => Number(value || 0) !== 0));
  }

  function damageFor(candidate, context) {
    if (typeof context.estimateDamage !== "function") return numeric(candidate.action.metadata?.damage);
    return Math.max(0, numeric(context.estimateDamage(candidate.action)));
  }

  function applyRule(candidate, ruleId, score, confidence, evidence = null) {
    const definition = ruleMap.get(ruleId);
    if (!candidate || !definition) return candidate;
    if (!candidate.sourceRuleIds.includes(ruleId)) candidate.sourceRuleIds.push(ruleId);
    if (definition.reasonCode && !candidate.reasonCodes.includes(definition.reasonCode)) candidate.reasonCodes.push(definition.reasonCode);
    candidate.priorityClass = Math.min(candidate.priorityClass, definition.priorityClass);
    candidate.tacticalScore += Number(score || 0);
    candidate.confidence = Math.max(candidate.confidence, Number(confidence || 0));
    candidate.requiresContinuationSearch ||= definition.requiresContinuationSearch;
    if (evidence) candidate.evidence = { ...(candidate.evidence || {}), [ruleId]: evidence };
    return candidate;
  }

  function selectionResult(candidate, candidates, policy, fastPath, reasonCodes, explanation) {
    if (fastPath) statistics.fastPathSelections++;
    const result = {
      action: candidate?.action || null,
      chosenCandidate: candidate || null,
      candidates,
      policy: policy.id,
      fastPath: !!fastPath,
      sourceRuleIds: [...(candidate?.sourceRuleIds || [])],
      reasonCodes: [...new Set(reasonCodes || [])],
      explanation: explanation || "",
      evidence: candidate?.evidence || null
    };
    const forcedPolicy = candidate?.sourceRuleIds?.includes("BI_ONLY_LEGAL_ACTION");
    const source = forcedPolicy ? "forced-policy" : "battle-intelligence";
    return attachAudit(result, {
      source,
      action: result.action,
      ruleIds: result.sourceRuleIds,
      policy: policy.id,
      callerContext: candidate?.auditMeta?.callerContext || "unknown",
      categories: decisionCategories(candidate),
      fallbackReasonCode: null,
      intelligenceOwned: true
    });
  }

  function decisionCategories(candidate) {
    const categories = new Set(["fast-vs-charged"]);
    const action = candidate?.action || {};
    const rules = candidate?.sourceRuleIds || [];
    const reasons = (candidate?.evidence?.candidateEvaluation?.reasons || []).join(" ").toLowerCase();
    if (action.type === ACTION_TYPES.CHARGED_MOVE) categories.add("charged-selection");
    if (rules.includes("BI_THROW_BEFORE_FAINT")) categories.add("throw-before-faint");
    if (rules.includes("BI_REACHABLE_CHARGED")) categories.add("cheaper-reachable-charged");
    if (rules.includes("BI_GUARANTEED_LETHAL")) categories.add("guaranteed-lethal");
    if (rules.includes("BI_AVOID_LETHAL_OVERFARM") || reasons.includes("overfarm")) categories.add("overfarm");
    if (rules.includes("BI_GUARANTEED_EFFECT")) categories.add("guaranteed-effect");
    if (candidate?.auditMeta?.cmp) categories.add("cmp-ordering");
    if (reasons.includes("bait")) categories.add("baiting");
    if (reasons.includes("self-debuff")) categories.add("delayed-self-debuff");
    if (candidate?.evidence?.continuation) categories.add("continuation-search");
    return [...categories];
  }

  function attachAudit(result, entry) {
    const recorded = recordAuditDecision(entry);
    return {
      ...result,
      source: entry.source,
      fallbackReasonCode: entry.fallbackReasonCode || null,
      decisionCategories: [...entry.categories],
      callerContext: entry.callerContext,
      auditEvent: recorded
    };
  }

  function recordAuditDecision(entry) {
    if (entry.source === "legacy-fallback" && auditConfiguration.strict) {
      const code = entry.fallbackReasonCode || "LEGACY_CALLER_NOT_MIGRATED";
      const error = new Error(`Battle Intelligence strict mode rejected strategic fallback: ${code}`);
      error.code = code;
      error.auditEntry = entry;
      throw error;
    }
    if (!auditConfiguration.enabled) return null;
    const normalized = {
      source: entry.source || "battle-intelligence",
      action: entry.action ? { type: entry.action.type || null, moveId: entry.action.moveId || null, side: entry.action.side || null } : null,
      ruleIds: [...(entry.ruleIds || [])],
      policy: entry.policy || null,
      callerContext: entry.callerContext || "unknown",
      categories: [...new Set(entry.categories || [])],
      fallbackReasonCode: entry.fallbackReasonCode || null,
      intelligenceOwned: entry.intelligenceOwned === true
    };
    audit.totalDecisions++;
    if (normalized.source === "legacy-fallback") audit.legacyFallbackDecisions++;
    else if (normalized.source === "manual") audit.manualDecisions++;
    else if (normalized.source === "forced-policy") audit.forcedPolicyDecisions++;
    else audit.battleIntelligenceDecisions++;
    if (normalized.source !== "manual") {
      if (normalized.intelligenceOwned) audit.intelligenceOwnedDecisions++;
      else audit.bypassedStrategicDecisions++;
    }
    incrementCounter(audit.byContext, normalized.callerContext, normalized.source);
    normalized.categories.forEach(category => incrementCounter(audit.byCategory, category, normalized.source));
    if (normalized.fallbackReasonCode) audit.fallbackReasons[normalized.fallbackReasonCode] = (audit.fallbackReasons[normalized.fallbackReasonCode] || 0) + 1;
    if (auditConfiguration.retainEvents) audit.events.push(normalized);
    return normalized;
  }

  function incrementCounter(group, key, source) {
    const bucket = group[key] ||= { total: 0, battleIntelligence: 0, legacyFallback: 0, manual: 0, forcedPolicy: 0 };
    bucket.total++;
    if (source === "legacy-fallback") bucket.legacyFallback++;
    else if (source === "manual") bucket.manual++;
    else if (source === "forced-policy") bucket.forcedPolicy++;
    else bucket.battleIntelligence++;
  }

  function cloneCounters(group) {
    return Object.fromEntries(Object.entries(group).map(([key, value]) => [key, { ...value }]));
  }

  function readStrictModeDefault() {
    try {
      const value = typeof globalThis !== "undefined" ? globalThis.BATTLE_INTELLIGENCE_STRICT : null;
      if (value === true || String(value || "").toLowerCase() === "true") return true;
    } catch (_) {}
    try {
      const value = typeof process !== "undefined" ? process.env?.BATTLE_INTELLIGENCE_STRICT : null;
      return value === "true" || value === "1";
    } catch (_) {
      return false;
    }
  }

  function cacheFastPath(key, result) {
    if (!result?.action || !result.fastPath) return;
    if (fastPathCache.size >= MAX_CACHE_ENTRIES) fastPathCache.delete(fastPathCache.keys().next().value);
    fastPathCache.set(key, {
      actionKey: actionKey(result.action),
      sourceRuleIds: result.sourceRuleIds,
      reasonCodes: result.reasonCodes,
      explanation: result.explanation,
      evidence: result.evidence
    });
  }

  function resultFromCached(action, candidates, cached, policy) {
    const candidate = candidates.find(item => actionKey(item.action) === cached.actionKey) || createCandidate(action);
    candidate.sourceRuleIds = [...cached.sourceRuleIds];
    candidate.reasonCodes = [...cached.reasonCodes, "MEMOIZED_RESULT"];
    candidate.evidence = cached.evidence;
    return selectionResult(candidate, candidates, policy, true, candidate.reasonCodes, cached.explanation);
  }

  function compareCandidates(a, b) {
    const continuationA = a.continuationScore == null ? -Infinity : a.continuationScore;
    const continuationB = b.continuationScore == null ? -Infinity : b.continuationScore;
    const timingQualityA = numeric(a.evidence?.continuation?.timingQuality?.score);
    const timingQualityB = numeric(b.evidence?.continuation?.timingQuality?.score);
    return a.priorityClass - b.priorityClass
      || continuationB - continuationA
      // When two complete continuations reach the same outcome and resources,
      // prefer the line whose first Charged Move lands deeper inside the
      // opponent's active Fast Move. This is a deterministic timing tie-break,
      // never a substitute for a stronger continuation.
      || timingQualityB - timingQualityA
      || b.tacticalScore - a.tacticalScore
      || stableCandidateOrder(a, b);
  }

  function stableCandidateOrder(a, b) {
    return actionEnergyCost(a.action) - actionEnergyCost(b.action)
      || actionKey(a.action).localeCompare(actionKey(b.action));
  }

  function actionEnergyCost(action) {
    return Math.max(0, numeric(action?.move?.energyCost ?? action?.metadata?.energyCost));
  }

  function moveKey(move) {
    if (!move) return null;
    return JSON.stringify({
      id: move.id || move.moveId || null,
      type: move.type || null,
      power: numeric(move.power),
      energyCost: numeric(move.energyCost),
      energyGain: numeric(move.energyGain),
      turns: numeric(move.turns),
      buffs: stableObject(move.buffs),
      buffsSelf: stableObject(move.buffsSelf),
      buffsOpponent: stableObject(move.buffsOpponent),
      buffTarget: move.buffTarget || null,
      buffApplyChance: numeric(move.buffApplyChance)
    });
  }

  function actionKey(action) {
    return [action?.type || "none", action?.side || "?", action?.moveId || "none", action?.timing?.startTurn ?? ""].join(":");
  }

  function opponentOf(side) {
    return side === "A" ? "B" : "A";
  }

  function compareEvents(a, b) {
    return a.resolveTurn - b.resolveTurn || String(a.id || "").localeCompare(String(b.id || ""));
  }

  function stableObject(value) {
    if (value == null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(stableObject);
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableObject(value[key])]));
  }

  function numeric(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function now() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }

  function finishTiming(startedAt) {
    const duration = Math.max(0, now() - startedAt);
    statistics.totalDecisionMs += duration;
    statistics.maxDecisionMs = Math.max(statistics.maxDecisionMs, duration);
  }

  return Object.freeze({
    createApi: createPvPeakBattleIntelligenceApi,
    ACTION_TYPES,
    STRATEGIC_STATE_SCHEMA_VERSION,
    PRIORITY_CLASSES,
    POLICIES,
    RULES,
    normalizeAction,
    createCandidate,
    normalizeState,
    strategicStateKey,
    resolvePolicy,
    selectAction,
    selectShieldAction,
    pruneDominatedCandidates,
    clearCache,
    resetStatistics,
    getStatistics,
    configureAudit,
    resetAudit,
    getAuditReport,
    recordExternalDecision
  });
}

(function exposePvPeakBattleIntelligence(root) {
  const api = createPvPeakBattleIntelligenceApi();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.createPvPeakBattleIntelligenceApi = createPvPeakBattleIntelligenceApi;
    root.PvPeakBattleIntelligence = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
