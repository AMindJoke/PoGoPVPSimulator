"use strict";

(function exposeBattleReview(root, factory) {
  const tacticalInsights = typeof module === "object" && module.exports
    ? require("./tactical-insights")
    : root?.PvPeakTacticalInsights;
  const winConditionEngine = typeof module === "object" && module.exports
    ? require("./win-condition-engine")
    : root?.PvPeakWinConditionEngine;
  const winConditionViewModel = typeof module === "object" && module.exports
    ? require("./win-condition-view-model")
    : root?.PvPeakWinConditionViewModel;
  const api = factory(tacticalInsights, winConditionEngine, winConditionViewModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakBattleReview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBattleReviewApi(tacticalInsightsApi, winConditionEngineApi, viewModelApi) {
  const MAX_ITEMS = 3;

  function buildBattleReview(input = {}) {
    const events = Array.isArray(input.events) ? input.events.filter(Boolean) : [];
    const insights = Array.isArray(input.insights) ? input.insights.filter(Boolean) : [];
    const combatants = input.combatants || {};
    const winConditionSummary = resolveWinConditionSummary(input);
    const candidates = [
      ...criticalShieldItems(insights, events, combatants),
      ...tacticalPatternItems(input.tacticalSummary, events),
      closingItem(events, combatants),
      stageEffectItem(events, combatants)
    ].filter(Boolean).sort((a, b) => b.priority - a.priority || a.turn - b.turn);
    const seenEvents = new Set();
    const items = [];
    for (const candidate of candidates) {
      const eventKey = Number.isInteger(candidate.eventIndex) ? candidate.eventIndex : candidate.key;
      if (seenEvents.has(eventKey)) continue;
      seenEvents.add(eventKey);
      items.push(candidate);
      if (items.length >= MAX_ITEMS) break;
    }
    const winConditions = typeof viewModelApi?.buildWinConditionViewModels === "function"
      ? viewModelApi.buildWinConditionViewModels({
        winConditionSummary,
        swing: input.swing,
        hpSwing: input.hpSwing,
        combatants,
        pokemon: input.pokemon,
        events
      })
      : [];
    const swingPoint = typeof viewModelApi?.selectSwingPoint === "function"
      ? viewModelApi.selectSwingPoint({ conditions: winConditions })
      : null;
    return {
      schemaVersion: 2,
      outcome: outcomeSummary(combatants),
      metrics: summaryMetrics(input, combatants),
      winConditions,
      items,
      swingPoint,
      winConditionSummary,
      developerPatterns: developerPatternDetails(input.tacticalSummary),
      developerWinConditions: input.developerMode ? clone(winConditionSummary?.conditions || []) : []
    };
  }

  function summaryMetrics(input, combatants) {
    const hpSwing = input.hpSwing || null;
    const energySwing = input.swing || null;
    return [
      conditionMetric("HP Swing", hpSwing?.opponentSide, hpSwing
        ? `${hpSwing.opponentStartingHp} starting HP`
        : input.hpSwingPending ? "Calculating..." : "No HP flip", hpSwing ? `-${hpSwing.hpReduction} HP` : "", combatants, hpSwing ? {
          type: "preview-hp",
          ref: { side: hpSwing.opponentSide, startingHp: hpSwing.opponentStartingHp, hpReduction: hpSwing.hpReduction }
        } : null),
      conditionMetric("Energy Swing", energySwing?.side, energySwing
        ? `+${Number(energySwing.energy || 0)} energy`
        : "No small flip", energySwing ? `${Number(energySwing.fastMoveCount || energySwing.fastMoves || 0)} ${energySwing.fastMoveName || energySwing.fastMove || "fast move"}` : "", combatants)
    ];
  }

  function conditionMetric(label, side, display, note, combatants, actionReference = null) {
    return {
      label,
      display,
      note,
      side: side === "A" || side === "B" ? side : null,
      pokemonName: side === "A" || side === "B" ? combatants[side]?.name || `Pokemon ${side}` : null,
      actionReference
    };
  }

  function resolveWinConditionSummary(input) {
    if (input.winConditionSummary) return input.winConditionSummary;
    const build = winConditionEngineApi?.buildWinConditionSummary;
    return typeof build === "function"
      ? build({ tacticalSummary: input.tacticalSummary, provenance: input.provenance, engineVersion: input.engineVersion })
      : null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function tacticalPatternItems(summary, events) {
    const translate = tacticalInsightsApi?.translateTacticalFinding;
    if (typeof translate !== "function") return [];
    return (summary?.userFacingFindings || []).map(finding => {
      const insight = translate(finding);
      if (!insight) return null;
      const event = events.find(candidate =>
        candidate.side === finding.side &&
        candidate.kind === "charge" &&
        Number(candidate.turn) === Number(finding.turn) &&
        (!finding.moveId || candidate.moveId === finding.moveId)
      );
      if (!event) return null;
      return {
        key: `pattern:${finding.patternId}:${finding.decisionId || event.index}`,
        type: "tactical",
        label: finding.changesOutcome ? "Tactical edge" : "Tactical pattern",
        title: insight.title,
        explanation: insight.text,
        turn: Number(event.turn || finding.turn || 0),
        eventIndex: event.index,
        priority: finding.changesOutcome ? 95 : 75,
        patternId: finding.patternId,
        confidence: finding.confidence?.level || "low"
      };
    }).filter(Boolean);
  }

  function developerPatternDetails(summary) {
    return (summary?.findings || []).map(finding => ({
      patternId: finding.patternId,
      patternVersion: finding.patternVersion,
      side: finding.side,
      turn: finding.turn,
      moveId: finding.moveId,
      decisionId: finding.decisionId,
      confidence: finding.confidence,
      relevance: finding.relevance,
      impact: finding.impact,
      changesOutcome: finding.changesOutcome,
      evidence: finding.evidence,
      relatedLineIds: finding.relatedLineIds
    }));
  }

  function criticalShieldItems(insights, events, combatants) {
    return insights
      .filter(insight => insight.decisionType === "critical-shield-call")
      .map(insight => {
        const event = events.find(candidate =>
          candidate.kind === "charge" &&
          candidate.turn === Number(insight.turn || 0) &&
          (!insight.moveId || candidate.moveId === insight.moveId) &&
          candidate.side !== insight.side
        );
        const pokemon = combatantName(combatants, insight.side, insight.pokemonName);
        const shield = insight.action === "SHIELD";
        const factors = Array.isArray(insight.sequenceFactors) && insight.sequenceFactors.length
          ? ` ${insight.sequenceFactors.join("; ")} matters in the continuation.`
          : " The comparison includes the complete continuation after this decision.";
        return {
          key: insight.key || `shield:${insight.turn}:${insight.side}:${insight.moveId}`,
          type: "critical",
          label: "Turning point",
          title: shield
            ? `${pokemon} needs to shield ${insight.moveName}`
            : `${pokemon} needs to preserve the shield`,
          explanation: shield
            ? `Shielding preserves the winning continuation; letting the move through loses.${factors}`
            : `Letting this move through preserves the winning continuation; shielding loses.${factors}`,
          turn: Number(insight.turn || event?.turn || 0),
          eventIndex: event?.index ?? null,
          priority: 100
        };
      })
      .filter(item => Number.isInteger(item.eventIndex));
  }

  function closingItem(events, combatants) {
    const closing = [...events].reverse().find(event => {
      if (!event || !["fast", "charge"].includes(event.kind) || !event.state) return false;
      const opponentSide = event.side === "A" ? "B" : "A";
      return Number(event.state[opponentSide]?.hp || 0) <= 0;
    });
    if (!closing) return null;
    const attacker = combatantName(combatants, closing.side);
    const opponent = combatantName(combatants, closing.side === "A" ? "B" : "A");
    return {
      key: `closing:${closing.index}`,
      type: "closing",
      label: "Closing sequence",
      title: `${attacker} closes with ${closing.moveName}`,
      explanation: `${closing.moveName} deals ${closing.damage} damage and knocks out ${opponent}.`,
      turn: closing.turn,
      eventIndex: closing.index,
      priority: 70
    };
  }

  function stageEffectItem(events, combatants) {
    const affected = events
      .filter(event => event.kind === "charge" && Array.isArray(event.buffEffects) && event.buffEffects.length)
      .sort((a, b) => effectMagnitude(b) - effectMagnitude(a) || a.turn - b.turn)[0];
    if (!affected) return null;
    const actor = combatantName(combatants, affected.side);
    const opponent = combatantName(combatants, affected.side === "A" ? "B" : "A");
    const effects = affected.buffEffects.map(effect => {
      const target = effect.target === "opponent" ? opponent : actor;
      const stat = effect.stat === "attack" ? "Attack" : "Defense";
      const delta = Number(effect.delta || 0);
      return `${target}'s ${stat} ${delta > 0 ? "rises" : "falls"} by ${Math.abs(delta)} stage${Math.abs(delta) === 1 ? "" : "s"}`;
    }).join("; ");
    return {
      key: `effect:${affected.index}`,
      type: "effect",
      label: "Stat swing",
      title: `${affected.moveName} changes the battle state`,
      explanation: `${effects}. This changes the value of the moves that follow.`,
      turn: affected.turn,
      eventIndex: affected.index,
      priority: 60
    };
  }

  function outcomeSummary(combatants) {
    const a = combatants.A || null;
    const b = combatants.B || null;
    if (!a || !b) return "";
    if (a.hp <= 0 && b.hp <= 0) return "Tie";
    const winner = a.hp > 0 ? a : b.hp > 0 ? b : null;
    if (!winner) return "";
    return `${winner.name} wins with ${Math.max(0, Number(winner.hp || 0))} HP and ${Math.max(0, Number(winner.energy || 0))} energy`;
  }

  function effectMagnitude(event) {
    return (event.buffEffects || []).reduce((sum, effect) => sum + Math.abs(Number(effect.delta || 0)), 0);
  }

  function combatantName(combatants, side, fallback) {
    return combatants[side]?.name || fallback || `Pokemon ${side}`;
  }

  return {
    BATTLE_REVIEW_MAX_ITEMS: MAX_ITEMS,
    buildBattleReview
  };
});
