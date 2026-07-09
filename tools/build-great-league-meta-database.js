const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const INCLUDE_MATCHUPS = process.argv.includes("--include-matchups");
const CP_CAP = 1500;
const DAMAGE_BONUS = 1.2999999523162842;
const SHADOW_ATK = 1.2;
const SHADOW_DEF = 0.83333331;

const cpMultipliers = [
  [1,.094],[1.5,.135137432],[2,.16639787],[2.5,.192650919],[3,.21573247],[3.5,.236572661],
  [4,.25572005],[4.5,.273530381],[5,.29024988],[5.5,.306057377],[6,.3210876],[6.5,.335445036],
  [7,.34921268],[7.5,.362457751],[8,.37523559],[8.5,.387592406],[9,.39956728],[9.5,.411193551],
  [10,.42250001],[10.5,.432926419],[11,.44310755],[11.5,.453059958],[12,.46279839],[12.5,.472336083],
  [13,.48168495],[13.5,.4908558],[14,.49985844],[14.5,.508701765],[15,.51739395],[15.5,.525942511],
  [16,.53435433],[16.5,.542635767],[17,.55079269],[17.5,.558830576],[18,.56675452],[18.5,.574569153],
  [19,.58227891],[19.5,.589887917],[20,.59740001],[20.5,.604818814],[21,.61215729],[21.5,.619399365],
  [22,.62656713],[22.5,.633644533],[23,.64065295],[23.5,.647576426],[24,.65443563],[24.5,.661214806],
  [25,.667934],[25.5,.674577537],[26,.68116492],[26.5,.687680648],[27,.69414365],[27.5,.700538673],
  [28,.70688421],[28.5,.713164996],[29,.71939909],[29.5,.725571552],[30,.7317],[30.5,.734741009],
  [31,.73776948],[31.5,.740785574],[32,.74378943],[32.5,.746781211],[33,.74976104],[33.5,.752729087],
  [34,.75568551],[34.5,.758630378],[35,.76156384],[35.5,.764486065],[36,.76739717],[36.5,.770297266],
  [37,.7731865],[37.5,.776064962],[38,.77893275],[38.5,.781790055],[39,.78463697],[39.5,.787473578],
  [40,.79030001],[40.5,.79280395],[41,.79530001],[41.5,.7978039],[42,.8003],[42.5,.8028039],
  [43,.8053],[43.5,.8078039],[44,.81029999],[44.5,.8128039],[45,.81529999],[45.5,.8178039],
  [46,.82029999],[46.5,.8228039],[47,.82529999],[47.5,.8278039],[48,.83029999],[48.5,.8328039],
  [49,.83529999],[49.5,.8378039],[50,.84029999],[50.5,.8428039],[51,.84530001]
];

const strong = {
  bug:["dark","grass","psychic"], dark:["ghost","psychic"], dragon:["dragon"], electric:["flying","water"],
  fairy:["dark","dragon","fighting"], fighting:["dark","ice","normal","rock","steel"], fire:["bug","grass","ice","steel"],
  flying:["bug","fighting","grass"], ghost:["ghost","psychic"], grass:["ground","rock","water"], ground:["electric","fire","poison","rock","steel"],
  ice:["dragon","flying","grass","ground"], normal:[], poison:["fairy","grass"], psychic:["fighting","poison"], rock:["bug","fire","flying","ice"],
  steel:["fairy","ice","rock"], water:["fire","ground","rock"]
};
const weak = {
  bug:["fairy","fighting","fire","flying","ghost","poison","steel"], dark:["dark","fairy","fighting"], dragon:["steel"],
  electric:["dragon","electric","grass"], fairy:["fire","poison","steel"], fighting:["bug","fairy","flying","poison","psychic"],
  fire:["dragon","fire","rock","water"], flying:["electric","rock","steel"], ghost:["dark"], grass:["bug","dragon","fire","flying","grass","poison","steel"],
  ground:["bug","grass"], ice:["fire","ice","steel","water"], normal:["rock","steel"], poison:["ghost","ground","poison","rock"],
  psychic:["psychic","steel"], rock:["fighting","ground","steel"], steel:["electric","fire","steel","water"], water:["dragon","grass","water"]
};
const immune = {
  dragon:["fairy"], electric:["ground"], fighting:["ghost"], ghost:["normal"], normal:["ghost"], poison:["steel"], psychic:["dark"], ground:["flying"]
};

