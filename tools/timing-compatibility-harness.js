"use strict";

const TurnEngine = require("../src/battle/turn-resolution-engine.js");

const GEOMETRY_FIXTURES = Object.freeze([
  { id: "fast-1v1", durations: { A: 1, B: 1 }, horizon: 5 },
  { id: "fast-1v2", durations: { A: 1, B: 2 }, horizon: 6 },
  { id: "fast-1v3", durations: { A: 1, B: 3 }, horizon: 7 },
  { id: "fast-2v3", durations: { A: 2, B: 3 }, horizon: 8 },
  { id: "fast-2v4", durations: { A: 2, B: 4 }, horizon: 9 },
  { id: "fast-3v4", durations: { A: 3, B: 4 }, horizon: 10 },
  { id: "fast-3v5", durations: { A: 3, B: 5 }, horizon: 11 },
  { id: "fast-4v5", durations: { A: 4, B: 5 }, horizon: 12 },
  { id: "fast-exact-multiple-4v2", durations: { A: 4, B: 2 }, horizon: 10 }
]);

function snapshot(model) {
  return {
    hp: { A: model.hp.A, B: model.hp.B },
    energy: { A: model.energy.A, B: model.energy.B },
    pendingEvents: model.pending
      .map(event => ({
        id: event.id,
        sourceSide: event.sourceSide,
        targetSide: event.targetSide,
        resolveTurn: event.resolveTurn,
        status: event.status
      }))
      .sort((a, b) => a.resolveTurn - b.resolveTurn || a.id.localeCompare(b.id))
  };
}

function transition(model, fields) {
  return { ...fields, ...snapshot(model) };
}

function resolveManualImpactPhase(model, due, turn, transitions) {
  if (!due.length) return;
  due = [...due].sort((a, b) => a.id.localeCompare(b.id));
  const alive = { A: model.hp.A > 0, B: model.hp.B > 0 };
  const damage = { A: 0, B: 0 };
  due.forEach(event => {
    if (alive[event.sourceSide]) damage[event.targetSide] += event.damage;
  });
  model.hp.A = Math.max(0, model.hp.A - damage.A);
  model.hp.B = Math.max(0, model.hp.B - damage.B);
  due.forEach(event => {
    if (alive[event.sourceSide]) model.energy[event.sourceSide] = Math.min(100, model.energy[event.sourceSide] + event.energyGain);
  });
  const dueIds = new Set(due.map(event => event.id));
  model.pending = model.pending.filter(event => !dueIds.has(event.id));
  transitions.push(transition(model, {
    phase: "fast-impact",
    turn,
    impacts: due.map(event => ({
      id: event.id,
      sourceSide: event.sourceSide,
      fastImpactTurn: turn,
      energyGainTurn: alive[event.sourceSide] ? turn : null,
      status: alive[event.sourceSide] ? "resolved" : "denied"
    }))
  }));
}

function simulateCooldownReference(fixture) {
  const model = {
    hp: { A: 100, B: 100 },
    energy: { A: 0, B: 0 },
    ready: { A: 0, B: 0 },
    pending: []
  };
  const transitions = [];
  const ordinal = { A: 0, B: 0 };

  for (let turn = 0; turn <= fixture.horizon; turn++) {
    resolveManualImpactPhase(
      model,
      model.pending.filter(event => event.resolveTurn === turn),
      turn,
      transitions
    );
    for (const side of ["A", "B"]) {
      if (model.hp.A <= 0 || model.hp.B <= 0 || model.ready[side] > turn) continue;
      const duration = fixture.durations[side];
      const targetSide = side === "A" ? "B" : "A";
      const event = {
        id: `${side}-${ordinal[side]++}`,
        sourceSide: side,
        targetSide,
        damage: 1,
        energyGain: 1,
        status: "pending",
        startTurn: turn,
        resolveTurn: turn + duration - 1
      };
      model.ready[side] = turn + duration;
      model.pending.push(event);
      transitions.push(transition(model, {
        phase: "fast-start",
        turn,
        side,
        actionRequestTurn: turn,
        fastMoveStartTurn: turn,
        fastMoveImpactTurn: event.resolveTurn,
        energyGainTurn: event.resolveTurn,
        chargedRegistrationTurn: null,
        chargedResolutionTurn: null,
        cmpOrder: null
      }));
    }
    resolveManualImpactPhase(
      model,
      model.pending.filter(event => event.resolveTurn === turn),
      turn,
      transitions
    );
  }
  return transitions;
}

