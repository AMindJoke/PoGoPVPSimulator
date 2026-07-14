"use strict";

(function exposeBattleReview(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakBattleReview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBattleReviewApi() {
  const MAX_ITEMS = 3;

  function buildBattleReview(input = {}) {
    const events = Array.isArray(input.events) ? input.events.filter(Boolean) : [];
    const insights = Array.isArray(input.insights) ? input.insights.filter(Boolean) : [];
    const combatants = input.combatants || {};
    const candidates = [
      ...criticalShieldItems(insights, events, combatants),
      closingItem(events, combatants),
      stageEffectItem(events, combatants),
      sneakItem(events, combatants)
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
    return {
      schemaVersion: 1,
      outcome: outcomeSummary(combatants),
      items
    };
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

  function sneakItem(events, combatants) {
    const sneaked = events.find(event => event.kind === "fast" && event.sneaked);
    if (!sneaked) return null;
    const actor = combatantName(combatants, sneaked.side);
    return {
      key: `sneak:${sneaked.index}`,
      type: "timing",
      label: "Timing",
      title: `${actor} sneaks ${sneaked.moveName}`,
      explanation: `${sneaked.moveName} completes during ${sneaked.sneakChargeName || "the charged move"}, adding its damage and energy at that timing point.`,
      turn: sneaked.turn,
      eventIndex: sneaked.index,
      priority: 50
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
