"use strict";

const OUTCOME_RANK = Object.freeze({ loss: 0, draw: 1, win: 2 });

function scanBattleContradictions(records = [], options = {}) {
  const findings = [];
  for (const record of records) {
    findings.push(...scanDecisionTrace(record));
    findings.push(...scanWastefulShield(record));
    findings.push(...scanUnusedLethalEnergy(record));
  }
  findings.push(...scanOrientationMismatches(options.orientationRecords || [], options.orientationTolerance));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    findingCount: findings.length,
    counts: countByRule(findings),
    findings
  };
}

function scanDecisionTrace(record) {
  const findings = [];
  for (const [decisionIndex, decision] of (record.trace?.decisions || []).entries()) {
    if (decision.decisionType !== "charged-move-selection" && decision.decisionType !== "farm-vs-throw") continue;
    const candidates = (decision.candidates || []).filter(candidate => candidate && candidate.moveId);
    const chosen = decision.chosenCandidate;
    if (!chosen?.moveId || !candidates.length) continue;
    const winningAlternative = candidates
      .filter(candidate => candidate.moveId !== chosen.moveId && candidate.projectedOutcome === "win")
      .sort(compareCandidateQuality)[0];
    if (chosen.projectedOutcome === "loss" && winningAlternative) {
      findings.push(createFinding(record, decision, decisionIndex, {
        rule: "MISSED_WINNING_MOVE",
        category: "charged-move-choice",
        message: `${chosen.moveName} projects a loss while ${winningAlternative.moveName} projects a win.`,
        evidence: { chosen, alternative: winningAlternative }
      }));
    }
    const effectAlternative = candidates
      .filter(candidate => candidate.moveId !== chosen.moveId && hasGuaranteedEffect(candidate))
      .filter(candidate => candidateClearlyBetter(candidate, chosen))
      .sort(compareCandidateQuality)[0];
    if (effectAlternative) {
      findings.push(createFinding(record, decision, decisionIndex, {
        rule: "GUARANTEED_EFFECT_IGNORED",
        category: "buff-debuff-valuation",
        message: `${effectAlternative.moveName}'s guaranteed effect has a better projected continuation than ${chosen.moveName}.`,
        evidence: { chosen, alternative: effectAlternative }
      }));
    }
  }
  return dedupeFindings(findings);
}

function scanWastefulShield(record) {
  const findings = [];
  for (const counterfactual of record.shieldCounterfactuals || record.trace?.shieldCounterfactuals || []) {
    const chosenOutcome = counterfactual.shielded
      ? counterfactual.outcomeWithShield
      : counterfactual.outcomeWithoutShield;
    const alternativeOutcome = counterfactual.shielded
      ? counterfactual.outcomeWithoutShield
      : counterfactual.outcomeWithShield;
    if (chosenOutcome === "loss" && alternativeOutcome === "win" && (!counterfactual.shieldMode || counterfactual.shieldMode === "smart")) {
      const betterAction = counterfactual.shielded ? "saving the shield" : "using the shield";
      findings.push({
        id: `${record.id}:MISSED_WINNING_SHIELD:${counterfactual.turn ?? "unknown"}`,
        caseId: record.id,
        rule: "MISSED_WINNING_SHIELD",
        category: "shielding",
        confidence: "potential",
        message: `The chosen shield call loses while ${betterAction} has a demonstrated winning continuation.`,
        evidence: counterfactual
      });
      continue;
    }
    if (!counterfactual.shielded || counterfactual.outcomeWithShield !== counterfactual.outcomeWithoutShield) continue;
    const hpGain = Number(counterfactual.hpGain || 0);
    const energyGain = Number(counterfactual.energyGain || 0);
    const moveAccessGain = Number(counterfactual.moveAccessGain || 0);
    if (hpGain > .05 || energyGain >= 5 || moveAccessGain > 0) continue;
    findings.push({
      id: `${record.id}:WASTEFUL_SHIELD:${counterfactual.turn ?? "unknown"}`,
      caseId: record.id,
      rule: "WASTEFUL_SHIELD",
      category: "shielding",
      confidence: "potential",
      message: "The shield preserves no demonstrated outcome, HP, energy, or move-access advantage.",
      evidence: counterfactual
    });
  }
  return findings;
}

