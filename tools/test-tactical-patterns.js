"use strict";

const assert = require("assert");
const {
  TACTICAL_PATTERN_LIBRARY_VERSION,
  getTacticalPatternDefinitions,
  getTacticalPatternDefinition,
  detectTacticalPatterns,
  buildTacticalPatternSummary,
  plannerHintsFromTacticalFindings
} = require("../src/tactical/tactical-patterns");
const {
  translateTacticalFinding
} = require("../src/analysis/tactical-insights");

function candidate(overrides = {}) {
  return {
    moveId: "PLAIN_MOVE",
    moveName: "Plain Move",
    energyCost: 40,
    immediateDamage: 40,
    statEffects: "none",
    projectedOutcome: "loss",
    projectedRating: 350,
    projectedRemainingHp: 0,
    projectedRemainingEnergy: 10,
    ...overrides
  };
}

function context(decisions, overrides = {}) {
  return {
    analysisMode: "reliability",
    engineVersion: "test-engine",
    provenance: { source: "live", stale: false },
    combatants: {
      A: { id: "alpha", name: "Alpha" },
      B: { id: "beta", name: "Beta" }
    },
    decisionTrace: { engineVersion: "test-engine", decisions },
    ...overrides
  };
}

function decision(reasonCode, chosen, alternatives, overrides = {}) {
  return {
    turn: 12,
    side: "A",
    pokemonId: "alpha",
    decisionType: "charged-move-selection",
    reasonCode,
    chosenCandidate: chosen,
    candidates: [chosen, ...alternatives],
    ...overrides
  };
}

function testRegistryAndProfiles() {
  const definitions = getTacticalPatternDefinitions();
  assert(definitions.length >= 6);
  assert.strictEqual(getTacticalPatternDefinition("guaranteed-defense-buff-value").version, 1);
  assert.strictEqual(getTacticalPatternDefinition("missing"), null);
  assert.match(TACTICAL_PATTERN_LIBRARY_VERSION, /^tactical-patterns-v/);
}

function testGuaranteedDefenseBuff() {
  const boosted = candidate({
    moveId: "FORTIFY",
    moveName: "Fortify",
    statEffects: "self DEF +1",
    projectedOutcome: "win",
    projectedRating: 670,
    projectedRemainingHp: 24
  });
  const findings = detectTacticalPatterns(context([
    decision("GUARANTEED_DEFENSE_BUFF_VALUE", boosted, [candidate()])
  ]), { profile: "reliability" });
  const finding = findings.find(item => item.patternId === "guaranteed-defense-buff-value");
  assert(finding);
  assert.strictEqual(finding.confidence.level, "high");
  assert.strictEqual(finding.changesOutcome, true);
  assert.strictEqual(finding.evidence.extraHpRetained, 24);
  assert.strictEqual(finding.evidence.stages, 1);
  assert.match(translateTacticalFinding(finding).text, /Defense boost lets Alpha/i);
}

function testGuaranteedAttackDebuffAndOrientation() {
  const debuff = candidate({
    moveId: "CHILL",
    moveName: "Chill",
    statEffects: "opponent ATK -1",
    projectedOutcome: "win",
    projectedRating: 640,
    projectedRemainingHp: 18
  });
  const findings = detectTacticalPatterns(context([
    decision("GUARANTEED_ATTACK_DEBUFF_VALUE", debuff, [candidate()], { side: "B", pokemonId: "beta" })
  ]), { profile: "reliability" });
  const finding = findings.find(item => item.patternId === "guaranteed-attack-debuff-value");
  assert(finding);
  assert.strictEqual(finding.side, "B");
  assert.strictEqual(finding.evidence.pokemonName, "Beta");
  assert.strictEqual(finding.evidence.opponentName, "Alpha");
}

function testDelaySelfDebuff() {
  const safe = candidate({
    moveId: "SAFE_MOVE",
    moveName: "Safe Move",
    projectedOutcome: "win",
    projectedRating: 610,
    projectedRemainingHp: 12
  });
  const nuke = candidate({
    moveId: "NUKE",
    moveName: "Nuke",
    statEffects: "self DEF -2",
    projectedOutcome: "loss",
    projectedRating: 240
  });
  const finding = detectTacticalPatterns(context([
    decision("AVOID_EARLY_SELF_DEBUFF", safe, [nuke])
  ]), { profile: "reliability" }).find(item => item.patternId === "delay-self-debuff");
  assert(finding);
  assert.strictEqual(finding.moveId, "NUKE");
  assert.strictEqual(finding.evidence.selfDebuffStages, -2);
  assert.match(translateTacticalFinding(finding).text, /too early/i);
  const hints = plannerHintsFromTacticalFindings([finding]);
  assert.deepStrictEqual(hints.exploreDelayedMoveIds, ["NUKE"]);
}

