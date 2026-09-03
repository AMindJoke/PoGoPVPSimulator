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
    const storedEligibleSides = Array.isArray(sourceWindow?.eligibleSides)
      ? [...new Set(sourceWindow.eligibleSides.filter(side => SIDES.includes(side)))]
      : [];
    const eligibleSides = sourceWindow
      ? number(input.version) >= 4 ? storedEligibleSides : [...SIDES]
      : [];
    const chargedAttackActor = SIDES.includes(sourceWindow?.chargedAttackActor)
      ? sourceWindow.chargedAttackActor
      : storedEligibleSides.length === 1
        ? storedEligibleSides[0]
        : null;
    return {
      version: 4,
      canonicalTurn,
      chargedSequenceMs,
      elapsedBattleMs,
      nextSwitchAvailableAtMs: {
        A: Math.max(0, number(input.nextSwitchAvailableAtMs?.A)),
        B: Math.max(0, number(input.nextSwitchAvailableAtMs?.B))
      },
      postChargedSwitchWindow: sourceWindow && eligibleSides.length ? {
        turn: Math.max(0, number(sourceWindow.turn, canonicalTurn)),
        sourceEventId: sourceWindow.sourceEventId || null,
        chargedAttackActor,
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
    const chargedAttackActor = SIDES.includes(input.chargedAttackActor)
      ? input.chargedAttackActor
      : SIDES.includes(input.actorSide)
        ? input.actorSide
        : null;
    next.postChargedSwitchWindow = chargedAttackActor ? {
      turn: Math.max(0, number(input.turn, next.canonicalTurn)),
      sourceEventId: input.sourceEventId || null,
      chargedAttackActor,
      eligibleSides: [...SIDES]
    } : null;
    return next;
  }

  function postChargedSwitchEligible(state, side) {
    if (!SIDES.includes(side)) return false;
    const window = createState(state).postChargedSwitchWindow;
    return window?.eligibleSides.includes(side) === true;
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
