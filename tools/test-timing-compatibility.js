"use strict";

const assert = require("assert");
const TurnEngine = require("../src/battle/turn-resolution-engine.js");
const Harness = require("./timing-compatibility-harness.js");

for (const fixture of Harness.GEOMETRY_FIXTURES) {
  const comparison = Harness.compareGeometryFixture(fixture);
  assert.deepEqual(
    comparison.simulator,
    comparison.pvpokeConceptual,
    `${fixture.id} diverged from the cooldown reference`
  );
}

const simultaneousCharged = TurnEngine.createState({
  currentTurn: 8,
  sides: {
    A: {
      hp: 50,
      energy: 50,
      attack: 140,
      readyTurn: 8,
      chargedMoves: [{ id: "CHARGE_A", energyCost: 45 }]
    },
    B: {
      hp: 50,
      energy: 50,
      attack: 120,
      readyTurn: 8,
      chargedMoves: [{ id: "CHARGE_B", energyCost: 45 }]
    }
  }
});
const cmpWin = TurnEngine.registerActionIntents(simultaneousCharged, [
  { side: "A", type: "charged", moveId: "CHARGE_A", requestTurn: 8 },
  { side: "B", type: "charged", moveId: "CHARGE_B", requestTurn: 8 }
]);
assert.deepEqual(cmpWin.map(action => action.sideId), ["A", "B"]);
assert.deepEqual(cmpWin.map(action => action.registrationTurn), [8, 8]);

const cmpLoss = TurnEngine.registerActionIntents(TurnEngine.createState({
  ...simultaneousCharged,
  sides: {
    A: { ...simultaneousCharged.sides.A, attack: 100 },
    B: { ...simultaneousCharged.sides.B, attack: 150 }
  }
}), [
  { side: "A", type: "charged", moveId: "CHARGE_A", requestTurn: 8 },
  { side: "B", type: "charged", moveId: "CHARGE_B", requestTurn: 8 }
]);
assert.deepEqual(cmpLoss.map(action => action.sideId), ["B", "A"]);

const pendingLethal = TurnEngine.createFastImpactEvent({
  id: "pending-lethal",
  sourceSide: "B",
  targetSide: "A",
  damage: 50,
  startTurn: 6,
  duration: 3,
  source: "battle"
});
assert.equal(pendingLethal.resolveTurn, 8);
assert.equal(TurnEngine.shouldDeferLethalFastImpact(simultaneousCharged, pendingLethal), false);
assert.equal(TurnEngine.shouldDeferLethalFastImpact(TurnEngine.createState({
  ...simultaneousCharged,
  currentTurn: 7,
  sides: {
    A: { ...simultaneousCharged.sides.A, readyTurn: 7 },
    B: simultaneousCharged.sides.B
  }
}), pendingLethal), true);

const simultaneousFaint = TurnEngine.resolveDueFastImpacts(TurnEngine.createState({
  currentTurn: 3,
  sides: {
    A: { hp: 5, readyTurn: 4 },
    B: { hp: 5, readyTurn: 4 }
  },
  pendingEvents: [
    TurnEngine.createFastImpactEvent({
      id: "sim-a",
      sourceSide: "A",
      targetSide: "B",
      damage: 5,
      startTurn: 3,
      duration: 1
    }),
    TurnEngine.createFastImpactEvent({
      id: "sim-b",
      sourceSide: "B",
      targetSide: "A",
      damage: 5,
      startTurn: 3,
      duration: 1
    })
  ]
}), 3);
assert.equal(simultaneousFaint.outcome.winner, "tie");

for (const source of ["one-turn-lag", "dre"]) {
  const event = TurnEngine.createFastImpactEvent({
    id: `${source}-state`,
    sourceSide: "B",
    targetSide: "A",
    damage: 10,
    startTurn: 4,
    duration: 2,
    source
  });
  assert.equal(event.source, source);
  assert.equal(event.status, "pending");
  assert.equal(event.resolveTurn, 5);
}

console.log(`Timing compatibility passed for ${Harness.GEOMETRY_FIXTURES.length} Fast Move geometries plus Charged, CMP, lethal, simultaneous-faint, lag, and DRE states.`);
