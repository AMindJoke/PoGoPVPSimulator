"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Hybrid = require("../src/battle/hybrid-battle-intelligence");

const ROOT = path.resolve(__dirname, "..");
const fixtureCatalog = JSON.parse(fs.readFileSync(
  path.join(ROOT, "data", "hybrid-battle-intelligence", "principles.json"),
  "utf8"
));

function move(id, input = {}) {
  return {
    id,
    turns: 1,
    energyGain: 0,
    energyCost: 0,
    damage: 0,
    ...input
  };
}

function action(type, value) {
  return {
    type,
    side: "A",
    moveId: value.id,
    move: value
  };
}

function battle(overrides = {}) {
  const fast = move("FAST", { turns: 1, energyGain: 10, damage: 3 });
  const cheap = move("CHEAP", { energyCost: 35, damage: 10 });
  const nuke = move("NUKE", { energyCost: 50, damage: 25 });
  const opponentFast = move("OPPONENT_FAST", { turns: 2, energyGain: 8, damage: 5 });
  const actor = {
    hp: 50,
    maxHp: 50,
    energy: 40,
    shields: 0,
    readyTurn: 0,
    attackStage: 0,
    defenseStage: 0,
    fastMove: fast,
    chargedMoves: [cheap, nuke],
    ...(overrides.actor || {})
  };
  const opponent = {
    hp: 20,
    maxHp: 20,
    energy: 0,
    shields: 0,
    readyTurn: 0,
    attackStage: 0,
    defenseStage: 0,
    fastMove: opponentFast,
    chargedMoves: [move("OPPONENT_CHARGE", { energyCost: 50, damage: 30 })],
    ...(overrides.opponent || {})
  };
  return {
    policy: "STANDARD",
    actorSide: "A",
    opponentSide: "B",
    currentTurn: 0,
    actor,
    opponent,
    defender: opponent,
    legalActions: [
      action("fast_move", actor.fastMove),
      ...actor.chargedMoves.filter(candidate => actor.energy >= candidate.energyCost)
        .map(candidate => action("charged_move", candidate))
    ],
    pendingEvents: [],
    damage(side, candidate, stages = {}) {
      const base = Number(candidate.damage || 0);
      const stage = side === "actor"
        ? Number(stages.actorAttackStage || 0)
        : Number(stages.defenderAttackStage || 0);
      return Math.max(0, base + stage * Math.max(1, Math.floor(base / 2)));
    },
    willShield(candidate, state) {
      return Number(state?.shields ?? state?.defenderShields ?? opponent.shields) > 0;
    },
    turnsToFaint: 10,
    cmpAdvantage: 1,
    baitPolicy: "SELECTIVE",
    ...Object.fromEntries(Object.entries(overrides).filter(([key]) => !["actor", "opponent"].includes(key)))
  };
}

function assertAction(result, type, moveId = null) {
  assert(result?.action, "Expected a selected action.");
  assert.strictEqual(result.action.type, type);
  if (moveId) assert.strictEqual(result.action.moveId, moveId);
}

assert.strictEqual(fixtureCatalog.schemaVersion, 1);
assert.strictEqual(fixtureCatalog.fixtures.length, 20);
assert.strictEqual(new Set(fixtureCatalog.fixtures.map(item => item.id)).size, 20);
for (const fixture of fixtureCatalog.fixtures) {
  for (const field of [
    "principle",
    "initialState",
    "legalLine",
    "expectedBehavior",
    "acceptableAlternatives",
    "forbiddenBehavior",
    "expectedOutcomeClass",
    "timelineInvariants",
    "performanceBudgetMs"
  ]) assert(Object.prototype.hasOwnProperty.call(fixture, field), `${fixture.id} missing ${field}.`);
}

assert.strictEqual(Hybrid.normalizeBaitPolicy("off"), "OFF");
assert.strictEqual(Hybrid.normalizeBaitPolicy("selective"), "SELECTIVE");
assert.strictEqual(Hybrid.normalizeBaitPolicy("on"), "ALWAYS");

const win = Hybrid.createOutcomeVector({ outcome: "win" });
const draw = Hybrid.createOutcomeVector({ outcome: "draw", remainingHp: 9999 });
const loss = Hybrid.createOutcomeVector({ outcome: "loss", remainingHp: 999999 });
assert(Hybrid.compareOutcomeVectors(win, draw) < 0, "Win must outrank draw.");
assert(Hybrid.compareOutcomeVectors(draw, loss) < 0, "Draw must outrank loss.");
assert(Hybrid.compareOutcomeVectors(win, loss) < 0, "Resources must not invert outcome class.");