function readGlobalScript(file, globalName) {
  const code = fs.readFileSync(path.join(ROOT, file), "utf8");
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: file });
  return context.window[globalName] || context[globalName];
}

function pokemonStatsAtLevel(p, ivAtk, ivDef, ivHp, level, cpm) {
  const attack = (p.atk + ivAtk) * cpm;
  const defense = (p.def + ivDef) * cpm;
  const hp = Math.max(10, Math.floor((p.hp + ivHp) * cpm));
  const cp = Math.max(10, Math.floor((p.atk + ivAtk) * Math.sqrt(p.def + ivDef) * Math.sqrt(p.hp + ivHp) * cpm * cpm / 10));
  return { level, cp, attack, defense, hp, ivAtk, ivDef, ivHp, statProduct: attack * defense * hp };
}

function bestStatsForIvs(p, ivAtk, ivDef, ivHp) {
  let best = null;
  for (const [level, cpm] of cpMultipliers) {
    const stats = pokemonStatsAtLevel(p, ivAtk, ivDef, ivHp, level, cpm);
    if (stats.cp <= CP_CAP) best = stats;
    else break;
  }
  return best || pokemonStatsAtLevel(p, ivAtk, ivDef, ivHp, cpMultipliers[0][0], cpMultipliers[0][1]);
}

function rank1Stats(p) {
  let best = null;
  for (let atk = 0; atk <= 15; atk++) {
    for (let def = 0; def <= 15; def++) {
      for (let hp = 0; hp <= 15; hp++) {
        const stats = bestStatsForIvs(p, atk, def, hp);
        if (!best || stats.statProduct > best.statProduct) best = stats;
      }
    }
  }
  return best;
}

function defaultStats(p) {
  const defaults = p.defaultIVs && p.defaultIVs.cp1500 ? p.defaultIVs.cp1500 : null;
  return bestStatsForIvs(p, defaults ? defaults[1] : 0, defaults ? defaults[2] : 15, defaults ? defaults[3] : 15);
}

function effectiveness(moveType, defenderTypes) {
  return defenderTypes.reduce((total, type) => {
    if ((strong[moveType] || []).includes(type)) total *= 1.6;
    if ((weak[moveType] || []).includes(type)) total *= 0.625;
    if ((immune[moveType] || []).includes(type)) total *= 0.625;
    return total;
  }, 1);
}

function moveDamage(attacker, defender, move) {
  if (!move || !move.power) return 1;
  const stab = attacker.types.includes(move.type) ? 1.2 : 1;
  const shadowAtk = attacker.id.includes("shadow") ? SHADOW_ATK : 1;
  const shadowDef = defender.id.includes("shadow") ? SHADOW_DEF : 1;
  const raw = move.power * attacker.stats.default.attack * shadowAtk * DAMAGE_BONUS * 0.5 / (defender.stats.default.defense * shadowDef) * stab * effectiveness(move.type, defender.types);
  return Math.max(1, Math.floor(raw) + 1);
}

function fastScore(move, p) {
  if (!move) return 0;
  const turns = Math.max(1, move.turns || 1);
  const stab = p.types.includes(move.type) ? 1.2 : 1;
  return (move.power || 0) * stab / turns + (move.energyGain || 0) / turns * 1.8;
}

function chargedScore(move, p) {
  if (!move) return 0;
  const cost = Math.max(1, move.energy || 1);
  const stab = p.types.includes(move.type) ? 1.2 : 1;
  return (move.power || 0) * stab / cost;
}

function standardMovesetFor(p, standardMovesets) {
  return standardMovesets[p.id] || standardMovesets[p.id.replace(/_shadow$/, "")] || null;
}

function selectMoves(p, moveMap, standardMovesets) {
  const standard = standardMovesetFor(p, standardMovesets);
  const fastId = standard && p.fast.includes(standard.fast)
    ? standard.fast
    : [...p.fast].sort((a, b) => fastScore(moveMap[b], p) - fastScore(moveMap[a], p))[0];
  const chargedIds = standard
    ? (standard.charged || []).filter(id => p.charged.includes(id)).slice(0, 2)
    : [];
  while (chargedIds.length < 2) {
    const next = [...p.charged]
      .filter(id => !chargedIds.includes(id))
      .sort((a, b) => chargedScore(moveMap[b], p) - chargedScore(moveMap[a], p))[0];
    if (!next) break;
    chargedIds.push(next);
  }
  return { fast: fastId, charged: chargedIds };
}

