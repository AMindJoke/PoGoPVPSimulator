"use strict";

const assert = require("assert");
const {
  BATTLE_REVIEW_MAX_ITEMS,
  buildBattleReview
} = require("../src/analysis/battle-review");

function combatants() {
  return {
    A: { name: "Alpha", hp: 18, maxHp: 140, energy: 12 },
    B: { name: "Beta", hp: 0, maxHp: 145, energy: 30 }
  };
}

function events() {
  return [
    {
      index: 0,
      side: "B",
      kind: "charge",
      turn: 20,
      moveId: "THREAT",
      moveName: "Threat",
      damage: 1,
      state: { A: { hp: 90 }, B: { hp: 100 } }
    },
    {
      index: 1,
      side: "A",
      kind: "fast",
      turn: 28,
      moveName: "Pulse",
      damage: 4,
      sneaked: true,
      sneakChargeName: "Pressure",
      state: { A: { hp: 75 }, B: { hp: 60 } }
    },
    {
      index: 2,
      side: "A",
      kind: "charge",
      turn: 36,
      moveName: "Fortify",
      damage: 20,
      buffEffects: [{ target: "self", stat: "defense", delta: 1 }],
      state: { A: { hp: 50 }, B: { hp: 40 } }
    },
    {
      index: 3,
      side: "A",
      kind: "charge",
      turn: 48,
      moveName: "Closer",
      damage: 42,
      state: { A: { hp: 18 }, B: { hp: 0 } }
    }
  ];
}

function testPrioritizesVerifiedTurningPoint() {
  const review = buildBattleReview({
    combatants: combatants(),
    events: events(),
    insights: [{
      key: "critical",
      turn: 20,
      side: "A",
      pokemonName: "Alpha",
      decisionType: "critical-shield-call",
      action: "SHIELD",
      moveId: "THREAT",
      moveName: "Threat"
    }]
  });
  assert.strictEqual(review.items[0].type, "critical");
  assert.strictEqual(review.items[0].eventIndex, 0);
  assert(review.items[0].explanation.includes("winning continuation"));
}

function testLimitsAndDeduplicatesMoments() {
  const review = buildBattleReview({ combatants: combatants(), events: events() });
  assert(review.items.length <= BATTLE_REVIEW_MAX_ITEMS);
  assert.strictEqual(new Set(review.items.map(item => item.eventIndex)).size, review.items.length);
  assert(review.items.some(item => item.type === "closing"));
  assert(review.items.some(item => item.type === "effect"));
  assert(review.items.some(item => item.type === "timing"));
}

function testDoesNotInventUnmatchedCriticalDecision() {
  const review = buildBattleReview({
    combatants: combatants(),
    events: events(),
    insights: [{
      turn: 99,
      side: "A",
      decisionType: "critical-shield-call",
      action: "SHIELD",
      moveId: "MISSING",
      moveName: "Missing"
    }]
  });
  assert(!review.items.some(item => item.type === "critical"));
}

testPrioritizesVerifiedTurningPoint();
testLimitsAndDeduplicatesMoments();
testDoesNotInventUnmatchedCriticalDecision();
console.log("Battle Review tests passed.");
