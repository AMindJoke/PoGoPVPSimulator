"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const TurnEngine = require("../src/battle/turn-resolution-engine");
const Intelligence = require("../src/battle/battle-intelligence");

const state = TurnEngine.createState({
  currentTurn: 5,
  sides: {
    A: {
      id: "runtime-actor",
      hp: 120,
      maxHp: 120,
      energy: 70,
      shields: 1,
      attack: 125,
      defense: 120,
      readyTurn: 5,
      fastMove: { id: "FAST_A", turns: 2, energyGain: 8, damage: 4 },
      chargedMoves: [
        { id: "CHEAP", energyCost: 35, damage: 55 },
        { id: "NUKE", energyCost: 60, damage: 90 }
      ],
      baiting: "off",
      shieldMode: "smart"
    },
    B: {
      id: "runtime-opponent",
      hp: 100,
      maxHp: 100,
      energy: 0,
      shields: 0,
      attack: 100,
      defense: 120,
      readyTurn: 7,
      fastMove: { id: "FAST_B", turns: 3, energyGain: 8, damage: 6 },
      chargedMoves: [{ id: "REPLY", energyCost: 35, damage: 60 }],
      baiting: "off",
      shieldMode: "smart"
    }
  }
});
state.sides.A.baiting = "off";
state.sides.B.baiting = "off";
const legalActions = TurnEngine.getLegalActions(state, "A");
const decisions = [];

for (const callerContext of ["battle", "matrix", "offline", "scenario-review"]) {
  Intelligence.clearCache();
  const decision = Intelligence.selectAction({
    state,
    side: "A",
    legalActions,
    policy: callerContext === "scenario-review" ? "DEEP_REVIEW" : "FAST",
    plannerMode: "CANONICAL",
    context: {
      callerContext,
      chargedTimingOptimization: false,
      estimateDamage: action => Number(action.move?.damage || 0),
      estimateFastDamage: side => Number(side === "actor" ? 4 : 6),
      estimateOpponentDamage: move => Number(move?.damage || 0),
      compactDamage: (_side, move) => Number(move?.damage || 0),
      willOpponentShield: () => false
    }
  });
  decisions.push({
    callerContext,
    action: { type: decision.action.type, moveId: decision.action.moveId },
    intent: decision.principleResult.intent,
    principlesTriggered: decision.principlesTriggered,
    finalAuthority: decision.finalAuthority,
    fallbackUsed: decision.fallbackUsed,
    plannerMode: decision.plannerMode
  });
}

const canonical = decisions[0];
for (const decision of decisions.slice(1)) {
  assert.deepEqual(decision.action, canonical.action, `${decision.callerContext} action differs from live battle.`);
  assert.equal(decision.intent, canonical.intent, `${decision.callerContext} intent differs from live battle.`);
  assert.deepEqual(decision.principlesTriggered, canonical.principlesTriggered, `${decision.callerContext} principles differ from live battle.`);
  assert.equal(decision.finalAuthority, "PRINCIPLE_ENGINE");
  assert.equal(decision.fallbackUsed, false);
  assert.equal(decision.plannerMode, "CANONICAL");
}

const html = fs.readFileSync(path.resolve(__dirname, "..", "PogoPvp.html"), "utf8");
assert(html.includes("const PvPeakBattleIntelligence = (${window.createPvPeakBattleIntelligenceApi.toString()})();"));
assert(html.includes('plannerMode: "CANONICAL"'));
assert(!html.includes("battleIntelligenceCandidateEvidence,"));

console.log(JSON.stringify({
  contexts: decisions.map(decision => decision.callerContext),
  action: canonical.action,
  intent: canonical.intent,
  plannerMode: canonical.plannerMode,
  workerUsesSameFactory: true,
  liveMatrixOfflineScenarioParity: true
}, null, 2));
