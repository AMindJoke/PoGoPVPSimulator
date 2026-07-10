"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CP_CAP = 1500;
const MATCHUP_SCHEMA_VERSION = 2;
const RANKING_SCHEMA_VERSION = 2;
const MATRIX_VERSION = "live-worker-v1";
const DEFAULT_PROFILE = "default";
const RANK1_PROFILE = "rank1";
const ROLE_RANKING_CATEGORIES = [
  { key: "lead", label: "Lead", weight: 1.1 },
  { key: "closer", label: "Closer", weight: 1 },
  { key: "switch", label: "Switch", weight: .95 },
  { key: "charger", label: "Charger", weight: .9 },
  { key: "attacker", label: "Attacker", weight: .9 },
  { key: "consistency", label: "Consistency", weight: .85 }
];
const EQUAL_SHIELD_RANKING_CATEGORIES = [
  { key: "closer", label: "0 Shields", weight: 1 },
  { key: "core", label: "1 Shield", weight: 1 },
  { key: "lead", label: "2 Shields", weight: 1 }
];
const CATEGORY_WEIGHT_ITERATIONS = 4;
const COMPETITIVE_WEIGHT_ITERATIONS = 6;
const ADVANTAGE_TURNS = 6;
const rank1StatsCachePath = path.join(ROOT, "data", "great-league-rank1-stats-cache.json");
const statsCache = new Map();
const movesCache = new Map();
const persistentRank1Stats = loadPersistentRank1Stats();
let persistentRank1StatsDirty = false;

const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find(arg => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1] || 0)) : 0;
const offsetArg = process.argv.find(arg => arg.startsWith("--offset="));
const offset = offsetArg ? Math.max(0, Number(offsetArg.split("=")[1] || 0)) : 0;
const includeAllShieldStates = args.has("--all-shield-states");
const allPokemonRanking = args.has("--all-pokemon");
const rankingOnly = args.has("--ranking-only");
const chunkOutput = args.has("--chunk-output");
const mergeChunks = args.has("--merge-chunks");
const splitMatchups = args.has("--split-matchups");
const fullOutput = args.has("--full-output");
const opponentPoolArg = process.argv.find(arg => arg.startsWith("--opponents="));
const opponentPoolMode = opponentPoolArg ? opponentPoolArg.split("=")[1] : allPokemonRanking ? "meta" : "same";
const rankingModelArg = process.argv.find(arg => arg.startsWith("--ranking-model="));
const rankingModelMode = rankingModelArg ? rankingModelArg.split("=")[1] : "role";
const activeRankingCategories = rankingModelMode === "equal-shields"
  ? EQUAL_SHIELD_RANKING_CATEGORIES
  : ROLE_RANKING_CATEGORIES;
const weightSourceArg = process.argv.find(arg => arg.startsWith("--weight-source="));
const weightSourcePath = weightSourceArg ? weightSourceArg.split("=").slice(1).join("=") : "";
const weightModeArg = process.argv.find(arg => arg.startsWith("--weight-mode="));
const weightMode = weightModeArg ? weightModeArg.split("=")[1] : "competitive";
const profilesArg = process.argv.find(arg => arg.startsWith("--profiles="));
const profileFilter = profilesArg
  ? profilesArg.split("=")[1].split(",").map(value => value.trim()).filter(Boolean)
  : null;

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
  [49,.83529999],[49.5,.8378039],[50,.84029999],[50.5,.8428039],[51,.84529999]
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function readJsonPath(filePath) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

function scoreToOpponentWeight(score, mode = weightMode) {
  const value = Number(score || 0);
  if (!Number.isFinite(value) || value <= 0) return 1;
  if (mode === "raw") return 1;
  if (mode === "weighted") return Math.max(.35, Math.min(2.2, Math.pow(Math.max(.05, value / 500), 2)));
  if (value < 520) return .12;
  return Math.max(.12, Math.min(3.2, Math.pow(Math.max(.05, value / 500), 3.2)));
}

function loadExternalOpponentWeights(filePath) {
  if (!filePath) return null;
  const data = readJsonPath(filePath);
  const map = new Map();
  for (const entry of data.entries || []) {
    const score = modeScoreForEntry(entry, weightMode);
    map.set(entry.id, scoreToOpponentWeight(score, weightMode));
  }
  return map;
}

function modeScoreForEntry(entry, mode) {
  if (mode === "raw") return entry.rawScore || entry.averageScore || entry.overallScore;
  if (mode === "weighted") return entry.weightedScore || entry.overallScore || entry.averageScore;
  return entry.competitiveScore || entry.overallScore || entry.weightedScore || entry.averageScore;
}

function readWindowGlobal(relativePath, globalName) {
  const code = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: relativePath, timeout: 30000 });
  return context.window[globalName];
}

function loadPersistentRank1Stats() {
  if (!fs.existsSync(rank1StatsCachePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(rank1StatsCachePath, "utf8"));
  } catch (_) {
    return {};
  }
}

function savePersistentRank1Stats() {
  if (!persistentRank1StatsDirty) return;
  ensureDir(path.relative(ROOT, path.dirname(rank1StatsCachePath)));
  fs.writeFileSync(rank1StatsCachePath, `${JSON.stringify(persistentRank1Stats, null, 2)}\n`, "utf8");
  persistentRank1StatsDirty = false;
}

function extractLiveWorkerSource() {
  const html = fs.readFileSync(path.join(ROOT, "PogoPvp.html"), "utf8");
  const match = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
  if (!match) throw new Error("Could not find simulator script in PogoPvp.html.");
  const simulatorScript = match[1].replace(/\binit\(\);\s*$/, "");
  const context = {
    console,
    window: {},
    document: {},
    indexedDB: null,
    Blob: function Blob() {},
    URL: { createObjectURL: () => "" },
    Worker: function Worker() {},
    setTimeout,
    clearTimeout,
    result: ""
  };
  vm.createContext(context);
  vm.runInContext(
    `${simulatorScript}\nresult = buildMatrixComputeWorkerSource();`,
    context,
    { filename: "PogoPvp.html", timeout: 30000 }
  );
  if (!context.result || typeof context.result !== "string") {
    throw new Error("Live matrix worker source was not generated.");
  }
  return context.result;
}

