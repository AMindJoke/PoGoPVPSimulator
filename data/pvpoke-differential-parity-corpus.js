"use strict";

const fs = require("fs");
const path = require("path");
const Translator = require("../tools/pvpoke-state-translator");

const ROOT = path.resolve(__dirname, "..");
const PVPOKE_REVISION = "5e1e3d971369a47aaf3e7247f50710d80205d570";
const TARGET_STATE_COUNT = 640;
const SEED = 27072026;

function buildDifferentialCorpus() {
  const data = loadRealData();
  const rng = mulberry32(SEED);
  const pokemon = data.rankings
    .filter(row => data.pokemonById.has(row.speciesId))
    .slice(0, 80);
  const fixtures = buildReviewedFixtures(data);
  const seen = new Set();
  for (const fixture of fixtures) seen.add(Translator.hashCanonicalState(fixture.state));
  let cursor = 0;

  while (fixtures.length < TARGET_STATE_COUNT && cursor < 5000) {
    const left = pokemon[cursor % pokemon.length];
    const right = pokemon[(cursor * 7 + 13) % pokemon.length];
    cursor++;
    if (!left || !right || left.speciesId === right.speciesId) continue;
    const stateIndex = fixtures.length;
    const fixture = buildFixture(stateIndex, left, right, data, rng);
    const hash = Translator.hashCanonicalState(fixture.state);
    if (seen.has(hash)) continue;
    seen.add(hash);
    fixtures.push(fixture);
  }

  return fixtures;
}

function buildReviewedFixtures(data) {
  return [
    buildKingdraTinkatonPrimaryBuildFixture(data)
  ];
}

function buildKingdraTinkatonPrimaryBuildFixture(data) {
  const kingdra = data.pokemonById.get("kingdra_shadow");
  const tinkaton = data.pokemonById.get("tinkaton");
  if (!kingdra || !tinkaton) throw new Error("Reviewed fixture requires kingdra_shadow and tinkaton data.");
  const a = {
    id: "kingdra_shadow",
    speciesId: "kingdra_shadow",
    name: "Kingdra (Shadow)",
    types: kingdra.types || ["water", "dragon"],
    level: 21,
    ivAtk: 5,
    ivDef: 15,
    ivHp: 12,
    cp: 1496,
    hp: 5,
    maxHp: 118,
    energy: 43,
    shields: 0,
    attack: 121.81930071,
    defense: 127.94087361,
    attackStage: 0,
    defenseStage: 0,
    readyTurn: 20,
    priority: 1,
    shadow: true,
    fastMove: normalizeMove(data.moveById.get("DRAGON_BREATH"), true),
    chargedMoves: ["SURF", "SWIFT"].map(id => normalizeMove(data.moveById.get(id), false)),
    baiting: "smart",
    shieldMode: "smart",
    optimizeMoveTiming: true,
    mechanicState: {}
  };
  const b = {
    id: "tinkaton",
    speciesId: "tinkaton",
    name: "Tinkaton",
    types: tinkaton.types || ["fairy", "steel"],
    level: 26,
    ivAtk: 0,
    ivDef: 10,
    ivHp: 14,
    cp: 1500,
    hp: 61,
    maxHp: 144,
    energy: 30,
    shields: 0,
    attack: 105.5805626,
    defense: 140.31997352,
    attackStage: 0,
    defenseStage: 0,
    readyTurn: 21,
    priority: 0,
    shadow: false,
    fastMove: normalizeMove(data.moveById.get("FAIRY_WIND"), true),
    chargedMoves: ["GIGATON_HAMMER", "BULLDOZE"].map(id => normalizeMove(data.moveById.get(id), false)),
    baiting: "smart",
    shieldMode: "smart",
    optimizeMoveTiming: true,
    mechanicState: {}
  };
  return {
    id: "reviewed-kingdra-shadow-tinkaton-primary-build-0s-adv3-turn20",
    suite: "PVPOKE_DIFFERENTIAL_PARITY",
    pvpokeRevision: PVPOKE_REVISION,
    source: "actual-pinned-pvpoke-runtime-reviewed-state",
    family: "primary-charged-build-before-forced-cheap-throw",
    categories: ["reviewed", "shields-down", "forced-throw", "primary-charged-build", "cmp-safe"],
    matchup: "kingdra_shadow_vs_tinkaton",
    options: {
      mode: "simulate",
      baiting: "smart",
      optimizeMoveTiming: true,
      farmEnergy: false
    },
    state: {
      currentTurn: 20,
      sides: { A: a, B: b },
      pendingEvents: [],
      cmpState: { readySides: ["A", "B"] }
    }
  };
}

