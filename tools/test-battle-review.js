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
  assert.strictEqual(review.metrics.length, 3);
  assert.strictEqual(review.metrics[0].label, "HP Swing");
  assert.strictEqual(review.metrics[0].display, "No HP flip");
  assert.strictEqual(review.metrics[1].label, "Energy Swing");
  assert.strictEqual(review.metrics[2].label, "Shield Swing");
  assert.strictEqual(review.swingPoint, null);
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

function testSwingPointUsesMatrixFlipInsteadOfClosingFallback() {
  const review = buildBattleReview({
    combatants: combatants(),
    events: events(),
    pokemon: { a: { name: "Abomasnow" }, b: { name: "Charjabug" } },
    swing: {
      visible: true,
      side: "A",
      fastMoves: 1,
      fastMove: "Powder Snow",
      energy: 8,
      lineType: "straight"
    },
    hpSwing: {
      visible: true,
      side: "A",
      pokemon: "Abomasnow",
      opponentSide: "B",
      opponentPokemon: "Charjabug",
      hpReduction: 9,
      opponentStartingHp: 134
    },
    shieldSwing: { side: "A", shields: 1, fromShields: 1, toShields: 2 }
  });
  assert.strictEqual(review.swingPoint.title, "Extra Fast Move");
  assert.match(review.swingPoint.text, /one extra powder snow/i);
  assert.match(review.swingPoint.text, /\+8 starting energy/i);
  assert.strictEqual(review.metrics[0].display, "134 starting HP");
  assert.strictEqual(review.metrics[0].actionReference.type, "preview-hp");
  assert.strictEqual(review.metrics[1].display, "+8 energy");
  assert.strictEqual(review.metrics[2].display, "+1 shield");
  assert.strictEqual(review.swingPoint.eventIndex, null);
  assert(!/closer|closing/i.test(`${review.swingPoint.title} ${review.swingPoint.text}`));
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
  assert.strictEqual(review.winConditions[0].title, "Defense Boost");
  assert.strictEqual(review.swingPoint.eventIndex, 2);
}

testPrioritizesVerifiedTurningPoint();
testLimitsAndDeduplicatesMoments();
testRoutineSneakIsNotPresentedAsTacticalAdvice();
testDoesNotInventUnmatchedCriticalDecision();
testSwingPointUsesMatrixFlipInsteadOfClosingFallback();
testExposesStructuredTacticalEvidence();
console.log("Battle Review tests passed.");