const stranded = Hybrid.actionableEnergy({
  energy: 31,
  fastMove: move("FAST", { energyGain: 5, turns: 2 }),
  chargedMoves: [move("CHARGE", { energyCost: 35 })]
}, { fastsBeforeFaint: 0 });
assert.strictEqual(stranded.actionableEnergy, 0);
assert.strictEqual(stranded.strandedEnergy, 31);

const reachable = Hybrid.actionableEnergy({
  energy: 31,
  fastMove: move("FAST", { energyGain: 5, turns: 2 }),
  chargedMoves: [move("CHARGE", { energyCost: 35 })]
}, { fastsBeforeFaint: 1 });
assert.strictEqual(reachable.actionableEnergy, 31);
assert.strictEqual(reachable.strandedEnergy, 0);
assert.strictEqual(reachable.nextChargedFastCount, 1);

const safeTimingInput = battle({
  actor: { energy: 30, hp: 100 },
  opponent: { hp: 100, readyTurn: 0, fastMove: move("SLOW", { turns: 3, energyGain: 5, damage: 4 }) }
});
const safeTiming = Hybrid.evaluateTiming(safeTimingInput);
assert.strictEqual(safeTiming.safeToWait, true);
assert.strictEqual(safeTiming.recommendedFastCount, 1);
assert(safeTiming.reasonCodes.includes("SAFE_EXTRA_FAST"));

const unsafeTiming = Hybrid.evaluateTiming(battle({ actor: { hp: 5 } }));
assert.strictEqual(unsafeTiming.safeToWait, false);
assert.strictEqual(unsafeTiming.faintsWhileWaiting, true);

const capTiming = Hybrid.evaluateTiming(battle({ actor: { energy: 95 } }));
assert.strictEqual(capTiming.safeToWait, false);
assert.strictEqual(capTiming.energyOverflow, true);
assert(capTiming.reasonCodes.includes("ENERGY_CAP_FORCES_THROW"));

const pendingTiming = Hybrid.evaluateTiming(battle({
  opponent: { hp: 5 },
  pendingEvents: [{
    id: "pending",
    status: "pending",
    sourceSide: "A",
    targetSide: "B",
    resolveTurn: 1,
    damage: 5
  }]
}));
assert.strictEqual(pendingTiming.pendingFastLethal, true);

const fastOnly = battle({ actor: { energy: 0 } });
fastOnly.legalActions = [action("fast_move", fastOnly.actor.fastMove)];
assertAction(Hybrid.selectAction(fastOnly), "fast_move", "FAST");

const lethal = battle({ opponent: { hp: 9 } });
assertAction(Hybrid.selectAction(lethal), "charged_move", "CHEAP");

const forcedThrow = battle({ actor: { hp: 5 } });
assertAction(Hybrid.selectAction(forcedThrow), "charged_move");

const capThrow = battle({ actor: { energy: 95 }, opponent: { hp: 100, maxHp: 100 } });
capThrow.legalActions = [
  action("fast_move", capThrow.actor.fastMove),
  ...capThrow.actor.chargedMoves.map(candidate => action("charged_move", candidate))
];
const capDecision = Hybrid.selectAction(capThrow);
assertAction(capDecision, "charged_move");
assert(capDecision.reasonCodes.includes("ENERGY_CAP_FORCES_THROW"));

const farm = battle({
  actor: {
    energy: 35,
    fastMove: move("FARM_FAST", { energyGain: 5, turns: 1, damage: 4 }),
    chargedMoves: [move("WEAK_CHARGE", { energyCost: 35, damage: 1 })]
  },
  opponent: { hp: 7 },
  turnsToFaint: 10
});
farm.legalActions = [
  action("fast_move", farm.actor.fastMove),
  action("charged_move", farm.actor.chargedMoves[0])
];
const farmPlan = Hybrid.planOffensiveRoutes(farm);
assert.strictEqual(farmPlan.bestRoute.routeType, "farm-down");
assert.strictEqual(farmPlan.bestRoute.firstAction.type, "fast_move");

const cheapPlan = Hybrid.planOffensiveRoutes(battle());
assert.strictEqual(cheapPlan.bestRoute.firstAction.moveId, "CHEAP");
assert(cheapPlan.nodes <= Hybrid.DEFAULT_BUDGETS.STANDARD.maxStates);

const buffBattle = battle({
  actor: {
    energy: 35,
    fastMove: move("BUFF_FAST", { energyGain: 10, turns: 1, damage: 1 }),
    chargedMoves: [
      move("BUFF", { energyCost: 35, damage: 1, buffApplyChance: 1, buffs: [1, 0], buffTarget: "self" }),
      move("PLAIN", { energyCost: 35, damage: 7 })
    ]
  },
  opponent: { hp: 13 },
  turnsToFaint: 12
});
const buffPlan = Hybrid.planOffensiveRoutes(buffBattle);
assert.strictEqual(buffPlan.bestRoute.firstAction.moveId, "BUFF");

