"use strict";

const crypto = require("crypto");

const EXACT = "EXACT";
const NORMALIZED_EQUIVALENT = "NORMALIZED_EQUIVALENT";
const MECHANICS_NOT_REPRESENTABLE = "MECHANICS_NOT_REPRESENTABLE";
const INVALID_FIXTURE = "INVALID_FIXTURE";

function translateFixtureToPvPoke(fixture = {}) {
  const simulatorState = fixture.state || {};
  const unsupportedFields = [];
  const translationNotes = [];
  try {
    const currentTurn = Number(simulatorState.currentTurn || 0);
    const a = translateSide(simulatorState.sides?.A, 0, currentTurn, unsupportedFields, translationNotes);
    const b = translateSide(simulatorState.sides?.B, 1, currentTurn, unsupportedFields, translationNotes);
    if (!a || !b) {
      return result(fixture, simulatorState, null, translationNotes, unsupportedFields, INVALID_FIXTURE);
    }
    if (Array.isArray(simulatorState.pendingEvents) && simulatorState.pendingEvents.length) {
      unsupportedFields.push("pendingEvents");
      translationNotes.push("Pending fast impacts are represented as PvPoke cooldown/queuedActions only when directly expressible.");
    }
    const pvpokeState = {
      currentTurn: Number(simulatorState.currentTurn || 0),
      mode: fixture.options?.mode || "simulate",
      pokemon: [a, b],
      queuedActions: translateQueuedActions(simulatorState),
      cmp: simulatorState.cmpState || null
    };
    const status = unsupportedFields.length ? NORMALIZED_EQUIVALENT : EXACT;
    return result(fixture, simulatorState, pvpokeState, translationNotes, unsupportedFields, status);
  } catch (error) {
    translationNotes.push(error.message);
    return result(fixture, simulatorState, null, translationNotes, unsupportedFields, INVALID_FIXTURE);
  }
}

function translateSide(side, index, currentTurn, unsupportedFields, translationNotes) {
  if (!side) return null;
  const fastMove = toPvPokeMove(side.fastMove, true);
  const chargedMoves = (side.chargedMoves || []).filter(Boolean).map(move => toPvPokeMove(move, false));
  for (const move of [fastMove, ...chargedMoves].filter(Boolean)) {
    move.stab = side.types?.includes(move.type) ? 1.2000000476837158203125 : 1;
  }
  if (!fastMove || !chargedMoves.length) translationNotes.push(`Side ${index} has incomplete move data.`);
  const fastestChargedMove = [...chargedMoves].sort((a, b) => a.energy - b.energy || a.moveId.localeCompare(b.moveId))[0] || null;
  const bestChargedMove = [...chargedMoves].sort((a, b) =>
    (b.dpe || 0) - (a.dpe || 0) || a.energy - b.energy || a.moveId.localeCompare(b.moveId)
  )[0] || fastestChargedMove;
  if (side.mechanicState && Object.keys(side.mechanicState).length) unsupportedFields.push(`side${index}.mechanicState`);
  const translated = {
    index,
    speciesId: side.id || side.speciesId || side.pokemonId || `side-${index}`,
    speciesName: side.name || side.speciesName || side.id || `Side ${index}`,
    activeFormId: side.formId || side.currentFormId || side.id || null,
    types: side.types || [],
    shadow: !!side.shadow || String(side.id || "").includes("_shadow"),
    shadowType: (!!side.shadow || String(side.id || "").includes("_shadow")) ? "shadow" : "normal",
    shadowAtkMult: (!!side.shadow || String(side.id || "").includes("_shadow")) ? 1.2 : 1,
    shadowDefMult: (!!side.shadow || String(side.id || "").includes("_shadow")) ? 0.83333331 : 1,
    hp: Number(side.hp || 0),
    shields: Number(side.shields || 0),
    energy: Number(side.energy || 0),
    stats: {
      atk: Number(side.attack || side.stats?.atk || 100),
      def: Number(side.defense || side.stats?.def || 100),
      hp: Number(side.maxHp || side.stats?.hp || side.hp || 100)
    },
    statBuffs: [Number(side.attackStage || 0), Number(side.defenseStage || 0)],
    cooldown: Math.max(0, Number(side.cooldown ?? Math.max(0, Number(side.readyTurn || 0) - currentTurn) * 500)),
    priority: Number(side.priority ?? 0),
    fastMove,
    chargedMoves,
    activeChargedMoves: chargedMoves,
    fastestChargedMove,
    bestChargedMove,
    baitShields: baitPolicy(side.baiting),
    farmEnergy: side.mechanicState?.farmEnergy === true || side.linePolicy === "farm-energy",
    optimizeMoveTiming: side.optimizeMoveTiming !== false,
    turnsToKO: Number(side.turnsToKO ?? -1),
    formChange: side.formChange || side.mechanicState?.formChange || null,
    applyStatBuffs(buffs = [0, 0]) {
      this.statBuffs = [
        Math.max(-4, Math.min(4, Number(this.statBuffs[0] || 0) + Number(buffs[0] || 0))),
        Math.max(-4, Math.min(4, Number(this.statBuffs[1] || 0) + Number(buffs[1] || 0)))
      ];
    },
    getBoostMove() {
      return this.chargedMoves.find(move => move.selfBuffing) || null;
    },
    getEffectiveStat(statIndex) {
      const base = statIndex === 0 ? this.stats.atk : this.stats.def;
      let multiplier = statBuffMultiplier(this.statBuffs[statIndex]);
      if (this.shadowType === "shadow") multiplier *= statIndex === 0 ? this.shadowAtkMult : this.shadowDefMult;
      return base * multiplier;
    },
    getFormStats() {
      return this.stats;
    }
  };
  translated.typeEffectiveness = buildTypeEffectiveness(translated.types);
  return translated;
}

