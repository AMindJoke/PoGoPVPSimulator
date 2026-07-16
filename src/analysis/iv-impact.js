"use strict";

(function exposeIvImpact(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakIvImpact = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createIvImpactApi() {
  function buildIvImpact(input = {}) {
    return [damageImpact(input.damage), cmpImpact(input.cmp), bulkImpact(input.bulk)].filter(Boolean);
  }

  function damageImpact(fact) {
    if (!fact || !fact.moveName || fact.currentDamage === fact.referenceDamage) return null;
    const gain = fact.currentDamage > fact.referenceDamage;
    return item("damage", "Damage", gain ? "positive" : "negative",
      `${fact.moveName} deals ${Math.abs(fact.currentDamage - fact.referenceDamage)} ${gain ? "more" : "less"} damage vs ${fact.opponentName}.`);
  }

  function cmpImpact(fact) {
    if (!fact || !fact.opponentName || fact.currentOutcome === fact.referenceOutcome) return null;
    const copy = fact.currentOutcome === "win"
      ? `Wins CMP against ${fact.opponentName}.`
      : fact.currentOutcome === "tie"
        ? `Now ties CMP with ${fact.opponentName}.`
        : `Loses CMP against ${fact.opponentName}.`;
    return item("cmp", "CMP", fact.currentOutcome === "win" ? "positive" : "negative", copy);
  }

  function bulkImpact(fact) {
    if (!fact || !fact.moveName || !fact.opponentName) return null;
    if (fact.currentSurvives !== fact.referenceSurvives) {
      return item("bulk", "Bulk", fact.currentSurvives ? "positive" : "negative",
        fact.currentSurvives ? `Survives ${fact.moveName} from ${fact.opponentName}.` : `${fact.moveName} from ${fact.opponentName} now KOs.`);
    }
    if (fact.currentDamage === fact.referenceDamage) return null;
    const gain = fact.currentDamage < fact.referenceDamage;
    return item("bulk", "Bulk", gain ? "positive" : "negative",
      `Takes ${Math.abs(fact.currentDamage - fact.referenceDamage)} ${gain ? "less" : "more"} damage from ${fact.moveName}.`);
  }

  function item(key, label, tone, text) {
    return { key, label, tone, icon: tone === "positive" ? "check" : "alert", text };
  }

  return { buildIvImpact };
});