function createWorkerAdapter(source) {
  const posted = [];
  const context = {
    console,
    setTimeout,
    clearTimeout,
    self: {
      postMessage(message) {
        posted.push(message);
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "matrix-worker.js", timeout: 30000 });
  if (!context.self || typeof context.self.onmessage !== "function") {
    throw new Error("Live matrix worker did not expose an onmessage handler.");
  }
  return {
    simulate(payload) {
      posted.length = 0;
      context.self.onmessage({ data: payload });
      const response = posted.shift();
      if (!response) throw new Error(`No worker response for ${payload.key}.`);
      if (response.error) throw new Error(`${payload.key}: ${response.error}`);
      if (response.type !== "matrixCellResult") throw new Error(`${payload.key}: unexpected worker response.`);
      return response.result;
    }
  };
}

function normalizeMove(move) {
  return {
    id: move.moveId,
    name: move.name || move.moveId,
    type: move.type,
    power: Number(move.power || 0),
    abbreviation: move.abbreviation || "",
    energyGain: Number(move.energyGain || 0),
    energyCost: Math.max(0, Number(move.energy || 0)),
    turns: Number(move.turns || Math.max(1, Math.round(Number(move.cooldown || 500) / 500))),
    buffs: move.buffs || null,
    buffsSelf: move.buffsSelf || null,
    buffsOpponent: move.buffsOpponent || null,
    buffTarget: move.buffTarget || null,
    buffApplyChance: Number(move.buffApplyChance ?? 0)
  };
}

function normalizePokemon(p, moveMap) {
  return {
    id: p.speciesId,
    name: p.speciesName,
    dex: p.dex || 0,
    released: p.released !== false,
    types: (p.types || []).filter(type => type && type !== "none"),
    atk: Number(p.baseStats.atk || 100),
    def: Number(p.baseStats.def || 100),
    hp: Number(p.baseStats.hp || 100),
    defaultIVs: p.defaultIVs || {},
    fast: (p.fastMoves || []).filter(id => moveMap.has(id)),
    charged: (p.chargedMoves || []).filter(id => moveMap.has(id)),
    eliteMoves: p.eliteMoves || [],
    tags: p.tags || []
  };
}

function isShadow(p) {
  return p.id.endsWith("_shadow") || p.id.includes("_shadow_");
}

function isEligibleGreatLeaguePokemon(p) {
  if (!p || p.released === false || !p.fast.length || !p.charged.length) return false;
  const name = p.name || "";
  if (p.id.includes("_mega") || name.includes("(Mega)")) return false;
  if (p.id.includes("_primal") || name.includes("(Primal)")) return false;
  return true;
}

function pokemonStatsAtLevel(p, ivAtk, ivDef, ivHp, level, cpm) {
  const attack = (p.atk + ivAtk) * cpm;
  const defense = (p.def + ivDef) * cpm;
  const hp = Math.floor((p.hp + ivHp) * cpm);
  const cp = Math.max(10, Math.floor(attack * Math.sqrt(defense) * Math.sqrt(hp) / 10));
  return {
    level,
    cp,
    ivAtk,
    ivDef,
    ivHp,
    attack,
    defense,
    hp,
    statProduct: attack * defense * hp
  };
}

function defaultStats(p) {
  const defaults = p.defaultIVs && p.defaultIVs.cp1500 ? p.defaultIVs.cp1500 : null;
  const ivAtk = defaults ? defaults[1] : 0;
  const ivDef = defaults ? defaults[2] : 15;
  const ivHp = defaults ? defaults[3] : 15;
  let best = null;
  for (const [level, cpm] of cpMultipliers) {
    const stats = pokemonStatsAtLevel(p, ivAtk, ivDef, ivHp, level, cpm);
    if (stats.cp <= CP_CAP) best = stats;
    else break;
  }
  return best || pokemonStatsAtLevel(p, ivAtk, ivDef, ivHp, cpMultipliers[0][0], cpMultipliers[0][1]);
}

function rank1Stats(p) {
  const cached = persistentRank1Stats[p.id];
  if (cached && cached.cp <= CP_CAP && cached.ivAtk !== undefined && cached.ivDef !== undefined && cached.ivHp !== undefined) {
    return cached;
  }
  let best = null;
  let rank = 0;
  for (let atk = 0; atk <= 15; atk++) {
    for (let def = 0; def <= 15; def++) {
      for (let hp = 0; hp <= 15; hp++) {
        let bestForIvs = null;
        for (const [level, cpm] of cpMultipliers) {
          const stats = pokemonStatsAtLevel(p, atk, def, hp, level, cpm);
          if (stats.cp <= CP_CAP) bestForIvs = stats;
          else break;
        }
        if (!bestForIvs) bestForIvs = pokemonStatsAtLevel(p, atk, def, hp, cpMultipliers[0][0], cpMultipliers[0][1]);
        if (!best || bestForIvs.statProduct > best.statProduct) {
          best = bestForIvs;
          rank = 1;
        }
      }
    }
  }
  const result = { ...best, rank };
  persistentRank1Stats[p.id] = result;
  persistentRank1StatsDirty = true;
  return result;
}

function standardMovesetFor(p, standardMovesets) {
  if (standardMovesets[p.id]) return standardMovesets[p.id];
  const baseId = p.id.replace(/_shadow(_|$)/, "_").replace(/_shadow$/, "");
  return standardMovesets[baseId] || null;
}

function fastMoveScore(move) {
  return (move.energyGain * 2.2) + move.power;
}

function chargedMoveScore(move) {
  const cost = Math.max(1, move.energyCost || 100);
  const dpe = (move.power || 0) / cost;
  const baitBonus = cost <= 40 ? 8 : 0;
  const pressureBonus = move.power >= 90 ? 10 : 0;
  return (dpe * 32) + baitBonus + pressureBonus;
}

function selectMoves(p, moveMap, standardMovesets) {
  if (movesCache.has(p.id)) return movesCache.get(p.id);
  const standard = standardMovesetFor(p, standardMovesets);
  const fast = standard && p.fast.includes(standard.fast)
    ? moveMap.get(standard.fast)
    : p.fast.map(id => moveMap.get(id)).filter(Boolean).sort((a, b) => fastMoveScore(b) - fastMoveScore(a))[0];
  const standardCharged = standard
    ? (standard.charged || []).filter(id => p.charged.includes(id)).map(id => moveMap.get(id)).filter(Boolean)
    : [];
  const charged = standardCharged.length
    ? standardCharged.slice(0, 2)
    : p.charged.map(id => moveMap.get(id)).filter(Boolean).sort((a, b) => chargedMoveScore(b) - chargedMoveScore(a)).slice(0, 2);
  const result = { fast, charged };
  movesCache.set(p.id, result);
  return result;
}

function moveIdsFor(p, moveMap, standardMovesets) {
  const moves = selectMoves(p, moveMap, standardMovesets);
  return {
    fast: moves.fast ? moves.fast.id : null,
    charged: moves.charged.map(move => move && move.id).filter(Boolean)
  };
}

function cloneForMatrix(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function createCombatant(p, trainer, profile, moveMap, standardMovesets) {
  const statsKey = `${profile}:${p.id}`;
  let stats = statsCache.get(statsKey);
  if (!stats) {
    stats = profile === RANK1_PROFILE ? rank1Stats(p) : defaultStats(p);
    statsCache.set(statsKey, stats);
  }
  const moves = selectMoves(p, moveMap, standardMovesets);
  if (!moves.fast || !moves.charged.length) {
    throw new Error(`${p.id} has no usable default moves.`);
  }
  return {
    trainer,
    p: cloneForMatrix(p),
    fast: cloneForMatrix(moves.fast),
    charged: [cloneForMatrix(moves.charged[0]), cloneForMatrix(moves.charged[1] || null)],
    level: stats.level,
    cp: stats.cp,
    ivAtk: stats.ivAtk,
    ivDef: stats.ivDef,
    ivHp: stats.ivHp,
    rank: profile === RANK1_PROFILE ? 1 : null,
    rankPercent: profile === RANK1_PROFILE ? 100 : null,
    statProduct: Math.round(stats.statProduct),
    maxHp: stats.hp,
    hp: stats.hp,
    energy: 0,
    shields: 1,
    baiting: "selective",
    shieldMode: "always",
    chargedTaken: 0,
    attack: stats.attack,
    defense: stats.defense,
    attackStage: 0,
    defenseStage: 0,
    lastFastStart: null,
    shadowAtkMult: isShadow(p) ? 1.2 : 1,
    shadowDefMult: isShadow(p) ? 0.83333331 : 1
  };
}

function createBattleConfig(a, b, profile, moveMap, standardMovesets) {
  return {
    left: createCombatant(a, "A", profile, moveMap, standardMovesets),
    right: createCombatant(b, "B", profile, moveMap, standardMovesets),
    startEnergyA: 0,
    startEnergyB: 0
  };
}

function cloneBattleConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function fastEnergyInTurns(fastMove, turns = ADVANTAGE_TURNS) {
  if (!fastMove) return 0;
  const moveTurns = Math.max(1, Number(fastMove.turns || 1));
  const uses = Math.max(1, Math.ceil(turns / moveTurns));
  return Math.max(0, Math.min(100, uses * Number(fastMove.energyGain || 0)));
}

function categoryTemplate() {
  return Object.fromEntries(activeRankingCategories.map(category => [category.key, {
    label: category.label,
    weight: category.weight,
    scoreTotal: 0,
    weightedScoreTotal: 0,
    weightTotal: 0,
    scoreSquaredTotal: 0,
    matchups: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    opponentScores: {},
    moveUsage: {
      fast: {},
      charged: {}
    }
  }]));
}

function addMoveUsage(bucket, moveset) {
  if (!bucket || !moveset) return;
  if (moveset.fast) bucket.moveUsage.fast[moveset.fast] = (bucket.moveUsage.fast[moveset.fast] || 0) + 1;
  for (const charged of moveset.charged || []) {
    if (charged) bucket.moveUsage.charged[charged] = (bucket.moveUsage.charged[charged] || 0) + 1;
  }
}

function compactResult(result, aId, bId) {
  const details = result.details || {};
  const winnerSide = details.winnerEdge > 0 ? "A" : details.winnerEdge < 0 ? "B" : "tie";
  return {
    score: Math.round(Number(result.score || 500)),
    winnerSide,
    winnerId: winnerSide === "A" ? aId : winnerSide === "B" ? bId : null,
    hpRatioA: Number((details.aHpRatio || 0).toFixed(4)),
    hpRatioB: Number((details.bHpRatio || 0).toFixed(4)),
    winnerEdge: Number(details.winnerEdge || 0),
    hpEdge: Number(details.hpEdge || 0),
    energyEdge: Number(details.energyEdge || 0),
    shieldEdge: Number(details.shieldEdge || 0),
    readyEdge: Number(details.readyEdge || 0),
    dangerEdge: Number(details.dangerEdge || 0),
    closingCostEdge: Number(details.closingCostEdge || 0),
    farmPressureEdge: Number(details.farmPressureEdge || 0),
    outpacePressureEdge: Number(details.outpacePressureEdge || 0)
  };
}

function ensureDir(relativePath) {
  fs.mkdirSync(path.join(ROOT, relativePath), { recursive: true });
}

function writeJson(relativePath, value) {
  const file = path.join(ROOT, relativePath);
  ensureDir(path.dirname(relativePath));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return fs.statSync(file).size;
}

function shieldStateSlug(shieldState) {
  return shieldState.replace("-", "v");
}

function compactMatchupSummary(cell) {
  return {
    opponentId: cell.defenderId,
    opponentName: cell.defenderName,
    shieldState: cell.shieldState,
    winner: cell.result.winnerSide,
    winnerId: cell.result.winnerId,
    score: cell.result.score,
    remainingHpRatio: {
      pokemon: cell.result.hpRatioA,
      opponent: cell.result.hpRatioB
    },
    edges: {
      winner: cell.result.winnerEdge,
      hp: cell.result.hpEdge,
      energy: cell.result.energyEdge,
      shields: cell.result.shieldEdge,
      ready: cell.result.readyEdge,
      danger: cell.result.dangerEdge,
      closingCost: cell.result.closingCostEdge,
      farmPressure: cell.result.farmPressureEdge,
      outpacePressure: cell.result.outpacePressureEdge
    }
  };
}

function writeSplitMatchupFile({ profile, pokemon, shieldState, rows, metadata }) {
  const profileSegment = metadata.profiles.length > 1 ? `${profile}-` : "";
  const relativePath = path.join(
    "data",
    "matchups",
    "great-league",
    shieldStateSlug(shieldState),
    `${profileSegment}${pokemon.id}.json`
  );
  return writeJson(relativePath, {
    schemaVersion: MATCHUP_SCHEMA_VERSION,
    league: "great",
    generatedAt: metadata.generatedAt,
    matrixVersion: metadata.matrixVersion,
    profile,
    pokemonId: pokemon.id,
    pokemonName: pokemon.name,
    shieldState,
    opponentCount: rows.length,
    matchups: rows
  });
}

function writeSplitMatchupIndex(metadata) {
  return writeJson(path.join("data", "matchups", "great-league", "index.json"), {
    schemaVersion: MATCHUP_SCHEMA_VERSION,
    league: "great",
    generatedAt: metadata.generatedAt,
    matrixVersion: metadata.matrixVersion,
    totalPokemon: metadata.fullCandidateCount,
    generatedPokemon: metadata.pokemonCount,
    opponentPokemonCount: metadata.opponentPokemonCount,
    profiles: metadata.profiles,
    shieldStates: metadata.shieldScenarios.map(([a, b]) => `${a}-${b}`),
    fileStructure: "data/matchups/great-league/<shieldState>/<pokemonId>.json",
    notes: [
      "Each file is from the named Pokemon's perspective as Pokemon A.",
      "A vs B is simulated directly; reverse rows are not inferred."
    ]
  });
}

function createRankingAggregator(pool, profiles, scenarios) {
  const entries = new Map();
  for (const profile of profiles) {
    for (const p of pool) {
      entries.set(`${profile}:${p.id}`, {
        id: p.id,
        name: p.name,
        profile,
        scoreTotal: 0,
        weightedScoreTotal: 0,
        scoreWeightTotal: 0,
        matchups: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        scoreSquaredTotal: 0,
        categories: categoryTemplate(),
        shieldStates: Object.fromEntries(scenarios.map(([a, b]) => [`${a}-${b}`, {
          scoreTotal: 0,
          weightedScoreTotal: 0,
          scoreWeightTotal: 0,
          matchups: 0,
          wins: 0,
          losses: 0,
          ties: 0
        }]))
      });
    }
  }
  return entries;
}

function updateCategory(entry, key, cell, moveset, opponentWeight = 1) {
  const category = entry && entry.categories ? entry.categories[key] : null;
  if (!category) return;
  const score = cell.result.score;
  category.scoreTotal += score;
  category.weightedScoreTotal += score * opponentWeight;
  category.weightTotal += opponentWeight;
  category.scoreSquaredTotal += score * score;
  category.matchups++;
  category.opponentScores[cell.defenderId] = score;
  addMoveUsage(category, moveset);
  if (cell.result.winnerSide === "A") category.wins++;
  else if (cell.result.winnerSide === "B") category.losses++;
  else category.ties++;
}

function updateBaseCategories(entry, cell, moveset, opponentWeight = 1) {
  const [aShields, bShields] = cell.shieldState.split("-").map(Number);
  if (rankingModelMode === "equal-shields") {
    if (aShields !== bShields) return;
    if (aShields === 0) updateCategory(entry, "closer", cell, moveset, opponentWeight);
    if (aShields === 1) updateCategory(entry, "core", cell, moveset, opponentWeight);
    if (aShields === 2) updateCategory(entry, "lead", cell, moveset, opponentWeight);
    return;
  }
  if (aShields === 2 && bShields === 2) updateCategory(entry, "lead", cell, moveset, opponentWeight);
  if (aShields === 0 && bShields === 0) updateCategory(entry, "closer", cell, moveset, opponentWeight);
  if (aShields === 0 && bShields === 2) updateCategory(entry, "attacker", cell, moveset, opponentWeight);
  if (aShields === bShields) updateCategory(entry, "consistency", cell, moveset, opponentWeight);
}

function updateRanking(entries, cell, opponentWeight = 1) {
  const entry = entries.get(`${cell.profile}:${cell.attackerId}`);
  if (!entry) return;
  const state = entry.shieldStates[cell.shieldState];
  entry.scoreTotal += cell.result.score;
  entry.weightedScoreTotal += cell.result.score * opponentWeight;
  entry.scoreWeightTotal += opponentWeight;
  entry.scoreSquaredTotal += cell.result.score * cell.result.score;
  entry.matchups++;
  state.scoreTotal += cell.result.score;
  state.weightedScoreTotal += cell.result.score * opponentWeight;
  state.scoreWeightTotal += opponentWeight;
  state.matchups++;
  if (cell.result.winnerSide === "A") {
    entry.wins++;
    state.wins++;
  } else if (cell.result.winnerSide === "B") {
    entry.losses++;
    state.losses++;
  } else {
    entry.ties++;
    state.ties++;
  }
  updateBaseCategories(entry, cell, cell.attackerMoveset, opponentWeight);
}

function weightedCategoryAverage(category, opponentWeights) {
  const scores = Object.entries(category.opponentScores || {});
  if (!scores.length) return category.matchups ? category.scoreTotal / category.matchups : null;
  let total = 0;
  let weightTotal = 0;
  for (const [opponentId, score] of scores) {
    const weight = opponentWeights.get(opponentId) || 1;
    total += Number(score || 0) * weight;
    weightTotal += weight;
  }
  return weightTotal ? total / weightTotal : null;
}

function rawCategoryAverage(category) {
  return category.matchups ? category.scoreTotal / category.matchups : null;
}

function scoreToCategoryPercent(score) {
  if (!Number.isFinite(score)) return null;
  return Math.max(1, Math.min(100, score / 10));
}

function geometricMean(values) {
  const clean = values.filter(value => Number.isFinite(value) && value > 0);
  if (!clean.length) return null;
  const logTotal = clean.reduce((sum, value) => sum + Math.log(value), 0);
  return Math.exp(logTotal / clean.length);
}

function categoryMoveUsage(category) {
  const sortUsage = usage => Object.entries(usage || {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, uses]) => ({ id, uses }));
  return {
    fast: sortUsage(category.moveUsage.fast),
    charged: sortUsage(category.moveUsage.charged)
  };
}

function buildOpponentWeights(entries, options = {}) {
  const iterations = options.iterations ?? CATEGORY_WEIGHT_ITERATIONS;
  const minWeight = options.minWeight ?? .6;
  const maxWeight = options.maxWeight ?? 1.8;
  const exponent = options.exponent ?? 1;
  const floor = options.floor ?? 0;
  const center = options.center ?? 500;
  const weights = new Map();
  for (const entry of entries.values()) {
    const average = entry.matchups ? entry.scoreTotal / entry.matchups : 500;
    const normalized = Math.max(.05, average / center);
    const rawWeight = Math.pow(normalized, exponent);
    weights.set(entry.id, average < floor ? minWeight : Math.max(minWeight, Math.min(maxWeight, rawWeight)));
  }
  for (let i = 0; i < iterations; i++) {
    const next = new Map(weights);
    for (const entry of entries.values()) {
      const categoryAverages = Object.values(entry.categories).map(category => weightedCategoryAverage(category, weights)).filter(Number.isFinite);
      const weightedAverage = categoryAverages.length
        ? categoryAverages.reduce((sum, value) => sum + value, 0) / categoryAverages.length
        : entry.matchups ? entry.scoreTotal / entry.matchups : 500;
      const normalized = Math.max(.05, weightedAverage / center);
      const rawWeight = Math.pow(normalized, exponent);
      next.set(entry.id, weightedAverage < floor ? minWeight : Math.max(minWeight, Math.min(maxWeight, rawWeight)));
    }
    weights.clear();
    for (const [key, value] of next) weights.set(key, value);
  }
  return weights;
}

function scoreFromCategoryValues(categoryScores, fieldName) {
  const weightedCategoryValues = activeRankingCategories.flatMap(category => {
    const score = categoryScores[category.key] && categoryScores[category.key][fieldName];
    return Number.isFinite(score) ? Array(Math.max(1, Math.round(category.weight * 4))).fill(score) : [];
  });
  const overallPercent = geometricMean(weightedCategoryValues);
  return Number.isFinite(overallPercent) ? Math.round(overallPercent * 10) : null;
}

function finalizeRankings(entries, externalOpponentWeights = null) {
  const opponentWeights = buildOpponentWeights(entries);
  const competitiveOpponentWeights = buildOpponentWeights(entries, {
    iterations: COMPETITIVE_WEIGHT_ITERATIONS,
    minWeight: .12,
    maxWeight: 3.2,
    exponent: 3.2,
    floor: 520
  });
  const rows = [...entries.values()].map(entry => {
    const shieldStates = Object.fromEntries(Object.entries(entry.shieldStates).map(([key, value]) => [key, {
      averageScore: value.matchups ? Math.round(value.scoreTotal / value.matchups) : null,
      matchups: value.matchups,
      wins: value.wins,
      losses: value.losses,
      ties: value.ties
    }]));
    const categoryScores = {};
    for (const categoryDef of activeRankingCategories) {
      const category = entry.categories[categoryDef.key];
      const rawAverage = rawCategoryAverage(category);
      const weightedAverage = weightedCategoryAverage(category, opponentWeights);
      const competitiveAverage = externalOpponentWeights && category.weightTotal
        ? category.weightedScoreTotal / category.weightTotal
        : weightedCategoryAverage(category, competitiveOpponentWeights);
      categoryScores[categoryDef.key] = {
        label: categoryDef.label,
        weight: categoryDef.weight,
        averageScore: Number.isFinite(rawAverage) ? Math.round(rawAverage) : null,
        weightedScore: Number.isFinite(weightedAverage) ? Math.round(weightedAverage) : null,
        competitiveScore: Number.isFinite(competitiveAverage) ? Math.round(competitiveAverage) : null,
        rawRating: Number.isFinite(rawAverage) ? Math.round(scoreToCategoryPercent(rawAverage)) : null,
        weightedRating: Number.isFinite(weightedAverage) ? Math.round(scoreToCategoryPercent(weightedAverage)) : null,
        competitiveRating: Number.isFinite(competitiveAverage) ? Math.round(scoreToCategoryPercent(competitiveAverage)) : null,
        score: Number.isFinite(competitiveAverage) ? Math.round(scoreToCategoryPercent(competitiveAverage)) : null,
        matchups: category.matchups,
        wins: category.wins,
        losses: category.losses,
        ties: category.ties,
        moveUsage: categoryMoveUsage(category)
      };
    }
    const rawScore = scoreFromCategoryValues(categoryScores, "rawRating");
    const weightedScore = scoreFromCategoryValues(categoryScores, "weightedRating");
    const competitiveScore = scoreFromCategoryValues(categoryScores, "competitiveRating");
    const overallScore = competitiveScore;
    return {
      id: entry.id,
      name: entry.name,
      profile: entry.profile,
      averageScore: entry.matchups ? Math.round(entry.scoreTotal / entry.matchups) : null,
      externalWeightedAverageScore: entry.scoreWeightTotal ? Math.round(entry.weightedScoreTotal / entry.scoreWeightTotal) : null,
      weightedAverageScore: opponentWeights.has(entry.id) ? Math.round((opponentWeights.get(entry.id) || 1) * 500) : null,
      rawScore,
      weightedScore,
      competitiveScore,
      overallScore,
      categoryScores,
      scoreStdDev: entry.matchups ? Number(Math.sqrt(Math.max(0, (entry.scoreSquaredTotal / entry.matchups) - Math.pow(entry.scoreTotal / entry.matchups, 2))).toFixed(2)) : null,
      matchups: entry.matchups,
      wins: entry.wins,
      losses: entry.losses,
      ties: entry.ties,
      winRate: entry.matchups ? Number((entry.wins / entry.matchups).toFixed(4)) : null,
      shieldStates
    };
  }).sort((a, b) =>
    (b.overallScore || b.averageScore || 0) - (a.overallScore || a.averageScore || 0) ||
    (b.averageScore || 0) - (a.averageScore || 0) ||
    (b.winRate || 0) - (a.winRate || 0) ||
    a.name.localeCompare(b.name) ||
    a.profile.localeCompare(b.profile)
  );
  return rows.map((entry, index) => ({ rank: index + 1, ...entry }));
}

function compactRankingEntries(rankings, moveMap, standardMovesets, allPokemon) {
  return rankings.entries.map(row => {
    const p = allPokemon.get(row.id);
    const moves = p ? moveIdsFor(p, moveMap, standardMovesets) : { fast: null, charged: [] };
    return {
      ...row,
      types: p ? p.types : [],
      dex: p ? p.dex : 0,
      moveset: moves
    };
  });
}

function validateOutput({ rankings, matchups, pool, opponentPool, profiles, scenarios, selfMatchupsSkipped }) {
  const expectedMatchupsPerRow = (opponentPool.length - (selfMatchupsSkipped ? 1 : 0)) * scenarios.length;
  const expectedPerShieldState = opponentPool.length - (selfMatchupsSkipped ? 1 : 0);
  if (!matchups) {
    const rankingKeys = new Set();
    for (const row of rankings.entries) {
      const key = `${row.profile}:${row.id}`;
      if (rankingKeys.has(key)) throw new Error(`Duplicate ranking row: ${key}`);
      rankingKeys.add(key);
      if (!Number.isFinite(row.averageScore)) throw new Error(`Ranking row has invalid score: ${key}`);
      if (row.matchups !== expectedMatchupsPerRow) {
        throw new Error(`Ranking row has incomplete coverage: ${key} has ${row.matchups}, expected ${expectedMatchupsPerRow}.`);
      }
      for (const [a, b] of scenarios) {
        const state = row.shieldStates && row.shieldStates[`${a}-${b}`];
        if (!state || state.matchups !== expectedPerShieldState) {
          throw new Error(`Ranking row missing shield coverage: ${key} ${a}-${b}.`);
        }
      }
    }
    const expectedRankings = pool.length * profiles.length;
    if (rankingKeys.size !== expectedRankings) {
      throw new Error(`Expected ${expectedRankings} ranking rows, found ${rankingKeys.size}.`);
    }
    return;
  }
  const expectedCells = pool.length * expectedPerShieldState * profiles.length * scenarios.length;
  if (matchups.cells.length !== expectedCells) {
    throw new Error(`Expected ${expectedCells} matchup cells, found ${matchups.cells.length}.`);
  }
  const rankingKeys = new Set();
  for (const row of rankings.entries) {
    const key = `${row.profile}:${row.id}`;
    if (rankingKeys.has(key)) throw new Error(`Duplicate ranking row: ${key}`);
    rankingKeys.add(key);
    if (!Number.isFinite(row.averageScore)) throw new Error(`Ranking row has invalid score: ${key}`);
  }
  const expectedRankings = pool.length * profiles.length;
  if (rankingKeys.size !== expectedRankings) {
    throw new Error(`Expected ${expectedRankings} ranking rows, found ${rankingKeys.size}.`);
  }
  const missingScenario = rankings.entries.find(row =>
    scenarios.some(([a, b]) => !row.shieldStates[`${a}-${b}`] || row.shieldStates[`${a}-${b}`].matchups !== expectedPerShieldState)
  );
  if (missingScenario) throw new Error(`Ranking row missing shield coverage: ${missingScenario.profile}:${missingScenario.id}`);
}

function main() {
  const started = Date.now();
  const metaConfig = readJson("data/great-league-meta.json");
  const gamemaster = readWindowGlobal("gamemaster-data.js", "PVPOKE_GAMEMASTER");
  const standardMovesets = readWindowGlobal("pvpoke-default-movesets.js", "PVPOKE_DEFAULT_MOVESETS") || {};
  if (!gamemaster || !Array.isArray(gamemaster.moves) || !Array.isArray(gamemaster.pokemon)) {
    throw new Error("Could not load gamemaster-data.js.");
  }

  const moveMap = new Map(gamemaster.moves.map(move => [move.moveId, normalizeMove(move)]));
  const allPokemon = new Map(gamemaster.pokemon
    .filter(p => p && p.speciesId && p.speciesName && p.baseStats)
    .map(p => normalizePokemon(p, moveMap))
    .filter(p => p.fast.length && p.charged.length)
    .map(p => [p.id, p]));

  const eligiblePokemon = [...allPokemon.values()]
    .filter(isEligibleGreatLeaguePokemon)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const skippedPokemon = metaConfig.pokemon.filter(id => !allPokemon.has(id));
  const metaPool = metaConfig.pokemon.map(id => allPokemon.get(id)).filter(Boolean);
  let pool = allPokemonRanking ? eligiblePokemon : metaPool;
  let opponentPool = opponentPoolMode === "all"
    ? eligiblePokemon
    : opponentPoolMode === "meta"
      ? metaPool
      : pool;
  const fullCandidateCount = pool.length;
  if (offset || limit) pool = pool.slice(offset, limit ? offset + limit : undefined);
  const configuredProfiles = metaConfig.ivProfiles && metaConfig.ivProfiles.length
    ? metaConfig.ivProfiles
    : [DEFAULT_PROFILE, RANK1_PROFILE];
  const profiles = (profileFilter || configuredProfiles).filter(profile => [DEFAULT_PROFILE, RANK1_PROFILE].includes(profile));
  const scenarios = includeAllShieldStates
    ? metaConfig.shieldScenarios
    : metaConfig.shieldScenarios.filter(([a, b]) => a === b);

  if (!pool.length) throw new Error("Great League ranking pool is empty.");
  if (!opponentPool.length) throw new Error("Great League opponent pool is empty.");
  if (!profiles.length) throw new Error("No valid IV profiles selected.");
  if (!scenarios.length) throw new Error("No shield scenarios selected.");

  console.log(`Loading live simulator matrix worker...`);
  const adapter = createWorkerAdapter(extractLiveWorkerSource());
  const externalOpponentWeights = loadExternalOpponentWeights(weightSourcePath);
  if (externalOpponentWeights) {
    console.log(`Loaded ${externalOpponentWeights.size.toLocaleString()} opponent weights from ${weightSourcePath} (${weightMode}).`);
  }
  const selfMatchupsSkipped = opponentPool === pool || opponentPoolMode === "all";
  const total = profiles.length * scenarios.length * pool.reduce((sum, p) => (
    sum + opponentPool.filter(opponent => !selfMatchupsSkipped || opponent.id !== p.id).length
  ), 0);
  console.log(`Generating Great League ranking: ${pool.length} candidates, ${opponentPool.length} opponents (${opponentPoolMode}), ${profiles.join(", ")} profiles, ${scenarios.length} shield states, ${total} base cells plus category sims.`);

  const generatedAt = new Date().toISOString();
  const cells = [];
  const rankingAggregator = createRankingAggregator(pool, profiles, scenarios);
  let done = 0;
  let seq = 0;
  const extraCategoryCellsPerPair = rankingModelMode === "equal-shields" ? 0 : 2;
  const totalWithCategories = total + (profiles.length * pool.reduce((sum, p) => (
    sum + opponentPool.filter(opponent => !selfMatchupsSkipped || opponent.id !== p.id).length
  ), 0) * extraCategoryCellsPerPair);

  for (const profile of profiles) {
    for (const a of pool) {
      const attackerMoveset = moveIdsFor(a, moveMap, standardMovesets);
      const splitRows = splitMatchups
        ? Object.fromEntries(scenarios.map(([aShields, bShields]) => [`${aShields}-${bShields}`, []]))
        : null;
      for (const b of opponentPool) {
        if (selfMatchupsSkipped && a.id === b.id) continue;
        const config = createBattleConfig(a, b, profile, moveMap, standardMovesets);
        for (const [aShields, bShields] of scenarios) {
          const shieldState = `${aShields}-${bShields}`;
          const key = `${MATRIX_VERSION}|${profile}|${a.id}>${b.id}|${shieldState}`;
          const workerResult = adapter.simulate({
            id: ++seq,
            source: "offline-ranking",
            key,
            signature: MATRIX_VERSION,
            aShields,
            bShields,
            includeSwing: false,
            config
          });
          const cell = {
            key,
            profile,
            attackerId: a.id,
            defenderId: b.id,
            attackerName: a.name,
            defenderName: b.name,
            shieldState,
            aShields,
            bShields,
            attackerMoveset,
            result: compactResult(workerResult, a.id, b.id)
          };
          const opponentWeight = externalOpponentWeights ? (externalOpponentWeights.get(b.id) || 1) : 1;
          if (splitRows) splitRows[shieldState].push(compactMatchupSummary(cell));
          else if (!rankingOnly) cells.push(cell);
          updateRanking(rankingAggregator, cell, opponentWeight);
          done++;
          if (done % 1000 === 0 || done === totalWithCategories) {
            const pct = totalWithCategories ? Math.round((done / totalWithCategories) * 1000) / 10 : 100;
            console.log(`  ${done}/${totalWithCategories} cells (${pct}%)`);
          }
        }
        const categoryEntry = rankingAggregator.get(`${profile}:${a.id}`);
        if (categoryEntry && rankingModelMode !== "equal-shields") {
          const bonusEnergy = fastEnergyInTurns(config.left.fast, ADVANTAGE_TURNS);
          for (const extraCategory of [
            { key: "switch", aShields: 2, bShields: 2 },
            { key: "charger", aShields: 1, bShields: 1 }
          ]) {
            const energyConfig = cloneBattleConfig(config);
            energyConfig.startEnergyA = bonusEnergy;
            const key = `${MATRIX_VERSION}|${profile}|${a.id}>${b.id}|${extraCategory.key}|+${bonusEnergy}e`;
            const workerResult = adapter.simulate({
              id: ++seq,
              source: "offline-ranking",
              key,
              signature: MATRIX_VERSION,
              aShields: extraCategory.aShields,
              bShields: extraCategory.bShields,
              includeSwing: false,
              config: energyConfig
            });
            const opponentWeight = externalOpponentWeights ? (externalOpponentWeights.get(b.id) || 1) : 1;
            updateCategory(categoryEntry, extraCategory.key, {
              profile,
              attackerId: a.id,
              defenderId: b.id,
              shieldState: `${extraCategory.aShields}-${extraCategory.bShields}`,
              aShields: extraCategory.aShields,
              bShields: extraCategory.bShields,
              attackerMoveset,
              result: compactResult(workerResult, a.id, b.id)
            }, attackerMoveset, opponentWeight);
            done++;
            if (done % 1000 === 0 || done === totalWithCategories) {
              const pct = totalWithCategories ? Math.round((done / totalWithCategories) * 1000) / 10 : 100;
              console.log(`  ${done}/${totalWithCategories} cells (${pct}%)`);
            }
          }
        }
      }
      if (splitRows) {
        for (const [shieldState, rows] of Object.entries(splitRows)) {
          writeSplitMatchupFile({ profile, pokemon: a, shieldState, rows, metadata: {
            generatedAt,
            matrixVersion: MATRIX_VERSION,
            profiles,
            fullCandidateCount,
            pokemonCount: pool.length,
            opponentPokemonCount: opponentPool.length,
            shieldScenarios: scenarios
          }});
        }
      }
    }
  }

  const metadata = {
    generatedAt,
    generator: "tools/build-great-league-meta-database.js",
    simulatorSource: "PogoPvp.html buildMatrixComputeWorkerSource()",
    matrixVersion: MATRIX_VERSION,
    cpCap: CP_CAP,
    configuredPokemonCount: allPokemonRanking ? eligiblePokemon.length : metaConfig.pokemon.length,
    fullCandidateCount,
    offset,
    limit: limit || null,
    pokemonCount: pool.length,
    opponentPool: opponentPoolMode,
    opponentPokemonCount: opponentPool.length,
    skippedPokemon,
    profiles,
    shieldScenarios: scenarios,
    allShieldStates: includeAllShieldStates,
    rankingOnly,
    splitMatchups,
    weightSource: weightSourcePath || null,
    weightMode: externalOpponentWeights ? weightMode : null,
    cells: done,
    baseCells: total,
    rankingModel: {
      version: 1,
      mode: rankingModelMode,
      categories: activeRankingCategories,
      weighting: "iterative-opponent-strength",
      weightingIterations: CATEGORY_WEIGHT_ITERATIONS,
      competitiveWeightingIterations: COMPETITIVE_WEIGHT_ITERATIONS,
      overall: rankingModelMode === "equal-shields"
        ? "competitive weighted geometric mean of equal-shield category scores"
        : "weighted geometric mean of category scores",
      exposedScores: ["rawScore", "weightedScore", "competitiveScore"],
      advantageTurns: ADVANTAGE_TURNS,
      notes: rankingModelMode === "equal-shields"
        ? [
          "The main ranking simulates every candidate against every eligible opponent.",
          "Only equal-shield scenarios are used: 0-0, 1-1, and 2-2.",
          "Raw score is the full-field average.",
          "Weighted score iteratively values stronger opponents more.",
          "Competitive score strongly discounts low-ranked field noise and is used as the displayed overall score."
        ]
        : [
          "Lead, Closer, Attacker, and Consistency use standard shield-state simulations.",
          "Switch uses two-shield simulations with starting energy generated by the candidate fast move over the configured advantage turns.",
          "Charger uses one-shield simulations with the same starting-energy advantage.",
          "Category scores are weighted by opponent strength before the overall score is calculated."
        ]
    }
  };
  const finalizedRankingEntries = finalizeRankings(rankingAggregator, externalOpponentWeights);
  const rankings = {
    schemaVersion: RANKING_SCHEMA_VERSION,
    league: "great",
    metadata,
    entries: compactRankingEntries({ entries: finalizedRankingEntries }, moveMap, standardMovesets, allPokemon)
  };
  const matchups = rankingOnly || splitMatchups ? null : {
    schemaVersion: MATCHUP_SCHEMA_VERSION,
    league: "great",
    metadata,
    cells
  };

  validateOutput({ rankings, matchups, pool, opponentPool, profiles, scenarios, selfMatchupsSkipped });
  const rankingPath = chunkOutput ? `data/ranking-chunks/great-league-rankings-${String(offset).padStart(4, "0")}.json` : "data/great-league-rankings.json";
  const rankingSize = writeJson(rankingPath, rankings);
  let fullRankingSize = 0;
  if (fullOutput && !chunkOutput) {
    fullRankingSize = writeJson(path.join("data", "rankings", "great-league-full.json"), rankings);
  }
  if (!chunkOutput) writeRankingScript(rankings);
  const splitIndexSize = splitMatchups ? writeSplitMatchupIndex(metadata) : 0;
  const matchupSize = matchups ? writeJson("data/great-league-matchups.json", matchups) : 0;
  const elapsed = Math.round((Date.now() - started) / 1000);
  console.log(`Wrote ${rankingPath} (${rankingSize.toLocaleString()} bytes).`);
  if (fullRankingSize) console.log(`Wrote data/rankings/great-league-full.json (${fullRankingSize.toLocaleString()} bytes).`);
  if (!chunkOutput) console.log(`Wrote data/great-league-rankings.js.`);
  if (splitIndexSize) console.log(`Wrote data/matchups/great-league/index.json (${splitIndexSize.toLocaleString()} bytes).`);
  if (matchups) console.log(`Wrote data/great-league-matchups.json (${matchupSize.toLocaleString()} bytes).`);
  savePersistentRank1Stats();
  console.log(`Done in ${elapsed}s.`);
}

function mergeRankingChunks() {
  const chunkDir = path.join(ROOT, "data", "ranking-chunks");
  const files = fs.existsSync(chunkDir)
    ? fs.readdirSync(chunkDir).filter(name => /^great-league-rankings-\d+\.json$/.test(name)).sort()
    : [];
  if (!files.length) throw new Error("No ranking chunks found.");
  const chunks = files.map(name => readJson(path.join("data", "ranking-chunks", name)));
  const entries = chunks.flatMap(chunk => chunk.entries || []);
  const totalCells = chunks.reduce((sum, chunk) => sum + Number(chunk.metadata && chunk.metadata.cells || 0), 0);
  entries.sort((a, b) =>
    (b.overallScore || b.averageScore || 0) - (a.overallScore || a.averageScore || 0) ||
    (b.averageScore || 0) - (a.averageScore || 0) ||
    (b.winRate || 0) - (a.winRate || 0) ||
    a.name.localeCompare(b.name)
  );
  const merged = {
    schemaVersion: RANKING_SCHEMA_VERSION,
    league: "great",
    metadata: {
      ...chunks[0].metadata,
      generatedAt: new Date().toISOString(),
      mergedFromChunks: files.length,
      pokemonCount: entries.length,
      cells: totalCells,
      offset: 0,
      limit: null,
      rankingOnly: true
    },
    entries: entries.map((entry, index) => ({ ...entry, rank: index + 1 }))
  };
  const rankingSize = writeJson("data/great-league-rankings.json", merged);
  const fullRankingSize = fullOutput ? writeJson(path.join("data", "rankings", "great-league-full.json"), merged) : 0;
  writeRankingScript(merged);
  console.log(`Merged ${files.length} chunks into data/great-league-rankings.json (${rankingSize.toLocaleString()} bytes).`);
  if (fullRankingSize) console.log(`Wrote data/rankings/great-league-full.json (${fullRankingSize.toLocaleString()} bytes).`);
  console.log(`Wrote data/great-league-rankings.js.`);
}

function writeRankingScript(rankings) {
  const file = path.join(ROOT, "data", "great-league-rankings.js");
  ensureDir(path.dirname("data/great-league-rankings.js"));
  fs.writeFileSync(file, `window.GREAT_LEAGUE_RANKINGS = ${JSON.stringify(rankings, null, 2)};\n`, "utf8");
}

if (mergeChunks) {
  mergeRankingChunks();
} else {
  main();
}
