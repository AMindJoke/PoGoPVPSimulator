(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualBranches = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ORIGINAL_BRANCH_ID = "AUTO-ORIGINAL";
  const COMMAND_TYPE = Object.freeze({
    CREATE_BRANCH: "CREATE_BRANCH",
    RENAME_BRANCH: "RENAME_BRANCH",
    SWITCH_BRANCH: "SWITCH_BRANCH",
    DUPLICATE_BRANCH: "DUPLICATE_BRANCH",
    DELETE_BRANCH: "DELETE_BRANCH",
    UPDATE_BRANCH: "UPDATE_BRANCH"
  });

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function branch(input = {}) {
    return {
      branchId: input.branchId,
      parentBranchId: input.parentBranchId || null,
      branchPoint: clone(input.branchPoint || null),
      label: input.label || input.branchId,
      createdAt: input.createdAt || new Date().toISOString(),
      edits: clone(input.edits || []),
      timelineModel: clone(input.timelineModel || null),
      terminalResult: clone(input.terminalResult ?? input.timelineModel?.terminalResult ?? null),
      stateHash: input.stateHash || input.timelineModel?.events?.at(-1)?.stateHashAfter || input.timelineModel?.initialStateHash || null,
      classification: input.classification || "CANONICAL"
    };
  }

  function createRegistry(input = {}) {
    const original = branch({
      branchId: ORIGINAL_BRANCH_ID,
      label: input.label || "Automatic original",
      createdAt: input.createdAt,
      timelineModel: input.timelineModel,
      terminalResult: input.terminalResult,
      classification: "IMMUTABLE_ORIGINAL"
    });
    return {
      schemaVersion: 1,
      activeBranchId: ORIGINAL_BRANCH_ID,
      branches: { [ORIGINAL_BRANCH_ID]: original },
      history: [],
      redoStack: [],
      revision: 0
    };
  }

  function core(registry) {
    return {
      schemaVersion: registry.schemaVersion,
      activeBranchId: registry.activeBranchId,
      branches: clone(registry.branches),
      revision: registry.revision
    };
  }

  function restoreCore(registry, restored) {
    return {
      ...registry,
      ...clone(restored)
    };
  }

  function nextBranchId(registry) {
    let index = 1;
    while (registry.branches[`MANUAL-${index}`]) index++;
    return `MANUAL-${index}`;
  }

  function mutate(registry, command) {
    const next = clone(registry);
    const payload = command.payload || {};
    switch (command.type) {
      case COMMAND_TYPE.CREATE_BRANCH: {
        const parentBranchId = payload.parentBranchId || registry.activeBranchId;
        if (!next.branches[parentBranchId]) throw new Error("PARENT_BRANCH_NOT_FOUND");
        const branchId = payload.branchId || nextBranchId(next);
        if (branchId === ORIGINAL_BRANCH_ID || next.branches[branchId]) throw new Error("BRANCH_ID_CONFLICT");
        next.branches[branchId] = branch({
          ...payload,
          branchId,
          parentBranchId,
          timelineModel: payload.timelineModel || next.branches[parentBranchId].timelineModel
        });
        next.activeBranchId = branchId;
        break;
      }
      case COMMAND_TYPE.RENAME_BRANCH: {
        const target = next.branches[payload.branchId];
        if (!target) throw new Error("BRANCH_NOT_FOUND");
        if (payload.branchId === ORIGINAL_BRANCH_ID) throw new Error("ORIGINAL_BRANCH_IMMUTABLE");
        target.label = String(payload.label || "").trim() || target.label;
        break;
      }
      case COMMAND_TYPE.SWITCH_BRANCH:
        if (!next.branches[payload.branchId]) throw new Error("BRANCH_NOT_FOUND");
        next.activeBranchId = payload.branchId;
        break;
      case COMMAND_TYPE.DUPLICATE_BRANCH: {
        const source = next.branches[payload.branchId || registry.activeBranchId];
        if (!source) throw new Error("BRANCH_NOT_FOUND");
        const branchId = payload.newBranchId || nextBranchId(next);
        if (branchId === ORIGINAL_BRANCH_ID || next.branches[branchId]) throw new Error("BRANCH_ID_CONFLICT");
        next.branches[branchId] = branch({
          ...source,
          branchId,
          parentBranchId: source.branchId,
          label: payload.label || `${source.label} copy`,
          createdAt: payload.createdAt
        });
        next.activeBranchId = branchId;
        break;
      }
      case COMMAND_TYPE.DELETE_BRANCH:
        if (payload.branchId === ORIGINAL_BRANCH_ID) throw new Error("ORIGINAL_BRANCH_IMMUTABLE");
        if (!next.branches[payload.branchId]) throw new Error("BRANCH_NOT_FOUND");
        delete next.branches[payload.branchId];
        if (next.activeBranchId === payload.branchId) next.activeBranchId = ORIGINAL_BRANCH_ID;
        break;
      case COMMAND_TYPE.UPDATE_BRANCH: {
        const target = next.branches[payload.branchId || registry.activeBranchId];
        if (!target) throw new Error("BRANCH_NOT_FOUND");
        if (target.branchId === ORIGINAL_BRANCH_ID) throw new Error("ORIGINAL_BRANCH_IMMUTABLE");
        target.timelineModel = clone(payload.timelineModel);
        target.terminalResult = clone(payload.terminalResult ?? payload.timelineModel?.terminalResult ?? null);
        target.edits = [...(target.edits || []), clone(payload.edit)].filter(Boolean);
        target.stateHash = payload.stateHash || payload.timelineModel?.events?.at(-1)?.stateHashAfter || payload.timelineModel?.initialStateHash || null;
        target.classification = payload.classification || target.classification;
        break;
      }
      default:
        throw new Error("INVALID_BRANCH_COMMAND");
    }
    next.revision = Number(registry.revision || 0) + 1;
    return next;
  }

  function execute(registry, command = {}) {
    if (!Object.values(COMMAND_TYPE).includes(command.type)) throw new Error("INVALID_BRANCH_COMMAND");
    const before = core(registry);
    const mutated = mutate(registry, command);
    const after = core(mutated);
    const entry = {
      id: command.id || `command-${mutated.revision}`,
      type: command.type,
      payload: clone(command.payload || {}),
      before,
      after
    };
    return {
      ...mutated,
      history: [...registry.history, entry],
      redoStack: []
    };
  }

  function undo(registry) {
    if (!registry.history.length) return registry;
    const entry = registry.history.at(-1);
    const restored = restoreCore(registry, entry.before);
    return {
      ...restored,
      history: registry.history.slice(0, -1),
      redoStack: [...registry.redoStack, entry]
    };
  }

  function redo(registry) {
    if (!registry.redoStack.length) return registry;
    const entry = registry.redoStack.at(-1);
    const restored = restoreCore(registry, entry.after);
    return {
      ...restored,
      history: [...registry.history, entry],
      redoStack: registry.redoStack.slice(0, -1)
    };
  }

  function activeBranch(registry) {
    return clone(registry?.branches?.[registry.activeBranchId] || null);
  }

  function validateRegistry(registry) {
    const errors = [];
    if (!registry?.branches?.[ORIGINAL_BRANCH_ID]) errors.push("ORIGINAL_BRANCH_MISSING");
    if (!registry?.branches?.[registry.activeBranchId]) errors.push("ACTIVE_BRANCH_MISSING");
    if (registry?.branches?.[ORIGINAL_BRANCH_ID]?.classification !== "IMMUTABLE_ORIGINAL") errors.push("ORIGINAL_BRANCH_MUTABLE");
    for (const candidate of Object.values(registry?.branches || {})) {
      if (!candidate.branchId) errors.push("BRANCH_ID_MISSING");
      if (candidate.branchId !== ORIGINAL_BRANCH_ID && !registry.branches[candidate.parentBranchId]) errors.push(`PARENT_BRANCH_MISSING:${candidate.branchId}`);
    }
    return errors;
  }

  return Object.freeze({
    ORIGINAL_BRANCH_ID,
    COMMAND_TYPE,
    createRegistry,
    execute,
    undo,
    redo,
    activeBranch,
    validateRegistry
  });
});