const debuffBattle = battle({
  actor: {
    energy: 90,
    fastMove: move("DEBUFF_FAST", { energyGain: 10, turns: 1, damage: 1 }),
    chargedMoves: [
      move("SELF_DEBUFF_NUKE", {
        energyCost: 45,
        damage: 20,
        buffApplyChance: 1,
        buffs: [-1, 0],
        buffTarget: "self"
      })
    ]
  },
  opponent: { hp: 30 },
  turnsToFaint: 4
});
const debuffPlan = Hybrid.planOffensiveRoutes(debuffBattle);
assert.deepStrictEqual(
  debuffPlan.bestRoute.sequence.slice(0, 2).map(step => step.moveId),
  ["SELF_DEBUFF_NUKE", "SELF_DEBUFF_NUKE"]
);

const ambiguous = Hybrid.detectAmbiguity([
  {
    firstAction: { type: "fast_move", moveId: "FAST" },
    outcome: Hybrid.createOutcomeVector({ outcome: "win" }),
    chargedCount: 2,
    defenderShieldsRemaining: 0,
    cmpBoundary: false,
    turn: 5,
    actionableEnergy: 0,
    complete: true
  },
  {
    firstAction: { type: "charged_move", moveId: "CHARGE" },
    outcome: Hybrid.createOutcomeVector({ outcome: "loss" }),
    chargedCount: 1,
    defenderShieldsRemaining: 1,
    cmpBoundary: true,
    turn: 6,
    actionableEnergy: 20,
    complete: true
  }
]);
assert.strictEqual(ambiguous.ambiguous, true);
assert(ambiguous.reasonCodes.includes("OUTCOME_CLASS_DIFFERS"));
assert(ambiguous.reasonCodes.includes("CMP_BOUNDARY_DIFFERS"));

const cmpBase = battle({
  actor: {
    energy: 35,
    fastMove: move("CMP_FAST", { energyGain: 1, turns: 1, damage: 0 }),
    chargedMoves: [move("CMP_CHARGE", { energyCost: 35, damage: 100 })]
  },
  opponent: { hp: 50 },
  turnsToFaint: 1
});
const cmpWin = Hybrid.planOffensiveRoutes({ ...cmpBase, cmpAdvantage: 1 });
const cmpDraw = Hybrid.planOffensiveRoutes({ ...cmpBase, cmpAdvantage: 0 });
const cmpLoss = Hybrid.planOffensiveRoutes({ ...cmpBase, cmpAdvantage: -1 });
assert.strictEqual(cmpWin.bestRoute.outcome.outcomeClass, "win");
assert.strictEqual(cmpDraw.bestRoute.outcome.outcomeClass, "draw");
assert.strictEqual(cmpLoss.bestRoute.outcome.outcomeClass, "loss");

const mismatched = Hybrid.evaluateTiming(battle({
  actor: { fastMove: move("TWO_TURN", { turns: 2, energyGain: 8, damage: 2 }) },
  opponent: { fastMove: move("FOUR_TURN", { turns: 4, energyGain: 12, damage: 5 }) }
}));
assert.strictEqual(typeof mismatched.concedeFastMove, "boolean");
assert.strictEqual(typeof mismatched.denyFastMove, "boolean");
assert(Number.isFinite(mismatched.actorReadyTurn));
assert(Number.isFinite(mismatched.opponentReadyTurn));

Hybrid.clearCache();
const cachedInput = battle({ cacheKey: "deterministic-cache-fixture" });
const firstCachedPlan = Hybrid.planOffensiveRoutes(cachedInput);
const secondCachedPlan = Hybrid.planOffensiveRoutes(cachedInput);
assert.deepStrictEqual(secondCachedPlan.bestRoute, firstCachedPlan.bestRoute);
assert(Hybrid.getStatistics().cacheHits >= 1);

const tinyBudget = Hybrid.planOffensiveRoutes({
  ...battle(),
  budget: { maxStates: 1, timeBudgetMs: 100, maxTurns: 100 }
});
assert.strictEqual(tinyBudget.complete, false);
assert.strictEqual(tinyBudget.horizonReason, "state-budget");

const source = fs.readFileSync(path.join(ROOT, "src", "battle", "hybrid-battle-intelligence.js"), "utf8");
for (const speciesId of ["quagsire", "corsola", "melmetal", "cresselia"]) {
  assert.strictEqual(source.toLowerCase().includes(speciesId), false, `Production hybrid policy contains ${speciesId}.`);
}

console.log("Hybrid Battle Intelligence principle tests passed.");
console.log(`Validated ${fixtureCatalog.fixtures.length} strategy fixtures, bounded routes, timing, CMP, farming, effects, energy, and outcome ordering.`);
