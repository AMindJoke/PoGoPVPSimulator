"use strict";

const assert = require("assert");
const TurnEngine = require("../src/battle/turn-resolution-engine");
const Intelligence = require("../src/battle/battle-intelligence");
const Fixtures = require("../data/pvpoke-first-decision-parity-fixtures");

const actionFixtures = Fixtures.buildActionFixtures();
const shieldFixtures = Fixtures.buildShieldFixtures();
const results = [];

for (const fixture of actionFixtures) {
  Intelligence.clearCache();
  const state = TurnEngine.createState(fixture.state);
  state.sides.A = { ...state.sides.A, ...fixture.state.sides.A };
  state.sides.B = { ...state.sides.B, ...fixture.state.sides.B };
  const legalActions = TurnEngine.getLegalActions(state, "A");
  const context = {
    callerContext: "parity-harness",
    farmEnergy: fixture.context?.farmEnergy,
    chargedTimingOptimization: fixture.context?.chargedTimingOptimization,
    estimateDamage: action => Number(action.move?.damage || 0),
    estimateFastDamage: side => Number(
      side === "opponent" ? state.sides.B.fastMove?.damage || 0 : state.sides.A.fastMove?.damage || 0
    ),
    estimateOpponentDamage: move => Number(move?.damage || 0),
    compactDamage: (_side, move) => Number(move?.damage || 0),
    willOpponentShield: () => fixture.context?.wouldShield === true,
    hasGuaranteedEffect: action => Number(action.move?.buffApplyChance || 0) >= 1
  };
  const decision = Intelligence.selectAction({
    state,
    side: "A",
    legalActions,
    policy: "FAST",
    plannerMode: "PVPOKE_PARITY",
    context
  });
  const expected = fixture.expected;
  assert.equal(decision.action?.type, expected.type, `${fixture.id}: action type; source ${fixture.source}`);
  if (expected.moveId) assert.equal(decision.action?.moveId, expected.moveId, `${fixture.id}: move; source ${fixture.source}`);
  if (expected.intent) assert.equal(decision.principleResult?.intent, expected.intent, `${fixture.id}: intent`);
  assert(
    decision.principlesTriggered.includes(expected.principleId),
    `${fixture.id}: expected ${expected.principleId}; got ${decision.principlesTriggered.join(", ")}`
  );
  assert.equal(decision.finalAuthority, "PRINCIPLE_ENGINE");
  assert.equal(decision.fallbackUsed, false);
  assert.equal(decision.principleResult?.evidence?.plannerMode, "PVPOKE_PARITY");
  results.push({ id: fixture.id, category: fixture.family, pass: true });
}

for (const fixture of shieldFixtures) {
  const decision = Intelligence.selectShieldAction({
    ...fixture.input,
    intelligencePolicy: "FAST",
    callerContext: "parity-harness"
  });
  assert.equal(decision.shield, fixture.expected.shield, `${fixture.id}: wouldShield; source ${fixture.source}`);
  assert(decision.principleIds.includes(fixture.expected.principleId));
  assert.equal(decision.finalAuthority, "PRINCIPLE_ENGINE");
  results.push({ id: fixture.id, category: fixture.family, pass: true });
}

const categories = new Set([...actionFixtures, ...shieldFixtures].flatMap(fixture => fixture.categories || []));
for (const category of [
  "availability", "energy", "farm", "immediate-lethal", "protection", "timing",
  "long-match", "bait", "self-debuff", "compact", "farm-down", "effects",
  "forced-throw", "cmp-win", "pending-fast", "shields-up", "shields-down", "shield", "no-shield"
]) {
  assert(categories.has(category), `Parity corpus is missing category ${category}.`);
}
assert(actionFixtures.length >= 100, `Expected at least 100 action states, got ${actionFixtures.length}.`);

console.log(JSON.stringify({
  pvpokeRevision: Fixtures.PVPOKE_REVISION,
  actionStates: actionFixtures.length,
  shieldStates: shieldFixtures.length,
  totalStates: results.length,
  passed: results.filter(result => result.pass).length,
  failed: 0,
  categories: [...categories].sort()
}, null, 2));
