"use strict";

(function exposeWinConditionEngine(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakWinConditionEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createWinConditionEngineApi() {
  const WIN_CONDITION_SCHEMA_VERSION = 1;
  const WIN_CONDITION_ENGINE_VERSION = "win-conditions-v1";

  const WinConditionCategory = Object.freeze({
    GUARANTEED_DEFENSE_BUFF: "guaranteed-defense-buff",
    GUARANTEED_ATTACK_DEBUFF: "guaranteed-attack-debuff",
    EXTRA_FAST_MOVE: "extra-fast-move",
    DELAYED_SELF_DEBUFF: "delayed-self-debuff"
  });

  const WinConditionImportance = Object.freeze({
    CRITICAL: "critical",
    MAJOR: "major",
    MINOR: "minor",
    INFORMATIONAL: "informational"
  });

  const adapters = Object.freeze({
    "guaranteed-defense-buff-value": finding => statEffectCondition(finding, {
      category: WinConditionCategory.GUARANTEED_DEFENSE_BUFF,
      statLabel: "Defense boost",
      summary: "The guaranteed Defense boost preserves the stronger continuation."
    }),
    "guaranteed-attack-debuff-value": finding => statEffectCondition(finding, {
      category: WinConditionCategory.GUARANTEED_ATTACK_DEBUFF,
      statLabel: "Attack drop",
      summary: "The guaranteed Attack drop preserves the stronger continuation."
    }),
    "extra-fast-move-flip": extraFastMoveCondition,
    "delay-self-debuff": delayedSelfDebuffCondition
  });

  function buildWinConditionSummary(input = {}, options = {}) {
    const tacticalSummary = input.tacticalSummary || input.patternSummary || {};
    const findings = Array.isArray(tacticalSummary.findings) ? tacticalSummary.findings : [];
    const conditions = findings
      .map(finding => transformTacticalFinding(finding, input))
      .filter(Boolean)
      .sort(compareWinConditions);
    const byCategory = {};
    for (const condition of conditions) {
      if (!byCategory[condition.category]) byCategory[condition.category] = [];
      byCategory[condition.category].push(condition);
    }
    return {
      schemaVersion: WIN_CONDITION_SCHEMA_VERSION,
      engineVersion: WIN_CONDITION_ENGINE_VERSION,
      sourcePatternLibraryVersion: tacticalSummary.libraryVersion || null,
      battleEngineVersion: input.engineVersion || input.provenance?.currentEngineVersion || null,
      conditions,
      primaryConditions: conditions.slice(0, Math.max(1, Number(options.maxPrimary || 3))),
      byCategory,
      confidenceSummary: summarizeConfidence(conditions)
    };
  }

  function transformTacticalFinding(finding, input = {}) {
    if (!finding || !adapters[finding.patternId]) return null;
    const raw = adapters[finding.patternId](finding);
    if (!raw) return null;
    const confidence = normalizeConfidence(finding.confidence);
    const importance = importanceForFinding(finding);
    const sourceVisibility = finding.visibility || "analysis";
    const visibility = input.provenance?.stale || finding.source?.stale
      ? "developer-only"
      : sourceVisibility === "user-facing" && confidence.level === "high"
        ? "user-facing"
        : sourceVisibility === "developer-only" ? "developer-only" : "analysis";
    return {
      schemaVersion: WIN_CONDITION_SCHEMA_VERSION,
      id: conditionId(finding, raw.category),
      category: raw.category,
      side: normalizeSide(finding.side),
      pokemonId: finding.pokemonId || null,
      moveId: finding.moveId || null,
      confidence,
      importance,
      summary: raw.summary,
      explanation: raw.explanation,
      answers: {
        whyItMattered: raw.whyItMattered,
        whatChanged: raw.whatChanged,
        couldWinWithoutIt: raw.counterfactual?.available
          ? raw.counterfactual.expectedOutcome === "win"
          : null
      },
      supportingPatterns: [{
        patternId: finding.patternId,
        patternVersion: finding.patternVersion || 1,
        decisionId: finding.decisionId || null,
        reasonCodes: clone(finding.reasonCodes || [])
      }],
      supportingEvidence: [{
        type: "tactical-pattern",
        patternId: finding.patternId,
        evidence: clone(finding.evidence || {})
      }],
      decisiveMoments: raw.decisiveMoments,
      counterfactual: raw.counterfactual,
      relatedLineIds: clone(finding.relatedLineIds || []),
      visibility,
      source: {
        patternId: finding.patternId,
        patternVersion: finding.patternVersion || 1,
        engineVersion: finding.source?.engineVersion || input.engineVersion || null,
        stale: !!(input.provenance?.stale || finding.source?.stale)
      }
    };
  }

  function statEffectCondition(finding, config) {
    const evidence = finding.evidence || {};
    const counterfactual = outcomeCounterfactual({
      omittedEvent: finding.moveId || evidence.moveName || "stat-effect move",
      observedOutcome: evidence.alternateOutcome,
      expectedOutcome: evidence.baselineOutcome,
      basis: "projected continuation without the guaranteed stat effect"
    });
    const hp = finite(evidence.extraHpRetained);
    const rating = finite(evidence.projectedRatingDelta);
    return {
      category: config.category,
      summary: config.summary,
      explanation: comparisonExplanation(config.statLabel, evidence, hp, rating, counterfactual),
      whyItMattered: counterfactual.changesOutcome
        ? `${config.statLabel} changes the projected result.`
        : `${config.statLabel} materially improves the projected continuation.`,
      whatChanged: resourceDeltaText(hp, finite(evidence.projectedEnergyDelta), rating),
      counterfactual,
      decisiveMoments: decisionMoments(finding, evidence.moveName || config.statLabel)
    };
  }

  function delayedSelfDebuffCondition(finding) {
    const evidence = finding.evidence || {};
    const counterfactual = outcomeCounterfactual({
      omittedEvent: `delay ${evidence.moveName || finding.moveId || "self-debuff move"}`,
      observedOutcome: evidence.delayedOutcome,
      expectedOutcome: evidence.earlyOutcome,
      basis: "projected continuation when the self-debuffing move is used immediately"
    });
    const moments = decisionMoments(finding, `delay ${evidence.moveName || "self-debuff"}`);
    if (evidence.usedLater) {
      moments.push({
        id: `${finding.decisionId || finding.patternId}:later-use`,
        type: "later-use",
        turn: finite(evidence.laterTurn),
        side: normalizeSide(finding.side),
        moveId: finding.moveId || null,
        label: `${evidence.moveName || "Self-debuffing move"} becomes safe later.`
      });
    }
    return {
      category: WinConditionCategory.DELAYED_SELF_DEBUFF,
      summary: "Delaying the self-debuff preserves the stronger continuation.",
      explanation: counterfactual.changesOutcome
        ? "Using the self-debuffing move immediately changes the projected win into a loss."
        : `Delaying the move improves the projected battle state${deltaSuffix(evidence.projectedHpDelta, evidence.projectedRatingDelta)}.`,
      whyItMattered: "The earlier self-debuff weakens the remaining battle sequence.",
      whatChanged: resourceDeltaText(finite(evidence.projectedHpDelta), null, finite(evidence.projectedRatingDelta)),
      counterfactual,
      decisiveMoments: moments
    };
  }

  function extraFastMoveCondition(finding) {
    const evidence = finding.evidence || {};
    const count = Number(evidence.fastMoveCount || 0);
    const move = evidence.fastMoveName || "fast move";
    const counterfactual = outcomeCounterfactual({
      omittedEvent: `${count} extra ${move}`,
      observedOutcome: evidence.alternateOutcome,
      expectedOutcome: evidence.baselineOutcome,
      basis: "reproducible line without the starting fast-move advantage"
    });
    return {
      category: WinConditionCategory.EXTRA_FAST_MOVE,
      summary: `${count === 1 ? "One extra" : `${count} extra`} ${move} unlocks the winning line.`,
      explanation: `The ${Number(evidence.totalTurnCost || 0)}-turn advantage changes the projected result from ${outcomeLabel(counterfactual.expectedOutcome)} to ${outcomeLabel(counterfactual.observedOutcome)}.`,
      whyItMattered: "The stored energy changes charged-move access and the closing race.",
      whatChanged: `${count} ${move}${count === 1 ? "" : "s"} of starting advantage.`,
      counterfactual,
      decisiveMoments: [{
        id: finding.decisionId || `flip:${finding.side}`,
        type: "alternate-line",
        turn: null,
        side: normalizeSide(finding.side),
        moveId: evidence.fastMoveId || null,
        label: `${count} extra ${move} creates the flip.`,
        relatedLineIds: clone(finding.relatedLineIds || [])
      }]
    };
  }

  function outcomeCounterfactual(input) {
    const observedOutcome = normalizeOutcome(input.observedOutcome);
    const expectedOutcome = normalizeOutcome(input.expectedOutcome);
    const available = !!observedOutcome && !!expectedOutcome;
    return {
      available,
      omittedEvent: input.omittedEvent || null,
      observedOutcome,
      expectedOutcome,
      changesOutcome: available && observedOutcome !== expectedOutcome,
      basis: input.basis || null
    };
  }

  function importanceForFinding(finding) {
    if (finding.changesOutcome) return { level: WinConditionImportance.CRITICAL, score: 100, reasons: ["counterfactual changes the battle outcome"] };
    const impact = finding.impact || "informational";
    const relevance = Math.max(0, Math.min(1, Number(finding.relevance || 0)));
    if (impact === "meaningful" && relevance >= 0.65) return { level: WinConditionImportance.MAJOR, score: Math.round(65 + relevance * 25), reasons: ["material continuation difference"] };
    if (impact === "meaningful" || impact === "minor") return { level: WinConditionImportance.MINOR, score: Math.round(30 + relevance * 30), reasons: ["helpful but not outcome-changing"] };
    return { level: WinConditionImportance.INFORMATIONAL, score: Math.round(relevance * 30), reasons: ["supporting tactical context"] };
  }

  function eligibleWinConditions(summary, options = {}) {
    const minimumConfidence = options.minimumConfidence || "high";
    const minimumImportance = options.minimumImportance || "major";
    const allowedVisibility = new Set(options.visibility || ["user-facing"]);
    return (summary?.conditions || []).filter(condition =>
      confidenceRank(condition.confidence?.level) >= confidenceRank(minimumConfidence) &&
      importanceRank(condition.importance?.level) >= importanceRank(minimumImportance) &&
      allowedVisibility.has(condition.visibility)
    );
  }

  function compareWinConditions(a, b) {
    return importanceRank(b.importance.level) - importanceRank(a.importance.level)
      || b.importance.score - a.importance.score
      || confidenceRank(b.confidence.level) - confidenceRank(a.confidence.level)
      || nullableNumber(a.decisiveMoments[0]?.turn) - nullableNumber(b.decisiveMoments[0]?.turn)
      || a.id.localeCompare(b.id);
  }

  function decisionMoments(finding, label) {
    return [{
      id: finding.decisionId || `${finding.patternId}:${finding.side}`,
      type: "decision",
      turn: finite(finding.turn),
      side: normalizeSide(finding.side),
      moveId: finding.moveId || null,
      label
    }];
  }

  function comparisonExplanation(label, evidence, hp, rating, counterfactual) {
    if (counterfactual.changesOutcome) return `${label} changes the projected result from ${outcomeLabel(counterfactual.expectedOutcome)} to ${outcomeLabel(counterfactual.observedOutcome)}.`;
    return `${label} improves the projected continuation${deltaSuffix(hp, rating)}.`;
  }

  function deltaSuffix(hp, rating) {
    const parts = [];
    if (Number.isFinite(Number(hp)) && Number(hp) !== 0) parts.push(`${signed(hp)} HP`);
    if (Number.isFinite(Number(rating)) && Number(rating) !== 0) parts.push(`${signed(rating)} projected rating`);
    return parts.length ? ` (${parts.join(", ")})` : "";
  }

  function resourceDeltaText(hp, energy, rating) {
    const parts = [];
    if (hp !== null && hp !== 0) parts.push(`${signed(hp)} projected HP`);
    if (energy !== null && energy !== 0) parts.push(`${signed(energy)} projected energy`);
    if (rating !== null && rating !== 0) parts.push(`${signed(rating)} projected rating`);
    return parts.join(", ") || "A stronger projected continuation.";
  }

  function normalizeConfidence(confidence) {
    const level = ["high", "medium", "low"].includes(confidence?.level) ? confidence.level : "low";
    return { level, reasons: clone(confidence?.reasons || []) };
  }

  function summarizeConfidence(conditions) {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const condition of conditions) counts[condition.confidence.level]++;
    return counts;
  }

  function conditionId(finding, category) {
    return [category, normalizeSide(finding.side) || "unknown", finding.decisionId || finding.moveId || finding.patternId]
      .join(":").replace(/[^a-zA-Z0-9:_-]+/g, "-").toLowerCase();
  }

  function normalizeSide(side) {
    return side === "A" || side === "B" ? side : null;
  }

  function normalizeOutcome(outcome) {
    const value = String(outcome || "").toLowerCase();
    return ["win", "loss", "draw"].includes(value) ? value : null;
  }

  function outcomeLabel(outcome) {
    return outcome || "unknown";
  }

  function finite(value) {
    return value == null ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function nullableNumber(value) {
    return value == null ? Number.MAX_SAFE_INTEGER : Number.isFinite(Number(value)) ? Number(value) : Number.MAX_SAFE_INTEGER;
  }

  function signed(value) {
    const rounded = Math.round(Number(value || 0));
    return `${rounded >= 0 ? "+" : ""}${rounded}`;
  }

  function confidenceRank(level) {
    return { low: 1, medium: 2, high: 3 }[level] || 0;
  }

  function importanceRank(level) {
    return { informational: 1, minor: 2, major: 3, critical: 4 }[level] || 0;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value == null ? null : value));
  }

  return Object.freeze({
    WIN_CONDITION_SCHEMA_VERSION,
    WIN_CONDITION_ENGINE_VERSION,
    WinConditionCategory,
    WinConditionImportance,
    buildWinConditionSummary,
    transformTacticalFinding,
    eligibleWinConditions,
    compareWinConditions
  });
});
