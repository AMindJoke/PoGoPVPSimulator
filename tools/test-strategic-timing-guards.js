"use strict";

const assert = require("node:assert/strict");
const Engine = require("../src/battle/turn-resolution-engine");
const Intelligence = require("../src/battle/battle-intelligence");

function state() {
  const current = Engine.createState({ currentTurn: 10, sides: {
    A: {
      id: "actor", hp: 200, energy: 50, attack: 120, readyTurn: 10,
      fastMove: { id: "FAST_A", turns: 3, energyGain: 12, damage: 4 },
      chargedMoves: [{ id: "SELF_BUFF", energyCost: 40, damage: 50,
        buffApplyChance: 1, buffTarget: "self", buffs: [1, 0] }]
    },
    B: {
      id: "opponent", hp: 180, energy: 0, attack: 110, readyTurn: 10,
      fastMove: { id: "FAST_B", turns: 2, energyGain: 7, damage: 4 },
      chargedMoves: []
    }
  } });
  Object.assign(current.sides.A, { maxHp: 200, shields: 1, baiting: "selective", shieldMode: "smart" });
  Object.assign(current.sides.B, { maxHp: 180, shields: 1, baiting: "selective", shieldMode: "smart" });
  return current;
}

function select(current = state(), overrides = {}, options = {}) {
  const calls = [];
  const legalActions = Engine.getLegalActions(current, "A");
  if (options.wait) legalActions.push({ type: "wait", side: "A", startTurn: current.currentTurn,
    metadata: { timingWindow: { waitTurns: 1 } } });
  Intelligence.clearCache();
  const decision = Intelligence.selectAction({
    state: current, side: "A", plannerMode: "CANONICAL", legalActions,
    context: {
      dreStandard: true,
      estimateDamage: action => action.move?.damage || current.sides.A.chargedMoves.find(move => move.id === action.moveId)?.damage || 0,
      estimateFastDamage: side => current.sides[side === "opponent" ? "B" : "A"].fastMove.damage,
      willOpponentShield: () => current.sides.B.shields > 0,
      hasGuaranteedEffect: () => current.sides.A.attackStage < 4,
      compareTimingContinuations(original, actions) {
        calls.push({ original, actions });
        return options.evaluate ? options.evaluate(original, actions) : null;
      },
      ...overrides
    }
  });
  return { decision, calls };
}

const baseline = select();
assert.equal(baseline.calls.length, 1, "A useful affordable self-buff and safe long Fast must exercise the timing callback.");
assert.deepEqual(baseline.calls[0].actions.map(action => action.type).sort(), ["charged_move", "fast_move"]);
assert.equal(baseline.decision.action.type, "fast_move", "An unavailable continuation must preserve the canonical selection.");

const guarded = [
  {
    name: "immediate unshielded Charged KO", intent: "IMMEDIATE_LETHAL", category: "tactical",
    mutate(current) { current.sides.B.hp = 40; current.sides.B.shields = 0; }
  },
  {
    name: "unaffordable Charged Move", category: "availability", action: "fast_move",
    mutate(current) { current.sides.A.energy = 39; }
  },
  { name: "explicit farm-energy policy", context: { farmEnergy: true }, category: "availability", action: "fast_move" },
  {
    name: "exposed form transition", intent: "THROW_FROM_EXPOSED_FORM", category: "route",
    mutate(current) { current.sides.A.mechanicState = { formTransition: { phase: "exposed" } }; }
  },
  {
    name: "form transition without a dedicated route",
    mutate(current) { current.sides.A.mechanicState = { formTransition: { phase: "unhandled" } }; }
  },
  { name: "Fast duration below three turns", mutate(current) { current.sides.A.fastMove.turns = 2; } },
  { name: "extra Fast overflows energy", mutate(current) { current.sides.A.energy = 89; } },
  { name: "self-buff already at stage cap", mutate(current) { current.sides.A.attackStage = 4; } },
  { name: "live effect callback refuses the benefit", context: { hasGuaranteedEffect: () => false } },
  {
    name: "pending lethal Fast", intent: "THROW_BEFORE_FAINT", category: "tactical",
    mutate(current) {
      current.pendingEvents = [Engine.createFastImpactEvent({
        id: "lethal", sourceSide: "B", targetSide: "A", moveId: "FAST_B",
        damage: 200, startTurn: 9, duration: 3
      })];
    }
  },
  {
    name: "selected Charged Move is not the beneficial self-buff",
    intent: "CANONICAL_CHARGED_SEQUENCE", category: "route", moveId: "DIRECT",
    mutate(current) {
      current.sides.B.readyTurn = 11;
      current.sides.B.shields = 0;
      current.sides.A.chargedMoves.push({ id: "DIRECT", energyCost: 40, damage: 150 });
    }
  },
  { name: "DRE timing disabled", context: { dreStandard: false } },
  {
    name: "two timing continuations already used",
    mutate(current) { current.sides.A.mechanicState = { timingContinuationCount: 2 }; }
  },
  {
    name: "chance-based self-buff",
    mutate(current) { current.sides.A.chargedMoves[0].buffApplyChance = 0.5; }
  },
  {
    name: "self-buff carries a self-debuff",
    mutate(current) { current.sides.A.chargedMoves[0].buffs = [1, -1]; }
  }
];