function simulateEventModel(fixture) {
  let state = TurnEngine.createState({
    currentTurn: 0,
    sides: {
      A: { hp: 100, energy: 0, readyTurn: 0, fastMove: { id: "FAST_A", turns: fixture.durations.A } },
      B: { hp: 100, energy: 0, readyTurn: 0, fastMove: { id: "FAST_B", turns: fixture.durations.B } }
    }
  });
  const model = {
    hp: { A: 100, B: 100 },
    energy: { A: 0, B: 0 },
    pending: []
  };
  const transitions = [];
  const ordinal = { A: 0, B: 0 };

  function resolve(turn) {
    const due = TurnEngine.eventsDue(state.pendingEvents, turn).filter(event => event.resolveTurn === turn);
    if (!due.length) return;
    const result = TurnEngine.resolveDueFastImpacts(state, turn);
    state = result.state;
    model.hp = { A: state.sides.A.hp, B: state.sides.B.hp };
    result.events.forEach(event => {
      if (event.status === "resolved") {
        model.energy[event.sourceSide] = Math.min(100, model.energy[event.sourceSide] + 1);
        state.sides[event.sourceSide].energy = model.energy[event.sourceSide];
      }
    });
    model.pending = state.pendingEvents;
    transitions.push(transition(model, {
      phase: "fast-impact",
      turn,
      impacts: result.events.map(event => ({
        id: event.id,
        sourceSide: event.sourceSide,
        fastImpactTurn: turn,
        energyGainTurn: event.status === "resolved" ? turn : null,
        status: event.status
      }))
    }));
  }

  for (let turn = 0; turn <= fixture.horizon; turn++) {
    state.currentTurn = turn;
    resolve(turn);
    for (const side of ["A", "B"]) {
      if (TurnEngine.terminalOutcome(state).ended || state.sides[side].readyTurn > turn) continue;
      const duration = fixture.durations[side];
      const targetSide = side === "A" ? "B" : "A";
      const event = TurnEngine.createFastImpactEvent({
        id: `${side}-${ordinal[side]++}`,
        sourceSide: side,
        targetSide,
        moveId: `FAST_${side}`,
        damage: 1,
        startTurn: turn,
        duration
      });
      event.energyGain = 1;
      state.sides[side].readyTurn = turn + duration;
      state.pendingEvents = TurnEngine.scheduleEvent(state.pendingEvents, event);
      model.pending = state.pendingEvents;
      transitions.push(transition(model, {
        phase: "fast-start",
        turn,
        side,
        actionRequestTurn: turn,
        fastMoveStartTurn: turn,
        fastMoveImpactTurn: event.resolveTurn,
        energyGainTurn: event.resolveTurn,
        chargedRegistrationTurn: null,
        chargedResolutionTurn: null,
        cmpOrder: null
      }));
    }
    resolve(turn);
  }
  return transitions;
}

function compareGeometryFixture(fixture) {
  const simulator = simulateEventModel(fixture);
  const pvpokeConceptual = simulateCooldownReference(fixture);
  return {
    fixture,
    simulator,
    pvpokeConceptual,
    equal: JSON.stringify(simulator) === JSON.stringify(pvpokeConceptual),
    classification: JSON.stringify(simulator) === JSON.stringify(pvpokeConceptual) ? null : "E"
  };
}

module.exports = {
  GEOMETRY_FIXTURES,
  simulateCooldownReference,
  simulateEventModel,
  compareGeometryFixture
};
