"use strict";

const assert = require("assert");
const TurnEngine = require("../src/battle/turn-resolution-engine.js");

function battleState(overrides = {}) {
  return TurnEngine.createState({
    currentTurn: overrides.currentTurn ?? 5,
    sides: {
      A: {
        hp: overrides.hpA ?? 25,
        energy: overrides.energyA ?? 60,
        attack: overrides.attackA ?? 120,
        readyTurn: overrides.readyA ?? 5,
        fastMove: { id: "INCINERATE", turns: 5 },
        chargedMoves: [{ id: "FLY", energyCost: 45 }]
      },
      B: {
        hp: overrides.hpB ?? 100,
        energy: overrides.energyB ?? 0,
        attack: overrides.attackB ?? 100,
        readyTurn: overrides.readyB ?? 7,
        fastMove: { id: "ROLLOUT", turns: 3 },
        chargedMoves: [{ id: "BODY_SLAM", energyCost: 35 }]
      }
    },
    pendingEvents: overrides.pendingEvents || []
  });
}

const state = battleState();
assert.deepEqual(TurnEngine.getLegalActions(state, "A").map(action => action.type), ["fast", "charged"]);
assert.deepEqual(TurnEngine.getLegalActions(state, "B"), []);

const cmpState = battleState({ readyB: 5, energyB: 40, attackA: 130, attackB: 110 });
assert.deepEqual(TurnEngine.orderReadySides(cmpState), ["A", "B"]);
assert.deepEqual(
  TurnEngine.registerActionIntents(cmpState, [
    { side: "B", type: "charged_move", moveId: "BODY_SLAM", requestTurn: 5 },
    { side: "A", type: "charged_move", moveId: "FLY", requestTurn: 5 }
  ]).map(intent => [intent.sideId, intent.registrationOrder]),
  [["A", 0], ["B", 1]]
);
const cmpLossState = battleState({ readyB: 5, energyB: 40, attackA: 100, attackB: 130 });
assert.deepEqual(
  TurnEngine.orderActionIntents(cmpLossState, [
    { side: "A", type: "charged", moveId: "FLY" },
    { side: "B", type: "charged", moveId: "BODY_SLAM" }
  ]).map(intent => intent.sideId),
  ["B", "A"]
);
assert.deepEqual(
  TurnEngine.orderActionIntents(cmpState, [
    { side: "A", type: "fast", moveId: "INCINERATE" },
    { side: "B", type: "charged", moveId: "BODY_SLAM" }
  ]).map(intent => intent.type),
  ["charged", "fast"]
);
assert.equal(
  TurnEngine.orderActionIntents(cmpState, [{ side: "B", type: "charged", moveId: "NOT_A_MOVE" }]).length,
  0
);

for (const duration of [1, 2, 3, 4, 5]) {
  assert.equal(TurnEngine.fastImpactTurn(7, duration), 7 + duration - 1);
}

const pendingRollout = TurnEngine.createFastImpactEvent({
  sourceSide: "B",
  targetSide: "A",
  moveId: "ROLLOUT",
  moveName: "Rollout",
  damage: 25,
  startTurn: 4,
  duration: 3,
  timelineIndex: 8,
  source: "one-turn-lag"
});
assert.equal(pendingRollout.resolveTurn, 6);
assert.equal(TurnEngine.shouldDeferLethalFastImpact(state, pendingRollout), true);
assert.equal(TurnEngine.shouldDeferLethalFastImpact(battleState({ readyA: 6 }), pendingRollout), false);
const stateWithPending = TurnEngine.createState({ ...state, pendingEvents: [pendingRollout] });
assert.equal(TurnEngine.nextPendingLethalImpact(stateWithPending, "A").moveName, "Rollout");
assert.equal(TurnEngine.nextPendingLethalImpact(stateWithPending, "B"), null);

const queued = TurnEngine.scheduleEvent([], pendingRollout);
assert.equal(TurnEngine.eventsDue(queued, 5).length, 0);
assert.equal(TurnEngine.eventsDue(queued, 6).length, 1);

const afterImpact = TurnEngine.resolveFastImpact(TurnEngine.createState({ ...state, pendingEvents: queued }), pendingRollout);
assert.equal(afterImpact.state.sides.A.hp, 0);
assert.equal(afterImpact.outcome.winner, "B");

const sourceFainted = TurnEngine.createState({
  ...state,
  sides: { A: state.sides.A, B: { ...state.sides.B, hp: 0 } },
  pendingEvents: queued
});
const deniedImpact = TurnEngine.resolveFastImpact(sourceFainted, pendingRollout);
assert.equal(deniedImpact.event.status, "denied");
assert.equal(deniedImpact.state.sides.A.hp, 25);

const simultaneousFastState = TurnEngine.createState({
  currentTurn: 4,
  sides: {
    A: { hp: 10, energy: 0, readyTurn: 5 },
    B: { hp: 10, energy: 0, readyTurn: 5 }
  },
  pendingEvents: [
    TurnEngine.createFastImpactEvent({
      id: "a-fast",
      sourceSide: "A",
      targetSide: "B",
      damage: 10,
      startTurn: 4,
      duration: 1
    }),
    TurnEngine.createFastImpactEvent({
      id: "b-fast",
      sourceSide: "B",
      targetSide: "A",
      damage: 10,
      startTurn: 4,
      duration: 1
    })
  ]
});
const simultaneousFastResult = TurnEngine.resolveDueFastImpacts(simultaneousFastState, 4);
assert.equal(simultaneousFastResult.outcome.winner, "tie");
assert.deepEqual(simultaneousFastResult.events.map(event => event.status), ["resolved", "resolved"]);

const dreImpact = TurnEngine.createFastImpactEvent({
  ...pendingRollout,
  id: "dre-fast-impact",
  source: "dre"
});
assert.equal(dreImpact.source, "dre");
assert.equal(TurnEngine.resolveFastImpact(sourceFainted, dreImpact).event.status, "denied");

const timeline = [
  { trainer: "A", kind: "fast", start: 0, duration: 5 },
  { trainer: "B", kind: "charge", start: 3, duration: 1 }
];
assert.deepEqual(TurnEngine.sneakPairs(timeline, 3), [{ fastIndex: 0, chargeIndex: 1 }]);
assert.deepEqual(TurnEngine.validateState(state), []);

console.log("Turn resolution engine tests passed.");