function testBuffWithoutFutureValueIsIgnored() {
  const boost = candidate({ moveId: "TINY_BUFF", statEffects: "self DEF +1", projectedRating: 351, projectedRemainingHp: 1 });
  const findings = detectTacticalPatterns(context([
    decision("GUARANTEED_DEFENSE_BUFF_VALUE", boost, [candidate()])
  ]), { profile: "reliability" });
  assert(!findings.some(item => item.patternId === "guaranteed-defense-buff-value"));
}

function testFlipAdapterAndDeduplication() {
  const flip = {
    side: "A",
    pokemonId: "alpha",
    pokemonName: "Alpha",
    fastMoveId: "PULSE",
    fastMoveName: "Pulse",
    fastMoveCount: 1,
    totalTurnCost: 2,
    visible: true,
    reproducible: true,
    lineType: "straight",
    alternateLineId: "flip-line"
  };
  const findings = detectTacticalPatterns(context([], { flipOpportunities: [flip, { ...flip }] }), { profile: "interactive-analysis" });
  const flips = findings.filter(item => item.patternId === "extra-fast-move-flip");
  assert.strictEqual(flips.length, 1);
  assert.strictEqual(flips[0].evidence.totalTurnCost, 2);
  assert.strictEqual(flips[0].evidence.fastMoveCount, 1);
}

function testBaitAndStraightBranches() {
  const baitContext = context([], {
    alternateLines: [
      { id: "straight", type: "straight", side: "A", result: { outcome: "loss" } },
      { id: "bait", type: "bait", side: "A", result: { outcome: "win" }, reproducible: true, baitMoveName: "Bait", threatenedMoveName: "Nuke" }
    ]
  });
  const bait = detectTacticalPatterns(baitContext, { profile: "interactive-analysis" }).find(item => item.patternId === "bait-required");
  assert(bait);
  assert.strictEqual(bait.confidence.level, "high");
  assert.match(translateTacticalFinding(bait).text, /draw a shield/i);

  const straightContext = context([], {
    alternateLines: [
      { id: "straight", type: "straight", side: "B", result: { outcome: "win" }, reproducible: true, moveName: "Closer" },
      { id: "bait", type: "bait", side: "B", result: { outcome: "loss" } }
    ]
  });
  const straight = detectTacticalPatterns(straightContext, { profile: "interactive-analysis" }).find(item => item.patternId === "straight-play-sufficient");
  assert(straight);
  assert.strictEqual(straight.side, "B");
}

function testStaleVisibilityAndDeterminism() {
  const boosted = candidate({
    moveId: "FORTIFY",
    moveName: "Fortify",
    statEffects: "self DEF +1",
    projectedOutcome: "win",
    projectedRating: 670,
    projectedRemainingHp: 24
  });
  const input = context([decision("GUARANTEED_DEFENSE_BUFF_VALUE", boosted, [candidate()])], {
    provenance: { source: "cached", stale: true }
  });
  const first = buildTacticalPatternSummary(input, { profile: "reliability" });
  const second = buildTacticalPatternSummary(input, { profile: "reliability" });
  assert.strictEqual(first.findings[0].visibility, "developer-only");
  assert.strictEqual(first.userFacingFindings.length, 0);
  assert.deepStrictEqual(first, second);
  const measured = buildTacticalPatternSummary(input, { profile: "reliability", measurePerformance: true });
  assert(measured.performance.durationMs < 50, `Synthetic detector pass took ${measured.performance.durationMs} ms.`);
}

testRegistryAndProfiles();
testGuaranteedDefenseBuff();
testGuaranteedAttackDebuffAndOrientation();
testDelaySelfDebuff();
testBuffWithoutFutureValueIsIgnored();
testFlipAdapterAndDeduplication();
testBaitAndStraightBranches();
testStaleVisibilityAndDeterminism();
console.log("Tactical Pattern Library tests passed.");