function buildFixture(index, leftRanking, rightRanking, data, rng) {
  const category = categoryFor(index);
  const shieldPair = [[0, 0], [1, 1], [2, 2], [0, 1], [1, 0], [1, 2], [2, 1]][index % 7];
  const a = buildSide(leftRanking, "A", data, rng);
  const b = buildSide(rightRanking, "B", data, rng);
  mutateStateForCategory(category, a, b, shieldPair, index);
  return {
    id: `real-diff-${String(index + 1).padStart(3, "0")}`,
    suite: "PVPOKE_DIFFERENTIAL_PARITY",
    pvpokeRevision: PVPOKE_REVISION,
    source: "real-gamemaster-mutated-legal-state",
    family: category.family,
    categories: category.categories,
    matchup: `${a.id}_vs_${b.id}`,
    options: {
      mode: "simulate",
      baiting: category.categories.includes("bait-enabled") ? "always" : "smart",
      optimizeMoveTiming: !category.categories.includes("timing-disabled"),
      farmEnergy: category.categories.includes("farm-energy")
    },
    state: {
      currentTurn: category.turn,
      sides: { A: a, B: b },
      pendingEvents: category.categories.includes("pending-fast")
        ? [{
            id: `pending-${index}`,
            type: "fast-impact",
            sourceSide: "B",
            targetSide: "A",
            moveId: b.fastMove.id,
            startTurn: Math.max(0, category.turn - b.fastMove.turns),
            resolveTurn: category.turn,
            damage: estimateDamage(b, a, b.fastMove),
            status: "pending",
            source: "differential-corpus"
          }]
        : [],
      cmpState: {
        readySides: category.categories.includes("cmp") ? ["A", "B"] : []
      }
    }
  };
}

function buildSide(ranking, side, data, rng) {
  const species = data.pokemonById.get(ranking.speciesId);
  const moveset = ranking.moveset || data.defaultMovesets[ranking.speciesId] || [
    species.fastMoves[0],
    species.chargedMoves[0],
    species.chargedMoves[1] || species.chargedMoves[0]
  ];
  const fastMove = data.moveById.get(moveset[0]) || data.moveById.get(species.fastMoves[0]);
  const chargedMoves = moveset.slice(1, 3)
    .map(id => data.moveById.get(id))
    .filter(Boolean);
  const stats = ranking.stats || (species.defaultIVs?.cp1500
    ? statsFromSpecies(species, species.defaultIVs.cp1500)
    : { atk: 110 + Math.floor(rng() * 25), def: 110 + Math.floor(rng() * 25), hp: 130 + Math.floor(rng() * 35) });
  return {
    id: ranking.speciesId,
    speciesId: ranking.speciesId,
    name: species.speciesName,
    types: species.types || [],
    level: species.defaultIVs?.cp1500?.[0] || 50,
    ivAtk: species.defaultIVs?.cp1500?.[1] ?? 15,
    ivDef: species.defaultIVs?.cp1500?.[2] ?? 15,
    ivHp: species.defaultIVs?.cp1500?.[3] ?? 15,
    cp: 1500,
    hp: stats.hp,
    maxHp: stats.hp,
    energy: 0,
    shields: 1,
    attack: Number(stats.atk),
    defense: Number(stats.def),
    attackStage: 0,
    defenseStage: 0,
    readyTurn: 0,
    priority: side === "A" ? 1 : 0,
    shadow: ranking.speciesId.includes("_shadow"),
    fastMove: normalizeMove(fastMove, true),
    chargedMoves: chargedMoves.map(move => normalizeMove(move, false)),
    baiting: "smart",
    shieldMode: "smart",
    optimizeMoveTiming: true,
    mechanicState: {}
  };
}

function mutateStateForCategory(category, a, b, shieldPair, index) {
  a.shields = shieldPair[0];
  b.shields = shieldPair[1];
  a.energy = Math.min(100, category.energyA + (index % 5));
  b.energy = Math.min(100, category.energyB + ((index * 3) % 7));
  a.hp = Math.max(1, Math.min(a.maxHp, Math.floor(a.maxHp * category.hpA)));
  b.hp = Math.max(1, Math.min(b.maxHp, Math.floor(b.maxHp * category.hpB)));
  a.readyTurn = category.turn;
  b.readyTurn = category.turn + category.opponentCooldownTurns;
  a.attackStage = category.attackStageA || 0;
  a.defenseStage = category.defenseStageA || 0;
  b.attackStage = category.attackStageB || 0;
  b.defenseStage = category.defenseStageB || 0;
  a.baiting = category.categories.includes("bait-enabled") ? "always" : "smart";
  b.baiting = category.categories.includes("bait-enabled") ? "always" : "smart";
  a.optimizeMoveTiming = !category.categories.includes("timing-disabled");
  if (category.categories.includes("farm-energy")) a.mechanicState.farmEnergy = true;
  if (category.categories.includes("immediate-lethal")) {
    const lethal = a.chargedMoves.find(move => a.energy >= move.energyCost) || a.chargedMoves[0];
    b.hp = Math.max(1, estimateDamage(a, b, lethal) - 1);
    b.shields = 0;
  }
  if (category.categories.includes("forced-throw")) {
    a.hp = Math.max(1, estimateDamage(b, a, b.fastMove));
  }
}

