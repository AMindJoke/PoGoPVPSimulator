(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./manual-action.js") : root.PvPeakManualAction
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualSnapshots = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (ManualAction) {
  "use strict";

  const BOUNDARY = Object.freeze({ BEFORE: "BEFORE_EVENT", AFTER: "AFTER_EVENT" });

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function createStore() {
    const snapshots = new Map();

    function capture(eventId, boundary, state, metadata = {}) {
      if (!eventId || !Object.values(BOUNDARY).includes(boundary)) throw new Error("INVALID_SNAPSHOT_BOUNDARY");
      const key = `${eventId}:${boundary}`;
      const snapshot = {
        eventId,
        boundary,
        state: clone(state),
        stateHash: ManualAction.stateHash(state),
        turn: Number(metadata.turn || 0),
        timelineIndex: Number(metadata.timelineIndex || 0),
        createdFrom: metadata.createdFrom || "canonical-resolution"
      };
      snapshots.set(key, snapshot);
      return clone(snapshot);
    }

    function get(eventId, boundary) {
      return clone(snapshots.get(`${eventId}:${boundary}`) || null);
    }

    function clear() {
      snapshots.clear();
    }

    function exportEntries() {
      return [...snapshots.values()].map(clone);
    }

    function importEntries(entries = []) {
      const next = new Map();
      for (const entry of entries) {
        if (!entry?.eventId || !Object.values(BOUNDARY).includes(entry.boundary)) {
          throw new Error("INVALID_SNAPSHOT_ENTRY");
        }
        if (entry.stateHash !== ManualAction.stateHash(entry.state)) throw new Error("STALE_STATE_HASH");
        next.set(`${entry.eventId}:${entry.boundary}`, clone(entry));
      }
      snapshots.clear();
      next.forEach((value, key) => snapshots.set(key, value));
    }

    return Object.freeze({ capture, get, clear, exportEntries, importEntries });
  }

  function eventId(event, index) {
    return event?.timelineEventId || event?.id || `event-${index}`;
  }

  function createRestorePlan(input = {}) {
    const timeline = input.timeline || [];
    const index = timeline.findIndex((event, candidateIndex) => eventId(event, candidateIndex) === input.eventId);
    if (index < 0) throw new Error("INVALID_BRANCH_POINT");
    if (!Object.values(BOUNDARY).includes(input.boundary)) throw new Error("INVALID_SNAPSHOT_BOUNDARY");
    const snapshot = input.store?.get(input.eventId, input.boundary);
    if (!snapshot) throw new Error("SNAPSHOT_NOT_FOUND");
    if (input.expectedStateHash && input.expectedStateHash !== snapshot.stateHash) throw new Error("STALE_STATE_HASH");

    let prefixEnd = input.boundary === BOUNDARY.BEFORE ? index : index + 1;
    if (input.boundary === BOUNDARY.AFTER && timeline[index]?.kind === "charge") {
      while (
        prefixEnd < timeline.length
        && ["shield", "form-protect"].includes(timeline[prefixEnd]?.kind)
        && Number(timeline[prefixEnd]?.chargeIndex) === index
      ) {
        prefixEnd++;
      }
    }
    return {
      eventId: input.eventId,
      boundary: input.boundary,
      eventIndex: index,
      prefixEnd,
      immutablePrefix: clone(timeline.slice(0, prefixEnd)),
      discardedEvents: clone(timeline.slice(prefixEnd)),
      runtimeState: clone(snapshot.state),
      stateHash: snapshot.stateHash,
      turn: snapshot.turn
    };
  }

  function applyStartingShields(runtimeState, shields = {}) {
    const next = clone(runtimeState);
    if (!next) return next;
    const normalized = {
      A: Math.max(0, Math.min(2, Number(shields.A ?? 0))),
      B: Math.max(0, Math.min(2, Number(shields.B ?? 0)))
    };
    if (next.controls) {
      next.controls.p1Shields = String(normalized.A);
      next.controls.p2Shields = String(normalized.B);
    }
    if (next.battle) {
      next.battle.p1Shields = String(normalized.A);
      next.battle.p2Shields = String(normalized.B);
      if (next.battle.left) next.battle.left.shields = normalized.A;
      if (next.battle.right) next.battle.right.shields = normalized.B;
    }
    if (next.left) next.left.shields = normalized.A;
    if (next.right) next.right.shields = normalized.B;
    if (Object.prototype.hasOwnProperty.call(next, "p1Shields")) next.p1Shields = String(normalized.A);
    if (Object.prototype.hasOwnProperty.call(next, "p2Shields")) next.p2Shields = String(normalized.B);
    return next;
  }

  return Object.freeze({ BOUNDARY, createStore, createRestorePlan, applyStartingShields });
});
