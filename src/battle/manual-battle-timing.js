(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualBattleTiming = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TURN_DURATION_MS = 500;
  const SWITCH_COOLDOWN_MS = 45000;
  // Deterministic elapsed time for the complete Charged Attack sequence.
  // Shield choice is contained in this window; it does not add a second delay.
  const CHARGED_SEQUENCE_MS = 10000;
  const SIDES = Object.freeze(["A", "B"]);

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function createState(input = {}) {
    const canonicalTurn = Math.max(0, number(input.canonicalTurn));
    const chargedSequenceMs = Math.max(0, number(input.chargedSequenceMs));
    const elapsedBattleMs = Math.max(
      canonicalTurn * TURN_DURATION_MS + chargedSequenceMs,
      number(input.elapsedBattleMs)
    );
    const sourceWindow = input.postChargedSwitchWindow;
    const eligibleSides = Array.isArray(sourceWindow?.eligibleSides)
      ? sourceWindow.eligibleSides.filter(side => SIDES.includes(side))
      : [];
    return {
      version: 2,
      canonicalTurn,
      chargedSequenceMs,
      elapsedBattleMs,
      nextSwitchAvailableAtMs: {
        A: Math.max(0, number(input.nextSwitchAvailableAtMs?.A)),
        B: Math.max(0, number(input.nextSwitchAvailableAtMs?.B))
      },
      postChargedSwitchWindow: eligibleSides.length ? {
        turn: Math.max(0, number(sourceWindow.turn, canonicalTurn)),
        sourceEventId: sourceWindow.sourceEventId || null,
        eligibleSides
      } : null
    };
  }

  function advanceToTurn(state, turn) {
    const next = createState(state);
    next.canonicalTurn = Math.max(next.canonicalTurn, number(turn));
    next.elapsedBattleMs = next.canonicalTurn * TURN_DURATION_MS + next.chargedSequenceMs;
    return next;
  }

  function addChargedSequence(state, count = 1) {
    const next = createState(state);
    next.chargedSequenceMs += Math.max(0, number(count)) * CHARGED_SEQUENCE_MS;
    next.elapsedBattleMs = next.canonicalTurn * TURN_DURATION_MS + next.chargedSequenceMs;
    return next;
  }

  function startSwitchCooldown(state, side) {
    if (!SIDES.includes(side)) throw new Error("INVALID_SWITCH_SIDE");
    const next = createState(state);
    next.nextSwitchAvailableAtMs[side] = next.elapsedBattleMs + SWITCH_COOLDOWN_MS;
    return next;
  }

  function remainingSwitchMs(state, side) {
    if (!SIDES.includes(side)) return Infinity;
    const normalized = createState(state);
    return Math.max(0, normalized.nextSwitchAvailableAtMs[side] - normalized.elapsedBattleMs);
  }

  function canSwitch(state, side) {
    return remainingSwitchMs(state, side) === 0;
  }

  function openPostChargedSwitchWindow(state, input = {}) {
    const next = createState(state);
    const eligibleSides = (Array.isArray(input.eligibleSides) ? input.eligibleSides : SIDES)
      .filter(side => SIDES.includes(side));
    next.postChargedSwitchWindow = eligibleSides.length ? {
      turn: Math.max(0, number(input.turn, next.canonicalTurn)),
      sourceEventId: input.sourceEventId || null,
      eligibleSides: [...new Set(eligibleSides)]
    } : null;
    return next;
  }

  function postChargedSwitchEligible(state, side) {
    if (!SIDES.includes(side)) return false;
    return createState(state).postChargedSwitchWindow?.eligibleSides.includes(side) === true;
  }

  function consumePostChargedSwitch(state, side) {
    const next = createState(state);
    if (!next.postChargedSwitchWindow || !SIDES.includes(side)) return next;
    next.postChargedSwitchWindow.eligibleSides = next.postChargedSwitchWindow.eligibleSides
      .filter(candidate => candidate !== side);
    if (!next.postChargedSwitchWindow.eligibleSides.length) next.postChargedSwitchWindow = null;
    return next;
  }

  function closePostChargedSwitchWindow(state) {
    const next = createState(state);
    next.postChargedSwitchWindow = null;
    return next;
  }

  function formatSeconds(milliseconds) {
    const seconds = Math.max(0, number(milliseconds)) / 1000;
    return `${seconds.toFixed(seconds % 1 ? 1 : 0)}s`;
  }

  return Object.freeze({
    TURN_DURATION_MS,
    SWITCH_COOLDOWN_MS,
    CHARGED_SEQUENCE_MS,
    createState,
    advanceToTurn,
    addChargedSequence,
    startSwitchCooldown,
    remainingSwitchMs,
    canSwitch,
    openPostChargedSwitchWindow,
    postChargedSwitchEligible,
    consumePostChargedSwitch,
    closePostChargedSwitchWindow,
    formatSeconds
  });
});
