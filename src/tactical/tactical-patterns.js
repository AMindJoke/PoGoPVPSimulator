"use strict";

(function exposeTacticalPatterns(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakTacticalPatterns = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTacticalPatternApi() {
  const TACTICAL_PATTERN_SCHEMA_VERSION = 1;
  const TACTICAL_PATTERN_LIBRARY_VERSION = "tactical-patterns-v1";

  const TacticalPatternCategory = Object.freeze({
    STAT_BUFF: "stat-buff",
    STAT_DEBUFF: "stat-debuff",
    SELF_DEBUFF: "self-debuff",
    BAITING: "baiting",
    TIMING: "timing",
    ENERGY: "energy",
    SHIELDS: "shields",
    CMP: "cmp",
    SURVIVABILITY: "survivability",
    CLOSING: "closing",
    PRESSURE: "pressure"
  });

  const TacticalPatternImpact = Object.freeze({
    INFORMATIONAL: "informational",
    MINOR: "minor",
    MEANINGFUL: "meaningful",
    OUTCOME_CHANGING: "outcome-changing"
  });

  const TacticalPatternVisibility = Object.freeze({
    DEVELOPER_ONLY: "developer-only",
    ANALYSIS: "analysis",
    USER_FACING: "user-facing"
  });

  const PROFILE_IDS = Object.freeze({
    "planner-critical": [
      "guaranteed-defense-buff-value",
      "guaranteed-attack-debuff-value",
      "delay-self-debuff"
    ],
    "interactive-analysis": [
      "guaranteed-defense-buff-value",
      "guaranteed-attack-debuff-value",
      "delay-self-debuff",
      "extra-fast-move-flip",
      "bait-required",
      "straight-play-sufficient"
    ],
    "offline-deep": [
      "guaranteed-defense-buff-value",
      "guaranteed-attack-debuff-value",
      "delay-self-debuff",
      "extra-fast-move-flip",
      "bait-required",
      "straight-play-sufficient"
    ],
    reliability: [
      "guaranteed-defense-buff-value",
      "guaranteed-attack-debuff-value",
      "delay-self-debuff",
      "extra-fast-move-flip",
      "bait-required",
      "straight-play-sufficient"
    ]
  });

  const definitions = [
    definition("guaranteed-defense-buff-value", TacticalPatternCategory.STAT_BUFF, detectDefenseBuffValue, ["decision", "battle"]),
    definition("guaranteed-attack-debuff-value", TacticalPatternCategory.STAT_DEBUFF, detectAttackDebuffValue, ["decision", "battle"]),
    definition("delay-self-debuff", TacticalPatternCategory.SELF_DEBUFF, detectDelaySelfDebuff, ["decision", "battle"]),
    definition("extra-fast-move-flip", TacticalPatternCategory.TIMING, detectExtraFastMoveFlip, ["alternate-lines", "matchup"]),
    definition("bait-required", TacticalPatternCategory.BAITING, detectBaitRequired, ["decision", "alternate-lines"]),
    definition("straight-play-sufficient", TacticalPatternCategory.BAITING, detectStraightPlaySufficient, ["decision", "alternate-lines"])
  ];
  const registry = new Map(definitions.map(item => [item.id, item]));

  function definition(id, category, detect, supportedContexts) {
    return Object.freeze({
      id,
      version: 1,
      category,
      description: id.split("-").join(" "),
      supportedContexts: Object.freeze(supportedContexts.slice()),
      plannerEffect: ["guaranteed-defense-buff-value", "guaranteed-attack-debuff-value", "delay-self-debuff"].includes(id)
        ? "candidate-priority"
        : "analysis-only",
      detect
    });
  }

  function getTacticalPatternDefinitions() {
    return definitions.slice();
  }

  function getTacticalPatternDefinition(patternId) {
    return registry.get(patternId) || null;
  }

  function detectTacticalPatterns(input = {}, options = {}) {
    const context = normalizeContext(input);
    const profile = options.profile || context.analysisMode || "interactive-analysis";
    const profileIds = PROFILE_IDS[profile] || PROFILE_IDS["interactive-analysis"];
    const included = options.includeCategories ? new Set(options.includeCategories) : null;
    const excluded = new Set(options.excludeCategories || []);
    const selectedIds = new Set(options.patternIds || profileIds);
    const findings = [];
    for (const pattern of definitions) {
      if (!selectedIds.has(pattern.id)) continue;
      if (included && !included.has(pattern.category)) continue;
      if (excluded.has(pattern.category)) continue;
      for (const raw of pattern.detect(context) || []) {
        const finding = normalizeFinding(pattern, raw, context);
        if (finding) findings.push(finding);
      }
    }
    const filtered = prioritizeFindings(deduplicateFindings(findings))
      .filter(finding => confidenceRank(finding.confidence.level) >= confidenceRank(options.minimumConfidence || "low"))
      .filter(finding => !options.visibility || finding.visibility === options.visibility);
    return Number.isFinite(Number(options.maxFindings))
      ? filtered.slice(0, Math.max(0, Number(options.maxFindings)))
      : filtered;
  }

  function buildTacticalPatternSummary(input = {}, options = {}) {
    const startedAt = now();
    const findings = detectTacticalPatterns(input, options);
    const primaryFindings = findings.filter(item => item.impact === TacticalPatternImpact.OUTCOME_CHANGING)
      .concat(findings.filter(item => item.impact === TacticalPatternImpact.MEANINGFUL))
      .filter((item, index, list) => list.indexOf(item) === index)
      .slice(0, 3);
    const byCategory = {};
    for (const finding of findings) {
      if (!byCategory[finding.category]) byCategory[finding.category] = [];
      byCategory[finding.category].push(finding);
    }
    const performanceSummary = {
      detectorCount: (PROFILE_IDS[options.profile || input.analysisMode || "interactive-analysis"] || PROFILE_IDS["interactive-analysis"]).length
    };
    if (options.measurePerformance) performanceSummary.durationMs = Number((now() - startedAt).toFixed(3));
    return {
      schemaVersion: TACTICAL_PATTERN_SCHEMA_VERSION,
      libraryVersion: TACTICAL_PATTERN_LIBRARY_VERSION,
      profile: options.profile || input.analysisMode || "interactive-analysis",
      findings,
      primaryFindings,
      byCategory,
      userFacingFindings: findings.filter(item => item.visibility === TacticalPatternVisibility.USER_FACING),
      complexityContribution: Math.min(100, findings.reduce((sum, item) => sum + impactWeight(item.impact), 0)),
      confidenceSummary: summarizeConfidence(findings),
      performance: performanceSummary
    };
  }

  function plannerHintsFromTacticalFindings(findings = []) {
    const preserveCandidateMoveIds = new Set();
    const exploreDelayedMoveIds = new Set();
    const reasonCodes = new Set();
    for (const finding of findings) {
      for (const code of finding.reasonCodes || []) reasonCodes.add(code);
      if (["guaranteed-defense-buff-value", "guaranteed-attack-debuff-value"].includes(finding.patternId) && finding.moveId) {
        preserveCandidateMoveIds.add(finding.moveId);
      }
      if (finding.patternId === "delay-self-debuff" && finding.moveId) exploreDelayedMoveIds.add(finding.moveId);
    }
    return {
      preserveCandidateMoveIds: [...preserveCandidateMoveIds],
      exploreDelayedMoveIds: [...exploreDelayedMoveIds],
      reasonCodes: [...reasonCodes]
    };
  }

  function normalizeContext(input) {
    const trace = input.decisionTrace || input.trace || input.battleResult?.decisionTrace || null;
    const provenance = input.provenance || input.battleResult?.provenance || null;
    return {
      league: input.league || "great",
      battleState: input.battleState || trace?.finalState || null,
      battleResult: input.battleResult || null,
      decisionTrace: trace,
      decisions: Array.isArray(trace?.decisions) ? trace.decisions : Array.isArray(input.decisions) ? input.decisions : [],
      candidateLines: input.candidateLines || [],
      chosenLine: input.chosenLine || null,
      alternateLines: input.alternateLines || input.matchupAnalysis?.alternateLines || [],
      flipOpportunities: input.flipOpportunities || input.matchupAnalysis?.flipOpportunities || input.battleResult?.details?.flipPotential?.candidates || [],
      shieldState: input.shieldState || null,
      engineVersion: input.engineVersion || trace?.engineVersion || provenance?.currentEngineVersion || null,
      analysisMode: input.analysisMode || "interactive-analysis",
      provenance,
      stale: !!provenance?.stale,
      combatants: normalizeCombatants(input.combatants)
    };
  }

  function normalizeCombatants(combatants = {}) {
    return {
      A: combatants.A || combatants.a || null,
      B: combatants.B || combatants.b || null
    };
  }

  function detectDefenseBuffValue(context) {
    return detectGuaranteedStatValue(context, {
      patternId: "guaranteed-defense-buff-value",
      reasonCode: "GUARANTEED_DEFENSE_BUFF_VALUE",
      effect: { target: "self", stat: "defense", direction: 1 },
      reasonCodes: ["GUARANTEED_DEFENSE_BUFF_VALUE", "BETTER_PROJECTED_OUTCOME"]
    });
  }

  function detectAttackDebuffValue(context) {
    return detectGuaranteedStatValue(context, {
      patternId: "guaranteed-attack-debuff-value",
      reasonCode: "GUARANTEED_ATTACK_DEBUFF_VALUE",
      effect: { target: "opponent", stat: "attack", direction: -1 },
      reasonCodes: ["GUARANTEED_ATTACK_DEBUFF_VALUE", "BETTER_PROJECTED_OUTCOME"]
    });
  }

  function detectGuaranteedStatValue(context, config) {
    const findings = [];
    context.decisions.forEach((decision, index) => {
      const chosen = decision.chosenCandidate;
      const effect = parseStatEffects(chosen?.statEffects).find(item => effectMatches(item, config.effect));
      if (!chosen || !effect) return;
      const alternatives = (decision.candidates || []).filter(candidate => candidate?.moveId && candidate.moveId !== chosen.moveId);
      const alternate = bestComparableAlternative(alternatives);
      const comparison = compareCandidates(chosen, alternate);
      if (!comparison.measurable || !comparison.meaningful) return;
      const side = normalizeSide(decision.side);
      findings.push({
        side,
        pokemonId: decision.pokemonId || context.combatants[side]?.id || null,
        moveId: chosen.moveId,
        turn: finiteNumber(decision.turn),
        decisionId: decisionId(decision, index),
        relevance: comparison.relevance,
        confidence: confidenceForComparison(context, comparison),
        impact: comparison.changesOutcome ? TacticalPatternImpact.OUTCOME_CHANGING : TacticalPatternImpact.MEANINGFUL,
        changesOutcome: comparison.changesOutcome,
        actionable: true,
        evidence: {
          pokemonName: combatantName(context, side, decision.pokemonId),
          opponentName: combatantName(context, oppositeSide(side)),
          stat: config.effect.stat,
          target: config.effect.target,
          stages: effect.stages,
          moveName: chosen.moveName || chosen.moveId,
          comparedMoveId: alternate?.moveId || null,
          comparedMoveName: alternate?.moveName || null,
          projectedHpWithEffect: finiteNumber(chosen.projectedRemainingHp),
          projectedHpWithoutEffect: finiteNumber(alternate?.projectedRemainingHp),
          extraHpRetained: comparison.hpDelta,
          projectedEnergyDelta: comparison.energyDelta,
          projectedRatingDelta: comparison.ratingDelta,
          baselineOutcome: alternate?.projectedOutcome || null,
          alternateOutcome: chosen.projectedOutcome || null,
          deterministicEffect: true,
          sourceReasonCode: decision.reasonCode || config.reasonCode
        },
        relatedLineIds: candidateLineIds(decision, index, chosen, alternate),
        reasonCodes: config.reasonCodes,
        visibility: context.stale ? TacticalPatternVisibility.DEVELOPER_ONLY : TacticalPatternVisibility.USER_FACING
      });
    });
    return findings;
  }

  function detectDelaySelfDebuff(context) {
    const findings = [];
    context.decisions.forEach((decision, index) => {
      const chosen = decision.chosenCandidate;
      if (!chosen) return;
      const selfDebuffCandidates = (decision.candidates || []).filter(candidate => {
        const effect = parseStatEffects(candidate?.statEffects).find(item => item.target === "self" && item.stages < 0);
        return candidate?.moveId && candidate.moveId !== chosen.moveId && !!effect;
      });
      const earlyMove = bestComparableAlternative(selfDebuffCandidates);
      if (!earlyMove) return;
      const comparison = compareCandidates(chosen, earlyMove);
      if (!comparison.measurable || !comparison.meaningful) return;
      const laterDecision = context.decisions.slice(index + 1).find(item => item.side === decision.side && item.chosenCandidate?.moveId === earlyMove.moveId);
      const side = normalizeSide(decision.side);
      const effect = parseStatEffects(earlyMove.statEffects).find(item => item.target === "self" && item.stages < 0);
      findings.push({
        side,
        pokemonId: decision.pokemonId || context.combatants[side]?.id || null,
        moveId: earlyMove.moveId,
        turn: finiteNumber(decision.turn),
        decisionId: decisionId(decision, index),
        relevance: comparison.relevance,
        confidence: confidenceForComparison(context, comparison),
        impact: comparison.changesOutcome ? TacticalPatternImpact.OUTCOME_CHANGING : TacticalPatternImpact.MEANINGFUL,
        changesOutcome: comparison.changesOutcome,
        actionable: true,
        evidence: {
          pokemonName: combatantName(context, side, decision.pokemonId),
          moveName: earlyMove.moveName || earlyMove.moveId,
          saferMoveId: chosen.moveId,
          saferMoveName: chosen.moveName || chosen.moveId,
          selfDebuffStat: effect?.stat || null,
          selfDebuffStages: effect?.stages || null,
          earlyOutcome: earlyMove.projectedOutcome || null,
          delayedOutcome: chosen.projectedOutcome || null,
          projectedRatingDelta: comparison.ratingDelta,
          projectedHpDelta: comparison.hpDelta,
          usedLater: !!laterDecision,
          laterTurn: finiteNumber(laterDecision?.turn),
          deterministicEffect: true,
          sourceReasonCode: decision.reasonCode || "AVOID_EARLY_SELF_DEBUFF"
        },
        relatedLineIds: candidateLineIds(decision, index, chosen, earlyMove),
        reasonCodes: ["AVOID_EARLY_SELF_DEBUFF", "BETTER_PROJECTED_OUTCOME"],
        visibility: context.stale ? TacticalPatternVisibility.DEVELOPER_ONLY : TacticalPatternVisibility.USER_FACING
      });
    });
    return findings;
  }

  function detectExtraFastMoveFlip(context) {
    return (context.flipOpportunities || []).filter(Boolean).map((flip, index) => {
      const count = finiteNumber(flip.fastMoveCount ?? flip.fastMoves);
      const turnCost = finiteNumber(flip.totalTurnCost ?? flip.turnCost ?? flip.timingCost);
      if (!normalizeSide(flip.side) || !count || !turnCost || flip.visible === false) return null;
      const side = normalizeSide(flip.side);
      return {
        side,
        pokemonId: flip.pokemonId || context.combatants[side]?.id || null,
        moveId: flip.fastMoveId || null,
        turn: null,
        decisionId: `flip:${side}:${index}`,
        relevance: flip.changesOutcome === false ? 0.55 : 0.92,
        confidence: {
          level: flip.reproducible === false ? "medium" : "high",
          reasons: [flip.reproducible === false ? "alternate line is not fully reproducible" : "alternate line changes the recorded outcome"]
        },
        impact: TacticalPatternImpact.OUTCOME_CHANGING,
        changesOutcome: true,
        actionable: flip.reproducible !== false,
        evidence: {
          pokemonName: flip.pokemonName || combatantName(context, side),
          fastMoveId: flip.fastMoveId || null,
          fastMoveName: flip.fastMoveName || flip.fastMove || null,
          fastMoveCount: count,
          fastMoveDurationTurns: count ? turnCost / count : null,
          totalTurnCost: turnCost,
          energyGained: finiteNumber(flip.energyGained),
          baselineOutcome: flip.baselineOutcome || "loss",
          alternateOutcome: flip.alternateOutcome || "win",
          lineType: flip.lineType || "mixed",
          reproducible: flip.reproducible !== false
        },
        relatedLineIds: [flip.alternateLineId || flip.lineId].filter(Boolean),
        reasonCodes: ["BETTER_PROJECTED_OUTCOME"],
        visibility: context.stale || flip.reproducible === false
          ? TacticalPatternVisibility.DEVELOPER_ONLY
          : TacticalPatternVisibility.USER_FACING
      };
    }).filter(Boolean);
  }

  function detectBaitRequired(context) {
    const branchFinding = branchDependencyFinding(context, "bait");
    if (branchFinding) return [branchFinding];
    return context.decisions.map((decision, index) => {
      if (decision.reasonCode !== "BAIT_REQUIRED" || !decision.chosenCandidate) return null;
      const candidates = (decision.candidates || []).filter(candidate => candidate?.moveId);
      const chosenCost = finiteNumber(decision.chosenCandidate.energyCost);
      const threatened = candidates.filter(candidate => finiteNumber(candidate.energyCost) > chosenCost)
        .sort((a, b) => Number(b.energyCost || 0) - Number(a.energyCost || 0))[0];
      if (!threatened) return null;
      const side = normalizeSide(decision.side);
      return {
        side,
        pokemonId: decision.pokemonId || context.combatants[side]?.id || null,
        moveId: decision.chosenCandidate.moveId,
        turn: finiteNumber(decision.turn),
        decisionId: decisionId(decision, index),
        relevance: 0.65,
        confidence: { level: "medium", reasons: ["planner reason code identifies bait pressure, but no complete shield branch is attached"] },
        impact: TacticalPatternImpact.MEANINGFUL,
        changesOutcome: false,
        actionable: false,
        evidence: {
          pokemonName: combatantName(context, side, decision.pokemonId),
          baitMoveId: decision.chosenCandidate.moveId,
          baitMoveName: decision.chosenCandidate.moveName,
          baitEnergyCost: chosenCost,
          threatenedMoveId: threatened.moveId,
          threatenedMoveName: threatened.moveName,
          threatenedEnergyCost: finiteNumber(threatened.energyCost),
          shieldBranchVerified: false
        },
        relatedLineIds: candidateLineIds(decision, index, decision.chosenCandidate, threatened),
        reasonCodes: ["BAIT_REQUIRED"],
        visibility: TacticalPatternVisibility.ANALYSIS
      };
    }).filter(Boolean);
  }

  function detectStraightPlaySufficient(context) {
    const branchFinding = branchDependencyFinding(context, "straight");
    if (branchFinding) return [branchFinding];
    return context.decisions.map((decision, index) => {
      if (decision.reasonCode !== "STRAIGHT_PLAY_SUFFICIENT" || !decision.chosenCandidate) return null;
      const side = normalizeSide(decision.side);
      return {
        side,
        pokemonId: decision.pokemonId || context.combatants[side]?.id || null,
        moveId: decision.chosenCandidate.moveId,
        turn: finiteNumber(decision.turn),
        decisionId: decisionId(decision, index),
        relevance: 0.6,
        confidence: { level: "medium", reasons: ["planner selected a straight line without a complete alternate bait branch"] },
        impact: TacticalPatternImpact.MEANINGFUL,
        changesOutcome: false,
        actionable: false,
        evidence: {
          pokemonName: combatantName(context, side, decision.pokemonId),
          moveId: decision.chosenCandidate.moveId,
          moveName: decision.chosenCandidate.moveName,
          outcomeStable: false
        },
        relatedLineIds: candidateLineIds(decision, index, decision.chosenCandidate),
        reasonCodes: ["STRAIGHT_PLAY_SUFFICIENT"],
        visibility: TacticalPatternVisibility.ANALYSIS
      };
    }).filter(Boolean);
  }

  function branchDependencyFinding(context, lineType) {
    const lines = context.alternateLines || [];
    const target = lines.find(line => line?.type === lineType && resultOutcome(line.result) === "win" && line.reproducible !== false);
    const comparisonType = lineType === "bait" ? "straight" : "bait";
    const comparison = lines.find(line => line?.type === comparisonType);
    if (!target || (comparison && resultOutcome(comparison.result) === "win")) return null;
    const side = normalizeSide(target.side || target.result?.winnerSide);
    if (!side) return null;
    return {
      side,
      pokemonId: target.pokemonId || context.combatants[side]?.id || null,
      moveId: target.moveId || null,
      turn: finiteNumber(target.turn),
      decisionId: target.id || `${lineType}:${side}`,
      relevance: 0.9,
      confidence: { level: "high", reasons: ["reproducible alternate branches produce different outcomes"] },
      impact: TacticalPatternImpact.OUTCOME_CHANGING,
      changesOutcome: true,
      actionable: true,
      evidence: {
        pokemonName: target.pokemonName || combatantName(context, side),
          lineType,
          moveId: target.moveId || null,
          moveName: target.moveName || null,
        baitMoveId: target.baitMoveId || null,
        baitMoveName: target.baitMoveName || null,
        threatenedMoveId: target.threatenedMoveId || null,
        threatenedMoveName: target.threatenedMoveName || null,
        straightOutcome: lineType === "bait" ? resultOutcome(comparison?.result) : resultOutcome(target.result),
        baitOutcome: lineType === "bait" ? resultOutcome(target.result) : resultOutcome(comparison?.result),
        outcomeStable: lineType === "straight"
      },
      relatedLineIds: [target.id, comparison?.id].filter(Boolean),
      reasonCodes: [lineType === "bait" ? "BAIT_REQUIRED" : "STRAIGHT_PLAY_SUFFICIENT"],
      visibility: context.stale ? TacticalPatternVisibility.DEVELOPER_ONLY : TacticalPatternVisibility.USER_FACING,
      patternId: lineType === "bait" ? "bait-required" : "straight-play-sufficient"
    };
  }

  function normalizeFinding(pattern, raw, context) {
    if (!raw || !normalizeSide(raw.side)) return null;
    const confidence = normalizeConfidence(raw.confidence);
    const relevance = clamp01(raw.relevance);
    return {
      schemaVersion: TACTICAL_PATTERN_SCHEMA_VERSION,
      libraryVersion: TACTICAL_PATTERN_LIBRARY_VERSION,
      patternId: raw.patternId || pattern.id,
      patternVersion: pattern.version,
      category: raw.category || pattern.category,
      side: normalizeSide(raw.side),
      pokemonId: raw.pokemonId || null,
      moveId: raw.moveId || null,
      turn: finiteNumber(raw.turn),
      decisionId: raw.decisionId || null,
      relevance,
      confidence,
      impact: Object.values(TacticalPatternImpact).includes(raw.impact) ? raw.impact : TacticalPatternImpact.INFORMATIONAL,
      changesOutcome: !!raw.changesOutcome,
      actionable: !!raw.actionable,
      evidence: raw.evidence && typeof raw.evidence === "object" ? raw.evidence : {},
      relatedLineIds: Array.isArray(raw.relatedLineIds) ? raw.relatedLineIds.filter(Boolean) : [],
      reasonCodes: Array.isArray(raw.reasonCodes) ? [...new Set(raw.reasonCodes.filter(Boolean))] : [],
      visibility: context.stale
        ? TacticalPatternVisibility.DEVELOPER_ONLY
        : Object.values(TacticalPatternVisibility).includes(raw.visibility)
          ? raw.visibility
          : TacticalPatternVisibility.ANALYSIS,
      source: {
        engineVersion: context.engineVersion,
        stale: context.stale,
        analysisMode: context.analysisMode
      }
    };
  }

  function compareCandidates(chosen, alternate) {
    if (!chosen || !alternate) return { measurable: false, meaningful: false, changesOutcome: false, relevance: 0 };
    const chosenRating = finiteNumber(chosen.projectedRating);
    const alternateRating = finiteNumber(alternate.projectedRating);
    const chosenHp = finiteNumber(chosen.projectedRemainingHp);
    const alternateHp = finiteNumber(alternate.projectedRemainingHp);
    const chosenEnergy = finiteNumber(chosen.projectedRemainingEnergy);
    const alternateEnergy = finiteNumber(alternate.projectedRemainingEnergy);
    const ratingDelta = chosenRating !== null && alternateRating !== null ? chosenRating - alternateRating : null;
    const hpDelta = chosenHp !== null && alternateHp !== null ? chosenHp - alternateHp : null;
    const energyDelta = chosenEnergy !== null && alternateEnergy !== null ? chosenEnergy - alternateEnergy : null;
    const changesOutcome = !!chosen.projectedOutcome && !!alternate.projectedOutcome && chosen.projectedOutcome !== alternate.projectedOutcome;
    const measurable = changesOutcome || ratingDelta !== null || hpDelta !== null || energyDelta !== null;
    const meaningful = changesOutcome || Number(ratingDelta || 0) >= 25 || Number(hpDelta || 0) >= 5 || Number(energyDelta || 0) >= 10;
    const relevance = changesOutcome
      ? 1
      : clamp01(0.45 + Math.max(0, Number(ratingDelta || 0)) / 400 + Math.max(0, Number(hpDelta || 0)) / 160);
    return { measurable, meaningful, changesOutcome, ratingDelta, hpDelta, energyDelta, relevance };
  }

  function bestComparableAlternative(candidates) {
    return candidates.slice().sort((a, b) => {
      const outcome = outcomeRank(b.projectedOutcome) - outcomeRank(a.projectedOutcome);
      if (outcome) return outcome;
      return Number(b.projectedRating ?? -Infinity) - Number(a.projectedRating ?? -Infinity);
    })[0] || null;
  }

  function confidenceForComparison(context, comparison) {
    if (context.stale) return { level: "low", reasons: ["source result is stale"] };
    if (comparison.changesOutcome || comparison.ratingDelta !== null) {
      return { level: "high", reasons: ["deterministic effect compared across complete projected continuations"] };
    }
    return { level: "medium", reasons: ["deterministic effect has measurable state evidence but incomplete outcome projection"] };
  }

  function parseStatEffects(value) {
    return String(value || "").split(",").map(part => {
      const match = part.trim().match(/^(self|opponent)\s+(atk|def)\s+([+-]\d+)$/i);
      if (!match) return null;
      return {
        target: match[1].toLowerCase(),
        stat: match[2].toLowerCase() === "atk" ? "attack" : "defense",
        stages: Number(match[3])
      };
    }).filter(Boolean);
  }

  function effectMatches(effect, expected) {
    if (!effect) return false;
    return effect.target === expected.target && effect.stat === expected.stat && Math.sign(effect.stages) === expected.direction;
  }

  function candidateLineIds(decision, index, ...candidates) {
    return candidates.filter(Boolean).map(candidate => `${decision.side || "?"}:${decision.turn || 0}:${index}:${candidate.moveId || candidate.action || "line"}`);
  }

  function decisionId(decision, index) {
    return `${decision.side || "?"}:${decision.decisionType || "decision"}:${decision.turn || 0}:${index}`;
  }

  function combatantName(context, side, fallbackId) {
    return context.combatants[side]?.name || humanizeId(fallbackId) || `Pokemon ${side}`;
  }

  function humanizeId(id) {
    if (!id) return "";
    return String(id).split("_").map(part => part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : "").join(" ");
  }

  function normalizeSide(side) {
    const value = String(side || "").toUpperCase();
    return value === "A" || value === "B" ? value : null;
  }

  function oppositeSide(side) {
    return side === "A" ? "B" : "A";
  }

  function finiteNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value || 0)));
  }

  function normalizeConfidence(confidence) {
    const input = typeof confidence === "string" ? { level: confidence } : confidence || {};
    const level = ["high", "medium", "low"].includes(input.level) ? input.level : "low";
    return {
      level,
      score: finiteNumber(input.score),
      reasons: Array.isArray(input.reasons) ? input.reasons.filter(Boolean) : []
    };
  }

  function confidenceRank(level) {
    return { low: 1, medium: 2, high: 3 }[level] || 0;
  }

  function impactWeight(impact) {
    return {
      [TacticalPatternImpact.INFORMATIONAL]: 4,
      [TacticalPatternImpact.MINOR]: 8,
      [TacticalPatternImpact.MEANINGFUL]: 18,
      [TacticalPatternImpact.OUTCOME_CHANGING]: 32
    }[impact] || 0;
  }

  function impactRank(impact) {
    return {
      [TacticalPatternImpact.INFORMATIONAL]: 1,
      [TacticalPatternImpact.MINOR]: 2,
      [TacticalPatternImpact.MEANINGFUL]: 3,
      [TacticalPatternImpact.OUTCOME_CHANGING]: 4
    }[impact] || 0;
  }

  function prioritizeFindings(findings) {
    return findings.slice().sort((a, b) =>
      impactRank(b.impact) - impactRank(a.impact)
      || b.relevance - a.relevance
      || confidenceRank(b.confidence.level) - confidenceRank(a.confidence.level)
      || Number(a.turn ?? Infinity) - Number(b.turn ?? Infinity)
      || a.patternId.localeCompare(b.patternId)
    );
  }

  function deduplicateFindings(findings) {
    const seen = new Map();
    for (const finding of findings) {
      const flipKey = finding.patternId === "extra-fast-move-flip"
        ? `${finding.evidence?.fastMoveCount || ""}:${finding.relatedLineIds?.join(",") || ""}`
        : "";
      const key = [finding.patternId, finding.side, finding.moveId || "", flipKey].join("|");
      const previous = seen.get(key);
      if (!previous || finding.relevance > previous.relevance) seen.set(key, finding);
    }
    return [...seen.values()];
  }

  function summarizeConfidence(findings) {
    const counts = { high: 0, medium: 0, low: 0 };
    for (const finding of findings) counts[finding.confidence.level] += 1;
    const highest = Object.keys(counts).sort((a, b) => confidenceRank(b) - confidenceRank(a)).find(level => counts[level]) || null;
    return { ...counts, highest };
  }

  function outcomeRank(outcome) {
    return { win: 3, draw: 2, loss: 1 }[String(outcome || "").toLowerCase()] || 0;
  }

  function resultOutcome(result) {
    if (!result) return null;
    if (typeof result === "string") return result.toLowerCase();
    return String(result.outcome || result.result || "").toLowerCase() || null;
  }

  function now() {
    return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
  }

  return Object.freeze({
    TACTICAL_PATTERN_SCHEMA_VERSION,
    TACTICAL_PATTERN_LIBRARY_VERSION,
    TacticalPatternCategory,
    TacticalPatternImpact,
    TacticalPatternVisibility,
    TACTICAL_ANALYSIS_PROFILES: PROFILE_IDS,
    getTacticalPatternDefinitions,
    getTacticalPatternDefinition,
    detectTacticalPatterns,
    buildTacticalPatternSummary,
    plannerHintsFromTacticalFindings
  });
});
