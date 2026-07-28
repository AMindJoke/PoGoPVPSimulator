(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualAction = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ACTION_TYPE = Object.freeze({
    FAST_MOVE: "FAST_MOVE",
    CHARGED_MOVE: "CHARGED_MOVE",
    SHIELD: "SHIELD",
    NO_SHIELD: "NO_SHIELD",
    WAIT: "WAIT",
    RESUME_AUTO: "RESUME_AUTO",
    INSERT_LAG: "INSERT_LAG",
    INSERT_DRE: "INSERT_DRE",
    REMOVE_EVENT: "REMOVE_EVENT",
    REPLACE_EVENT: "REPLACE_EVENT"
  });

  const INSERTION_POLICY = Object.freeze({
    NOW: "NOW",
    NEXT_LEGAL_TURN: "NEXT_LEGAL_TURN",
    BEFORE_EVENT: "BEFORE_EVENT",
    AFTER_EVENT: "AFTER_EVENT"
  });

  const LEGALITY_MODE = Object.freeze({
    STRICT: "STRICT_LEGAL",
    REVIEW_OVERRIDE: "REVIEW_OVERRIDE"
  });

  const DECISION_PHASE = Object.freeze({
    BEFORE_ACTION_REGISTRATION: "BEFORE_ACTION_REGISTRATION",
    AFTER_ACTION_REGISTRATION: "AFTER_ACTION_REGISTRATION",
    BEFORE_FAST_IMPACT: "BEFORE_FAST_IMPACT",
    AFTER_FAST_IMPACT: "AFTER_FAST_IMPACT",
    BEFORE_CHARGED_RESOLUTION: "BEFORE_CHARGED_RESOLUTION",
    SHIELD_DECISION: "SHIELD_DECISION",
    AFTER_CHARGED_RESOLUTION: "AFTER_CHARGED_RESOLUTION",
    TERMINAL_PENDING: "TERMINAL_PENDING",
    TERMINAL_FINAL: "TERMINAL_FINAL"
  });

  const REASON_CODE = Object.freeze({
    OK: "OK",
    INVALID_ACTION: "INVALID_ACTION",
    INVALID_SIDE: "INVALID_SIDE",
    NOT_READY: "NOT_READY",
    INSUFFICIENT_ENERGY: "INSUFFICIENT_ENERGY",
    FAINTED_ACTOR: "FAINTED_ACTOR",
    TERMINAL_STATE: "TERMINAL_STATE",
    SHIELD_DECISION_PENDING: "SHIELD_DECISION_PENDING",
    ILLEGAL_PHASE: "ILLEGAL_PHASE",
    CMP_PENDING: "CMP_PENDING",
    STALE_STATE_HASH: "STALE_STATE_HASH",
    UNSUPPORTED_RECONSTRUCTION: "UNSUPPORTED_RECONSTRUCTION",
    MOVE_NOT_AVAILABLE: "MOVE_NOT_AVAILABLE",
    NO_SHIELDS_REMAINING: "NO_SHIELDS_REMAINING",
    WAIT_NOT_LEGAL: "WAIT_NOT_LEGAL",
    MISSING_TARGET_EVENT: "MISSING_TARGET_EVENT"
  });

  const RECONSTRUCTION_ACTIONS = new Set([
    ACTION_TYPE.INSERT_LAG,
    ACTION_TYPE.INSERT_DRE,
    ACTION_TYPE.REMOVE_EVENT,
    ACTION_TYPE.REPLACE_EVENT
  ]);

  const SHIELD_ACTIONS = new Set([ACTION_TYPE.SHIELD, ACTION_TYPE.NO_SHIELD]);
  const BATTLE_ACTIONS = new Set([ACTION_TYPE.FAST_MOVE, ACTION_TYPE.CHARGED_MOVE, ACTION_TYPE.WAIT]);

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === "object") {
      return Object.keys(value).sort().reduce((result, key) => {
        if (value[key] !== undefined) result[key] = stableValue(value[key]);
        return result;
      }, {});
    }
    return value;
  }

  function stateHash(value) {
    const input = JSON.stringify(stableValue(value));
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index++) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }

  function createManualAction(input = {}) {
    const side = input.side === "A" || input.side === "B" ? input.side : null;
    const actionType = Object.values(ACTION_TYPE).includes(input.actionType) ? input.actionType : null;
    const requestedAtTurn = Math.max(0, Number(input.requestedAtTurn || 0));
    const insertionPolicy = Object.values(INSERTION_POLICY).includes(input.insertionPolicy)
      ? input.insertionPolicy
      : INSERTION_POLICY.NOW;
    const legalityMode = Object.values(LEGALITY_MODE).includes(input.legalityMode)
      ? input.legalityMode
      : LEGALITY_MODE.STRICT;
    const identity = [
      side || "?",
      actionType || "INVALID",
      input.moveId || "-",
      requestedAtTurn,
      input.requestedAtEventId || "-",
      Number(input.sequence || 0)
    ].join(":");
    return {
      id: input.id || `manual-${stateHash(identity).slice(6)}`,
      source: "manual-mode",
      side,
      actionType,
      moveId: input.moveId || null,
      requestedAtTurn,
      requestedAtEventId: input.requestedAtEventId || null,
      insertionPolicy,
      legalityMode,
      metadata: clone(input.metadata || {})
    };
  }

  function sideState(state, side) {
    return state?.sides?.[side] || null;
  }

  function terminalState(state, decisionPoint) {
    if ([DECISION_PHASE.TERMINAL_PENDING, DECISION_PHASE.TERMINAL_FINAL].includes(decisionPoint?.phase)) return true;
    const a = Number(sideState(state, "A")?.hp || 0);
    const b = Number(sideState(state, "B")?.hp || 0);
    return a <= 0 || b <= 0;
  }

  function actionKind(actionType) {
    if (actionType === ACTION_TYPE.FAST_MOVE) return "fast";
    if (actionType === ACTION_TYPE.CHARGED_MOVE) return "charged";
    if (actionType === ACTION_TYPE.WAIT) return "wait";
    return null;
  }

  function earliestReadyTurn(actor, state) {
    return Math.max(Number(state?.currentTurn || 0), Number(actor?.readyTurn || 0));
  }

  function result(manualAction, values = {}) {
    return {
      legal: false,
      normalizedAction: clone(manualAction),
      reasonCode: REASON_CODE.INVALID_ACTION,
      warnings: [],
      earliestLegalTurn: null,
      requiredEnergy: null,
      actualEnergy: null,
      blockingCooldown: null,
      pendingDecisionType: null,
      ...values
    };
  }

  function validateManualAction(input = {}) {
    const state = input.state || null;
    const manualAction = createManualAction(input.manualAction || {});
    const side = input.side || manualAction.side;
    const actor = sideState(state, side);
    const decisionPoint = input.decisionPoint || null;
    const legalActions = Array.isArray(input.legalActions) ? input.legalActions : [];
    const legalityMode = input.legalityMode || manualAction.legalityMode || LEGALITY_MODE.STRICT;
    const currentHash = input.stateHash || decisionPoint?.stateHash || stateHash(state);

    if (!manualAction.actionType) return result(manualAction);
    if (!side || !actor) return result(manualAction, { reasonCode: REASON_CODE.INVALID_SIDE });
    manualAction.side = side;

    if (manualAction.metadata?.expectedStateHash && manualAction.metadata.expectedStateHash !== currentHash) {
      return result(manualAction, { reasonCode: REASON_CODE.STALE_STATE_HASH });
    }

    if (RECONSTRUCTION_ACTIONS.has(manualAction.actionType)) {
      if (legalityMode !== LEGALITY_MODE.REVIEW_OVERRIDE) {
        return result(manualAction, { reasonCode: REASON_CODE.UNSUPPORTED_RECONSTRUCTION });
      }
      if (
        [ACTION_TYPE.REMOVE_EVENT, ACTION_TYPE.REPLACE_EVENT].includes(manualAction.actionType)
        && !manualAction.requestedAtEventId
      ) {
        return result(manualAction, { reasonCode: REASON_CODE.MISSING_TARGET_EVENT });
      }
      return result(manualAction, {
        legal: true,
        reasonCode: REASON_CODE.OK,
        warnings: ["REVIEW_RECONSTRUCTION", "NON_CANONICAL_BRANCH"],
        pendingDecisionType: "REVIEW_RECONSTRUCTION"
      });
    }

    if (manualAction.actionType === ACTION_TYPE.RESUME_AUTO) {
      return result(manualAction, { legal: true, reasonCode: REASON_CODE.OK });
    }

    if (terminalState(state, decisionPoint)) {
      return result(manualAction, { reasonCode: REASON_CODE.TERMINAL_STATE });
    }
    if (Number(actor.hp || 0) <= 0) {
      return result(manualAction, { reasonCode: REASON_CODE.FAINTED_ACTOR });
    }

    const shieldPending = decisionPoint?.phase === DECISION_PHASE.SHIELD_DECISION || !!decisionPoint?.shieldDecision;
    if (shieldPending && !SHIELD_ACTIONS.has(manualAction.actionType)) {
      return result(manualAction, {
        reasonCode: REASON_CODE.SHIELD_DECISION_PENDING,
        pendingDecisionType: "SHIELD_DECISION"
      });
    }
    if (SHIELD_ACTIONS.has(manualAction.actionType)) {
      if (!shieldPending || decisionPoint?.shieldDecision?.defenderSide !== side) {
        return result(manualAction, { reasonCode: REASON_CODE.ILLEGAL_PHASE });
      }
      if (manualAction.actionType === ACTION_TYPE.SHIELD && Number(actor.shields || 0) <= 0) {
        return result(manualAction, { reasonCode: REASON_CODE.NO_SHIELDS_REMAINING });
      }
      return result(manualAction, {
        legal: true,
        reasonCode: REASON_CODE.OK,
        pendingDecisionType: "SHIELD_DECISION"
      });
    }

    if (!BATTLE_ACTIONS.has(manualAction.actionType)) {
      return result(manualAction);
    }
    if (
      decisionPoint
      && decisionPoint.phase !== DECISION_PHASE.BEFORE_ACTION_REGISTRATION
      && decisionPoint.phase !== DECISION_PHASE.AFTER_FAST_IMPACT
      && decisionPoint.phase !== DECISION_PHASE.AFTER_CHARGED_RESOLUTION
    ) {
      return result(manualAction, { reasonCode: REASON_CODE.ILLEGAL_PHASE });
    }

    if (manualAction.actionType === ACTION_TYPE.WAIT) {
      const waitIsLegal = legalActions.some(action => action.type === "wait")
        || decisionPoint?.legalWaitSides?.includes(side);
      return result(manualAction, {
        legal: !!waitIsLegal,
        reasonCode: waitIsLegal ? REASON_CODE.OK : REASON_CODE.WAIT_NOT_LEGAL,
        earliestLegalTurn: waitIsLegal ? Number(state.currentTurn || 0) : null
      });
    }

    const kind = actionKind(manualAction.actionType);
    const move = kind === "fast"
      ? actor.fastMove
      : (actor.chargedMoves || []).find(candidate => candidate?.id === manualAction.moveId);
    if (!move || (manualAction.moveId && move.id !== manualAction.moveId)) {
      return result(manualAction, { reasonCode: REASON_CODE.MOVE_NOT_AVAILABLE });
    }
    manualAction.moveId = move.id || manualAction.moveId;

    const exactLegalAction = legalActions.find(action =>
      action.type === kind
      && (!manualAction.moveId || action.moveId === manualAction.moveId)
    );
    if (exactLegalAction) {
      return result(manualAction, {
        legal: true,
        reasonCode: REASON_CODE.OK,
        earliestLegalTurn: Number(state.currentTurn || 0),
        requiredEnergy: kind === "charged" ? Number(move.energyCost || 0) : null,
        actualEnergy: kind === "charged" ? Number(actor.energy || 0) : null
      });
    }

    const readyTurn = earliestReadyTurn(actor, state);
    if (readyTurn > Number(state.currentTurn || 0)) {
      return result(manualAction, {
        reasonCode: REASON_CODE.NOT_READY,
        earliestLegalTurn: readyTurn,
        blockingCooldown: readyTurn - Number(state.currentTurn || 0)
      });
    }

    if (kind === "charged" && Number(actor.energy || 0) < Number(move.energyCost || 0)) {
      const canBuild = manualAction.insertionPolicy === INSERTION_POLICY.NEXT_LEGAL_TURN
        && Number(actor.fastMove?.energyGain || 0) > 0;
      return result(manualAction, {
        legal: canBuild,
        reasonCode: canBuild ? REASON_CODE.OK : REASON_CODE.INSUFFICIENT_ENERGY,
        warnings: canBuild ? ["PLANNED_ACTION_REVALIDATE_AFTER_EACH_FAST"] : [],
        earliestLegalTurn: null,
        requiredEnergy: Number(move.energyCost || 0),
        actualEnergy: Number(actor.energy || 0),
        pendingDecisionType: canBuild ? "BUILD_TO_CHARGED" : null
      });
    }

    return result(manualAction, {
      reasonCode: REASON_CODE.NOT_READY,
      earliestLegalTurn: readyTurn
    });
  }

  function createDecisionPoint(input = {}) {
    const turn = Math.max(0, Number(input.turn ?? input.state?.currentTurn ?? 0));
    const phase = Object.values(DECISION_PHASE).includes(input.phase)
      ? input.phase
      : DECISION_PHASE.BEFORE_ACTION_REGISTRATION;
    const legalActionsBySide = {
      A: clone(input.legalActionsBySide?.A || []),
      B: clone(input.legalActionsBySide?.B || [])
    };
    return {
      turn,
      eventId: input.eventId || null,
      phase,
      readySides: clone(input.readySides || ["A", "B"].filter(side => legalActionsBySide[side].length)),
      activeSide: input.activeSide === "A" || input.activeSide === "B" ? input.activeSide : null,
      legalActionsBySide,
      legalWaitSides: clone(input.legalWaitSides || []),
      shieldDecision: clone(input.shieldDecision || null),
      pendingEvents: clone(input.pendingEvents || input.state?.pendingEvents || []),
      stateHash: input.stateHash || stateHash(input.state || null)
    };
  }

  return Object.freeze({
    ACTION_TYPE,
    INSERTION_POLICY,
    LEGALITY_MODE,
    DECISION_PHASE,
    REASON_CODE,
    createManualAction,
    createDecisionPoint,
    validateManualAction,
    stateHash
  });
});
