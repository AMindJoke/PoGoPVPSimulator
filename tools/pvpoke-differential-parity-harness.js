"use strict";

const fs = require("fs");
const path = require("path");
const TurnEngine = require("../src/battle/turn-resolution-engine");
const Intelligence = require("../src/battle/battle-intelligence");
const Corpus = require("../data/pvpoke-differential-parity-corpus");
const Translator = require("./pvpoke-state-translator");
const Reference = require("./pvpoke-reference-adapter");

const ROOT = path.resolve(__dirname, "..");
const REPORT_DIR = path.join(ROOT, "reports", "pvpoke-differential-parity");
const COMPARABLE_STATUSES = new Set([Translator.EXACT, Translator.NORMALIZED_EQUIVALENT]);
const FAILURE_CATEGORIES = Object.freeze([
  "CANONICAL_ACTION_DIFFERENCE",
  "MOVE_ID_DIFFERENCE",
  "SHIELD_DIFFERENCE",
  "TIMING_STATE_CONVENTION",
  "PENDING_FAST_REPRESENTATION",
  "CMP_REPRESENTATION",
  "DAMAGE_DATA_DIFFERENCE",
  "STAT_DATA_DIFFERENCE",
  "MOVE_DATA_DIFFERENCE",
  "TRANSLATION_ERROR",
  "INTENTIONAL_PROJECT_ADAPTATION",
  "UNSUPPORTED_STATE",
  "UNKNOWN"
]);

function run(options = {}) {
  assertHarnessIndependence();
  const reference = Reference.createPvPokeReference({
    repoPath: options.repoPath || path.join(ROOT, "vendor", "pvpoke"),
    revision: options.revision || Reference.PINNED_CANONICAL_REVISION
  });
  const fixtures = options.fixtures || Corpus.buildDifferentialCorpus();
  const results = fixtures.map(fixture => evaluateFixture(fixture, reference));
  const report = summarize(results, fixtures, reference);
  if (options.writeReports) writeReports(report, options.reportDir || REPORT_DIR);
  return report;
}

function evaluateFixture(fixture, reference) {
  const translated = Translator.translateFixtureToPvPoke(fixture);
  const comparable = COMPARABLE_STATUSES.has(translated.stateEquivalenceStatus);
  if (!comparable) {
    return {
      id: fixture.id,
      comparable: false,
      pass: false,
      classification: "UNSUPPORTED_STATE",
      fixture: compactFixture(fixture),
      translation: translated
    };
  }
  let pvpokeDecision;
  let simulatorDecision;
  try {
    pvpokeDecision = reference.evaluateFirstAction({ state: translated, side: "A", options: fixture.options });
    simulatorDecision = evaluateSimulatorFirstAction(fixture);
  } catch (error) {
    return {
      id: fixture.id,
      comparable: true,
      pass: false,
      classification: "TRANSLATION_ERROR",
      explanation: error.message,
      fixture: compactFixture(fixture),
      translation: translated
    };
  }
  const comparison = compareDecisions(pvpokeDecision, simulatorDecision, fixture, translated);
  return {
    id: fixture.id,
    comparable: true,
    pass: comparison.pass,
    canonicalStateHash: translated.canonicalStateHash,
    stateEquivalenceStatus: translated.stateEquivalenceStatus,
    classification: comparison.classification,
    explanation: comparison.explanation,
    categories: fixture.categories || [],
    family: fixture.family,
    matchup: fixture.matchup,
    fastDurationPair: `${fixture.state.sides.A.fastMove.turns}-${fixture.state.sides.B.fastMove.turns}`,
    shieldState: `${fixture.state.sides.A.shields}-${fixture.state.sides.B.shields}`,
    cmpState: fixture.state.cmpState?.readySides?.length ? "cmp" : "none",
    pvpokeDecision,
    simulatorDecision,
    simulatorPrincipleIds: simulatorDecision.principleIds || [],
    firstSuspectedSourceBranch: simulatorDecision.sourceBranch || pvpokeDecision.sourceBranch || null,
    fixture: comparison.pass ? null : compactFixture(fixture),
    translation: comparison.pass ? {
      fixtureId: translated.fixtureId,
      translationNotes: translated.translationNotes,
      unsupportedFields: translated.unsupportedFields,
      stateEquivalenceStatus: translated.stateEquivalenceStatus,
      canonicalStateHash: translated.canonicalStateHash
    } : translated
  };
}

