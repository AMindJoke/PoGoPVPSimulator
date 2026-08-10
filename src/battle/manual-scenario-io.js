(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./manual-branches.js") : root.PvPeakManualBranches,
    typeof module === "object" && module.exports ? require("./manual-mode.js") : root.PvPeakManualMode
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualScenarioIO = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Branches, ManualMode) {
  "use strict";

  const SCHEMA_ID = "pogo-pvp-scenario";
  const SCHEMA_VERSION = 1;
  const MODE = "scenario-review";
  const CAPABILITIES = Object.freeze([
    "canonical-battle-state",
    "manual-engine",
    "semantic-timeline",
    "technical-issues"
  ]);
  const SIDES = Object.freeze(["A", "B"]);
  const EVENT_KINDS = new Set([
    "fast",
    "charge",
    "shield",
    "form-protect",
    "manual-state",
    "manual-faint",
    "manual-entry",
    "technical-lag",
    "technical-dre",
    "wait",
    "faint",
    "replacement",
    "pokemon-entry"
  ]);
  const TECHNICAL_ISSUE_TYPES = new Set(["one-turn-lag", "dre"]);

  function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function canonicalClone(value, seen = new WeakSet()) {
    if (value == null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("NON_FINITE_SCENARIO_NUMBER");
      return value;
    }
    if (value instanceof Date) return value.toISOString();
    if (typeof value !== "object") return undefined;
    if (seen.has(value)) throw new Error("CYCLIC_SCENARIO_VALUE");
    seen.add(value);
    if (Array.isArray(value)) {
      const array = value.map(item => canonicalClone(item, seen));
      seen.delete(value);
      return array;
    }
    const result = {};
    Object.keys(value).sort().forEach(key => {
      const next = canonicalClone(value[key], seen);
      if (next !== undefined) result[key] = next;
    });
    seen.delete(value);
    return result;
  }

  function clone(value) {
    return value == null ? value : canonicalClone(value);
  }

  function sidePrefix(side) {
    return side === "A" ? "p1" : "p2";
  }

  function sideCombatant(applicationState, side) {
    return side === "A" ? applicationState?.battle?.left : applicationState?.battle?.right;
  }

  function participantDescriptor(side, input = {}) {
    const applicationState = input.applicationState || input.state?.applicationState || null;
    const controls = applicationState?.controls || {};
    const combatant = sideCombatant(applicationState, side) || null;
    const prefix = sidePrefix(side);
    const fallback = input.participants?.[side] || input.pokemon?.[side] || null;
    const fallbackId = typeof fallback === "string"
      ? fallback
      : fallback?.pokemon?.id || fallback?.id || null;
    const pokemon = combatant?.p || null;
    const id = pokemon?.id || controls[`${prefix}Pokemon`] || fallbackId;
    const initialState = applicationState?.battle?.initialTimelineState?.[side] || null;
    const chargedIds = [
      controls[`${prefix}Charged1`] || combatant?.charged?.[0]?.id || null,
      controls[`${prefix}Charged2`] || combatant?.charged?.[1]?.id || null
    ];
    const currentHp = combatant ? Number(combatant.hp) : null;
    return {
      side,
      pokemon: {
        id: id || null,
        formId: combatant?.initialFormId || pokemon?.formId || pokemon?.id || id || null,
        shadow: !!(pokemon?.shadow || pokemon?.isShadow || String(id || "").includes("_shadow"))
      },
      build: {
        level: combatant?.level ?? numericControl(controls[`${prefix}Level`]),
        ivs: {
          attack: combatant?.ivAtk ?? numericControl(controls[`${prefix}IvAtk`]),
          defense: combatant?.ivDef ?? numericControl(controls[`${prefix}IvDef`]),
          stamina: combatant?.ivHp ?? numericControl(controls[`${prefix}IvHp`])
        },
        cp: combatant?.cp ?? numericControl(controls[`${prefix}Cp`]),
        moves: {
          fast: controls[`${prefix}Fast`] || combatant?.fast?.id || null,
          charged: chargedIds
        }
      },
      initial: {
        hp: initialState?.hp ?? combatant?.maxHp ?? null,
        energy: numericControl(controls[`${prefix}StartEnergy`]),
        shields: numericControl(controls[`${prefix}Shields`])
      },
      current: {
        hp: Number.isFinite(currentHp) ? currentHp : null,
        maxHp: combatant?.maxHp ?? initialState?.maxHp ?? null,
        energy: combatant?.energy ?? null,
        shields: combatant?.shields ?? null,
        attackStage: combatant?.attackStage ?? 0,
        defenseStage: combatant?.defenseStage ?? 0,
        appliedEffects: clone(combatant?.appliedEffects || []),
        fainted: Number.isFinite(currentHp) ? currentHp <= 0 : false,
        active: Number.isFinite(currentHp) ? currentHp > 0 : true
      }
    };
  }

  function numericControl(value) {
    if (value === "" || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function eventId(event, index) {
    return event?.timelineEventId || event?.id || `event-${String(index).padStart(4, "0")}`;
  }

  function technicalIssueIndex(events = []) {
    return events
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => (
        event?.kind === "technical-lag"
        || event?.kind === "technical-dre"
        || event?.issueType
        || event?.drePending
        || event?.dreResolved
        || event?.dreDenied
      ))
      .map(({ event, index }) => eventId(event, index));
  }

  function currentTurn(applicationState, runtimeState) {
    const turns = runtimeState?.battleTurns || applicationState?.battle?.battleTurns || {};
    const values = SIDES.map(side => Number(turns[side])).filter(Number.isFinite);
    return values.length ? Math.min(...values) : 0;
  }

  function serializeScenario(input = {}) {
    if (!Branches || Branches.validateRegistry(input.registry || input.branchModel?.registry).length) {
      throw new Error("INVALID_BRANCH_REGISTRY");
    }
    const registry = input.registry || input.branchModel.registry;
    const active = Branches.activeBranch(registry);
    const applicationState = clone(input.applicationState || input.state?.applicationState || null);
    const runtimeState = clone(input.runtimeState || input.state?.runtimeState || null);
    const manualModeState = clone(input.manualModeState || input.state?.manualMode || null);
    const pendingFastEvents = clone(input.pendingFastEvents || input.state?.pendingFastEvents || runtimeState?.manualPendingFastEvents || []);
    const technicalIssue = clone(input.technicalIssue || input.technicalIssues?.active || null);
    const events = clone(input.timeline || active?.timelineModel?.events || applicationState?.battle?.timeline || []);
    const initialState = clone(input.initialState || active?.timelineModel?.initialState || applicationState?.battle?.initialTimelineState || null);
    const review = clone(input.scenarioReview || input.review || applicationState?.scenarioReview || null);
    const session = clone(input.manualSession || input.session || {});
    const battleVersion = String(input.battleEngineVersion || input.engine?.battleVersion || "");
    const terminalResult = clone(input.terminalResult ?? active?.terminalResult ?? null);
    const document = {
      schema: SCHEMA_ID,
      version: SCHEMA_VERSION,
      mode: MODE,
      capabilities: [...CAPABILITIES],
      engine: { battleVersion },
      review: {
        mode: input.reviewMode === "automatic" ? "automatic" : "manual",
        state: review?.state || null,
        segmentInitialState: review?.segmentInitialState || null,
        timelineStart: Number(review?.timelineStart || 0),
        history: review?.history || { A: [], B: [] }
      },
      participants: {
        A: participantDescriptor("A", { ...input, applicationState }),
        B: participantDescriptor("B", { ...input, applicationState })
      },
      state: {
        currentTurn: currentTurn(applicationState, runtimeState),
        readySide: manualModeState?.pendingDecision?.activeSide || manualModeState?.selectedSide || null,
        applicationState,
        runtimeState,
        manualMode: manualModeState,
        pendingFastEvents,
        pendingChargedRegistration: clone(manualModeState?.pendingDecision || null),
        terminalResult
      },
      timeline: {
        initialState,
        events
      },
      technicalIssues: {
        active: technicalIssue,
        eventIds: technicalIssueIndex(events)
      },
      branchModel: {
        version: 1,
        activeBranchId: registry.activeBranchId,
        originalBranchId: Branches.ORIGINAL_BRANCH_ID,
        registry: clone(registry)
      },
      session: {
        controlMode: session.sessionControlMode || session.controlMode || null,
        originalRuntimeState: session.originalRuntimeState || null,
        rootSnapshotId: session.rootSnapshotId || null,
        snapshots: session.snapshots || []
      }
    };
    const errors = validateScenario(document, { battleEngineVersion: battleVersion, allowEngineMismatch: true });
    if (errors.length) throw new Error(errors.join(","));
    return clone(document);
  }

  function stableStringify(value, spacing = 0) {
    return JSON.stringify(clone(value), null, spacing);
  }

  function stringifyScenario(input, spacing = 2) {
    const document = isCanonicalScenario(input) ? clone(input) : serializeScenario(input);
    return stableStringify(document, spacing);
  }

  function isCanonicalScenario(document) {
    return isRecord(document) && document.schema === SCHEMA_ID;
  }

  function migrateLegacyV1(document) {
    const applicationState = clone(document.applicationState || null);
    const manualSession = clone(document.manualSession || {});
    const battle = applicationState?.battle || {};
    const review = applicationState?.scenarioReview || document.scenarioReview || {};
    const runtimeState = manualSession.runtimeState || {
      left: battle.left || null,
      right: battle.right || null,
      battleTurns: battle.battleTurns || { A: 0, B: 0 },
      manualPendingFastEvents: manualSession.pendingFastEvents || [],
      initialTimelineState: battle.initialTimelineState || document.initialState || null,
      scenarioState: review.state || null,
      scenarioReviewMode: document.reviewMode || review.mode || "manual",
      scenarioSegmentInitialState: review.segmentInitialState || null,
      scenarioTimelineStart: Number(review.timelineStart || 0),
      scenarioHistory: review.history || { A: [], B: [] },
      p1Shields: battle.p1Shields ?? applicationState?.controls?.p1Shields ?? 0,
      p2Shields: battle.p2Shields ?? applicationState?.controls?.p2Shields ?? 0,
      p1StartEnergy: battle.p1StartEnergy ?? applicationState?.controls?.p1StartEnergy ?? 0,
      p2StartEnergy: battle.p2StartEnergy ?? applicationState?.controls?.p2StartEnergy ?? 0
    };
    const manualModeState = manualSession.manualModeState || legacyManualModeState(document, runtimeState);
    return serializeScenario({
      registry: document.branchRegistry,
      battleEngineVersion: document.battleEngineVersion,
      reviewMode: document.reviewMode,
      scenarioReview: document.scenarioReview,
      pokemon: document.pokemon,
      initialState: document.initialState,
      timeline: document.timeline,
      terminalResult: document.terminalResult,
      applicationState,
      runtimeState,
      manualModeState,
      pendingFastEvents: manualSession.pendingFastEvents || [],
      technicalIssue: manualSession.technicalIssue || null,
      manualSession
    });
  }

  function legacyManualModeState(document, runtimeState) {
    if (!ManualMode) return { legacy: true };
    const registry = document.branchRegistry;
    const active = Branches.activeBranch(registry);
    const controlMode = manualControlMode(document.manualSession?.sessionControlMode);
    const turn = currentTurn(document.applicationState, runtimeState);
    let state = ManualMode.createState({
      controlMode,
      originalTimeline: document.originalBranch?.timelineModel?.events || document.timeline || [],
      originalTerminalResult: document.originalBranch?.terminalResult || null
    });
    state = ManualMode.enable(state, {
      originalTimeline: state.originalTimeline,
      originalTerminalResult: state.originalTerminalResult
    });
    return ManualMode.selectBranchPoint(state, {
      branchId: registry?.activeBranchId || "MANUAL-1",
      parentBranchId: active?.parentBranchId || Branches.ORIGINAL_BRANCH_ID,
      turn,
      eventId: active?.branchPoint?.eventId || null,
      stateHash: active?.stateHash || active?.timelineModel?.initialStateHash || "legacy-state",
      terminal: !!active?.terminalResult,
      terminalResult: active?.terminalResult || null,
      decisionPoint: null
    });
  }

  function manualControlMode(value) {
    return Object.values(ManualMode?.CONTROL_MODE || {}).includes(value)
      ? value
      : ManualMode?.CONTROL_MODE?.BOTH_MANUAL || "BOTH_MANUAL";
  }

  function validateNumber(errors, value, code, minimum, maximum, options = {}) {
    if (value == null && options.optional) return;
    if (!Number.isFinite(Number(value))) return errors.push(code);
    const number = Number(value);
    if (number < minimum || number > maximum) errors.push(code);
  }

  function validateParticipant(errors, participant, side, options) {
    if (!isRecord(participant) || participant.side !== side) return errors.push(`INVALID_PARTICIPANT_${side}`);
    const pokemonId = participant.pokemon?.id;
    if (typeof pokemonId !== "string" || !pokemonId.trim()) errors.push(`POKEMON_${side}_MISSING`);
    else if (typeof options.isPokemonId === "function" && !options.isPokemonId(pokemonId)) errors.push(`POKEMON_${side}_UNKNOWN`);
    const build = participant.build || {};
    validateNumber(errors, build.level, `INVALID_LEVEL_${side}`, 1, 100, { optional: true });
    validateNumber(errors, build.cp, `INVALID_CP_${side}`, 10, 10000, { optional: true });
    ["attack", "defense", "stamina"].forEach(stat => validateNumber(errors, build.ivs?.[stat], `INVALID_IV_${side}`, 0, 15, { optional: true }));
    if (!isRecord(build.moves)) errors.push(`INVALID_MOVES_${side}`);
    else {
      if (build.moves.fast != null && typeof build.moves.fast !== "string") errors.push(`INVALID_FAST_MOVE_${side}`);
      if (!Array.isArray(build.moves.charged) || build.moves.charged.length > 2) errors.push(`INVALID_CHARGED_MOVES_${side}`);
      if (typeof options.isMoveId === "function") {
        if (build.moves.fast && !options.isMoveId(pokemonId, build.moves.fast, "fast")) errors.push(`UNKNOWN_FAST_MOVE_${side}`);
        (build.moves.charged || []).filter(Boolean).forEach(moveId => {
          if (!options.isMoveId(pokemonId, moveId, "charged")) errors.push(`UNKNOWN_CHARGED_MOVE_${side}`);
        });
      }
    }
    validateNumber(errors, participant.initial?.hp, `INVALID_INITIAL_HP_${side}`, 0, 10000, { optional: true });
    validateNumber(errors, participant.initial?.energy, `INVALID_INITIAL_ENERGY_${side}`, 0, 100, { optional: true });
    validateNumber(errors, participant.initial?.shields, `INVALID_INITIAL_SHIELDS_${side}`, 0, 2, { optional: true });
    validateNumber(errors, participant.current?.hp, `INVALID_CURRENT_HP_${side}`, 0, 10000, { optional: true });
    validateNumber(errors, participant.current?.energy, `INVALID_CURRENT_ENERGY_${side}`, 0, 100, { optional: true });
    validateNumber(errors, participant.current?.shields, `INVALID_CURRENT_SHIELDS_${side}`, 0, 2, { optional: true });
    validateNumber(errors, participant.current?.attackStage, `INVALID_ATTACK_STAGE_${side}`, -4, 4, { optional: true });
    validateNumber(errors, participant.current?.defenseStage, `INVALID_DEFENSE_STAGE_${side}`, -4, 4, { optional: true });
    if (!Array.isArray(participant.current?.appliedEffects || [])) errors.push(`INVALID_APPLIED_EFFECTS_${side}`);
    if (
      Number.isFinite(Number(participant.current?.hp))
      && Number.isFinite(Number(participant.current?.maxHp))
      && Number(participant.current.hp) > Number(participant.current.maxHp)
    ) errors.push(`CURRENT_HP_EXCEEDS_MAX_${side}`);
    if (typeof participant.current?.fainted !== "boolean" || typeof participant.current?.active !== "boolean") errors.push(`INVALID_ACTIVITY_STATE_${side}`);
    else if (participant.current.fainted === participant.current.active) errors.push(`INCONSISTENT_ACTIVITY_STATE_${side}`);
  }

  function validateTimelineEvent(errors, event, index, options) {
    if (!isRecord(event)) return errors.push(`INVALID_TIMELINE_EVENT:${index}`);
    if (!EVENT_KINDS.has(event.kind)) errors.push(`INVALID_TIMELINE_KIND:${index}`);
    if (event.trainer != null && !SIDES.includes(event.trainer)) errors.push(`INVALID_TIMELINE_SIDE:${index}`);
    validateNumber(errors, event.start, `INVALID_TIMELINE_TURN:${index}`, 0, Number.MAX_SAFE_INTEGER);
    validateNumber(errors, event.duration, `INVALID_TIMELINE_DURATION:${index}`, 0, Number.MAX_SAFE_INTEGER, { optional: true });
    if (["fast", "charge"].includes(event.kind)) {
      const moveId = event.move?.id || event.moveId;
      if (typeof moveId !== "string" || !moveId) errors.push(`TIMELINE_MOVE_MISSING:${index}`);
      else if (typeof options.isMoveId === "function" && !options.isMoveId(null, moveId, event.kind === "fast" ? "fast" : "charged")) {
        errors.push(`TIMELINE_MOVE_UNKNOWN:${index}`);
      }
    }
    if (event.issueType && !TECHNICAL_ISSUE_TYPES.has(event.issueType)) errors.push(`INVALID_TECHNICAL_ISSUE:${index}`);
  }

  function validatePendingFast(errors, event, index) {
    if (!isRecord(event)) return errors.push(`INVALID_PENDING_FAST:${index}`);
    if (!SIDES.includes(event.sourceSide) || !SIDES.includes(event.targetSide) || event.sourceSide === event.targetSide) errors.push(`INVALID_PENDING_FAST_SIDES:${index}`);
    validateNumber(errors, event.damage, `INVALID_PENDING_FAST_DAMAGE:${index}`, 0, 10000);
    validateNumber(errors, event.resolveTurn ?? event.impactTurn, `INVALID_PENDING_FAST_TURN:${index}`, 0, Number.MAX_SAFE_INTEGER, { optional: true });
  }

  function validateSnapshot(errors, snapshot, index) {
    if (!isRecord(snapshot)) return errors.push(`INVALID_SNAPSHOT:${index}`);
    if (typeof snapshot.eventId !== "string" || !snapshot.eventId) errors.push(`INVALID_SNAPSHOT_EVENT:${index}`);
    if (!["BEFORE_EVENT", "AFTER_EVENT"].includes(snapshot.boundary)) errors.push(`INVALID_SNAPSHOT_BOUNDARY:${index}`);
    if (!isRecord(snapshot.state)) errors.push(`INVALID_SNAPSHOT_STATE:${index}`);
    if (typeof snapshot.stateHash !== "string" || !snapshot.stateHash) errors.push(`INVALID_SNAPSHOT_HASH:${index}`);
    validateNumber(errors, snapshot.turn, `INVALID_SNAPSHOT_TURN:${index}`, 0, Number.MAX_SAFE_INTEGER);
  }

  function validateScenario(document, options = {}) {
    const errors = [];
    if (!isRecord(document)) return ["INVALID_IMPORT_DOCUMENT"];
    if (document.schema !== SCHEMA_ID) errors.push("IMPORT_SCHEMA_MISMATCH");
    if (document.version !== SCHEMA_VERSION) errors.push("IMPORT_VERSION_UNSUPPORTED");
    if (document.mode !== MODE) errors.push("INVALID_SCENARIO_MODE");
    if (!Array.isArray(document.capabilities) || !document.capabilities.every(item => typeof item === "string")) errors.push("INVALID_CAPABILITIES");
    if (!document.engine?.battleVersion) errors.push("BATTLE_ENGINE_VERSION_MISSING");
    if (
      options.battleEngineVersion
      && document.engine?.battleVersion !== options.battleEngineVersion
      && options.allowEngineMismatch !== true
    ) errors.push("BATTLE_ENGINE_VERSION_MISMATCH");
    if (!["manual", "automatic"].includes(document.review?.mode)) errors.push("INVALID_REVIEW_MODE");
    SIDES.forEach(side => validateParticipant(errors, document.participants?.[side], side, options));
    if (!isRecord(document.state)) errors.push("INVALID_BATTLE_STATE");
    else {
      if (!isRecord(document.state.applicationState)) errors.push("INVALID_APPLICATION_STATE");
      if (!isRecord(document.state.runtimeState)) errors.push("INVALID_RUNTIME_STATE");
      if (!isRecord(document.state.manualMode)) errors.push("INVALID_MANUAL_STATE");
      validateNumber(errors, document.state.currentTurn, "INVALID_CURRENT_TURN", 0, Number.MAX_SAFE_INTEGER);
      if (document.state.readySide != null && !SIDES.includes(document.state.readySide)) errors.push("INVALID_READY_SIDE");
      if (!Array.isArray(document.state.pendingFastEvents)) errors.push("INVALID_PENDING_FAST_EVENTS");
      else document.state.pendingFastEvents.forEach((event, index) => validatePendingFast(errors, event, index));
      if (document.state.manualMode && typeof options.validateManualState === "function") {
        errors.push(...options.validateManualState(document.state.manualMode).map(code => `MANUAL_STATE:${code}`));
      }
    }
    if (!Array.isArray(document.timeline?.events)) errors.push("INVALID_TIMELINE");
    else document.timeline.events.forEach((event, index) => validateTimelineEvent(errors, event, index, options));
    const activeIssue = document.technicalIssues?.active;
    if (activeIssue && !TECHNICAL_ISSUE_TYPES.has(activeIssue.type || activeIssue.issue?.type)) errors.push("INVALID_ACTIVE_TECHNICAL_ISSUE");
    if (!Array.isArray(document.technicalIssues?.eventIds)) errors.push("INVALID_TECHNICAL_EVENT_INDEX");
    const registry = document.branchModel?.registry;
    if (!registry) errors.push("BRANCH_REGISTRY_MISSING");
    else errors.push(...Branches.validateRegistry(registry));
    if (document.branchModel?.activeBranchId !== registry?.activeBranchId) errors.push("ACTIVE_BRANCH_MISMATCH");
    if (!Array.isArray(document.session?.snapshots)) errors.push("INVALID_SNAPSHOTS");
    else document.session.snapshots.forEach((snapshot, index) => validateSnapshot(errors, snapshot, index));
    return [...new Set(errors)];
  }

  function deserializeScenario(serialized, options = {}) {
    let source;
    try {
      source = typeof serialized === "string" ? JSON.parse(serialized) : clone(serialized);
    } catch (_) {
      return { ok: false, errors: ["INVALID_JSON"], warnings: [], scenario: null };
    }
    let document;
    try {
      if (isCanonicalScenario(source)) document = clone(source);
      else if (source?.schemaVersion === 1) document = migrateLegacyV1(source);
      else return { ok: false, errors: ["IMPORT_SCHEMA_MISMATCH"], warnings: [], scenario: null };
    } catch (error) {
      return { ok: false, errors: [error.message || "SCENARIO_MIGRATION_FAILED"], warnings: [], scenario: null };
    }
    const errors = validateScenario(document, options);
    if (errors.length) return { ok: false, errors, warnings: [], scenario: null };
    const warnings = (
      options.battleEngineVersion
      && document.engine.battleVersion !== options.battleEngineVersion
    ) ? ["BATTLE_ENGINE_VERSION_MISMATCH"] : [];
    return { ok: true, errors: [], warnings, scenario: clone(document) };
  }

  function exportScenario(input = {}) {
    return serializeScenario(input);
  }

  function importScenario(serialized, options = {}) {
    return deserializeScenario(serialized, options);
  }

  return Object.freeze({
    SCHEMA_ID,
    SCHEMA_VERSION,
    MODE,
    CAPABILITIES,
    serializeScenario,
    deserializeScenario,
    validateScenario,
    stableStringify,
    exportScenario,
    stringifyScenario,
    importScenario
  });
});
