(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualMode = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;

  const STATUS = Object.freeze({
    DISABLED: "DISABLED",
    SELECTING_BRANCH_POINT: "SELECTING_BRANCH_POINT",
    PAUSED_AT_DECISION: "PAUSED_AT_DECISION",
    AWAITING_ACTION: "AWAITING_ACTION",
    AWAITING_SHIELD_DECISION: "AWAITING_SHIELD_DECISION",
    RESOLVING: "RESOLVING",
    REPLAYING: "REPLAYING",
    TERMINAL: "TERMINAL",
    ERROR: "ERROR"
  });

  const CONTROL_MODE = Object.freeze({
    BOTH_MANUAL: "BOTH_MANUAL",
    PLAYER_A_MANUAL: "PLAYER_A_MANUAL",
    PLAYER_B_MANUAL: "PLAYER_B_MANUAL",
    EDIT_SINGLE_ACTION: "EDIT_SINGLE_ACTION",
    MANUAL_UNTIL_RELEASED: "MANUAL_UNTIL_RELEASED"
  });

  const LEGALITY_MODE = Object.freeze({
    STRICT: "STRICT_LEGAL",
    REVIEW_OVERRIDE: "REVIEW_OVERRIDE"
  });

  const CURSOR_MODE = Object.freeze({
    VIEW: "VIEW_CURSOR",
    EDIT: "EDIT_CURSOR",
    LIVE: "LIVE_DECISION"
  });

  const AUTO_POLICY = Object.freeze({
    MANUAL: "MANUAL",
    PVPOKE_PARITY: "PVPOKE_PARITY"
  });

  const VALID_TRANSITIONS = Object.freeze({
    [STATUS.DISABLED]: new Set([STATUS.SELECTING_BRANCH_POINT]),
    [STATUS.SELECTING_BRANCH_POINT]: new Set([
      STATUS.PAUSED_AT_DECISION,
      STATUS.AWAITING_ACTION,
      STATUS.AWAITING_SHIELD_DECISION,
      STATUS.TERMINAL,
      STATUS.DISABLED,
      STATUS.ERROR
    ]),
    [STATUS.PAUSED_AT_DECISION]: new Set([
      STATUS.AWAITING_ACTION,
      STATUS.AWAITING_SHIELD_DECISION,
      STATUS.REPLAYING,
      STATUS.DISABLED,
      STATUS.ERROR
    ]),
    [STATUS.AWAITING_ACTION]: new Set([
      STATUS.RESOLVING,
      STATUS.REPLAYING,
      STATUS.DISABLED,
      STATUS.ERROR
    ]),
    [STATUS.AWAITING_SHIELD_DECISION]: new Set([
      STATUS.RESOLVING,
      STATUS.DISABLED,
      STATUS.ERROR
    ]),
    [STATUS.RESOLVING]: new Set([
      STATUS.PAUSED_AT_DECISION,
      STATUS.AWAITING_ACTION,
      STATUS.AWAITING_SHIELD_DECISION,
      STATUS.TERMINAL,
      STATUS.ERROR
    ]),
    [STATUS.REPLAYING]: new Set([
      STATUS.PAUSED_AT_DECISION,
      STATUS.AWAITING_ACTION,
      STATUS.TERMINAL,
      STATUS.DISABLED,
      STATUS.ERROR
    ]),
    [STATUS.TERMINAL]: new Set([
      STATUS.REPLAYING,
      STATUS.SELECTING_BRANCH_POINT,
      STATUS.DISABLED,
      STATUS.ERROR
    ]),
    [STATUS.ERROR]: new Set([
      STATUS.SELECTING_BRANCH_POINT,
      STATUS.DISABLED
    ])
  });

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function normalizedSide(side) {
    return side === "A" || side === "B" ? side : null;
  }

  function controlledSidesForMode(controlMode) {
    switch (controlMode) {
      case CONTROL_MODE.PLAYER_A_MANUAL:
        return ["A"];
      case CONTROL_MODE.PLAYER_B_MANUAL:
        return ["B"];
      default:
        return ["A", "B"];
    }
  }

  function autoPolicyFor(controlledSides, supplied = {}) {
    const automaticPolicy = side => supplied[side] && supplied[side] !== AUTO_POLICY.MANUAL
      ? supplied[side]
      : AUTO_POLICY.PVPOKE_PARITY;
    return {
      A: controlledSides.includes("A") ? AUTO_POLICY.MANUAL : automaticPolicy("A"),
      B: controlledSides.includes("B") ? AUTO_POLICY.MANUAL : automaticPolicy("B")
    };
  }

  function createState(options = {}) {
    const controlMode = Object.values(CONTROL_MODE).includes(options.controlMode)
      ? options.controlMode
      : CONTROL_MODE.BOTH_MANUAL;
    const controlledSides = controlledSidesForMode(controlMode);
    return {
      schemaVersion: SCHEMA_VERSION,
      enabled: false,
      status: STATUS.DISABLED,
      controlMode,
      controlledSides,
      branchId: null,
      parentBranchId: null,
      branchTurn: null,
      branchEventId: null,
      cursorTurn: 0,
      cursorEventId: null,
      cursorMode: CURSOR_MODE.VIEW,
      selectedSide: normalizedSide(options.selectedSide) || controlledSides[0],
      pendingDecision: null,
      history: [],
      redoStack: [],
      originalTimeline: clone(options.originalTimeline || []),
      activeTimeline: clone(options.originalTimeline || []),
      originalTerminalResult: clone(options.originalTerminalResult || null),
      activeTerminalResult: clone(options.originalTerminalResult || null),
      autoPolicyBySide: autoPolicyFor(controlledSides, options.autoPolicyBySide),
      legalityMode: Object.values(LEGALITY_MODE).includes(options.legalityMode)
        ? options.legalityMode
        : LEGALITY_MODE.STRICT,
      plannerPaused: false,
      error: null,
      revision: 0
    };
  }

  function revise(state, patch) {
    return {
      ...state,
      ...clone(patch),
      revision: Number(state.revision || 0) + 1
    };
  }

  function transition(state, nextStatus, patch = {}) {
    if (!state || !Object.values(STATUS).includes(nextStatus)) {
      throw new Error("INVALID_MANUAL_MODE_STATUS");
    }
    if (state.status === nextStatus) return revise(state, patch);
    if (!VALID_TRANSITIONS[state.status]?.has(nextStatus)) {
      throw new Error(`INVALID_MANUAL_MODE_TRANSITION:${state.status}->${nextStatus}`);
    }
    return revise(state, { ...patch, status: nextStatus });
  }

  function enable(state, options = {}) {
    if (!state || state.enabled) return state;
    const originalTimeline = clone(options.originalTimeline ?? state.originalTimeline ?? []);
    return transition(state, STATUS.SELECTING_BRANCH_POINT, {
      enabled: true,
      plannerPaused: true,
      cursorMode: CURSOR_MODE.EDIT,
      originalTimeline,
      activeTimeline: clone(originalTimeline),
      originalTerminalResult: clone(options.originalTerminalResult ?? state.originalTerminalResult),
      activeTerminalResult: clone(options.originalTerminalResult ?? state.originalTerminalResult),
      pendingDecision: null,
      error: null
    });
  }

  function disable(state) {
    if (!state || state.status === STATUS.DISABLED) return state;
    return transition(state, STATUS.DISABLED, {
      enabled: false,
      plannerPaused: false,
      cursorMode: CURSOR_MODE.VIEW,
      pendingDecision: null,
      selectedSide: null,
      error: null
    });
  }

  function selectBranchPoint(state, point = {}) {
    if (!state?.enabled || state.status !== STATUS.SELECTING_BRANCH_POINT) {
      throw new Error("MANUAL_MODE_NOT_SELECTING_BRANCH_POINT");
    }
    const turn = Number(point.turn);
    if (!Number.isFinite(turn) || turn < 0 || !point.stateHash) {
      throw new Error("INVALID_BRANCH_POINT");
    }
    const terminal = !!point.terminal;
    const shieldDecision = point.phase === "SHIELD_DECISION";
    const status = terminal
      ? STATUS.TERMINAL
      : shieldDecision
        ? STATUS.AWAITING_SHIELD_DECISION
        : STATUS.AWAITING_ACTION;
    return transition(state, status, {
      branchId: point.branchId || "MANUAL-1",
      parentBranchId: point.parentBranchId || "AUTO-ORIGINAL",
      branchTurn: turn,
      branchEventId: point.eventId || null,
      cursorTurn: turn,
      cursorEventId: point.eventId || null,
      cursorMode: terminal ? CURSOR_MODE.EDIT : CURSOR_MODE.LIVE,
      pendingDecision: clone(point.decisionPoint || null),
      activeTerminalResult: terminal ? clone(point.terminalResult || state.activeTerminalResult) : null,
      plannerPaused: true,
      error: null
    });
  }

  function setControlMode(state, controlMode) {
    if (!Object.values(CONTROL_MODE).includes(controlMode)) throw new Error("INVALID_CONTROL_MODE");
    const controlledSides = controlledSidesForMode(controlMode);
    const selectedSide = controlledSides.includes(state.selectedSide)
      ? state.selectedSide
      : controlledSides[0];
    return revise(state, {
      controlMode,
      controlledSides,
      selectedSide,
      autoPolicyBySide: autoPolicyFor(controlledSides, state.autoPolicyBySide)
    });
  }

  function setLegalityMode(state, legalityMode) {
    if (!Object.values(LEGALITY_MODE).includes(legalityMode)) throw new Error("INVALID_LEGALITY_MODE");
    return revise(state, { legalityMode });
  }

  function setSelectedSide(state, side) {
    const selectedSide = normalizedSide(side);
    if (!selectedSide || !state.controlledSides.includes(selectedSide)) {
      throw new Error("SIDE_NOT_MANUALLY_CONTROLLED");
    }
    return revise(state, { selectedSide });
  }

  function setCursor(state, cursor = {}) {
    const cursorMode = Object.values(CURSOR_MODE).includes(cursor.mode) ? cursor.mode : state.cursorMode;
    const cursorTurn = Number(cursor.turn);
    if (!Number.isFinite(cursorTurn) || cursorTurn < 0) throw new Error("INVALID_CURSOR");
    return revise(state, {
      cursorTurn,
      cursorEventId: cursor.eventId || null,
      cursorMode
    });
  }

  function setPendingDecision(state, decision, status = STATUS.AWAITING_ACTION) {
    if (![STATUS.PAUSED_AT_DECISION, STATUS.AWAITING_ACTION, STATUS.AWAITING_SHIELD_DECISION].includes(status)) {
      throw new Error("INVALID_PENDING_DECISION_STATUS");
    }
    return transition(state, status, {
      pendingDecision: clone(decision || null),
      cursorMode: CURSOR_MODE.LIVE,
      plannerPaused: true
    });
  }

  function beginResolution(state) {
    return transition(state, STATUS.RESOLVING, { plannerPaused: true, error: null });
  }

  function completeResolution(state, result = {}) {
    const nextStatus = result.terminal
      ? STATUS.TERMINAL
      : result.pendingDecision?.phase === "SHIELD_DECISION"
        ? STATUS.AWAITING_SHIELD_DECISION
        : STATUS.AWAITING_ACTION;
    return transition(state, nextStatus, {
      activeTimeline: clone(result.timeline ?? state.activeTimeline),
      activeTerminalResult: clone(result.terminalResult || null),
      pendingDecision: clone(result.pendingDecision || null),
      cursorTurn: Number.isFinite(Number(result.cursorTurn)) ? Number(result.cursorTurn) : state.cursorTurn,
      cursorEventId: result.cursorEventId || null,
      cursorMode: nextStatus === STATUS.TERMINAL ? CURSOR_MODE.EDIT : CURSOR_MODE.LIVE,
      plannerPaused: true,
      error: null
    });
  }

  function fail(state, error) {
    return transition(state, STATUS.ERROR, {
      plannerPaused: true,
      pendingDecision: null,
      error: clone(error || { code: "UNKNOWN_MANUAL_MODE_ERROR" })
    });
  }

  function validateState(state) {
    const errors = [];
    if (!state || state.schemaVersion !== SCHEMA_VERSION) errors.push("INVALID_SCHEMA_VERSION");
    if (!Object.values(STATUS).includes(state?.status)) errors.push("INVALID_STATUS");
    if (!Object.values(CONTROL_MODE).includes(state?.controlMode)) errors.push("INVALID_CONTROL_MODE");
    if (!Object.values(LEGALITY_MODE).includes(state?.legalityMode)) errors.push("INVALID_LEGALITY_MODE");
    if (!Object.values(CURSOR_MODE).includes(state?.cursorMode)) errors.push("INVALID_CURSOR_MODE");
    if (state?.enabled !== (state?.status !== STATUS.DISABLED)) errors.push("ENABLED_STATUS_MISMATCH");
    if (!Array.isArray(state?.controlledSides) || !state.controlledSides.length) errors.push("MISSING_CONTROLLED_SIDES");
    if (state?.selectedSide && !state.controlledSides.includes(state.selectedSide)) errors.push("INVALID_SELECTED_SIDE");
    if (state?.enabled && !state.plannerPaused) errors.push("MANUAL_PLANNER_NOT_PAUSED");
    if (!Array.isArray(state?.originalTimeline) || !Array.isArray(state?.activeTimeline)) errors.push("INVALID_TIMELINE");
    if (!Array.isArray(state?.history) || !Array.isArray(state?.redoStack)) errors.push("INVALID_HISTORY");
    if (!Number.isInteger(state?.revision) || state.revision < 0) errors.push("INVALID_REVISION");
    return errors;
  }

  return Object.freeze({
    SCHEMA_VERSION,
    STATUS,
    CONTROL_MODE,
    LEGALITY_MODE,
    CURSOR_MODE,
    AUTO_POLICY,
    createState,
    controlledSidesForMode,
    transition,
    enable,
    disable,
    selectBranchPoint,
    setControlMode,
    setLegalityMode,
    setSelectedSide,
    setCursor,
    setPendingDecision,
    beginResolution,
    completeResolution,
    fail,
    validateState
  });
});
