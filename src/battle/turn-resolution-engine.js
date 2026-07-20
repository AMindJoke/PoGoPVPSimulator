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
      resolveTurn: startTurn + duration - 1,
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
    createFastImpactEvent,
    scheduleEvent,
    eventsDue,
    canActBeforeEvent,
    shouldDeferLethalFastImpact,
    nextPendingLethalImpact,
    resolveFastImpact,
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