function categoryFor(index) {
  const families = [
    { family: "battle-opening", turn: 0, energyA: 0, energyB: 0, hpA: 1, hpB: 1, opponentCooldownTurns: 0, categories: ["battle-start", "same-fast-duration"] },
    { family: "mid-energy-lead", turn: 12, energyA: 45, energyB: 20, hpA: .82, hpB: .88, opponentCooldownTurns: 1, categories: ["mid-battle", "energy-lead", "different-fast-duration"] },
    { family: "endgame-no-shield", turn: 32, energyA: 55, energyB: 45, hpA: .35, hpB: .28, opponentCooldownTurns: 2, categories: ["end-game", "shields-down", "forced-throw"] },
    { family: "bait-shields", turn: 20, energyA: 60, energyB: 40, hpA: .7, hpB: .75, opponentCooldownTurns: 0, categories: ["bait-enabled", "shields-up", "mid-battle"] },
    { family: "timing-window", turn: 18, energyA: 50, energyB: 35, hpA: .76, hpB: .72, opponentCooldownTurns: 3, categories: ["timing", "different-fast-duration"] },
    { family: "cmp-window", turn: 24, energyA: 70, energyB: 70, hpA: .55, hpB: .56, opponentCooldownTurns: 0, categories: ["cmp", "mid-battle"] },
    { family: "immediate-lethal", turn: 28, energyA: 70, energyB: 55, hpA: .45, hpB: .2, opponentCooldownTurns: 1, categories: ["immediate-lethal", "end-game"] },
    { family: "farm-down", turn: 36, energyA: 40, energyB: 20, hpA: .65, hpB: .08, opponentCooldownTurns: 1, categories: ["farm-down", "end-game"] },
    { family: "self-debuff-pressure", turn: 22, energyA: 85, energyB: 45, hpA: .8, hpB: .65, opponentCooldownTurns: 0, categories: ["self-debuffing-moves", "shields"] },
    { family: "pending-fast", turn: 16, energyA: 55, energyB: 30, hpA: .5, hpB: .5, opponentCooldownTurns: 0, categories: ["pending-fast", "timing"] },
    { family: "buff-debuff", turn: 26, energyA: 50, energyB: 60, hpA: .62, hpB: .62, opponentCooldownTurns: 2, attackStageA: 1, defenseStageB: -1, categories: ["buff", "debuff", "mid-battle"] },
    { family: "long-match", turn: 10, energyA: 35, energyB: 35, hpA: 1, hpB: 1, opponentCooldownTurns: 0, categories: ["long-match", "battle-start"] }
  ];
  return families[index % families.length];
}

function normalizeMove(move, fast) {
  return {
    id: move.moveId,
    moveId: move.moveId,
    name: move.name,
    type: move.type,
    power: Number(move.power || 0),
    damage: Number(move.power || 0),
    energyCost: fast ? 0 : Number(move.energy || 0),
    energy: fast ? 0 : Number(move.energy || 0),
    energyGain: Number(move.energyGain || 0),
    cooldown: Number(move.cooldown || (fast ? 1000 : 500)),
    turns: Number(move.turns || ((move.cooldown || (fast ? 1000 : 500)) / 500)),
    buffs: move.buffs || [0, 0],
    buffTarget: move.buffTarget || null,
    buffApplyChance: Number(move.buffApplyChance || 0)
  };
}

function estimateDamage(attacker, defender, move) {
  const power = Number(move.power || move.damage || 0);
  if (!power) return 0;
  const attack = Number(attacker.attack || 100) * statMultiplier(attacker.attackStage) * (attacker.shadow ? 1.2 : 1);
  const defense = Number(defender.defense || 100) * statMultiplier(defender.defenseStage) * (defender.shadow ? 0.83333331 : 1);
  const stab = attacker.types?.includes(move.type) ? 1.2000000476837158203125 : 1;
  const effectiveness = typeEffectiveness(move.type, defender.types || []);
  return Math.floor(power * stab * (attack / Math.max(1, defense)) * effectiveness * 0.5 * 1.2999999523162842) + 1;
}