function toPvPokeMove(move, fast) {
  if (!move) return null;
  const energy = fast ? 0 : Number(move.energyCost ?? move.energy ?? 0);
  const power = Number(move.power ?? move.damage ?? 0);
  const normalized = {
    ...move,
    moveId: move.moveId || move.id,
    id: move.id || move.moveId,
    name: move.name || move.moveId || move.id,
    type: move.type || "normal",
    power,
    damage: Number(move.damage ?? move.referenceDamage ?? power),
    referenceDamage: typeof move.referenceDamage === "number" ? move.referenceDamage : undefined,
    energy,
    energyGain: Number(move.energyGain || 0),
    cooldown: Number(move.cooldown ?? (move.turns ? move.turns * 500 : fast ? 1000 : 500)),
    turns: Number(move.turns || (move.cooldown ? move.cooldown / 500 : fast ? 2 : 1)),
    buffs: Array.isArray(move.buffs) ? move.buffs : [0, 0],
    buffTarget: move.buffTarget || null,
    buffApplyChance: Number(move.buffApplyChance || 0)
  };
  normalized.dpe = normalized.energy ? normalized.damage / normalized.energy : 0;
  normalized.selfDebuffing = normalized.buffTarget === "self" && normalized.buffs.some(value => Number(value) < 0);
  normalized.selfAttackDebuffing = normalized.buffTarget === "self" && Number(normalized.buffs[0] || 0) < 0;
  normalized.selfBuffing = normalized.buffTarget === "self" && normalized.buffs.some(value => Number(value) > 0);
  return normalized;
}

function statBuffMultiplier(stage = 0) {
  const divisor = 4;
  const value = Math.max(-4, Math.min(4, Number(stage || 0)));
  return value > 0 ? (divisor + value) / divisor : divisor / (divisor - value);
}

function buildTypeEffectiveness(types = []) {
  const allTypes = ["bug", "dark", "dragon", "electric", "fairy", "fighting", "fire", "flying", "ghost", "grass", "ground", "ice", "normal", "poison", "psychic", "rock", "steel", "water"];
  return Object.fromEntries(allTypes.map(type => [type, effectiveness(type, types)]));
}

function effectiveness(moveType, defenderTypes = []) {
  return defenderTypes.reduce((value, targetType) => value * typeMultiplier(moveType, targetType), 1);
}

