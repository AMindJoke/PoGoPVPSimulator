"use strict";

const assert = require("assert");
const TurnEngine = require("../src/battle/turn-resolution-engine.js");
const TechnicalReview = require("../src/scenario/technical-review-model.js");

const suckerPunch = { id: "SUCKER_PUNCH", name: "Sucker Punch", turns: 2, energyGain: 7 };
const incinerate = { id: "INCINERATE", name: "Incinerate", turns: 5, energyGain: 20 };
const swift = { id: "SWIFT", name: "Swift", energyCost: 35 };

function initialState() {
  return TurnEngine.createState({
    currentTurn: 0,
    sides: {
      A: { id: "furret", hp: 17, energy: 22, readyTurn: 0, fastMove: suckerPunch, chargedMoves: [swift] },
      B: { id: "talonflame_shadow", hp: 39, energy: 40, readyTurn: 0, fastMove: incinerate, chargedMoves: [] }
    },
    pendingEvents: []
  });
}

function registerFast(state, side, move, damage, timelineIndex) {
  const startTurn = state.currentTurn;
  const targetSide = side === "A" ? "B" : "A";
  const event = TurnEngine.createFastImpactEvent({
    id: `impact-${timelineIndex}`,
    sourceSide: side,
    targetSide,
    moveId: move.id,
    moveName: move.name,
    damage,
    energyGain: move.energyGain,
    startTurn,
    duration: move.turns,
    timelineIndex,
    source: "manual-mode"
  });
  const next = TurnEngine.createState({
    ...state,
    sides: {
      ...state.sides,
      [side]: { ...state.sides[side], readyTurn: startTurn + move.turns }
    },
    pendingEvents: TurnEngine.scheduleEvent(state.pendingEvents, event)
  });
  next.currentTurn = Math.min(next.sides.A.readyTurn, next.sides.B.readyTurn);
  return { state: next, event };
}

let state = initialState();
const firstSuckerPunch = registerFast(state, "A", suckerPunch, 5, 0);
state = firstSuckerPunch.state;
assert.equal(state.sides.B.hp, 39, "Fast damage must not apply when the action is registered.");
assert.equal(state.sides.A.energy, 22, "Fast energy must wait for the impact point.");

const registeredIncinerate = registerFast(state, "B", incinerate, 17, 1);
state = registeredIncinerate.state;
assert.equal(state.sides.A.hp, 17, "Incinerate must remain pending after registration.");
assert.equal(registeredIncinerate.event.resolveTurn, 4);

const firstResolution = TurnEngine.resolveDueFastImpacts(state, state.currentTurn);
state = firstResolution.state;
assert.equal(state.currentTurn, 2);
assert.equal(state.sides.A.energy, 29);
assert.equal(state.sides.B.hp, 34);
assert.equal(state.sides.A.hp, 17);
assert.equal(state.pendingEvents.some(event => event.moveId === "INCINERATE"), true);

const secondSuckerPunch = registerFast(state, "A", suckerPunch, 5, 2);
state = secondSuckerPunch.state;
assert.equal(state.currentTurn, 4);
assert.equal(state.sides.A.readyTurn, 4);
assert.equal(state.sides.B.readyTurn, 5);
assert.equal(state.sides.A.hp, 17, "The second short Fast must be registered before Incinerate resolves.");

const beforeCollision = TurnEngine.resolveDueFastImpacts(
  TurnEngine.createState({ ...state, currentTurn: 3 }),
  3
);
assert.equal(beforeCollision.state.sides.A.energy, 36);
assert.equal(beforeCollision.state.sides.B.hp, 29);
assert.deepEqual(
  TurnEngine.getLegalActions(TurnEngine.createState({ ...beforeCollision.state, currentTurn: 4 }), "A")
    .filter(action => action.type === "charged")
    .map(action => action.moveId),
  ["SWIFT"],
  "Swift must become legal after the second Sucker Punch impact."
);

const normalBranch = TurnEngine.resolveDueFastImpacts(state, 4);
assert.equal(normalBranch.state.sides.A.hp, 0, "Without DRE, lethal Incinerate damage resolves first.");
assert.equal(normalBranch.state.sides.A.energy, 36);
assert.equal(normalBranch.state.sides.B.hp, 29);
assert.equal(normalBranch.events.find(event => event.moveId === "INCINERATE").status, "resolved");

const timeline = [
  { trainer: "A", kind: "fast", start: 0, duration: 2, resolveTurn: 1, damage: 5, energyBefore: 22, move: suckerPunch, state: { A: { hp: 17, energy: 29 }, B: { hp: 34 } } },
  { trainer: "B", kind: "fast", start: 0, duration: 5, resolveTurn: 4, damage: 17, energyBefore: 40, move: incinerate, state: { A: { hp: 0, energy: 36 }, B: { hp: 29, energy: 60 } } },
  { trainer: "A", kind: "fast", start: 2, duration: 2, resolveTurn: 3, damage: 5, energyBefore: 29, move: suckerPunch, state: { A: { hp: 17, energy: 36 }, B: { hp: 29 } } }
];
const opportunity = TechnicalReview.createDreIssue(timeline, 2, 0, { A: { charged: [swift] }, B: { charged: [] } });
assert(opportunity, "The second Sucker Punch must be selectable as a DRE opportunity.");
assert.equal(opportunity.lethalFastMoveName, "Incinerate");
assert.deepEqual(opportunity.chargedMoveIds, ["SWIFT"]);

const dreBeforeCharge = TurnEngine.createState({
  ...beforeCollision.state,
  currentTurn: 4,
  pendingEvents: beforeCollision.state.pendingEvents
});
dreBeforeCharge.sides.A.energy -= swift.energyCost;
dreBeforeCharge.sides.B.hp = 0;
const pendingIncinerate = dreBeforeCharge.pendingEvents.find(event => event.moveId === "INCINERATE");
const dreImpact = TurnEngine.resolveFastImpact(dreBeforeCharge, pendingIncinerate);
assert.equal(dreImpact.event.status, "denied", "DRE must deny the pending Fast only because its source fainted.");
assert.equal(dreImpact.state.sides.A.hp, 17);
assert.equal(dreImpact.state.sides.A.energy, 1);
assert.equal(dreImpact.state.sides.B.hp, 0);

console.log("Manual asynchronous Fast Move and DRE regression tests passed.");
