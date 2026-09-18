"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const { runQualityPipeline } = require("./validate-great-league-dataset");
const battleReliability = require("../src/reliability/battle-reliability");
const turnEngine = require("../src/battle/turn-resolution-engine");
const matchupPlanner = require("../src/battle/matchup-planner");
const matchupPlannerAdapter = require("../src/battle/matchup-planner-adapter");
const battleIntelligence = require("../src/battle/battle-intelligence");
const pokemonForms = require("../src/battle/pokemon-form");
const seasonContext = require("../src/season/season-context");
const { inflateCacheResult, MATCHUP_SCORE_VERSION } = require("../src/analysis/matchup-inspector");
const rankingWeightUpdate = require("../src/analysis/ranking-weight-update");

const ROOT = path.resolve(__dirname, "..");
const CP_CAP = 1500;
const MATCHUP_SCHEMA_VERSION = 2;
const RANKING_SCHEMA_VERSION = 2;
const MATRIX_VERSION = battleReliability.BATTLE_ENGINE_VERSION;
const DEFAULT_PROFILE = "default";
const RANK1_PROFILE = "rank1";
const ROLE_RANKING_CATEGORIES = [
  { key: "lead", label: "Lead", weight: 1 },
  { key: "closer", label: "Closer", weight: 1 },
  { key: "switch", label: "Switch", weight: 1 },
  { key: "charger", label: "Charger", weight: 1 },
  { key: "attacker", label: "Attacker", weight: 1 }
];
const EQUAL_SHIELD_RANKING_CATEGORIES = [
  { key: "closer", label: "0 Shields", weight: 1 },
  { key: "core", label: "1 Shield", weight: 1 },
  { key: "lead", label: "2 Shields", weight: 1 }
];
const CATEGORY_WEIGHT_ITERATIONS = 4;
const COMPETITIVE_WEIGHT_ITERATIONS = 1;
const SWITCH_ADVANTAGE_TURNS = 4;
const CHARGER_ADVANTAGE_TURNS = 6;
const rank1StatsCachePath = path.join(ROOT, "data", "great-league-rank1-stats-cache.json");
const statsCache = new Map();
const movesCache = new Map();
const formCatalogCache = new Map();
let activeGenerationPreview = null;
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
const mergeOffsetsArg = process.argv.find(arg => arg.startsWith("--merge-offsets="));
const mergeOffsets = mergeOffsetsArg
  ? new Set(mergeOffsetsArg.slice("--merge-offsets=".length).split(",").map(value => String(Math.max(0, Number(value) || 0)).padStart(4, "0")))
  : null;
const splitMatchups = args.has("--split-matchups");
const fullOutput = args.has("--full-output");
const useMatchupCache = args.has("--matchup-cache");
const allowLegacyCache = args.has("--allow-legacy-cache");
const opponentPoolArg = process.argv.find(arg => arg.startsWith("--opponents="));
const opponentPoolMode = opponentPoolArg ? opponentPoolArg.split("=")[1] : allPokemonRanking ? "meta" : "same";
const opponentAddArg = process.argv.find(arg => arg.startsWith("--opponents-add="));
const opponentAddIds = opponentAddArg
  ? opponentAddArg.split("=").slice(1).join("=").split(",").map(value => value.trim()).filter(Boolean)
  : [];
const opponentRemoveArg = process.argv.find(arg => arg.startsWith("--opponents-remove="));
const opponentRemoveIds = opponentRemoveArg
  ? opponentRemoveArg.split("=").slice(1).join("=").split(",").map(value => value.trim()).filter(Boolean)
  : [];
const opponentFileArg = process.argv.find(arg => arg.startsWith("--opponents-file="));
const opponentFilePath = opponentFileArg ? opponentFileArg.split("=").slice(1).join("=") : "";
const opponentTopArg = process.argv.find(arg => arg.startsWith("--opponents-top="));
const opponentTop = opponentTopArg ? Math.max(0, Number(opponentTopArg.split("=")[1] || 0)) : 0;
const priorityFileArg = process.argv.find(arg => arg.startsWith("--priority-file="));
const priorityFilePath = priorityFileArg ? priorityFileArg.split("=").slice(1).join("=") : "";
const priorityMultiplierArg = process.argv.find(arg => arg.startsWith("--priority-multiplier="));
const priorityMultiplier = priorityMultiplierArg ? Math.max(1, Number(priorityMultiplierArg.split("=")[1] || 1)) : 1;
const candidatePriorSourceArg = process.argv.find(arg => arg.startsWith("--candidate-prior-source="));
const candidatePriorSourcePath = candidatePriorSourceArg ? candidatePriorSourceArg.split("=").slice(1).join("=") : "";
const candidatePriorWeightArg = process.argv.find(arg => arg.startsWith("--candidate-prior-weight="));
const candidatePriorWeight = candidatePriorWeightArg
  ? Math.max(0, Math.min(1, Number(candidatePriorWeightArg.split("=")[1] || 0)))
  : 0;
const rankingModelArg = process.argv.find(arg => arg.startsWith("--ranking-model="));
const rankingModelMode = rankingModelArg ? rankingModelArg.split("=")[1] : "role";
const activeRankingCategories = rankingModelMode === "equal-shields"
  ? EQUAL_SHIELD_RANKING_CATEGORIES
  : ROLE_RANKING_CATEGORIES;
const weightSourceArg = process.argv.find(arg => arg.startsWith("--weight-source="));
const weightSourcePath = weightSourceArg ? weightSourceArg.split("=").slice(1).join("=") : "";
const weightModeArg = process.argv.find(arg => arg.startsWith("--weight-mode="));
const weightMode = weightModeArg ? weightModeArg.split("=")[1] : "competitive";
const seasonArg = process.argv.find(arg => arg.startsWith("--season="));
const generationSeasonId = seasonArg ? safeCacheSegment(seasonArg.split("=").slice(1).join("=")) : "";
const generationOutputRoot = generationSeasonId ? path.join("data", "seasons", generationSeasonId) : "data";
const profilesArg = process.argv.find(arg => arg.startsWith("--profiles="));
const profileFilter = profilesArg
  ? profilesArg.split("=")[1].split(",").map(value => value.trim()).filter(Boolean)
  : null;
const matchupCacheRoot = path.join(ROOT, generationOutputRoot, "matchup-cache", "great-league");
const fallbackMatchupCacheRoot = generationSeasonId
  ? path.join(ROOT, "data", "matchup-cache", "great-league")
  : null;
const matchupCacheStats = {
  enabled: useMatchupCache,
  hits: 0,
  baseHits: 0,
  previewHits: 0,
  misses: 0,
  writes: 0,
  filesRead: 0,
  filesWritten: 0
};

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

function normalizeExplicitOpponentWeights(values) {
  const pairs = Object.entries(values || {})
    .map(([id, value]) => [id, Number(value)])
    .filter(([, value]) => Number.isFinite(value) && value > 0);
  if (!pairs.length) throw new Error("Opponent prevalence weights must contain at least one positive value.");
  const mean = pairs.reduce((sum, [, value]) => sum + value, 0) / pairs.length;
  const normalized = pairs.map(([id, value]) => [id, Math.max(.05, Math.min(4, value / mean))]);
  const normalizedMean = normalized.reduce((sum, [, value]) => sum + value, 0) / normalized.length;
  return new Map(normalized.map(([id, value]) => [id, value / normalizedMean]));
}

