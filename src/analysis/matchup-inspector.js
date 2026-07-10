"use strict";

const { analyzeMatchupCell, classifyScore } = require("./matchup-analysis");

const CACHE_RESULT_FIELDS = [
  "score",
  "winnerSide",
  "winnerId",
  "hpRatioA",
  "hpRatioB",
  "winnerEdge",
  "hpEdge",
  "energyEdge",
  "shieldEdge",
  "readyEdge",
  "dangerEdge",
  "closingCostEdge",
  "farmPressureEdge",
  "outpacePressureEdge"
];

function inflateCacheResult(value) {
  if (!Array.isArray(value)) return value || null;
  return CACHE_RESULT_FIELDS.reduce((result, field, index) => {
    result[field] = value[index];
    return result;
  }, {});
}

function invertResult(result) {
  if (!result) return null;
  const inverted = {
    ...result,
    score: Number.isFinite(Number(result.score)) ? 1000 - Number(result.score) : result.score,
    winnerSide: result.winnerSide === "A" ? "B" : result.winnerSide === "B" ? "A" : result.winnerSide,
    hpRatioA: result.hpRatioB,
    hpRatioB: result.hpRatioA,
    winnerEdge: -Number(result.winnerEdge || 0),
    hpEdge: -Number(result.hpEdge || 0),
    energyEdge: -Number(result.energyEdge || 0),
    shieldEdge: -Number(result.shieldEdge || 0),
    readyEdge: -Number(result.readyEdge || 0),
    dangerEdge: -Number(result.dangerEdge || 0),
    closingCostEdge: -Number(result.closingCostEdge || 0),
    farmPressureEdge: -Number(result.farmPressureEdge || 0),
    outpacePressureEdge: -Number(result.outpacePressureEdge || 0)
  };
  return inverted;
}

function resultWinnerName(result, a, b) {
  if (!result || result.score === 500 || result.winnerSide === "tie" || result.winnerSide === "neutral") return "Draw";
  return result.score > 500 ? a.name : b.name;
}

function summarizeShieldScenario({ shieldState, result, a, b, source = "precomputed" }) {
  const score = Number(result && result.score);
  const winner = resultWinnerName(result, a, b);
  return {
    shieldState,
    source,
    score,
    winner,
    winnerSide: score > 500 ? "A" : score < 500 ? "B" : "draw",
    closeness: classifyScore(score),
    hp: {
      a: result && Number.isFinite(Number(result.hpRatioA)) ? Number(result.hpRatioA) : null,
      b: result && Number.isFinite(Number(result.hpRatioB)) ? Number(result.hpRatioB) : null
    },
    energy: {
      a: result && Number.isFinite(Number(result.energyA)) ? Number(result.energyA) : null,
      b: result && Number.isFinite(Number(result.energyB)) ? Number(result.energyB) : null
    },
    result
  };
}

function analysisFlagsFromScenarios(scenarios) {
  const scores = scenarios.map(item => Number(item.score)).filter(Number.isFinite);
  const winners = new Set(scenarios.map(item => item.winnerSide).filter(Boolean));
  const spread = scores.length ? Math.max(...scores) - Math.min(...scores) : 0;
  const flags = [];
  if (winners.size > 1 || spread > 70) {
    flags.push({
      id: "shield-dependent",
      label: "Shield dependent",
      explanation: winners.size > 1
        ? "Winner changes across even-shield scenarios."
        : "Battle rating changes substantially across even-shield scenarios."
    });
  } else if (spread > 15) {
    flags.push({
      id: "shield-sensitive",
      label: "Shield sensitive",
      explanation: "Shield count changes the battle rating, but not enough to mark a hard dependency."
    });
  }
  const close = scenarios.some(item => item.closeness === "close" || Math.abs(Number(item.score || 500) - 500) <= 35);
  if (close) {
    flags.push({
      id: "close-matchup",
      label: "Close result",
      explanation: "At least one even-shield scenario is within the configured close-matchup range."
    });
  }
  return flags;
}

function buildMatchupInspectorData({ a, b, scenarios, source = "precomputed", profile = "rank1", league = "great", cpCap = 1500 }) {
  const summaries = scenarios.map(item => summarizeShieldScenario({
    ...item,
    a,
    b,
    source: item.source || source
  }));
  return {
    schemaVersion: 1,
    league,
    cpCap,
    profile,
    source,
    pokemon: { a, b },
    movesets: {
      a: a.moveset || null,
      b: b.moveset || null
    },
    evenShield: summaries,
    analysis: {
      flags: analysisFlagsFromScenarios(summaries),
      scenarios: summaries.map(item => analyzeMatchupCell({
        profile,
        attackerId: a.id,
        attackerName: a.name,
        defenderId: b.id,
        defenderName: b.name,
        shieldState: item.shieldState,
        result: item.result
      }, { league, profile }))
    },
    alternateLines: []
  };
}

function findCachedScenario(cache, defenderId, shieldState) {
  const cells = cache && cache.cells || {};
  const match = Object.entries(cells).find(([key]) => key.startsWith(`${defenderId}:`) && key.includes(`|${shieldState}|`));
  if (!match) return null;
  return inflateCacheResult(match[1]);
}

function buildFromCacheFiles({ a, b, aCache, bCache, shieldStates = ["0-0", "1-1", "2-2"], profile = "rank1", league = "great" }) {
  const scenarios = shieldStates.map(shieldState => {
    let result = findCachedScenario(aCache, b.id, shieldState);
    let source = result ? "precomputed" : "missing";
    if (!result && bCache) {
      const inverse = findCachedScenario(bCache, a.id, shieldState);
      result = invertResult(inverse);
      source = result ? "precomputed-inverted" : "missing";
    }
    return { shieldState, result, source };
  });
  return buildMatchupInspectorData({ a, b, scenarios, source: "precomputed", profile, league });
}

module.exports = {
  inflateCacheResult,
  invertResult,
  summarizeShieldScenario,
  analysisFlagsFromScenarios,
  buildMatchupInspectorData,
  buildFromCacheFiles
};
