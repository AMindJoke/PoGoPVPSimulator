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
  const MIGRATED_PRINCIPLE_CATEGORIES = Object.freeze([
    "availability",
    "policy",
    "tactical",
    "timing",
    "route",
    "compact-planner",
    "farm",
    "shield",
    "bait",
    "move-ordering",
    "effect-sequencing",
    "chance-policy",
    "outcome-comparison",
    "ambiguity",
    "search",
    "tie-break",
    "performance",
    "long-match"
  ]);

  const RULES = Object.freeze([
    rule("BI_ONLY_LEGAL_ACTION", "Only legal action", PRIORITY_CLASSES.LEGALITY, "HEURISTIC_FALLBACK", false, ["AVAIL-001_NO_ACTIVE_CHARGED_MOVE", "AVAIL-002_CHEAPEST_CHARGED_NOT_AFFORDABLE", "ROUTE-026_BUILD_TO_SELECTED_MOVE"]),
    rule("BI_THROW_BEFORE_FAINT", "Throw before fainting", PRIORITY_CLASSES.SURVIVAL_LETHAL, "PENDING_FAST_IMPACT", false, ["TACTICAL-006_FORCED_THROW_BEFORE_FAST_FAINT"]),
    rule("BI_REACHABLE_CHARGED", "Use reachable charged move", PRIORITY_CLASSES.SURVIVAL_LETHAL, "PENDING_FAST_IMPACT", false, ["ROUTE-004_CHARGED_READINESS_CALCULATION", "TACTICAL-006_FORCED_THROW_BEFORE_FAST_FAINT"]),
    rule("BI_GUARANTEED_LETHAL", "Prefer guaranteed lethal", PRIORITY_CLASSES.SURVIVAL_LETHAL, "LETHAL_MOVE_AVAILABLE", false, ["TACTICAL-008_IMMEDIATE_UNSHIELDED_CHARGED_LETHAL"]),
    rule("BI_AVOID_LETHAL_OVERFARM", "Avoid lethal overfarm", PRIORITY_CLASSES.SURVIVAL_LETHAL, "FORCED_BY_OPPONENT_PRESSURE", false, ["SURVIVAL-005_ESTIMATE_SURVIVAL_HORIZON", "TIMING-019_DO_NOT_WAIT_IF_OPPONENT_REACHES_LETHAL_CHARGED_PRESSURE"]),
    rule("BI_GUARANTEED_EFFECT", "Value guaranteed effects", PRIORITY_CLASSES.FALLBACK, "BETTER_PROJECTED_OUTCOME", true, ["EFFECT-031_APPLY_GUARANTEED_ATTACK_DEFENSE_EFFECTS"]),
    rule("BI_CMP_AWARE", "Respect CMP order", PRIORITY_CLASSES.SURVIVAL_LETHAL, "CMP_WIN_SETUP", false, ["SURVIVAL-005_ESTIMATE_SURVIVAL_HORIZON"]),
    rule("BI_MATCHUP_PLAN", "Execute the best matchup plan", PRIORITY_CLASSES.OUTCOME_EFFECT, "MATCHUP_PLAN_SELECTED", false, ["COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE", "SEARCH-029_BOUND_PLANNER_STATE_COUNT"]),
    rule("BI_PRINCIPLE_COMPACT_ROUTE", "Execute the principle-owned compact route", PRIORITY_CLASSES.OUTCOME_EFFECT, "COMPACT_ROUTE_GENERATED", false, ["ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE", "COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE", "COMPACT-030_ORDER_SEARCH_BY_TIME_BREAKPOINT"]),
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
      "SPECIAL-010_PROTECTION_FORM_MECHANIC_BREAKER",
      "TIMING-011_OPTIMIZE_CHARGED_TIMING",
      "TIMING-012_TARGET_DEPENDS_ON_FAST_DURATIONS",
      "TIMING-013_DISABLE_SAME_DURATION_OPTIMIZATION",
      "TIMING-014_DISABLE_EXACT_MULTIPLE_OPTIMIZATION",
      "TIMING-015_DO_NOT_WAIT_IF_ACTOR_FAINTS",
      "TIMING-016_DO_NOT_WAIT_IF_ENERGY_OVERFLOWS",
      "TIMING-017_DO_NOT_WAIT_IF_CURRENT_CHARGED_RESOURCES_BECOME_UNUSABLE",
      "TIMING-018_DO_NOT_WAIT_IF_CHARGED_ALREADY_KOS",
      "TIMING-019_DO_NOT_WAIT_IF_OPPONENT_REACHES_LETHAL_CHARGED_PRESSURE",
      "TIMING-020_DO_NOT_WAIT_IF_FITTED_FAST_MOVES_ARE_LETHAL",
      "TIMING-021_SAFE_TIMING_WAIT_MEANS_ONE_FAST_THEN_REPLAN"
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

    const compactRoute = evaluateCompactRoutePrinciples({
      state,
      side,
      actor,
      opponent,
      candidates,
      fast,
      charged,
      context,
      policy: input.policy
    });
    triggered.push(...compactRoute.principlesTriggered);
    rejected.push(...compactRoute.principlesRejected);
    if (compactRoute.resolved && compactRoute.candidate) {
      return resolvedPrinciple(
        compactRoute.candidate,
        "route",
        "COMPACT_ROUTE",
        triggered,
        rejected,
        { ...baseEvidence, twoCheapRoute: compactRoute.twoCheapRoute, compactRoute: compactRoute.evidence }
      );
    }

    const timing = evaluateTimingPrinciples({
      state,
      side,
      actor,
      opponent,
      fast,
      charged,
      context,
      readiness,
      survival: baseEvidence.survivalHorizon
    });
    triggered.push(...timing.principlesTriggered);
    rejected.push(...timing.principlesRejected);
    if (timing.intent === PRINCIPLE_TIMING_INTENTS.WAIT_ONE_FAST && fast) {
      return resolvedPrinciple(
        fast,
        "timing",
        PRINCIPLE_TIMING_INTENTS.WAIT_ONE_FAST,
        triggered,
        rejected,
        { ...baseEvidence, twoCheapRoute: twoCheapEvidence, compactRoute: compactRoute.evidence, timing: timing.evidence }
      );
    }
    const directStrategy = evaluateDirectStrategicPrinciples({
      state,
      side,
      actor,
      opponent,
      candidates,
      fast,
      charged,
      context,
      policy: input.policy,
      timingIntent: timing.intent
    });
    evaluated.push(...directStrategy.principlesEvaluated);
    triggered.push(...directStrategy.principlesTriggered);
    rejected.push(...directStrategy.principlesRejected);
    if (directStrategy.candidate) {
      return {
        ...resolvedPrinciple(
          directStrategy.candidate,
          directStrategy.category,
          directStrategy.intent,
          triggered,
          rejected,
          {
            ...baseEvidence,
            twoCheapRoute: twoCheapEvidence,
            compactRoute: compactRoute.evidence,
            timing: timing.evidence,
            directStrategy: directStrategy.evidence
          }
        ),
        principlesEvaluated: [...new Set(evaluated)]
      };
    }

    const onlyLegal = candidates[0] || null;
    return {
      ...resolvedPrinciple(
        onlyLegal,
        "availability",
        "ONLY_LEGAL_ACTION",
        [...triggered, "AVAIL-001_NO_ACTIVE_CHARGED_MOVE"],
        rejected,
        {
          ...baseEvidence,
          unsupportedStrategicState: true,
          legalActionCount: candidates.length
        }
      ),
      principlesEvaluated: [...new Set(evaluated)]
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

  function evaluateDirectStrategicPrinciples(input = {}) {
    const principlesEvaluated = [
      "PERF-022_DETECT_LONG_REPEATED_CYCLE_MATCHUPS",
      "LONG-023_LONG_MATCHUP_STARTS_FROM_BEST_CHARGED_CYCLE",
      "BAIT-024_LONG_MATCHUP_MAY_PREFER_CREDIBLE_BAIT",
      "MOVE-025_LONG_MATCHUP_MAY_PREFER_NON_DEBUFFING_MOVE",
      "ROUTE-026_BUILD_TO_SELECTED_MOVE",
      "EFFECT-027_STACK_SELF_DEBUFFING_MOVES",
      "EFFECT-031_APPLY_GUARANTEED_ATTACK_DEFENSE_EFFECTS",
      "CHANCE-032_DO_NOT_EXPLODE_ORDINARY_SEARCH_ON_CHANCE_EFFECTS",
      "FARM-033_FARM_DOWN_ROUTE_CANDIDATE",
      "TIE-036_PREFER_FEWER_SELF_DEBUFFS_IN_EQUIVALENT_STATES",
      "BAIT-037_BUILD_ENERGY_TO_REPRESENT_NUKE",
      "BAIT-038_DO_NOT_BAIT_WHEN_OPPONENT_WOULD_NOT_SHIELD",
      "BAIT-039_AVOID_SELF_DEBUFFING_BAIT_WHEN_INAPPROPRIATE",
      "MOVE-040_PREFER_USEFUL_IMMEDIATE_DAMAGE_WITHOUT_BAIT_CONSTRAINTS",
      "MOVE-041_WITH_SHIELDS_ALLOW_CHEAPER_EFFICIENT_NON_DEBUFFING_MOVE",
      "EFFECT-042_AVOID_NONLETHAL_SELF_DEBUFF_NUKE_WHILE_HEALTHY"
      ,"SEARCH-029_BOUND_PLANNER_STATE_COUNT"
      ,"SEARCH-035_PRUNE_DOMINATED_STATES"
    ];
    const principlesTriggered = [];
    const principlesRejected = [];
    const actor = input.actor || {};
    const opponent = input.opponent || {};
    const charged = input.charged || [];
    const fast = input.fast || null;
    const context = input.context || {};
    const moveRoutes = charged.map(candidate => principleMoveRoute(candidate, input));
    const farmRoute = principleFarmDownRoute(input);
    const ambiguity = detectPrincipleAmbiguity([...moveRoutes, farmRoute]);
    const selectiveContinuation = evaluateSelectivePrincipleContinuation(
      [...moveRoutes, farmRoute],
      ambiguity,
      input
    );
    principlesTriggered.push("FARM-033_FARM_DOWN_ROUTE_CANDIDATE");
    if (ambiguity.detected) principlesTriggered.push("SEARCH-029_BOUND_PLANNER_STATE_COUNT");
    else principlesRejected.push("SEARCH-029_BOUND_PLANNER_STATE_COUNT");
    if (selectiveContinuation.prunedAlternatives.length) principlesTriggered.push("SEARCH-035_PRUNE_DOMINATED_STATES");
    else principlesRejected.push("SEARCH-035_PRUNE_DOMINATED_STATES");
    const buildToLethal = principleBuildToLethalRoute(input);
    if (buildToLethal.safe && fast) {
      principlesTriggered.push(
        "ROUTE-026_BUILD_TO_SELECTED_MOVE",
        "MOVE-040_PREFER_USEFUL_IMMEDIATE_DAMAGE_WITHOUT_BAIT_CONSTRAINTS"
      );
      return {
        candidate: fast,
        category: "route",
        intent: "BUILD_TO_SELECTED_MOVE",
        principlesEvaluated,
        principlesTriggered,
        principlesRejected,
        evidence: {
          buildToLethal,
          ambiguity,
          selectiveContinuation,
          farmRoute: principleRouteEvidence(farmRoute),
          chargedRoutes: moveRoutes.map(principleRouteEvidence)
        }
      };
    }
    const buildToPreferred = principleBuildToPreferredMove(input, moveRoutes);
    if (buildToPreferred.safe && fast) {
      principlesTriggered.push("ROUTE-026_BUILD_TO_SELECTED_MOVE");
      principlesTriggered.push(
        buildToPreferred.guaranteedEffect
          ? "EFFECT-031_APPLY_GUARANTEED_ATTACK_DEFENSE_EFFECTS"
          : "MOVE-040_PREFER_USEFUL_IMMEDIATE_DAMAGE_WITHOUT_BAIT_CONSTRAINTS"
      );
      return {
        candidate: fast,
        category: buildToPreferred.guaranteedEffect ? "effects" : "route",
        intent: "BUILD_TO_SELECTED_MOVE",
        principlesEvaluated,
        principlesTriggered,
        principlesRejected,
        evidence: {
          buildToLethal,
          buildToPreferred,
          ambiguity,
          selectiveContinuation,
          farmRoute: principleRouteEvidence(farmRoute),
          chargedRoutes: moveRoutes.map(principleRouteEvidence)
        }
      };
    }

    if (farmRoute.safe && farmRoute.certifiedOutcome === "win" && fast) {
      const fastestChargedLethal = moveRoutes
        .filter(route => route.certifiedOutcome === "win")
        .sort(comparePrincipleOutcomeRoutes)[0] || null;
      if (!fastestChargedLethal || comparePrincipleOutcomeRoutes(farmRoute, fastestChargedLethal) < 0) {
        return {
          candidate: fast,
          category: "farm",
          intent: "FARM_DOWN_ROUTE",
          principlesEvaluated,
          principlesTriggered,
          principlesRejected,
          evidence: {
            farmRoute: principleRouteEvidence(farmRoute),
            chargedRoutes: moveRoutes.map(principleRouteEvidence),
            ambiguity,
            selectiveContinuation
          }
        };
      }
    }

    const baitPolicy = normalizeBaitPolicy(actor.baiting);
    const orderedByCost = [...moveRoutes].sort((a, b) =>
      a.energyCost - b.energyCost || stableCandidateOrder(a.candidate, b.candidate)
    );
    const orderedByPressure = [...moveRoutes].sort((a, b) =>
      b.damage - a.damage
      || b.damagePerEnergy - a.damagePerEnergy
      || a.energyCost - b.energyCost
      || stableCandidateOrder(a.candidate, b.candidate)
    );
    const cheap = orderedByCost[0] || null;
    const expensiveThreat = orderedByPressure[0] || null;
    const hasDistinctBait = !!(cheap && expensiveThreat && cheap.candidate !== expensiveThreat.candidate);
    const threatWouldShield = !!(expensiveThreat
      && numeric(opponent.shields) > 0
      && (typeof context.willOpponentShield !== "function"
        || context.willOpponentShield(expensiveThreat.candidate.action)));
    const baitCredible = hasDistinctBait
      && threatWouldShield
      && numeric(actor.energy) >= expensiveThreat.energyCost
      && cheap.damage >= expensiveThreat.damage * .7;

    if (baitPolicy !== "off" && hasDistinctBait && numeric(opponent.shields) > 0) {
      if (threatWouldShield) {
        principlesTriggered.push("BAIT-024_LONG_MATCHUP_MAY_PREFER_CREDIBLE_BAIT");
        if (!baitCredible && fast && cheap.damage >= expensiveThreat.damage * .7) {
          principlesTriggered.push("BAIT-037_BUILD_ENERGY_TO_REPRESENT_NUKE", "ROUTE-026_BUILD_TO_SELECTED_MOVE");
          return {
            candidate: fast,
            category: "bait",
            intent: "BUILD_TO_CREDIBLE_NUKE",
            principlesEvaluated,
            principlesTriggered,
            principlesRejected,
            evidence: {
              baitPolicy,
              buildToLethal,
              ambiguity,
              selectiveContinuation,
              baitCredible: false,
              currentEnergy: numeric(actor.energy),
              representedEnergy: expensiveThreat.energyCost,
              cheapMoveId: cheap.candidate.action.moveId,
              threatMoveId: expensiveThreat.candidate.action.moveId,
              farmRoute: principleRouteEvidence(farmRoute),
              chargedRoutes: moveRoutes.map(principleRouteEvidence)
            }
          };
        }
        principlesRejected.push("BAIT-037_BUILD_ENERGY_TO_REPRESENT_NUKE");
        const cheapIsUnsafeSelfDebuff = cheap.selfDebuffing
          && moveRoutes.some(route => !route.selfDebuffing && route.damage >= cheap.damage);
        if (cheapIsUnsafeSelfDebuff) {
          principlesTriggered.push("BAIT-039_AVOID_SELF_DEBUFFING_BAIT_WHEN_INAPPROPRIATE");
        } else if (baitCredible && (baitPolicy === "always" || baitPolicy === "selective")) {
          principlesRejected.push("BAIT-039_AVOID_SELF_DEBUFFING_BAIT_WHEN_INAPPROPRIATE");
          principlesTriggered.push(
            "SHIELD-034_SHIELDED_CHARGED_CONSUMES_SHIELD",
            "MOVE-041_WITH_SHIELDS_ALLOW_CHEAPER_EFFICIENT_NON_DEBUFFING_MOVE"
          );
          return {
            candidate: cheap.candidate,
            category: "bait",
            intent: baitPolicy === "always" ? "ALWAYS_BAIT" : "SELECTIVE_CREDIBLE_BAIT",
            principlesEvaluated,
            principlesTriggered,
            principlesRejected,
            evidence: {
              baitPolicy,
              buildToLethal,
              ambiguity,
              selectiveContinuation,
              baitCredible: true,
              threatWouldShield,
              cheapMoveId: cheap.candidate.action.moveId,
              threatMoveId: expensiveThreat.candidate.action.moveId,
              shieldedDamage: 1,
              shieldConsumed: 1,
              farmRoute: principleRouteEvidence(farmRoute),
              chargedRoutes: moveRoutes.map(principleRouteEvidence)
            }
          };
        }
      } else {
        principlesTriggered.push("BAIT-038_DO_NOT_BAIT_WHEN_OPPONENT_WOULD_NOT_SHIELD");
      }
    } else {
      principlesRejected.push(
        "BAIT-024_LONG_MATCHUP_MAY_PREFER_CREDIBLE_BAIT",
        "BAIT-037_BUILD_ENERGY_TO_REPRESENT_NUKE",
        "BAIT-039_AVOID_SELF_DEBUFFING_BAIT_WHEN_INAPPROPRIATE"
      );
      if (numeric(opponent.shields) <= 0) principlesTriggered.push("BAIT-038_DO_NOT_BAIT_WHEN_OPPONENT_WOULD_NOT_SHIELD");
      else principlesRejected.push("BAIT-038_DO_NOT_BAIT_WHEN_OPPONENT_WOULD_NOT_SHIELD");
    }

    const stableRoutes = moveRoutes.filter(route => !route.selfDebuffing);
    const healthy = numeric(actor.maxHp) > 0 && numeric(actor.hp) / numeric(actor.maxHp) > .5;
    const bestSelfDebuff = orderedByPressure.find(route => route.selfDebuffing) || null;
    const strongStableRoutes = bestSelfDebuff
      ? stableRoutes.filter(route => route.damage >= bestSelfDebuff.damage * .8)
      : stableRoutes;
    if (bestSelfDebuff && healthy && numeric(opponent.shields) <= 0
      && bestSelfDebuff.damage < numeric(opponent.hp) && strongStableRoutes.length) {
      principlesTriggered.push(
        "MOVE-025_LONG_MATCHUP_MAY_PREFER_NON_DEBUFFING_MOVE",
        "EFFECT-042_AVOID_NONLETHAL_SELF_DEBUFF_NUKE_WHILE_HEALTHY"
      );
    } else {
      principlesRejected.push(
        "MOVE-025_LONG_MATCHUP_MAY_PREFER_NON_DEBUFFING_MOVE",
        "EFFECT-042_AVOID_NONLETHAL_SELF_DEBUFF_NUKE_WHILE_HEALTHY"
      );
    }

    const selectableRoutes = bestSelfDebuff && healthy && bestSelfDebuff.damage < numeric(opponent.hp) && strongStableRoutes.length
      ? strongStableRoutes
      : moveRoutes;
    const guaranteedEffects = selectableRoutes.filter(route => route.guaranteedEffect);
    if (guaranteedEffects.length) principlesTriggered.push("EFFECT-031_APPLY_GUARANTEED_ATTACK_DEFENSE_EFFECTS");
    else principlesRejected.push("EFFECT-031_APPLY_GUARANTEED_ATTACK_DEFENSE_EFFECTS");
    if (selectableRoutes.some(route => route.chanceEffect)) {
      principlesTriggered.push("CHANCE-032_DO_NOT_EXPLODE_ORDINARY_SEARCH_ON_CHANCE_EFFECTS");
    } else {
      principlesRejected.push("CHANCE-032_DO_NOT_EXPLODE_ORDINARY_SEARCH_ON_CHANCE_EFFECTS");
    }

    const bestAvailableDamage = Math.max(0, ...selectableRoutes.map(route => route.damage));
    const valuableGuaranteedEffects = guaranteedEffects.filter(route =>
      !route.selfDebuffing
      && (numeric(opponent.shields) > 0 || route.damage >= bestAvailableDamage * .35)
      && numeric(opponent.hp) > bestAvailableDamage
    );
    const orderingRoutes = valuableGuaranteedEffects.length ? valuableGuaranteedEffects : selectableRoutes;
    const chosenRoute = [...orderingRoutes].sort((a, b) =>
      comparePrincipleMoveRoutes(a, b, numeric(opponent.shields))
      || Number(b.guaranteedEffect) - Number(a.guaranteedEffect)
      || Number(a.selfDebuffing) - Number(b.selfDebuffing)
      || stableCandidateOrder(a.candidate, b.candidate)
    )[0] || null;
    if (chosenRoute) {
      const equivalentSelfDebuffAlternative = orderingRoutes.some(route =>
        route !== chosenRoute
        && comparePrincipleOutcomeVectors(route, chosenRoute, { stable: false }) === 0
        && route.selfDebuffing !== chosenRoute.selfDebuffing
      );
      if (equivalentSelfDebuffAlternative && !chosenRoute.selfDebuffing) {
        principlesTriggered.push("TIE-036_PREFER_FEWER_SELF_DEBUFFS_IN_EQUIVALENT_STATES");
      } else {
        principlesRejected.push("TIE-036_PREFER_FEWER_SELF_DEBUFFS_IN_EQUIVALENT_STATES");
      }
      principlesTriggered.push(
        numeric(opponent.shields) > 0
          ? "MOVE-041_WITH_SHIELDS_ALLOW_CHEAPER_EFFICIENT_NON_DEBUFFING_MOVE"
          : "MOVE-040_PREFER_USEFUL_IMMEDIATE_DAMAGE_WITHOUT_BAIT_CONSTRAINTS"
      );
      if (chosenRoute.selfDebuffing && numeric(actor.energy) >= chosenRoute.energyCost * 2) {
        principlesTriggered.push("EFFECT-027_STACK_SELF_DEBUFFING_MOVES");
      } else {
        principlesRejected.push("EFFECT-027_STACK_SELF_DEBUFFING_MOVES");
      }
      return {
        candidate: chosenRoute.candidate,
        category: chosenRoute.guaranteedEffect ? "effects" : "route",
        intent: input.timingIntent === PRINCIPLE_TIMING_INTENTS.THROW_NOW
          ? PRINCIPLE_TIMING_INTENTS.THROW_NOW
          : "PRINCIPLE_MOVE_ORDER",
        principlesEvaluated,
        principlesTriggered,
        principlesRejected,
        evidence: {
          baitPolicy,
          buildToLethal,
          ambiguity,
          selectiveContinuation,
          farmRoute: principleRouteEvidence(farmRoute),
          chargedRoutes: moveRoutes.map(principleRouteEvidence),
          selectedRoute: principleRouteEvidence(chosenRoute),
          chancePolicy: "DETERMINISTIC_NO_PROC"
        }
      };
    }

    if (fast) {
      principlesTriggered.push("ROUTE-026_BUILD_TO_SELECTED_MOVE");
      return {
        candidate: fast,
        category: "route",
        intent: "BUILD_TO_SELECTED_MOVE",
        principlesEvaluated,
        principlesTriggered,
        principlesRejected,
        evidence: {
          baitPolicy,
          buildToLethal,
          ambiguity,
          selectiveContinuation,
          farmRoute: principleRouteEvidence(farmRoute),
          chargedRoutes: moveRoutes.map(principleRouteEvidence)
        }
      };
    }
    return {
      candidate: null,
      category: null,
      intent: null,
      principlesEvaluated,
      principlesTriggered,
      principlesRejected,
      evidence: {
        baitPolicy,
        buildToLethal,
        ambiguity,
        selectiveContinuation,
        farmRoute: principleRouteEvidence(farmRoute),
        chargedRoutes: moveRoutes.map(principleRouteEvidence)
      }
    };
  }

  function principleMoveRoute(candidate, input = {}) {
    const energyCost = Math.max(1, actionEnergyCost(candidate.action));
    const damage = damageFor(candidate, input.context || {});
    const opponentHp = Math.max(0, numeric(input.opponent?.hp));
    const selfDebuffing = hasHarmfulSelfEffect(candidate.action);
    const move = candidate.action?.move || {};
    const applyChance = numeric(move.buffApplyChance);
    const effectValues = [move.buffs, move.buffsSelf, move.buffsOpponent]
      .flatMap(values => Array.isArray(values) ? values : [])
      .map(numeric)
      .filter(value => value !== 0);
    const guaranteedEffect = applyChance >= 1 && effectValues.length > 0;
    const chanceEffect = applyChance > 0 && applyChance < 1 && effectValues.length > 0;
    const certifiedOutcome = numeric(input.opponent?.shields) <= 0 && damage >= opponentHp ? "win" : null;
    return {
      candidate,
      action: candidate.action,
      certifiedOutcome,
      complete: certifiedOutcome === "win",
      terminalLegal: true,
      damage,
      energyCost,
      damagePerEnergy: damage / energyCost,
      turns: 1,
      survivingHp: Math.max(0, numeric(input.actor?.hp)),
      shields: Math.max(0, numeric(input.actor?.shields)),
      additionalChargedMoves: Math.floor(Math.max(0, numeric(input.actor?.energy) - energyCost) / energyCost),
      rawEnergy: Math.max(0, numeric(input.actor?.energy) - energyCost),
      actionableEnergy: 0,
      strandedEnergy: Math.max(0, numeric(input.actor?.energy) - energyCost),
      futureLethalAccess: damage >= opponentHp,
      turnsToMeaningfulAction: 0,
      positionalValue: guaranteedEffect ? 1 : 0,
      robustness: selfDebuffing ? 0 : 1,
      tacticalEfficiency: damage / energyCost,
      selfDebuffing,
      guaranteedEffect,
      chanceEffect,
      stableOrder: actionKey(candidate.action)
    };
  }

  function principleFarmDownRoute(input = {}) {
    const actor = input.actor || {};
    const opponent = input.opponent || {};
    const context = input.context || {};
    const fastDamage = Math.max(0, numeric(
      typeof context.estimateFastDamage === "function"
        ? context.estimateFastDamage("actor")
        : actor.fastMove?.damage
    ));
    const fastTurns = Math.max(1, numeric(actor.fastMove?.turns, 1));
    const fastEnergy = Math.max(0, numeric(actor.fastMove?.energyGain));
    const fastMovesRequired = fastDamage > 0
      ? Math.ceil(Math.max(0, numeric(opponent.hp)) / fastDamage)
      : Number.POSITIVE_INFINITY;
    const turns = Number.isFinite(fastMovesRequired) ? fastMovesRequired * fastTurns : Number.POSITIVE_INFINITY;
    const sequence = Number.isFinite(fastMovesRequired)
      ? Array.from({ length: fastMovesRequired }, () => ({
        type: ACTION_TYPES.FAST_MOVE,
        moveId: actor.fastMove?.id || actor.fastMove?.moveId || null
      }))
      : [];
    const hasProjection = typeof context.compactSurvivalProjection === "function";
    const projection = hasProjection && Number.isFinite(turns)
      ? context.compactSurvivalProjection({
        energy: numeric(actor.energy),
        defenderHp: 0,
        turn: turns,
        sequence,
        fastCount: fastMovesRequired,
        chargedCount: 0
      }) || {}
      : {};
    const pendingIncomingDamage = pendingDamageThrough(
      input.state,
      input.side,
      numeric(input.state?.currentTurn) + (Number.isFinite(turns) ? turns : 0)
    );
    const projectedDamageTaken = Math.max(pendingIncomingDamage, numeric(projection.damageTaken));
    const projectedFinalHp = Math.max(0, numeric(actor.hp) - projectedDamageTaken);
    const turnsToFaint = Number.isFinite(Number(projection.turnsToFaint))
      ? Number(projection.turnsToFaint)
      : Number.POSITIVE_INFINITY;
    const cmpAdvantage = numeric(context.compactCmpAdvantage);
    const safe = hasProjection
      && Number.isFinite(turns)
      && projectedFinalHp > 0
      && (turns < turnsToFaint || (turns === turnsToFaint && cmpAdvantage > 0))
      && numeric(projection.opponentChargedCount) <= 0;
    const rawEnergy = Math.min(100, numeric(actor.energy) + (Number.isFinite(fastMovesRequired) ? fastMovesRequired * fastEnergy : 0));
    const affordableCosts = (actor.chargedMoves || [])
      .map(move => Math.max(0, numeric(move?.energyCost)))
      .filter(cost => cost > 0 && cost <= rawEnergy);
    const actionableEnergy = affordableCosts.length ? rawEnergy : 0;
    return {
      candidate: input.fast || null,
      action: input.fast?.action || null,
      certifiedOutcome: safe ? "win" : null,
      complete: safe,
      terminalLegal: !!input.fast,
      safe,
      projectionComplete: hasProjection,
      fastMovesRequired: Number.isFinite(fastMovesRequired) ? fastMovesRequired : null,
      fastDamage,
      projectedIncomingFastDamage: Math.max(0, projectedDamageTaken - pendingIncomingDamage),
      pendingIncomingDamage,
      opponentEnergyGain: Math.max(0, numeric(opponent.fastMove?.energyGain))
        * Math.max(0, numeric(projection.opponentFastCount)),
      opponentChargedAccess: numeric(projection.opponentChargedCount) > 0,
      opponentLethalChargedAccess: !safe && numeric(projection.opponentChargedCount) > 0,
      turns,
      survivingHp: projectedFinalHp,
      shields: Math.max(0, numeric(actor.shields)),
      additionalChargedMoves: affordableCosts.length,
      rawEnergy,
      actionableEnergy,
      strandedEnergy: Math.max(0, rawEnergy - actionableEnergy),
      futureLethalAccess: affordableCosts.length > 0,
      turnsToMeaningfulAction: turns,
      positionalValue: rawEnergy,
      robustness: Math.max(0, projectedFinalHp),
      tacticalEfficiency: fastDamage,
      finalHp: projectedFinalHp,
      stableOrder: input.fast ? actionKey(input.fast.action) : "none"
    };
  }

  function principleBuildToLethalRoute(input = {}) {
    const actor = input.actor || {};
    const opponent = input.opponent || {};
    const context = input.context || {};
    const fastGain = Math.max(0, numeric(actor.fastMove?.energyGain));
    const fastTurns = Math.max(1, numeric(actor.fastMove?.turns, 1));
    const actorReadyTurn = Math.max(numeric(input.state?.currentTurn), numeric(actor.readyTurn));
    const opponentReadyTurn = Math.max(numeric(input.state?.currentTurn), numeric(opponent.readyTurn));
    const opponentFastTurns = Math.max(1, numeric(opponent.fastMove?.turns, 1));
    const opponentFastDamage = Math.max(0, numeric(
      typeof context.estimateFastDamage === "function"
        ? context.estimateFastDamage("opponent")
        : opponent.fastMove?.damage
    ));
    const routes = (actor.chargedMoves || []).filter(Boolean).map(move => {
      const cost = Math.max(0, numeric(move?.energyCost));
      const missing = Math.max(0, cost - numeric(actor.energy));
      const fastCount = missing > 0 && fastGain > 0 ? Math.ceil(missing / fastGain) : 0;
      const readyTurn = actorReadyTurn + fastCount * fastTurns;
      const action = {
        type: ACTION_TYPES.CHARGED_MOVE,
        side: input.side,
        moveId: move.id || move.moveId || null,
        move
      };
      const damage = Math.max(0, numeric(
        typeof context.estimateDamage === "function"
          ? context.estimateDamage(action)
          : move.damage ?? move.power
      ));
      const opponentCanThrowNow = (opponent.chargedMoves || []).some(opponentMove => {
        if (numeric(opponent.energy) < numeric(opponentMove?.energyCost)) return false;
        const incoming = typeof context.estimateOpponentDamage === "function"
          ? context.estimateOpponentDamage(opponentMove)
          : numeric(opponentMove?.damage ?? opponentMove?.power);
        return numeric(incoming) >= numeric(actor.hp);
      });
      const opponentStartsFast = opponentReadyTurn < readyTurn && !opponentCanThrowNow;
      const opponentLockedUntil = opponentStartsFast ? opponentReadyTurn + opponentFastTurns : opponentReadyTurn;
      const fittedFastCount = opponentStartsFast && opponentLockedUntil <= readyTurn ? 1 : 0;
      const pendingDamage = pendingDamageThrough(input.state, input.side, readyTurn);
      const survives = numeric(actor.hp) > pendingDamage + fittedFastCount * opponentFastDamage;
      const actorWinsCmp = readyTurn !== opponentLockedUntil
        || numeric(actor.attack) > numeric(opponent.attack)
        || input.state?.cmpState?.readySides?.[0] === input.side;
      return {
        moveId: action.moveId,
        energyCost: cost,
        fastCount,
        readyTurn,
        damage,
        lethal: damage >= numeric(opponent.hp),
        survives,
        opponentCanThrowNow,
        opponentStartsFast,
        opponentLockedUntil,
        actorWinsCmp,
        safe: fastCount > 0
          && damage >= numeric(opponent.hp)
          && survives
          && !opponentCanThrowNow
          && (readyTurn < opponentLockedUntil || actorWinsCmp)
      };
    }).sort((a, b) =>
      Number(b.safe) - Number(a.safe)
      || a.readyTurn - b.readyTurn
      || a.energyCost - b.energyCost
      || String(a.moveId || "").localeCompare(String(b.moveId || ""))
    );
    return routes[0] || {
      safe: false,
      reason: "NO_ACTIVE_CHARGED_ROUTE"
    };
  }

  function principleBuildToPreferredMove(input = {}, legalRoutes = []) {
    const actor = input.actor || {};
    const opponent = input.opponent || {};
    const context = input.context || {};
    const fastGain = Math.max(0, numeric(actor.fastMove?.energyGain));
    const fastTurns = Math.max(1, numeric(actor.fastMove?.turns, 1));
    const actorReadyTurn = Math.max(numeric(input.state?.currentTurn), numeric(actor.readyTurn));
    const opponentReadyTurn = Math.max(numeric(input.state?.currentTurn), numeric(opponent.readyTurn));
    const currentBestDamage = Math.max(0, ...legalRoutes.map(route => route.damage));
    const legalIds = new Set(legalRoutes.map(route => route.action?.moveId).filter(Boolean));
    const future = (actor.chargedMoves || []).filter(Boolean)
      .filter(move => !legalIds.has(move.id || move.moveId))
      .map(move => {
        const energyCost = Math.max(0, numeric(move.energyCost));
        const missing = Math.max(0, energyCost - numeric(actor.energy));
        const fastCount = fastGain > 0 ? Math.ceil(missing / fastGain) : Number.POSITIVE_INFINITY;
        const readyTurn = actorReadyTurn + fastCount * fastTurns;
        const action = {
          type: ACTION_TYPES.CHARGED_MOVE,
          side: input.side,
          moveId: move.id || move.moveId || null,
          move
        };
        const damage = Math.max(0, numeric(
          typeof context.estimateDamage === "function"
            ? context.estimateDamage(action)
            : move.damage ?? move.power
        ));
        const effectValues = [move.buffs, move.buffsSelf, move.buffsOpponent]
          .flatMap(values => Array.isArray(values) ? values : [])
          .map(numeric)
          .filter(value => value !== 0);
        const guaranteedEffect = numeric(move.buffApplyChance) >= 1
          && effectValues.length > 0
          && !hasHarmfulSelfEffect(action);
        const strategicallyPreferred = guaranteedEffect && numeric(opponent.shields) > 0
          || damage >= currentBestDamage * 1.5;
        const opponentFastDamage = Math.max(0, numeric(
          typeof context.estimateFastDamage === "function"
            ? context.estimateFastDamage("opponent")
            : opponent.fastMove?.damage
        ));
        const opponentFastCount = countActionsBeforeTurn(
          opponentReadyTurn,
          Math.max(1, numeric(opponent.fastMove?.turns, 1)),
          readyTurn
        );
        const pendingDamage = pendingDamageThrough(input.state, input.side, readyTurn);
        const opponentImmediateLethal = numeric(actor.shields) <= 0 && (opponent.chargedMoves || []).some(opponentMove => {
          if (numeric(opponent.energy) < numeric(opponentMove.energyCost) || opponentReadyTurn > readyTurn) return false;
          const incoming = typeof context.estimateOpponentDamage === "function"
            ? context.estimateOpponentDamage(opponentMove)
            : numeric(opponentMove.damage ?? opponentMove.power);
          return numeric(incoming) >= numeric(actor.hp) - pendingDamage;
        });
        const survives = numeric(actor.hp) > pendingDamage + opponentFastCount * opponentFastDamage;
        return {
          moveId: action.moveId,
          energyCost,
          fastCount: Number.isFinite(fastCount) ? fastCount : null,
          readyTurn: Number.isFinite(readyTurn) ? readyTurn : null,
          damage,
          guaranteedEffect,
          strategicallyPreferred,
          opponentFastCount,
          pendingDamage,
          opponentImmediateLethal,
          survives,
          safe: fastCount > 0
            && fastCount <= (fastTurns === 1 ? 2 : 1)
            && strategicallyPreferred
            && survives
            && !opponentImmediateLethal
            && input.timingIntent !== PRINCIPLE_TIMING_INTENTS.THROW_NOW
        };
      })
      .sort((a, b) =>
        Number(b.safe) - Number(a.safe)
        || Number(b.guaranteedEffect) - Number(a.guaranteedEffect)
        || b.damage - a.damage
        || a.energyCost - b.energyCost
        || String(a.moveId || "").localeCompare(String(b.moveId || ""))
      );
    return future[0] || { safe: false, reason: "NO_PREFERRED_UNREADY_MOVE" };
  }

  function comparePrincipleOutcomeRoutes(a, b) {
    return comparePrincipleOutcomeVectors(a, b);
  }

  function createPrincipleOutcomeVector(input = {}) {
    const rawEnergy = Math.max(0, numeric(input.rawEnergy));
    const actionableEnergy = clamp(numeric(input.actionableEnergy), 0, rawEnergy);
    return {
      certifiedOutcome: ["win", "draw", "loss"].includes(String(input.certifiedOutcome || "").toLowerCase())
        ? String(input.certifiedOutcome).toLowerCase()
        : null,
      terminalLegal: input.terminalLegal !== false,
      complete: input.complete === true,
      survivingHp: Math.max(0, numeric(input.survivingHp)),
      shields: Math.max(0, numeric(input.shields)),
      additionalChargedMoves: Math.max(0, numeric(input.additionalChargedMoves)),
      rawEnergy,
      actionableEnergy,
      strandedEnergy: Math.max(0, numeric(input.strandedEnergy, rawEnergy - actionableEnergy)),
      futureLethalAccess: input.futureLethalAccess === true,
      turnsToMeaningfulAction: Math.max(0, numeric(input.turnsToMeaningfulAction, Number.MAX_SAFE_INTEGER)),
      positionalValue: numeric(input.positionalValue),
      robustness: numeric(input.robustness),
      tacticalEfficiency: numeric(input.tacticalEfficiency),
      stableOrder: String(input.stableOrder || "")
    };
  }

  function comparePrincipleOutcomeVectors(left, right, options = {}) {
    const a = createPrincipleOutcomeVector(left);
    const b = createPrincipleOutcomeVector(right);
    const outcomeA = outcomeRank(a.certifiedOutcome);
    const outcomeB = outcomeRank(b.certifiedOutcome);
    const outcomeComparison = outcomeA >= 0 && outcomeB >= 0 ? outcomeB - outcomeA : 0;
    return outcomeComparison
      || Number(b.terminalLegal) - Number(a.terminalLegal)
      || Number(b.complete) - Number(a.complete)
      || b.survivingHp - a.survivingHp
      || b.shields - a.shields
      || b.additionalChargedMoves - a.additionalChargedMoves
      || b.actionableEnergy - a.actionableEnergy
      || Number(b.futureLethalAccess) - Number(a.futureLethalAccess)
      || a.turnsToMeaningfulAction - b.turnsToMeaningfulAction
      || b.positionalValue - a.positionalValue
      || b.robustness - a.robustness
      || b.tacticalEfficiency - a.tacticalEfficiency
      || (options.stable === false ? 0 : a.stableOrder.localeCompare(b.stableOrder));
  }

  function detectPrincipleAmbiguity(routes = []) {
    const alternatives = routes.filter(route => route?.action && route.terminalLegal !== false);
    const materialPairs = [];
    for (let leftIndex = 0; leftIndex < alternatives.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < alternatives.length; rightIndex++) {
        const left = alternatives[leftIndex];
        const right = alternatives[rightIndex];
        const reasons = [];
        if (left.certifiedOutcome && right.certifiedOutcome && left.certifiedOutcome !== right.certifiedOutcome) {
          reasons.push("OUTCOME_CLASS_DIFFERS");
        }
        if (left.complete !== right.complete) reasons.push("ROUTE_COMPLETENESS_DIFFERS");
        if (left.safe !== right.safe && (left.safe === true || right.safe === true)) reasons.push("FARM_DOWN_SAFETY_DIFFERS");
        if (numeric(left.shieldConsumed) !== numeric(right.shieldConsumed)) reasons.push("SHIELD_ALLOCATION_DIFFERS");
        if (left.complete && right.complete && numeric(left.turns) !== numeric(right.turns)) reasons.push("LETHAL_TIMING_DIFFERS");
        if (numeric(left.additionalChargedMoves) !== numeric(right.additionalChargedMoves)) reasons.push("CHARGED_COUNT_DIFFERS");
        if (numeric(left.actionableEnergy) !== numeric(right.actionableEnergy)
          && (left.futureLethalAccess || right.futureLethalAccess)) reasons.push("ACTIONABLE_ENERGY_DIFFERS");
        if (left.selfDebuffing !== right.selfDebuffing) reasons.push("EFFECT_TRAJECTORY_DIFFERS");
        if (reasons.length) {
          materialPairs.push({
            left: principleRouteEvidence(left),
            right: principleRouteEvidence(right),
            reasonCodes: reasons
          });
        }
      }
    }
    return {
      detected: materialPairs.length > 0,
      reasonCodes: [...new Set(materialPairs.flatMap(pair => pair.reasonCodes))],
      materialPairs,
      retainedAlternatives: alternatives.map(principleRouteEvidence),
      requiredContinuationHorizon: alternatives.reduce((maximum, route) =>
        Math.max(maximum, numeric(route.turnsToMeaningfulAction)), 0)
    };
  }

  function evaluateSelectivePrincipleContinuation(routes, ambiguity, input = {}) {
    if (!ambiguity.detected) {
      return {
        searched: false,
        rootStateHash: strategicStateKeyFromNormalized(input.state, "FAST"),
        meaningfulHorizon: 0,
        retainedAlternatives: [],
        prunedAlternatives: [],
        completeness: "not-required"
      };
    }
    const limit = Math.max(2, numeric(input.policy?.maxCandidates, 4));
    const ordered = routes.filter(route => route?.action && route.terminalLegal !== false)
      .sort(comparePrincipleOutcomeVectors);
    const retainedAlternatives = [];
    const prunedAlternatives = [];
    for (const route of ordered) {
      const dominatedBy = retainedAlternatives.find(retained =>
        comparablePrincipleRoutes(route, retained)
        && comparePrincipleOutcomeVectors(retained, route, { stable: false }) <= 0
      );
      if (dominatedBy || retainedAlternatives.length >= limit) {
        prunedAlternatives.push({
          route: principleRouteEvidence(route),
          reason: dominatedBy ? "DOMINATED_STATE_PRUNED" : "SEARCH_BUDGET_APPLIED",
          dominatedBy: dominatedBy ? principleRouteEvidence(dominatedBy) : null
        });
      } else {
        retainedAlternatives.push(route);
      }
    }
    return {
      searched: true,
      rootStateHash: strategicStateKeyFromNormalized(input.state, input.policy?.id || "FAST"),
      meaningfulHorizon: ambiguity.requiredContinuationHorizon,
      retainedAlternatives: retainedAlternatives.map(principleRouteEvidence),
      prunedAlternatives,
      completeness: prunedAlternatives.some(item => item.reason === "SEARCH_BUDGET_APPLIED")
        ? "bounded"
        : "complete",
      rolloutPolicy: "PRINCIPLE_ENGINE"
    };
  }

  function comparablePrincipleRoutes(left, right) {
    return left.certifiedOutcome === right.certifiedOutcome
      && left.complete === right.complete
      && numeric(left.shields) === numeric(right.shields)
      && left.selfDebuffing === right.selfDebuffing;
  }

  function comparePrincipleMoveRoutes(a, b, opponentShields = 0) {
    const outcomeA = outcomeRank(a?.certifiedOutcome);
    const outcomeB = outcomeRank(b?.certifiedOutcome);
    if (outcomeA >= 0 || outcomeB >= 0) return comparePrincipleOutcomeRoutes(a, b);
    if (opponentShields > 0) {
      return Number(a?.selfDebuffing) - Number(b?.selfDebuffing)
        || numeric(b?.damage) - numeric(a?.damage)
        || numeric(b?.damagePerEnergy) - numeric(a?.damagePerEnergy)
        || numeric(a?.energyCost) - numeric(b?.energyCost);
    }
    return numeric(b?.damage) - numeric(a?.damage)
      || numeric(b?.damagePerEnergy) - numeric(a?.damagePerEnergy)
      || numeric(a?.energyCost) - numeric(b?.energyCost);
  }

  function principleRouteEvidence(route) {
    if (!route) return null;
    const { candidate, action, ...evidence } = route;
    return {
      ...evidence,
      action: action ? {
        type: action.type || null,
        moveId: action.moveId || null
      } : null
    };
  }

  function normalizeBaitPolicy(value) {
    const normalized = String(value || "selective").toLowerCase();
    if (normalized === "on" || normalized === "always") return "always";
    if (normalized === "off") return "off";
    return "selective";
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

  function evaluateCompactRoutePrinciples(input = {}) {
    const rejected = [];
    const triggered = [];
    const actor = input.actor || {};
    const opponent = input.opponent || {};
    const candidates = input.candidates || [];
    const fastCandidate = input.fast || candidates.find(candidate =>
      candidate.action.type === ACTION_TYPES.FAST_MOVE
    ) || null;
    const legalChargedIds = new Set((input.charged || [])
      .map(candidate => candidate.action.moveId)
      .filter(Boolean));
    const chargedMoves = (actor.chargedMoves || []).filter(Boolean);
    const unresolved = result => ({
      resolved: false,
      candidate: null,
      principlesTriggered: triggered,
      principlesRejected: rejected,
      twoCheapRoute: result?.twoCheapRoute || { retained: false },
      evidence: result || null
    });

    if (!fastCandidate || !chargedMoves.length || typeof input.context?.compactSurvivalProjection !== "function") {
      rejected.push(
        "ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE",
        "COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE",
        "COMPACT-030_ORDER_SEARCH_BY_TIME_BREAKPOINT"
      );
      return unresolved({ reason: "COMPACT_ROUTE_INPUTS_INCOMPLETE" });
    }
    if (numeric(opponent.shields) > 0) {
      rejected.push(
        "ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE",
        "COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE",
        "COMPACT-030_ORDER_SEARCH_BY_TIME_BREAKPOINT"
      );
      return unresolved({ reason: "SHIELD_ROUTE_NOT_MIGRATED" });
    }
    if (chargedMoves.some(compactMoveHasEffects)) {
      rejected.push(
        "ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE",
        "COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE",
        "COMPACT-030_ORDER_SEARCH_BY_TIME_BREAKPOINT"
      );
      return unresolved({ reason: "EFFECT_ROUTE_NOT_MIGRATED" });
    }

    const policy = input.policy || POLICIES.FAST;
    const maxStates = Math.max(24, Math.min(384, numeric(policy.maxStates, 96)));
    const maxTurns = Math.max(24, Math.min(96, numeric(input.context.compactMaxTurns, 64)));
    const root = {
      energy: clamp(numeric(actor.energy), 0, 100),
      defenderHp: Math.max(0, numeric(opponent.hp)),
      turn: 0,
      sequence: [],
      firstAction: null,
      chargedCount: 0,
      fastCount: 0
    };
    const frontier = [root];
    const terminal = [];
    const dominance = new Map();
    const legalRootActionKeys = new Set([
      compactActionKey(fastCandidate.action),
      ...(input.charged || []).map(candidate => compactActionKey(candidate.action))
    ]);
    let exploredStates = 0;
    let orderedFrontiers = 0;
    let searchCompleted = false;

    while (frontier.length && exploredStates < maxStates) {
      if (frontier.length > 1) orderedFrontiers++;
      frontier.sort(compareCompactFrontierStates);
      const routeState = frontier.shift();
      exploredStates++;
      if (!routeState || routeState.turn > maxTurns) continue;
      if (compactRouteDominated(routeState, dominance)) continue;
      rememberCompactDominance(routeState, dominance);

      const survival = compactSurvival(input, routeState);
      if (!compactActorCanAct(routeState, survival, input)) continue;
      if (routeState.defenderHp <= 0) {
        terminal.push(compactTerminalRoute(routeState, survival, actor));
        const terminalFirstActions = new Set(terminal.map(route => compactActionKey(route.firstAction)));
        if ([...legalRootActionKeys].every(key => terminalFirstActions.has(key))) {
          searchCompleted = true;
          break;
        }
        continue;
      }

      const fastState = applyCompactFast(routeState, actor, input);
      if (fastState && fastState.turn <= maxTurns) frontier.push(fastState);
      for (const move of chargedMoves) {
        if (routeState.energy < compactEnergyCost(move)) continue;
        if (!routeState.firstAction && !legalChargedIds.has(move.id || move.moveId)) continue;
        const chargedState = applyCompactCharged(routeState, move, input);
        if (chargedState && chargedState.turn <= maxTurns) frontier.push(chargedState);
      }
    }

    triggered.push("COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE");
    if (orderedFrontiers > 0) triggered.push("COMPACT-030_ORDER_SEARCH_BY_TIME_BREAKPOINT");
    else rejected.push("COMPACT-030_ORDER_SEARCH_BY_TIME_BREAKPOINT");

    const routesByFirst = new Map();
    for (const route of terminal) {
      const key = compactActionKey(route.firstAction);
      const previous = routesByFirst.get(key);
      if (!previous || compareCompactRoutes(route, previous) < 0) routesByFirst.set(key, route);
    }
    const routes = [...routesByFirst.values()].sort(compareCompactRoutes);
    const twoCheapRoute = compactTwoCheapEvidence(root, routes, chargedMoves);
    if (twoCheapRoute.retained) triggered.push("ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE");
    else rejected.push("ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE");

    const best = routes[0] || null;
    const selected = best
      ? candidates.find(candidate => compactActionKey(candidate.action) === compactActionKey(best.firstAction)) || null
      : null;
    const second = routes[1] || null;
    const exactTie = !!(best && second && compareCompactRouteValue(best, second) === 0);
    const complete = searchCompleted || frontier.length === 0;
    const chargedIdsInBest = new Set((best?.sequence || [])
      .filter(action => action.type === ACTION_TYPES.CHARGED_MOVE)
      .map(action => action.moveId));
    const buildsToUnreadyCharged = best?.firstAction?.type === ACTION_TYPES.FAST_MOVE
      && [...chargedIdsInBest].some(moveId => !legalChargedIds.has(moveId));
    const routeAlternativeEstablished = twoCheapRoute.retained
      || (buildsToUnreadyCharged && best?.cmpBoundary === true);
    if (!complete || !selected || best?.outcome !== "win" || exactTie || !routeAlternativeEstablished) {
      return unresolved({
        reason: !complete
          ? "COMPACT_ROUTE_BUDGET_EXHAUSTED"
          : exactTie
          ? "COMPACT_ROUTE_AMBIGUOUS"
          : !routeAlternativeEstablished ? "NO_ROUTE_ALTERNATIVE_ESTABLISHED" : "NO_COMPLETE_WINNING_ROUTE",
        exploredStates,
        complete,
        routes,
        twoCheapRoute
      });
    }

    return {
      resolved: true,
      candidate: selected,
      principlesTriggered: triggered,
      principlesRejected: rejected,
      twoCheapRoute,
      evidence: {
        exploredStates,
        complete,
        orderedFrontiers,
        bestRoute: best,
        routes,
        twoCheapRoute
      }
    };
  }

  function compactMoveHasEffects(move) {
    if (numeric(move?.buffApplyChance) <= 0) return false;
    return [move?.buffs, move?.buffsSelf, move?.buffsOpponent]
      .some(values => Array.isArray(values) && values.some(value => numeric(value) !== 0));
  }

  function applyCompactFast(state, actor, input) {
    const move = actor.fastMove;
    if (!move) return null;
    const turns = Math.max(1, numeric(move.turns, 1));
    const damage = compactDamage(input, ACTION_TYPES.FAST_MOVE, move, state);
    const action = { type: ACTION_TYPES.FAST_MOVE, moveId: move.id || move.moveId || null };
    return {
      ...state,
      energy: Math.min(100, state.energy + Math.max(0, numeric(move.energyGain))),
      defenderHp: Math.max(0, state.defenderHp - damage),
      turn: state.turn + turns,
      sequence: [...state.sequence, action],
      firstAction: state.firstAction || action,
      fastCount: state.fastCount + 1
    };
  }

  function applyCompactCharged(state, move, input) {
    const cost = compactEnergyCost(move);
    if (!cost || state.energy < cost) return null;
    const action = { type: ACTION_TYPES.CHARGED_MOVE, moveId: move.id || move.moveId || null };
    return {
      ...state,
      energy: Math.max(0, state.energy - cost),
      defenderHp: Math.max(0, state.defenderHp - compactDamage(input, ACTION_TYPES.CHARGED_MOVE, move, state)),
      turn: state.turn + 1,
      sequence: [...state.sequence, action],
      firstAction: state.firstAction || action,
      chargedCount: state.chargedCount + 1
    };
  }

  function compactDamage(input, type, move, state) {
    if (typeof input.context?.compactDamage === "function") {
      return Math.max(0, numeric(input.context.compactDamage("actor", move, {
        turn: state.turn,
        energy: state.energy,
        defenderHp: state.defenderHp
      })));
    }
    if (type === ACTION_TYPES.FAST_MOVE && typeof input.context?.estimateFastDamage === "function") {
      return Math.max(0, numeric(input.context.estimateFastDamage("actor")));
    }
    if (type === ACTION_TYPES.CHARGED_MOVE && typeof input.context?.estimateDamage === "function") {
      return Math.max(0, numeric(input.context.estimateDamage({
        type,
        moveId: move.id || move.moveId || null,
        move
      })));
    }
    return Math.max(0, numeric(move?.damage ?? move?.metadata?.damage));
  }

  function compactSurvival(input, state) {
    const projected = input.context.compactSurvivalProjection({
      energy: state.energy,
      defenderHp: state.defenderHp,
      turn: state.turn,
      sequence: state.sequence,
      fastCount: state.fastCount,
      chargedCount: state.chargedCount
    }) || {};
    return {
      turnsToFaint: Number.isFinite(Number(projected.turnsToFaint))
        ? Number(projected.turnsToFaint)
        : Number.POSITIVE_INFINITY,
      damageTaken: Math.max(0, numeric(projected.damageTaken)),
      opponentChargedCount: Math.max(0, numeric(projected.opponentChargedCount))
    };
  }

  function compactActorCanAct(state, survival, input) {
    if (state.turn < survival.turnsToFaint) return true;
    if (state.turn > survival.turnsToFaint) return false;
    return numeric(input.context?.compactCmpAdvantage) > 0;
  }

  function compactTerminalRoute(state, survival, actor) {
    const hpRemaining = Math.max(1, numeric(actor.hp) - survival.damageTaken);
    return {
      firstAction: state.firstAction,
      sequence: state.sequence,
      outcome: "win",
      turn: state.turn,
      hpRemaining,
      energyAfter: state.energy,
      chargedCount: state.chargedCount,
      fastCount: state.fastCount,
      cmpBoundary: state.turn === survival.turnsToFaint,
      complete: true
    };
  }

  function compareCompactFrontierStates(a, b) {
    return a.turn - b.turn
      || a.defenderHp - b.defenderHp
      || b.energy - a.energy
      || compactSequenceKey(a.sequence).localeCompare(compactSequenceKey(b.sequence));
  }

  function compareCompactRoutes(a, b) {
    return compareCompactRouteValue(a, b)
      || compactActionKey(a.firstAction).localeCompare(compactActionKey(b.firstAction));
  }

  function compareCompactRouteValue(a, b) {
    return ({ loss: 0, draw: 1, win: 2 })[b.outcome] - ({ loss: 0, draw: 1, win: 2 })[a.outcome]
      || a.turn - b.turn
      || b.hpRemaining - a.hpRemaining
      || b.energyAfter - a.energyAfter
      || a.chargedCount - b.chargedCount
      || compactSequenceKey(a.sequence).localeCompare(compactSequenceKey(b.sequence));
  }

  function compactRouteDominated(state, dominance) {
    const key = `${state.defenderHp}:${state.turn}`;
    const previous = dominance.get(key);
    return !!previous && previous.energy >= state.energy
      && previous.chargedCount <= state.chargedCount
      && previous.fastCount <= state.fastCount;
  }

  function rememberCompactDominance(state, dominance) {
    const key = `${state.defenderHp}:${state.turn}`;
    const previous = dominance.get(key);
    if (!previous || state.energy > previous.energy
      || state.chargedCount < previous.chargedCount
      || state.fastCount < previous.fastCount) {
      dominance.set(key, {
        energy: state.energy,
        chargedCount: state.chargedCount,
        fastCount: state.fastCount
      });
    }
  }

  function compactTwoCheapEvidence(root, routes, moves) {
    if (moves.length < 2) return { retained: false };
    const ordered = [...moves].sort((a, b) =>
      compactEnergyCost(a) - compactEnergyCost(b)
      || String(a.id || a.moveId || "").localeCompare(String(b.id || b.moveId || ""))
    );
    const cheap = ordered[0];
    const nuke = ordered[ordered.length - 1];
    const cheapId = cheap.id || cheap.moveId || null;
    const nukeId = nuke.id || nuke.moveId || null;
    const twoCheap = routes.find(route =>
      route.sequence.filter(action => action.type === ACTION_TYPES.CHARGED_MOVE).slice(0, 2)
        .every((action, index, pair) => pair.length === 2 && action.moveId === cheapId)
    ) || null;
    const oneNuke = routes.find(route =>
      route.sequence.some(action => action.type === ACTION_TYPES.CHARGED_MOVE && action.moveId === nukeId)
    ) || null;
    const retained = cheapId !== nukeId
      && compactEnergyCost(cheap) > 0
      && root.energy >= compactEnergyCost(cheap) * 2
      && !!twoCheap
      && (!oneNuke || compareCompactRouteValue(twoCheap, oneNuke) < 0);
    return {
      retained,
      cheapMoveId: cheapId,
      nukeMoveId: nukeId,
      twoCheapRoute: twoCheap,
      oneNukeRoute: oneNuke
    };
  }

  function compactEnergyCost(move) {
    return Math.max(0, numeric(move?.energyCost ?? move?.metadata?.energyCost));
  }

  function compactActionKey(action) {
    return `${action?.type || "none"}:${action?.moveId || ""}`;
  }

  function compactSequenceKey(sequence) {
    return (sequence || []).map(compactActionKey).join(">");
  }

  function evaluateTimingPrinciples(input = {}) {
    const {
      state,
      side,
      actor = {},
      opponent = {},
      fast,
      charged = [],
      context = {},
      readiness = [],
      survival = {}
    } = input;
    const currentTurn = Math.max(0, numeric(state?.currentTurn));
    const actorReadyTurn = Math.max(currentTurn, numeric(actor.readyTurn, currentTurn));
    const opponentReadyTurn = Math.max(currentTurn, numeric(opponent.readyTurn, currentTurn));
    const ownFastDuration = Math.max(1, numeric(actor.fastMove?.turns, 1));
    const opponentFastDuration = Math.max(1, numeric(opponent.fastMove?.turns, 1));
    const waitEndTurn = actorReadyTurn + ownFastDuration;
    const fastEnergyGain = Math.max(0, numeric(actor.fastMove?.energyGain));
    const projectedEnergy = numeric(actor.energy) + fastEnergyGain;
    const incomingPendingDamage = pendingDamageThrough(state, side, waitEndTurn);
    const opponentFastCount = countActionsBeforeTurn(opponentReadyTurn, opponentFastDuration, waitEndTurn);
    const opponentFastDamage = Math.max(0, numeric(
      typeof context.estimateFastDamage === "function"
        ? context.estimateFastDamage("opponent")
        : opponent.fastMove?.damage
    ));
    const ownFastDamage = Math.max(0, numeric(
      typeof context.estimateFastDamage === "function"
        ? context.estimateFastDamage("actor")
        : actor.fastMove?.damage
    ));
    const ownFastKOsAfterWait = numeric(opponent.hp) > 0 && ownFastDamage >= numeric(opponent.hp);
    const actorEnergyAfterWait = clamp(numeric(actor.energy) + fastEnergyGain, 0, 100);
    const fittedOpponentFastDamage = opponentFastCount * opponentFastDamage;
    const actorFaints = numeric(actor.hp) > 0
      && incomingPendingDamage + fittedOpponentFastDamage >= numeric(actor.hp);
    const opponentEnergyAfterWait = clamp(
      numeric(opponent.energy) + opponentFastCount * Math.max(0, numeric(opponent.fastMove?.energyGain)),
      0,
      100
    );
    const opponentReadyAfterWait = opponentReadyTurn + opponentFastCount * opponentFastDuration;
    const opponentLethalCharged = numeric(actor.shields) <= 0 && (opponent.chargedMoves || []).some(move => {
      const cost = numeric(move?.energyCost);
      const alreadyReachable = numeric(opponent.energy) >= cost && opponentReadyTurn <= waitEndTurn;
      const reachableAfterFast = opponentEnergyAfterWait >= cost && opponentReadyAfterWait <= waitEndTurn;
      if (!alreadyReachable && !reachableAfterFast) return false;
      const damage = typeof context.estimateOpponentDamage === "function"
        ? context.estimateOpponentDamage(move)
        : numeric(move?.damage);
      return numeric(damage) >= Math.max(0, numeric(actor.hp) - incomingPendingDamage - fittedOpponentFastDamage);
    });
    const actorLethalChargedAfterWait = (actor.chargedMoves || []).some(move => {
      if (actorEnergyAfterWait < numeric(move?.energyCost)) return false;
      const damage = typeof context.estimateDamage === "function"
        ? context.estimateDamage({ type: ACTION_TYPES.CHARGED_MOVE, moveId: move?.id || null, move })
        : numeric(move?.damage);
      return numeric(damage) >= Math.max(0, numeric(opponent.hp) - ownFastDamage);
    });
    const actorWinsCmpAfterWait = actorLethalChargedAfterWait
      && waitEndTurn === opponentReadyAfterWait
      && (numeric(actor.attack) > numeric(opponent.attack)
        || state?.cmpState?.readySides?.[0] === side);
    const opponentLethalConfirmed = !ownFastKOsAfterWait
      && !actorWinsCmpAfterWait
      && opponentLethalCharged;
    const pendingOpponentFast = (state?.pendingEvents || []).find(event =>
      event?.status !== "denied"
      && event?.sourceSide === opponentOf(side)
      && event?.targetSide === side
      && numeric(event?.resolveTurn) >= currentTurn
    ) || null;
    const sameDuration = ownFastDuration === opponentFastDuration;
    const exactMultiple = ownFastDuration > opponentFastDuration
      && ownFastDuration % opponentFastDuration === 0;
    const currentTimingOptimal = !!pendingOpponentFast
      && opponentReadyTurn > actorReadyTurn
      && actorReadyTurn === opponentReadyTurn - 1;
    const currentReachableChargedCount = reachableChargedCountForEnergy(actor.energy, actor.chargedMoves);
    const survivingActionWindows = actorFaints ? 0
      : survival.pendingFastLethal ? 1
        : Infinity;
    const currentResourcesBecomeUnusable = Number.isFinite(survivingActionWindows)
      && survivingActionWindows < currentReachableChargedCount;
    const timingOptimizationEnabled = context.chargedTimingOptimization !== false;
    const opponentCanChargeAtCurrentWindow = (opponent.chargedMoves || []).some(move =>
      numeric(opponent.energy) >= numeric(move?.energyCost)
    );
    const simultaneousAlignmentOpportunity = actorReadyTurn === opponentReadyTurn
      && ownFastDuration < opponentFastDuration
      && !opponentCanChargeAtCurrentWindow;
    const timingCanImprove = timingOptimizationEnabled
      && !sameDuration
      && !exactMultiple
      && (
        (!!pendingOpponentFast && waitEndTurn < opponentReadyTurn)
        || simultaneousAlignmentOpportunity
      );
    const principlesTriggered = ["TIMING-012_TARGET_DEPENDS_ON_FAST_DURATIONS"];
    const principlesRejected = [];

    if (!fast || !charged.length) {
      principlesRejected.push(
        "TIMING-011_OPTIMIZE_CHARGED_TIMING",
        "TIMING-013_DISABLE_SAME_DURATION_OPTIMIZATION",
        "TIMING-014_DISABLE_EXACT_MULTIPLE_OPTIMIZATION",
        "TIMING-015_DO_NOT_WAIT_IF_ACTOR_FAINTS",
        "TIMING-016_DO_NOT_WAIT_IF_ENERGY_OVERFLOWS",
        "TIMING-017_DO_NOT_WAIT_IF_CURRENT_CHARGED_RESOURCES_BECOME_UNUSABLE",
        "TIMING-018_DO_NOT_WAIT_IF_CHARGED_ALREADY_KOS",
        "TIMING-019_DO_NOT_WAIT_IF_OPPONENT_REACHES_LETHAL_CHARGED_PRESSURE",
        "TIMING-020_DO_NOT_WAIT_IF_FITTED_FAST_MOVES_ARE_LETHAL",
        "TIMING-021_SAFE_TIMING_WAIT_MEANS_ONE_FAST_THEN_REPLAN"
      );
      return {
        intent: PRINCIPLE_TIMING_INTENTS.NO_TIMING_PREFERENCE,
        principlesTriggered,
        principlesRejected,
        evidence: { currentTurn, actorReadyTurn, opponentReadyTurn, reason: "NO_FAST_AND_CHARGED_CHOICE" }
      };
    }

    if (actorFaints) principlesTriggered.push("TIMING-015_DO_NOT_WAIT_IF_ACTOR_FAINTS");
    else principlesRejected.push("TIMING-015_DO_NOT_WAIT_IF_ACTOR_FAINTS");
    if (projectedEnergy > 100) principlesTriggered.push("TIMING-016_DO_NOT_WAIT_IF_ENERGY_OVERFLOWS");
    else principlesRejected.push("TIMING-016_DO_NOT_WAIT_IF_ENERGY_OVERFLOWS");
    if (currentResourcesBecomeUnusable) principlesTriggered.push("TIMING-017_DO_NOT_WAIT_IF_CURRENT_CHARGED_RESOURCES_BECOME_UNUSABLE");
    else principlesRejected.push("TIMING-017_DO_NOT_WAIT_IF_CURRENT_CHARGED_RESOURCES_BECOME_UNUSABLE");
    principlesRejected.push("TIMING-018_DO_NOT_WAIT_IF_CHARGED_ALREADY_KOS");
    if (opponentLethalConfirmed) {
      principlesTriggered.push("TIMING-019_DO_NOT_WAIT_IF_OPPONENT_REACHES_LETHAL_CHARGED_PRESSURE");
    } else {
      principlesRejected.push("TIMING-019_DO_NOT_WAIT_IF_OPPONENT_REACHES_LETHAL_CHARGED_PRESSURE");
    }
    if (fittedOpponentFastDamage >= numeric(actor.hp) && numeric(actor.hp) > 0) {
      principlesTriggered.push("TIMING-020_DO_NOT_WAIT_IF_FITTED_FAST_MOVES_ARE_LETHAL");
    } else {
      principlesRejected.push("TIMING-020_DO_NOT_WAIT_IF_FITTED_FAST_MOVES_ARE_LETHAL");
    }

    const unsafeToWait = actorFaints
      || projectedEnergy > 100
      || currentResourcesBecomeUnusable
      || opponentLethalConfirmed
      || (fittedOpponentFastDamage >= numeric(actor.hp) && numeric(actor.hp) > 0);
    const evidence = {
      currentTurn,
      actorReadyTurn,
      opponentReadyTurn,
      ownFastDuration,
      opponentFastDuration,
      waitEndTurn,
      projectedEnergy,
      incomingPendingDamage,
      fittedOpponentFastDamage,
      ownFastDamage,
      ownFastKOsAfterWait,
      actorEnergyAfterWait,
      actorLethalChargedAfterWait,
      actorWinsCmpAfterWait,
      opponentReadyAfterWait,
      opponentEnergyAfterWait,
      opponentLethalCharged,
      opponentLethalConfirmed,
      currentReachableChargedCount,
      survivingActionWindows: Number.isFinite(survivingActionWindows) ? survivingActionWindows : null,
      timingTarget: Math.max(currentTurn, opponentReadyTurn - 1),
      currentTimingOptimal,
      simultaneousAlignmentOpportunity,
      opponentCanChargeAtCurrentWindow,
      pendingOpponentFastEventId: pendingOpponentFast?.id || null,
      readiness
    };

    if (unsafeToWait || currentTimingOptimal) {
      principlesTriggered.push("TIMING-011_OPTIMIZE_CHARGED_TIMING");
      if (currentTimingOptimal) evidence.currentTimingOptimal = true;
      return {
        intent: PRINCIPLE_TIMING_INTENTS.THROW_NOW,
        principlesTriggered,
        principlesRejected,
        evidence
      };
    }
    if (sameDuration) {
      principlesTriggered.push("TIMING-013_DISABLE_SAME_DURATION_OPTIMIZATION");
      principlesRejected.push("TIMING-011_OPTIMIZE_CHARGED_TIMING", "TIMING-021_SAFE_TIMING_WAIT_MEANS_ONE_FAST_THEN_REPLAN");
      return {
        intent: PRINCIPLE_TIMING_INTENTS.NO_TIMING_PREFERENCE,
        principlesTriggered,
        principlesRejected,
        evidence
      };
    }
    principlesRejected.push("TIMING-013_DISABLE_SAME_DURATION_OPTIMIZATION");
    if (exactMultiple) {
      principlesTriggered.push("TIMING-014_DISABLE_EXACT_MULTIPLE_OPTIMIZATION");
      principlesRejected.push("TIMING-011_OPTIMIZE_CHARGED_TIMING", "TIMING-021_SAFE_TIMING_WAIT_MEANS_ONE_FAST_THEN_REPLAN");
      return {
        intent: PRINCIPLE_TIMING_INTENTS.NO_TIMING_PREFERENCE,
        principlesTriggered,
        principlesRejected,
        evidence
      };
    }
    principlesRejected.push("TIMING-014_DISABLE_EXACT_MULTIPLE_OPTIMIZATION");
    if (timingCanImprove) {
      principlesTriggered.push(
        "TIMING-011_OPTIMIZE_CHARGED_TIMING",
        "TIMING-021_SAFE_TIMING_WAIT_MEANS_ONE_FAST_THEN_REPLAN"
      );
      return {
        intent: PRINCIPLE_TIMING_INTENTS.WAIT_ONE_FAST,
        principlesTriggered,
        principlesRejected,
        evidence
      };
    }
    principlesRejected.push("TIMING-011_OPTIMIZE_CHARGED_TIMING", "TIMING-021_SAFE_TIMING_WAIT_MEANS_ONE_FAST_THEN_REPLAN");
    return {
      intent: PRINCIPLE_TIMING_INTENTS.NO_TIMING_PREFERENCE,
      principlesTriggered,
      principlesRejected,
      evidence
    };
  }

  function countActionsBeforeTurn(readyTurn, duration, endTurn) {
    if (readyTurn >= endTurn) return 0;
    return Math.max(0, Math.ceil((endTurn - readyTurn) / Math.max(1, duration)));
  }

  function reachableChargedCountForEnergy(energy, moves = []) {
    const costs = (moves || []).filter(Boolean).map(move => Math.max(0, numeric(move.energyCost))).filter(cost => cost > 0);
    if (!costs.length) return 0;
    return Math.floor(Math.max(0, numeric(energy)) / Math.min(...costs));
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
      chosen.reasonCodes = [...new Set([
        primaryPrincipleReasonCode(principleEvaluation, chosen.action),
        ...chosen.reasonCodes,
        ...principleReasonCodes(principleEvaluation.principlesTriggered)
      ].filter(Boolean))];
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
    finishTiming(startedAt, selectionSpan);
    const error = new Error("The Principle Engine could not resolve an automatic strategic decision.");
    error.code = "PRINCIPLE_ENGINE_UNSUPPORTED_STATE";
    error.principleEvaluation = principleEvaluation;
    throw error;
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
    if (evaluation.intent === PRINCIPLE_TIMING_INTENTS.WAIT_ONE_FAST) {
      return "The Timing Engine selected exactly one safe Fast Move, followed by canonical resolution and re-planning.";
    }
    return "The Principle Engine directly resolved the action.";
  }

  function timingReasonCodes(principleIds = []) {
    const ids = new Set(principleIds || []);
    const reasons = [];
    if (ids.has("TIMING-015_DO_NOT_WAIT_IF_ACTOR_FAINTS")) reasons.push("FAINTS_WHILE_WAITING");
    if (ids.has("TIMING-016_DO_NOT_WAIT_IF_ENERGY_OVERFLOWS")) reasons.push("ENERGY_CAP_FORCES_THROW");
    if (ids.has("TIMING-017_DO_NOT_WAIT_IF_CURRENT_CHARGED_RESOURCES_BECOME_UNUSABLE")) reasons.push("CURRENT_CHARGED_RESOURCES_BECOME_UNUSABLE");
    if (ids.has("TIMING-018_DO_NOT_WAIT_IF_CHARGED_ALREADY_KOS")) reasons.push("IMMEDIATE_LETHAL_LOST");
    if (ids.has("TIMING-019_DO_NOT_WAIT_IF_OPPONENT_REACHES_LETHAL_CHARGED_PRESSURE")) reasons.push("LETHAL_CHARGED_CONCEDED");
    if (ids.has("TIMING-020_DO_NOT_WAIT_IF_FITTED_FAST_MOVES_ARE_LETHAL")) reasons.push("FAST_DAMAGE_LETHAL_WHILE_WAITING");
    if (ids.has("TIMING-021_SAFE_TIMING_WAIT_MEANS_ONE_FAST_THEN_REPLAN")) reasons.push("SAFE_EXTRA_FAST", "OPTIMAL_CHARGE_TIMING");
    if (!reasons.length && ids.has("TIMING-011_OPTIMIZE_CHARGED_TIMING")) reasons.push("OPTIMAL_CHARGE_TIMING");
    return reasons;
  }

  function primaryPrincipleReasonCode(evaluation = {}, action = null) {
    if (evaluation.intent === "IMMEDIATE_LETHAL") return "LETHAL_MOVE_AVAILABLE";
    if (evaluation.intent === "THROW_BEFORE_FAINT") return "FORCED_THROW_BEFORE_FAINT";
    if (evaluation.intent === "THROW_BEFORE_OPPONENT_LETHAL") return "LETHAL_CHARGED_CONCEDED";
    if (evaluation.intent === PRINCIPLE_TIMING_INTENTS.WAIT_ONE_FAST) return "SAFE_EXTRA_FAST";
    if (evaluation.intent === "FARM_DOWN_ROUTE") return "FARM_DOWN_ROUTE";
    if (evaluation.intent === "COMPACT_ROUTE"
      && evaluation.principlesTriggered?.includes("ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE")) {
      return "PROJECTED_CHARGED_SEQUENCE_VALUE";
    }
    if (evaluation.intent === "COMPACT_ROUTE") return "COMPACT_ROUTE_GENERATED";
    if (evaluation.intent === "BUILD_TO_CREDIBLE_NUKE"
      || evaluation.intent === "ALWAYS_BAIT"
      || evaluation.intent === "SELECTIVE_CREDIBLE_BAIT") return "BAIT_REQUIRED";
    if (evaluation.intent === "BUILD_TO_SELECTED_MOVE") return "BUILD_TO_SELECTED_MOVE";
    if (evaluation.category === "effects") return guaranteedEffectReasonCode(action);
    if (evaluation.category === "route") return "BEST_IMMEDIATE_DAMAGE";
    if (evaluation.category === "availability") return evaluation.principlesTriggered?.includes("AVAIL-001_NO_ACTIVE_CHARGED_MOVE")
      ? "NO_ACTIVE_CHARGED_MOVE"
      : "CHEAPEST_CHARGED_NOT_AFFORDABLE";
    return principleReasonCodes(evaluation.principlesTriggered)[0] || null;
  }

  function guaranteedEffectReasonCode(action) {
    const move = action?.move || {};
    const ownValues = move.buffTarget === "opponent" ? [] : move.buffTarget === "both"
      ? move.buffsSelf || []
      : move.buffs || [];
    const opponentValues = move.buffTarget === "both"
      ? move.buffsOpponent || []
      : move.buffTarget === "opponent" ? move.buffs || [] : [];
    if (numeric(ownValues?.[1]) > 0) return "GUARANTEED_DEFENSE_BUFF_VALUE";
    if (numeric(opponentValues?.[0]) < 0) return "GUARANTEED_ATTACK_DEBUFF_VALUE";
    return "GUARANTEED_EFFECT_PROJECTED";
  }

  function principleReasonCodes(principleIds = []) {
    const reasonByPrinciple = {
      AVAIL_001_NO_ACTIVE_CHARGED_MOVE: "NO_ACTIVE_CHARGED_MOVE",
      AVAIL_002_CHEAPEST_CHARGED_NOT_AFFORDABLE: "CHEAPEST_CHARGED_NOT_AFFORDABLE",
      POLICY_003_EXPLICIT_FARM_ENERGY_MODE: "EXPLICIT_FARM_ENERGY_MODE",
      ROUTE_007_TWO_COPIES_OUTRANK_ONE_NUKE: "TWO_CHEAP_MOVES_OUTRANK_NUKE",
      TACTICAL_006_FORCED_THROW_BEFORE_FAST_FAINT: "FORCED_THROW_BEFORE_FAST_FAINT",
      TACTICAL_008_IMMEDIATE_UNSHIELDED_CHARGED_LETHAL: "LETHAL_MOVE_AVAILABLE",
      TACTICAL_009_DO_NOT_THROW_WHEN_FAST_ALREADY_KOS: "PENDING_FAST_ALREADY_KOS",
      SPECIAL_010_PROTECTION_FORM_MECHANIC_BREAKER: "PROTECTION_FORM_BREAKER",
      ROUTE_026_BUILD_TO_SELECTED_MOVE: "BUILD_TO_SELECTED_MOVE",
      EFFECT_027_STACK_SELF_DEBUFFING_MOVES: "SELF_DEBUFF_STACKING",
      COMPACT_028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE: "COMPACT_ROUTE_GENERATED",
      EFFECT_031_APPLY_GUARANTEED_ATTACK_DEFENSE_EFFECTS: "GUARANTEED_EFFECT_PROJECTED",
      CHANCE_032_DO_NOT_EXPLODE_ORDINARY_SEARCH_ON_CHANCE_EFFECTS: "NON_GUARANTEED_EFFECT_NO_PROC_MATRIX",
      FARM_033_FARM_DOWN_ROUTE_CANDIDATE: "FARM_DOWN_ROUTE",
      SHIELD_034_SHIELDED_CHARGED_CONSUMES_SHIELD: "SHIELDED_CHARGED_CONSUMES_SHIELD",
      BAIT_037_BUILD_ENERGY_TO_REPRESENT_NUKE: "BUILD_TO_CREDIBLE_NUKE",
      BAIT_038_DO_NOT_BAIT_WHEN_OPPONENT_WOULD_NOT_SHIELD: "BAIT_NOT_CREDIBLE",
      BAIT_039_AVOID_SELF_DEBUFFING_BAIT_WHEN_INAPPROPRIATE: "AVOID_SELF_DEBUFFING_BAIT",
      MOVE_040_PREFER_USEFUL_IMMEDIATE_DAMAGE_WITHOUT_BAIT_CONSTRAINTS: "BEST_IMMEDIATE_DAMAGE",
      MOVE_041_WITH_SHIELDS_ALLOW_CHEAPER_EFFICIENT_NON_DEBUFFING_MOVE: "CHEAPER_EFFICIENT_NON_DEBUFFING_MOVE",
      EFFECT_042_AVOID_NONLETHAL_SELF_DEBUFF_NUKE_WHILE_HEALTHY: "AVOID_EARLY_SELF_DEBUFF"
    };
    const direct = (principleIds || []).map(principleId =>
      reasonByPrinciple[String(principleId).replace(/-/g, "_")]
    ).filter(Boolean);
    return [...new Set([...direct, ...timingReasonCodes(principleIds)])];
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
    if (!shields) return done(shieldResult(false, "NO_SHIELD_AVAILABLE", "No shield is available.", .99));
    if (policy === "no-first" && chargedTaken === 0) {
      return done(shieldResult(false, "SHIELD_POLICY_NO_FIRST", "No First shield logic lets the first charged move through.", .99));
    }
    if (policy === "always") {
      return done(shieldResult(true, "SHIELD_POLICY_ALWAYS", "Always shield logic uses a shield.", .99));
    }
    if (policy === "nuke") {
      const shield = damage >= hp || damage >= maxHp * .35 || energyCost >= 55;
      return done(shieldResult(
        shield,
        shield ? "SHIELD_HEAVY_PRESSURE" : "SHIELD_SAVED_LOW_THREAT",
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
          "SHIELD_PRESERVES_WIN_CONDITION",
          shield
            ? "Smart shield preserves a winning continuation."
            : "Smart shield preserves a winning continuation by saving the shield.",
          .98,
          { counterfactual }
        ));
      }
    }

    if (damage >= hp) return done(shieldResult(true, "SHIELD_PREVENTS_KO", "Smart shield blocks a KO.", .98));
    if (threat.preBuffDefenseWindow && shields >= 2 && damage / maxHp >= .12) {
      return done(shieldResult(true, "SHIELD_PRESERVES_WIN_CONDITION", "Smart shield preserves HP before activating a guaranteed Defense boost.", .9));
    }
    if (threat.entersFarmRange) return done(shieldResult(true, "SHIELD_AVOIDS_FARM_RANGE", "Smart shield avoids farm range.", .9));
    if (threat.losesChargedThreat) {
      return done(shieldResult(true, "SHIELD_PRESERVES_CHARGED_THREAT", "Smart shield preserves charged-move threat.", .88));
    }
    const damageRatio = damage / maxHp;
    if (shields >= 2 && (damageRatio >= .42 || energyCost >= 55)) {
      return done(shieldResult(true, "SHIELD_HEAVY_PRESSURE", "Smart shield spends from 2 shields against heavy pressure.", .82));
    }
    if (damageRatio >= .55) return done(shieldResult(true, "SHIELD_HEAVY_PRESSURE", "Smart shield blocks major damage.", .82));
    if (damageRatio <= .25 && energyCost < 55) {
      return done(shieldResult(false, "SHIELD_SAVED_LOW_THREAT", "Smart shield calls low-impact bait.", .78));
    }
    return done(shieldResult(false, "SHIELD_SAVED_LOW_THREAT", "Smart shield saves shield for higher threat.", .72));
  }

  function finalizeShieldResult(result, input, policy) {
    const source = policy === "always" || policy === "no-first" ? "forced-policy" : "battle-intelligence";
    const categories = ["shield-selection"];
    if (result.reasonCodes.includes("SHIELD_PRESERVES_WIN_CONDITION")) categories.push("continuation-search");
    const audited = attachAudit(result, {
      source,
      action: result.action,
      ruleIds: result.sourceRuleIds,
      principleIds: result.principleIds,
      policy: String(input.intelligencePolicy || input.policy || "FAST").toUpperCase(),
      callerContext: input.callerContext || "unknown",
      categories,
      intelligenceOwned: true
    });
    return {
      ...audited,
      principleEngineEvaluated: true,
      principleResolved: true,
      principlesEvaluated: [
        "SHIELD-034_SHIELDED_CHARGED_CONSUMES_SHIELD",
        "SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE"
      ],
      principlesTriggered: [...result.principleIds],
      principlesRejected: result.shield
        ? []
        : ["SHIELD-034_SHIELDED_CHARGED_CONSUMES_SHIELD"],
      finalAction: result.action,
      finalAuthority: "PRINCIPLE_ENGINE",
      fallbackUsed: false,
      fallbackReason: null,
      unresolvedCategories: []
    };
  }

  function shieldResult(shield, reasonCode, explanation, confidence, evidence = null) {
    const principleIds = [
      "SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE",
      ...(shield ? ["SHIELD-034_SHIELDED_CHARGED_CONSUMES_SHIELD"] : [])
    ];
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
      sourceRuleIds: [],
      principleIds,
      reasonCodes: [reasonCode],
      explanation,
      confidence,
      evidence: {
        ...(evidence || {}),
        shieldConsumed: shield ? 1 : 0,
        shieldDamage: shield ? 1 : null
      }
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
      principlesEvaluated: [...(evaluation?.principlesEvaluated || [])],
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
    const principles = candidate?.principleIds || [];
    const reasons = (candidate?.evidence?.candidateEvaluation?.reasons || []).join(" ").toLowerCase();
    if (action.type === ACTION_TYPES.CHARGED_MOVE) categories.add("charged-selection");
    if (principles.includes("TACTICAL-006_FORCED_THROW_BEFORE_FAST_FAINT") || rules.includes("BI_THROW_BEFORE_FAINT")) categories.add("throw-before-faint");
    if (principles.includes("ROUTE-004_CHARGED_READINESS_CALCULATION") || rules.includes("BI_REACHABLE_CHARGED")) categories.add("cheaper-reachable-charged");
    if (principles.includes("TACTICAL-008_IMMEDIATE_UNSHIELDED_CHARGED_LETHAL") || rules.includes("BI_GUARANTEED_LETHAL")) categories.add("guaranteed-lethal");
    if (principles.includes("TIMING-019_DO_NOT_WAIT_IF_OPPONENT_REACHES_LETHAL_CHARGED_PRESSURE")
      || rules.includes("BI_AVOID_LETHAL_OVERFARM") || reasons.includes("overfarm")) categories.add("overfarm");
    if (principles.includes("EFFECT-031_APPLY_GUARANTEED_ATTACK_DEFENSE_EFFECTS") || rules.includes("BI_GUARANTEED_EFFECT")) categories.add("guaranteed-effect");
    if (candidate?.auditMeta?.cmp) categories.add("cmp-ordering");
    if (principles.some(id => id.startsWith("BAIT-")) || reasons.includes("bait")) categories.add("baiting");
    if (principles.some(id => id === "EFFECT-027_STACK_SELF_DEBUFFING_MOVES"
      || id === "EFFECT-042_AVOID_NONLETHAL_SELF_DEBUFF_NUKE_WHILE_HEALTHY")
      || reasons.includes("self-debuff")) categories.add("delayed-self-debuff");
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
      finalAuthority: "PRINCIPLE_ENGINE"
    });
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
    createPrincipleOutcomeVector,
    comparePrincipleOutcomeVectors,
    detectPrincipleAmbiguity,
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