function loadExternalOpponentWeights(filePath) {
  if (!filePath) return null;
  const data = readJsonPath(filePath);
  if (args.has("--gradual-weights")) {
    if (weightMode !== "competitive") throw new Error("Gradual weights require competitive mode.");
    return rankingWeightUpdate.updateWeights(data);
  }
  const explicitWeights = data.weights || data.opponentWeights;
  if (explicitWeights && typeof explicitWeights === "object" && !Array.isArray(explicitWeights)) {
    if (weightMode !== "prevalence") {
      throw new Error("Explicit opponent weights require --weight-mode=prevalence.");
    }
    return normalizeExplicitOpponentWeights(explicitWeights);
  }
  if (weightMode === "prevalence") {
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const values = Object.fromEntries(entries
      .map(entry => [entry?.id, entry?.weight ?? entry?.prevalence ?? entry?.frequency])
      .filter(([id, value]) => id && Number.isFinite(Number(value)) && Number(value) > 0));
    return normalizeExplicitOpponentWeights(values);
  }
  const map = new Map();
  for (const entry of data.entries || []) {
    const score = modeScoreForEntry(entry, weightMode);
    map.set(entry.id, scoreToOpponentWeight(score, weightMode));
  }
  return map;
}

function loadCandidatePrior(filePath) {
  if (!filePath) return null;
  const data = readJsonPath(filePath);
  const map = new Map();
  for (const entry of data.entries || []) {
    const score = Number(entry?.overallScore ?? entry?.competitiveScore ?? entry?.weightedScore ?? entry?.averageScore);
    if (entry?.id && Number.isFinite(score)) map.set(entry.id, score);
  }
  if (!map.size) throw new Error("Candidate prior source must contain scored entries.");
  return map;
}

function blendCandidateScore(roleScore, priorScore, weight = 0) {
  const blendWeight = Math.max(0, Math.min(1, Number(weight) || 0));
  const role = Number.isFinite(Number(roleScore)) ? Number(roleScore) : 500;
  const prior = Number.isFinite(Number(priorScore)) ? Number(priorScore) : 500;
  return Math.round(((1 - blendWeight) * role) + (blendWeight * prior));
}

function loadPriorityIds(filePath) {
  if (!filePath) return [];
  const data = readJsonPath(filePath);
  if (Array.isArray(data)) return data.filter(Boolean);
  if (Array.isArray(data.pokemon)) return data.pokemon.filter(Boolean);
  if (Array.isArray(data.entries)) return data.entries.map(entry => entry && entry.id).filter(Boolean);
  return [];
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
  if (relativePath === "battle-data.js" && fs.existsSync(path.join(ROOT, "cramorant-data.js"))) {
    const overlay = fs.readFileSync(path.join(ROOT, "cramorant-data.js"), "utf8");
    vm.runInContext(overlay, context, { filename: "cramorant-data.js", timeout: 30000 });
  }
  return context.window[globalName];
}

