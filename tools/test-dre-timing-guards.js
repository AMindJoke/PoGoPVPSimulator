"use strict";

const assert = require("assert");
const Engine = require("../src/battle/turn-resolution-engine");
const Intelligence = require("../src/battle/battle-intelligence");

function select(ownTurns, oppTurns, cooldown) {
  const state = Engine.createState({ currentTurn: 10, sides: {
    A: { id: "actor", hp: 100, maxHp: 100, energy: 40, shields: 1, attack: 120, readyTurn: 10,
      fastMove: { id: "FAST_A", turns: ownTurns, energyGain: 7, damage: 4 },
      chargedMoves: [{ id: "CHARGE", energyCost: 35, damage: 90 }] },
    B: { id: "opponent", hp: 80, maxHp: 100, energy: 0, shields: 1, attack: 110, readyTurn: 10 + cooldown,
      fastMove: { id: "FAST_B", turns: oppTurns, energyGain: 7, damage: 4 }, chargedMoves: [] }
  } });
  state.sides.A.shields = state.sides.B.shields = 1;
  return Intelligence.selectAction({ state, side: "A", plannerMode: "CANONICAL",
    legalActions: Engine.getLegalActions(state, "A"), context: {
      dreStandard: true, estimateDamage: action => action.move?.damage || 0,
      estimateFastDamage: () => 4, willOpponentShield: () => true
    }
  });
}

for (const [own, opponent, cooldown] of [[2, 2, 0], [5, 2, 1]]) {
  const decision = select(own, opponent, cooldown);
  assert.strictEqual(decision.action.type, "charged_move", "An opponent shield must not manufacture a lethal close or a timing gain.");
  assert.strictEqual(decision.principleResult.evidence.timing.dreClosingOpportunity, false);
  assert.strictEqual(decision.principleResult.evidence.timing.shieldedChargedWasteOpportunity, false);
}
assert.strictEqual(select(2, 5, 5).action.type, "fast_move", "Preserve real timing opportunities against longer Fast moves.");
console.log("DRE timing guard tests passed.");
