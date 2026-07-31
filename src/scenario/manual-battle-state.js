(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualBattleState = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REVIEW_MODE = Object.freeze({
    MANUAL: "manual",
    AUTOMATIC: "automatic"
  });

  function integer(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : Math.round(Number(fallback) || 0);
  }

  function clampInteger(value, minimum, maximum, fallback = minimum) {
    return Math.max(minimum, Math.min(maximum, integer(value, fallback)));
  }

  function normalizeReviewMode(value, fallback = REVIEW_MODE.MANUAL) {
    return Object.values(REVIEW_MODE).includes(value) ? value : fallback;
  }

  function normalizeManualBattleState(combatant, patch = {}) {
    if (!combatant?.p?.id) throw new Error("ACTIVE_POKEMON_REQUIRED");
    const maxHp = Math.max(1, integer(combatant.maxHp, 1));
    const hp = clampInteger(patch.hp ?? combatant.hp, 0, maxHp, combatant.hp);
    return Object.freeze({
      pokemonId: combatant.p.id,
      hp,
      maxHp,
      energy: clampInteger(patch.energy ?? combatant.energy, 0, 100, combatant.energy),
      attackStage: clampInteger(patch.attackStage ?? combatant.attackStage, -4, 4, combatant.attackStage),
      defenseStage: clampInteger(patch.defenseStage ?? combatant.defenseStage, -4, 4, combatant.defenseStage),
      shields: clampInteger(patch.shields ?? combatant.shields, 0, 2, combatant.shields),
      fainted: hp <= 0
    });
  }

  function applyManualBattleState(combatant, patch = {}) {
    const normalized = normalizeManualBattleState(combatant, patch);
    combatant.hp = normalized.hp;
    combatant.energy = normalized.energy;
    combatant.attackStage = normalized.attackStage;
    combatant.defenseStage = normalized.defenseStage;
    combatant.shields = normalized.shields;
    return normalized;
  }

  function prepareIncomingCombatant(combatant, patch = {}) {
    if (!combatant?.p?.id) throw new Error("ACTIVE_POKEMON_REQUIRED");
    return applyManualBattleState(combatant, {
      hp: patch.fullHp === false ? patch.hp : combatant.maxHp,
      energy: patch.energy ?? 0,
      attackStage: patch.attackStage ?? 0,
      defenseStage: patch.defenseStage ?? 0,
      shields: patch.shields ?? combatant.shields
    });
  }

  function eligibleIncomingPokemon(pokemon, excludedIds = []) {
    const excluded = new Set((excludedIds || []).filter(Boolean));
    return (pokemon || []).filter(candidate => candidate?.id && !excluded.has(candidate.id));
  }

  return Object.freeze({
    REVIEW_MODE,
    integer,
    clampInteger,
    normalizeReviewMode,
    normalizeManualBattleState,
    applyManualBattleState,
    prepareIncomingCombatant,
    eligibleIncomingPokemon
  });
});