function signalMatchupScore(attacker, defender) {
  const chargedDamage = attacker.moves.charged
    .map(id => moveDamage(attacker, defender, attacker.moveMap[id]))
    .sort((a, b) => b - a)[0] || 1;
  const fastDamage = moveDamage(attacker, defender, attacker.moveMap[attacker.moves.fast]);
  const hpPressure = chargedDamage / Math.max(1, defender.stats.default.hp);
  const fastPressure = fastDamage / Math.max(1, defender.stats.default.hp);
  const bulkEdge = attacker.stats.default.statProduct / Math.max(1, defender.stats.default.statProduct);
  return Math.round(500 + (hpPressure - 0.35) * 220 + (fastPressure - 0.025) * 850 + (bulkEdge - 1) * 130);
}

function main() {
  const gm = readGlobalScript("gamemaster-data.js", "PVPOKE_GAMEMASTER");
  const standardMovesets = readGlobalScript("pvpoke-default-movesets.js", "PVPOKE_DEFAULT_MOVESETS") || {};
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "great-league-meta.json"), "utf8"));
  const moveMap = Object.fromEntries(gm.moves.map(move => [move.moveId, {
    id: move.moveId,
    name: move.name || move.moveId,
    type: move.type,
    power: Number(move.power || 0),
    energy: Math.max(0, Number(move.energy || 0)),
    energyGain: Number(move.energyGain || 0),
    turns: Number(move.turns || Math.max(1, Math.round(Number(move.cooldown || 500) / 500)))
  }]));
  const pokemonMap = Object.fromEntries(gm.pokemon
    .filter(p => p && p.speciesId && p.speciesName && p.baseStats)
    .map(p => [p.speciesId, {
      id: p.speciesId,
      name: p.speciesName,
      dex: p.dex || 0,
      released: p.released !== false,
      types: (p.types || []).filter(type => type && type !== "none"),
      atk: Number(p.baseStats.atk || 100),
      def: Number(p.baseStats.def || 100),
      hp: Number(p.baseStats.hp || 100),
      defaultIVs: p.defaultIVs || {},
      fast: (p.fastMoves || []).filter(id => moveMap[id]),
      charged: (p.chargedMoves || []).filter(id => moveMap[id]),
      eliteMoves: p.eliteMoves || []
    }]));
  const pokemon = config.pokemon
    .map(id => pokemonMap[id] || pokemonMap[id.replace(/_shadow$/, "")])
    .filter(Boolean)
    .filter(p => p.released && p.fast.length && p.charged.length)
    .map(p => {
      const moves = selectMoves(p, moveMap, standardMovesets);
      return {
        id: p.id,
        name: p.name,
        dex: p.dex,
        types: p.types,
        moves,
        moveMap,
        stats: {
          default: defaultStats(p),
          rank1: rank1Stats(p)
        }
      };
    });
  const matchups = [];
  if (INCLUDE_MATCHUPS) {
    for (const attacker of pokemon) {
      for (const defender of pokemon) {
        if (attacker.id === defender.id) continue;
        for (const shields of config.shieldScenarios) {
          const score = Math.max(0, Math.min(1000, signalMatchupScore(attacker, defender)));
          matchups.push({
            key: `${attacker.id}>${defender.id}|${shields[0]}-${shields[1]}|default`,
            attacker: attacker.id,
            defender: defender.id,
            ivProfile: "default",
            shields,
            score,
            source: "signal-v1"
          });
        }
      }
    }
  }
  const output = {
    schemaVersion: 1,
    league: config.league,
    cpCap: config.cpCap,
    status: INCLUDE_MATCHUPS ? "signal-precomputed" : "roster-precomputed",
    generatedAt: new Date().toISOString(),
    source: {
      gamemaster: "gamemaster-data.js",
      movesets: "pvpoke-default-movesets.js",
      metaConfig: "data/great-league-meta.json"
    },
    pokemon: pokemon.map(({ moveMap: _moveMap, ...p }) => p),
    matchups
  };
  fs.writeFileSync(path.join(ROOT, "data", "great-league-matchups.json"), JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote data/great-league-matchups.json (${pokemon.length} Pokemon, ${matchups.length} matchup cells).`);
}

main();
