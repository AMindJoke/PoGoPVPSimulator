"use strict";

const fs = require("fs");
const path = require("path");
const { runQualityPipeline } = require("./validate-great-league-dataset");

const ROOT = path.resolve(__dirname, "..");
const RANKING_PATH = path.join(ROOT, "data", "great-league-rankings.json");
const RANKING_JS_PATH = path.join(ROOT, "data", "great-league-rankings.js");
const FULL_RANKING_PATH = path.join(ROOT, "data", "rankings", "great-league-full.json");
const META_PATH = path.join(ROOT, "data", "great-league-meta.json");
const META_WEIGHTS_PATH = path.join(ROOT, "data", "great-league-meta-weights.json");
const CACHE_DIR = path.join(ROOT, "data", "matchup-cache", "great-league", "rank1");

const CATEGORIES = [
  { key: "closer", label: "0 Shields", state: "0-0", weight: 1 },
  { key: "core", label: "1 Shield", state: "1-1", weight: 1 },
  { key: "lead", label: "2 Shields", state: "2-2", weight: 1 }
];

const MODEL = {
  version: 2,
  label: "competitive-meta-v2",
  passes: 4,
  dampeningScale: 170,
  dampeningCap: 170,
  metaShare: 0.7,
  fieldShare: 0.2,
  consistencyShare: 0.1,
  candidateSimulationShare: 0.72,
  candidatePriorShare: 0.28,
  candidatePriorScores: {
    core: 570,
    common: 535,
    spice: 455,
    unweighted: 495
  },
  stableWeightShare: 0.72,
  dynamicWeightShare: 0.28,
  metaSeedMultiplier: 1.6,
  top100Multiplier: 1.06,
  top250Multiplier: 1.02,
  weightInertia: 0.82,
  minWeight: 0.12,
  maxWeight: 4,
  exponent: 3.2,
  floor: 520,
  consistencyPenalty: 0.25,
  maxConsistencyPenalty: 80
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}