function evaluateSimulatorFirstAction(fixture) {
  Intelligence.clearCache();
  const state = TurnEngine.createState(fixture.state);
  state.sides.A = { ...state.sides.A, ...fixture.state.sides.A };
  state.sides.B = { ...state.sides.B, ...fixture.state.sides.B };
  const legalActions = TurnEngine.getLegalActions(state, "A");
  const decision = Intelligence.selectAction({
    state,
    side: "A",
    legalActions,
    policy: "FAST",
    plannerMode: "CANONICAL",
    context: {
      callerContext: "pvpoke-differential-parity",
      farmEnergy: fixture.options?.farmEnergy,
      chargedTimingOptimization: fixture.options?.optimizeMoveTiming !== false,
      estimateDamage: action => Corpus.estimateDamage(state.sides.A, state.sides.B, action.move || action),
      estimateFastDamage: side => side === "opponent"
        ? Corpus.estimateDamage(state.sides.B, state.sides.A, state.sides.B.fastMove)
        : Corpus.estimateDamage(state.sides.A, state.sides.B, state.sides.A.fastMove),
      estimateOpponentDamage: move => Corpus.estimateDamage(state.sides.B, state.sides.A, move),
      compactDamage: (side, move) => side === "B"
        ? Corpus.estimateDamage(state.sides.B, state.sides.A, move)
        : Corpus.estimateDamage(state.sides.A, state.sides.B, move),
      willOpponentShield: action => state.sides.B.shields > 0 && fixture.options?.baiting === "always",
      hasGuaranteedEffect: action => Number(action.move?.buffApplyChance || 0) >= 1
    }
  });
  const action = decision?.action || {};
  return {
    actionType: normalizeSimulatorType(action.type),
    moveId: action.moveId || action.move?.id || action.move?.moveId || null,
    shield: action.type === "shield" ? true : action.type === "no_shield" ? false : null,
    wait: action.type === "wait",
    principleIds: decision?.principlesTriggered || decision?.principleIds || [],
    sourceBranch: decision?.principleResult?.evidence?.sourceBranch || null,
    intent: decision?.principleResult?.intent || null,
    finalAuthority: decision?.finalAuthority || null,
    fallbackUsed: decision?.fallbackUsed === true,
    explanation: decision?.explanation || null,
    selectedPrinciple: decision?.principleResult ? {
      resolved: decision.principleResult.resolved,
      category: decision.principleResult.category,
      intent: decision.principleResult.intent,
      principleIds: decision.principleResult.principleIds || [],
      evidence: compactEvidence(decision.principleResult.evidence)
    } : null,
    chosenCandidate: compactCandidate(decision?.chosenCandidate),
    topCandidates: (decision?.candidates || []).slice(0, 5).map(compactCandidate),
    rawAction: action
  };
}

function compactCandidate(candidate) {
  if (!candidate) return null;
  return {
    action: candidate.action ? {
      type: normalizeSimulatorType(candidate.action.type),
      moveId: candidate.action.moveId || candidate.action.move?.id || candidate.action.move?.moveId || null
    } : null,
    tacticalScore: candidate.tacticalScore,
    continuationScore: candidate.continuationScore,
    continuationPenalty: candidate.continuationPenalty,
    confidence: candidate.confidence,
    principleIds: candidate.principleIds || [],
    reasonCodes: candidate.reasonCodes || [],
    evidence: compactEvidence(candidate.evidence)
  };
}

function compactEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") return evidence || null;
  return JSON.parse(JSON.stringify(evidence, (_key, value) => {
    if (typeof value === "function") return "[function]";
    if (Array.isArray(value) && value.length > 10) return value.slice(0, 10).concat([`...${value.length - 10} more`]);
    return value;
  }));
}

function normalizeSimulatorType(type) {
  if (type === "charged" || type === "charged_move") return "charged_move";
  if (type === "fast" || type === "fast_move") return "fast_move";
  if (type === "shield") return "shield";
  if (type === "no_shield") return "no_shield";
  if (type === "wait") return "wait";
  return type || "none";
}

function compareDecisions(pvpokeDecision, simulatorDecision, fixture, translated) {
  if (pvpokeDecision.actionType !== simulatorDecision.actionType) {
    return mismatch("CANONICAL_ACTION_DIFFERENCE", `Action family differs: PvPoke ${pvpokeDecision.actionType}, simulator ${simulatorDecision.actionType}.`);
  }
  if (pvpokeDecision.actionType === "charged_move" && pvpokeDecision.moveId !== simulatorDecision.moveId) {
    return mismatch("MOVE_ID_DIFFERENCE", `Charged Move differs: PvPoke ${pvpokeDecision.moveId}, simulator ${simulatorDecision.moveId}.`);
  }
  if ((pvpokeDecision.actionType === "shield" || pvpokeDecision.actionType === "no_shield") && pvpokeDecision.shield !== simulatorDecision.shield) {
    return mismatch("SHIELD_DIFFERENCE", `Shield decision differs: PvPoke ${pvpokeDecision.shield}, simulator ${simulatorDecision.shield}.`);
  }
  return { pass: true, classification: null, explanation: "First strategic decision matches." };
}

