"use strict";

function createPvPeakMatchupPlannerApi() {
  const perfDebug = typeof globalThis !== "undefined" && globalThis.PvPeakPerfDebug?.enabled
    ? globalThis.PvPeakPerfDebug
    : null;
  const OUTCOME_RANK = Object.freeze({ loss: 0, draw: 1, win: 2 });
  const POLICIES = Object.freeze({
    FAST: Object.freeze({ id: "FAST", maxDepth: 4, maxNodes: 600, timeBudgetMs: 8 }),
    STANDARD: Object.freeze({ id: "STANDARD", maxDepth: 8, maxNodes: 5000, timeBudgetMs: 40 }),
    DEEP_REVIEW: Object.freeze({ id: "DEEP_REVIEW", maxDepth: 16, maxNodes: 50000, timeBudgetMs: 350 })
  });

  function resolvePolicy(input) {
    const id = String(input?.id || input || "FAST").toUpperCase();
    return POLICIES[id] || POLICIES.FAST;
  }

  function createOutcomeVector(input = {}) {
    const outcomeClass = normalizeOutcome(input.outcomeClass || input.outcome);
    return Object.freeze({
      outcomeClass,
      outcomeRank: OUTCOME_RANK[outcomeClass],
      survivingResources: numeric(input.survivingResources),
      shieldValue: numeric(input.shieldValue ?? input.remainingShields),
      hpValue: numeric(input.hpValue ?? input.remainingHp),
      actionableEnergy: numeric(input.actionableEnergy),
      positionalValue: numeric(input.positionalValue),
      turnsToMeaningfulAction: finiteOrInfinity(input.turnsToMeaningfulAction),
      robustness: numeric(input.robustness),
      heuristicTieBreak: numeric(input.heuristicTieBreak),
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
      || b.heuristicTieBreak - a.heuristicTieBreak
      || a.stableOrder.localeCompare(b.stableOrder);
  }

  function createPlanStep(input = {}) {
    return Object.freeze({
      stateHash: String(input.stateHash || ""),
      action: cloneStable(input.action || null),
      expectedOpponentResponse: cloneStable(input.expectedOpponentResponse || null),
      resultingStateHash: String(input.resultingStateHash || ""),
      strategicPurpose: input.strategicPurpose || null,
      timingIntent: cloneStable(input.timingIntent || null),
      confidence: clamp(numeric(input.confidence, .5), 0, 1)
    });
  }

  function createStrategicLine(input = {}) {
    const outcome = isOutcomeVector(input.outcome) ? input.outcome : createOutcomeVector(input.outcome || {});
    return Object.freeze({
      actions: Object.freeze((input.actions || []).map(action => cloneStable(action))),
      opponentResponses: Object.freeze((input.opponentResponses || []).map(action => cloneStable(action))),
      outcome,
      finalState: cloneStable(input.finalState || null),
      terminalScore: outcome,
      heuristicScore: numeric(input.heuristicScore),
      completeness: input.completeness || "unknown",
      horizonReason: input.horizonReason || null,
      principalVariation: Object.freeze((input.principalVariation || []).map(createPlanStep))
    });
  }

  function createMatchupPlan(input = {}) {
    const principalLine = input.principalLine ? createStrategicLine(input.principalLine) : null;
    return Object.freeze({
      planId: String(input.planId || ""),
      rootStateHash: String(input.rootStateHash || ""),
      side: input.side || null,
      policy: resolvePolicy(input.policy).id,
      principalVariation: principalLine?.principalVariation || Object.freeze([]),
      principalLine,
      alternativeLines: Object.freeze((input.alternativeLines || []).map(createStrategicLine)),
      outcomeClass: principalLine?.outcome?.outcomeClass || "loss",
      terminalScore: principalLine?.outcome || null,
      confidence: clamp(numeric(input.confidence, .5), 0, 1),
      searchedNodes: Math.max(0, Math.floor(numeric(input.searchedNodes))),
      depthReached: Math.max(0, Math.floor(numeric(input.depthReached))),
      completedDepth: Math.max(0, Math.floor(numeric(input.completedDepth))),
      cacheHits: Math.max(0, Math.floor(numeric(input.cacheHits))),
      prunedBranches: Math.max(0, Math.floor(numeric(input.prunedBranches))),
      elapsedMs: Math.max(0, numeric(input.elapsedMs)),
      incompleteHorizon: input.incompleteHorizon === true,
      horizonReason: input.horizonReason || null,
      explanation: input.explanation || "",
      reasonCodes: Object.freeze([...(input.reasonCodes || [])])
    });
  }

  function canonicalStateHash(state, policy = "FAST", mechanicsVersion = "unknown") {
    return JSON.stringify({
      mechanicsVersion,
      policy: resolvePolicy(policy).id,
      state: stableObject(state)
    });
  }

  function search(input = {}) {
    const searchSpan = perfDebug?.startSpan("planner.search");
    const adapter = validateAdapter(input.adapter);
    const policy = resolvePolicy(input.policy);
    const perspective = input.perspective || input.side;
    const startedAt = now();
    const table = input.transpositionTable || new Map();
    const stats = {
      nodes: 0,
      cacheHits: 0,
      cacheMisses: 0,
      pruned: 0,
      depthReached: 0,
      completedDepth: 0,
      candidatesGenerated: 0,
      candidateGenerations: 0,
      evaluations: 0,
      transitions: 0,
      timedOut: false
    };
    const context = { adapter, policy, perspective, startedAt, table, stats };
    const rootState = input.state;
    const rootSide = input.side;
    const candidates = plannerCandidates(context, rootState, rootSide);
    let lines = [];
    let partialLines = [];

    // Keep the deepest fully evaluated root iteration. A timeout must never
    // make a later root candidate lose merely because it was searched last.
    for (let depth = 1; depth <= policy.maxDepth; depth++) {
      const iteration = searchRootIteration(rootState, rootSide, candidates, depth, context);
      if (iteration.lines.length) partialLines = iteration.lines;
      if (!iteration.complete) break;
      lines = iteration.lines;
      stats.completedDepth = depth;
      if (iteration.lines.every(line => line.completeness === "complete")) break;
    }
    if (!lines.length) lines = partialLines;

    lines.sort((a, b) => compareOutcomeVectors(a.outcome, b.outcome));
    const principalLine = lines[0] || createStrategicLine({
      outcome: plannerEvaluate(context, rootState, perspective, { horizon: true }),
      finalState: rootState,
      completeness: "bounded",
      horizonReason: stats.timedOut ? "time-budget" : "no-candidate"
    });
    const provenOutcome = principalLine.completeness === "complete";
    const rootStateHash = plannerHash(context, rootState);
    const plan = createMatchupPlan({
      planId: `mp-${hashString(rootStateHash)}`,
      rootStateHash,
      side: rootSide,
      policy,
      principalLine,
      alternativeLines: lines.slice(1),
      confidence: provenOutcome ? .95 : .55,
      searchedNodes: stats.nodes,
      depthReached: stats.depthReached,
      completedDepth: stats.completedDepth,
      cacheHits: stats.cacheHits,
      prunedBranches: stats.pruned,
      elapsedMs: now() - startedAt,
      incompleteHorizon: stats.timedOut || principalLine.completeness !== "complete",
      horizonReason: principalLine.horizonReason,
      explanation: principalLine.actions.length
        ? provenOutcome
          ? `Selected the first action of the best proven ${principalLine.outcome.outcomeClass} line.`
          : "Selected the first action of the best bounded line; the terminal outcome is not proven."
        : "No strategic action was available.",
      reasonCodes: [
        ...(provenOutcome
          ? [principalLine.outcome.outcomeClass === "win" ? "MP_PROVEN_WIN"
            : principalLine.outcome.outcomeClass === "draw" ? "MP_PROVEN_DRAW" : "MP_AVOID_PROVEN_LOSS"]
          : ["MP_SEARCH_HORIZON_INCOMPLETE"]),
        ...(stats.timedOut ? ["MP_FAST_POLICY_TIMEOUT"] : [])
      ]
    });
    if (perfDebug) {
      perfDebug.gauge("planner.nodes", stats.nodes);
      perfDebug.gauge("planner.maxDepth", stats.depthReached);
      perfDebug.gauge("planner.completedDepth", stats.completedDepth);
      perfDebug.increment("planner.candidates", stats.candidatesGenerated);
      perfDebug.increment("planner.candidateGenerations", stats.candidateGenerations);
      perfDebug.increment("planner.evaluations", stats.evaluations);
      perfDebug.increment("planner.transitions", stats.transitions);
      if (stats.cacheHits) perfDebug.recordCache("transposition", true, { count: stats.cacheHits, size: table.size });
      if (stats.cacheMisses) perfDebug.recordCache("transposition", false, { count: stats.cacheMisses, size: table.size });
      perfDebug.endSpan(searchSpan);
    }
    return plan;
  }

  function searchRootIteration(rootState, rootSide, candidates, depth, context) {
    const lines = [];
    let complete = true;
    for (const candidate of candidates) {
      if (budgetExceeded(context)) {
        complete = false;
        break;
      }
      const transition = plannerApply(context, rootState, rootSide, candidate);
      if (!transition?.state) continue;
      const child = minimax(transition.state, transition.nextSide, depth - 1, context, null, null, 1);
      if (child.budgetInterrupted) complete = false;
      const step = createPlanStep({
        stateHash: plannerHash(context, rootState),
        action: candidate.action || candidate,
        expectedOpponentResponse: child.steps[0]?.action || null,
        resultingStateHash: plannerHash(context, transition.state),
        strategicPurpose: candidate.strategicPurpose || null,
        timingIntent: candidate.timingIntent || null,
        confidence: child.complete ? .95 : .65
      });
      lines.push(createStrategicLine({
        actions: [candidate.action || candidate, ...child.actions],
        opponentResponses: child.responses,
        outcome: child.outcome,
        finalState: child.finalState,
        completeness: child.complete ? "complete" : "bounded",
        horizonReason: child.horizonReason,
        principalVariation: [step, ...child.steps]
      }));
      if (!complete) break;
    }
    return { lines, complete: complete && lines.length === candidates.length };
  }

  function minimax(state, side, depth, context, alpha, beta, ply) {
    context.stats.nodes++;
    context.stats.depthReached = Math.max(context.stats.depthReached, ply);
    const terminal = context.adapter.terminal(state, context.perspective);
    if (terminal) return leaf(state, terminal, true, "terminal");
    if (budgetExceeded(context)) {
      return leaf(state, plannerEvaluate(context, state, context.perspective, { horizon: true }), false, "time-budget", true);
    }
    if (depth <= 0) {
      return leaf(state, plannerEvaluate(context, state, context.perspective, { horizon: true }), false, "depth-budget");
    }

    const key = `${plannerHash(context, state)}|${side}|${depth}|${context.perspective}`;
    const cached = context.table.get(key);
    if (cached) {
      context.stats.cacheHits++;
      return cached;
    }
    context.stats.cacheMisses++;
    const candidates = plannerCandidates(context, state, side);
    if (!candidates.length) return leaf(state, plannerEvaluate(context, state, context.perspective, { horizon: true }), false, "no-candidate");

    const maximizing = side === context.perspective;
    let best = null;
    let prunedAtNode = false;
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
      const candidate = candidates[candidateIndex];
      if (budgetExceeded(context)) break;
      const transition = plannerApply(context, state, side, candidate);
      if (!transition?.state) continue;
      const child = minimax(transition.state, transition.nextSide, depth - 1, context, alpha, beta, ply + 1);
      const result = {
        ...child,
        actions: [candidate.action || candidate, ...child.actions],
        responses: maximizing ? child.responses : [candidate.action || candidate, ...child.responses],
        steps: [createPlanStep({
          stateHash: plannerHash(context, state),
          action: candidate.action || candidate,
          resultingStateHash: plannerHash(context, transition.state),
          strategicPurpose: candidate.strategicPurpose || null,
          timingIntent: candidate.timingIntent || null,
          confidence: child.complete ? .95 : .65
        }), ...child.steps]
      };
      if (!best || (maximizing
        ? compareOutcomeVectors(result.outcome, best.outcome) < 0
        : compareOutcomeVectors(result.outcome, best.outcome) > 0)) best = result;
      if (maximizing && (!alpha || compareOutcomeVectors(best.outcome, alpha) < 0)) alpha = best.outcome;
      if (!maximizing && (!beta || compareOutcomeVectors(best.outcome, beta) > 0)) beta = best.outcome;
      if (alpha && beta && compareOutcomeVectors(alpha, beta) <= 0) {
        context.stats.pruned += Math.max(0, candidates.length - candidateIndex - 1);
        prunedAtNode = true;
        break;
      }
      if (child.budgetInterrupted) break;
    }
    if (!best) best = leaf(state, context.adapter.evaluate(state, context.perspective, { horizon: true }), false, "budget");
    if (!best.budgetInterrupted && !prunedAtNode) context.table.set(key, best);
    return best;
  }

  function leaf(state, outcome, complete, horizonReason, budgetInterrupted = false) {
    return {
      outcome: isOutcomeVector(outcome) ? outcome : createOutcomeVector(outcome),
      finalState: cloneStable(state),
      complete,
      budgetInterrupted,
      horizonReason,
      actions: [],
      responses: [],
      steps: []
    };
  }

  function plannerCandidates(context, state, side) {
    const span = perfDebug?.startSpan("planner.candidateGeneration");
    try {
      const candidates = stableCandidates(context.adapter.candidates(state, side, { policy: context.policy.id }));
      context.stats.candidateGenerations++;
      context.stats.candidatesGenerated += candidates.length;
      return candidates;
    } finally {
      perfDebug?.endSpan(span);
    }
  }

  function plannerEvaluate(context, state, perspective, options) {
    const span = perfDebug?.startSpan("planner.evaluation");
    try {
      context.stats.evaluations++;
      return context.adapter.evaluate(state, perspective, options);
    } finally {
      perfDebug?.endSpan(span);
    }
  }

  function plannerApply(context, state, side, candidate) {
    const span = perfDebug?.startSpan("planner.transition");
    try {
      context.stats.transitions++;
      return context.adapter.apply(state, side, candidate, { policy: context.policy.id });
    } finally {
      perfDebug?.endSpan(span);
    }
  }

  function plannerHash(context, state) {
    const span = perfDebug?.startSpan("serialization.stateHash");
    try {
      return context.adapter.hash(state, context.policy.id);
    } finally {
      const duration = perfDebug?.endSpan(span) || 0;
      if (perfDebug) perfDebug.recordSerialization("serialize", duration);
    }
  }

  function budgetExceeded(context) {
    if (context.stats.nodes >= context.policy.maxNodes || now() - context.startedAt >= context.policy.timeBudgetMs) {
      context.stats.timedOut = true;
      return true;
    }
    return false;
  }

  function validateAdapter(adapter) {
    for (const name of ["hash", "terminal", "evaluate", "candidates", "apply"]) {
      if (typeof adapter?.[name] !== "function") throw new TypeError(`Matchup planner adapter requires ${name}().`);
    }
    return adapter;
  }

  function stableCandidates(candidates) {
    return [...(candidates || [])].sort((a, b) => String(a.id || a.action?.moveId || a.action?.type || "")
      .localeCompare(String(b.id || b.action?.moveId || b.action?.type || "")));
  }

  function normalizeOutcome(value) {
    const outcome = String(value || "loss").toLowerCase();
    return Object.prototype.hasOwnProperty.call(OUTCOME_RANK, outcome) ? outcome : "loss";
  }

  function isOutcomeVector(value) {
    return value && Number.isFinite(value.outcomeRank) && typeof value.outcomeClass === "string";
  }

  function stableObject(value) {
    if (value == null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(stableObject);
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableObject(value[key])]));
  }

  function cloneStable(value) {
    if (value == null) return value;
    return stableObject(JSON.parse(JSON.stringify(value)));
  }

  function numeric(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function finiteOrInfinity(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function now() {
    if (typeof globalThis !== "undefined" && globalThis.PVPEAK_DETERMINISTIC_PLANNER_TIME === true) return 0;
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  return Object.freeze({
    createApi: createPvPeakMatchupPlannerApi,
    OUTCOME_RANK,
    POLICIES,
    resolvePolicy,
    createOutcomeVector,
    compareOutcomeVectors,
    createPlanStep,
    createStrategicLine,
    createMatchupPlan,
    canonicalStateHash,
    search
  });
}

(function exposePvPeakMatchupPlanner(root) {
  const api = createPvPeakMatchupPlannerApi();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.createPvPeakMatchupPlannerApi = createPvPeakMatchupPlannerApi;
    root.PvPeakMatchupPlanner = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
