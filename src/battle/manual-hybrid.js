(function (root, factory) {
  const turnEngine = typeof module === "object" && module.exports
    ? require("./turn-resolution-engine.js")
    : root?.PvPeakTurnEngine;
  const api = factory(turnEngine);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualHybrid = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (TurnEngine) {
  "use strict";

  const STATUS = Object.freeze({
    BLOCKED: "BLOCKED",
    TERMINAL: "TERMINAL",
    AWAITING_MANUAL: "AWAITING_MANUAL",
    AWAITING_AUTOMATIC_INTENT: "AWAITING_AUTOMATIC_INTENT",
    MANUAL_REGISTERED: "MANUAL_REGISTERED",
    AUTO_ADVANCE: "AUTO_ADVANCE",
    JOINT_REGISTERED: "JOINT_REGISTERED"
  });

  const BLOCK_REASON = Object.freeze({
    SHIELD_DECISION: "SHIELD_DECISION",
    RESOLVING: "RESOLVING",
    INVALID_STATE: "INVALID_STATE"
  });

  function oppositeSide(sideId) {
    return sideId === "A" ? "B" : "A";
  }

  function normalizedControlledSides(controlledSides = []) {
    return [...new Set(controlledSides)].filter(sideId => sideId === "A" || sideId === "B");
  }

  function intentSide(intent) {
    return intent?.sideId || intent?.side || null;
  }

  function classifyCollision(registrations) {
    if (registrations.length !== 2) return null;
    const types = registrations.map(item => item.type);
    if (types.every(type => type === "charged")) return "CHARGED_VS_CHARGED";
    if (types.every(type => type === "fast")) return "FAST_VS_FAST";
    if (types.includes("charged") && types.includes("fast")) return "CHARGED_VS_FAST";
    return null;
  }

  function cmpMetadata(turnState, registrations) {
    if (classifyCollision(registrations) !== "CHARGED_VS_CHARGED") return null;
    const winnerSide = registrations[0].sideId;
    const loserSide = registrations[1].sideId;
    return {
      winnerSide,
      loserSide,
      winnerAttack: Number(turnState.sides[winnerSide].attack || 0),
      loserAttack: Number(turnState.sides[loserSide].attack || 0),
      tiedAttack: Number(turnState.sides[winnerSide].attack || 0)
        === Number(turnState.sides[loserSide].attack || 0)
    };
  }

  function result(status, details = {}) {
    return {
      status,
      blocked: status === STATUS.BLOCKED,
      registrations: [],
      collision: null,
      cmp: null,
      ...details
    };
  }

  function coordinateDecision(options = {}) {
    if (!TurnEngine || !options.turnState) {
      return result(STATUS.BLOCKED, { reason: BLOCK_REASON.INVALID_STATE });
    }
    if (options.pendingDecision?.phase === "SHIELD_DECISION") {
      return result(STATUS.BLOCKED, { reason: BLOCK_REASON.SHIELD_DECISION });
    }
    if (options.resolving) {
      return result(STATUS.BLOCKED, { reason: BLOCK_REASON.RESOLVING });
    }

    const turnState = TurnEngine.createState(options.turnState);
    const outcome = TurnEngine.terminalOutcome(turnState);
    if (outcome.ended) return result(STATUS.TERMINAL, { outcome });

    const controlledSides = normalizedControlledSides(options.controlledSides);
    const readySides = TurnEngine.readySides(turnState);
    const readyManualSides = readySides.filter(sideId => controlledSides.includes(sideId));
    const readyAutomaticSides = readySides.filter(sideId => !controlledSides.includes(sideId));
    const suppliedManual = (options.manualIntents || (options.manualIntent ? [options.manualIntent] : []))
      .filter(intent => readyManualSides.includes(intentSide(intent)));
    const suppliedAutomatic = (options.automaticIntents || (options.automaticIntent ? [options.automaticIntent] : []))
      .filter(intent => readyAutomaticSides.includes(intentSide(intent)));
    const invalidSuppliedIntent = [...suppliedManual, ...suppliedAutomatic].find(intent =>
      !TurnEngine.normalizeActionIntent(turnState, intent)
    );
    if (invalidSuppliedIntent) {
      return result(STATUS.BLOCKED, {
        reason: BLOCK_REASON.INVALID_STATE,
        invalidIntent: invalidSuppliedIntent,
        readySides,
        readyManualSides,
        readyAutomaticSides
      });
    }

    const missingManualSides = readyManualSides.filter(sideId =>
      !suppliedManual.some(intent => intentSide(intent) === sideId)
    );
    if (missingManualSides.length) {
      return result(STATUS.AWAITING_MANUAL, {
        readySides,
        readyManualSides,
        readyAutomaticSides,
        missingManualSides
      });
    }

    const missingAutomaticSides = readyAutomaticSides.filter(sideId =>
      !suppliedAutomatic.some(intent => intentSide(intent) === sideId)
    );
    if (missingAutomaticSides.length) {
      return result(STATUS.AWAITING_AUTOMATIC_INTENT, {
        readySides,
        readyManualSides,
        readyAutomaticSides,
        missingAutomaticSides
      });
    }

    const registrations = TurnEngine.registerActionIntents(
      turnState,
      [...suppliedManual, ...suppliedAutomatic]
    );
    if (!registrations.length) {
      return result(STATUS.BLOCKED, {
        reason: BLOCK_REASON.INVALID_STATE,
        readySides,
        readyManualSides,
        readyAutomaticSides
      });
    }

    const manualRegistrations = registrations.filter(item => controlledSides.includes(item.sideId));
    const automaticRegistrations = registrations.filter(item => !controlledSides.includes(item.sideId));
    const status = manualRegistrations.length && automaticRegistrations.length
      ? STATUS.JOINT_REGISTERED
      : manualRegistrations.length
        ? STATUS.MANUAL_REGISTERED
        : STATUS.AUTO_ADVANCE;
    return result(status, {
      readySides,
      readyManualSides,
      readyAutomaticSides,
      registrations,
      manualRegistrations,
      automaticRegistrations,
      collision: classifyCollision(registrations),
      cmp: cmpMetadata(turnState, registrations)
    });
  }

  return Object.freeze({
    STATUS,
    BLOCK_REASON,
    oppositeSide,
    coordinateDecision
  });
});
