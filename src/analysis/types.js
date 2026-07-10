"use strict";

const ANALYSIS_SCHEMA_VERSION = 1;

const LineType = Object.freeze({
  STANDARD: "standard",
  STRAIGHT: "straight",
  BAIT: "bait",
  SHIELD_DEPENDENT: "shield-dependent",
  ENERGY_ADVANTAGE: "energy-advantage",
  HP_ADVANTAGE: "hp-advantage",
  DEBUFF_SENSITIVE: "debuff-sensitive",
  UNKNOWN: "unknown"
});

const DependencyLevel = Object.freeze({
  NONE: "none",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  UNKNOWN: "unknown"
});

const RecommendationType = Object.freeze({
  TIMING: "timing",
  ENERGY: "energy",
  SHIELD: "shield",
  BAIT: "bait",
  MOVE_CHOICE: "move-choice",
  ALIGNMENT: "alignment",
  WARNING: "warning",
  INFO: "info"
});

function createEmptyDependencyMetrics() {
  return {
    shield: DependencyLevel.UNKNOWN,
    bait: DependencyLevel.UNKNOWN,
    energy: DependencyLevel.UNKNOWN,
    hp: DependencyLevel.UNKNOWN,
    debuff: DependencyLevel.UNKNOWN,
    cmp: DependencyLevel.UNKNOWN
  };
}

function createEmptyComplexityMetrics() {
  return {
    score: null,
    volatility: null,
    consistency: null,
    shieldDependency: null,
    baitDependency: null,
    energyDependency: null,
    hpDependency: null,
    explanation: []
  };
}

function createMatchupAnalysis(input = {}) {
  return {
    schemaVersion: ANALYSIS_SCHEMA_VERSION,
    league: input.league || "great",
    format: input.format || "open",
    profile: input.profile || "rank1",
    pokemon: {
      a: input.a || null,
      b: input.b || null
    },
    shieldState: input.shieldState || null,
    source: input.source || "offline-dataset",
    standardLine: input.standardLine || null,
    alternateLines: input.alternateLines || [],
    flipOpportunities: input.flipOpportunities || [],
    breakpoints: input.breakpoints || [],
    bulkpoints: input.bulkpoints || [],
    dependencies: input.dependencies || createEmptyDependencyMetrics(),
    complexity: input.complexity || createEmptyComplexityMetrics(),
    difficulty: input.difficulty || {
      a: null,
      b: null,
      explanation: []
    },
    coach: {
      hints: input.hints || [],
      recommendations: input.recommendations || []
    },
    notes: input.notes || []
  };
}

function createBattleLine(input = {}) {
  return {
    id: input.id || null,
    type: input.type || LineType.UNKNOWN,
    label: input.label || null,
    result: input.result || null,
    assumptions: input.assumptions || [],
    events: input.events || [],
    tags: input.tags || []
  };
}

function createFlipOpportunity(input = {}) {
  return {
    side: input.side || null,
    pokemonId: input.pokemonId || null,
    pokemonName: input.pokemonName || null,
    lineType: input.lineType || LineType.UNKNOWN,
    fastMoveId: input.fastMoveId || null,
    fastMoveName: input.fastMoveName || null,
    fastMoveCount: input.fastMoveCount || null,
    totalTurnCost: input.totalTurnCost || null,
    energyOnly: input.energyOnly !== false,
    confidence: input.confidence || DependencyLevel.UNKNOWN,
    reason: input.reason || null,
    notes: input.notes || []
  };
}

function createBattleHint(input = {}) {
  return {
    type: input.type || RecommendationType.INFO,
    priority: input.priority || 0,
    side: input.side || null,
    message: input.message || "",
    evidence: input.evidence || [],
    confidence: input.confidence || DependencyLevel.UNKNOWN
  };
}

function createCoachRecommendation(input = {}) {
  return {
    type: input.type || RecommendationType.INFO,
    priority: input.priority || 0,
    side: input.side || null,
    title: input.title || "",
    body: input.body || "",
    requiredContext: input.requiredContext || [],
    evidence: input.evidence || [],
    confidence: input.confidence || DependencyLevel.UNKNOWN
  };
}

module.exports = {
  ANALYSIS_SCHEMA_VERSION,
  LineType,
  DependencyLevel,
  RecommendationType,
  createEmptyDependencyMetrics,
  createEmptyComplexityMetrics,
  createMatchupAnalysis,
  createBattleLine,
  createFlipOpportunity,
  createBattleHint,
  createCoachRecommendation
};
