(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakTechnicalReview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ISSUE_TYPES = Object.freeze({
    ONE_TURN_LAG: "one-turn-lag",
    DRE: "dre"
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function createReview() {
    return {
      mode: null,
      selectedEventIndex: null,
      activeBranch: "original",
      sourceState: null,
      originalState: null,
      issueState: null,
      issue: null
    };
  }

  function eventOrdinal(timeline, eventIndex, segmentStart, kind, trainer) {
    if (!Array.isArray(timeline) || eventIndex < segmentStart || !timeline[eventIndex]) return 0;
    let ordinal = 0;
    for (let index = Math.max(0, segmentStart); index <= eventIndex; index++) {
      const event = timeline[index];
      if (event?.kind === kind && event?.trainer === trainer) ordinal++;
    }
    return ordinal;
  }

  function fastImpactTurn(event) {
    if (Number.isFinite(event?.resolveTurn)) return Number(event.resolveTurn);
    return Number(event?.start || 0) + Math.max(1, Number(event?.duration || 1)) - 1;
  }

  function findDreCollision(timeline, chargeIndex, segmentStart = 0) {
    if (!Array.isArray(timeline)) return null;
    const charge = timeline[chargeIndex];
    if (!charge || charge.kind !== "charge" || chargeIndex < segmentStart) return null;
    const defenderSide = charge.trainer;
    const hpAtThrow = Number(charge.state?.[defenderSide]?.hp || 0);
    const candidates = timeline
      .map((event, index) => ({ event, index }))
      .filter(({ event, index }) => (
        index >= segmentStart &&
        index < chargeIndex &&
        event?.kind === "fast" &&
        event.trainer !== defenderSide &&
        fastImpactTurn(event) === Number(charge.start || 0) &&
        Number(event.damage || 0) >= hpAtThrow
      ));
    if (!candidates.length) return null;
    const match = candidates[candidates.length - 1];
    return {
      chargeIndex,
      fastIndex: match.index,
      turn: Number(charge.start || 0),
      chargedSide: defenderSide,
      fastSide: match.event.trainer,
      chargedMoveName: charge.move?.name || "Charged Move",
      fastMoveName: match.event.move?.name || "Fast Move",
      pendingDamage: Number(match.event.damage || 0),
      hpAtThrow
    };
  }

  function createOneTurnLagIssue(timeline, eventIndex, segmentStart = 0) {
    const event = timeline?.[eventIndex];
    if (!event || event.kind !== "fast" || eventIndex < segmentStart) return null;
    return {
      type: ISSUE_TYPES.ONE_TURN_LAG,
      trainer: event.trainer,
      eventIndex,
      actionOrdinal: eventOrdinal(timeline, eventIndex, segmentStart, "fast", event.trainer),
      turn: Number(event.start || 0),
      moveName: event.move?.name || "Fast Move",
      delayTurns: 1
    };
  }

  function createDreIssue(timeline, eventIndex, segmentStart = 0) {
    const collision = findDreCollision(timeline, eventIndex, segmentStart);
    if (!collision) return null;
    return {
      type: ISSUE_TYPES.DRE,
      trainer: collision.chargedSide,
      eventIndex,
      actionOrdinal: eventOrdinal(timeline, eventIndex, segmentStart, "charge", collision.chargedSide),
      ...collision
    };
  }

  function setResult(review, issue, originalState, issueState) {
    review.issue = clone(issue);
    review.selectedEventIndex = issue?.eventIndex ?? null;
    review.sourceState = clone(originalState);
    review.originalState = clone(originalState);
    review.issueState = clone(issueState);
    review.activeBranch = "original";
    review.mode = null;
    return review;
  }

  function clearReview(review) {
    Object.assign(review, createReview());
    return review;
  }

  return {
    ISSUE_TYPES,
    createReview,
    eventOrdinal,
    fastImpactTurn,
    findDreCollision,
    createOneTurnLagIssue,
    createDreIssue,
    setResult,
    clearReview
  };
});