function readRootGlobal(relativePath, globalName) {
  const code = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
  const context = { window: {}, console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(code, context, { filename: relativePath, timeout: 30000 });
  return context[globalName] || context.window[globalName];
}

function generationData() {
  const canonicalGameMaster = readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
  const canonicalMovesets = readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS") || {};
  if (!generationSeasonId) return { gameMaster: canonicalGameMaster, standardMovesets: canonicalMovesets, preview: null };
  const preview = readRootGlobal("data/seasons/next-season.js", "BATTLE_NEXT_SEASON");
  if (!preview || safeCacheSegment(preview.id) !== generationSeasonId) {
    throw new Error(`Unknown or unavailable generation season: ${generationSeasonId}`);
  }
  activeGenerationPreview = preview;
  const moveResolved = seasonContext.applyMoveOverrides(canonicalGameMaster, preview.moveOverrides);
  const gameMaster = seasonContext.applyPokemonMoveOverrides(moveResolved, preview.pokemonMoveOverrides);
  return {
    gameMaster,
    standardMovesets: buildPreviewMovesets(canonicalMovesets, gameMaster, preview),
    preview
  };
}

function gameMasterHash(gameMaster) {
  return crypto.createHash("sha256").update(JSON.stringify(gameMaster)).digest("hex");
}

// Moveset defaults live outside the Game Master. Track them separately so a
// ranking can prove which move policy produced its scores and stale reports
// cannot look current merely because the battle data hash is unchanged.
function movesetHash(movesets) {
  return crypto.createHash("sha256").update(JSON.stringify(movesets || {})).digest("hex");
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
    window: {
      PvPeakBattleReliability: battleReliability,
      PvPeakTurnEngine: turnEngine,
      createPvPeakTurnEngineApi: turnEngine.createApi,
      PvPeakMatchupPlanner: matchupPlanner,
      createPvPeakMatchupPlannerApi: matchupPlanner.createApi,
      PvPeakMatchupPlannerAdapter: matchupPlannerAdapter,
      createPvPeakMatchupPlannerAdapterApi: matchupPlannerAdapter.createApi,
      PvPeakBattleIntelligence: battleIntelligence,
      createPvPeakBattleIntelligenceApi: battleIntelligence.createApi,
      location: { search: "" }
    },
    document: { addEventListener: () => {} },
    indexedDB: null,
    Blob: function Blob() {},
    URL: { createObjectURL: () => "" },
    URLSearchParams,
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

function createWorkerAdapter(source, options = {}) {
  const posted = [];
  const context = {
    console,
    setTimeout,
    clearTimeout,
    BATTLE_INTELLIGENCE_STRICT: options.strict === true,
    BATTLE_DRE_STANDARD: options.dreStandard === true,
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
      if (response.error || response.message) {
        const error = new Error(`${payload.key}: ${response.error || response.message}`);
        error.code = response.code || null;
        throw error;
      }
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
    buffApplyChance: Number(move.buffApplyChance ?? 0),
    damageMethod: move.damageMethod || null,
    tags: Array.isArray(move.tags) ? [...move.tags] : []
  };
}

function normalizePokemon(p, moveMap) {
  return {
    id: p.speciesId,
    name: p.speciesName,
    originalFormId: p.originalFormId || p.speciesId,
    dex: p.dex || 0,
    released: p.released !== false,
    types: (p.types || []).filter(type => type && type !== "none"),
    atk: Number(p.baseStats.atk || 100),
    def: Number(p.baseStats.def || 100),
    hp: Number(p.baseStats.hp || 100),
    defaultIVs: p.defaultIVs || {},
    fast: (p.fastMoves || []).filter(id => moveMap.has(id)),
    charged: (p.chargedMoves || []).filter(id => moveMap.has(id)),
    extraChargedMoves: (p.extraChargedMoves || []).filter(id => moveMap.has(id)),
    eliteMoves: p.eliteMoves || [],
    tags: p.tags || [],
    formChange: p.formChange ? JSON.parse(JSON.stringify(p.formChange)) : null
  };
}

function isShadow(p) {
  return p.id.endsWith("_shadow") || p.id.includes("_shadow_");
}

function isEligibleGreatLeaguePokemon(p) {
  if (!p || p.released === false || !p.fast.length || !p.charged.length) return false;
  if (pokemonForms.isMega(p) || pokemonForms.kind(p) === pokemonForms.FORM_KINDS.PRIMAL) return false;
  // These forms are not currently obtainable below the Great League CP cap.
  if (p.id === "giratina_altered" || p.id === "mewtwo_armored") return false;
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

function statsForIvSpread(p, ivAtk, ivDef, ivHp) {
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
  return ((move.energyGain * 2.2) + move.power) / Math.max(1, move.turns || 1);
}

function chargedMoveScore(move) {
  const cost = Math.max(1, move.energyCost || 100);
  const dpe = (move.power || 0) / cost;
  const baitBonus = cost <= 40 ? 8 : 0;
  const pressureBonus = move.power >= 90 ? 10 : 0;
  return (dpe * 32) + baitBonus + pressureBonus;
}

function buildPreviewMovesets(canonicalMovesets, gameMaster, preview) {
  const resolved = JSON.parse(JSON.stringify(canonicalMovesets || {}));
  const normalizedMoves = new Map((gameMaster.moves || []).map(move => [move.moveId, normalizeMove(move)]));
  const changedMoveIds = new Set(Object.keys(preview?.moveOverrides || {}));
  for (const pokemon of gameMaster.pokemon || []) {
    const id = pokemon.speciesId;
    if (!id) continue;
    const baseId = id.replace(/_shadow(_|$)/, "_").replace(/_shadow$/, "");
    const current = resolved[id] || resolved[baseId] || null;
    const availability = preview?.pokemonMoveOverrides?.[id] || null;
    const explicit = preview?.defaultMovesets?.[id] || null;
    const affectedFast = (pokemon.fastMoves || []).filter(moveId => changedMoveIds.has(moveId));
    const affectedCharged = (pokemon.chargedMoves || []).filter(moveId => changedMoveIds.has(moveId));
    const addedFast = availability?.fast?.add || [];
    const addedCharged = availability?.charged?.add || [];
    if (!current && !availability) continue;
    if (!availability && !affectedFast.length && !affectedCharged.length) continue;

    const validFast = moveId => (pokemon.fastMoves || []).includes(moveId) && normalizedMoves.has(moveId);
    const validCharged = moveId => (pokemon.chargedMoves || []).includes(moveId) && normalizedMoves.has(moveId);
    if (explicit && validFast(explicit.fast)) {
      const charged = (explicit.charged || []).filter(validCharged).slice(0, 2);
      if (charged.length) {
        resolved[id] = { ...current, ...explicit, fast: explicit.fast, charged };
        continue;
      }
    }
    let fast = validFast(current?.fast) ? current.fast : null;
    for (const candidate of [...new Set([...affectedFast, ...addedFast].filter(validFast))]) {
      if (!fast || fastMoveScore(normalizedMoves.get(candidate)) > fastMoveScore(normalizedMoves.get(fast))) fast = candidate;
    }
    const charged = [...new Set((current?.charged || []).filter(validCharged))].slice(0, 2);
    const alternatives = [...new Set([...affectedCharged, ...addedCharged].filter(validCharged))]
      .filter(moveId => !charged.includes(moveId))
      .sort((a, b) => chargedMoveScore(normalizedMoves.get(b)) - chargedMoveScore(normalizedMoves.get(a)));
    for (const candidate of alternatives) {
      if (charged.length < 2) {
        charged.push(candidate);
        continue;
      }
      const weakestIndex = chargedMoveScore(normalizedMoves.get(charged[0])) <= chargedMoveScore(normalizedMoves.get(charged[1])) ? 0 : 1;
      if (chargedMoveScore(normalizedMoves.get(candidate)) > chargedMoveScore(normalizedMoves.get(charged[weakestIndex]))) charged[weakestIndex] = candidate;
    }
    if (fast && charged.length) resolved[id] = { ...current, fast, charged };
  }
  return resolved;
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

function createCombatant(p, trainer, profile, moveMap, standardMovesets, pokemonMap = null) {
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
  const combatant = {
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
    shadowDefMult: isShadow(p) ? 0.83333331 : 1,
    cpm: stats.cpm || stats.attack / Math.max(1, p.atk + stats.ivAtk),
    initialFormId: p.id,
    formCatalog: buildCombatantFormCatalog(p, pokemonMap, moveMap)
  };
  return combatant;
}

function buildCombatantFormCatalog(pokemon, pokemonMap, moveMap) {
  if (!pokemonMap) return {};
  if (formCatalogCache.has(pokemon.id)) return formCatalogCache.get(pokemon.id);
  const ids = new Set([pokemon.id]);
  let changed = true;
  while (changed) {
    changed = false;
    pokemonMap.forEach(candidate => {
      const rule = candidate.formChange;
      if (!rule) return;
      const related = [candidate.id, rule.defaultFormId, rule.alternativeFormId].filter(Boolean);
      if (!related.some(id => ids.has(id))) return;
      related.forEach(id => {
        if (!ids.has(id)) {
          ids.add(id);
          changed = true;
        }
      });
    });
  }
  const catalog = {};
  ids.forEach(id => {
    const form = pokemonMap.get(id);
    if (!form) return;
    catalog[id] = {
      p: cloneForMatrix(form),
      fastMoves: form.fast.map(moveId => cloneForMatrix(moveMap.get(moveId))).filter(Boolean),
      chargedMoves: form.charged.map(moveId => cloneForMatrix(moveMap.get(moveId))).filter(Boolean),
      extraChargedMoves: (form.extraChargedMoves || []).map(moveId => cloneForMatrix(moveMap.get(moveId))).filter(Boolean)
    };
  });
  formCatalogCache.set(pokemon.id, catalog);
  return catalog;
}

function createBattleConfig(a, b, profile, moveMap, standardMovesets, pokemonMap = null) {
  return {
    left: createCombatant(a, "A", profile, moveMap, standardMovesets, pokemonMap),
    right: createCombatant(b, "B", profile, moveMap, standardMovesets, pokemonMap),
    startEnergyA: 0,
    startEnergyB: 0
  };
}

function cloneBattleConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function fastEnergyInTurns(fastMove, turns) {
  if (!fastMove) return 0;
  const moveTurns = Math.max(1, Number(fastMove.turns || 1));
  // Count only fast attacks that can actually complete within the advantage
  // window. A five-turn move with six turns of advantage completes once, not
  // twice; rounding up was materially inflating slow fast-move users.
  const uses = Math.max(0, Math.floor(Math.max(0, turns) / moveTurns));
  return Math.max(0, Math.min(100, uses * Number(fastMove.energyGain || 0)));
}

function chargerScoreModifier(pokemon, profile, moveMap, standardMovesets) {
  const stats = profile === RANK1_PROFILE ? rank1Stats(pokemon) : defaultStats(pokemon);
  const moves = selectMoves(pokemon, moveMap, standardMovesets);
  if (!moves.fast || !moves.charged.length) return 1;
  const stab = pokemon.types.includes(moves.fast.type) ? 1.2 : 1;
  const shadowAttack = isShadow(pokemon) ? 1.2 : 1;
  const fastMoveDpt = ((moves.fast.power * stab * shadowAttack) * (stats.attack / 100))
    / Math.max(1, moves.fast.turns || 1);
  const cheapestChargedMove = Math.min(...moves.charged.map(move => Math.max(0, Number(move.energyCost || 0))));
  const maximumEnergyRemaining = Math.max(0, 100 - cheapestChargedMove);
  const farmPressure = Math.pow(Math.max(0.0001, fastMoveDpt / 5), 1 / 6);
  const energyCarryover = Math.sqrt(maximumEnergyRemaining / 100);
  return Math.pow(Math.max(0.0001, energyCarryover * farmPressure), 1 / 6);
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
    opponentWeightMultipliers: {},
    opponentBaseWeights: {},
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
  const winnerSide = details.simultaneousFaint
    ? "tie"
    : details.winnerEdge > 0 ? "A" : details.winnerEdge < 0 ? "B" : "tie";
  return {
    score: Math.round(Number(result.score ?? 500)),
    winnerSide,
    winnerId: winnerSide === "A" ? aId : winnerSide === "B" ? bId : null,
    hpRatioA: Number((details.aHp ?? 0).toFixed(4)),
    hpRatioB: Number((details.bHp ?? 0).toFixed(4)),
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

// Keep the ranking curve aligned with PvPoke's Battle Rating treatment:
// soften very large wins, curve hard losses, and let the Switch category
// weight hard losses more heavily so it rewards genuinely safe pivots.
function normalizeBattleRating(score) {
  let value = Math.max(0, Number(score ?? 500));
  if (value > 700) value = 700 + Math.sqrt(value - 700);
  if (value < 300) value = Math.pow(300, (300 + value) / 600);
  return value;
}

function categoryCellMetrics(categoryKey, result, opponentWeight = 1, bShields = 0) {
  const hpRatioA = Number(result?.hpRatioA);
  const hpRatioB = Number(result?.hpRatioB);
  // The coverage matrix keeps the simulator's richer resource score. Role
  // rankings need the conventional Battle Rating instead: remaining HP plus
  // damage dealt, each worth half of the 0-1000 scale. Mixing the matrix score
  // into roles double-counted saved energy and shields and strongly favored
  // bulky Dark types even when they lost most of the actual matchups.
  let battleRating = Number.isFinite(hpRatioA) && Number.isFinite(hpRatioB)
    ? (hpRatioA + (1 - hpRatioB)) * 500
    : Number(result?.score ?? 500);
  // PvPoke rewards a win for consuming the opponent's shields and for
  // retaining shields. shieldEdge is 75 points per shield difference, so
  // the exact adjustment can be reconstructed from the compact cache result.
  if (battleRating > 500) {
    battleRating += (100 * Number(bShields || 0)) + ((100 / 75) * Number(result?.shieldEdge || 0));
  }
  const score = normalizeBattleRating(battleRating);
  const safetyMultiplier = categoryKey === "switch" && score < 500
    ? 1 + (Math.pow(500 - score, 2) / 20000)
    : 1;
  return {
    score,
    safetyMultiplier,
    effectiveWeight: Number(opponentWeight || 1) * safetyMultiplier
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

function safeCacheSegment(value) {
  return String(value || "unknown").replace(/[^a-z0-9_.-]+/gi, "_");
}

function matchupCachePath(profile, attackerId) {
  return path.join(matchupCacheRoot, safeCacheSegment(profile), `${safeCacheSegment(attackerId)}.json`);
}

function generationPath(...segments) {
  return path.join(generationOutputRoot, ...segments);
}

function fallbackMatchupCachePath(profile, attackerId) {
  return fallbackMatchupCacheRoot
    ? path.join(fallbackMatchupCacheRoot, safeCacheSegment(profile), `${safeCacheSegment(attackerId)}.json`)
    : null;
}

function readCompatibleCache(file, attackerSignature, requirePreviewIdentity = false) {
  if (!file || !fs.existsSync(file)) return null;
  try {
    const cache = JSON.parse(fs.readFileSync(file, "utf8"));
    matchupCacheStats.filesRead++;
    const legacyTimingCache = allowLegacyCache && cache.matrixVersion === "battle-planner-v43";
    if ((!legacyTimingCache && cache.matrixVersion !== MATRIX_VERSION) || cache.attackerSignature !== attackerSignature) return null;
    if (!legacyTimingCache && cache.scoreVersion !== MATCHUP_SCORE_VERSION) return null;
    if (requirePreviewIdentity && (
      cache.seasonId !== activeGenerationPreview?.id ||
      cache.dataVersion !== activeGenerationPreview?.dataVersion
    )) return null;
    return cache && cache.cells && typeof cache.cells === "object" ? cache.cells : {};
  } catch (_) {
    return null;
  }
}

function loadMatchupCacheFile(profile, attackerId, attackerSignature) {
  const file = matchupCachePath(profile, attackerId);
  if (!useMatchupCache) return { file, dirty: false, attackerSignature, cells: {}, baseCells: {} };
  return {
    file,
    dirty: false,
    attackerSignature,
    cells: readCompatibleCache(file, attackerSignature, Boolean(generationSeasonId)) || {},
    baseCells: readCompatibleCache(fallbackMatchupCachePath(profile, attackerId), attackerSignature) || {}
  };
}

function saveMatchupCacheFile(cache) {
  if (!useMatchupCache || !cache || !cache.dirty) return;
  fs.mkdirSync(path.dirname(cache.file), { recursive: true });
  fs.writeFileSync(cache.file, `${JSON.stringify({
    schemaVersion: 1,
    league: "great",
    generatedAt: new Date().toISOString(),
    matrixVersion: MATRIX_VERSION,
    scoreVersion: MATCHUP_SCORE_VERSION,
    seasonId: activeGenerationPreview?.id || null,
    dataVersion: activeGenerationPreview?.dataVersion || null,
    attackerSignature: cache.attackerSignature,
    cells: cache.cells
  })}\n`, "utf8");
  matchupCacheStats.filesWritten++;
}

function moveSignatureForPokemon(p, moveMap, standardMovesets) {
  const moveset = moveIdsFor(p, moveMap, standardMovesets);
  return `${p.id}:${moveset.fast || "none"}:${(moveset.charged || []).join("+") || "none"}`;
}

function combatantStateSignature(combatant) {
  if (!combatant) return "missing";
  const moves = [combatant.fast, ...(combatant.charged || [])].filter(Boolean).map(move => ({
    id: move.id,
    type: move.type,
    power: Number(move.power || 0),
    energyGain: Number(move.energyGain || 0),
    energyCost: Number(move.energyCost || 0),
    turns: Number(move.turns || 0),
    buffs: move.buffs || null,
    buffsSelf: move.buffsSelf || null,
    buffsOpponent: move.buffsOpponent || null,
    buffTarget: move.buffTarget || null,
    buffApplyChance: Number(move.buffApplyChance || 0)
  }));
  return JSON.stringify({
    id: combatant.p?.id || null,
    formId: combatant.currentFormId || combatant.p?.id || null,
    level: Number(combatant.level || 0),
    cp: Number(combatant.cp || 0),
    ivs: [Number(combatant.ivAtk || 0), Number(combatant.ivDef || 0), Number(combatant.ivHp || 0)],
    attack: Number(combatant.attack || 0),
    defense: Number(combatant.defense || 0),
    maxHp: Number(combatant.maxHp || 0),
    hp: Number(combatant.hp || 0),
    energy: Number(combatant.energy || 0),
    shields: Number(combatant.shields || 0),
    stages: [Number(combatant.attackStage || 0), Number(combatant.defenseStage || 0)],
    readyTurn: Number(combatant.readyTurn || 0),
    moves,
    baiting: combatant.baiting || null,
    shieldMode: combatant.shieldMode || null,
    linePolicy: combatant.linePolicy || null,
    mechanicState: combatant.mechanicState || null
  });
}

function matchupCacheKey({ profile, attacker, defender, shieldState, config, category = "standard", extra = "" }) {
  const attackerSig = combatantStateSignature(config?.left);
  const defenderSig = combatantStateSignature(config?.right);
  return [
    MATRIX_VERSION,
    profile,
    category,
    `${attackerSig}>${defenderSig}`,
    shieldState,
    extra
  ].filter(Boolean).join("|");
}

function matchupCacheCellKey({ defender, shieldState, config, category = "standard", extra = "" }) {
  const defenderSig = combatantStateSignature(config?.right);
  return [defenderSig, shieldState, category, extra].filter(Boolean).join("|");
}

function compactCacheResult(result) {
  return [
    result.score,
    result.winnerSide,
    result.winnerId,
    result.hpRatioA,
    result.hpRatioB,
    result.winnerEdge,
    result.hpEdge,
    result.energyEdge,
    result.shieldEdge,
    result.readyEdge,
    result.dangerEdge,
    result.closingCostEdge,
    result.farmPressureEdge,
    result.outpacePressureEdge
  ];
}

function simulateCachedCell({ adapter, cache, seqRef, profile, attacker, defender, shieldState, aShields, bShields, config, category = "standard", extra = "" }) {
  const key = matchupCacheKey({ profile, attacker, defender, shieldState, config, category, extra });
  const cacheKey = matchupCacheCellKey({ defender, shieldState, config, category, extra });
  if (useMatchupCache && cache.cells[cacheKey]) {
    matchupCacheStats.hits++;
    matchupCacheStats.previewHits++;
    return { key, result: inflateCacheResult(cache.cells[cacheKey]) };
  }
  if (useMatchupCache && cache.baseCells?.[cacheKey]) {
    matchupCacheStats.hits++;
    matchupCacheStats.baseHits++;
    return { key, result: inflateCacheResult(cache.baseCells[cacheKey]) };
  }
  matchupCacheStats.misses++;
  if (args.has("--cache-only")) throw new Error(`Missing compatible cached matchup: ${attacker.id} vs ${defender.id} ${shieldState}`);
  const workerResult = adapter.simulate({
    id: ++seqRef.value,
    source: "offline-ranking",
    key,
    signature: MATRIX_VERSION,
    aShields,
    bShields,
    includeSwing: false,
    config
  });
  const result = compactResult(workerResult, attacker.id, defender.id);
  if (useMatchupCache) {
    cache.cells[cacheKey] = compactCacheResult(result);
    cache.dirty = true;
    matchupCacheStats.writes++;
  }
  return { key, result };
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
    generationOutputRoot,
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
    engineVersion: metadata.engineVersion || metadata.matrixVersion,
    profile,
    pokemonId: pokemon.id,
    pokemonName: pokemon.name,
    shieldState,
    opponentCount: rows.length,
    matchups: rows
  });
}

function writeSplitMatchupIndex(metadata) {
  return writeJson(generationPath("matchups", "great-league", "index.json"), {
    schemaVersion: MATCHUP_SCHEMA_VERSION,
    league: "great",
    generatedAt: metadata.generatedAt,
    matrixVersion: metadata.matrixVersion,
    engineVersion: metadata.engineVersion || metadata.matrixVersion,
    totalPokemon: metadata.fullCandidateCount,
    generatedPokemon: metadata.pokemonCount,
    opponentPokemonCount: metadata.opponentPokemonCount,
    profiles: metadata.profiles,
    shieldStates: metadata.shieldScenarios.map(([a, b]) => `${a}-${b}`),
    fileStructure: `${generationOutputRoot.replace(/\\/g, "/")}/matchups/great-league/<shieldState>/<pokemonId>.json`,
    notes: [
      "Each file is from the named Pokemon's perspective as Pokemon A.",
      "A vs B is simulated directly; reverse rows are not inferred."
    ]
  });
}

function createRankingAggregator(pool, profiles, scenarios, moveMap, standardMovesets) {
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
        chargerScoreModifier: chargerScoreModifier(p, profile, moveMap, standardMovesets),
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
  const metrics = categoryCellMetrics(key, cell.result, opponentWeight, cell.bShields);
  const score = metrics.score;
  category.scoreTotal += score;
  category.weightedScoreTotal += score * metrics.effectiveWeight;
  category.weightTotal += metrics.effectiveWeight;
  category.scoreSquaredTotal += score * score;
  category.matchups++;
  category.opponentScores[cell.defenderId] = score;
  category.opponentWeightMultipliers[cell.defenderId] = metrics.safetyMultiplier;
  category.opponentBaseWeights[cell.defenderId] = Number(opponentWeight || 1);
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
  if (aShields === 1 && bShields === 1) updateCategory(entry, "lead", cell, moveset, opponentWeight);
  if (aShields === 0 && bShields === 0) updateCategory(entry, "closer", cell, moveset, opponentWeight);
  if (aShields === 0 && bShields === 1) updateCategory(entry, "attacker", cell, moveset, opponentWeight);
}

function updateRanking(entries, cell, opponentWeight = 1) {
  const entry = entries.get(`${cell.profile}:${cell.attackerId}`);
  if (!entry) return;
  const score = categoryCellMetrics("base", cell.result, opponentWeight, cell.bShields).score;
  const state = entry.shieldStates[cell.shieldState];
  entry.scoreTotal += score;
  entry.weightedScoreTotal += score * opponentWeight;
  entry.scoreWeightTotal += opponentWeight;
  entry.scoreSquaredTotal += score * score;
  entry.matchups++;
  state.scoreTotal += score;
  state.weightedScoreTotal += score * opponentWeight;
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
    const safetyMultiplier = category.opponentWeightMultipliers?.[opponentId] || 1;
    const baseWeight = category.opponentBaseWeights?.[opponentId] || 1;
    const recursiveWeight = opponentWeights.has(opponentId) ? opponentWeights.get(opponentId) : 1;
    const weight = baseWeight * recursiveWeight * safetyMultiplier;
    total += Number(score || 0) * weight;
    weightTotal += weight;
  }
  return weightTotal ? total / weightTotal : null;
}

function rawCategoryAverage(category) {
  return category.matchups ? category.scoreTotal / category.matchups : null;
}

function scoreToCategoryPercent(score, categoryLeader = 1000) {
  if (!Number.isFinite(score)) return null;
  const leader = Number(categoryLeader);
  if (!Number.isFinite(leader) || leader <= 0) return null;
  return Math.max(1, Math.min(100, (score / leader) * 100));
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

function buildCategoryOpponentWeights(entries, categoryKey, options = {}) {
  const iterations = options.iterations ?? 1;
  const exponent = options.exponent ?? 1.65;
  const cutoffIncrease = options.cutoffIncrease ?? .06;
  const weights = new Map([...entries.values()].map(entry => [entry.id, 1]));
  for (let i = 0; i < iterations; i++) {
    const averages = new Map([...entries.values()].map(entry => {
      const category = entry.categories[categoryKey];
      return [entry.id, category ? weightedCategoryAverage(category, weights) : 500];
    }));
    const bestScore = Math.max(...averages.values(), 1);
    const cutoff = .1 + (cutoffIncrease * i);
    const next = new Map(weights);
    for (const [entryId, weightedAverage] of averages) {
      const normalized = Math.max((weightedAverage / bestScore) - cutoff, 0);
      next.set(entryId, Math.pow(normalized, exponent));
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

function finalizeRankings(entries, externalOpponentWeights = null, candidatePrior = null, candidatePriorWeight = 0) {
  const opponentWeights = buildOpponentWeights(entries);
  const equalShieldCategories = new Set(["lead", "closer", "core"]);
  const competitiveOpponentWeights = Object.fromEntries(activeRankingCategories.map(categoryDef => {
    if (!equalShieldCategories.has(categoryDef.key)) {
      return [categoryDef.key, new Map()];
    }
    return [categoryDef.key, buildCategoryOpponentWeights(entries, categoryDef.key, {
      iterations: COMPETITIVE_WEIGHT_ITERATIONS,
      exponent: 1.65,
      cutoffIncrease: .06
    })];
  }));
  const competitiveCategoryAverage = (category, categoryKey) =>
    weightedCategoryAverage(category, competitiveOpponentWeights[categoryKey] || new Map());
  const categoryLeaders = {
    raw: {},
    weighted: {},
    competitive: {}
  };
  const categoryModifier = (entry, categoryKey) => categoryKey === "charger"
    ? Number(entry.chargerScoreModifier || 1)
    : 1;
  for (const categoryDef of activeRankingCategories) {
    const categoryEntries = [...entries.values()].map(entry => ({ entry, category: entry.categories[categoryDef.key] }));
    const rawValues = categoryEntries.map(({ entry, category }) => rawCategoryAverage(category) * categoryModifier(entry, categoryDef.key)).filter(Number.isFinite);
    const weightedValues = categoryEntries.map(({ entry, category }) => weightedCategoryAverage(category, opponentWeights) * categoryModifier(entry, categoryDef.key)).filter(Number.isFinite);
    const competitiveValues = categoryEntries.map(({ entry, category }) => competitiveCategoryAverage(category, categoryDef.key) * categoryModifier(entry, categoryDef.key)).filter(Number.isFinite);
    categoryLeaders.raw[categoryDef.key] = Math.max(...rawValues, 1);
    categoryLeaders.weighted[categoryDef.key] = Math.max(...weightedValues, 1);
    categoryLeaders.competitive[categoryDef.key] = Math.max(...competitiveValues, 1);
  }
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
      const modifier = categoryModifier(entry, categoryDef.key);
      const rawAverage = rawCategoryAverage(category) * modifier;
      const weightedAverage = weightedCategoryAverage(category, opponentWeights) * modifier;
      const competitiveAverage = competitiveCategoryAverage(category, categoryDef.key) * modifier;
      const rawLeader = categoryLeaders.raw[categoryDef.key];
      const weightedLeader = categoryLeaders.weighted[categoryDef.key];
      const competitiveLeader = categoryLeaders.competitive[categoryDef.key];
      categoryScores[categoryDef.key] = {
        label: categoryDef.label,
        weight: categoryDef.weight,
        averageScore: Number.isFinite(rawAverage) ? Math.round(rawAverage) : null,
        weightedScore: Number.isFinite(weightedAverage) ? Math.round(weightedAverage) : null,
        competitiveScore: Number.isFinite(competitiveAverage) ? Math.round(competitiveAverage) : null,
        rawRating: Number.isFinite(rawAverage) ? Math.round(scoreToCategoryPercent(rawAverage, rawLeader)) : null,
        weightedRating: Number.isFinite(weightedAverage) ? Math.round(scoreToCategoryPercent(weightedAverage, weightedLeader)) : null,
        competitiveRating: Number.isFinite(competitiveAverage) ? Math.round(scoreToCategoryPercent(competitiveAverage, competitiveLeader)) : null,
        score: Number.isFinite(competitiveAverage) ? Math.round(scoreToCategoryPercent(competitiveAverage, competitiveLeader)) : null,
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
    const priorScore = candidatePrior?.has(entry.id) ? candidatePrior.get(entry.id) : 500;
    const metaViabilityScore = blendCandidateScore(competitiveScore, priorScore, candidatePriorWeight);
    const overallScore = metaViabilityScore;
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
      roleScore: competitiveScore,
      candidatePriorScore: candidatePrior ? Math.round(priorScore) : null,
      metaViabilityScore,
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
  const sourceData = generationData();
  const gamemaster = sourceData.gameMaster;
  const standardMovesets = sourceData.standardMovesets;
  if (!gamemaster || !Array.isArray(gamemaster.moves) || !Array.isArray(gamemaster.pokemon)) {
    throw new Error("Could not load battle-data.js.");
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
  let fileOpponentIds = [];
  if (opponentFilePath) {
    const opponentData = readJsonPath(opponentFilePath);
    fileOpponentIds = Array.isArray(opponentData)
      ? opponentData
      : (opponentData.entries || []).map(entry => entry && entry.id).filter(Boolean);
    if (opponentTop) fileOpponentIds = fileOpponentIds.slice(0, opponentTop);
  }
  const configuredOpponentIds = [...new Set([
    ...(fileOpponentIds.length ? fileOpponentIds : metaConfig.pokemon),
    ...opponentAddIds
  ])].filter(id => !opponentRemoveIds.includes(id));
  const metaPool = configuredOpponentIds.map(id => allPokemon.get(id)).filter(Boolean);
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
  // Role rankings need the asymmetric 0-1 shield state for Attackers. Keep
  // equal-shields as the explicit lightweight model. The role model only
  // needs the three equal states plus 0-1; --all-shield-states remains
  // available for diagnostics that intentionally require every combination.
  const scenarios = includeAllShieldStates
    ? metaConfig.shieldScenarios
    : rankingModelMode !== "equal-shields"
      ? metaConfig.shieldScenarios.filter(([a, b]) => a === b || (a === 0 && b === 1))
      : metaConfig.shieldScenarios.filter(([a, b]) => a === b);

  if (!pool.length) throw new Error("Great League ranking pool is empty.");
  if (!opponentPool.length) throw new Error("Great League opponent pool is empty.");
  if (!profiles.length) throw new Error("No valid IV profiles selected.");
  if (!scenarios.length) throw new Error("No shield scenarios selected.");

  console.log(`Loading live simulator matrix worker for ${generationSeasonId || "current"}...`);
  const adapter = createWorkerAdapter(extractLiveWorkerSource(), { dreStandard: true });
  const externalOpponentWeights = loadExternalOpponentWeights(weightSourcePath);
  if (candidatePriorWeight > 0 && !candidatePriorSourcePath) {
    throw new Error("--candidate-prior-weight requires --candidate-prior-source.");
  }
  const candidatePrior = loadCandidatePrior(candidatePriorSourcePath);
  if (candidatePrior) {
    console.log(`Loaded ${candidatePrior.size.toLocaleString()} candidate prior scores from ${candidatePriorSourcePath} (${Math.round(candidatePriorWeight * 100)}% blend).`);
  }
  if (externalOpponentWeights) {
    console.log(`Loaded ${externalOpponentWeights.size.toLocaleString()} opponent weights from ${weightSourcePath} (${weightMode}).`);
  }
  const priorityIds = new Set(loadPriorityIds(priorityFilePath));
  if (externalOpponentWeights && priorityMultiplier > 1 && priorityIds.size) {
    for (const id of priorityIds) {
      if (externalOpponentWeights.has(id)) {
        externalOpponentWeights.set(id, Math.min(3.2, externalOpponentWeights.get(id) * priorityMultiplier));
      }
    }
    console.log(`Applied ${priorityMultiplier}x priority to ${priorityIds.size} configured opponents.`);
  }
  const selfMatchupsSkipped = opponentPool === pool || opponentPoolMode === "all";
  const total = profiles.length * scenarios.length * pool.reduce((sum, p) => (
    sum + opponentPool.filter(opponent => !selfMatchupsSkipped || opponent.id !== p.id).length
  ), 0);
  console.log(`Generating Great League ranking: ${pool.length} candidates, ${opponentPool.length} opponents (${opponentPoolMode}), ${profiles.join(", ")} profiles, ${scenarios.length} shield states, ${total} base cells plus category sims.`);

  const generatedAt = new Date().toISOString();
  const cells = [];
  const rankingAggregator = createRankingAggregator(pool, profiles, scenarios, moveMap, standardMovesets);
  let done = 0;
  const seqRef = { value: 0 };
  const extraCategoryCellsPerPair = rankingModelMode === "equal-shields" ? 0 : 2;
  const totalWithCategories = total + (profiles.length * pool.reduce((sum, p) => (
    sum + opponentPool.filter(opponent => !selfMatchupsSkipped || opponent.id !== p.id).length
  ), 0) * extraCategoryCellsPerPair);

  for (const profile of profiles) {
    for (const a of pool) {
      const attackerMoveset = moveIdsFor(a, moveMap, standardMovesets);
      const attackerSignature = combatantStateSignature(createCombatant(a, "A", profile, moveMap, standardMovesets, allPokemon));
      const matchupCache = loadMatchupCacheFile(profile, a.id, attackerSignature);
      const splitRows = splitMatchups
        ? Object.fromEntries(scenarios.map(([aShields, bShields]) => [`${aShields}-${bShields}`, []]))
        : null;
      for (const b of opponentPool) {
        if (selfMatchupsSkipped && a.id === b.id) continue;
        const config = createBattleConfig(a, b, profile, moveMap, standardMovesets, allPokemon);
        for (const [aShields, bShields] of scenarios) {
          const shieldState = `${aShields}-${bShields}`;
          const cached = simulateCachedCell({
            adapter,
            cache: matchupCache,
            seqRef,
            profile,
            attacker: a,
            defender: b,
            shieldState,
            aShields,
            bShields,
            config,
            moveMap,
            standardMovesets
          });
          const cell = {
            key: cached.key,
            profile,
            attackerId: a.id,
            defenderId: b.id,
            attackerName: a.name,
            defenderName: b.name,
            shieldState,
            aShields,
            bShields,
            attackerMoveset,
            result: cached.result
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
          for (const extraCategory of [
            { key: "switch", aShields: 1, bShields: 1, advantageTurns: SWITCH_ADVANTAGE_TURNS },
            { key: "charger", aShields: 1, bShields: 1, advantageTurns: CHARGER_ADVANTAGE_TURNS }
          ]) {
            const bonusEnergy = fastEnergyInTurns(config.left.fast, extraCategory.advantageTurns);
            const energyConfig = cloneBattleConfig(config);
            energyConfig.startEnergyA = bonusEnergy;
            const shieldState = `${extraCategory.aShields}-${extraCategory.bShields}`;
            const cached = simulateCachedCell({
              adapter,
              cache: matchupCache,
              seqRef,
              profile,
              attacker: a,
              defender: b,
              shieldState,
              aShields: extraCategory.aShields,
              bShields: extraCategory.bShields,
              config: energyConfig,
              moveMap,
              standardMovesets,
              category: extraCategory.key,
              extra: `+${bonusEnergy}e`
            });
            const opponentWeight = externalOpponentWeights ? (externalOpponentWeights.get(b.id) || 1) : 1;
            updateCategory(categoryEntry, extraCategory.key, {
              profile,
              attackerId: a.id,
              defenderId: b.id,
              shieldState,
              aShields: extraCategory.aShields,
              bShields: extraCategory.bShields,
              attackerMoveset,
              result: cached.result
            }, attackerMoveset, opponentWeight);
            done++;
            if (done % 1000 === 0 || done === totalWithCategories) {
              const pct = totalWithCategories ? Math.round((done / totalWithCategories) * 1000) / 10 : 100;
              console.log(`  ${done}/${totalWithCategories} cells (${pct}%)`);
            }
          }
        }
      }
      saveMatchupCacheFile(matchupCache);
      if (splitRows) {
        for (const [shieldState, rows] of Object.entries(splitRows)) {
          writeSplitMatchupFile({ profile, pokemon: a, shieldState, rows, metadata: {
            generatedAt,
            matrixVersion: MATRIX_VERSION,
            engineVersion: MATRIX_VERSION,
            scoreVersion: MATCHUP_SCORE_VERSION,
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

  const generationDurationSeconds = Math.round((Date.now() - started) / 1000);
  const metadata = {
    datasetVersion: 1,
    seasonId: sourceData.preview?.id || null,
    dataVersion: sourceData.preview?.dataVersion || null,
    gameMasterHash: gameMasterHash(gamemaster),
    movesetHash: movesetHash(standardMovesets),
    generatedAt,
    generator: "tools/build-great-league-meta-database.js",
    simulatorSource: "PogoPvp.html buildMatrixComputeWorkerSource()",
    dreStandard: true,
    matrixVersion: MATRIX_VERSION,
    engineVersion: MATRIX_VERSION,
    scoreVersion: MATCHUP_SCORE_VERSION,
    cpCap: CP_CAP,
    configuredPokemonCount: allPokemonRanking ? eligiblePokemon.length : metaConfig.pokemon.length,
    fullCandidateCount,
    offset,
    limit: limit || null,
    pokemonCount: pool.length,
    opponentPool: opponentPoolMode,
    opponentPokemonCount: opponentPool.length,
    selfMatchupsSkipped,
    candidatePriorSource: candidatePriorSourcePath || null,
    candidatePriorWeight: candidatePriorWeight || null,
    candidatePriorCoverage: candidatePrior ? pool.filter(pokemon => candidatePrior.has(pokemon.id)).length : null,
    skippedPokemon,
    profiles,
    shieldScenarios: scenarios,
    allShieldStates: includeAllShieldStates,
    rankingOnly,
    splitMatchups,
    weightSource: weightSourcePath || null,
    weightMode: externalOpponentWeights ? weightMode : null,
    priorityFile: priorityFilePath || null,
    priorityMultiplier: priorityMultiplier > 1 ? priorityMultiplier : null,
    ...(args.has("--gradual-weights") && externalOpponentWeights ? {
      weightUpdate: { method: rankingWeightUpdate.METHOD, retainedShare: .5, transitionWidth: 20,
        weights: Object.fromEntries(externalOpponentWeights) }
    } : {}),
    matchupCache: {
      enabled: useMatchupCache,
      hits: matchupCacheStats.hits,
      baseHits: matchupCacheStats.baseHits,
      previewHits: matchupCacheStats.previewHits,
      misses: matchupCacheStats.misses,
      writes: matchupCacheStats.writes,
      filesRead: matchupCacheStats.filesRead,
      filesWritten: matchupCacheStats.filesWritten
    },
    generationDurationSeconds,
    theoreticalSimulations: totalWithCategories,
    completedSimulations: done,
    failedSimulations: 0,
    skippedSimulations: 0,
    retries: 0,
    peakMemoryBytes: process.memoryUsage ? process.memoryUsage().rss : null,
    cells: done,
    baseCells: total,
    rankingModel: {
      version: 1,
      mode: rankingModelMode,
      categories: activeRankingCategories,
      weighting: externalOpponentWeights
        ? (weightMode === "prevalence" ? "external-opponent-prevalence" : "external-opponent-strength")
        : "iterative-opponent-strength",
      weightingIterations: CATEGORY_WEIGHT_ITERATIONS,
      competitiveWeightingIterations: COMPETITIVE_WEIGHT_ITERATIONS,
      competitiveWeightExponent: 1.65,
      competitiveWeightCutoff: 0.1,
      competitiveWeightCutoffIncrease: 0.06,
      overall: candidatePriorWeight > 0
        ? `candidate-prior blend (${Math.round((1 - candidatePriorWeight) * 100)}% normalized role score, ${Math.round(candidatePriorWeight * 100)}% candidate prior)`
        : rankingModelMode === "equal-shields"
          ? "competitive weighted geometric mean of category scores normalized to each category leader"
          : "weighted geometric mean of category scores normalized to each category leader",
      candidatePrior: candidatePriorWeight > 0 ? {
        source: candidatePriorSourcePath,
        weight: candidatePriorWeight,
        missingCandidatesUseScore: 500
      } : null,
      exposedScores: ["rawScore", "weightedScore", "competitiveScore", "roleScore", "metaViabilityScore"],
      advantageTurns: {
        switch: SWITCH_ADVANTAGE_TURNS,
        charger: CHARGER_ADVANTAGE_TURNS
      },
      notes: rankingModelMode === "equal-shields"
        ? [
          "The main ranking simulates every candidate against every eligible opponent.",
          "Only equal-shield scenarios are used: 0-0, 1-1, and 2-2.",
          "Raw score is the full-field average.",
          "Weighted score iteratively values stronger opponents more.",
          "Competitive score strongly discounts low-ranked field noise and is used as the displayed overall score."
        ]
        : [
          "Lead uses the one-shield scenario; Closer uses zero shields; Attacker starts down one shield.",
          "Switch uses one-shield simulations with energy generated over four turns.",
          "Charger uses one-shield simulations with energy generated over six turns, then factors fast-move pressure and maximum energy carryover.",
          "Role Battle Ratings use remaining HP plus damage dealt; the coverage matrix keeps the simulator resource score.",
          "Battle Ratings use a soft cap above 700 and a hard-loss curve below 300.",
          "Switch gives extra weight to losses below 500 to favor safe pivots.",
          "Equal-shield categories use separate one-pass recursive opponent weights (exponent 1.65, cutoff 0.1); energy-advantage categories use uniform opponent weights unless an explicit prevalence file is supplied.",
          "Category scores are normalized to each category leader before the geometric mean."
        ]
    }
  };
  const finalizedRankingEntries = finalizeRankings(rankingAggregator, externalOpponentWeights, candidatePrior, candidatePriorWeight);
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
  const rankingOutputArg = process.argv.find(arg => arg.startsWith("--ranking-output="));
  if (rankingOutputArg) {
    const target = path.resolve(ROOT, rankingOutputArg.slice("--ranking-output=".length));
    const relative = path.relative(ROOT, target);
    if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.startsWith(`reports${path.sep}`)) {
      throw new Error("Experimental ranking output must be inside the repository reports directory.");
    }
    writeJson(relative, rankings);
    const quality = runQualityPipeline({ datasetPath: relative, writeMetadata: false, writeReport: false });
    console.log(`Dataset quality report: ${quality.status}.`);
    if (quality.status !== "VALID") throw new Error("Experimental ranking failed dataset validation.");
    console.log(`Wrote ${relative}. Cache hits: ${matchupCacheStats.hits}, misses: ${matchupCacheStats.misses}.`);
    return;
  }
  const rankingPath = chunkOutput
    ? generationPath("ranking-chunks", `great-league-rankings-${String(offset).padStart(4, "0")}.json`)
    : generationPath("great-league-rankings.json");
  const rankingSize = writeJson(rankingPath, rankings);
  let fullRankingSize = 0;
  if (fullOutput && !chunkOutput) {
    fullRankingSize = writeJson(generationPath("rankings", "great-league-full.json"), rankings);
  }
  if (!chunkOutput) writeRankingScript(rankings);
  if (!chunkOutput && generationSeasonId) writeDefaultMovesets(standardMovesets);
  const splitIndexSize = splitMatchups ? writeSplitMatchupIndex(metadata) : 0;
  const matchupSize = matchups ? writeJson(generationPath("great-league-matchups.json"), matchups) : 0;
  const elapsed = Math.round((Date.now() - started) / 1000);
  console.log(`Wrote ${rankingPath} (${rankingSize.toLocaleString()} bytes).`);
  if (fullRankingSize) console.log(`Wrote data/rankings/great-league-full.json (${fullRankingSize.toLocaleString()} bytes).`);
  if (!chunkOutput) console.log(`Wrote data/great-league-rankings.js.`);
  if (splitIndexSize) console.log(`Wrote data/matchups/great-league/index.json (${splitIndexSize.toLocaleString()} bytes).`);
  if (matchups) console.log(`Wrote data/great-league-matchups.json (${matchupSize.toLocaleString()} bytes).`);
  if (!chunkOutput) {
    const qualityReport = runQualityPipeline({
      datasetPath: rankingPath,
      writeMetadata: !generationSeasonId,
      writeReport: !generationSeasonId
    });
    console.log(`Dataset quality report: ${qualityReport.status}.`);
  }
  if (useMatchupCache) {
    console.log(`Matchup cache: ${matchupCacheStats.hits.toLocaleString()} hits (${matchupCacheStats.baseHits.toLocaleString()} Current base, ${matchupCacheStats.previewHits.toLocaleString()} preview), ${matchupCacheStats.misses.toLocaleString()} misses, ${matchupCacheStats.writes.toLocaleString()} writes, ${matchupCacheStats.filesWritten.toLocaleString()} files written.`);
  }
  savePersistentRank1Stats();
  console.log(`Done in ${elapsed}s.`);
}

function mergeRankingChunks() {
  const mergedSourceData = generationSeasonId ? generationData() : null;
  const chunkDir = path.join(ROOT, generationPath("ranking-chunks"));
  const files = fs.existsSync(chunkDir)
    ? fs.readdirSync(chunkDir)
      .filter(name => /^great-league-rankings-\d+\.json$/.test(name))
      .filter(name => !mergeOffsets || mergeOffsets.has(name.match(/-(\d+)\.json$/)[1]))
      .sort()
    : [];
  if (!files.length) throw new Error("No ranking chunks found.");
  const chunks = files.map(name => readJson(generationPath("ranking-chunks", name)));
  const entries = chunks.flatMap(chunk => chunk.entries || []);
  const totalCells = chunks.reduce((sum, chunk) => sum + Number(chunk.metadata && chunk.metadata.cells || 0), 0);
  const mergedMatchupCache = chunks.reduce((summary, chunk) => {
    const stats = chunk.metadata && chunk.metadata.matchupCache;
    if (!stats) return summary;
    summary.enabled = summary.enabled || Boolean(stats.enabled);
    summary.hits += Number(stats.hits || 0);
    summary.misses += Number(stats.misses || 0);
    summary.writes += Number(stats.writes || 0);
    summary.filesRead += Number(stats.filesRead || 0);
    summary.filesWritten += Number(stats.filesWritten || 0);
    return summary;
  }, { enabled: false, hits: 0, misses: 0, writes: 0, filesRead: 0, filesWritten: 0 });
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
      gameMasterHash: mergedSourceData ? gameMasterHash(mergedSourceData.gameMaster) : chunks[0].metadata.gameMasterHash,
      generatedAt: new Date().toISOString(),
      mergedFromChunks: files.length,
      pokemonCount: entries.length,
      cells: totalCells,
      completedSimulations: chunks.reduce((sum, chunk) => sum + Number(chunk.metadata.completedSimulations || 0), 0),
      theoreticalSimulations: chunks.reduce((sum, chunk) => sum + Number(chunk.metadata.theoreticalSimulations || 0), 0),
      baseCells: chunks.reduce((sum, chunk) => sum + Number(chunk.metadata.baseCells || 0), 0),
      matchupCache: mergedMatchupCache,
      offset: 0,
      limit: null,
      rankingOnly: true
    },
    entries: entries.map((entry, index) => ({ ...entry, rank: index + 1 }))
  };
  const rankingPath = generationPath("great-league-rankings.json");
  const rankingSize = writeJson(rankingPath, merged);
  const fullRankingSize = fullOutput ? writeJson(generationPath("rankings", "great-league-full.json"), merged) : 0;
  writeRankingScript(merged);
  if (generationSeasonId) writeDefaultMovesets(mergedSourceData.standardMovesets);
  const qualityReport = runQualityPipeline({ datasetPath: rankingPath, writeMetadata: !generationSeasonId, writeReport: !generationSeasonId });
  console.log(`Merged ${files.length} chunks into data/great-league-rankings.json (${rankingSize.toLocaleString()} bytes).`);
  if (fullRankingSize) console.log(`Wrote data/rankings/great-league-full.json (${fullRankingSize.toLocaleString()} bytes).`);
  console.log(`Wrote data/great-league-rankings.js.`);
  console.log(`Dataset quality report: ${qualityReport.status}.`);
}

function writeRankingScript(rankings) {
  const relativePath = generationPath("great-league-rankings.js");
  const file = path.join(ROOT, relativePath);
  ensureDir(path.dirname(relativePath));
  const globalName = generationSeasonId ? "TWILIGHT_TRAILS_RANKINGS" : "GREAT_LEAGUE_RANKINGS";
  fs.writeFileSync(file, `window.${globalName} = ${JSON.stringify(rankings, null, 2)};\n`, "utf8");
}

function writeDefaultMovesets(standardMovesets) {
  const jsonPath = generationPath("default-movesets.json");
  writeJson(jsonPath, standardMovesets);
  const jsPath = generationPath("default-movesets.js");
  ensureDir(path.dirname(jsPath));
  fs.writeFileSync(path.join(ROOT, jsPath), `window.TWILIGHT_TRAILS_DEFAULT_MOVESETS = ${JSON.stringify(standardMovesets, null, 2)};\n`, "utf8");
}

if (require.main === module) {
  if (mergeChunks) {
    mergeRankingChunks();
  } else {
    main();
  }
}

module.exports = {
  MATRIX_VERSION,
  DEFAULT_PROFILE,
  RANK1_PROFILE,
  readWindowGlobal,
  extractLiveWorkerSource,
  movesetHash,
  createWorkerAdapter,
  normalizeMove,
  normalizePokemon,
  generationData,
  buildPreviewMovesets,
  normalizeExplicitOpponentWeights,
  loadCandidatePrior,
  blendCandidateScore,
  defaultStats,
  statsForIvSpread,
  rank1Stats,
  combatantStateSignature,
  createCombatant,
  createBattleConfig,
  cloneBattleConfig,
  fastEnergyInTurns,
  compactResult
};
