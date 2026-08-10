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
  const EVENT_DIFFERENCE = Object.freeze({
    SHARED: "shared",
    ONLY_A: "only-a",
    ONLY_B: "only-b"
  });

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

  function semanticEventValue(event = {}) {
    return {
      kind: event.kind || null,
      trainer: event.trainer || null,
      start: Number(event.start || 0),
      duration: Math.max(0, Number(event.duration || 0)),
      move: event.move ? {
        id: event.move.id || null,
        name: event.move.name || null,
        type: event.move.type || null,
        energyCost: Number(event.move.energyCost || 0)
      } : null,
      damage: Number(event.damage || 0),
      unshieldedDamage: Number(event.unshieldedDamage || 0),
      absorbedDamage: Number(event.absorbedDamage || 0),
      hpBefore: Number(event.hpBefore || 0),
      hpAfter: Number(event.hpAfter || 0),
      energyBefore: Number(event.energyBefore || 0),
      energyAfter: Number(event.energyAfter || 0),
      shielded: !!event.shielded,
      faintedSide: event.faintedSide || null,
      issueType: event.issueType || null,
      drePending: !!event.drePending,
      dreResolved: !!event.dreResolved,
      dreDenied: !!event.dreDenied,
      technicalLagPending: !!event.technicalLagPending,
      technicalLagResolved: !!event.technicalLagResolved,
      technicalLagDenied: !!event.technicalLagDenied,
      fastImpactStatus: event.fastImpactStatus || null,
      pendingFastEventId: event.pendingFastEventId ? "pending-fast" : null,
      replacementPokemonId: event.replacementPokemonId || event.pokemonId || null,
      technicalDetails: event.kind?.startsWith("technical-") ? {
        label: event.label || null,
        chargedMoveId: event.details?.chargedMoveId || null,
        pendingFastMoveName: event.details?.pendingFastMoveName || null
      } : null,
      judgeEdit: event.kind === "judge-state-edit"
        ? clone(event.changes || event.edit || { field: event.field || null, value: event.value ?? null })
        : null
    };
  }

  function semanticEventKey(event) {
    return stableStringify(semanticEventValue(event));
  }

  function semanticEventAlignment(eventsA = [], eventsB = []) {
    const keysA = eventsA.map(semanticEventKey);
    const positionsB = new Map();
    eventsB.forEach((event, index) => {
      const key = semanticEventKey(event);
      const positions = positionsB.get(key) || [];
      positions.push(index);
      positionsB.set(key, positions);
    });
    const matchedA = new Set();
    const matchedB = new Set();
    let bCursor = 0;
    keysA.forEach((key, indexA) => {
      const positions = positionsB.get(key) || [];
      const indexB = positions.find(candidate => candidate >= bCursor);
      if (indexB == null) return;
      matchedA.add(indexA);
      matchedB.add(indexB);
      bCursor = indexB + 1;
    });
    const differenceA = eventsA.map((event, index) => ({
      ...clone(event),
      difference: matchedA.has(index) ? EVENT_DIFFERENCE.SHARED : EVENT_DIFFERENCE.ONLY_A,
      firstDivergence: false
    }));
    const differenceB = eventsB.map((event, index) => ({
      ...clone(event),
      difference: matchedB.has(index) ? EVENT_DIFFERENCE.SHARED : EVENT_DIFFERENCE.ONLY_B,
      firstDivergence: false
    }));
    const firstA = differenceA.findIndex(event => event.difference === EVENT_DIFFERENCE.ONLY_A);
    const firstB = differenceB.findIndex(event => event.difference === EVENT_DIFFERENCE.ONLY_B);
    if (firstA >= 0) differenceA[firstA].firstDivergence = true;
    if (firstB >= 0) differenceB[firstB].firstDivergence = true;
    const eventA = firstA >= 0 ? differenceA[firstA] : null;
    const eventB = firstB >= 0 ? differenceB[firstB] : null;
    const turns = [eventA, eventB].filter(Boolean).map(event => Number(event.start || 0));
    return {
      diverged: !!(eventA || eventB),
      firstDivergence: eventA || eventB ? {
        turn: Math.min(...turns),
        A: clone(eventA),
        B: clone(eventB)
      } : null,
      branches: { A: differenceA, B: differenceB },
      counts: {
        shared: matchedA.size,
        onlyA: differenceA.length - matchedA.size,
        onlyB: differenceB.length - matchedB.size
      }
    };
  }

  function comparisonViewModel(comparison) {
    const errors = validateComparison(comparison);
    if (errors.length) throw new Error(errors.join(","));
    const difference = semanticEventAlignment(
      comparison.branches[0].events,
      comparison.branches[1].events
    );
    return {
      comparisonId: comparison.comparisonId || null,
      branchPoint: clone(comparison.branchPoint),
      sharedEvents: clone(comparison.base.events),
      difference,
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
          events: clone(difference.branches[branch.slot]),
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
    EVENT_DIFFERENCE,
    deriveComparison,
    comparisonFromRegistry,
    validateComparison,
    branchById,
    materializeTimeline,
    materializeTimelineModel,
    semanticEventKey,
    semanticEventAlignment,
    comparisonViewModel,
    stableStringify
  });
});
