"use strict";

const assert = require("assert");
const {
  WinConditionCategory,
  buildWinConditionSummary,
  eligibleWinConditions
} = require("../src/analysis/win-condition-engine");

function finding(patternId, overrides = {}) {
  return {
    patternId,
    patternVersion: 1,
    side: "A",
    pokemonId: "alpha",
    moveId: "MOVE",
    turn: 20,
    decisionId: `A:20:${patternId}`,
    confidence: { level: "high", reasons: ["complete continuation"] },
    relevance: 0.9,
    impact: "meaningful",
    changesOutcome: false,
    visibility: "user-facing",
    relatedLineIds: ["observed", "counterfactual"],
    evidence: {},
    ...overrides
  };
}

function summary(findings) {
  return buildWinConditionSummary({
    tacticalSummary: { libraryVersion: "test", findings },
    engineVersion: "test-engine",
    provenance: { stale: false }
  });
}

function testDeterministicAndOrdered() {
  const findings = [
    finding("guaranteed-attack-debuff-value", {
      turn: 10,
      evidence: { moveName: "Chill", baselineOutcome: "win", alternateOutcome: "win", projectedRatingDelta: 18 }
    }),
    finding("extra-fast-move-flip", {
      turn: null,
      changesOutcome: true,
      evidence: { fastMoveName: "Pulse", fastMoveCount: 1, totalTurnCost: 2, baselineOutcome: "loss", alternateOutcome: "win" }
    })
  ];
  const first = summary(findings);
  const second = summary(findings);
  assert.deepStrictEqual(first, second);
  assert.strictEqual(first.conditions[0].importance.level, "critical");
  assert.strictEqual(first.conditions[1].importance.level, "major");
}

function testGuaranteedEffectsAndCounterfactual() {
  const result = summary([
    finding("guaranteed-defense-buff-value", {
      changesOutcome: true,
      evidence: {
        moveName: "Fortify",
        baselineOutcome: "loss",
        alternateOutcome: "win",
        extraHpRetained: 17,
        projectedEnergyDelta: 8,
        projectedRatingDelta: 120
      }
    }),
    finding("guaranteed-attack-debuff-value", {
      side: "B",
      decisionId: "B:24:chill",
      evidence: { moveName: "Chill", baselineOutcome: "win", alternateOutcome: "win", extraHpRetained: 11, projectedRatingDelta: 25 }
    })
  ]);
  const defense = result.byCategory[WinConditionCategory.GUARANTEED_DEFENSE_BUFF][0];
  assert.strictEqual(defense.counterfactual.available, true);
  assert.strictEqual(defense.counterfactual.changesOutcome, true);
  assert.strictEqual(defense.answers.couldWinWithoutIt, false);
  assert.strictEqual(defense.importance.level, "critical");
  assert.strictEqual(defense.supportingEvidence[0].evidence.extraHpRetained, 17);
  assert.strictEqual(result.byCategory[WinConditionCategory.GUARANTEED_ATTACK_DEBUFF][0].importance.level, "major");
}

function testExtraFastAndDelayedSelfDebuff() {
  const result = summary([
    finding("extra-fast-move-flip", {
      changesOutcome: true,
      evidence: {
        fastMoveId: "PULSE",
        fastMoveName: "Pulse",
        fastMoveCount: 2,
        totalTurnCost: 4,
        baselineOutcome: "loss",
        alternateOutcome: "win"
      }
    }),
    finding("delay-self-debuff", {
      turn: 18,
      evidence: {
        moveName: "Crash",
        earlyOutcome: "loss",
        delayedOutcome: "win",
        projectedHpDelta: 14,
        projectedRatingDelta: 90,
        usedLater: true,
        laterTurn: 36
      },
      changesOutcome: true
    })
  ]);
  const fast = result.byCategory[WinConditionCategory.EXTRA_FAST_MOVE][0];
  const delayed = result.byCategory[WinConditionCategory.DELAYED_SELF_DEBUFF][0];
  assert.match(fast.summary, /2 extra Pulse/i);
  assert.strictEqual(fast.counterfactual.expectedOutcome, "loss");
  assert(delayed.decisiveMoments.some(moment => moment.type === "later-use" && moment.turn === 36));
  assert.strictEqual(delayed.counterfactual.changesOutcome, true);
}

function testVisibilityAndConsumerFiltering() {
  const high = finding("guaranteed-defense-buff-value", {
    evidence: { moveName: "Fortify", baselineOutcome: "win", alternateOutcome: "win", projectedRatingDelta: 30 }
  });
  const medium = finding("guaranteed-attack-debuff-value", {
    decisionId: "A:30:medium",
    confidence: { level: "medium", reasons: ["partial branch"] },
    evidence: { moveName: "Chill", baselineOutcome: "win", alternateOutcome: "win", projectedRatingDelta: 30 }
  });
  const unsupported = finding("bait-required", { decisionId: "A:40:bait" });
  const result = summary([medium, unsupported, high]);
  assert.strictEqual(result.conditions.length, 2);
  assert.strictEqual(eligibleWinConditions(result).length, 1);
  assert.strictEqual(eligibleWinConditions(result)[0].category, WinConditionCategory.GUARANTEED_DEFENSE_BUFF);
}

testDeterministicAndOrdered();
testGuaranteedEffectsAndCounterfactual();
testExtraFastAndDelayedSelfDebuff();
testVisibilityAndConsumerFiltering();
console.log("Win Condition Engine tests passed.");
