"use strict";

const assert = require("assert");
const Planner = require("../src/battle/matchup-planner");
const AdapterApi = require("../src/battle/matchup-planner-adapter");

const fastMove = { id: "FAST", energyGain: 8, energyCost: 0, turns: 2, power: 4 };
const cheapMove = { id: "CHEAP", energyGain: 0, energyCost: 35, turns: 1, power: 50 };
const nukeMove = { id: "NUKE", energyGain: 0, energyCost: 55, turns: 1, power: 100 };

function state(overrides = {}) {
  return {
    currentTurn: 10,
    sideToAct: "A",
    presentation: { selectedEvent: 99 },
    sides: {
      A: {
        id: "alpha",
        hp: 80,
        maxHp: 100,
        energy: 40,
        shields: 1,
        readyTurn: 10,
        fastMove,
        chargedMoves: [cheapMove, nukeMove]
      },
      B: {
        id: "beta",
        hp: 70,
        maxHp: 100,
        energy: 20,
        shields: 1,
        readyTurn: 12,
        fastMove,
        chargedMoves: [cheapMove]
      }
    },
    ...overrides
  };
}

function legalActions(current, side) {
  const actor = current.sides[side];
  return [
    { type: "fast", moveId: actor.fastMove.id },
    ...actor.chargedMoves
      .filter(move => actor.energy >= move.energyCost)
      .map((move, moveIndex) => ({ type: "charged", moveId: move.id, moveIndex }))
  ];
}

const adapter = AdapterApi.createAdapter({
  mechanicsVersion: "adapter-test-v1",
  legalActions,
  applyAction(current, side, action) {
    const next = JSON.parse(JSON.stringify(current));
    const actor = next.sides[side];
    if (action.type === "fast_move") {
      actor.energy = Math.min(100, actor.energy + actor.fastMove.energyGain);
      actor.readyTurn += actor.fastMove.turns;
    } else if (action.type === "charged_move") {
      const move = actor.chargedMoves.find(candidate => candidate.id === action.moveId);
      actor.energy -= move.energyCost;
      actor.readyTurn = next.currentTurn + 1;
    }
    return { state: next, nextSide: side === "A" ? "B" : "A" };
  },
  terminalOutcome(current, perspective) {
    const opponent = perspective === "A" ? "B" : "A";
    if (current.sides[perspective].hp <= 0 || current.sides[opponent].hp <= 0) {
      return Planner.createOutcomeVector({
        outcome: current.sides[perspective].hp > 0 ? "win" : current.sides[opponent].hp > 0 ? "loss" : "draw"
      });
    }
    return null;
  },
  evaluateOutcome(current, perspective, context) {
    return Planner.createOutcomeVector({
      outcome: "draw",
      remainingHp: current.sides[perspective].hp,
      actionableEnergy: context.energy.actionableEnergy
    });
  },
  fastsBeforeFaint() { return 1; }
});

const candidates = adapter.candidates(state(), "A", { policy: "FAST" });
assert.deepStrictEqual(candidates.map(candidate => candidate.strategicPurpose), [
  "COMPARE_THROW_TIMING",
  "THROW_NOW"
]);
assert.deepStrictEqual(candidates[0].timingIntent, {
  type: "FAST_THEN_REEVALUATE",
  moveId: "FAST",
  fastCount: 1
});
assert.strictEqual(candidates[1].action.moveId, "CHEAP");

const before = state();
const transition = adapter.apply(before, "A", candidates[0], { policy: "FAST" });
assert.strictEqual(before.sides.A.energy, 40, "The compact adapter must not mutate its root state.");
assert.strictEqual(transition.state.sides.A.energy, 48);

const hashWithPresentation = adapter.hash(state({ presentation: { selectedEvent: 1 } }), "FAST");
const hashWithoutPresentation = adapter.hash(state({ presentation: { selectedEvent: 500 } }), "FAST");
assert.strictEqual(hashWithPresentation, hashWithoutPresentation, "Presentation-only state must not invalidate planner caches.");

const compact = AdapterApi.compactBattleState(state());
assert.strictEqual(Object.prototype.hasOwnProperty.call(compact, "presentation"), false);
assert.deepStrictEqual(AdapterApi.energyDiagnostics(state(), "A", { fastsBeforeFaint: () => 1 }), {
  rawEnergy: 40,
  actionableEnergy: 40,
  strandedEnergy: 0,
  chargedMovesReachableBeforeFaint: 1,
  nextChargedFastCount: 0
});

const stranded = state();
stranded.sides.A.energy = 10;
assert.strictEqual(AdapterApi.energyDiagnostics(stranded, "A", { fastsBeforeFaint: () => 1 }).strandedEnergy, 10);

console.log("Matchup planner compact adapter tests passed.");
