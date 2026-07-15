"use strict";

(function exposeTacticalInsights(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakTacticalInsights = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTacticalInsightApi() {
  function translateTacticalFinding(finding) {
    if (!finding || finding.visibility !== "user-facing" || finding.confidence?.level === "low") return null;
    const evidence = finding.evidence || {};
    const pokemon = evidence.pokemonName || "This Pokemon";
    const cautious = finding.confidence?.level === "medium";
    const output = translateByPattern(finding.patternId, evidence, pokemon, cautious);
    if (!output) return null;
    return {
      type: finding.patternId,
      title: output.title,
      text: output.text,
      tone: finding.changesOutcome ? "decisive" : "advisory",
      confidence: finding.confidence.level,
      actionReference: finding.actionable ? {
        side: finding.side,
        turn: finding.turn,
        moveId: finding.moveId,
        decisionId: finding.decisionId
      } : null,
      evidenceReference: {
        patternId: finding.patternId,
        decisionId: finding.decisionId,
        relatedLineIds: finding.relatedLineIds || []
      }
    };
  }

  function buildTacticalInsights(summary, options = {}) {
    const findings = summary?.userFacingFindings || summary?.findings || [];
    return findings.map(translateTacticalFinding).filter(Boolean).slice(0, options.maxInsights || 3);
  }

  function translateByPattern(patternId, evidence, pokemon, cautious) {
    if (patternId === "guaranteed-defense-buff-value") {
      const hp = positiveNumber(evidence.extraHpRetained);
      const suffix = hp ? ` and leaves it with ${hp} more projected HP` : " in the following sequence";
      return {
        title: `${evidence.moveName} changes the survival line`,
        text: `The guaranteed Defense boost lets ${pokemon} absorb more damage${suffix}.`
      };
    }
    if (patternId === "guaranteed-attack-debuff-value") {
      const hp = positiveNumber(evidence.extraHpRetained);
      const suffix = hp ? `, preserving ${hp} projected HP` : " in the following sequence";
      return {
        title: `${evidence.moveName} reduces the return pressure`,
        text: `The guaranteed Attack drop gives ${pokemon} more room to survive${suffix}.`
      };
    }
    if (patternId === "delay-self-debuff") {
      return {
        title: `Hold ${evidence.moveName} for later`,
        text: `Using ${evidence.moveName} here drops ${pokemon}'s ${evidence.selfDebuffStat || "stats"} too early; ${evidence.saferMoveName} keeps the stronger continuation.`
      };
    }
    if (patternId === "extra-fast-move-flip") {
      const count = Number(evidence.fastMoveCount || 0);
      return {
        title: `${count} extra ${evidence.fastMoveName} ${count === 1 ? "flips" : "flip"} the matchup`,
        text: `${pokemon} ${cautious ? "can" : "will"} change the result with ${count} extra ${evidence.fastMoveName}${count === 1 ? "" : "s"}.`
      };
    }
    if (patternId === "bait-required") {
      return {
        title: `${pokemon} needs to draw a shield`,
        text: `${evidence.baitMoveName || "The cheaper move"} must draw a shield before ${evidence.threatenedMoveName || "the stronger move"} can close the matchup.`
      };
    }
    if (patternId === "straight-play-sufficient") {
      return {
        title: `${pokemon} can play this straight`,
        text: `${evidence.moveName || "The stronger move"} is enough; baiting is not required.`
      };
    }
    return null;
  }

  function positiveNumber(value) {
    const number = Math.round(Number(value || 0));
    return number > 0 ? number : 0;
  }

  return Object.freeze({
    translateTacticalFinding,
    buildTacticalInsights
  });
});
