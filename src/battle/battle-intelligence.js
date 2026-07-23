"use strict";

function createPvPeakBattleIntelligenceApi() {
  const perfDebug = typeof globalThis !== "undefined" && globalThis.PvPeakPerfDebug?.enabled
    ? globalThis.PvPeakPerfDebug
    : null;
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

  const PRINCIPLE_TIMING_INTENTS = Object.freeze({
    THROW_NOW: "THROW_NOW",
    WAIT_ONE_FAST: "WAIT_ONE_FAST",
    NO_TIMING_PREFERENCE: "NO_TIMING_PREFERENCE"
  });
  const MIGRATED_PRINCIPLE_CATEGORIES = Object.freeze(["availability", "tactical"]);

  const RULES = Object.freeze([
    rule("BI_ONLY_LEGAL_ACTION", "Only legal action", PRIORITY_CLASSES.LEGALITY, "HEURISTIC_FALLBACK", false, ["AVAIL-001_NO_ACTIVE_CHARGED_MOVE", "AVAIL-002_CHEAPEST_CHARGED_NOT_AFFORDABLE", "ROUTE-026_BUILD_TO_SELECTED_MOVE"]),
    rule("BI_THROW_BEFORE_FAINT", "Throw before fainting", PRIORITY_CLASSES.SURVIVAL_LETHAL, "PENDING_FAST_IMPACT", false, ["TACTICAL-006_FORCED_THROW_BEFORE_FAST_FAINT"]),
    rule("BI_REACHABLE_CHARGED", "Use reachable charged move", PRIORITY_CLASSES.SURVIVAL_LETHAL, "PENDING_FAST_IMPACT", false, ["ROUTE-004_CHARGED_READINESS_CALCULATION", "TACTICAL-006_FORCED_THROW_BEFORE_FAST_FAINT"]),
    rule("BI_GUARANTEED_LETHAL", "Prefer guaranteed lethal", PRIORITY_CLASSES.SURVIVAL_LETHAL, "LETHAL_MOVE_AVAILABLE", false, ["TACTICAL-008_IMMEDIATE_UNSHIELDED_CHARGED_LETHAL"]),
    rule("BI_AVOID_LETHAL_OVERFARM", "Avoid lethal overfarm", PRIORITY_CLASSES.SURVIVAL_LETHAL, "FORCED_BY_OPPONENT_PRESSURE", false, ["SURVIVAL-005_ESTIMATE_SURVIVAL_HORIZON", "TIMING-019_DO_NOT_WAIT_IF_OPPONENT_REACHES_LETHAL_CHARGED_PRESSURE"]),
    rule("BI_ENERGY_CAP_FORCES_THROW", "Throw before energy cap overflow", PRIORITY_CLASSES.RESOURCE, "ENERGY_CAP_FORCES_THROW", false, ["TIMING-016_DO_NOT_WAIT_IF_ENERGY_OVERFLOWS", "TIMING-017_DO_NOT_WAIT_IF_CURRENT_CHARGED_RESOURCES_BECOME_UNUSABLE"]),
    rule("BI_GUARANTEED_EFFECT", "Value guaranteed effects", PRIORITY_CLASSES.FALLBACK, "BETTER_PROJECTED_OUTCOME", true, ["EFFECT-031_APPLY_GUARANTEED_ATTACK_DEFENSE_EFFECTS"]),
    rule("BI_CMP_AWARE", "Respect CMP order", PRIORITY_CLASSES.SURVIVAL_LETHAL, "CMP_WIN_SETUP", false, ["SURVIVAL-005_ESTIMATE_SURVIVAL_HORIZON"]),
    rule("BI_MATCHUP_PLAN", "Execute the best matchup plan", PRIORITY_CLASSES.OUTCOME_EFFECT, "MATCHUP_PLAN_SELECTED", false, ["COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE", "SEARCH-029_BOUND_PLANNER_STATE_COUNT"]),
    rule("BI_HYBRID_BASELINE", "Use the bounded hybrid baseline", PRIORITY_CLASSES.OUTCOME_EFFECT, "BOUNDED_OFFENSIVE_ROUTE", false, ["COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE", "COMPACT-030_ORDER_SEARCH_BY_TIME_BREAKPOINT"]),
    rule("BI_SELECTIVE_DEEP_SEARCH", "Verify an ambiguous hybrid decision", PRIORITY_CLASSES.CONTINUATION, "AMBIGUOUS_DEEP_SEARCH", true, ["SEARCH-029_BOUND_PLANNER_STATE_COUNT", "SEARCH-035_PRUNE_DOMINATED_STATES"]),
    rule("BI_FARM_DOWN", "Use the best farm-down route", PRIORITY_CLASSES.RESOURCE, "FARM_DOWN_ROUTE", false, ["FARM-033_FARM_DOWN_ROUTE_CANDIDATE"]),
    rule("BI_CONTINUATION", "Prefer strongest continuation", PRIORITY_CLASSES.CONTINUATION, "BETTER_PROJECTED_OUTCOME", false, ["COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE", "MOVE-040_PREFER_USEFUL_IMMEDIATE_DAMAGE_WITHOUT_BAIT_CONSTRAINTS"]),
    rule("BI_PCSV", "Prefer strongest projected charged sequence", PRIORITY_CLASSES.CONTINUATION, "PROJECTED_CHARGED_SEQUENCE_VALUE", false, ["ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE", "COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE"]),
    rule("BI_TIMING_CONTINUATION", "Compare throw timing continuations", PRIORITY_CLASSES.CONTINUATION, "OPTIMAL_CHARGE_TIMING", true, ["TIMING-011_OPTIMIZE_CHARGED_TIMING", "TIMING-021_SAFE_TIMING_WAIT_MEANS_ONE_FAST_THEN_REPLAN"]),
    rule("BI_OVERFARM", "Preserve safe overfarm", PRIORITY_CLASSES.RESOURCE, "ENERGY_PRESERVATION", false, ["TIMING-016_DO_NOT_WAIT_IF_ENERGY_OVERFLOWS", "TIMING-017_DO_NOT_WAIT_IF_CURRENT_CHARGED_RESOURCES_BECOME_UNUSABLE"]),
    rule("BI_BAIT_VALUE", "Value credible bait pressure", PRIORITY_CLASSES.RESOURCE, "SHIELD_PRESSURE", false, ["BAIT-024_LONG_MATCHUP_MAY_PREFER_CREDIBLE_BAIT", "BAIT-037_BUILD_ENERGY_TO_REPRESENT_NUKE", "BAIT-038_DO_NOT_BAIT_WHEN_OPPONENT_WOULD_NOT_SHIELD"]),
    rule("BI_TIMING_VALUE", "Improve charged move timing", PRIORITY_CLASSES.RESOURCE, "OPTIMAL_MOVE_TIMING", false, ["TIMING-011_OPTIMIZE_CHARGED_TIMING", "TIMING-012_TARGET_DEPENDS_ON_FAST_DURATIONS", "TIMING-013_DISABLE_SAME_DURATION_OPTIMIZATION", "TIMING-014_DISABLE_EXACT_MULTIPLE_OPTIMIZATION"]),
    rule("BI_SELF_DEBUFF_RISK", "Delay unsafe self debuff", PRIORITY_CLASSES.RESOURCE, "SELF_DEBUFF_TIMING", false, ["EFFECT-027_STACK_SELF_DEBUFFING_MOVES", "EFFECT-042_AVOID_NONLETHAL_SELF_DEBUFF_NUKE_WHILE_HEALTHY"]),
    rule("BI_SELF_DEBUFF_AVOIDANCE", "Preserve stats before self debuff", PRIORITY_CLASSES.OUTCOME_EFFECT, "AVOID_EARLY_SELF_DEBUFF", false, ["MOVE-025_LONG_MATCHUP_MAY_PREFER_NON_DEBUFFING_MOVE", "BAIT-039_AVOID_SELF_DEBUFFING_BAIT_WHEN_INAPPROPRIATE", "EFFECT-042_AVOID_NONLETHAL_SELF_DEBUFF_NUKE_WHILE_HEALTHY"]),
    rule("BI_CANDIDATE_EVIDENCE", "Evaluate strategic evidence", PRIORITY_CLASSES.CONTINUATION, "BETTER_PROJECTED_OUTCOME", false, ["MOVE-040_PREFER_USEFUL_IMMEDIATE_DAMAGE_WITHOUT_BAIT_CONSTRAINTS", "MOVE-041_WITH_SHIELDS_ALLOW_CHEAPER_EFFICIENT_NON_DEBUFFING_MOVE", "TIE-036_PREFER_FEWER_SELF_DEBUFFS_IN_EQUIVALENT_STATES"]),
    rule("BI_SHIELD_POLICY", "Respect explicit shield policy", PRIORITY_CLASSES.LEGALITY, "SHIELD_POLICY_ALWAYS", false, ["SHIELD-034_SHIELDED_CHARGED_CONSUMES_SHIELD", "SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE"]),
    rule("BI_SHIELD_PREVENTS_KO", "Shield to prevent knockout", PRIORITY_CLASSES.SURVIVAL_LETHAL, "SHIELD_PREVENTS_KO", false, ["SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE"]),
    rule("BI_SHIELD_PRESERVES_WIN", "Shield preserves winning continuation", PRIORITY_CLASSES.OUTCOME_EFFECT, "SHIELD_PRESERVES_WIN_CONDITION", true, ["SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE"]),
    rule("BI_SHIELD_AVOIDS_FARM", "Shield avoids farm range", PRIORITY_CLASSES.OUTCOME_EFFECT, "SHIELD_AVOIDS_FARM_RANGE", false, ["SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE"]),
    rule("BI_SHIELD_HEAVY_PRESSURE", "Shield heavy pressure", PRIORITY_CLASSES.RESOURCE, "SHIELD_HEAVY_PRESSURE", false, ["SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE"]),
    rule("BI_SAVE_SHIELD_LOW_THREAT", "Save shield against low threat", PRIORITY_CLASSES.RESOURCE, "SHIELD_SAVED_LOW_THREAT", false, ["SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE"])
  ]);

  const ruleMap = new Map(RULES.map(item => [item.id, item]));
  const fastPathCache = new Map();
  const MAX_CACHE_ENTRIES = 2048;
  const MAX_DECISION_SAMPLES = 8192;
  const statistics = createStatistics();
  const principleStatistics = createPrincipleStatistics();
  const decisionDurations = [];
  const strictByDefault = readStrictModeDefault();
  const auditConfiguration = { enabled: strictByDefault, strict: strictByDefault, retainEvents: strictByDefault };
  let audit = createAuditState();

  function rule(id, name, priorityClass, reasonCode, requiresContinuationSearch = false, principleIds = []) {
    return Object.freeze({
      id,
      name,
      description: name,
      priorityClass,
      reasonCode,
      requiresContinuationSearch,
      principleIds: Object.freeze([...principleIds])
    });
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

  function createPrincipleStatistics() {
    return {
      totalAutomaticDecisions: 0,
      principleEngineResolvedDecisions: 0,
      hybridFallbackDecisions: 0,
      unresolvedPrincipleDecisions: 0,
      hybridOverrideAttemptsBlocked: 0,
      resolvedByCategory: {
        availability: 0,
        tactical: 0,
        timing: 0,
        route: 0,
        farm: 0,
        bait: 0,
        shield: 0,
        effects: 0,
        ambiguity: 0
      },
      fallbackByCategory: {}
    };
  }

  function resetStatistics() {
    Object.assign(statistics, createStatistics());
    Object.assign(principleStatistics, createPrincipleStatistics());
    decisionDurations.length = 0;
  }

  function getStatistics() {
    const sortedDurations = [...decisionDurations].sort((a, b) => a - b);
    return {
      ...statistics,
      averageDecisionMs: statistics.selections ? statistics.totalDecisionMs / statistics.selections : 0,
      medianDecisionMs: percentile(sortedDurations, .5),
      p95DecisionMs: percentile(sortedDurations, .95),
      decisionDurationSamples: [...decisionDurations],
      cacheHitRate: statistics.cacheHits + statistics.cacheMisses
        ? statistics.cacheHits / (statistics.cacheHits + statistics.cacheMisses)
        : 0,
      cacheSize: fastPathCache.size
    };
  }

  function getPrincipleStatistics() {
    const total = principleStatistics.totalAutomaticDecisions;
    return {
      ...principleStatistics,
      resolvedByCategory: { ...principleStatistics.resolvedByCategory },
      fallbackByCategory: { ...principleStatistics.fallbackByCategory },
      fallbackPercentage: total ? principleStatistics.hybridFallbackDecisions / total : 0,
      principleResolvedPercentage: total ? principleStatistics.principleEngineResolvedDecisions / total : 0,
      migratedCategories: [...MIGRATED_PRINCIPLE_CATEGORIES]
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
      events: audit.events.map(event => ({
        ...event,
        ruleIds: [...event.ruleIds],
        principleIds: [...event.principleIds],
        categories: [...event.categories]
      })),
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
      principleIds: [...(input.principleIds || [])],
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
      principleIds: [...(input.principleIds || [])],
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

  function evaluatePrinciples(input = {}) {
    const state = input.state;
    const side = input.side;
    const actor = state?.sides?.[side] || {};
    const opponentSide = opponentOf(side);
    const opponent = state?.sides?.[opponentSide] || {};
    const legalActions = input.legalActions || [];
    const candidates = input.candidates || [];
    const context = input.context || {};
    const fast = candidates.find(candidate => candidate.action.type === ACTION_TYPES.FAST_MOVE) || null;
    const charged = candidates.filter(candidate => candidate.action.type === ACTION_TYPES.CHARGED_MOVE);
    const activeChargedMoves = (actor.chargedMoves || []).filter(Boolean);
    const readiness = chargedReadiness(actor, state, side);
    const evaluated = [
      "AVAIL-001_NO_ACTIVE_CHARGED_MOVE",
      "AVAIL-002_CHEAPEST_CHARGED_NOT_AFFORDABLE",
      "POLICY-003_EXPLICIT_FARM_ENERGY_MODE",
      "ROUTE-004_CHARGED_READINESS_CALCULATION",
      "SURVIVAL-005_ESTIMATE_SURVIVAL_HORIZON",
      "TACTICAL-006_FORCED_THROW_BEFORE_FAST_FAINT",
      "ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE",
      "TACTICAL-008_IMMEDIATE_UNSHIELDED_CHARGED_LETHAL",
      "TACTICAL-009_DO_NOT_THROW_WHEN_FAST_ALREADY_KOS",
      "SPECIAL-010_PROTECTION_FORM_MECHANIC_BREAKER"
    ];
    const triggered = ["ROUTE-004_CHARGED_READINESS_CALCULATION", "SURVIVAL-005_ESTIMATE_SURVIVAL_HORIZON"];
    const rejected = [];
    const baseEvidence = {
      chargedReadiness: readiness,
      survivalHorizon: survivalHorizon(state, side, context),
      canonicalTurn: state?.currentTurn ?? 0
    };

    if (!activeChargedMoves.length && fast) {
      triggered.push("AVAIL-001_NO_ACTIVE_CHARGED_MOVE");
      return resolvedPrinciple(fast, "availability", "FAST_MOVE", triggered, rejected, {
        ...baseEvidence,
        activeChargedMoveCount: 0
      });
    }
    rejected.push("AVAIL-001_NO_ACTIVE_CHARGED_MOVE");

    if (!charged.length && fast) {
      triggered.push("AVAIL-002_CHEAPEST_CHARGED_NOT_AFFORDABLE");
      return resolvedPrinciple(fast, "availability", "FAST_MOVE", triggered, rejected, {
        ...baseEvidence,
        currentEnergy: actor.energy,
        cheapestChargedCost: readiness.length
          ? Math.min(...readiness.map(item => item.energyCost))
          : null
      });
    }
    rejected.push("AVAIL-002_CHEAPEST_CHARGED_NOT_AFFORDABLE");

    const ownPendingFastDamage = maximumPendingImpactDamage(state, opponentSide, side);
    if (fast && opponent.hp > 0 && ownPendingFastDamage >= opponent.hp) {
      triggered.push("TACTICAL-009_DO_NOT_THROW_WHEN_FAST_ALREADY_KOS");
      return resolvedPrinciple(fast, "tactical", "FAST_MOVE", triggered, rejected, {
        ...baseEvidence,
        ownPendingFastDamage,
        opponentHp: opponent.hp
      });
    }
    rejected.push("TACTICAL-009_DO_NOT_THROW_WHEN_FAST_ALREADY_KOS");

    const incomingLethal = nextPendingLethal(state, side);
    if (incomingLethal && charged.length) {
      const selected = bestMeaningfulCharged(charged, context);
      triggered.push("TACTICAL-006_FORCED_THROW_BEFORE_FAST_FAINT");
      return resolvedPrinciple(selected, "tactical", "THROW_BEFORE_FAINT", triggered, rejected, {
        ...baseEvidence,
        pendingEventId: incomingLethal.id,
        resolveTurn: incomingLethal.resolveTurn
      });
    }
    rejected.push("TACTICAL-006_FORCED_THROW_BEFORE_FAST_FAINT");

    if (charged.length && context.opponentLethalBeforeNextWindow === true) {
      const selected = bestMeaningfulCharged(charged, context);
      triggered.push(
        "SURVIVAL-005_ESTIMATE_SURVIVAL_HORIZON",
        "TIMING-019_DO_NOT_WAIT_IF_OPPONENT_REACHES_LETHAL_CHARGED_PRESSURE"
      );
      return resolvedPrinciple(selected, "tactical", "THROW_BEFORE_OPPONENT_LETHAL", triggered, rejected, {
        ...baseEvidence,
        opponentLethalBeforeNextWindow: true
      });
    }

    const lethal = charged
      .filter(candidate => isGuaranteedLethal(candidate, state, side, context))
      .sort((a, b) =>
        actionEnergyCost(a.action) - actionEnergyCost(b.action)
        || damageFor(b, context) - damageFor(a, context)
        || stableCandidateOrder(a, b)
      )[0] || null;
    if (lethal) {
      triggered.push(
        "TACTICAL-008_IMMEDIATE_UNSHIELDED_CHARGED_LETHAL",
        "TIMING-018_DO_NOT_WAIT_IF_CHARGED_ALREADY_KOS"
      );
      return resolvedPrinciple(lethal, "tactical", "IMMEDIATE_LETHAL", triggered, rejected, {
        ...baseEvidence,
        damage: damageFor(lethal, context),
        opponentHp: opponent.hp
      });
    }
    rejected.push("TACTICAL-008_IMMEDIATE_UNSHIELDED_CHARGED_LETHAL");

    const protection = opponent.mechanicState?.chargedProtection;
    if (charged.length && opponent.shields <= 0 && protection?.active === true) {
      const safeCharged = charged.filter(candidate => !hasHarmfulSelfEffect(candidate.action));
      const selected = [...(safeCharged.length ? safeCharged : charged)].sort((a, b) =>
        actionEnergyCost(a.action) - actionEnergyCost(b.action)
        || stableCandidateOrder(a, b)
      )[0];
      triggered.push("SPECIAL-010_PROTECTION_FORM_MECHANIC_BREAKER");
      return resolvedPrinciple(selected, "tactical", "BREAK_PROTECTION", triggered, rejected, {
        ...baseEvidence,
        mechanicCapability: protection.capability || "charged-damage-protection"
      });
    }
    rejected.push("SPECIAL-010_PROTECTION_FORM_MECHANIC_BREAKER");

    const explicitFarm = context.farmEnergy === true
      || actor.linePolicy === "farm-energy"
      || actor.mechanicState?.farmEnergy === true;
    if (explicitFarm && fast) {
      triggered.push("POLICY-003_EXPLICIT_FARM_ENERGY_MODE");
      return resolvedPrinciple(fast, "availability", "FAST_MOVE", triggered, rejected, {
        ...baseEvidence,
        explicitFarmEnergy: true
      });
    }
    rejected.push("POLICY-003_EXPLICIT_FARM_ENERGY_MODE");

    const twoCheapEvidence = twoCheapRouteEvidence(actor, charged);
    if (twoCheapEvidence.retained) triggered.push("ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE");
    else rejected.push("ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE");

    return {
      resolved: false,
      action: null,
      category: null,
      intent: null,
      principleIds: [...new Set(triggered)],
      principlesEvaluated: evaluated,
      principlesTriggered: [...new Set(triggered)],
      principlesRejected: [...new Set(rejected)],
      evidence: { ...baseEvidence, twoCheapRoute: twoCheapEvidence },
      unresolvedCategories: ["timing", "route", "farm", "bait", "shield", "effects", "ambiguity"],
      migratedCategories: [...MIGRATED_PRINCIPLE_CATEGORIES],
      fallbackAllowed: true
    };
  }

  function evaluatePrincipleEngine(input = {}) {
    const side = input.side;
    const state = normalizeState(input.state);
    const legalActions = (input.legalActions || []).map(action => normalizeAction(action, side));
    const candidates = legalActions.map(action => createCandidate(action));
    return evaluatePrinciples({
      ...input,
      side,
      state,
      legalActions,
      candidates,
      policy: resolvePolicy(input.policy),
      context: input.mechanicsCallbacks || input.context || {}
    });
  }

  function resolvedPrinciple(candidate, category, intent, triggered, rejected, evidence) {
    return {
      resolved: true,
      action: candidate?.action || null,
      candidate: candidate || null,
      category,
      intent,
      principleIds: [...new Set(triggered)],
      principlesEvaluated: [...new Set([...triggered, ...rejected])],
      principlesTriggered: [...new Set(triggered)],
      principlesRejected: [...new Set(rejected)],
      evidence,
      unresolvedCategories: [],
      migratedCategories: [...MIGRATED_PRINCIPLE_CATEGORIES],
      fallbackAllowed: false
    };
  }

  function chargedReadiness(actor, state, side) {
    const currentTurn = Math.max(numeric(state?.currentTurn), numeric(actor.readyTurn));
    const energy = clamp(numeric(actor.energy), 0, 100);
    const gain = Math.max(0, numeric(actor.fastMove?.energyGain));
    const turns = Math.max(1, numeric(actor.fastMove?.turns, 1));
    const queuedEnergy = (state?.pendingEvents || []).filter(event =>
      event?.status !== "denied"
      && event?.sourceSide === side
      && Number(event?.metadata?.energyGain || 0) > 0
    ).reduce((sum, event) => sum + Number(event.metadata.energyGain), 0);
    return (actor.chargedMoves || []).filter(Boolean).map(move => {
      const cost = Math.max(0, numeric(move.energyCost));
      const missing = Math.max(0, cost - energy - queuedEnergy);
      const fastCount = missing <= 0 ? 0 : gain > 0 ? Math.ceil(missing / gain) : Infinity;
      return {
        moveId: move.id || null,
        energyCost: cost,
        currentEnergy: energy,
        queuedEnergy,
        fastCount: Number.isFinite(fastCount) ? fastCount : null,
        readyTurn: Number.isFinite(fastCount) ? currentTurn + fastCount * turns : null
      };
    });
  }

  function survivalHorizon(state, side, context) {
    const actor = state?.sides?.[side] || {};
    const opponent = state?.sides?.[opponentOf(side)] || {};
    const nextWindow = Math.max(numeric(state?.currentTurn), numeric(actor.readyTurn))
      + Math.max(1, numeric(actor.fastMove?.turns, 1));
    const pendingDamage = pendingDamageThrough(state, side, nextWindow);
    const opponentChargedReachable = (opponent.chargedMoves || []).some(move =>
      numeric(opponent.energy) >= numeric(move.energyCost)
    );
    return {
      hp: numeric(actor.hp),
      nextOwnActionWindow: nextWindow,
      pendingDamage,
      pendingFastLethal: numeric(actor.hp) > 0 && pendingDamage >= numeric(actor.hp),
      opponentChargedReachable,
      opponentLethalBeforeNextWindow: context.opponentLethalBeforeNextWindow === true,
      cmpReadySides: [...(state?.cmpState?.readySides || [])]
    };
  }

  function pendingDamageThrough(state, targetSide, throughTurn = Infinity, sourceSide = null) {
    return (state?.pendingEvents || []).filter(event =>
      event?.status !== "denied"
      && event?.targetSide === targetSide
      && (!sourceSide || event?.sourceSide === sourceSide)
      && numeric(event?.resolveTurn) >= numeric(state?.currentTurn)
      && numeric(event?.resolveTurn) <= throughTurn
    ).reduce((sum, event) => sum + Math.max(0, numeric(event.damage)), 0);
  }

  function maximumPendingImpactDamage(state, targetSide, sourceSide = null) {
    return (state?.pendingEvents || []).filter(event =>
      event?.status !== "denied"
      && event?.targetSide === targetSide
      && (!sourceSide || event?.sourceSide === sourceSide)
      && numeric(event?.resolveTurn) >= numeric(state?.currentTurn)
    ).reduce((maximum, event) => Math.max(maximum, Math.max(0, numeric(event.damage))), 0);
  }

  function bestMeaningfulCharged(charged, context) {
    return [...charged].sort((a, b) =>
      damageFor(b, context) - damageFor(a, context)
      || actionEnergyCost(a.action) - actionEnergyCost(b.action)
      || stableCandidateOrder(a, b)
    )[0] || null;
  }

  function twoCheapRouteEvidence(actor, charged) {
    if (charged.length < 2) return { retained: false };
    const ordered = [...charged].sort((a, b) =>
      actionEnergyCost(a.action) - actionEnergyCost(b.action)
      || stableCandidateOrder(a, b)
    );
    const cheap = ordered[0];
    const nuke = [...ordered].sort((a, b) =>
      actionEnergyCost(b.action) - actionEnergyCost(a.action)
      || stableCandidateOrder(a, b)
    )[0];
    const cheapCost = actionEnergyCost(cheap.action);
    return {
      retained: cheap !== nuke && cheapCost > 0 && numeric(actor.energy) >= cheapCost * 2,
      cheapMoveId: cheap.action.moveId,
      nukeMoveId: nuke.action.moveId,
      completeRouteRequired: true
    };
  }

  function selectAction(input = {}) {
    const startedAt = now();
    const selectionSpan = perfDebug?.startSpan("battleIntelligence.selection");
    const policy = resolvePolicy(input.policy);
    const side = input.side;
    const context = input.context || {};
    const candidateSpan = perfDebug?.startSpan("candidate.generation");
    const legalActions = (input.legalActions || []).map(action => normalizeAction(action, side));
    const candidates = legalActions.map(action => createCandidate(action));
    perfDebug?.endSpan(candidateSpan);
    perfDebug?.increment("candidate.generated", candidates.length);
    const auditMeta = {
      callerContext: context.callerContext || "unknown",
      cmp: Array.isArray(input.state?.cmpState?.readySides) && input.state.cmpState.readySides.length > 1
    };
    candidates.forEach(candidate => { candidate.auditMeta = auditMeta; });
    statistics.selections++;
    statistics.evaluatedCandidates += candidates.length;
    const state = normalizeState(input.state);

    if (!candidates.length) {
      const result = selectionResult(null, candidates, policy, false, ["NO_LEGAL_ACTION"], "No legal action is available.", {
        principleEngineEvaluated: false,
        fallbackUsed: false,
        finalAuthority: "CANONICAL_LEGALITY"
      });
      finishTiming(startedAt, selectionSpan);
      return result;
    }

    const charged = candidates.filter(candidate => candidate.action.type === ACTION_TYPES.CHARGED_MOVE);
    const fast = candidates.filter(candidate => candidate.action.type === ACTION_TYPES.FAST_MOVE);
    const cacheKey = `${strategicStateKeyFromNormalized(state, policy)}|${legalActions.map(actionKey).join(",")}`;
    const principleEvaluation = evaluatePrinciples({
      state,
      side,
      legalActions,
      candidates,
      policy,
      context
    });
    if (principleEvaluation.resolved && principleEvaluation.candidate) {
      const cached = fastPathCache.get(cacheKey);
      if (cached) {
        const action = legalActions.find(item => actionKey(item) === cached.actionKey);
        if (action) {
          statistics.cacheHits++;
          perfDebug?.recordCache("battle-intelligence", true, { size: fastPathCache.size });
          const result = resultFromCached(action, candidates, cached, policy, principleEvaluation);
          finishTiming(startedAt, selectionSpan);
          return result;
        }
      }
      statistics.cacheMisses++;
      perfDebug?.recordCache("battle-intelligence", false, { size: fastPathCache.size });
      const chosen = principleEvaluation.candidate;
      if (principleEvaluation.category === "availability") {
        applyRule(chosen, "BI_ONLY_LEGAL_ACTION", 100, .99);
      } else if (principleEvaluation.intent === "THROW_BEFORE_FAINT") {
        applyRule(chosen, "BI_THROW_BEFORE_FAINT", 900, .98);
        applyRule(chosen, "BI_REACHABLE_CHARGED", 100, .98);
      } else if (principleEvaluation.intent === "IMMEDIATE_LETHAL") {
        applyRule(chosen, "BI_GUARANTEED_LETHAL", 1000, .99);
      } else if (principleEvaluation.intent === "THROW_BEFORE_OPPONENT_LETHAL") {
        applyRule(chosen, "BI_AVOID_LETHAL_OVERFARM", 800, .9);
      }
      for (const principleId of principleEvaluation.principleIds) {
        if (!chosen.principleIds.includes(principleId)) chosen.principleIds.push(principleId);
      }
      chosen.evidence = { ...(chosen.evidence || {}), principleEngine: principleEvaluation.evidence };
      const result = selectionResult(
        chosen,
        candidates,
        policy,
        true,
        chosen.reasonCodes,
        explainPrincipleDecision(principleEvaluation),
        {
          principleEvaluation,
          fallbackUsed: false,
          principleDecisionPreserved: true,
          finalAuthority: "PRINCIPLE_ENGINE"
        }
      );
      cacheFastPath(cacheKey, result);
      finishTiming(startedAt, selectionSpan);
      return result;
    }

    if (candidates.length === 1) {
      const chosen = applyRule(candidates[0], "BI_ONLY_LEGAL_ACTION", 100, .99);
      const result = selectionResult(chosen, candidates, policy, true, chosen.reasonCodes, "Only one legal action is available.", {
        principleEvaluation,
        fallbackUsed: false,
        principleDecisionPreserved: true,
        finalAuthority: "CANONICAL_LEGALITY"
      });
      finishTiming(startedAt, selectionSpan);
      return result;
    }

    const plannedSelection = selectMatchupPlanAction({
      state,
      side,
      legalActions,
      candidates,
      policy,
      context,
      principleEvaluation
    });
    if (plannedSelection) {
      finishTiming(startedAt, selectionSpan);
      return plannedSelection;
    }
    const cached = fastPathCache.get(cacheKey);
    if (cached) {
      const action = legalActions.find(item => actionKey(item) === cached.actionKey);
      if (action) {
        statistics.cacheHits++;
        perfDebug?.recordCache("battle-intelligence", true, { size: fastPathCache.size });
        const result = resultFromCached(action, candidates, cached, policy, principleEvaluation);
        finishTiming(startedAt, selectionSpan);
        return result;
      }
    }
    statistics.cacheMisses++;
    perfDebug?.recordCache("battle-intelligence", false, { size: fastPathCache.size });

    const energyCapThrow = selectEnergyCapForcedThrow(charged, state, side, context);
    if (energyCapThrow) {
      const chosen = applyRule(energyCapThrow, "BI_ENERGY_CAP_FORCES_THROW", 650, .92, {
        currentEnergy: state.sides[side]?.energy || 0,
        fastEnergyGain: Math.max(0, numeric(state.sides[side]?.fastMove?.energyGain)),
        energyCap: 100
      });
      const result = selectionResult(chosen, candidates, policy, true, chosen.reasonCodes, "Next Fast Move would overflow energy, so the best immediate Charged Move is used before waiting.", {
        principleEvaluation,
        fallbackUsed: false,
        principleDecisionPreserved: true,
        finalAuthority: "LEGACY_DIRECT_GATE"
      });
      cacheFastPath(cacheKey, result);
      finishTiming(startedAt, selectionSpan);
      return result;
    }

    const hybridEvaluation = typeof context.evaluateHybrid === "function"
      ? context.evaluateHybrid()
      : context.hybridEvaluation;
    const hybridSelection = applyHybridEvaluation({
      evaluation: hybridEvaluation,
      legalActions,
      candidates,
      policy,
      cacheKey,
      principleEvaluation
    });
    if (hybridSelection?.result) {
      finishTiming(startedAt, selectionSpan);
      return hybridSelection.result;
    }

    const meaningful = pruneDominatedCandidates(candidates, context);
    for (const candidate of meaningful) {
      if (candidate.action.type !== ACTION_TYPES.CHARGED_MOVE || !hasGuaranteedEffect(candidate, context)) continue;
      applyRule(candidate, "BI_GUARANTEED_EFFECT", 25, .75);
    }

    const evaluationSpan = perfDebug?.startSpan("candidate.evaluation");
    for (const candidate of meaningful) {
      const evidence = typeof context.evaluateCandidate === "function"
        ? context.evaluateCandidate(candidate.action, { state, policy: policy.id })
        : null;
      applyCandidateEvidence(candidate, evidence);
    }
    perfDebug?.endSpan(evaluationSpan);

    const selectable = meaningful.filter(candidate => !candidate.strategicallyExcluded);

    if (typeof context.evaluateContinuation === "function") {
      const timingComparison = selectable.some(candidate =>
        candidate?.evidence?.candidateEvaluation?.ruleIds?.includes("BI_TIMING_CONTINUATION")
      );
      // PCSV normally compares only Charged candidates. A timing window is a
      // stricter decision: it must keep Fast/Wait alternatives in the set, or
      // the engine silently loses the alignment line before it is evaluated.
      const fullChargedComparison = context.forceChargedContinuation === true && !timingComparison;
      const hybridComparison = hybridEvaluation?.ambiguity?.ambiguous === true;
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
        const continuationSpan = perfDebug?.startSpan("continuation.search");
        const searched = boundedContinuation(searchCandidates, state, policy, context, now(), {
          // PCSV is only trustworthy when both legal charged alternatives are
          // simulated from the same state. Timing additionally includes Fast
          // and, where legal, a one-turn alignment wait.
          minimumComparableCandidates: timingComparison
            ? Math.min(4, searchCandidates.length)
            : fullChargedComparison ? Math.min(2, searchCandidates.length)
            : hybridComparison ? searchCandidates.length
            : 1
        });
        if (searched) {
          applyRule(searched, searched.evidence?.continuation?.pcsv ? "BI_PCSV" : "BI_CONTINUATION", 0, .92);
        }
        perfDebug?.endSpan(continuationSpan);
      }
    }

    const fallback = [...selectable].sort(compareCandidates)[0] || candidates[0];
    applyRule(fallback, "BI_CANDIDATE_EVIDENCE", 0, .7);
    const result = selectionResult(fallback, candidates, policy, false, fallback.reasonCodes, explainSelection(fallback), {
      principleEvaluation,
      fallbackUsed: typeof context.evaluateHybrid === "function" || !!context.hybridEvaluation,
      fallbackReason: "PRINCIPLE_CATEGORIES_UNRESOLVED",
      fallbackResult: hybridEvaluation ? {
        decisive: hybridEvaluation.decisive === true,
        reasonCodes: [...(hybridEvaluation.reasonCodes || [])],
        action: hybridEvaluation.action || null
      } : null,
      principleDecisionPreserved: true,
      finalAuthority: hybridEvaluation ? "HYBRID_FALLBACK_WITH_LEGACY_COMPLETION" : "LEGACY_CANDIDATE_EVALUATION"
    });
    finishTiming(startedAt, selectionSpan);
    return result;
  }

  function applyHybridEvaluation(input = {}) {
    const evaluation = input.evaluation;
    if (!evaluation?.action) return null;
    const normalized = normalizeAction(evaluation.action, evaluation.action.side);
    const legalAction = input.legalActions.find(action => actionKey(action) === actionKey(normalized));
    const chosen = input.candidates.find(candidate => actionKey(candidate.action) === actionKey(normalized));
    if (!legalAction || !chosen) return null;
    chosen.evidence = {
      ...(chosen.evidence || {}),
      hybrid: {
        timing: evaluation.timing || null,
        routePlan: evaluation.routePlan || null,
        ambiguity: evaluation.ambiguity || null,
        completeness: evaluation.completeness || "unknown"
      }
    };
    if (evaluation.decisive) {
      for (const reasonCode of evaluation.reasonCodes || []) {
        if (!chosen.reasonCodes.includes(reasonCode)) chosen.reasonCodes.push(reasonCode);
      }
      if (evaluation.reasonCodes?.includes("FARM_DOWN_ROUTE")) {
        applyRule(chosen, "BI_FARM_DOWN", 0, .92);
      } else {
        applyRule(chosen, "BI_HYBRID_BASELINE", 0, .94);
      }
      const result = selectionResult(
        chosen,
        input.candidates,
        input.policy,
        evaluation.fastPath === true,
        chosen.reasonCodes,
        evaluation.explanation || "Selected by the bounded hybrid baseline.",
        {
          principleEvaluation: input.principleEvaluation,
          fallbackUsed: true,
          fallbackReason: "PRINCIPLE_CATEGORIES_UNRESOLVED",
          fallbackResult: {
            decisive: true,
            reasonCodes: [...(evaluation.reasonCodes || [])],
            action: chosen.action
          },
          principleDecisionPreserved: true,
          finalAuthority: "HYBRID_FALLBACK"
        }
      );
      cacheFastPath(input.cacheKey, result);
      return { result, chosen };
    }

    const alternativeKeys = new Set((evaluation.ambiguity?.alternatives || [])
      .map(alternative => actionIntentKey(normalizeAction(alternative.firstAction || {}, normalized.side))));
    for (const candidate of input.candidates) {
      if (!alternativeKeys.has(actionIntentKey(candidate.action))) continue;
      candidate.requiresContinuationSearch = true;
      candidate.evidence = {
        ...(candidate.evidence || {}),
        hybridAlternative: (evaluation.ambiguity?.alternatives || []).find(alternative =>
          actionIntentKey(normalizeAction(alternative.firstAction || {}, normalized.side)) === actionIntentKey(candidate.action)
        ) || null
      };
      // Search eligibility is not a preference. Elevating every ambiguous
      // alternative into the continuation priority class changes the result
      // before any continuation has been compared.
      if (!candidate.sourceRuleIds.includes("BI_SELECTIVE_DEEP_SEARCH")) {
        candidate.sourceRuleIds.push("BI_SELECTIVE_DEEP_SEARCH");
      }
      candidate.confidence = Math.max(candidate.confidence, .82);
    }
    return { result: null, chosen };
  }

  function selectMatchupPlanAction(input) {
    const { state, side, legalActions, candidates, policy, context, principleEvaluation } = input;
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
      plan?.explanation || "Selected the first legal action of the best reachable matchup plan.",
      {
        principleEvaluation,
        fallbackUsed: false,
        principleDecisionPreserved: true,
        finalAuthority: "MATCHUP_PLANNER"
      }
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

  function explainPrincipleDecision(evaluation) {
    if (evaluation.intent === "FAST_MOVE" && evaluation.category === "availability") {
      return "The Principle Engine determined that no Charged action is currently available or affordable.";
    }
    if (evaluation.intent === "FAST_MOVE") {
      return "A canonical pending Fast impact already guarantees the knockout, so Charged energy is preserved.";
    }
    if (evaluation.intent === "THROW_BEFORE_FAINT") {
      return "The survival horizon leaves one final legal Charged action window.";
    }
    if (evaluation.intent === "THROW_BEFORE_OPPONENT_LETHAL") {
      return "Waiting gives the opponent canonically lethal Charged pressure.";
    }
    if (evaluation.intent === "IMMEDIATE_LETHAL") {
      return "The cheapest legal unshielded Charged Move guarantees the knockout.";
    }
    if (evaluation.intent === "BREAK_PROTECTION") {
      return "The cheapest safe Charged Move breaks the active generic protection mechanic.";
    }
    return "The Principle Engine directly resolved the action.";
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
      principleIds: definition ? [...(definition.principleIds || [])] : [],
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
      // A provisional rollout winner is not a certified battle outcome.
      // Outcome classes outrank heuristics only when the evaluator reached a
      // complete terminal state; incomplete evidence remains a score/tie-break.
      candidate.outcomeClass = evaluation.complete === true
        ? normalizeOutcomeClass(evaluation.outcome)
        : null;
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

  function selectEnergyCapForcedThrow(charged, state, side, context) {
    if (!charged?.length) return null;
    const actor = state.sides?.[side] || {};
    const currentEnergy = clamp(numeric(actor.energy), 0, 100);
    if (numeric(state.currentTurn) <= 0 && currentEnergy >= 100) return null;
    const fastEnergyGain = Math.max(0, numeric(actor.fastMove?.energyGain));
    if (fastEnergyGain <= 0 || currentEnergy + fastEnergyGain <= 100) return null;
    return [...charged].sort((a, b) =>
      damageFor(b, context) - damageFor(a, context)
      || actionEnergyCost(a.action) - actionEnergyCost(b.action)
      || stableCandidateOrder(a, b)
    )[0] || null;
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
    for (const principleId of definition.principleIds || []) {
      if (!candidate.principleIds.includes(principleId)) candidate.principleIds.push(principleId);
    }
    if (definition.reasonCode && !candidate.reasonCodes.includes(definition.reasonCode)) candidate.reasonCodes.push(definition.reasonCode);
    candidate.priorityClass = Math.min(candidate.priorityClass, definition.priorityClass);
    candidate.tacticalScore += Number(score || 0);
    candidate.confidence = Math.max(candidate.confidence, Number(confidence || 0));
    candidate.requiresContinuationSearch ||= definition.requiresContinuationSearch;
    if (evidence) candidate.evidence = { ...(candidate.evidence || {}), [ruleId]: evidence };
    return candidate;
  }

  function selectionResult(candidate, candidates, policy, fastPath, reasonCodes, explanation, authority = {}) {
    if (fastPath) statistics.fastPathSelections++;
    const result = {
      action: candidate?.action || null,
      chosenCandidate: candidate || null,
      candidates,
      policy: policy.id,
      fastPath: !!fastPath,
      sourceRuleIds: [...(candidate?.sourceRuleIds || [])],
      principleIds: [...(candidate?.principleIds || [])],
      reasonCodes: [...new Set(reasonCodes || [])],
      explanation: explanation || "",
      evidence: candidate?.evidence || null
    };
    const forcedPolicy = candidate?.sourceRuleIds?.includes("BI_ONLY_LEGAL_ACTION");
    const source = forcedPolicy ? "forced-policy" : "battle-intelligence";
    const audited = attachAudit(result, {
      source,
      action: result.action,
      ruleIds: result.sourceRuleIds,
      principleIds: result.principleIds,
      policy: policy.id,
      callerContext: candidate?.auditMeta?.callerContext || "unknown",
      categories: decisionCategories(candidate),
      fallbackReasonCode: null,
      intelligenceOwned: true
    });
    return attachPrincipleAuthority(audited, authority);
  }

  function attachPrincipleAuthority(result, authority = {}) {
    const evaluation = authority.principleEvaluation || null;
    const fallbackUsed = authority.fallbackUsed === true;
    const resolved = evaluation?.resolved === true;
    const category = evaluation?.category || null;
    principleStatistics.totalAutomaticDecisions++;
    if (resolved) {
      principleStatistics.principleEngineResolvedDecisions++;
      if (category && Object.prototype.hasOwnProperty.call(principleStatistics.resolvedByCategory, category)) {
        principleStatistics.resolvedByCategory[category]++;
      }
    } else {
      principleStatistics.unresolvedPrincipleDecisions++;
    }
    if (fallbackUsed) {
      principleStatistics.hybridFallbackDecisions++;
      for (const unresolved of evaluation?.unresolvedCategories || ["unknown"]) {
        principleStatistics.fallbackByCategory[unresolved] = (principleStatistics.fallbackByCategory[unresolved] || 0) + 1;
      }
    }
    if (authority.overrideBlocked === true) principleStatistics.hybridOverrideAttemptsBlocked++;
    const principleResult = evaluation
      ? {
        resolved,
        category,
        intent: evaluation.intent || null,
        action: evaluation.action || null,
        principleIds: [...(evaluation.principleIds || [])],
        evidence: evaluation.evidence || null,
        fallbackAllowed: evaluation.fallbackAllowed === true
      }
      : null;
    return {
      ...result,
      principleEngineEvaluated: authority.principleEngineEvaluated ?? !!evaluation,
      migratedCategoriesEvaluated: [...(evaluation?.migratedCategories || [])],
      principlesTriggered: [...(evaluation?.principlesTriggered || [])],
      principlesRejected: [...(evaluation?.principlesRejected || [])],
      principleResult,
      principleResolved: resolved,
      fallbackUsed,
      fallbackReason: authority.fallbackReason || null,
      unresolvedCategories: [...(evaluation?.unresolvedCategories || [])],
      migratedCategories: [...(evaluation?.migratedCategories || [])],
      fallbackResult: authority.fallbackResult || null,
      principleDecisionPreserved: authority.principleDecisionPreserved !== false,
      finalAction: result.action || null,
      overrideBlocked: authority.overrideBlocked === true,
      finalAuthority: authority.finalAuthority || (resolved ? "PRINCIPLE_ENGINE" : "LEGACY_DIRECT_GATE")
    };
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
      principleIds: [...(entry.principleIds || result.principleIds || [])],
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
      principleIds: [...(entry.principleIds || [])],
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
      principleIds: result.principleIds,
      reasonCodes: result.reasonCodes,
      explanation: result.explanation,
      evidence: result.evidence
    });
  }

  function resultFromCached(action, candidates, cached, policy, principleEvaluation = null) {
    const candidate = candidates.find(item => actionKey(item.action) === cached.actionKey) || createCandidate(action);
    candidate.sourceRuleIds = [...cached.sourceRuleIds];
    candidate.principleIds = [...(cached.principleIds || [])];
    candidate.reasonCodes = [...cached.reasonCodes, "MEMOIZED_RESULT"];
    candidate.evidence = cached.evidence;
    return selectionResult(candidate, candidates, policy, true, candidate.reasonCodes, cached.explanation, {
      principleEvaluation,
      fallbackUsed: false,
      principleDecisionPreserved: true,
      finalAuthority: cached.finalAuthority || "MEMOIZED_DIRECT_RESULT"
    });
  }

  function compareCandidates(a, b) {
    const outcomeA = outcomeRank(a.outcomeClass);
    const outcomeB = outcomeRank(b.outcomeClass);
    const continuationA = a.continuationScore == null ? -Infinity : a.continuationScore;
    const continuationB = b.continuationScore == null ? -Infinity : b.continuationScore;
    const timingQualityA = numeric(a.evidence?.continuation?.timingQuality?.score);
    const timingQualityB = numeric(b.evidence?.continuation?.timingQuality?.score);
    return (outcomeA >= 0 && outcomeB >= 0 ? outcomeB - outcomeA : 0)
      || a.priorityClass - b.priorityClass
      || continuationB - continuationA
      // When two complete continuations reach the same outcome and resources,
      // prefer the line whose first Charged Move lands deeper inside the
      // opponent's active Fast Move. This is a deterministic timing tie-break,
      // never a substitute for a stronger continuation.
      || timingQualityB - timingQualityA
      || b.tacticalScore - a.tacticalScore
      || stableCandidateOrder(a, b);
  }

  function normalizeOutcomeClass(value) {
    const outcome = String(value || "").toLowerCase();
    return ["win", "draw", "loss"].includes(outcome) ? outcome : null;
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

  function actionIntentKey(action) {
    return [action?.type || "none", action?.side || "?", action?.moveId || "none"].join(":");
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
    if (typeof globalThis !== "undefined" && globalThis.PVPEAK_DETERMINISTIC_PLANNER_TIME === true) return 0;
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }

  function finishTiming(startedAt, perfSpan = null) {
    const duration = Math.max(0, now() - startedAt);
    statistics.totalDecisionMs += duration;
    statistics.maxDecisionMs = Math.max(statistics.maxDecisionMs, duration);
    const sampleIndex = Math.max(0, statistics.selections - 1) % MAX_DECISION_SAMPLES;
    decisionDurations[sampleIndex] = duration;
    perfDebug?.endSpan(perfSpan);
  }

  function percentile(sortedValues, fraction) {
    if (!sortedValues.length) return 0;
    const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * fraction) - 1));
    return sortedValues[index];
  }

  return Object.freeze({
    createApi: createPvPeakBattleIntelligenceApi,
    ACTION_TYPES,
    STRATEGIC_STATE_SCHEMA_VERSION,
    PRIORITY_CLASSES,
    POLICIES,
    PRINCIPLE_TIMING_INTENTS,
    MIGRATED_PRINCIPLE_CATEGORIES,
    RULES,
    PrincipleEngine: Object.freeze({
      evaluate: evaluatePrincipleEngine,
      getStatistics: getPrincipleStatistics
    }),
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
    getPrincipleStatistics,
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
