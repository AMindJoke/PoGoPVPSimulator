"use strict";

const {
  DependencyLevel,
  RecommendationType,
  createBattleHint,
  createCoachRecommendation
} = require("./types");

function createCoachContext(input = {}) {
  return {
    league: input.league || "great",
    format: input.format || "open",
    matchup: input.matchup || null,
    battleResult: input.battleResult || null,
    timeline: input.timeline || null,
    perspective: input.perspective || "A",
    userSkillModel: input.userSkillModel || null
  };
}

function emptyCoachOutput(context, reason = "No coaching modules are enabled yet.") {
  return {
    schemaVersion: 1,
    source: "battle-coach",
    context: {
      league: context.league,
      format: context.format,
      perspective: context.perspective
    },
    hints: [
      createBattleHint({
        type: RecommendationType.INFO,
        priority: 0,
        message: reason,
        confidence: DependencyLevel.HIGH
      })
    ],
    recommendations: []
  };
}

function runCoachModules(context, modules = []) {
  const hints = [];
  const recommendations = [];
  for (const module of modules) {
    if (!module || typeof module.analyze !== "function") continue;
    const output = module.analyze(context) || {};
    if (Array.isArray(output.hints)) hints.push(...output.hints);
    if (Array.isArray(output.recommendations)) recommendations.push(...output.recommendations);
  }
  return {
    schemaVersion: 1,
    source: "battle-coach",
    context: {
      league: context.league,
      format: context.format,
      perspective: context.perspective
    },
    hints: hints.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0)),
    recommendations: recommendations.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
  };
}

function analyzeBattleForCoaching(input = {}, modules = []) {
  const context = createCoachContext(input);
  if (!modules.length) return emptyCoachOutput(context);
  return runCoachModules(context, modules);
}

function createRecommendation(input = {}) {
  return createCoachRecommendation(input);
}

module.exports = {
  createCoachContext,
  analyzeBattleForCoaching,
  createRecommendation,
  runCoachModules
};
