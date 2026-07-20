(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakScenario = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function createScenario(options = {}) {
    return {
      schemaVersion: SCHEMA_VERSION,
      id: options.id || `scenario-${Date.now()}`,
      status: "active",
      segments: [],
      activeSide: null,
      awaitingSide: null,
      lockedState: null,
      nextSegmentOverrides: { shields: {} },
      originalState: clone(options.originalState || null),
      createdAt: options.createdAt || new Date().toISOString()
    };
  }

  function createPokemonState(combatant) {
    if (!combatant || !combatant.p) return null;
    return {
      side: combatant.trainer || null,
      pokemonId: combatant.p.id,
      pokemonName: combatant.p.name,
      formId: combatant.p.id,
      types: clone(combatant.p.types || []),
      hp: Number(combatant.hp || 0),
      maxHp: Number(combatant.maxHp || 0),
      energy: Number(combatant.energy || 0),
      shields: Number(combatant.shields || 0),
      attackStage: Number(combatant.attackStage || 0),
      defenseStage: Number(combatant.defenseStage || 0),
      level: Number(combatant.level || 0),
      cp: Number(combatant.cp || 0),
      ivs: {
        attack: Number(combatant.ivAtk || 0),
        defense: Number(combatant.ivDef || 0),
        stamina: Number(combatant.ivHp || 0)
      },
      moves: {
        fast: combatant.fast?.id || null,
        charged: (combatant.charged || []).filter(Boolean).map(move => move.id)
      },
      combatant: clone(combatant)
    };
  }

  function createSegment(options = {}) {
    return {
      id: options.id || `segment-${Number(options.index || 0) + 1}`,
      index: Number(options.index || 0),
      initialState: clone(options.initialState || null),
      finalState: clone(options.finalState || null),
      winnerSide: options.winnerSide || null,
      faintedSide: options.faintedSide || null,
      timelineRange: {
        start: Number(options.timelineStart || 0),
        end: Number(options.timelineEnd || 0)
      }
    };
  }

  function lockSegment(scenario, segment, survivorState) {
    if (!scenario || scenario.status !== "active") throw new Error("An active Scenario is required.");
    if (!segment || !survivorState) throw new Error("A completed segment and survivor state are required.");
    scenario.segments.push(clone(segment));
    scenario.activeSide = survivorState.side;
    scenario.awaitingSide = survivorState.side === "A" ? "B" : "A";
    scenario.lockedState = clone(survivorState);
    scenario.nextSegmentOverrides = {
      shields: {
        A: Number(segment.finalState?.A?.shields || 0),
        B: Number(segment.finalState?.B?.shields || 0)
      }
    };
    scenario.status = "awaiting-incoming";
    return scenario;
  }

  function setNextSegmentShields(scenario, side, shields) {
    if (!scenario || !["awaiting-incoming", "active"].includes(scenario.status)) {
      throw new Error("An active Scenario is required.");
    }
    if (!["A", "B"].includes(side)) throw new Error("A valid Scenario side is required.");
    const value = Math.max(0, Math.min(2, Number(shields || 0)));
    if (!scenario.nextSegmentOverrides) scenario.nextSegmentOverrides = { shields: {} };
    if (!scenario.nextSegmentOverrides.shields) scenario.nextSegmentOverrides.shields = {};
    scenario.nextSegmentOverrides.shields[side] = value;
    if (scenario.lockedState?.side === side) {
      scenario.lockedState.shields = value;
      if (scenario.lockedState.combatant) scenario.lockedState.combatant.shields = value;
    }
    return scenario;
  }

  function continueWithIncoming(scenario) {
    if (!scenario || scenario.status !== "awaiting-incoming") {
      throw new Error("Scenario must be waiting for an incoming Pokemon.");
    }
    scenario.status = "active";
    scenario.awaitingSide = null;
    return scenario;
  }

  function setIncomingTransition(scenario, transition) {
    if (!scenario || !scenario.segments.length) throw new Error("A Scenario segment is required.");
    scenario.segments[scenario.segments.length - 1].transition = clone(transition || null);
    return scenario;
  }

  function endScenario(scenario) {
    if (!scenario) return null;
    scenario.status = "complete";
    scenario.awaitingSide = null;
    scenario.lockedState = null;
    return scenario;
  }

  return {
    SCHEMA_VERSION,
    createScenario,
    createPokemonState,
    createSegment,
    lockSegment,
    setNextSegmentShields,
    setIncomingTransition,
    continueWithIncoming,
    endScenario
  };
});
