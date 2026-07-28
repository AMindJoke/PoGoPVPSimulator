(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./manual-action.js") : root.PvPeakManualAction
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualTimeline = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (ManualAction) {
  "use strict";

  const EDIT_OPERATION = Object.freeze({
    REPLACE: "REPLACE_ACTION",
    DELETE: "DELETE_ACTION",
    INSERT_BEFORE: "INSERT_ACTION_BEFORE",
    INSERT_AFTER: "INSERT_ACTION_AFTER"
  });

  const BOUNDARY = Object.freeze({
    BEFORE: "BEFORE_EVENT",
    AFTER: "AFTER_EVENT"
  });

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function eventIdentity(event, index) {
    return event?.timelineEventId
      || event?.id
      || `timeline-${String(index).padStart(4, "0")}-${ManualAction.stateHash({
        trainer: event?.trainer || null,
        kind: event?.kind || null,
        moveId: event?.move?.id || event?.moveId || null,
        start: Number(event?.start || 0),
        duration: Number(event?.duration || 1)
      }).slice(6)}`;
  }

  function normalizeTimeline(timeline = [], initialState = null) {
    let previousState = clone(initialState);
    return (timeline || []).map((source, index) => {
      const event = clone(source);
      const id = eventIdentity(event, index);
      const stateBefore = clone(previousState);
      const stateAfter = clone(event.state ?? previousState);
      const normalized = {
        ...event,
        id,
        timelineEventId: id,
        timelineIndex: index,
        stateBefore,
        stateAfter,
        stateHashBefore: ManualAction.stateHash(stateBefore),
        stateHashAfter: ManualAction.stateHash(stateAfter)
      };
      previousState = stateAfter;
      return normalized;
    });
  }

  function createModel(input = {}) {
    const initialState = clone(input.initialState || null);
    const events = normalizeTimeline(input.timeline || [], initialState);
    return {
      schemaVersion: 1,
      initialState,
      initialStateHash: ManualAction.stateHash(initialState),
      events,
      terminalResult: clone(input.terminalResult || null),
      revision: Number(input.revision || 0)
    };
  }

  function eventById(model, eventId) {
    return model?.events?.find(event => event.id === eventId) || null;
  }

  function decisionBoundary(model, eventId, boundary = BOUNDARY.BEFORE) {
    const event = eventById(model, eventId);
    if (!event || !Object.values(BOUNDARY).includes(boundary)) return null;
    const before = boundary === BOUNDARY.BEFORE;
    return {
      eventId: event.id,
      eventIndex: event.timelineIndex,
      boundary,
      turn: Number(event.start || 0) + (before ? 0 : Math.max(1, Number(event.duration || 1))),
      state: clone(before ? event.stateBefore : event.stateAfter),
      stateHash: before ? event.stateHashBefore : event.stateHashAfter,
      phase: before
        ? ManualAction.DECISION_PHASE.BEFORE_ACTION_REGISTRATION
        : event.kind === "charge"
          ? ManualAction.DECISION_PHASE.AFTER_CHARGED_RESOLUTION
          : ManualAction.DECISION_PHASE.AFTER_FAST_IMPACT
    };
  }

  function prefixForEdit(model, event, operation) {
    const index = event.timelineIndex;
    const keepThrough = operation === EDIT_OPERATION.INSERT_AFTER ? index : index - 1;
    return model.events.slice(0, Math.max(0, keepThrough + 1)).map(clone);
  }

  function editTimeline(input = {}) {
    const model = input.model;
    const operation = input.operation;
    const event = eventById(model, input.eventId);
    if (!model || !event) throw new Error("INVALID_BRANCH_POINT");
    if (!Object.values(EDIT_OPERATION).includes(operation)) throw new Error("INVALID_EDIT_OPERATION");
    if (typeof input.rebuild !== "function") throw new Error("TIMELINE_REBUILD_REQUIRED");
    const validation = input.validation;
    if (operation !== EDIT_OPERATION.DELETE && !validation?.legal) throw new Error("MANUAL_ACTION_NOT_VALIDATED");

    const boundary = operation === EDIT_OPERATION.INSERT_AFTER ? BOUNDARY.AFTER : BOUNDARY.BEFORE;
    const branchPoint = decisionBoundary(model, event.id, boundary);
    if (input.expectedStateHash && input.expectedStateHash !== branchPoint.stateHash) {
      throw new Error("STALE_STATE_HASH");
    }
    const immutablePrefix = prefixForEdit(model, event, operation);
    const rebuildResult = input.rebuild({
      immutablePrefix: clone(immutablePrefix),
      branchPoint: clone(branchPoint),
      operation,
      targetEvent: clone(event),
      manualAction: clone(input.manualAction || null)
    });
    if (!rebuildResult || !Array.isArray(rebuildResult.timeline)) {
      throw new Error("BRANCH_REBUILD_FAILED");
    }
    const rebuilt = createModel({
      initialState: model.initialState,
      timeline: rebuildResult.timeline,
      terminalResult: rebuildResult.terminalResult || null,
      revision: model.revision + 1
    });
    return {
      model: rebuilt,
      branchPoint,
      removedEvents: model.events.slice(immutablePrefix.length).map(clone),
      immutablePrefixLength: immutablePrefix.length,
      trace: {
        traceState: "BRANCH_REBUILT",
        operation,
        sourceEventId: event.id,
        stateHashBefore: branchPoint.stateHash,
        stateHashAfter: rebuilt.events.at(-1)?.stateHashAfter || rebuilt.initialStateHash,
        removedEventIds: model.events.slice(immutablePrefix.length).map(candidate => candidate.id),
        rebuiltEventIds: rebuilt.events.slice(immutablePrefix.length).map(candidate => candidate.id)
      }
    };
  }

  function firstDivergentEvent(leftModel, rightModel) {
    const left = leftModel?.events || [];
    const right = rightModel?.events || [];
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index++) {
      const a = left[index];
      const b = right[index];
      if (!a || !b) return { index, left: clone(a || null), right: clone(b || null) };
      const signatureA = [a.trainer, a.kind, a.move?.id || a.moveId, a.start, a.duration, a.stateHashAfter];
      const signatureB = [b.trainer, b.kind, b.move?.id || b.moveId, b.start, b.duration, b.stateHashAfter];
      if (JSON.stringify(signatureA) !== JSON.stringify(signatureB)) {
        return { index, left: clone(a), right: clone(b) };
      }
    }
    return null;
  }

  return Object.freeze({
    EDIT_OPERATION,
    BOUNDARY,
    createModel,
    normalizeTimeline,
    eventById,
    decisionBoundary,
    editTimeline,
    firstDivergentEvent
  });
});