function typeEffectiveness(moveType, defenderTypes = []) {
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

function statMultiplier(stage = 0) {
  const value = Math.max(-4, Math.min(4, Number(stage || 0)));
  return value > 0 ? (4 + value) / 4 : 4 / (4 - value);
}

function statsFromSpecies(species, ivs) {
  const [level, atkIv, defIv, hpIv] = ivs;
  const cpm = cpmByLevel(level);
  return {
    atk: Number(((species.baseStats.atk + atkIv) * cpm).toFixed(1)),
    def: Number(((species.baseStats.def + defIv) * cpm).toFixed(1)),
    hp: Math.max(10, Math.floor((species.baseStats.hp + hpIv) * cpm))
  };
}

function cpmByLevel(level) {
  const cpms = [0.0939999967813491, 0.135137430784308, 0.166397869586944, 0.192650914456886, 0.215732470154762, 0.236572655026622, 0.255720049142837, 0.273530381100769, 0.290249884128570, 0.306057381335773, 0.321087598800659, 0.335445032295077, 0.349212676286697, 0.362457748778790, 0.375235587358474, 0.387592411085168, 0.399567276239395, 0.411193549517250, 0.422500014305114, 0.432926413410414, 0.443107545375824, 0.453059953871985, 0.462798386812210, 0.472336077786704, 0.481684952974319, 0.490855810259008, 0.499858438968658, 0.508701756943992, 0.517393946647644, 0.525942508771329, 0.534354329109191, 0.542635762230353, 0.550792694091796, 0.558830599438087, 0.566754519939422, 0.574569148039264, 0.582278907299041, 0.589887911977272, 0.597400009632110, 0.604823657502073, 0.612157285213470, 0.619404110566050, 0.626567125320434, 0.633649181622743, 0.640652954578399, 0.647580963301656, 0.654435634613037, 0.661219263506722, 0.667934000492096, 0.674581899290818, 0.681164920330047, 0.687684905887771, 0.694143652915954, 0.700542893277978, 0.706884205341339, 0.713169102333341, 0.719399094581604, 0.725575616972598, 0.731700003147125, 0.734741011137376, 0.737769484519958, 0.740785574597326, 0.743789434432983, 0.746781208702482, 0.749761044979095, 0.752729105305821, 0.755685508251190, 0.758630366519684, 0.761563837528228, 0.764486065255226, 0.767397165298461, 0.770297273971590, 0.773186504840850, 0.776064945942412, 0.778932750225067, 0.781790064808426, 0.784636974334716, 0.787473583646825, 0.790300011634826, 0.792803950958807, 0.795300006866455, 0.797803921486970, 0.800300002098083, 0.802803892322847, 0.805299997329711, 0.807803863460723, 0.810299992561340, 0.812803834895026, 0.815299987792968, 0.817803806620319, 0.820299983024597, 0.822803778631297, 0.825299978256225, 0.827803750922782, 0.830299973487854, 0.832803753381377, 0.835300028324127, 0.837803755931569, 0.840300023555755, 0.842803729034748, 0.845300018787384, 0.847803702398935, 0.850300014019012, 0.852803676019539, 0.855300009250640, 0.857803649892077, 0.860300004482269, 0.862803624012168, 0.865299999713897];
  return cpms[Math.max(0, Math.min(cpms.length - 1, Math.round((Number(level || 1) - 1) * 2)))] || cpms[cpms.length - 1];
}

function loadRealData() {
  const gamemaster = JSON.parse(fs.readFileSync(path.join(ROOT, "gamemaster.json"), "utf8"));
  const rankings = JSON.parse(fs.readFileSync(path.join(ROOT, "pvpoke-rankings-1500.json"), "utf8"));
  return {
    gamemaster,
    rankings,
    pokemonById: new Map(gamemaster.pokemon.map(pokemon => [pokemon.speciesId, pokemon])),
    moveById: new Map(gamemaster.moves.map(move => [move.moveId, move])),
    defaultMovesets: loadDefaultMovesets()
  };
}

function loadDefaultMovesets() {
  const source = fs.readFileSync(path.join(ROOT, "pvpoke-default-movesets.js"), "utf8");
  const json = source.replace(/^.*?=\s*/s, "").replace(/;\s*$/s, "");
  const parsed = JSON.parse(json);
  return Object.fromEntries(Object.entries(parsed).map(([id, moves]) => [id, [moves.fast, ...(moves.charged || [])]]));
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return function next() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = {
  PVPOKE_REVISION,
  TARGET_STATE_COUNT,
  SEED,
  buildDifferentialCorpus,
  estimateDamage
};