function scanUnusedLethalEnergy(record) {
  const findings = [];
  const terminalStates = record.lethalAtFaint || record.trace?.terminalSnapshots || [];
  for (const state of terminalStates) {
    if (!state.fainted || !state.legalMoveCouldChangeOutcome) continue;
    const move = state.demonstratedMove || state.lethalMoves?.[0] || state.affordableMoves?.[0] || {};
    findings.push({
      id: `${record.id}:UNUSED_LETHAL_ENERGY:${state.side}:${state.turn ?? "unknown"}`,
      caseId: record.id,
      rule: "UNUSED_LETHAL_ENERGY",
      category: "energy-management",
      confidence: "potential",
      message: `${state.side} fainted with enough energy for ${move.moveName || state.moveName || "a charged move"}, which has a demonstrated outcome-changing continuation.`,
      evidence: state
    });
  }
  return findings;
}

function scanOrientationMismatches(rows = [], tolerance = 2) {
  const findings = [];
  const byKey = new Map(rows.map(row => [orientationKey(row), row]));
  const seen = new Set();
  for (const row of rows) {
    const reverse = byKey.get(orientationKey({
      aId: row.bId,
      bId: row.aId,
      aShields: row.bShields,
      bShields: row.aShields
    }));
    if (!reverse) continue;
    const pairId = [orientationKey(row), orientationKey(reverse)].sort().join("<=>");
    if (seen.has(pairId)) continue;
    seen.add(pairId);
    const inversionError = Math.abs(Number(row.score) + Number(reverse.score) - 1000);
    if (inversionError <= tolerance) continue;
    findings.push({
      id: `orientation:${row.aId}:${row.bId}:${row.aShields}-${row.bShields}`,
      caseId: null,
      rule: "ORIENTATION_MISMATCH",
      category: "orientation",
      confidence: "potential",
      message: `${row.aId} vs ${row.bId} does not safely invert within ${tolerance} rating points.`,
      evidence: { forward: row, reverse, inversionError }
    });
  }
  return findings;
}

function orientationKey(row) {
  return `${row.aId}>${row.bId}|${Number(row.aShields || 0)}-${Number(row.bShields || 0)}`;
}

function candidateClearlyBetter(candidate, chosen) {
  const candidateOutcome = OUTCOME_RANK[candidate.projectedOutcome] ?? -1;
  const chosenOutcome = OUTCOME_RANK[chosen.projectedOutcome] ?? -1;
  if (candidateOutcome > chosenOutcome) return true;
  if (candidateOutcome < chosenOutcome) return false;
  if (!Number.isFinite(candidate.projectedRating) || !Number.isFinite(chosen.projectedRating)) return false;
  return candidate.projectedRating > chosen.projectedRating + 1;
}

function hasGuaranteedEffect(candidate) {
  return candidate.statEffects && candidate.statEffects !== "none";
}

function compareCandidateQuality(a, b) {
  return (OUTCOME_RANK[b.projectedOutcome] ?? -1) - (OUTCOME_RANK[a.projectedOutcome] ?? -1)
    || Number(b.projectedRating || 0) - Number(a.projectedRating || 0)
    || String(a.moveName).localeCompare(String(b.moveName));
}

function createFinding(record, decision, decisionIndex, input) {
  return {
    id: `${record.id}:${input.rule}:${decisionIndex}`,
    caseId: record.id,
    rule: input.rule,
    category: input.category,
    confidence: "potential",
    message: input.message,
    reproduction: {
      decisionIndex,
      turn: decision.turn,
      side: decision.side,
      pokemonId: decision.pokemonId,
      engineVersion: record.trace?.engineVersion || null
    },
    evidence: input.evidence
  };
}

function dedupeFindings(findings) {
  const seen = new Set();
  return findings.filter(finding => {
    const key = `${finding.caseId}:${finding.rule}:${finding.reproduction?.decisionIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countByRule(findings) {
  return findings.reduce((counts, finding) => {
    counts[finding.rule] = (counts[finding.rule] || 0) + 1;
    return counts;
  }, {});
}

module.exports = {
  scanBattleContradictions,
  scanDecisionTrace,
  scanWastefulShield,
  scanUnusedLethalEnergy,
  scanOrientationMismatches
};