function mismatch(classification, explanation) {
  return { pass: false, classification, explanation };
}

function summarize(results, fixtures, reference) {
  const comparable = results.filter(row => row.comparable);
  const matches = comparable.filter(row => row.pass);
  const failures = comparable.filter(row => !row.pass);
  const unsupported = results.filter(row => !row.comparable);
  return {
    schemaVersion: 1,
    suite: "CANONICAL_DIFFERENTIAL_PARITY",
    reference: "actual PvPoke runtime",
    pinnedRevision: reference.revision,
    generatedAt: new Date().toISOString(),
    loadedPvPokeModules: reference.loadedModules,
    totalStates: results.length,
    comparableStates: comparable.length,
    exactComparableStates: results.filter(row => row.stateEquivalenceStatus === Translator.EXACT).length,
    normalizedEquivalentStates: results.filter(row => row.stateEquivalenceStatus === Translator.NORMALIZED_EQUIVALENT).length,
    unsupportedStates: unsupported.length,
    matches: matches.length,
    failures: failures.length,
    exactFirstDecisionParityPercent: percent(matches.length, comparable.length),
    actionFamilyParityPercent: percent(comparable.filter(row => row.pvpokeDecision?.actionType === row.simulatorDecision?.actionType).length, comparable.length),
    chargedMoveExactParityPercent: percent(comparable.filter(row =>
      row.pvpokeDecision?.actionType !== "charged_move" || row.pvpokeDecision?.moveId === row.simulatorDecision?.moveId
    ).length, comparable.length),
    shieldParityPercent: percent(comparable.filter(row => row.pvpokeDecision?.shield === row.simulatorDecision?.shield).length, comparable.length),
    timingFastParityPercent: percent(comparable.filter(row =>
      !["fast_move", "wait"].includes(row.pvpokeDecision?.actionType) || row.pvpokeDecision?.actionType === row.simulatorDecision?.actionType
    ).length, comparable.length),
    corpusMetadata: corpusMetadata(fixtures, results),
    parityByCategory: groupedParity(comparable, row => row.categories || []),
    parityByMatchup: groupedParity(comparable, row => [row.matchup]),
    parityByPrinciple: groupedParity(comparable, row => row.simulatorPrincipleIds || ["none"]),
    parityByFastDurationPair: groupedParity(comparable, row => [row.fastDurationPair]),
    parityByShieldState: groupedParity(comparable, row => [row.shieldState]),
    parityByCmpState: groupedParity(comparable, row => [row.cmpState]),
    topMismatchCategories: topFailures(failures),
    representativeMismatches: failures.slice(0, 10),
    failures
  };
}

function corpusMetadata(fixtures, results) {
  const unique = values => new Set(values.filter(Boolean)).size;
  return {
    totalStates: fixtures.length,
    uniqueStateHashes: unique(results.map(row => row.canonicalStateHash || row.translation?.canonicalStateHash)),
    uniqueMatchups: unique(fixtures.map(row => row.matchup)),
    uniqueSpecies: unique(fixtures.flatMap(row => [row.state.sides.A.id, row.state.sides.B.id])),
    uniqueMovePairs: unique(fixtures.map(row => [
      row.state.sides.A.fastMove.id,
      ...row.state.sides.A.chargedMoves.map(move => move.id),
      row.state.sides.B.fastMove.id,
      ...row.state.sides.B.chargedMoves.map(move => move.id)
    ].join("|"))),
    uniqueDecisionFamilies: unique(fixtures.map(row => row.family)),
    familyClusters: Object.values(countBy(fixtures.map(row => row.family))).map(row => row)
  };
}

