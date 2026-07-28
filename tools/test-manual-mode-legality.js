"use strict";

const assert = require("node:assert/strict");
const Turn = require("../src/battle/turn-resolution-engine.js");
const Manual = require("../src/battle/manual-action.js");

function battleState(overrides = {}) {
  return Turn.createState({
    currentTurn: 4,
    sides: {
      A: {
        id: "A",
        hp: 100,
        energy: 45,
        attack: 120,
        readyTurn: 4,
        shields: 1,
        fastMove: { id: "MUD_SHOT", energyGain: 9, turns: 2 },
        chargedMoves: [
          { id: "AQUA_TAIL", energyCost: 35 },
          { id: "MUD_BOMB", energyCost: 45 }
        ]
      },
      B: {
        id: "B",
        hp: 100,
        energy: 40,
        attack: 110,
        readyTurn: 4,
        shields: 1,
        fastMove: { id: "ASTONISH", energyGain: 9, turns: 3 },
        chargedMoves: [{ id: "NIGHT_SHADE", energyCost: 55 }]
      }
    },
    ...overrides
  });
}

function richState(overrides = {}) {
  const state = battleState(overrides);
  state.sides.A.shields = overrides.aShields ?? 1;
  state.sides.B.shields = overrides.bShields ?? 1;
  return state;
}

function validate(state, side, action, decisionPoint = null) {
  return Manual.validateManualAction({
    state,
    side,
    manualAction: action,
    decisionPoint: decisionPoint || Manual.createDecisionPoint({
      state,
      legalActionsBySide: {
        A: Turn.getLegalActions(state, "A"),
        B: Turn.getLegalActions(state, "B")
      }
    }),
    legalActions: Turn.getLegalActions(state, side)
  });
}

const state = richState();
const decision = Manual.createDecisionPoint({
  state,
  legalActionsBySide: {
    A: Turn.getLegalActions(state, "A"),
    B: Turn.getLegalActions(state, "B")
  }
});
assert.equal(decision.phase, Manual.DECISION_PHASE.BEFORE_ACTION_REGISTRATION);
assert.deepEqual(decision.readySides, ["A", "B"]);
assert.match(decision.stateHash, /^fnv1a-/);
assert.equal(Manual.stateHash({ b: 2, a: 1 }), Manual.stateHash({ a: 1, b: 2 }));

const fast = Manual.createManualAction({
  side: "A",
  actionType: Manual.ACTION_TYPE.FAST_MOVE,
  moveId: "MUD_SHOT",
  requestedAtTurn: 4
});
assert.equal(fast.source, "manual-mode");
assert.equal(validate(state, "A", fast).legal, true);

const charged = validate(state, "A", {
  side: "A",
  actionType: Manual.ACTION_TYPE.CHARGED_MOVE,
  moveId: "MUD_BOMB",
  requestedAtTurn: 4
});
assert.equal(charged.legal, true);
assert.equal(charged.requiredEnergy, 45);
assert.equal(charged.actualEnergy, 45);

const unavailable = validate(state, "A", {
  side: "A",
  actionType: Manual.ACTION_TYPE.CHARGED_MOVE,
  moveId: "SURF"
});
assert.equal(unavailable.reasonCode, Manual.REASON_CODE.MOVE_NOT_AVAILABLE);

const lowEnergy = richState();
lowEnergy.sides.A.energy = 10;
const rejectedBuild = validate(lowEnergy, "A", {
  side: "A",
  actionType: Manual.ACTION_TYPE.CHARGED_MOVE,
  moveId: "MUD_BOMB"
});
assert.equal(rejectedBuild.legal, false);
assert.equal(rejectedBuild.reasonCode, Manual.REASON_CODE.INSUFFICIENT_ENERGY);

const plannedBuild = validate(lowEnergy, "A", {
  side: "A",
  actionType: Manual.ACTION_TYPE.CHARGED_MOVE,
  moveId: "MUD_BOMB",
  insertionPolicy: Manual.INSERTION_POLICY.NEXT_LEGAL_TURN
});
assert.equal(plannedBuild.legal, true);
assert.equal(plannedBuild.pendingDecisionType, "BUILD_TO_CHARGED");
assert(plannedBuild.warnings.includes("PLANNED_ACTION_REVALIDATE_AFTER_EACH_FAST"));

