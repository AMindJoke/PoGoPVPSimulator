"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  MATCHUP_STORY_LIMITS,
  buildMatchupStory
} = require("../src/analysis/matchup-story");
const { buildFromCacheFiles } = require("../src/analysis/matchup-inspector");

const ROOT = path.resolve(__dirname, "..");

function pokemon() {
  return {
    a: { id: "alpha", name: "Alpha" },
    b: { id: "beta", name: "Beta" }
  };
}

function scenario(overrides = {}) {
  return {
    shieldState: "1-1",
    score: 470,
    winnerSide: "B",
    closeness: "Close",
    source: "Precomputed",
    result: {
      score: 470,
      details: {
        hpEdge: -12,
        energyEdge: -8,
        readyEdge: -24,
        closingCostEdge: 0,
        farmPressureEdge: 0,
        outpacePressureEdge: -4
      }
    },
    swing: {
      visible: true,
      side: "A",
      fastMoveCount: 1,
      fastMoveName: "Pulse",
      totalTurnCost: 2,
      lineType: "bait"
    },
    ...overrides
  };
}

function baseInput(overrides = {}) {
  return {
    perspective: "A",
    pokemon: pokemon(),
    selectedShieldState: "1-1",
    source: "Precomputed",
    flags: [{ id: "shield-dependent" }],
    scenarios: [scenario()],
    ...overrides
  };
}

function testDeterministicGeneration() {
  const input = baseInput();
  assert.deepStrictEqual(buildMatchupStory(input), buildMatchupStory(input));
}

function testPrioritizationAndLimits() {
  const input = baseInput({
    keyThreats: [1, 2, 3, 4].map(priority => ({
      label: `Threat ${priority}`,
      reason: "Fixture evidence",
      priority
    }))
  });
  const story = buildMatchupStory(input);
  assert(story.keyThreats.length <= MATCHUP_STORY_LIMITS.keyThreats);
  assert(story.winConditions.length <= MATCHUP_STORY_LIMITS.winConditions);
  assert(story.commonMistakes.length <= MATCHUP_STORY_LIMITS.commonMistakes);
  assert(story.difficulty.reasons.length <= MATCHUP_STORY_LIMITS.difficultyReasons);
  assert(story.tags.length <= MATCHUP_STORY_LIMITS.tags);
  assert.equal(story.keyThreats[0].label, "Threat 4");
}

function testMissingAnalysisFields() {
  const story = buildMatchupStory({ pokemon: pokemon(), scenarios: [] });
  assert.equal(story.confidence, "low");
  assert.equal(story.difficulty.level, "Unknown");
  assert.match(story.why.text, /not available/i);
  assert.deepStrictEqual(story.commonMistakes, []);
}

function testLowConfidenceOmission() {
  const story = buildMatchupStory(baseInput({ confidence: "low", keyThreats: [{ label: "Uncertain", reason: "Guess" }] }));
  assert.deepStrictEqual(story.keyThreats, []);
  assert.deepStrictEqual(story.commonMistakes, []);
}

function testAlternateLineActionReference() {
  const story = buildMatchupStory(baseInput());
  const condition = story.winConditions.find(item => item.reproducible);
  assert(condition);
  assert.equal(condition.action.type, "preview");
  assert.equal(condition.action.ref.side, "A");
  assert.equal(condition.action.ref.fastMoveCount, 1);
  assert.equal(condition.action.ref.fastMoveName, "Pulse");
  assert.equal(condition.action.ref.lineType, "bait");
  assert.equal(condition.label, "Gain one extra Pulse.");
  assert.equal(story.commonMistakes[0].label, "Throwing before gaining one extra Pulse.");
  assert.equal(story.winConditionViews[0].title, "Extra Fast Move");
  assert.equal(story.winConditionViews[0].actionReference.type, "preview");
}