function typeMultiplier(moveType, targetType) {
  const traits = {
    normal: { weaknesses: ["fighting"], resistances: [], immunities: ["ghost"] },
    fighting: { weaknesses: ["flying", "psychic", "fairy"], resistances: ["rock", "bug", "dark"], immunities: [] },
    flying: { weaknesses: ["rock", "electric", "ice"], resistances: ["fighting", "bug", "grass"], immunities: ["ground"] },
    poison: { weaknesses: ["ground", "psychic"], resistances: ["fighting", "poison", "bug", "fairy", "grass"], immunities: [] },
    ground: { weaknesses: ["water", "grass", "ice"], resistances: ["poison", "rock"], immunities: ["electric"] },
    rock: { weaknesses: ["fighting", "ground", "steel", "water", "grass"], resistances: ["normal", "flying", "poison", "fire"], immunities: [] },
    bug: { weaknesses: ["flying", "rock", "fire"], resistances: ["fighting", "ground", "grass"], immunities: [] },
    ghost: { weaknesses: ["ghost", "dark"], resistances: ["poison", "bug"], immunities: ["normal", "fighting"] },
    steel: { weaknesses: ["fighting", "ground", "fire"], resistances: ["normal", "flying", "rock", "bug", "steel", "grass", "psychic", "ice", "dragon", "fairy"], immunities: ["poison"] },
    fire: { weaknesses: ["ground", "rock", "water"], resistances: ["bug", "steel", "fire", "grass", "ice", "fairy"], immunities: [] },
    water: { weaknesses: ["grass", "electric"], resistances: ["steel", "fire", "water", "ice"], immunities: [] },
    grass: { weaknesses: ["flying", "poison", "bug", "fire", "ice"], resistances: ["ground", "water", "grass", "electric"], immunities: [] },
    electric: { weaknesses: ["ground"], resistances: ["flying", "steel", "electric"], immunities: [] },
    psychic: { weaknesses: ["bug", "ghost", "dark"], resistances: ["fighting", "psychic"], immunities: [] },
    ice: { weaknesses: ["fighting", "fire", "steel", "rock"], resistances: ["ice"], immunities: [] },
    dragon: { weaknesses: ["dragon", "ice", "fairy"], resistances: ["fire", "water", "grass", "electric"], immunities: [] },
    dark: { weaknesses: ["fighting", "fairy", "bug"], resistances: ["ghost", "dark"], immunities: ["psychic"] },
    fairy: { weaknesses: ["poison", "steel"], resistances: ["fighting", "bug", "dark"], immunities: ["dragon"] }
  }[String(targetType || "").toLowerCase()] || { weaknesses: [], resistances: [], immunities: [] };
  const move = String(moveType || "").toLowerCase();
  if (traits.weaknesses.includes(move)) return 1.60000002384185791015625;
  if (traits.resistances.includes(move)) return 0.625;
  if (traits.immunities.includes(move)) return 0.390625;
  return 1;
}

function baitPolicy(value) {
  if (value === "always" || value === 2) return 2;
  if (value === true || value === "on" || value === "smart") return 1;
  return 0;
}

function translateQueuedActions(state = {}) {
  return (state.pendingEvents || []).filter(event => event?.type === "fast-impact").map(event => ({
    type: "fast",
    actor: event.sourceSide === "B" ? 1 : 0,
    turn: Number(event.resolveTurn || 0)
  }));
}

function result(fixture, simulatorState, pvpokeState, translationNotes, unsupportedFields, stateEquivalenceStatus) {
  return {
    fixtureId: fixture.id,
    simulatorState,
    pvpokeState,
    translationNotes,
    unsupportedFields,
    stateEquivalenceStatus,
    canonicalStateHash: hash({ simulatorState, pvpokeState, stateEquivalenceStatus })
  };
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 24);
}

function stable(value) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stable);
  return Object.fromEntries(Object.keys(value).sort().map(key => {
    if (typeof value[key] === "function") return [key, "[function]"];
    return [key, stable(value[key])];
  }));
}

module.exports = {
  EXACT,
  NORMALIZED_EQUIVALENT,
  MECHANICS_NOT_REPRESENTABLE,
  INVALID_FIXTURE,
  translateFixtureToPvPoke,
  hashCanonicalState: hash
};
