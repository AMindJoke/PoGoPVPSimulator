(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./manual-battle-timing.js") : root.PvPeakManualBattleTiming,
    typeof module === "object" && module.exports ? require("./turn-resolution-engine.js") : root.PvPeakTurnEngine
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualSwitching = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Timing, TurnEngine) {
  "use strict";

  const SIDES = Object.freeze(["A", "B"]);
  const MAX_TEAM_SIZE = 3;
  const REASON = Object.freeze({
    OK: "OK",
    INVALID_SIDE: "INVALID_SIDE",
    BATTLE_ENDED: "BATTLE_ENDED",
    FAINTED_ACTIVE: "FAINTED_ACTIVE",
    NO_BENCH: "NO_BENCH",
    COOLDOWN: "SWITCH_COOLDOWN",
    ACTION_LOCKED: "ACTION_LOCKED",
    CHARGED_PENDING: "CHARGED_SEQUENCE_PENDING",
    INVALID_TARGET: "INVALID_SWITCH_TARGET"
  });

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function createState(input = {}) {
    return {
      version: 1,
      A: { bench: clone(input.A?.bench || []) },
      B: { bench: clone(input.B?.bench || []) }
    };
  }

  function pokemonId(combatant) {
    return combatant?.p?.id || combatant?.pokemonId || null;
  }

  function validBench(state, side) {
    return createState(state)[side]?.bench.filter(combatant => pokemonId(combatant) && Number(combatant.hp || 0) > 0) || [];
  }

  function teamSize(state, side, active) {
    const ids = new Set([pokemonId(active), ...createState(state)[side].bench.map(pokemonId)].filter(Boolean));
    return ids.size;
  }

  function resetFastCycleState(combatant) {
    if (!combatant) return combatant;
    combatant.timingPlanMoveId = null;
    combatant.timingPlanFastMovesRemaining = 0;
    if (Object.prototype.hasOwnProperty.call(combatant, "fastMoveCycleProgress")) {
      combatant.fastMoveCycleProgress = 0;
    }
    return combatant;
  }

  function legality(input = {}) {
    const side = input.side;
    if (!SIDES.includes(side)) return { legal: false, reason: REASON.INVALID_SIDE, remainingMs: Infinity };
    if (input.battleEnded) return { legal: false, reason: REASON.BATTLE_ENDED, remainingMs: 0 };
    if (Number(input.active?.hp || 0) <= 0) return { legal: false, reason: REASON.FAINTED_ACTIVE, remainingMs: 0 };
    if (input.chargedPending) return { legal: false, reason: REASON.CHARGED_PENDING, remainingMs: 0 };
    if (!input.actionReady) return { legal: false, reason: REASON.ACTION_LOCKED, remainingMs: 0 };
    const remainingMs = Timing.remainingSwitchMs(input.timing, side);
    if (remainingMs > 0) return { legal: false, reason: REASON.COOLDOWN, remainingMs };
    const candidates = validBench(input.switchState, side);
    const canAdd = teamSize(input.switchState, side, input.active) < MAX_TEAM_SIZE;
    if (!candidates.length && !canAdd) return { legal: false, reason: REASON.NO_BENCH, remainingMs: 0 };
    const postCharged = Timing.postChargedSwitchEligible(input.timing, side);
    return {
      legal: true,
      reason: REASON.OK,
      remainingMs: 0,
      candidates,
      canAdd,
      postCharged,
      turnCost: TurnEngine?.swapTurnCost?.({ postCharged }) ?? (postCharged ? 0 : 1)
    };
  }

  function switchActive(input = {}) {
    const side = input.side;
    if (!SIDES.includes(side)) throw new Error(REASON.INVALID_SIDE);
    const state = createState(input.switchState);
    const bench = state[side].bench;
    const targetId = input.incomingId;
    const index = bench.findIndex(candidate => pokemonId(candidate) === targetId && Number(candidate.hp || 0) > 0);
    if (index < 0) throw new Error(REASON.INVALID_TARGET);
    const outgoing = clone(input.active);
    const incoming = clone(bench[index]);
    resetFastCycleState(outgoing);
    resetFastCycleState(incoming);
    // Pokémon GO clears temporary Attack and Defense stages when a Pokémon leaves play.
    outgoing.attackStage = 0;
    outgoing.defenseStage = 0;
    incoming.attackStage = 0;
    incoming.defenseStage = 0;
    bench.splice(index, 1, outgoing);
    const postCharged = Timing.postChargedSwitchEligible(input.timing, side);
    const turnCost = TurnEngine?.swapTurnCost?.({ postCharged }) ?? (postCharged ? 0 : 1);
    const windowTiming = postCharged
      ? Timing.consumePostChargedSwitch(input.timing, side)
      : Timing.closePostChargedSwitchWindow(input.timing);
    return {
      active: incoming,
      outgoing,
      switchState: state,
      timing: Timing.startSwitchCooldown(windowTiming, side),
      turnCost,
      postCharged
    };
  }

  function addBenchPokemon(state, side, active, combatant) {
    if (!SIDES.includes(side)) throw new Error(REASON.INVALID_SIDE);
    const next = createState(state);
    const id = pokemonId(combatant);
    if (!id) throw new Error(REASON.INVALID_TARGET);
    if (teamSize(next, side, active) >= MAX_TEAM_SIZE) return next;
    if (!next[side].bench.some(candidate => pokemonId(candidate) === id) && pokemonId(active) !== id) {
      next[side].bench.push(clone(combatant));
    }
    return next;
  }

  return Object.freeze({ MAX_TEAM_SIZE, REASON, createState, validBench, teamSize, legality, switchActive, addBenchPokemon });
});
