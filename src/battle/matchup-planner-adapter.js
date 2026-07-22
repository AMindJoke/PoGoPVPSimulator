"use strict";

function createPvPeakMatchupPlannerAdapterApi(plannerApi = null) {
  const Planner = plannerApi
    || (typeof PvPeakMatchupPlanner !== "undefined" ? PvPeakMatchupPlanner : null)
    || (typeof require === "function" ? require("./matchup-planner") : null);
  const candidateCache = new Map();
  const MAX_CANDIDATE_CACHE = 4096;

  function createAdapter(options = {}) {
    for (const name of ["legalActions", "applyAction", "terminalOutcome", "evaluateOutcome"]) {
      if (typeof options[name] !== "function") throw new TypeError(`Matchup planner compact adapter requires ${name}().`);
    }
    const mechanicsVersion = String(options.mechanicsVersion || "compact-adapter-v1");
    return Object.freeze({
      hash(state, policy) {
        return Planner.canonicalStateHash(compactBattleState(state), policy, mechanicsVersion);
      },
      terminal(state, perspective) {
        return options.terminalOutcome(state, perspective);
      },
      evaluate(state, perspective, context) {
        return options.evaluateOutcome(state, perspective, {
          ...context,
          energy: energyDiagnostics(state, perspective, options)
        });
      },
      candidates(state, side, context = {}) {
        const compactHash = Planner.canonicalStateHash(compactBattleState(state), context.policy, mechanicsVersion);
        const key = `${compactHash}|${side}`;
        const cached = candidateCache.get(key);
        if (cached) return clone(cached);
        const actions = options.legalActions(state, side, context) || [];
        const candidates = actions.map((action, index) => strategicCandidate(state, side, action, index));
        cacheCandidates(key, candidates);
        return clone(candidates);
      },
      apply(state, side, candidate, context = {}) {
        const action = candidate?.action || candidate;
        const transition = options.applyAction(state, side, action, context);
        if (!transition?.state) return null;
        if (typeof options.advanceForced !== "function") return transition;
        const advanced = options.advanceForced(transition.state, transition.nextSide, context);
        return advanced?.state ? advanced : transition;
      }
    });
  }

  function compactBattleState(state = {}) {
    return {
      currentTurn: numeric(state.currentTurn),
      sideToAct: state.sideToAct || null,
      sides: {
        A: compactSide(state.sides?.A),
        B: compactSide(state.sides?.B)
      },
      pendingEvents: (state.pendingEvents || []).map(compactEvent),
      pendingDecision: compactPendingDecision(state.pendingDecision),
      cmpState: compactValue(state.cmpState),
      delayState: compactValue(state.delayState),
      mechanicsState: compactValue(state.mechanicsState)
    };
  }

  function compactSide(side = {}) {
    return {
      id: side.id || null,
      formId: side.formId || side.id || null,
      hp: numeric(side.hp),
      maxHp: numeric(side.maxHp),
      energy: clamp(numeric(side.energy), 0, 100),
      shields: Math.max(0, numeric(side.shields)),
      attack: numeric(side.attack),
      defense: numeric(side.defense),
      attackStage: numeric(side.attackStage),
      defenseStage: numeric(side.defenseStage),
      readyTurn: Math.max(0, numeric(side.readyTurn)),
      fastMove: compactMove(side.fastMove),
      chargedMoves: (side.chargedMoves || []).filter(Boolean).map(compactMove),
      baiting: side.baiting || null,
      shieldMode: side.shieldMode || null,
      linePolicy: side.linePolicy || null,
      mechanicState: compactValue(side.mechanicState)
    };
  }

  function compactMove(move) {
    if (!move) return null;
    return {
      id: move.id || null,
      type: move.type || null,
      power: numeric(move.power),
      energyGain: numeric(move.energyGain),
      energyCost: numeric(move.energyCost),
      turns: Math.max(1, numeric(move.turns, 1)),
      buffs: compactValue(move.buffs),
      buffsSelf: compactValue(move.buffsSelf),
      buffsOpponent: compactValue(move.buffsOpponent),
      buffTarget: move.buffTarget || null,
      buffApplyChance: numeric(move.buffApplyChance)
    };
  }

  function compactEvent(event = {}) {
    return {
      id: event.id || null,
      type: event.type || event.kind || null,
      sourceSide: event.sourceSide || event.trainer || null,
      targetSide: event.targetSide || null,
      moveId: event.moveId || event.move?.id || null,
      startTurn: numeric(event.startTurn ?? event.start),
      resolveTurn: numeric(event.resolveTurn),
      damage: numeric(event.damage),
      status: event.status || null,
      source: event.source || null
    };
  }

  function compactPendingDecision(value) {
    if (!value) return null;
    return {
      type: value.type || null,
      sourceSide: value.sourceSide || null,
      targetSide: value.targetSide || null,
      moveId: value.moveId || null,
      damage: numeric(value.damage),
      turn: numeric(value.turn)
    };
  }

  function strategicCandidate(state, side, action, index) {
    const normalized = normalizeAction(action, side);
    const actor = state?.sides?.[side] || {};
    const chargedReady = (actor.chargedMoves || []).some(move => numeric(actor.energy) >= numeric(move.energyCost));
    let strategicPurpose = "LEGAL_PROGRESSION";
    let timingIntent = null;
    if (normalized.type === "charged_move") strategicPurpose = "THROW_NOW";
    else if (normalized.type === "fast_move") {
      strategicPurpose = chargedReady ? "COMPARE_THROW_TIMING" : "BUILD_TO_CHARGED_BREAKPOINT";
      timingIntent = chargedReady
        ? { type: "FAST_THEN_REEVALUATE", moveId: normalized.moveId || null, fastCount: 1 }
        : nextChargedBreakpoint(actor);
    } else if (normalized.type === "shield") strategicPurpose = "SHIELD_RESPONSE";
    else if (normalized.type === "no_shield") strategicPurpose = "NO_SHIELD_RESPONSE";
    else if (normalized.type === "wait") strategicPurpose = "TIMING_ALIGNMENT";
    return {
      id: candidateId(normalized, index),
      action: normalized,
      strategicPurpose,
      timingIntent
    };
  }

  function nextChargedBreakpoint(side) {
    const gain = Math.max(1, numeric(side.fastMove?.energyGain, 1));
    const targets = (side.chargedMoves || [])
      .map(move => ({ moveId: move.id || null, fastCount: Math.max(0, Math.ceil((numeric(move.energyCost) - numeric(side.energy)) / gain)) }))
      .filter(item => item.fastCount > 0)
      .sort((a, b) => a.fastCount - b.fastCount || String(a.moveId).localeCompare(String(b.moveId)));
    return targets.length ? { type: "FAST_TO_BREAKPOINT", ...targets[0] } : null;
  }

  function energyDiagnostics(state, perspective, options) {
    const side = state?.sides?.[perspective];
    if (!side || numeric(side.hp) <= 0) return { rawEnergy: numeric(side?.energy), actionableEnergy: 0, strandedEnergy: numeric(side?.energy), chargedMovesReachableBeforeFaint: 0 };
    const costs = (side.chargedMoves || []).map(move => numeric(move.energyCost)).filter(cost => cost > 0);
    const minimumCost = costs.length ? Math.min(...costs) : Infinity;
    const gain = Math.max(0, numeric(side.fastMove?.energyGain));
    const fastsToCharge = minimumCost === Infinity || gain <= 0 ? Infinity : Math.max(0, Math.ceil((minimumCost - numeric(side.energy)) / gain));
    const survivalFasts = typeof options.fastsBeforeFaint === "function"
      ? Math.max(0, numeric(options.fastsBeforeFaint(state, perspective), 0))
      : Infinity;
    const reachable = fastsToCharge <= survivalFasts;
    return {
      rawEnergy: numeric(side.energy),
      actionableEnergy: reachable ? numeric(side.energy) : 0,
      strandedEnergy: reachable ? 0 : numeric(side.energy),
      chargedMovesReachableBeforeFaint: reachable ? 1 : 0,
      nextChargedFastCount: Number.isFinite(fastsToCharge) ? fastsToCharge : null
    };
  }

  function normalizeAction(action = {}, side) {
    const type = action.type === "fast" ? "fast_move" : action.type === "charged" ? "charged_move" : action.type;
    return {
      type,
      side: action.side || side || null,
      moveId: action.moveId || action.move?.id || null,
      moveIndex: Number.isInteger(action.moveIndex) ? action.moveIndex : null,
      metadata: compactValue(action.metadata)
    };
  }

  function candidateId(action, index) {
    return `${action.type || "action"}:${action.moveId || action.side || index}`;
  }

  function cacheCandidates(key, candidates) {
    if (candidateCache.size >= MAX_CANDIDATE_CACHE) candidateCache.delete(candidateCache.keys().next().value);
    candidateCache.set(key, clone(candidates));
  }

  function clearCache() {
    candidateCache.clear();
  }

  function compactValue(value) {
    if (value == null) return value;
    if (Array.isArray(value)) return value.map(compactValue);
    if (typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort()
      .filter(key => !["presentation", "timeline", "log", "element", "dom"].includes(key))
      .map(key => [key, compactValue(value[key])]));
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function numeric(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  return Object.freeze({
    createApi: createPvPeakMatchupPlannerAdapterApi,
    createAdapter,
    compactBattleState,
    energyDiagnostics,
    clearCache
  });
}

(function exposePvPeakMatchupPlannerAdapter(root) {
  const planner = typeof PvPeakMatchupPlanner !== "undefined" ? PvPeakMatchupPlanner : null;
  const api = createPvPeakMatchupPlannerAdapterApi(planner);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.createPvPeakMatchupPlannerAdapterApi = createPvPeakMatchupPlannerAdapterApi;
    root.PvPeakMatchupPlannerAdapter = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