for (const fixture of guarded) {
  const current = state();
  if (fixture.mutate) fixture.mutate(current);
  const { decision, calls } = select(current, fixture.context);
  assert.equal(calls.length, 0, `${fixture.name}: must not launch a timing continuation.`);
  if (fixture.category) assert.equal(decision.principleResult.category, fixture.category, fixture.name);
  if (fixture.intent) assert.equal(decision.principleResult.intent, fixture.intent, fixture.name);
  if (fixture.action) assert.equal(decision.action.type, fixture.action, fixture.name);
  if (fixture.moveId) assert.equal(decision.action.moveId, fixture.moveId, fixture.name);
}

const boundary = state();
boundary.sides.A.energy = 88;
boundary.sides.A.mechanicState = { timingContinuationCount: 1 };
assert.equal(select(boundary).calls.length, 1,
  "An extra Fast reaching exactly 100 energy and the second allowed timing review remain eligible.");

function completedComparison(original, actions, selectedType) {
  return {
    complete: true, action: actions.find(action => action.type === selectedType), actionChanged: original.type !== selectedType,
    alternatives: actions.map(action => ({ action, responses: [{
      responseId: "policy", complete: true, outcome: action.type === selectedType ? 2 : 0,
      remainingHp: 50, remainingEnergy: 10, remainingShields: 0
    }] }))
  };
}

for (const selectedType of ["charged_move", "wait"]) {
  const reviewed = select(state(), {}, {
    wait: true,
    evaluate(original, actions) { return completedComparison(original, actions, selectedType); }
  });
  assert.equal(reviewed.calls.length, 1);
  assert.deepEqual(reviewed.calls[0].actions.map(action => action.type).sort(), ["charged_move", "fast_move", "wait"],
    "Include throw-now, one extra Fast and an explicitly legal timing wait in the same comparison.");
  assert.equal(reviewed.decision.action.type, selectedType, "Use the verified legal continuation selection.");
  assert.equal(reviewed.decision.principleResult.action.type, selectedType,
    "Returned action and principle evidence must agree after the timing review.");
  assert.equal(reviewed.decision.principleResult.category, "timing");
  if (selectedType === "charged_move") assert.equal(reviewed.decision.action.moveId, "SELF_BUFF");
}

const incomplete = select(state(), {}, {
  wait: true,
  evaluate(original, actions) { return { ...completedComparison(original, actions, "wait"), complete: false }; }
});
assert.equal(incomplete.calls.length, 1);
assert.equal(incomplete.decision.action.type, baseline.decision.action.type,
  "An incomplete comparison must preserve the original action even when it proposes a legal alternative.");

console.log(`Strategic timing guards passed: ${guarded.length} guarded decisions and 5 positive/boundary/fallback cases.`);
