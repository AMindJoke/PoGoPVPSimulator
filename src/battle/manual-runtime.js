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

    function finishResolution(action, validation, before, resolution) {
      const hashBefore = ManualAction.stateHash(before);
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

    async function resolveChargedAction(action, validation, before) {
      const hashBefore = ManualAction.stateHash(before);
      if (typeof dependencies.resolveCharged !== "function") {
        append(TRACE_STATE.INVALIDATED, action, {
          invalidationReason: "ACTION_RESOLVER_NOT_CONNECTED",
          stateHashBefore: hashBefore
        });
        return { ok: false, action, validation: { ...validation, reasonCode: "ACTION_RESOLVER_NOT_CONNECTED" }, trace: clone(trace) };
      }
      append(TRACE_STATE.REGISTERED, action, {
        registeredTurn: Number(before.currentTurn || 0),
        queuedAction: clone(validation.normalizedAction),
        stateHashBefore: hashBefore
      });

      const defenderSide = action.side === "A" ? "B" : "A";
      const defender = before?.sides?.[defenderSide];
      let shielded = false;
      if (Number(defender?.shields || 0) > 0) {
        const shieldPoint = dependencies.getShieldDecisionPoint?.({
          action: clone(action),
          attackerSide: action.side,
          defenderSide
        }) || ManualAction.createDecisionPoint({
          state: before,
          phase: ManualAction.DECISION_PHASE.SHIELD_DECISION,
          shieldDecision: { attackerSide: action.side, defenderSide, moveId: action.moveId }
        });
        dependencies.onDecisionPhase?.({ phase: "SHIELD_DECISION", decisionPoint: clone(shieldPoint), action: clone(action) });
        shielded = !!(await dependencies.requestShieldDecision?.({
          action: clone(action),
          attackerSide: action.side,
          defenderSide,
          decisionPoint: clone(shieldPoint)
        }));
        const shieldAction = ManualAction.createManualAction({
          side: defenderSide,
          actionType: shielded ? ManualAction.ACTION_TYPE.SHIELD : ManualAction.ACTION_TYPE.NO_SHIELD,
          requestedAtTurn: before.currentTurn,
          requestedAtEventId: shieldPoint.eventId,
          metadata: { expectedStateHash: shieldPoint.stateHash }
        });
        append(TRACE_STATE.REQUESTED, shieldAction, {
          stateHashBefore: hashBefore,
          legalActions: []
        });
        const shieldValidation = ManualAction.validateManualAction({
          state: before,
          side: defenderSide,
          manualAction: shieldAction,
          decisionPoint: shieldPoint,
          legalActions: [],
          stateHash: shieldPoint.stateHash
        });
        append(shieldValidation.legal ? TRACE_STATE.VALIDATED : TRACE_STATE.REJECTED, shieldAction, {
          validationResult: clone(shieldValidation),
          stateHashBefore: hashBefore
        });
        if (!shieldValidation.legal) {
          dependencies.onDecisionPhase?.({ phase: "INVALIDATED", decisionPoint: clone(shieldPoint), action: clone(action) });
          return { ok: false, action, validation: shieldValidation, trace: clone(trace) };
        }
        append(TRACE_STATE.REGISTERED, shieldAction, {
          registeredTurn: Number(before.currentTurn || 0),
          stateHashBefore: hashBefore
        });
        append(TRACE_STATE.RESOLVED, shieldAction, {
          registeredTurn: Number(before.currentTurn || 0),
          resolvedTurn: Number(before.currentTurn || 0),
          resolvedAction: { side: defenderSide, actionType: shieldAction.actionType },
          stateHashBefore: hashBefore,
          stateHashAfter: hashBefore,
          delta: stateDelta(before, before),
          pendingEventChanges: { before: clone(before.pendingEvents || []), after: clone(before.pendingEvents || []) }
        });
      }
      dependencies.onDecisionPhase?.({ phase: "RESOLVING_CHARGED", action: clone(action), shielded });
      const resolution = await dependencies.resolveCharged({
        side: action.side,
        moveId: action.moveId,
        manualAction: clone(action),
        validation: clone(validation),
        shielded
      });
      return finishResolution(action, validation, before, resolution);
    }

    function prepare(input = {}) {
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
      return {
        ok: validation.legal,
        prepared: validation.legal,
        action,
        validation,
        before,
        decisionPoint,
        trace: clone(trace)
      };
    }

    function executePrepared(prepared = {}) {
      if (!prepared.ok || !prepared.prepared || !prepared.action || !prepared.validation) {
        return {
          ok: false,
          action: prepared.action || null,
          validation: prepared.validation || { reasonCode: "ACTION_NOT_PREPARED" },
          trace: clone(trace)
        };
      }
      const { action, validation } = prepared;
      const registeredBefore = clone(prepared.before);
      if (validation.pendingDecisionType === "BUILD_TO_CHARGED") {
        append(TRACE_STATE.QUEUED, action, {
          validationResult: clone(validation),
          queuedAction: clone(validation.normalizedAction),
          stateHashBefore: ManualAction.stateHash(registeredBefore)
        });
        return { ok: true, queued: true, action, validation, trace: clone(trace) };
      }

      if (action.actionType === ManualAction.ACTION_TYPE.CHARGED_MOVE) {
        return resolveChargedAction(action, validation, clone(dependencies.getState()));
      }

      if (action.actionType !== ManualAction.ACTION_TYPE.FAST_MOVE) {
        append(TRACE_STATE.INVALIDATED, action, {
          invalidationReason: "ACTION_RESOLVER_NOT_CONNECTED",
          stateHashBefore: ManualAction.stateHash(registeredBefore)
        });
        return {
          ok: false,
          action,
          validation: { ...validation, reasonCode: "ACTION_RESOLVER_NOT_CONNECTED" },
          trace: clone(trace)
        };
      }

      append(TRACE_STATE.REGISTERED, action, {
        registeredTurn: Number(registeredBefore.currentTurn || 0),
        queuedAction: clone(validation.normalizedAction),
        stateHashBefore: ManualAction.stateHash(registeredBefore)
      });
      const resolutionBefore = clone(dependencies.getState());
      const resolution = dependencies.resolveFast({
        side: action.side,
        moveId: action.moveId,
        manualAction: clone(action),
        validation: clone(validation)
      });
      return finishResolution(action, validation, resolutionBefore, resolution);
    }

    function request(input = {}) {
      const prepared = prepare(input);
      if (!prepared.ok) return prepared;
      return executePrepared(prepared);
    }

    return Object.freeze({
      prepare,
      executePrepared,
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
