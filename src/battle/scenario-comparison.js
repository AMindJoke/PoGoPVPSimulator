(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakScenarioComparison = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const MODE = "scenario-comparison";
  const BRANCH_SLOTS = Object.freeze(["A", "B"]);
  const BRANCH_BOUNDARIES = new Set(["BATTLE_START", "BEFORE_EVENT", "AFTER_EVENT"]);

  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function canonicalValue(value) {
    if (Array.isArray(value)) return value.map(canonicalValue);
    if (!isRecord(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalValue(value[key])]));
  }

  function stableStringify(value) {
    return JSON.stringify(canonicalValue(value));
  }

  function eventId(event) {
    return event?.timelineEventId || event?.id || null;
  }

  function eventEndTurn(event) {
    const start = Number(event?.start || 0);
    const duration = Math.max(0, Number(event?.duration || 0));
    return start + duration;
  }

  function fullEvents(branch) {
    const events = branch?.timelineModel?.events || branch?.events;
    if (!Array.isArray(events)) throw new Error("COMPARISON_BRANCH_TIMELINE_MISSING");
    return events;
  }

  function commonPrefixLength(first, second) {
    const limit = Math.min(first.length, second.length);
    let index = 0;
    while (index < limit && stableStringify(first[index]) === stableStringify(second[index])) index++;
    return index;
  }

  function normalizedBranch(input, slot, sharedEventCount) {
    const branchId = String(input?.branchId || input?.id || "").trim();
    if (!branchId) throw new Error(`COMPARISON_BRANCH_ID_MISSING:${slot}`);
    return {
      slot,
      branchId,
      sourceBranchId: input.sourceBranchId || input.branchId || null,
      label: String(input.label || `Branch ${slot}`),
      events: clone(fullEvents(input).slice(sharedEventCount)),
      runtimeState: clone(input.runtimeState || null),
      manualModeState: clone(input.manualModeState || null),
      pendingFastEvents: clone(input.pendingFastEvents || []),
      technicalIssue: clone(input.technicalIssue || null),
      terminalResult: clone(input.terminalResult ?? input.timelineModel?.terminalResult ?? null),
      stateHash: input.stateHash || input.timelineModel?.events?.at(-1)?.stateHashAfter || input.timelineModel?.initialStateHash || null,
      edits: clone(input.edits || [])
    };
  }

  function deriveComparison(input = {}) {
    const candidates = input.branches || [input.branchA, input.branchB];
    if (!Array.isArray(candidates) || candidates.length !== 2 || candidates.some(branch => !branch)) {
      throw new Error("COMPARISON_REQUIRES_TWO_BRANCHES");
    }
    const timelines = candidates.map(fullEvents);
    const sharedEventCount = commonPrefixLength(timelines[0], timelines[1]);
    const sharedEvents = clone(timelines[0].slice(0, sharedEventCount));
    const firstInitialState = candidates[0].timelineModel?.initialState ?? input.initialState ?? null;
    const secondInitialState = candidates[1].timelineModel?.initialState ?? input.initialState ?? null;
    if (stableStringify(firstInitialState) !== stableStringify(secondInitialState)) {
      throw new Error("COMPARISON_INITIAL_STATE_MISMATCH");
    }
    const lastShared = sharedEvents.at(-1) || null;
    const suppliedPoint = input.branchPoint || {};
    const comparison = {
      schemaVersion: SCHEMA_VERSION,
      mode: MODE,
      comparisonId: input.comparisonId || null,
      sourceScenarioId: input.sourceScenarioId || null,
      createdAt: input.createdAt || null,
      branchPoint: {
        sharedEventCount,
        eventId: suppliedPoint.eventId ?? eventId(lastShared),
        boundary: suppliedPoint.boundary || (lastShared ? "AFTER_EVENT" : "BATTLE_START"),
        turn: Number(suppliedPoint.turn ?? eventEndTurn(lastShared)),
        stateHash: suppliedPoint.stateHash || lastShared?.stateHashAfter || candidates[0].timelineModel?.initialStateHash || null,
        state: clone(suppliedPoint.state || input.branchPointState || null)
      },
      base: {
        initialState: clone(firstInitialState),
        initialStateHash: candidates[0].timelineModel?.initialStateHash || input.initialStateHash || null,
        events: sharedEvents
      },
      branches: candidates.map((branch, index) => normalizedBranch(branch, BRANCH_SLOTS[index], sharedEventCount))
    };
    const errors = validateComparison(comparison);
    if (errors.length) throw new Error(errors.join(","));
    return clone(comparison);
  }

  function comparisonFromRegistry(registry, input = {}) {
    const branchIds = input.branchIds || [];
    if (!registry?.branches || branchIds.length !== 2) throw new Error("COMPARISON_REQUIRES_TWO_BRANCHES");
    const branches = branchIds.map(branchId => {
      const source = registry.branches[branchId];
      if (!source) throw new Error(`COMPARISON_SOURCE_BRANCH_MISSING:${branchId}`);
      const state = input.branchStates?.[branchId] || {};
      return { ...clone(source), ...clone(state), branchId: source.branchId, sourceBranchId: branchId };
    });
    return deriveComparison({ ...input, branches });
  }

  function branchById(comparison, branchIdOrSlot) {
    return comparison?.branches?.find(branch => branch.branchId === branchIdOrSlot || branch.slot === branchIdOrSlot) || null;
  }

  function materializeTimeline(comparison, branchIdOrSlot) {
    const branch = branchById(comparison, branchIdOrSlot);
    if (!branch) throw new Error("COMPARISON_BRANCH_NOT_FOUND");
    return clone([...(comparison.base?.events || []), ...(branch.events || [])]);
  }

  function materializeTimelineModel(comparison, branchIdOrSlot) {
    const branch = branchById(comparison, branchIdOrSlot);
    if (!branch) throw new Error("COMPARISON_BRANCH_NOT_FOUND");
    return {
      initialState: clone(comparison.base.initialState),
      initialStateHash: comparison.base.initialStateHash || null,
      events: materializeTimeline(comparison, branchIdOrSlot),
      terminalResult: clone(branch.terminalResult)
    };
  }

  function combatantSummary(runtimeState, side) {
    const combatant = side === "B" ? runtimeState?.right : runtimeState?.left;
    return {
      side,
      name: combatant?.p?.name || `Pokemon ${side}`,
      hp: Math.max(0, Number(combatant?.hp || 0)),
      energy: Math.max(0, Number(combatant?.energy || 0)),
      shields: Math.max(0, Number(combatant?.shields || 0)),
      active: Number(combatant?.hp || 0) > 0
    };
  }

  function branchFinalTurn(branch) {
    const turns = branch?.runtimeState?.battleTurns || {};
    const runtimeTurn = Math.max(Number(turns.A || 0), Number(turns.B || 0));
    const eventTurn = (branch?.events || []).reduce((latest, event) => Math.max(
      latest,
      eventEndTurn(event)
    ), 0);
    return Math.max(runtimeTurn, eventTurn);
  }

  function comparisonViewModel(comparison) {
    const errors = validateComparison(comparison);
    if (errors.length) throw new Error(errors.join(","));
    return {
      comparisonId: comparison.comparisonId || null,
      branchPoint: clone(comparison.branchPoint),
      sharedEvents: clone(comparison.base.events),
      branches: comparison.branches.map(branch => {
        const pokemon = {
          A: combatantSummary(branch.runtimeState, "A"),
          B: combatantSummary(branch.runtimeState, "B")
        };
        const winner = branch.terminalResult?.winner;
        const outcome = winner === "tie"
          ? "Draw"
          : ["A", "B"].includes(winner)
            ? `${pokemon[winner].name} wins`
            : "In progress";
        return {
          slot: branch.slot,
          branchId: branch.branchId,
          sourceBranchId: branch.sourceBranchId,
          label: branch.label,
          events: clone(branch.events),
          outcome,
          finalTurn: branchFinalTurn(branch),
          pokemon,
          pokemonRemaining: Object.values(pokemon).filter(candidate => candidate.active).length
        };
      })
    };
  }

  function validateComparison(comparison) {
    const errors = [];
    if (!isRecord(comparison)) return ["INVALID_COMPARISON"];
    if (comparison.schemaVersion !== SCHEMA_VERSION) errors.push("COMPARISON_VERSION_UNSUPPORTED");
    if (comparison.mode !== MODE) errors.push("INVALID_COMPARISON_MODE");
    if (!isRecord(comparison.base)) errors.push("COMPARISON_BASE_MISSING");
    if (!Array.isArray(comparison.base?.events)) errors.push("INVALID_COMPARISON_BASE_EVENTS");
    if (!isRecord(comparison.branchPoint)) errors.push("COMPARISON_BRANCH_POINT_MISSING");
    else {
      if (!Number.isInteger(comparison.branchPoint.sharedEventCount) || comparison.branchPoint.sharedEventCount < 0) errors.push("INVALID_COMPARISON_SHARED_EVENT_COUNT");
      if (comparison.branchPoint.sharedEventCount !== comparison.base?.events?.length) errors.push("COMPARISON_SHARED_EVENT_COUNT_MISMATCH");
      if (!BRANCH_BOUNDARIES.has(comparison.branchPoint.boundary)) errors.push("INVALID_COMPARISON_BOUNDARY");
      if (!Number.isFinite(comparison.branchPoint.turn) || comparison.branchPoint.turn < 0) errors.push("INVALID_COMPARISON_TURN");
      const lastSharedId = eventId(comparison.base?.events?.at(-1));
      if (lastSharedId && comparison.branchPoint.eventId !== lastSharedId) errors.push("COMPARISON_BRANCH_EVENT_MISMATCH");
      if (!lastSharedId && comparison.branchPoint.eventId != null) errors.push("COMPARISON_BRANCH_EVENT_WITHOUT_HISTORY");
    }
    if (!Array.isArray(comparison.branches) || comparison.branches.length !== 2) {
      errors.push("COMPARISON_REQUIRES_TWO_BRANCHES");
    } else {
      const ids = new Set();
      comparison.branches.forEach((branch, index) => {
        const slot = BRANCH_SLOTS[index];
        if (!isRecord(branch)) return errors.push(`INVALID_COMPARISON_BRANCH:${slot}`);
        if (branch.slot !== slot) errors.push(`INVALID_COMPARISON_BRANCH_SLOT:${slot}`);
        if (typeof branch.branchId !== "string" || !branch.branchId) errors.push(`COMPARISON_BRANCH_ID_MISSING:${slot}`);
        else if (ids.has(branch.branchId)) errors.push("COMPARISON_BRANCH_IDS_DUPLICATED");
        else ids.add(branch.branchId);
        if (!Array.isArray(branch.events)) errors.push(`INVALID_COMPARISON_BRANCH_EVENTS:${slot}`);
        if (!Array.isArray(branch.pendingFastEvents)) errors.push(`INVALID_COMPARISON_PENDING_FAST:${slot}`);
        if (!Array.isArray(branch.edits)) errors.push(`INVALID_COMPARISON_EDITS:${slot}`);
      });
    }
    return [...new Set(errors)];
  }

  return Object.freeze({
    SCHEMA_VERSION,
    MODE,
    BRANCH_SLOTS,
    deriveComparison,
    comparisonFromRegistry,
    validateComparison,
    branchById,
    materializeTimeline,
    materializeTimelineModel,
    comparisonViewModel,
    stableStringify
  });
});
