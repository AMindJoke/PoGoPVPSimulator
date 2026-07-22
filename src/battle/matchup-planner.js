"use strict";

function createPvPeakMatchupPlannerApi() {
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
    const adapter = validateAdapter(input.adapter);
    const policy = resolvePolicy(input.policy);
    const perspective = input.perspective || input.side;
    const startedAt = now();
    const table = input.transpositionTable || new Map();
    const stats = { nodes: 0, cacheHits: 0, pruned: 0, depthReached: 0, timedOut: false };
    const context = { adapter, policy, perspective, startedAt, table, stats };
    const rootState = input.state;
    const rootSide = input.side;
    const candidates = stableCandidates(adapter.candidates(rootState, rootSide, { policy: policy.id }));
    const lines = [];

    for (const candidate of candidates) {
      if (budgetExceeded(context)) break;
      const transition = adapter.apply(rootState, rootSide, candidate, { policy: policy.id });
      if (!transition?.state) continue;
      const child = minimax(transition.state, transition.nextSide, policy.maxDepth - 1, context);
      const step = createPlanStep({
        stateHash: adapter.hash(rootState, policy.id),
        action: candidate.action || candidate,
        expectedOpponentResponse: child.steps[0]?.action || null,
        resultingStateHash: adapter.hash(transition.state, policy.id),
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
    }

    lines.sort((a, b) => compareOutcomeVectors(a.outcome, b.outcome));
    const principalLine = lines[0] || createStrategicLine({
      outcome: adapter.evaluate(rootState, perspective, { horizon: true }),
      finalState: rootState,
      completeness: "bounded",
      horizonReason: stats.timedOut ? "time-budget" : "no-candidate"
    });
    return createMatchupPlan({
      planId: `mp-${hashString(adapter.hash(rootState, policy.id))}`,
      rootStateHash: adapter.hash(rootState, policy.id),
      side: rootSide,
      policy,
      principalLine,
      alternativeLines: lines.slice(1),
      confidence: principalLine.completeness === "complete" ? .95 : .65,
      searchedNodes: stats.nodes,
      depthReached: stats.depthReached,
      horizonReason: principalLine.horizonReason,
      explanation: principalLine.actions.length
        ? `Selected the first action of the best ${principalLine.outcome.outcomeClass} line.`
        : "No strategic action was available.",
      reasonCodes: [
        principalLine.outcome.outcomeClass === "win" ? "MP_PROVEN_WIN"
          : principalLine.outcome.outcomeClass === "draw" ? "MP_PROVEN_DRAW" : "MP_AVOID_PROVEN_LOSS",
        ...(stats.timedOut ? ["MP_SEARCH_HORIZON_INCOMPLETE"] : [])
      ]
    });
  }

  function minimax(state, side, depth, context) {
    context.stats.nodes++;
    context.stats.depthReached = Math.max(context.stats.depthReached, context.policy.maxDepth - depth);
    const terminal = context.adapter.terminal(state, context.perspective);
    if (terminal) return leaf(state, terminal, true, "terminal");
    if (depth <= 0 || budgetExceeded(context)) {
      return leaf(state, context.adapter.evaluate(state, context.perspective, { horizon: true }), false, context.stats.timedOut ? "time-budget" : "depth-budget");
    }

    const key = `${context.adapter.hash(state, context.policy.id)}|${side}|${depth}|${context.perspective}`;
    const cached = context.table.get(key);
    if (cached) {
      context.stats.cacheHits++;
      return cached;
    }
    const candidates = stableCandidates(context.adapter.candidates(state, side, { policy: context.policy.id }));
    if (!candidates.length) return leaf(state, context.adapter.evaluate(state, context.perspective, { horizon: true }), false, "no-candidate");

    const maximizing = side === context.perspective;
    let best = null;
    for (const candidate of candidates) {
      if (budgetExceeded(context)) break;
      const transition = context.adapter.apply(state, side, candidate, { policy: context.policy.id });
      if (!transition?.state) continue;
      const child = minimax(transition.state, transition.nextSide, depth - 1, context);
      const result = {
        ...child,
        actions: [candidate.action || candidate, ...child.actions],
        responses: maximizing ? child.responses : [candidate.action || candidate, ...child.responses],
        steps: [createPlanStep({
          stateHash: context.adapter.hash(state, context.policy.id),
          action: candidate.action || candidate,
          resultingStateHash: context.adapter.hash(transition.state, context.policy.id),
          strategicPurpose: candidate.strategicPurpose || null,
          timingIntent: candidate.timingIntent || null,
          confidence: child.complete ? .95 : .65
        }), ...child.steps]
      };
      if (!best || (maximizing
        ? compareOutcomeVectors(result.outcome, best.outcome) < 0
        : compareOutcomeVectors(result.outcome, best.outcome) > 0)) best = result;
    }
    if (!best) best = leaf(state, context.adapter.evaluate(state, context.perspective, { horizon: true }), false, "budget");
    context.table.set(key, best);
    return best;
  }

  function leaf(state, outcome, complete, horizonReason) {
    return {
      outcome: isOutcomeVector(outcome) ? outcome : createOutcomeVector(outcome),
      finalState: cloneStable(state),
      complete,
      horizonReason,
      actions: [],
      responses: [],
      steps: []
    };
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
