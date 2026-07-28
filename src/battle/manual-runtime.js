(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./manual-action.js") : root.PvPeakManualAction
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (ManualAction) {
  "use strict";

  const TRACE_STATE = Object.freeze({
    REQUESTED: "MANUAL_REQUESTED",
    VALIDATED: "MANUAL_VALIDATED",
    REJECTED: "MANUAL_REJECTED",
    QUEUED: "MANUAL_QUEUED",
    REGISTERED: "MANUAL_REGISTERED",
    RESOLVED: "MANUAL_RESOLVED",
    INVALIDATED: "MANUAL_INVALIDATED"
  });

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function stateDelta(before, after) {
    const sides = {};
    for (const side of ["A", "B"]) {
      const previous = before?.sides?.[side] || {};
      const current = after?.sides?.[side] || {};
      sides[side] = {
        hp: Number(current.hp || 0) - Number(previous.hp || 0),
        energy: Number(current.energy || 0) - Number(previous.energy || 0),
        shields: Number(current.shields || 0) - Number(previous.shields || 0),
        attackStage: Number(current.attackStage || 0) - Number(previous.attackStage || 0),
        defenseStage: Number(current.defenseStage || 0) - Number(previous.defenseStage || 0)
      };
    }
    return sides;
  }

  function createRuntime(dependencies = {}) {
    if (!ManualAction) throw new Error("MANUAL_ACTION_API_REQUIRED");
    if (typeof dependencies.getState !== "function") throw new Error("MANUAL_STATE_ADAPTER_REQUIRED");
    if (typeof dependencies.getDecisionPoint !== "function") throw new Error("MANUAL_DECISION_ADAPTER_REQUIRED");
    if (typeof dependencies.getLegalActions !== "function") throw new Error("MANUAL_LEGALITY_ADAPTER_REQUIRED");
    if (typeof dependencies.resolveFast !== "function") throw new Error("MANUAL_FAST_RESOLVER_REQUIRED");

    const trace = [];

    function append(traceState, action, detail = {}) {
      const entry = {
        traceState,
        manualActionId: action.id,
        branchId: dependencies.getBranchId?.() || null,
        sourceEvent: action.requestedAtEventId || null,
        requestedTurn: action.requestedAtTurn,
        side: action.side,
        actionType: action.actionType,
        moveId: action.moveId,
        ...clone(detail)
      };
      trace.push(entry);
      dependencies.onTrace?.(clone(entry));
      return entry;
    }

    function request(input = {}) {
      const before = clone(dependencies.getState());
      const decisionPoint = clone(dependencies.getDecisionPoint());
      const action = ManualAction.createManualAction({
        ...input,
        requestedAtTurn: input.requestedAtTurn ?? before?.currentTurn ?? 0,
        requestedAtEventId: input.requestedAtEventId ?? decisionPoint?.eventId ?? null,
        metadata: {
          ...input.metadata,
          expectedStateHash: input.metadata?.expectedStateHash || decisionPoint?.stateHash
        }
      });
      const hashBefore = ManualAction.stateHash(before);
      append(TRACE_STATE.REQUESTED, action, {
        stateHashBefore: hashBefore,
        legalActions: clone(dependencies.getLegalActions(action.side) || [])
      });

      const validation = ManualAction.validateManualAction({
        state: before,
        side: action.side,
        manualAction: action,
        decisionPoint,
        legalActions: dependencies.getLegalActions(action.side) || [],
        legalityMode: action.legalityMode,
        stateHash: decisionPoint?.stateHash || hashBefore
      });
      append(validation.legal ? TRACE_STATE.VALIDATED : TRACE_STATE.REJECTED, action, {
        validationResult: clone(validation),
        stateHashBefore: hashBefore
      });
      if (!validation.legal) return { ok: false, action, validation, trace: clone(trace) };

      if (validation.pendingDecisionType === "BUILD_TO_CHARGED") {
        append(TRACE_STATE.QUEUED, action, {
          validationResult: clone(validation),
          queuedAction: clone(validation.normalizedAction),
          stateHashBefore: hashBefore
        });
        return { ok: true, queued: true, action, validation, trace: clone(trace) };
      }

      if (action.actionType !== ManualAction.ACTION_TYPE.FAST_MOVE) {
        append(TRACE_STATE.INVALIDATED, action, {
          invalidationReason: "ACTION_RESOLVER_NOT_CONNECTED",
          stateHashBefore: hashBefore
        });
        return {
          ok: false,
          action,
          validation: { ...validation, reasonCode: "ACTION_RESOLVER_NOT_CONNECTED" },
          trace: clone(trace)
        };
      }

      append(TRACE_STATE.REGISTERED, action, {
        registeredTurn: Number(before.currentTurn || 0),
        queuedAction: clone(validation.normalizedAction),
        stateHashBefore: hashBefore
      });
      const resolution = dependencies.resolveFast({
        side: action.side,
        moveId: action.moveId,
        manualAction: clone(action),
        validation: clone(validation)
      });
      if (!resolution) {
        append(TRACE_STATE.INVALIDATED, action, {
          invalidationReason: "MECHANICS_REJECTED_ACTION",
          stateHashBefore: hashBefore
        });
        return { ok: false, action, validation, trace: clone(trace) };
      }

      const after = clone(dependencies.getState());
      const hashAfter = ManualAction.stateHash(after);
      append(TRACE_STATE.RESOLVED, action, {
        registeredTurn: Number(before.currentTurn || 0),
        resolvedTurn: Number(after.currentTurn || before.currentTurn || 0),
        resolvedAction: { side: action.side, actionType: action.actionType, moveId: action.moveId },
        stateHashBefore: hashBefore,
        stateHashAfter: hashAfter,
        delta: stateDelta(before, after),
        pendingEventChanges: {
          before: clone(before.pendingEvents || []),
          after: clone(after.pendingEvents || [])
        }
      });
      return { ok: true, action, validation, before, after, trace: clone(trace) };
    }

    return Object.freeze({
      request,
      getTrace: () => clone(trace)
    });
  }

  return Object.freeze({
    TRACE_STATE,
    createRuntime,
    stateDelta
  });
});
