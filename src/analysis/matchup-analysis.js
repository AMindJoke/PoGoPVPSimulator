"use strict";

const {
  DependencyLevel,
  LineType,
  createBattleLine,
  createEmptyComplexityMetrics,
  createEmptyDependencyMetrics,
  createMatchupAnalysis
} = require("./types");

function sideFromScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value === 500) return "neutral";
  return value > 500 ? "A" : "B";
}

function classifyScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return "unknown";
  if (value === 500) return "neutral";
  const distance = Math.abs(value - 500);
  if (distance <= 35) return "close";
  if (distance <= 150) return "favored";
  return "dominant";
}

function dependencyFromSpread(spread) {
  const value = Number(spread || 0);
  if (value <= 15) return DependencyLevel.LOW;
  if (value <= 70) return DependencyLevel.MEDIUM;
  return DependencyLevel.HIGH;
}

function resultFromRankingEntry(entry, shieldState = "1-1") {
  if (!entry) return null;
  const state = entry.shieldStates && entry.shieldStates[shieldState];
  const score = state ? state.averageScore : entry.overallScore || entry.averageScore;
  return {
    score,
    winnerSide: sideFromScore(score),
    winnerId: null,
    source: "ranking-summary",
    shieldState
  };
}

function complexityFromShieldStates(entry) {
  const metrics = createEmptyComplexityMetrics();
  if (!entry || !entry.shieldStates) return metrics;
  const scores = ["0-0", "1-1", "2-2"]
    .map(key => entry.shieldStates[key] && Number(entry.shieldStates[key].averageScore))
    .filter(Number.isFinite);
  if (!scores.length) return metrics;
  const spread = Math.max(...scores) - Math.min(...scores);
  metrics.shieldDependency = spread;
  metrics.score = Math.min(100, Math.round(spread / 2));
  metrics.volatility = Math.min(100, Math.round(Number(entry.scoreStdDev || 0) / 2));
  metrics.consistency = Math.max(0, 100 - metrics.volatility);
  if (spread > 70) metrics.explanation.push("Result changes substantially across equal-shield scenarios.");
  else if (spread > 15) metrics.explanation.push("Shield count has a moderate impact on the result.");
  else metrics.explanation.push("Result is relatively stable across equal-shield scenarios.");
  return metrics;
}

function dependenciesFromRankingEntry(entry) {
  const dependencies = createEmptyDependencyMetrics();
  if (!entry || !entry.shieldStates) return dependencies;
  const scores = ["0-0", "1-1", "2-2"]
    .map(key => entry.shieldStates[key] && Number(entry.shieldStates[key].averageScore))
    .filter(Number.isFinite);
  const spread = scores.length ? Math.max(...scores) - Math.min(...scores) : 0;
  dependencies.shield = dependencyFromSpread(spread);
  return dependencies;
}

function analyzeRankingEntry(entry, options = {}) {
  const shieldState = options.shieldState || "1-1";
  const result = resultFromRankingEntry(entry, shieldState);
  return createMatchupAnalysis({
    league: options.league || "great",
    format: options.format || "open",
    profile: entry && entry.profile || options.profile || "rank1",
    a: entry ? { id: entry.id, name: entry.name, types: entry.types || [] } : null,
    b: options.opponent || null,
    shieldState,
    source: "ranking-entry",
    standardLine: createBattleLine({
      id: `${entry && entry.id || "unknown"}:${shieldState}:standard`,
      type: LineType.STANDARD,
      label: "Standard line",
      result,
      assumptions: ["Uses the offline ranking default moveset and equal-shield result."]
    }),
    dependencies: dependenciesFromRankingEntry(entry),
    complexity: complexityFromShieldStates(entry),
    difficulty: {
      a: result ? classifyScore(result.score) : "unknown",
      b: result ? classifyScore(1000 - Number(result.score || 500)) : "unknown",
      explanation: []
    }
  });
}

function analyzeMatchupCell(cell, options = {}) {
  const result = cell && cell.result ? cell.result : null;
  return createMatchupAnalysis({
    league: options.league || "great",
    format: options.format || "open",
    profile: cell && cell.profile || options.profile || "rank1",
    a: cell ? { id: cell.attackerId, name: cell.attackerName } : null,
    b: cell ? { id: cell.defenderId, name: cell.defenderName } : null,
    shieldState: cell && cell.shieldState || options.shieldState || null,
    source: "matchup-cell",
    standardLine: createBattleLine({
      id: cell && cell.key || null,
      type: LineType.STANDARD,
      label: "Standard line",
      result,
      assumptions: ["Uses the exact offline matchup cell result."]
    }),
    dependencies: createEmptyDependencyMetrics(),
    complexity: createEmptyComplexityMetrics(),
    difficulty: {
      a: result ? classifyScore(result.score) : "unknown",
      b: result ? classifyScore(1000 - Number(result.score || 500)) : "unknown",
      explanation: []
    }
  });
}

module.exports = {
  analyzeRankingEntry,
  analyzeMatchupCell,
  classifyScore,
  dependencyFromSpread
};
