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

  function findDreOpportunity(timeline, energyFastIndex, segmentStart = 0, combatants = {}) {
    if (!Array.isArray(timeline)) return null;
    const energyFast = timeline[energyFastIndex];
    if (!energyFast || energyFast.kind !== "fast" || energyFastIndex < segmentStart) return null;
    const chargedSide = energyFast.trainer;
    const combatant = combatants[chargedSide];
    const energyBefore = Number(energyFast.energyBefore || 0);
    const energyAfter = Number(energyFast.state?.[chargedSide]?.energy ?? (energyBefore + Number(energyFast.move?.energyGain || 0)));
    const newlyReadyMoves = (combatant?.charged || [])
      .filter(Boolean)
      .filter(move => Number(move.energyCost || 0) > energyBefore && Number(move.energyCost || 0) <= energyAfter);
    if (!newlyReadyMoves.length) return null;

    const energyTurn = fastImpactTurn(energyFast);
    const lethal = timeline
      .map((event, index) => ({ event, index }))
      .filter(({ event, index }) => (
        index >= segmentStart &&
        event?.kind === "fast" &&
        event.trainer !== chargedSide &&
        Number(event.state?.[chargedSide]?.hp ?? 1) <= 0 &&
        fastImpactTurn(event) === energyTurn + 1
      ))
      .sort((a, b) => a.index - b.index)[0];
    if (!lethal) return null;
    if (Number(energyFast.state?.[lethal.event.trainer]?.hp ?? 1) <= 0) return null;
    return {
      energyFastIndex,
      lethalFastIndex: lethal.index,
      turn: energyTurn,
      chargedSide,
      fastSide: lethal.event.trainer,
      energyFastName: energyFast.move?.name || "Fast Move",
      lethalFastMoveName: lethal.event.move?.name || "Fast Move",
      pendingDamage: Number(lethal.event.damage || 0),
      energyBefore,
      energyAfter,
      chargedMoveIds: newlyReadyMoves.map(move => move.id),
      chargedMoveNames: newlyReadyMoves.map(move => move.name || move.id)
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

  function createDreIssue(timeline, eventIndex, segmentStart = 0, combatants = {}) {
    const opportunity = findDreOpportunity(timeline, eventIndex, segmentStart, combatants);
    if (!opportunity) return null;
    return {
      type: ISSUE_TYPES.DRE,
      trainer: opportunity.chargedSide,
      eventIndex,
      actionOrdinal: eventOrdinal(timeline, eventIndex, segmentStart, "fast", opportunity.chargedSide),
      lethalFastOrdinal: eventOrdinal(timeline, opportunity.lethalFastIndex, segmentStart, "fast", opportunity.fastSide),
      ...opportunity
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
    findDreOpportunity,
    createOneTurnLagIssue,
    createDreIssue,
    setResult,
    clearReview
  };
});
