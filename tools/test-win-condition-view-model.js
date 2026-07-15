"use strict";

const assert = require("assert");
const {
  buildWinConditionViewModels,
  selectSwingPoint
} = require("../src/analysis/win-condition-view-model");

function condition(overrides = {}) {
  return {
    id: "defense:A:FORTIFY",
    category: "guaranteed-defense-buff",
    side: "A",
    moveId: "FORTIFY",
    confidence: { level: "high" },
    importance: { level: "major" },
    summary: "Defense matters.",
    explanation: "Defense matters.",
    supportingEvidence: [{ evidence: { pokemonName: "Alpha", moveName: "Fortify" } }],
    supportingPatterns: [{ patternId: "defense-pattern" }],
    decisiveMoments: [{ turn: 12, side: "A", moveId: "FORTIFY", label: "Fortify lands" }],
    relatedLineIds: ["plain", "boosted"],
    visibility: "user-facing",
    ...overrides
  };
}

function input(conditions, overrides = {}) {
  return {
    winConditionSummary: { conditions },
    pokemon: { a: { name: "Alpha" }, b: { name: "Beta" } },
    events: [{ index: 4, turn: 12, side: "A", moveId: "FORTIFY" }],
    ...overrides
  };
}

function testNaturalCopyAndExactTimelineReference() {
  const views = buildWinConditionViewModels(input([condition()]));
  assert.strictEqual(views.length, 1);
  assert.strictEqual(views[0].title, "Defense Boost");
  assert.match(views[0].text, /Fortify/);
  assert.strictEqual(views[0].timelineReference.eventIndex, 4);
}

function testOrderingDeduplicationAndOrientation() {
  const duplicate = condition({ id: "duplicate", relatedLineIds: ["boosted", "plain"] });
  const views = buildWinConditionViewModels(input([condition(), duplicate], {
    swing: { side: "B", fastMoveCount: 1, fastMoveName: "Pulse", lineType: "straight" }
  }));
  assert.strictEqual(views.length, 2);
  assert.strictEqual(views[0].category, "extra-fast-move");
  assert.match(views[0].text, /Beta/);
}

function testExactHpFormattingAndMatrixExclusion() {
  const exact = condition({
    id: "hp:B:7",
    category: "opponent-hp",
    side: "B",
    value: 7,
    unit: "hp",
    moveId: null,
    decisiveMoments: []
  });
  const view = buildWinConditionViewModels(input([exact]))[0];
  assert.match(view.text, /exactly 7 HP/);
  assert.strictEqual(view.matrixEligible, false);
  assert.strictEqual(view.actionReference, null);
  const unreliable = { ...exact, id: "hp:missing", value: null };
  assert.deepStrictEqual(buildWinConditionViewModels(input([unreliable])), []);
}

function testSimulatedHpSwingCreatesExactPreview() {
  const views = buildWinConditionViewModels(input([], {
    hpSwing: {
      visible: true,
      side: "A",
      pokemon: "Alpha",
      opponentSide: "B",
      opponentPokemon: "Beta",
      hpReduction: 9,
      opponentStartingHp: 134
    }
  }));
  assert.strictEqual(views[0].title, "HP Swing");
  assert.match(views[0].text, /134 HP or lower/);
  assert.strictEqual(views[0].actionReference.type, "preview-hp");
  assert.strictEqual(views[0].matrixEligible, false);
}

function testLowConfidenceHidden() {
  const views = buildWinConditionViewModels(input([condition({ confidence: { level: "low" } })]));
  assert.deepStrictEqual(views, []);
}

function testSingleDeterministicSwingPoint() {
  const views = buildWinConditionViewModels(input([
    condition(),
    condition({ id: "attack:B:WEAKEN", category: "guaranteed-attack-debuff", side: "B", moveId: "WEAKEN", decisiveMoments: [{ turn: 18, side: "B", moveId: "WEAKEN" }] })
  ]));
  const first = selectSwingPoint({ conditions: views, reviewItems: [] });
  const second = selectSwingPoint({ conditions: views, reviewItems: [] });
  assert.deepStrictEqual(first, second);
  assert.strictEqual(first.turn, 12);
  assert.strictEqual(first.eventIndex, 4);
}

function testReviewFallbackAndMissingTurn() {
  const noTurn = buildWinConditionViewModels(input([condition({ decisiveMoments: [{ turn: null }] })]));
  const point = selectSwingPoint({ conditions: noTurn });
  assert.strictEqual(point.source, "win-condition");
  assert.strictEqual(point.eventIndex, null);
  assert.strictEqual(point.turn, null);
  assert.strictEqual(selectSwingPoint({ conditions: [], reviewItems: [{ eventIndex: 3, turn: 20 }] }), null);
}

testNaturalCopyAndExactTimelineReference();
testOrderingDeduplicationAndOrientation();
testExactHpFormattingAndMatrixExclusion();
testSimulatedHpSwingCreatesExactPreview();
testLowConfidenceHidden();
testSingleDeterministicSwingPoint();
testReviewFallbackAndMissingTurn();
console.log("Win Condition View Model tests passed.");