function testNaturalCompetitiveCopy() {
  const story = buildMatchupStory(baseInput({
    flags: [],
    scenarios: [scenario({
      result: { score: 470, details: {} },
      swing: { ...scenario().swing, lineType: "straight" }
    })]
  }));
  const visibleCopy = [
    story.why.text,
    story.difficulty.text,
    ...story.keyThreats.flatMap(item => [item.label, item.reason]),
    ...story.winConditions.map(item => item.label),
    ...story.commonMistakes.flatMap(item => [item.label, item.reason])
  ].join(" ");
  assert.match(story.why.text, /one extra Pulse/i);
  assert.match(story.why.text, /baiting isn't required/i);
  assert.match(story.difficulty.text, /\.$/);
  assert(!/concrete flippable|detected|projected|continuation|timing cost|identified tactical branch|evaluation indicates|simulation determined/i.test(visibleCopy));
}

function testShieldStateSelection() {
  const input = baseInput({
    selectedShieldState: "2-2",
    scenarios: [
      scenario({ shieldState: "0-0", score: 700, winnerSide: "A", swing: null }),
      scenario({ shieldState: "2-2", score: 300, winnerSide: "B", swing: null })
    ]
  });
  const story = buildMatchupStory(input);
  assert.equal(story.summary.shieldState, "2-2");
  assert.equal(story.summary.outcome, "Loss");
  assert.equal(story.summary.score, 300);
}

function testOrientation() {
  const input = baseInput({ perspective: "B" });
  const story = buildMatchupStory(input);
  assert.equal(story.summary.outcome, "Win");
  assert(!story.winConditions.some(item => item.side === "A" && item.reproducible));
  assert(story.commonMistakes.some(item => item.label === "Ignoring Alpha's stored-energy lead."));
  assert(story.commonMistakes.some(item => /energy lead worth one Pulse/i.test(item.reason)));
  assert(!story.commonMistakes.some(item => /for free/i.test(item.label)));
}

function testStoredEnergyAmountInOpponentSwing() {
  const story = buildMatchupStory(baseInput({
    perspective: "B",
    scenarios: [scenario({ swing: { ...scenario().swing, energy: 11 } })]
  }));
  assert(story.commonMistakes.some(item => /11-energy lead \(one Pulse\)/i.test(item.reason)));
}

function testWhyUsesWinnerAlignedEvidence() {
  const story = buildMatchupStory(baseInput({
    flags: [],
    scenarios: [scenario({
      score: 421,
      winnerSide: "B",
      swing: null,
      result: {
        score: 421,
        details: {
          hpEdge: -17,
          energyEdge: 29,
          readyEdge: 62,
          closingCostEdge: 0,
          farmPressureEdge: 64,
          outpacePressureEdge: 0
        }
      }
    })]
  }));
  assert.match(story.why.text, /Beta comes out with more HP/i);
  assert(!/Alpha creates more fast-move pressure/i.test(story.why.text));
  assert.deepStrictEqual(story.why.evidenceKeys, ["hpEdge"]);
}

function testStraightforwardAndNoHardcoding() {
  const story = buildMatchupStory(baseInput({
    flags: [],
    scenarios: [scenario({ score: 760, winnerSide: "A", closeness: "Decisive", swing: null })]
  }));
  assert.equal(story.difficulty.level, "Low");
  assert(story.tags.includes("straightforward"));
  const source = fs.readFileSync(path.join(ROOT, "src", "analysis", "matchup-story.js"), "utf8");
  assert(!/Malamar|Pangoro/i.test(source));
}

function testConsumesNaturalTacticalInsight() {
  const finding = {
    patternId: "guaranteed-attack-debuff-value",
    side: "A",
    moveId: "ICY_WIND",
    turn: 12,
    decisionId: "A:12:icy-wind",
    visibility: "user-facing",
    confidence: { level: "high" },
    relevance: 0.9,
    impact: "outcome-changing",
    changesOutcome: true,
    actionable: true,
    evidence: {
      pokemonName: "Alpha",
      moveName: "Icy Wind",
      extraHpRetained: 16,
      baselineOutcome: "loss",
      alternateOutcome: "win"
    },
    relatedLineIds: []
  };
  const story = buildMatchupStory(baseInput({
    tacticalSummary: { findings: [finding], userFacingFindings: [finding] }
  }));
  assert.match(story.why.text, /Attack drop changes the projected result from loss to win/i);
  assert.strictEqual(story.structuredWinConditions.length, 1);
  assert(!/detector|relevance|confidence score/i.test(story.why.text));
}

function testDoesNotExposeMediumWinCondition() {
  const finding = {
    patternId: "guaranteed-defense-buff-value",
    side: "A",
    moveId: "FORTIFY",
    turn: 12,
    decisionId: "A:12:fortify",
    visibility: "user-facing",
    confidence: { level: "medium" },
    relevance: 0.9,
    impact: "meaningful",
    changesOutcome: false,
    evidence: { moveName: "Fortify", baselineOutcome: "win", alternateOutcome: "win", projectedRatingDelta: 30 },
    relatedLineIds: []
  };
  const story = buildMatchupStory(baseInput({
    tacticalSummary: { findings: [finding], userFacingFindings: [finding] }
  }));
  assert.deepStrictEqual(story.structuredWinConditions, []);
  assert(!/Defense boost/i.test(story.why.text));
}

function testRealComplexMatchupIfAvailable() {
  const cacheRoot = path.join(ROOT, "data", "matchup-cache", "great-league", "rank1");
  const aPath = path.join(cacheRoot, "malamar.json");
  const bPath = path.join(cacheRoot, "pangoro.json");
  if (!fs.existsSync(aPath) || !fs.existsSync(bPath)) return;
  const inspector = buildFromCacheFiles({
    a: { id: "malamar", name: "Malamar", moveset: {} },
    b: { id: "pangoro", name: "Pangoro", moveset: {} },
    aCache: JSON.parse(fs.readFileSync(aPath, "utf8")),
    bCache: JSON.parse(fs.readFileSync(bPath, "utf8"))
  });
  const story = buildMatchupStory({
    perspective: "A",
    pokemon: inspector.pokemon,
    selectedShieldState: "1-1",
    source: "Precomputed",
    flags: inspector.analysis.flags,
    scenarios: inspector.evenShield
  });
  assert.equal(story.summary.shieldState, "1-1");
  assert(story.tags.includes("shield-dependent"));
  assert(story.why.evidenceKeys.length > 0);
}

function run() {
  testDeterministicGeneration();
  testPrioritizationAndLimits();
  testMissingAnalysisFields();
  testLowConfidenceOmission();
  testAlternateLineActionReference();
  testNaturalCompetitiveCopy();
  testShieldStateSelection();
  testOrientation();
  testStoredEnergyAmountInOpponentSwing();
  testWhyUsesWinnerAlignedEvidence();
  testStraightforwardAndNoHardcoding();
  testConsumesNaturalTacticalInsight();
  testDoesNotExposeMediumWinCondition();
  testRealComplexMatchupIfAvailable();
  console.log("Matchup Story tests passed.");
}

if (require.main === module) run();

module.exports = { run };
