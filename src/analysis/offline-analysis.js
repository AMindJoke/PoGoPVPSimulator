"use strict";

const { analyzeRankingEntry } = require("./matchup-analysis");

function summarizeDataset(dataset, options = {}) {
  const entries = Array.isArray(dataset && dataset.entries) ? dataset.entries : [];
  const analyses = entries.map(entry => analyzeRankingEntry(entry, options));
  return {
    schemaVersion: 1,
    league: dataset && dataset.league || options.league || "great",
    sourceDatasetVersion: dataset && dataset.metadata && dataset.metadata.datasetVersion || null,
    generatedAt: new Date().toISOString(),
    count: analyses.length,
    complexity: summarizeComplexity(analyses),
    dependencies: summarizeDependencies(analyses),
    entries: analyses
  };
}

function summarizeComplexity(analyses) {
  const values = analyses
    .map(analysis => analysis.complexity && Number(analysis.complexity.score))
    .filter(Number.isFinite);
  return {
    average: average(values),
    max: values.length ? Math.max(...values) : null,
    highComplexityCount: values.filter(value => value >= 70).length,
    mediumComplexityCount: values.filter(value => value >= 35 && value < 70).length,
    lowComplexityCount: values.filter(value => value < 35).length
  };
}

function summarizeDependencies(analyses) {
  const shield = countLevels(analyses.map(analysis => analysis.dependencies && analysis.dependencies.shield));
  const bait = countLevels(analyses.map(analysis => analysis.dependencies && analysis.dependencies.bait));
  const energy = countLevels(analyses.map(analysis => analysis.dependencies && analysis.dependencies.energy));
  return { shield, bait, energy };
}

function countLevels(values) {
  return values.reduce((counts, value) => {
    const key = value || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function average(values) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

module.exports = {
  summarizeDataset,
  summarizeComplexity,
  summarizeDependencies
};
