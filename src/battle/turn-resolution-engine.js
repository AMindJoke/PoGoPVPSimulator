"use strict";

function createPvPeakTurnEngineApi() {
  const EVENT_PHASE = Object.freeze({
    FAST_IMPACT: 10,
    CHARGED_ACTION: 20,
    STATE_TRANSITION: 30
  });

  function numeric(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function normalizeSide(side = {}) {
    return {
      id: side.id || null,
      hp: Math.max(0, numeric(side.hp)),
      energy: Math.max(0, Math.min(100, numeric(side.energy))),
      attack: numeric(side.attack),
      readyTurn: Math.max(0, numeric(side.readyTurn)),
      fastMove: side.fastMove || null,
      chargedMoves: (side.chargedMoves || []).filter(Boolean)
    };
  }

  function createState(input = {}) {
    const sides = {
      A: normalizeSide(input.sides?.A),
      B: normalizeSide(input.sides?.B)
    };
    const currentTurn = Number.isFinite(Number(input.currentTurn))
      ? Math.max(0, Number(input.currentTurn))
      : Math.min(sides.A.readyTurn, sides.B.readyTurn);
    return {
      currentTurn,
      sides,
      pendingEvents: sortEvents(input.pendingEvents || [])
    };
  }

  function terminalOutcome(state) {
    const aAlive = numeric(state?.sides?.A?.hp) > 0;
    const bAlive = numeric(state?.sides?.B?.hp) > 0;
    if (aAlive && bAlive) return { ended: false, winner: null };
    if (!aAlive && !bAlive) return { ended: true, winner: "tie" };
    return { ended: true, winner: aAlive ? "A" : "B" };
  }

  function getLegalActions(state, sideId) {
    const side = state?.sides?.[sideId];
    const opponent = state?.sides?.[sideId === "A" ? "B" : "A"];
    if (!side || !opponent || terminalOutcome(state).ended || side.hp <= 0 || side.readyTurn > state.currentTurn) return [];
    const actions = [];
    if (side.fastMove) {
      actions.push({
        type: "fast",
        moveId: side.fastMove.id || null,
        move: side.fastMove,
        startTurn: state.currentTurn
      });
    }
    side.chargedMoves.forEach((move, index) => {
      if (side.energy < numeric(move.energyCost)) return;
      actions.push({
        type: "charged",
        moveId: move.id || null,
        move,
        moveIndex: index,
        startTurn: state.currentTurn
      });
    });
    return actions;
  }

  function readySides(state) {
    return ["A", "B"].filter(sideId => getLegalActions(state, sideId).length > 0);
  }

  function orderReadySides(state) {
    return readySides(state).sort((aId, bId) => {
      const aCharges = getLegalActions(state, aId).filter(action => action.type === "charged");
      const bCharges = getLegalActions(state, bId).filter(action => action.type === "charged");
      if (!!aCharges.length !== !!bCharges.length) return aCharges.length ? -1 : 1;
      if (aCharges.length && bCharges.length) {
        const attackDifference = numeric(state.sides[bId].attack) - numeric(state.sides[aId].attack);
        if (attackDifference) return attackDifference;
      }
      return aId.localeCompare(bId);
    });
  }

  function normalizeActionIntent(state, intent = {}) {
    const sideId = intent.sideId || intent.side || null;
    const type = intent.type === "charged_move"
      ? "charged"
      : intent.type === "fast_move"
        ? "fast"
        : intent.type;
    const legalAction = getLegalActions(state, sideId).find(action =>
      action.type === type
      && (!intent.moveId || action.moveId === intent.moveId)
    );
    if (!legalAction) return null;
    return {
      ...intent,
      sideId,
      type,
      moveId: intent.moveId || legalAction.moveId,
      move: intent.move || legalAction.move,
      requestTurn: Math.max(0, numeric(intent.requestTurn, state.currentTurn)),
      queueTurn: Math.max(0, numeric(intent.queueTurn, state.currentTurn)),
      registrationTurn: state.currentTurn
    };
  }

  function orderActionIntents(state, intents = []) {
    return intents
      .map(intent => normalizeActionIntent(state, intent))
      .filter(Boolean)
      .sort((a, b) => {
        const aCharged = a.type === "charged";
        const bCharged = b.type === "charged";
        if (aCharged !== bCharged) return aCharged ? -1 : 1;
        if (aCharged && bCharged) {
          const attackDifference = numeric(state.sides[b.sideId].attack) - numeric(state.sides[a.sideId].attack);
          if (attackDifference) return attackDifference;
        }
        return a.sideId.localeCompare(b.sideId);
      });
  }

  function registerActionIntents(state, intents = []) {
    return orderActionIntents(state, intents).map((intent, index) => ({
      ...intent,
      registrationOrder: index,
      status: "registered"
    }));
  }

  function fastImpactTurn(startTurn, duration) {
    return Math.max(0, numeric(startTurn)) + Math.max(1, numeric(duration, 1)) - 1;
  }

  function createFastImpactEvent(input = {}) {
    const startTurn = Math.max(0, numeric(input.startTurn));
    const duration = Math.max(1, numeric(input.duration, 1));
    return {
      id: input.id || `fast-impact-${input.sourceSide || "?"}-${startTurn}-${input.timelineIndex ?? "?"}`,
      type: "fast-impact",
      phase: EVENT_PHASE.FAST_IMPACT,
      sourceSide: input.sourceSide,
      targetSide: input.targetSide,
      moveId: input.moveId || null,
      moveName: input.moveName || "Fast Move",
      damage: Math.max(0, numeric(input.damage)),
      startTurn,
      duration,
      resolveTurn: fastImpactTurn(startTurn, duration),
      timelineIndex: Number.isInteger(input.timelineIndex) ? input.timelineIndex : null,
      source: input.source || "battle",
      status: "pending"
    };
  }

  function scheduleEvent(events, event) {
    return sortEvents([...(events || []).filter(candidate => candidate?.id !== event?.id), event]);
  }

  function sortEvents(events) {
    return [...events].filter(Boolean).sort((a, b) =>
      numeric(a.resolveTurn) - numeric(b.resolveTurn)
      || numeric(a.phase, EVENT_PHASE.STATE_TRANSITION) - numeric(b.phase, EVENT_PHASE.STATE_TRANSITION)
      || String(a.id || "").localeCompare(String(b.id || ""))
    );
  }

  function eventsDue(events, turn) {
    return sortEvents(events).filter(event => event.status === "pending" && numeric(event.resolveTurn) <= numeric(turn));
  }

  function canActBeforeEvent(state, sideId, event) {
    const side = state?.sides?.[sideId];
    return !!side && side.hp > 0 && side.readyTurn < numeric(event?.resolveTurn, Infinity);
  }

  function shouldDeferLethalFastImpact(state, event) {
    const target = state?.sides?.[event?.targetSide];
    if (!target || event?.type !== "fast-impact" || event.damage < target.hp) return false;
    const hasReadyCharge = target.chargedMoves.some(move => target.energy >= numeric(move.energyCost));
    return hasReadyCharge && canActBeforeEvent(state, event.targetSide, event);
  }

  function nextPendingLethalImpact(state, sideId) {
    const side = state?.sides?.[sideId];
    if (!side || side.hp <= 0) return null;
    return sortEvents(state.pendingEvents || []).find(event =>
      event.type === "fast-impact"
      && event.status === "pending"
      && event.targetSide === sideId
      && numeric(event.damage) >= side.hp
      && numeric(event.resolveTurn) >= state.currentTurn
    ) || null;
  }

  function resolveFastImpact(state, event) {
    const next = createState(state);
    const source = next.sides[event.sourceSide];
    const target = next.sides[event.targetSide];
    const resolvedEvent = { ...event };
    if (!source || !target || source.hp <= 0) {
      resolvedEvent.status = "denied";
    } else {
      target.hp = Math.max(0, target.hp - Math.max(0, numeric(event.damage)));
      resolvedEvent.status = "resolved";
    }
    next.pendingEvents = next.pendingEvents.filter(candidate => candidate.id !== event.id);
    return { state: next, event: resolvedEvent, outcome: terminalOutcome(next) };
  }

  function resolveDueFastImpacts(state, turn = state?.currentTurn) {
    const next = createState({ ...state, currentTurn: numeric(turn) });
    const due = eventsDue(next.pendingEvents, turn).filter(event => event.type === "fast-impact");
    const resolvedEvents = [];
    const dueIds = new Set(due.map(event => event.id));

    for (const resolveTurn of [...new Set(due.map(event => numeric(event.resolveTurn)))]) {
      const simultaneous = due.filter(event => numeric(event.resolveTurn) === resolveTurn);
      const aliveAtPhaseStart = {
        A: next.sides.A.hp > 0,
        B: next.sides.B.hp > 0
      };
      const damageByTarget = { A: 0, B: 0 };
      simultaneous.forEach(event => {
        const resolvedEvent = { ...event };
        if (!aliveAtPhaseStart[event.sourceSide] || !next.sides[event.targetSide]) {
          resolvedEvent.status = "denied";
        } else {
          resolvedEvent.status = "resolved";
          damageByTarget[event.targetSide] += Math.max(0, numeric(event.damage));
        }
        resolvedEvents.push(resolvedEvent);
      });
      for (const sideId of ["A", "B"]) {
        next.sides[sideId].hp = Math.max(0, next.sides[sideId].hp - damageByTarget[sideId]);
      }
    }

    next.pendingEvents = next.pendingEvents.filter(event => !dueIds.has(event.id));
    return { state: next, events: resolvedEvents, outcome: terminalOutcome(next) };
  }

  function sneakPairs(timeline, currentTurn, timelineStart = 0, impactTurnForEvent = null) {
    const events = Array.isArray(timeline) ? timeline : [];
    const charges = events.slice(timelineStart)
      .map((event, offset) => ({ event, index: timelineStart + offset }))
      .filter(item => item.event?.kind === "charge");
    if (!charges.length) return [];
    return events
      .map((event, index) => ({ event, index }))
      .filter(item => item.event?.kind === "fast" && numeric(item.event.start) <= numeric(currentTurn))
      .filter(item => {
        const impact = impactTurnForEvent ? impactTurnForEvent(item.event) : numeric(item.event.start) + Math.max(1, numeric(item.event.duration, 1)) - 1;
        return impact >= numeric(currentTurn);
      })
      .map(item => {
        const charge = charges.find(candidate => candidate.event.trainer !== item.event.trainer);
        return charge ? { fastIndex: item.index, chargeIndex: charge.index } : null;
      })
      .filter(Boolean);
  }

  function validateState(state) {
    const errors = [];
    for (const sideId of ["A", "B"]) {
      const side = state?.sides?.[sideId];
      if (!side) errors.push(`Missing side ${sideId}.`);
      else {
        if (side.hp < 0) errors.push(`${sideId} HP cannot be negative.`);
        if (side.energy < 0 || side.energy > 100) errors.push(`${sideId} energy must be between 0 and 100.`);
        if (side.readyTurn < 0) errors.push(`${sideId} ready turn cannot be negative.`);
      }
    }
    const ids = new Set();
    for (const event of state?.pendingEvents || []) {
      if (!event.id) errors.push("Pending events require an id.");
      else if (ids.has(event.id)) errors.push(`Duplicate pending event id ${event.id}.`);
      ids.add(event.id);
    }
    return errors;
  }

  return Object.freeze({
    createApi: createPvPeakTurnEngineApi,
    EVENT_PHASE,
    createState,
    terminalOutcome,
    getLegalActions,
    readySides,
    orderReadySides,
    normalizeActionIntent,
    orderActionIntents,
    registerActionIntents,
    fastImpactTurn,
    createFastImpactEvent,
    scheduleEvent,
    eventsDue,
    canActBeforeEvent,
    shouldDeferLethalFastImpact,
    nextPendingLethalImpact,
    resolveFastImpact,
    resolveDueFastImpacts,
    sneakPairs,
    validateState
  });
}

(function exposePvPeakTurnEngine(root) {
  const api = createPvPeakTurnEngineApi();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.createPvPeakTurnEngineApi = createPvPeakTurnEngineApi;
    root.PvPeakTurnEngine = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