function dampenScore(score) {
  if (!Number.isFinite(score)) return null;
  return Math.round(500 + Math.tanh((score - 500) / MODEL.dampeningScale) * MODEL.dampeningCap);
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

function scoreFromCategoryValues(categoryScores, fieldName) {
  const values = CATEGORIES.flatMap(category => {
    const score = categoryScores[category.key] && categoryScores[category.key][fieldName];
    return Number.isFinite(score) ? Array(Math.max(1, Math.round(category.weight * 4))).fill(score) : [];
  });
  const mean = geometricMean(values);
  return Number.isFinite(mean) ? Math.round(mean * 10) : null;
}

function baseStrengthScore(entry) {
  return entry.competitiveScore || entry.overallScore || entry.weightedScore || entry.averageScore || 500;
}

function strengthWeight(score) {
  const safeScore = Number.isFinite(score) ? score : 500;
  if (safeScore < MODEL.floor) return MODEL.minWeight;
  const raw = Math.pow(Math.max(0.05, safeScore / 500), MODEL.exponent);
  return clamp(MODEL.minWeight, MODEL.maxWeight, raw);
}

function loadMetaWeightConfig() {
  if (!fs.existsSync(META_WEIGHTS_PATH)) return { ids: new Set(), weights: new Map(), config: null };
  const config = readJson(META_WEIGHTS_PATH);
  const tierWeights = config.tierWeights || {};
  const ids = new Set();
  const weights = new Map();
  const entryMeta = new Map();
  for (const entry of config.entries || []) {
    if (!entry || !entry.id) continue;
    const tier = entry.tier || "spice";
    const baseWeight = Number.isFinite(Number(entry.usageWeight))
      ? Number(entry.usageWeight)
      : Number(tierWeights[tier] || 1);
    const confidence = Number.isFinite(Number(entry.confidence))
      ? clamp(0.1, 1, Number(entry.confidence))
      : 1;
    const multiplier = baseWeight * confidence;
    ids.add(entry.id);
    weights.set(entry.id, Math.max(weights.get(entry.id) || 0, multiplier));
    entryMeta.set(entry.id, {
      tier,
      usageWeight: baseWeight,
      confidence,
      effectiveWeight: multiplier,
      roles: entry.roles || [],
      notes: entry.notes || ""
    });
  }
  for (const [tier, pokemonIds] of Object.entries(config.tiers || {})) {
    const multiplier = Number(tierWeights[tier] || 1);
    for (const id of pokemonIds || []) {
      ids.add(id);
      weights.set(id, Math.max(weights.get(id) || 0, multiplier));
      if (!entryMeta.has(id)) {
        entryMeta.set(id, {
          tier,
          usageWeight: multiplier,
          confidence: 1,
          effectiveWeight: multiplier,
          roles: [],
          notes: ""
        });
      }
    }
  }
  return { ids, weights, entryMeta, config };
}

function stableBaselineWeight(entry, metaIds, metaWeights) {
  let weight = 1;
  if (metaWeights.has(entry.id)) weight *= metaWeights.get(entry.id);
  else if (metaIds.has(entry.id)) weight *= MODEL.metaSeedMultiplier;
  return clamp(MODEL.minWeight, MODEL.maxWeight, weight);
}

function candidatePriorScore(entry, entryMeta) {
  const meta = entryMeta && entryMeta.get(entry.id);
  const tier = meta && meta.tier ? meta.tier : "unweighted";
  const tierScore = MODEL.candidatePriorScores[tier] || MODEL.candidatePriorScores.unweighted;
  const confidence = meta && Number.isFinite(Number(meta.confidence))
    ? clamp(0.1, 1, Number(meta.confidence))
    : 1;
  return Math.round(500 + ((tierScore - 500) * confidence));
}

function applyCandidatePrior(simulationScore, priorScore) {
  if (!Number.isFinite(simulationScore)) return simulationScore;
  if (!Number.isFinite(priorScore)) return simulationScore;
  return Math.round(
    (simulationScore * MODEL.candidateSimulationShare) +
    (priorScore * MODEL.candidatePriorShare)
  );
}

function buildWeights(entries, metaIds, metaWeights, previousWeights = null) {
  const topRankById = new Map(entries.map(entry => [entry.id, Number(entry.rank || 99999)]));
  return new Map(entries.map(entry => {
    const stable = stableBaselineWeight(entry, metaIds, metaWeights);
    let dynamic = strengthWeight(baseStrengthScore(entry));
    const rank = topRankById.get(entry.id) || 99999;
    if (rank <= 100) dynamic *= MODEL.top100Multiplier;
    else if (rank <= 250) dynamic *= MODEL.top250Multiplier;
    const target = clamp(
      MODEL.minWeight,
      MODEL.maxWeight,
      (stable * MODEL.stableWeightShare) + (dynamic * MODEL.dynamicWeightShare)
    );
    const previous = previousWeights && previousWeights.has(entry.id) ? previousWeights.get(entry.id) : target;
    const blended = (previous * MODEL.weightInertia) + (target * (1 - MODEL.weightInertia));
    return [entry.id, clamp(MODEL.minWeight, MODEL.maxWeight, blended)];
  }));
}

function emptyCategory(label) {
  return {
    label,
    scoreTotal: 0,
    dampenedScoreTotal: 0,
    weightedScoreTotal: 0,
    weightTotal: 0,
    metaScoreTotal: 0,
    metaWeightTotal: 0,
    scoreSquaredTotal: 0,
    matchups: 0,
    wins: 0,
    losses: 0,
    ties: 0
  };
}

function parseCacheCellKey(key) {
  const [opponentSignature, shieldState] = key.split("|");
  if (!opponentSignature || !shieldState) return null;
  const opponentId = opponentSignature.split(":")[0];
  return { opponentId, shieldState };
}

function cellScore(value) {
  if (Array.isArray(value)) return Number(value[0]);
  return Number(value && value.score);
}

function accumulateRows(ranking, weights, metaIds, entryMeta = new Map()) {
  const knownIds = new Set(ranking.entries.map(entry => entry.id));
  const rows = [];
  let filesRead = 0;
  let cellsRead = 0;

  for (const base of ranking.entries) {
    const file = path.join(CACHE_DIR, `${base.id}.json`);
    if (!fs.existsSync(file)) continue;
    const cache = readJson(file);
    filesRead++;

    const categories = Object.fromEntries(CATEGORIES.map(category => [category.key, emptyCategory(category.label)]));
    const shieldStates = Object.fromEntries(CATEGORIES.map(category => [category.state, emptyCategory(category.label)]));
    let scoreTotal = 0;
    let dampenedScoreTotal = 0;
    let scoreSquaredTotal = 0;
    let matchups = 0;
    let wins = 0;
    let losses = 0;
    let ties = 0;

    for (const [key, value] of Object.entries(cache.cells || {})) {
      const parsed = parseCacheCellKey(key);
      if (!parsed || !knownIds.has(parsed.opponentId)) continue;
      const categoryDef = CATEGORIES.find(category => category.state === parsed.shieldState);
      if (!categoryDef) continue;
      const score = cellScore(value);
      if (!Number.isFinite(score)) continue;
      const dampened = dampenScore(score);
      const opponentWeight = weights.get(parsed.opponentId) || 1;
      const metaWeight = metaIds.has(parsed.opponentId) ? opponentWeight : 0;
      const category = categories[categoryDef.key];
      const shield = shieldStates[categoryDef.state];

      for (const bucket of [category, shield]) {
        bucket.scoreTotal += score;
        bucket.dampenedScoreTotal += dampened;
        bucket.weightedScoreTotal += dampened * opponentWeight;
        bucket.weightTotal += opponentWeight;
        bucket.metaScoreTotal += dampened * metaWeight;
        bucket.metaWeightTotal += metaWeight;
        bucket.scoreSquaredTotal += dampened * dampened;
        bucket.matchups++;
        if (score > 500) bucket.wins++;
        else if (score < 500) bucket.losses++;
        else bucket.ties++;
      }

      scoreTotal += score;
      dampenedScoreTotal += dampened;
      scoreSquaredTotal += dampened * dampened;
      matchups++;
      if (score > 500) wins++;
      else if (score < 500) losses++;
      else ties++;
      cellsRead++;
    }

    const categoryScores = {};
    for (const def of CATEGORIES) {
      const category = categories[def.key];
      const rawAverage = category.matchups ? category.scoreTotal / category.matchups : null;
      const dampenedAverage = category.matchups ? category.dampenedScoreTotal / category.matchups : null;
      const fieldAverage = category.weightTotal ? category.weightedScoreTotal / category.weightTotal : dampenedAverage;
      const metaAverage = category.metaWeightTotal ? category.metaScoreTotal / category.metaWeightTotal : fieldAverage;
      const stdDev = category.matchups
        ? Math.sqrt(Math.max(0, (category.scoreSquaredTotal / category.matchups) - Math.pow(dampenedAverage, 2)))
        : 0;
      const consistencyAverage = Number.isFinite(fieldAverage)
        ? fieldAverage - Math.min(MODEL.maxConsistencyPenalty, stdDev * MODEL.consistencyPenalty)
        : null;
      const competitiveAverage = [metaAverage, fieldAverage, consistencyAverage].every(Number.isFinite)
        ? (metaAverage * MODEL.metaShare) + (fieldAverage * MODEL.fieldShare) + (consistencyAverage * MODEL.consistencyShare)
        : fieldAverage;

      categoryScores[def.key] = {
        label: def.label,
        weight: def.weight,
        averageScore: Number.isFinite(rawAverage) ? Math.round(rawAverage) : null,
        dampenedScore: Number.isFinite(dampenedAverage) ? Math.round(dampenedAverage) : null,
        weightedScore: Number.isFinite(fieldAverage) ? Math.round(fieldAverage) : null,
        metaScore: Number.isFinite(metaAverage) ? Math.round(metaAverage) : null,
        consistencyScore: Number.isFinite(consistencyAverage) ? Math.round(consistencyAverage) : null,
        competitiveScore: Number.isFinite(competitiveAverage) ? Math.round(competitiveAverage) : null,
        rawRating: Number.isFinite(rawAverage) ? Math.round(scoreToCategoryPercent(rawAverage)) : null,
        weightedRating: Number.isFinite(fieldAverage) ? Math.round(scoreToCategoryPercent(fieldAverage)) : null,
        metaRating: Number.isFinite(metaAverage) ? Math.round(scoreToCategoryPercent(metaAverage)) : null,
        competitiveRating: Number.isFinite(competitiveAverage) ? Math.round(scoreToCategoryPercent(competitiveAverage)) : null,
        score: Number.isFinite(competitiveAverage) ? Math.round(scoreToCategoryPercent(competitiveAverage)) : null,
        matchups: category.matchups,
        metaMatchups: category.metaWeightTotal ? metaIds.size : 0,
        wins: category.wins,
        losses: category.losses,
        ties: category.ties,
        moveUsage: base.categoryScores && base.categoryScores[def.key] && base.categoryScores[def.key].moveUsage
          ? base.categoryScores[def.key].moveUsage
          : { fast: [], charged: [] }
      };
    }

    const rawScore = scoreFromCategoryValues(categoryScores, "rawRating");
    const weightedScore = scoreFromCategoryValues(categoryScores, "weightedRating");
    const metaScore = scoreFromCategoryValues(categoryScores, "metaRating");
    const simulationCompetitiveScore = scoreFromCategoryValues(categoryScores, "competitiveRating");
    const priorScore = candidatePriorScore(base, entryMeta);
    const competitiveScore = applyCandidatePrior(simulationCompetitiveScore, priorScore);
    const dampenedAverage = matchups ? dampenedScoreTotal / matchups : null;

    rows.push({
      ...base,
      averageScore: matchups ? Math.round(scoreTotal / matchups) : base.averageScore,
      dampenedAverageScore: Number.isFinite(dampenedAverage) ? Math.round(dampenedAverage) : null,
      externalWeightedAverageScore: metaScore,
      weightedAverageScore: weightedScore,
      rawScore,
      weightedScore,
      metaScore,
      simulationCompetitiveScore,
      candidatePriorScore: priorScore,
      candidateMetaTier: entryMeta.has(base.id) ? entryMeta.get(base.id).tier : "unweighted",
      competitiveScore,
      overallScore: competitiveScore,
      categoryScores,
      scoreStdDev: matchups ? Number(Math.sqrt(Math.max(0, (scoreSquaredTotal / matchups) - Math.pow(dampenedAverage, 2))).toFixed(2)) : null,
      matchups,
      wins,
      losses,
      ties,
      winRate: matchups ? Number((wins / matchups).toFixed(4)) : base.winRate,
      shieldStates: Object.fromEntries(CATEGORIES.map(def => {
        const shield = shieldStates[def.state];
        return [def.state, {
          averageScore: shield.matchups ? Math.round(shield.scoreTotal / shield.matchups) : null,
          dampenedScore: shield.matchups ? Math.round(shield.dampenedScoreTotal / shield.matchups) : null,
          weightedScore: shield.weightTotal ? Math.round(shield.weightedScoreTotal / shield.weightTotal) : null,
          metaScore: shield.metaWeightTotal ? Math.round(shield.metaScoreTotal / shield.metaWeightTotal) : null,
          matchups: shield.matchups,
          wins: shield.wins,
          losses: shield.losses,
          ties: shield.ties
        }];
      }))
    });
  }

  rows.sort((a, b) =>
    (b.overallScore || 0) - (a.overallScore || 0) ||
    (b.metaScore || 0) - (a.metaScore || 0) ||
    (b.weightedScore || 0) - (a.weightedScore || 0) ||
    (b.winRate || 0) - (a.winRate || 0) ||
    a.name.localeCompare(b.name)
  );
  rows.forEach((row, index) => row.rank = index + 1);
  return { rows, filesRead, cellsRead };
}

function run(options = {}) {
  const passes = Math.max(1, Number(options.passes || MODEL.passes));
  const ranking = readJson(RANKING_PATH);
  const meta = fs.existsSync(META_PATH) ? readJson(META_PATH) : { pokemon: [] };
  const metaWeightConfig = loadMetaWeightConfig();
  const metaIds = new Set([...(meta.pokemon || []), ...metaWeightConfig.ids]);
  const metaWeights = metaWeightConfig.weights;
  let current = ranking.entries;
  let weights = buildWeights(current, metaIds, metaWeights);
  const summaries = [];
  let last = null;

  for (let pass = 1; pass <= passes; pass++) {
    const workingRanking = { ...ranking, entries: current };
    last = accumulateRows(workingRanking, weights, metaIds, metaWeightConfig.entryMeta);
    current = last.rows;
    weights = buildWeights(current, metaIds, metaWeights, weights);
    summaries.push({
      pass,
      filesRead: last.filesRead,
      cellsRead: last.cellsRead,
      top: current.slice(0, 12).map(entry => ({ rank: entry.rank, name: entry.name, score: entry.competitiveScore }))
    });
  }

  const output = {
    ...ranking,
    metadata: {
      ...ranking.metadata,
      generatedAt: new Date().toISOString(),
      rankingModel: {
        ...(ranking.metadata && ranking.metadata.rankingModel || {}),
        version: MODEL.version,
        mode: "equal-shields",
        weighting: MODEL.label,
        overall: "Simulation score adjusted by a light candidate meta prior. Simulation score uses 70% meta-seed score, 20% weighted field score, 10% consistency-adjusted score, using dampened matchup ratings.",
        dampening: {
          formula: "500 + tanh((score - 500) / scale) * cap",
          scale: MODEL.dampeningScale,
          cap: MODEL.dampeningCap
        },
        mix: {
        metaShare: MODEL.metaShare,
        fieldShare: MODEL.fieldShare,
        consistencyShare: MODEL.consistencyShare
      },
      metaWeights: {
        source: "data/great-league-meta-weights.json",
        tierWeights: metaWeightConfig.config ? metaWeightConfig.config.tierWeights : null,
        confidenceWeights: metaWeightConfig.config ? metaWeightConfig.config.confidenceWeights : null,
        curatedPokemonCount: metaWeightConfig.ids.size,
        stableWeightShare: MODEL.stableWeightShare,
        dynamicWeightShare: MODEL.dynamicWeightShare
      },
      candidatePrior: {
        simulationShare: MODEL.candidateSimulationShare,
        priorShare: MODEL.candidatePriorShare,
        tierScores: MODEL.candidatePriorScores,
        note: "Candidate tier is a light prior, not a manual ranking override. Strong spice can still rise, but core/common candidates no longer compete on simulation output alone."
      },
      notes: [
          "Raw matchup simulations are preserved in the cache.",
          "Ranking v2 compresses extreme wins/losses so farming weak field entries matters less.",
          "Meta seed opponents receive extra weight.",
          "Candidate meta tier now provides a light prior to reduce unrealistic spice over-ranking.",
          "Top-ranked opponents from each pass receive additional weight.",
          "The displayed competitive score is based on equal-shield scenarios: 0-0, 1-1, and 2-2."
        ]
      },
      recursiveWeightPasses: Number(ranking.metadata && ranking.metadata.recursiveWeightPasses || 0) + passes,
      recursiveWeighting: {
        model: MODEL.label,
        passes,
        metaSeedCount: metaIds.size,
        curatedMetaWeightCount: metaWeightConfig.ids.size,
        curatedMetaSchemaVersion: metaWeightConfig.config ? metaWeightConfig.config.schemaVersion : null,
        cellsRead: last ? last.cellsRead : 0,
        filesRead: last ? last.filesRead : 0,
        parameters: MODEL
      },
      matchupCache: {
        ...(ranking.metadata && ranking.metadata.matchupCache || {}),
        enabled: true,
        recursiveReads: last ? last.cellsRead : 0
      }
    },
    entries: current
  };

  writeJson(RANKING_PATH, output);
  writeJson(FULL_RANKING_PATH, output);
  fs.writeFileSync(RANKING_JS_PATH, `window.GREAT_LEAGUE_RANKINGS = ${JSON.stringify(output, null, 2)};\n`, "utf8");
  const report = runQualityPipeline({ datasetPath: "data/great-league-rankings.json", writeMetadata: true, writeReport: true });
  return {
    summaries,
    validation: {
      status: report.status,
      errors: report.errors ? report.errors.length : 0,
      warnings: report.warnings ? report.warnings.length : 0
    },
    top: current.slice(0, 25).map(entry => ({ rank: entry.rank, name: entry.name, score: entry.competitiveScore, metaScore: entry.metaScore }))
  };
}

if (require.main === module) {
  const passesArg = process.argv.find(arg => arg.startsWith("--passes="));
  const passes = passesArg ? Number(passesArg.split("=")[1]) : MODEL.passes;
  const result = run({ passes });
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { run, dampenScore, MODEL };