const cooldownState = richState();
cooldownState.sides.A.readyTurn = 7;
const cooldown = validate(cooldownState, "A", fast);
assert.equal(cooldown.reasonCode, Manual.REASON_CODE.NOT_READY);
assert.equal(cooldown.earliestLegalTurn, 7);
assert.equal(cooldown.blockingCooldown, 3);

const shieldDecision = Manual.createDecisionPoint({
  state,
  phase: Manual.DECISION_PHASE.SHIELD_DECISION,
  shieldDecision: { attackerSide: "B", defenderSide: "A", moveId: "NIGHT_SHADE" }
});
const blockedFast = validate(state, "A", fast, shieldDecision);
assert.equal(blockedFast.reasonCode, Manual.REASON_CODE.SHIELD_DECISION_PENDING);

const shield = validate(state, "A", {
  side: "A",
  actionType: Manual.ACTION_TYPE.SHIELD
}, shieldDecision);
assert.equal(shield.legal, true);

const noShield = validate(state, "A", {
  side: "A",
  actionType: Manual.ACTION_TYPE.NO_SHIELD
}, shieldDecision);
assert.equal(noShield.legal, true);

const noShieldResource = richState({ aShields: 0 });
const noShieldResourceDecision = Manual.createDecisionPoint({
  state: noShieldResource,
  phase: Manual.DECISION_PHASE.SHIELD_DECISION,
  shieldDecision: { attackerSide: "B", defenderSide: "A" }
});
const impossibleShield = validate(noShieldResource, "A", {
  side: "A",
  actionType: Manual.ACTION_TYPE.SHIELD
}, noShieldResourceDecision);
assert.equal(impossibleShield.reasonCode, Manual.REASON_CODE.NO_SHIELDS_REMAINING);

const illegalWait = validate(state, "A", { side: "A", actionType: Manual.ACTION_TYPE.WAIT });
assert.equal(illegalWait.reasonCode, Manual.REASON_CODE.WAIT_NOT_LEGAL);
const waitDecision = Manual.createDecisionPoint({
  state,
  legalActionsBySide: { A: Turn.getLegalActions(state, "A"), B: [] },
  legalWaitSides: ["A"]
});
assert.equal(validate(state, "A", { side: "A", actionType: Manual.ACTION_TYPE.WAIT }, waitDecision).legal, true);

const strictLag = validate(state, "A", {
  side: "A",
  actionType: Manual.ACTION_TYPE.INSERT_LAG
});
assert.equal(strictLag.reasonCode, Manual.REASON_CODE.UNSUPPORTED_RECONSTRUCTION);

const overrideLag = Manual.validateManualAction({
  state,
  side: "A",
  manualAction: {
    side: "A",
    actionType: Manual.ACTION_TYPE.INSERT_LAG,
    legalityMode: Manual.LEGALITY_MODE.REVIEW_OVERRIDE
  },
  legalityMode: Manual.LEGALITY_MODE.REVIEW_OVERRIDE,
  decisionPoint: decision,
  legalActions: Turn.getLegalActions(state, "A")
});
assert.equal(overrideLag.legal, true);
assert(overrideLag.warnings.includes("NON_CANONICAL_BRANCH"));

const stale = validate(state, "A", {
  side: "A",
  actionType: Manual.ACTION_TYPE.FAST_MOVE,
  moveId: "MUD_SHOT",
  metadata: { expectedStateHash: "fnv1a-stale" }
});
assert.equal(stale.reasonCode, Manual.REASON_CODE.STALE_STATE_HASH);

const terminalState = richState();
terminalState.sides.B.hp = 0;
const terminal = validate(terminalState, "A", fast);
assert.equal(terminal.reasonCode, Manual.REASON_CODE.TERMINAL_STATE);

console.log("Manual Mode legality tests passed.");
