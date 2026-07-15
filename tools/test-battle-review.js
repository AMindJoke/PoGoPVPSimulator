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
      moveId: "FORTIFY",
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
  assert(!review.items.some(item => item.type === "timing"));
}

function testRoutineSneakIsNotPresentedAsTacticalAdvice() {
  const review = buildBattleReview({ combatants: combatants(), events: events() });
  assert(!review.items.some(item => /sneak/i.test(`${item.title} ${item.explanation}`)));
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

function testExposesStructuredTacticalEvidence() {
  const finding = {
    patternId: "guaranteed-defense-buff-value",
    patternVersion: 1,
    category: "stat-buff",
    side: "A",
    moveId: "FORTIFY",
    turn: 36,
    decisionId: "A:36:fortify",
    relevance: 0.92,
    confidence: { level: "high", reasons: ["complete comparison"] },
    impact: "outcome-changing",
    changesOutcome: true,
    actionable: true,
    visibility: "user-facing",
    evidence: {
      pokemonName: "Alpha",
      moveName: "Fortify",
      extraHpRetained: 18
    },
    relatedLineIds: ["buff-line", "plain-line"]
  };
  const review = buildBattleReview({
    combatants: combatants(),
    events: events(),
    developerMode: true,
    tacticalSummary: { findings: [finding], userFacingFindings: [finding] }
  });
  assert(review.items.some(item => item.type === "tactical" && item.eventIndex === 2));
  assert.strictEqual(review.developerPatterns[0].patternId, "guaranteed-defense-buff-value");
  assert.strictEqual(review.developerPatterns[0].evidence.extraHpRetained, 18);
  assert.strictEqual(review.developerWinConditions[0].category, "guaranteed-defense-buff");
  assert.strictEqual(review.winConditionSummary.conditions.length, 1);
}

testPrioritizesVerifiedTurningPoint();
testLimitsAndDeduplicatesMoments();
testRoutineSneakIsNotPresentedAsTacticalAdvice();
testDoesNotInventUnmatchedCriticalDecision();
testExposesStructuredTacticalEvidence();
console.log("Battle Review tests passed.");
