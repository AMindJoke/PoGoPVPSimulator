"use strict";

function createPvPeakHybridBattleIntelligenceApi() {
  const BAIT_POLICIES = Object.freeze({
    OFF: "OFF",
    SELECTIVE: "SELECTIVE",
    ALWAYS: "ALWAYS"
  });
  const DEFAULT_BUDGETS = Object.freeze({
    FAST: Object.freeze({ maxStates: 160, timeBudgetMs: 3, maxTurns: 96 }),
    STANDARD: Object.freeze({ maxStates: 500, timeBudgetMs: 12, maxTurns: 160 }),
    DEEP_REVIEW: Object.freeze({ maxStates: 1200, timeBudgetMs: 40, maxTurns: 240 })
  });
  const routeCache = new Map();
  const MAX_ROUTE_CACHE = 8192;
  const MAX_DECISION_SAMPLES = 8192;
  const statistics = createStatistics();
  const decisionDurations = [];

  function createStatistics() {
    return {
      selections: 0,
      fastDefaults: 0,
      tacticalExits: 0,
      plannerCalls: 0,
      plannerNodes: 0,
      routesEvaluated: 0,
      incompletePlans: 0,
      ambiguousSelections: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalDecisionMs: 0,
      maxDecisionMs: 0
    };
  }

  function resetStatistics() {
    Object.assign(statistics, createStatistics());
    decisionDurations.length = 0;
  }

  function getStatistics() {
    const lookups = statistics.cacheHits + statistics.cacheMisses;
    const sortedDurations = [...decisionDurations].sort((a, b) => a - b);
    return {
      ...statistics,
      averageDecisionMs: statistics.selections ? statistics.totalDecisionMs / statistics.selections : 0,
      medianDecisionMs: percentile(sortedDurations, .5),
      p95DecisionMs: percentile(sortedDurations, .95),
      decisionDurationSamples: [...decisionDurations],
      cacheHitRate: lookups ? statistics.cacheHits / lookups : 0,
      cacheSize: routeCache.size
    };
  }

  function clearCache() {
    routeCache.clear();
  }

  function normalizeBaitPolicy(value) {
    const policy = String(value || "").trim().toUpperCase();
    if (["ON", "ALWAYS", "TRUE", "2"].includes(policy)) return BAIT_POLICIES.ALWAYS;
    if (["SELECTIVE", "SMART", "1"].includes(policy)) return BAIT_POLICIES.SELECTIVE;
    return BAIT_POLICIES.OFF;
  }

  function resolveBudget(policy, override = {}) {
    const id = String(policy || "FAST").toUpperCase();
    const base = DEFAULT_BUDGETS[id] || DEFAULT_BUDGETS.FAST;
    return {
      maxStates: positiveInteger(override.maxStates, base.maxStates),
      timeBudgetMs: positiveNumber(override.timeBudgetMs, base.timeBudgetMs),
      maxTurns: positiveInteger(override.maxTurns, base.maxTurns)
    };
  }

  function createOutcomeVector(input = {}) {
    const outcomeClass = normalizeOutcome(input.outcomeClass || input.outcome);
    return Object.freeze({
      outcomeClass,
      outcomeRank: ({ loss: 0, draw: 1, win: 2 })[outcomeClass],
      survivingResources: numeric(input.survivingResources),
      shieldValue: numeric(input.shieldValue ?? input.remainingShields),
      hpValue: numeric(input.hpValue ?? input.remainingHp),
      actionableEnergy: numeric(input.actionableEnergy),
      positionalValue: numeric(input.positionalValue),
      turnsToMeaningfulAction: finiteOrInfinity(input.turnsToMeaningfulAction),
      robustness: numeric(input.robustness),
      tacticalEfficiency: numeric(input.tacticalEfficiency),
      stableOrder: String(input.stableOrder || "")
    });
  }

  function compareOutcomeVectors(aInput, bInput) {
    const a = isOutcomeVector(aInput) ? aInput : createOutcomeVector(aInput);
    const b = isOutcomeVector(bInput) ? bInput : createOutcomeVector(bInput);
    return b.outcomeRank - a.outcomeRank
      || b.survivingResources - a.survivingResources
      || b.shieldValue - a.shieldValue
      || b.hpValue - a.hpValue
      || b.actionableEnergy - a.actionableEnergy
      || b.positionalValue - a.positionalValue
      || a.turnsToMeaningfulAction - b.turnsToMeaningfulAction
      || b.robustness - a.robustness
      || b.tacticalEfficiency - a.tacticalEfficiency
      || a.stableOrder.localeCompare(b.stableOrder);
  }

  function actionableEnergy(side = {}, options = {}) {
    const rawEnergy = clamp(numeric(side.energy), 0, 100);
    const chargedMoves = (side.chargedMoves || []).filter(move => numeric(move?.energyCost) > 0);
    const gain = Math.max(0, numeric(side.fastMove?.energyGain));
    const fastTurns = Math.max(1, numeric(side.fastMove?.turns, 1));
    const fastsBeforeFaint = finiteOrInfinity(options.fastsBeforeFaint);
    const reachable = chargedMoves.map(move => {
      const cost = numeric(move.energyCost);
      const fastCount = rawEnergy >= cost ? 0
        : gain > 0 ? Math.ceil((cost - rawEnergy) / gain) : Infinity;
      return {
        moveId: move.id || null,
        cost,
        fastCount,
        turns: Number.isFinite(fastCount) ? fastCount * fastTurns : Infinity,
        reachable: fastCount <= fastsBeforeFaint
      };
    });
    const reachableMoves = reachable.filter(item => item.reachable);
    const next = [...reachableMoves].sort((a, b) =>
      a.turns - b.turns || a.cost - b.cost || String(a.moveId).localeCompare(String(b.moveId))
    )[0] || null;
    const minimumReachableCost = reachableMoves.length
      ? Math.min(...reachableMoves.map(item => item.cost))
      : Infinity;
    const chargedMovesReachableBeforeFaint = reachableMoves.length;
    const additionalChargedCount = minimumReachableCost === Infinity
      ? 0
      : Math.max(0, Math.floor((rawEnergy + Math.max(0, fastsBeforeFaint) * gain) / minimumReachableCost)
        - Math.floor(rawEnergy / minimumReachableCost));
    const actionable = reachableMoves.length ? Math.min(rawEnergy, Math.max(0, minimumReachableCost)) : 0;
    const stranded = rawEnergy - actionable;
    return {
      rawEnergy,
      nextChargedTurns: next && Number.isFinite(next.turns) ? next.turns : null,
      nextChargedFastCount: next && Number.isFinite(next.fastCount) ? next.fastCount : null,
      chargedMovesReachableBeforeFaint,
      additionalChargedCount,
      actionableEnergy: actionable,
      strandedEnergy: stranded,
      energyConversionEfficiency: rawEnergy ? actionable / rawEnergy : 1,
      futureLethalAccess: reachableMoves.some(item => options.lethalMoveIds?.includes(item.moveId)),
      reachableMoves
    };
  }

  function evaluateTiming(input = {}) {
    const actor = input.actor || {};
    const opponent = input.opponent || {};
    const currentTurn = Math.max(0, numeric(input.currentTurn));
    const actorReadyTurn = Math.max(currentTurn, numeric(actor.readyTurn, currentTurn));
    const opponentReadyTurn = Math.max(currentTurn, numeric(opponent.readyTurn, currentTurn));
    const ownFastTurns = Math.max(1, numeric(actor.fastMove?.turns, 1));
    const opponentFastTurns = Math.max(1, numeric(opponent.fastMove?.turns, 1));
    const fastCount = Math.max(1, positiveInteger(input.fastCount, 1));
    const endTurn = actorReadyTurn + ownFastTurns * fastCount;
    const energyGain = Math.max(0, numeric(actor.fastMove?.energyGain)) * fastCount;
    const rawEnergyAfter = numeric(actor.energy) + energyGain;
    const energyAfter = clamp(rawEnergyAfter, 0, 100);
    const opponentFastDamage = Math.max(0, canonicalDamage(input, "opponent", opponent.fastMove, {}));
    const ownFastDamage = Math.max(0, canonicalDamage(input, "actor", actor.fastMove, {}));
    const pendingTaken = pendingDamage(input.pendingEvents, input.actorSide, endTurn);
    const pendingDealt = pendingDamage(input.pendingEvents, input.opponentSide, endTurn, input.actorSide);
    const opponentFastCount = countActionsBefore(opponentReadyTurn, opponentFastTurns, endTurn);
    const damageTaken = pendingTaken + opponentFastCount * opponentFastDamage;
    const opponentEnergyAfter = clamp(
      numeric(opponent.energy) + opponentFastCount * Math.max(0, numeric(opponent.fastMove?.energyGain)),
      0,
      100
    );
    const opponentGetsCharged = (opponent.chargedMoves || []).some(move =>
      opponentEnergyAfter >= numeric(move?.energyCost)
    );
    const actorHpAfterFast = Math.max(0, numeric(actor.hp) - damageTaken);
    const opponentGetsLethalCharged = (opponent.chargedMoves || []).some(move =>
      opponentEnergyAfter >= numeric(move?.energyCost)
      && canonicalDamage(input, "opponent", move, {}) >= actorHpAfterFast
    );
    const actorFaints = numeric(actor.hp) > 0 && damageTaken >= numeric(actor.hp);
    const ownPendingFastLethal = pendingDealt >= numeric(opponent.hp)
      || (ownFastDamage >= numeric(opponent.hp) && ownFastTurns <= Math.max(1, endTurn - actorReadyTurn));
    const affordable = (actor.chargedMoves || []).filter(move => numeric(actor.energy) >= numeric(move?.energyCost));
    const immediateLethal = affordable.some(move =>
      canonicalDamage(input, "actor", move, {}) >= numeric(opponent.hp)
      && !shieldDecision(input, move, { shields: numeric(opponent.shields) })
    );
    const energyOverflow = rawEnergyAfter > 100;
    const currentChargedCount = reachableChargedCount(actor.energy, actor.chargedMoves);
    const futureChargedCount = reachableChargedCount(energyAfter, actor.chargedMoves);
    const opponentChargedCount = reachableChargedCount(opponentEnergyAfter, opponent.chargedMoves);
    const concedeFastMove = opponentFastCount > 0;
    const denyFastMove = opponentReadyTurn < endTurn && opponentReadyTurn + opponentFastTurns > endTurn;
    const timingTarget = Math.max(currentTurn, opponentReadyTurn - 1);
    const opponentFastInFlight = (input.pendingEvents || []).some(event =>
      event?.status !== "denied"
      && event?.sourceSide === input.opponentSide
      && event?.targetSide === input.actorSide
      && numeric(event.resolveTurn) >= currentTurn
      && numeric(event.resolveTurn) <= opponentReadyTurn
    );
    const currentTimingOptimal = opponentFastInFlight
      && opponentReadyTurn > actorReadyTurn
      && actorReadyTurn === timingTarget;
    const reasonCodes = [];
    if (actorFaints) reasonCodes.push("FAINTS_WHILE_WAITING");
    if (energyOverflow) reasonCodes.push("ENERGY_CAP_FORCES_THROW");
    if (immediateLethal) reasonCodes.push("IMMEDIATE_LETHAL_LOST");
    if (opponentGetsCharged) reasonCodes.push("OPPONENT_CHARGED_REACHED");
    if (opponentGetsLethalCharged) reasonCodes.push("LETHAL_CHARGED_CONCEDED");
    if (ownPendingFastLethal) reasonCodes.push("PENDING_FAST_LETHAL");
    if (futureChargedCount > currentChargedCount) reasonCodes.push("DELAY_REACHES_ADDITIONAL_CHARGE");
    if (currentTimingOptimal) reasonCodes.push("CURRENT_TIMING_OPTIMAL");
    if (concedeFastMove) reasonCodes.push("CONCEDES_FAST_MOVE");
    if (denyFastMove) reasonCodes.push("DENIES_FAST_MOVE");
    const safeToWait = !actorFaints
      && !energyOverflow
      && !immediateLethal
      && !ownPendingFastLethal
      && !(currentTimingOptimal && futureChargedCount <= currentChargedCount)
      && !(opponentGetsLethalCharged && numeric(actor.shields) <= 0);
    if (safeToWait) reasonCodes.push("SAFE_EXTRA_FAST");
    return {
      safeToWait,
      recommendedFastCount: safeToWait ? fastCount : 0,
      timingTarget,
      currentTimingOptimal,
      opponentFastInFlight,
      actorReadyTurn,
      opponentReadyTurn,
      energyAfter,
      damageTaken,
      opponentEnergyAfter,
      ownChargedCountBeforeFaint: futureChargedCount,
      opponentChargedCountBeforeFaint: opponentChargedCount,
      concedeFastMove,
      denyFastMove,
      immediateLethalLost: immediateLethal,
      faintsWhileWaiting: actorFaints,
      energyOverflow,
      opponentGetsCharged,
      opponentGetsLethalCharged,
      pendingFastLethal: ownPendingFastLethal,
      reasonCodes
    };
  }

  function planOffensiveRoutes(input = {}) {
    statistics.plannerCalls++;
    const budget = resolveBudget(input.policy, input.budget);
    const cacheKey = input.cacheKey ? `${String(input.cacheKey)}|${input.policy || "FAST"}|${stableStringify(budget)}` : null;
    if (cacheKey && routeCache.has(cacheKey)) {
      statistics.cacheHits++;
      return clone(routeCache.get(cacheKey));
    }
    if (cacheKey) statistics.cacheMisses++;
    const startedAt = now();
    const actor = input.actor || {};
    const defender = input.defender || {};
    const root = {
      energy: clamp(numeric(actor.energy), 0, 100),
      defenderHp: Math.max(0, numeric(defender.hp)),
      defenderShields: Math.max(0, numeric(defender.shields)),
      turn: 0,
      actorAttackStage: clampStage(actor.attackStage),
      actorDefenseStage: clampStage(actor.defenseStage),
      defenderAttackStage: clampStage(defender.attackStage),
      defenderDefenseStage: clampStage(defender.defenseStage),
      sequence: [],
      fastCount: 0,
      chargedCount: 0,
      firstAction: null
    };
    const queue = [root];
    const dominance = new Map();
    const terminalRoutes = [];
    const boundedByFirst = new Map();
    let nodes = 0;
    let complete = true;
    let horizonReason = null;

    while (queue.length) {
      if (nodes >= budget.maxStates) {
        complete = false;
        horizonReason = "state-budget";
        break;
      }
      if (now() - startedAt >= budget.timeBudgetMs) {
        complete = false;
        horizonReason = "time-budget";
        break;
      }
      queue.sort(comparePlannerStates);
      const state = queue.shift();
      nodes++;
      if (!state || state.turn > budget.maxTurns) continue;
      rememberBoundedRoute(boundedByFirst, state, input);
      if (state.defenderHp <= 0) {
        terminalRoutes.push(routeFromState(state, input, "charged-or-fast"));
        continue;
      }
      if (dominated(state, dominance)) continue;
      recordDominance(state, dominance);

      const farmRoute = farmDownRoute(state, input);
      if (farmRoute) terminalRoutes.push(farmRoute);

      const fastState = applyFastRouteState(state, input);
      if (fastState && fastState.turn <= budget.maxTurns) queue.push(fastState);

      for (const move of orderedMoves(actor.chargedMoves || [], input)) {
        if (state.energy < numeric(move.energyCost)) continue;
        const next = applyChargedRouteState(state, move, input);
        if (next && next.turn <= budget.maxTurns) queue.push(next);
      }
    }

    statistics.plannerNodes += nodes;
    if (!complete) statistics.incompletePlans++;
    const bestByFirst = bestRoutesByFirstAction(
      terminalRoutes.length ? terminalRoutes : [...boundedByFirst.values()]
    );
    const routes = [...bestByFirst.values()].sort(compareRoutes);
    statistics.routesEvaluated += routes.length;
    const result = {
      bestRoute: routes[0] || null,
      routes,
      nodes,
      complete,
      horizonReason,
      elapsedMs: Math.max(0, now() - startedAt),
      cacheHit: false
    };
    if (cacheKey) cacheRoute(cacheKey, result);
    return clone(result);
  }

  function detectAmbiguity(routes = []) {
    const meaningful = (routes || []).filter(route => route?.firstAction).sort(compareRoutes);
    if (meaningful.length < 2) {
      return { ambiguous: false, reasonCodes: [], alternatives: meaningful.map(routeSummary) };
    }
    const best = meaningful[0];
    const alternative = meaningful[1];
    const reasonCodes = [];
    if (best.outcome.outcomeClass !== alternative.outcome.outcomeClass) reasonCodes.push("OUTCOME_CLASS_DIFFERS");
    if (best.chargedCount !== alternative.chargedCount) reasonCodes.push("CHARGED_COUNT_DIFFERS");
    if (best.defenderShieldsRemaining !== alternative.defenderShieldsRemaining) reasonCodes.push("SHIELD_ALLOCATION_DIFFERS");
    if (best.cmpBoundary !== alternative.cmpBoundary) reasonCodes.push("CMP_BOUNDARY_DIFFERS");
    if (best.turn !== alternative.turn && Math.abs(best.turn - alternative.turn) <= 2) reasonCodes.push("LETHAL_TIMING_DIFFERS");
    if (best.actionableEnergy !== alternative.actionableEnergy) reasonCodes.push("ACTIONABLE_ENERGY_DIFFERS");
    if (stableActionKey(best.firstAction) !== stableActionKey(alternative.firstAction)
      && (best.chargedCount !== alternative.chargedCount || best.energyAfter !== alternative.energyAfter)) {
      reasonCodes.push("ROUTE_SEQUENCE_DIFFERS");
    }
    const chargedRouteIds = new Set(meaningful
      .filter(route => route.firstAction?.type === "charged_move")
      .map(route => route.firstAction.moveId));
    if (chargedRouteIds.size > 1) {
      reasonCodes.push("CHARGED_ROUTE_DIFFERS");
    }
    return {
      ambiguous: reasonCodes.length > 0,
      reasonCodes,
      alternatives: meaningful.slice(0, 3).map(routeSummary)
    };
  }

  function selectAction(input = {}) {
    const startedAt = now();
    statistics.selections++;
    const legalActions = (input.legalActions || []).map(action => normalizeAction(action, input.actorSide));
    const fast = legalActions.find(action => action.type === "fast_move") || null;
    const charged = legalActions.filter(action => action.type === "charged_move");
    const actor = input.actor || {};
    const opponent = input.opponent || {};

    if (!charged.length) {
      statistics.fastDefaults++;
      return finishDecision(decision(fast, true, ["FAST_DEFAULT"], "No Charged Move is currently legal."), startedAt);
    }

    const ownPendingLethal = (input.pendingEvents || []).some(event =>
      event?.status !== "denied"
      && event?.sourceSide === input.actorSide
      && event?.targetSide === input.opponentSide
      && numeric(event.damage) >= numeric(opponent.hp)
      && numeric(event.resolveTurn) >= numeric(input.currentTurn)
    );
    if (ownPendingLethal && fast) {
      statistics.tacticalExits++;
      return finishDecision(decision(fast, true, ["PENDING_FAST_LETHAL", "FAST_DEFAULT"], "A committed Fast impact already guarantees the knockout."), startedAt);
    }

    const immediateLethal = charged
      .filter(action => canonicalDamage(input, "actor", action.move, {}) >= numeric(opponent.hp))
      .filter(action => !shieldDecision(input, action.move, { shields: numeric(opponent.shields) }))
      .sort((a, b) => energyCost(a.move) - energyCost(b.move) || stableActionKey(a).localeCompare(stableActionKey(b)))[0];
    if (immediateLethal) {
      statistics.tacticalExits++;
      return finishDecision(decision(immediateLethal, true, ["LETHAL_MOVE_AVAILABLE"], "The lowest-cost legal Charged Move guarantees the knockout."), startedAt);
    }

    const timing = evaluateTiming({
      ...input,
      actor,
      opponent,
      fastCount: 1
    });
    const forcedThrow = timing.faintsWhileWaiting
      || (timing.opponentGetsLethalCharged && numeric(actor.shields) <= 0)
      || timing.energyOverflow
      || (timing.currentTimingOptimal
        && timing.ownChargedCountBeforeFaint <= reachableChargedCount(actor.energy, actor.chargedMoves));
    if (forcedThrow) {
      const bestThrow = [...charged].sort((a, b) =>
        canonicalDamage(input, "actor", b.move, {}) - canonicalDamage(input, "actor", a.move, {})
        || energyCost(a.move) - energyCost(b.move)
        || stableActionKey(a).localeCompare(stableActionKey(b))
      )[0];
      statistics.tacticalExits++;
      const reasons = timing.energyOverflow
        ? ["ENERGY_CAP_FORCES_THROW"]
        : timing.faintsWhileWaiting ? ["FORCED_THROW_BEFORE_FAINT"]
          : timing.currentTimingOptimal ? ["OPTIMAL_CHARGE_TIMING"]
            : ["THROW_NOW_PREVENTS_OPPONENT_CHARGE"];
      return finishDecision(decision(bestThrow, true, reasons, "Waiting loses the current meaningful Charged Move window.", { timing }), startedAt);
    }

    const routePlan = planOffensiveRoutes({
      ...input,
      actor,
      defender: opponent,
      cacheKey: input.routeCacheKey,
      policy: input.policy
    });
    const ambiguity = detectAmbiguity(routePlan.routes);
    if (ambiguity.ambiguous) statistics.ambiguousSelections++;
    const selected = actionForRoute(routePlan.bestRoute, fast, charged);
    if (!selected) {
      statistics.fastDefaults++;
      return finishDecision(decision(fast, true, ["FAST_DEFAULT"], "No bounded route justifies interrupting Fast Move pressure.", {
        timing,
        routePlan,
        ambiguity
      }), startedAt);
    }
    const farm = routePlan.bestRoute?.routeType === "farm-down";
    const reasonCodes = farm
      ? ["FARM_DOWN_ROUTE"]
      : selected.type === "fast_move"
        ? [timing.safeToWait ? "SAFE_EXTRA_FAST" : "FAST_DEFAULT"]
        : ["BOUNDED_OFFENSIVE_ROUTE"];
    return finishDecision(decision(
      selected,
      !ambiguity.ambiguous,
      reasonCodes,
      farm
        ? "Fast farm-down is the best bounded offensive route."
        : selected.type === "fast_move"
          ? "One Fast Move improves the best bounded route; re-plan after it resolves."
          : "The bounded offensive route starts with this Charged Move.",
      { timing, routePlan, ambiguity }
    ), startedAt);
  }

  function finishDecision(result, startedAt) {
    const duration = Math.max(0, now() - startedAt);
    statistics.totalDecisionMs += duration;
    statistics.maxDecisionMs = Math.max(statistics.maxDecisionMs, duration);
    const sampleIndex = Math.max(0, statistics.selections - 1) % MAX_DECISION_SAMPLES;
    decisionDurations[sampleIndex] = duration;
    return result;
  }

  function decision(action, decisive, reasonCodes, explanation, evidence = {}) {
    return {
      action: action || null,
      decisive: decisive === true,
      fastPath: decisive === true,
      reasonCodes: [...new Set(reasonCodes || [])],
      explanation,
      timing: evidence.timing || null,
      routePlan: evidence.routePlan || null,
      ambiguity: evidence.ambiguity || { ambiguous: false, reasonCodes: [], alternatives: [] },
      completeness: evidence.routePlan?.complete === false ? "bounded" : "complete"
    };
  }

  function applyFastRouteState(state, input) {
    const actor = input.actor || {};
    const gain = Math.max(0, numeric(actor.fastMove?.energyGain));
    const turns = Math.max(1, numeric(actor.fastMove?.turns, 1));
    const damage = Math.max(0, routeDamage(input, "actor", actor.fastMove, state));
    if (!actor.fastMove || damage <= 0 && gain <= 0) return null;
    const energy = Math.min(100, state.energy + gain);
    return {
      ...state,
      energy,
      defenderHp: Math.max(0, state.defenderHp - damage),
      turn: state.turn + turns,
      fastCount: state.fastCount + 1,
      firstAction: state.firstAction || { type: "fast_move", moveId: actor.fastMove.id || null },
      sequence: [...state.sequence, { type: "fast_move", moveId: actor.fastMove.id || null }]
    };
  }

  function applyChargedRouteState(state, move, input) {
    const cost = energyCost(move);
    if (!cost || state.energy < cost) return null;
    const shielded = state.defenderShields > 0 && shieldDecision(input, move, state);
    const damage = shielded ? 1 : Math.max(0, routeDamage(input, "actor", move, state));
    const stages = applyGuaranteedStages(state, move);
    return {
      ...state,
      ...stages,
      energy: Math.max(0, state.energy - cost),
      defenderHp: Math.max(0, state.defenderHp - damage),
      defenderShields: Math.max(0, state.defenderShields - (shielded ? 1 : 0)),
      turn: state.turn + 1,
      chargedCount: state.chargedCount + 1,
      firstAction: state.firstAction || { type: "charged_move", moveId: move.id || null },
      sequence: [...state.sequence, { type: "charged_move", moveId: move.id || null, shielded }]
    };
  }

  function farmDownRoute(state, input) {
    const actor = input.actor || {};
    if (!actor.fastMove || state.defenderHp <= 0) return null;
    const damage = Math.max(0, routeDamage(input, "actor", actor.fastMove, state));
    if (!damage) return null;
    const fasts = Math.ceil(state.defenderHp / damage);
    const turns = fasts * Math.max(1, numeric(actor.fastMove.turns, 1));
    const energyAfter = Math.min(100, state.energy + fasts * Math.max(0, numeric(actor.fastMove.energyGain)));
    const terminal = {
      ...state,
      energy: energyAfter,
      defenderHp: 0,
      turn: state.turn + turns,
      fastCount: state.fastCount + fasts,
      firstAction: state.firstAction || { type: "fast_move", moveId: actor.fastMove.id || null },
      sequence: [
        ...state.sequence,
        ...Array.from({ length: fasts }, () => ({ type: "fast_move", moveId: actor.fastMove.id || null }))
      ]
    };
    return routeFromState(terminal, input, "farm-down");
  }

  function routeFromState(state, input, routeType) {
    const survival = survivalProjection(input, state);
    const cmpBoundary = state.turn === survival.turnsToFaint;
    const outcomeClass = state.turn < survival.turnsToFaint
      ? "win"
      : cmpBoundary && numeric(input.cmpAdvantage) > 0 ? "win"
        : cmpBoundary && numeric(input.cmpAdvantage) === 0 ? "draw" : "loss";
    const energy = actionableEnergy({
      ...(input.actor || {}),
      energy: state.energy,
      attackStage: state.actorAttackStage,
      defenseStage: state.actorDefenseStage
    }, {
      fastsBeforeFaint: Math.max(0, Math.floor((survival.turnsToFaint - state.turn)
        / Math.max(1, numeric(input.actor?.fastMove?.turns, 1))))
    });
    return {
      firstAction: state.firstAction,
      sequence: state.sequence,
      routeType,
      outcome: createOutcomeVector({
        outcomeClass,
        remainingHp: outcomeClass === "win" ? Math.max(1, numeric(input.actor?.hp) - numeric(survival.damageTaken)) : 0,
        remainingShields: numeric(input.actor?.shields),
        actionableEnergy: outcomeClass === "win" ? energy.actionableEnergy : 0,
        positionalValue: -state.turn,
        robustness: survival.turnsToFaint - state.turn,
        tacticalEfficiency: -state.sequence.length,
        stableOrder: routeStableOrder(state)
      }),
      turn: state.turn,
      chargedCount: state.chargedCount,
      fastCount: state.fastCount,
      energyAfter: state.energy,
      actionableEnergy: outcomeClass === "win" ? energy.actionableEnergy : 0,
      strandedEnergy: outcomeClass === "win" ? energy.strandedEnergy : state.energy,
      defenderShieldsRemaining: state.defenderShields,
      cmpBoundary,
      complete: state.defenderHp <= 0
    };
  }

  function rememberBoundedRoute(map, state, input) {
    if (!state.firstAction) return;
    const key = stableActionKey(state.firstAction);
    const survival = survivalProjection(input, state);
    const route = {
      ...routeFromState(state, input, "bounded"),
      outcome: createOutcomeVector({
        outcome: "loss",
        hpValue: -state.defenderHp,
        actionableEnergy: 0,
        positionalValue: -state.turn,
        robustness: survival.turnsToFaint - state.turn,
        tacticalEfficiency: -state.sequence.length,
        stableOrder: routeStableOrder(state)
      }),
      complete: false
    };
    const previous = map.get(key);
    if (!previous || compareRoutes(route, previous) < 0) map.set(key, route);
  }

  function bestRoutesByFirstAction(routes) {
    const map = new Map();
    for (const route of routes || []) {
      if (!route?.firstAction) continue;
      const key = stableActionKey(route.firstAction);
      const previous = map.get(key);
      if (!previous || compareRoutes(route, previous) < 0) map.set(key, route);
    }
    return map;
  }

  function compareRoutes(a, b) {
    return compareOutcomeVectors(a.outcome, b.outcome)
      || Number(b.complete) - Number(a.complete)
      || a.turn - b.turn
      || a.strandedEnergy - b.strandedEnergy
      || stableActionKey(a.firstAction).localeCompare(stableActionKey(b.firstAction));
  }

  function comparePlannerStates(a, b) {
    return a.turn - b.turn
      || a.defenderHp - b.defenderHp
      || b.energy - a.energy
      || routeStableOrder(a).localeCompare(routeStableOrder(b));
  }

  function dominated(state, dominance) {
    const key = dominanceKey(state);
    const entries = dominance.get(key) || [];
    return entries.some(other =>
      other.turn <= state.turn
      && other.energy >= state.energy
      && other.defenderHp <= state.defenderHp
      && other.actorAttackStage >= state.actorAttackStage
      && other.actorDefenseStage >= state.actorDefenseStage
    );
  }

  function recordDominance(state, dominance) {
    const key = dominanceKey(state);
    const entries = dominance.get(key) || [];
    const retained = entries.filter(other => !(
      state.turn <= other.turn
      && state.energy >= other.energy
      && state.defenderHp <= other.defenderHp
      && state.actorAttackStage >= other.actorAttackStage
      && state.actorDefenseStage >= other.actorDefenseStage
    ));
    retained.push({
      turn: state.turn,
      energy: state.energy,
      defenderHp: state.defenderHp,
      actorAttackStage: state.actorAttackStage,
      actorDefenseStage: state.actorDefenseStage
    });
    dominance.set(key, retained);
  }

  function dominanceKey(state) {
    return [
      state.defenderShields,
      state.defenderAttackStage,
      state.defenderDefenseStage,
      state.chargedCount
    ].join(":");
  }

  function applyGuaranteedStages(state, move) {
    if (numeric(move?.buffApplyChance) < 1) return {};
    let actorBuffs = null;
    let defenderBuffs = null;
    if (move.buffTarget === "both") {
      actorBuffs = move.buffsSelf;
      defenderBuffs = move.buffsOpponent;
    } else if (move.buffTarget === "opponent") {
      defenderBuffs = move.buffs;
    } else {
      actorBuffs = move.buffs;
    }
    return {
      actorAttackStage: clampStage(state.actorAttackStage + numeric(actorBuffs?.[0])),
      actorDefenseStage: clampStage(state.actorDefenseStage + numeric(actorBuffs?.[1])),
      defenderAttackStage: clampStage(state.defenderAttackStage + numeric(defenderBuffs?.[0])),
      defenderDefenseStage: clampStage(state.defenderDefenseStage + numeric(defenderBuffs?.[1]))
    };
  }

  function survivalProjection(input, state) {
    if (typeof input.survivalProjection === "function") {
      const result = input.survivalProjection(state) || {};
      return {
        turnsToFaint: finiteOrInfinity(result.turnsToFaint),
        damageTaken: Math.max(0, numeric(result.damageTaken)),
        opponentChargedCount: Math.max(0, numeric(result.opponentChargedCount))
      };
    }
    return {
      turnsToFaint: finiteOrInfinity(input.turnsToFaint),
      damageTaken: 0,
      opponentChargedCount: 0
    };
  }

  function routeDamage(input, side, move, state) {
    return canonicalDamage(input, side, move, {
      actorAttackStage: state.actorAttackStage,
      actorDefenseStage: state.actorDefenseStage,
      defenderAttackStage: state.defenderAttackStage,
      defenderDefenseStage: state.defenderDefenseStage
    });
  }

  function canonicalDamage(input, side, move, stages) {
    if (!move) return 0;
    if (typeof input.damage === "function") return Math.max(0, numeric(input.damage(side, move, stages)));
    if (typeof input.estimateDamage === "function" && side === "actor") {
      return Math.max(0, numeric(input.estimateDamage(move, stages)));
    }
    return Math.max(0, numeric(move.damage ?? move.metadata?.damage));
  }

  function shieldDecision(input, move, state) {
    if (numeric(state?.shields) <= 0 && numeric(state?.defenderShields) <= 0) return false;
    if (typeof input.willShield === "function") return !!input.willShield(move, state);
    const policy = normalizeBaitPolicy(input.baitPolicy);
    return policy === BAIT_POLICIES.ALWAYS || numeric(state?.shields ?? state?.defenderShields) > 0;
  }

  function actionForRoute(route, fast, charged) {
    if (!route?.firstAction) return null;
    if (route.firstAction.type === "fast_move") return fast;
    return charged.find(action => action.moveId === route.firstAction.moveId) || null;
  }

  function normalizeAction(action = {}, side = null) {
    const type = action.type === "fast" ? "fast_move"
      : action.type === "charged" ? "charged_move" : action.type;
    return {
      type,
      side: action.side || side || null,
      moveId: action.moveId || action.move?.id || null,
      move: action.move || null,
      moveIndex: Number.isInteger(action.moveIndex) ? action.moveIndex : null,
      timing: action.startTurn == null ? action.timing || null : { startTurn: Number(action.startTurn) },
      metadata: action.metadata || null,
      originalAction: action
    };
  }

  function orderedMoves(moves, input) {
    return [...(moves || [])].filter(Boolean).sort((a, b) => {
      const bait = normalizeBaitPolicy(input.baitPolicy);
      if (bait === BAIT_POLICIES.OFF) {
        const damageDifference = routeDamage(input, "actor", b, rootStages(input))
          - routeDamage(input, "actor", a, rootStages(input));
        if (damageDifference) return damageDifference;
      }
      return energyCost(a) - energyCost(b) || String(a.id || "").localeCompare(String(b.id || ""));
    });
  }

  function rootStages(input) {
    return {
      actorAttackStage: clampStage(input.actor?.attackStage),
      actorDefenseStage: clampStage(input.actor?.defenseStage),
      defenderAttackStage: clampStage(input.defender?.attackStage),
      defenderDefenseStage: clampStage(input.defender?.defenseStage)
    };
  }

  function pendingDamage(events, targetSide, throughTurn, sourceSide = null) {
    return (events || []).filter(event =>
      event?.status !== "denied"
      && event?.targetSide === targetSide
      && (!sourceSide || event?.sourceSide === sourceSide)
      && numeric(event.resolveTurn) <= throughTurn
    ).reduce((sum, event) => sum + Math.max(0, numeric(event.damage)), 0);
  }

  function countActionsBefore(readyTurn, duration, boundaryTurn) {
    if (readyTurn >= boundaryTurn) return 0;
    return Math.max(0, Math.ceil((boundaryTurn - readyTurn) / Math.max(1, duration)));
  }

  function reachableChargedCount(energy, moves) {
    const costs = (moves || []).map(move => energyCost(move)).filter(Boolean);
    if (!costs.length) return 0;
    return Math.floor(Math.max(0, numeric(energy)) / Math.min(...costs));
  }

  function routeSummary(route) {
    return {
      firstAction: route.firstAction,
      outcomeClass: route.outcome?.outcomeClass || "loss",
      turn: route.turn,
      chargedCount: route.chargedCount,
      actionableEnergy: route.actionableEnergy,
      energyAfter: route.energyAfter,
      defenderShieldsRemaining: route.defenderShieldsRemaining,
      routeType: route.routeType,
      complete: route.complete
    };
  }

  function routeStableOrder(state) {
    return (state.sequence || []).map(stableActionKey).join(">");
  }

  function stableActionKey(action) {
    return `${action?.type || "none"}:${action?.moveId || ""}`;
  }

  function energyCost(move) {
    return Math.max(0, numeric(move?.energyCost ?? move?.metadata?.energyCost));
  }

  function cacheRoute(key, value) {
    if (routeCache.size >= MAX_ROUTE_CACHE) routeCache.delete(routeCache.keys().next().value);
    routeCache.set(key, clone(value));
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function stableStringify(value) {
    return JSON.stringify(stableObject(value));
  }

  function stableObject(value) {
    if (value == null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(stableObject);
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableObject(value[key])]));
  }

  function normalizeOutcome(value) {
    const outcome = String(value || "loss").toLowerCase();
    return ["win", "draw", "loss"].includes(outcome) ? outcome : "loss";
  }

  function isOutcomeVector(value) {
    return value && Number.isFinite(value.outcomeRank) && typeof value.outcomeClass === "string";
  }

  function clampStage(value) {
    return clamp(numeric(value), -4, 4);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function numeric(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function finiteOrInfinity(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
  }

  function positiveInteger(value, fallback) {
    const number = Math.floor(Number(value));
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function now() {
    if (typeof globalThis !== "undefined" && globalThis.PVPEAK_DETERMINISTIC_PLANNER_TIME === true) return 0;
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  function percentile(sortedValues, fraction) {
    if (!sortedValues.length) return 0;
    const index = Math.min(sortedValues.length - 1, Math.max(0, Math.ceil(sortedValues.length * fraction) - 1));
    return sortedValues[index];
  }

  return Object.freeze({
    createApi: createPvPeakHybridBattleIntelligenceApi,
    BAIT_POLICIES,
    DEFAULT_BUDGETS,
    normalizeBaitPolicy,
    createOutcomeVector,
    compareOutcomeVectors,
    actionableEnergy,
    evaluateTiming,
    planOffensiveRoutes,
    detectAmbiguity,
    selectAction,
    clearCache,
    resetStatistics,
    getStatistics
  });
}

(function exposePvPeakHybridBattleIntelligence(root) {
  const api = createPvPeakHybridBattleIntelligenceApi();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.createPvPeakHybridBattleIntelligenceApi = createPvPeakHybridBattleIntelligenceApi;
    root.PvPeakHybridBattleIntelligence = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