function groupedParity(rows, labelsFor) {
  const groups = new Map();
  for (const row of rows) {
    for (const label of labelsFor(row).filter(Boolean)) {
      const entry = groups.get(label) || { key: label, total: 0, matches: 0, failures: 0, parityPercent: 0 };
      entry.total++;
      if (row.pass) entry.matches++;
      else entry.failures++;
      groups.set(label, entry);
    }
  }
  for (const entry of groups.values()) entry.parityPercent = percent(entry.matches, entry.total);
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function topFailures(failures) {
  return Object.values(countBy(failures.map(row => row.classification || "UNKNOWN")))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function countBy(values) {
  return values.reduce((acc, key) => {
    acc[key] ||= { key, count: 0 };
    acc[key].count++;
    return acc;
  }, {});
}

function compactFixture(fixture) {
  return {
    id: fixture.id,
    matchup: fixture.matchup,
    categories: fixture.categories,
    state: {
      currentTurn: fixture.state.currentTurn,
      A: compactSide(fixture.state.sides.A),
      B: compactSide(fixture.state.sides.B),
      pendingEvents: fixture.state.pendingEvents,
      cmpState: fixture.state.cmpState
    }
  };
}

function compactSide(side) {
  return {
    id: side.id,
    hp: side.hp,
    maxHp: side.maxHp,
    energy: side.energy,
    shields: side.shields,
    attack: side.attack,
    defense: side.defense,
    stages: [side.attackStage, side.defenseStage],
    fastMove: side.fastMove.id,
    chargedMoves: side.chargedMoves.map(move => move.id),
    readyTurn: side.readyTurn
  };
}

function writeReports(report, reportDir = REPORT_DIR) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, "summary.json"), `${JSON.stringify(withoutHugeFailures(report), null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(reportDir, "failures.json"), `${JSON.stringify(report.failures, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(reportDir, "corpus-metadata.json"), `${JSON.stringify(report.corpusMetadata, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(reportDir, "summary.md"), markdownReport(report), "utf8");
}

function withoutHugeFailures(report) {
  const copy = { ...report };
  copy.failures = undefined;
  return copy;
}

function markdownReport(report) {
  const lines = [
    "# PvPoke Differential Parity",
    "",
    "Reference:",
    "actual PvPoke runtime",
    "",
    "Pinned revision:",
    report.pinnedRevision,
    "",
    "This is not manual expected fixture conformance.",
    "",
    `- Total states: ${report.totalStates}`,
    `- Comparable states: ${report.comparableStates}`,
    `- Unsupported states: ${report.unsupportedStates}`,
    `- Matches: ${report.matches}`,
    `- Failures: ${report.failures.length}`,
    `- Exact first-decision parity: ${report.exactFirstDecisionParityPercent}%`,
    `- Charged Move exact parity: ${report.chargedMoveExactParityPercent}%`,
    `- Shield parity: ${report.shieldParityPercent}%`,
    `- Timing/Fast parity: ${report.timingFastParityPercent}%`,
    "",
    "## Loaded PvPoke modules",
    "",
    ...report.loadedPvPokeModules.map(module => `- ${module}`),
    "",
    "## Corpus uniqueness",
    "",
    `- Unique state hashes: ${report.corpusMetadata.uniqueStateHashes}`,
    `- Unique matchups: ${report.corpusMetadata.uniqueMatchups}`,
    `- Unique species: ${report.corpusMetadata.uniqueSpecies}`,
    `- Unique move pairs: ${report.corpusMetadata.uniqueMovePairs}`,
    `- Unique decision families: ${report.corpusMetadata.uniqueDecisionFamilies}`,
    "",
    "## Top mismatch categories",
    ""
  ];
  if (!report.topMismatchCategories.length) lines.push("No mismatches.");
  for (const row of report.topMismatchCategories) lines.push(`- ${row.key}: ${row.count}`);
  lines.push("", "## Parity by category", "", "| Category | Total | Matches | Failures | Parity |", "| --- | ---: | ---: | ---: | ---: |");
  for (const row of report.parityByCategory) {
    lines.push(`| ${row.key} | ${row.total} | ${row.matches} | ${row.failures} | ${row.parityPercent}% |`);
  }
  lines.push("", "## Ten representative mismatches", "");
  if (!report.representativeMismatches.length) lines.push("No mismatches.");
  for (const failure of report.representativeMismatches) {
    lines.push(`- \`${failure.id}\` ${failure.matchup}: ${failure.classification}. PvPoke ${formatDecision(failure.pvpokeDecision)}; simulator ${formatDecision(failure.simulatorDecision)}.`);
  }
  return `${lines.join("\n")}\n`;
}

function formatDecision(decision) {
  if (!decision) return "none";
  return decision.actionType === "charged_move" ? `charged:${decision.moveId}` : decision.actionType;
}

function percent(part, total) {
  return total ? Number(((part / total) * 100).toFixed(2)) : 0;
}

function assertHarnessIndependence() {
  const source = fs.readFileSync(__filename, "utf8");
  if (/fixture\s*\.\s*expected|\[\s*["']expected["']\s*\]/.test(source)) {
    throw new Error("Differential harness must not read fixture expected actions.");
  }
}

if (require.main === module) {
  const writeReportsFlag = process.argv.includes("--write");
  const report = run({ writeReports: writeReportsFlag });
  console.log(JSON.stringify({
    suite: report.suite,
    reference: report.reference,
    pinnedRevision: report.pinnedRevision,
    totalStates: report.totalStates,
    comparableStates: report.comparableStates,
    matches: report.matches,
    failures: report.failures.length,
    exactFirstDecisionParityPercent: report.exactFirstDecisionParityPercent,
    reportDir: writeReportsFlag ? path.relative(ROOT, REPORT_DIR).replace(/\\/g, "/") : null
  }, null, 2));
}

module.exports = {
  FAILURE_CATEGORIES,
  REPORT_DIR,
  run,
  writeReports,
  assertHarnessIndependence
};
