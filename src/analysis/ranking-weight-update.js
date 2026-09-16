"use strict";

const METHOD = "smooth-damped-v1";
function targetWeight(score) {
  if (!Number.isFinite(score) || score <= 0) throw new Error("Invalid ranking score for weight update.");
  const high = Math.max(.12, Math.min(3.2, Math.pow(score / 500, 3.2)));
  return .12 + (high - .12) / (1 + Math.exp(-(score - 520) / 20));
}
function updateWeights(ranking) {
  const previous = ranking.metadata?.weightUpdate;
  if (previous && previous.method !== METHOD) throw new Error("Incompatible weight history.");
  const weights = new Map();
  for (const entry of ranking.entries || []) {
    if (!entry.id || weights.has(entry.id)) throw new Error("Invalid or duplicate ranking candidate.");
    const score = entry.competitiveScore ?? entry.overallScore ?? entry.weightedScore ?? entry.averageScore;
    const target = targetWeight(score);
    const old = previous ? previous.weights?.[entry.id] : target;
    if (!Number.isFinite(old) || old < .12 || old > 3.2) throw new Error(`Missing or invalid prior weight: ${entry.id}`);
    weights.set(entry.id, .5 * old + .5 * target);
  }
  return weights;
}
module.exports = { METHOD, targetWeight, updateWeights };
