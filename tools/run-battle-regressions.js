"use strict";

const fs = require("fs");
const path = require("path");
const {
  BATTLE_ENGINE_VERSION,
  validateRegressionCase,
  validateTrace
} = require("../src/reliability/battle-reliability");
const {
  buildTacticalPatternSummary
} = require("../src/tactical/tactical-patterns");
const {
  DEFAULT_PROFILE,
  RANK1_PROFILE,
  readWindowGlobal,
  extractLiveWorkerSource,
  createWorkerAdapter,
  normalizeMove,
  normalizePokemon,
  createCombatant,
  statsForIvSpread
} = require("./build-great-league-meta-database");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_FIXTURES = path.join(ROOT, "data", "battle-regressions", "great-league.json");
const DEFAULT_REPORT_ROOT = path.join(ROOT, "reports", "battle-regressions");

function createRuntime(options = {}) {
  const gamemaster = readWindowGlobal("gamemaster-data.js", "PVPOKE_GAMEMASTER");
  const standardMovesets = readWindowGlobal("pvpoke-default-movesets.js", "PVPOKE_DEFAULT_MOVESETS") || {};
  const moveMap = new Map(gamemaster.moves.map(move => [move.moveId, normalizeMove(move)]));
  const pokemonMap = new Map(gamemaster.pokemon
    .filter(pokemon => pokemon && pokemon.speciesId && pokemon.baseStats)
    .map(pokemon => normalizePokemon(pokemon, moveMap))
    .map(pokemon => [pokemon.id, pokemon]));
  return {
    moveMap,
    pokemonMap,
    standardMovesets,
    adapter: createWorkerAdapter(extractLiveWorkerSource(), { strict: options.strict === true })
  };
}

function loadRegressionFixtures(file = DEFAULT_FIXTURES) {
  const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(fixture.cases)) throw new Error(`${file} does not contain a cases array.`);
  const errors = fixture.cases.flatMap(testCase => validateRegressionCase(testCase));
  if (errors.length) throw new Error(`Invalid regression fixtures:\n${errors.join("\n")}`);
  return fixture;
}

function buildCaseConfig(testCase, runtime) {
  const pokemonA = runtime.pokemonMap.get(testCase.pokemonA.id);
  const pokemonB = runtime.pokemonMap.get(testCase.pokemonB.id);
  if (!pokemonA || !pokemonB) throw new Error(`${testCase.id}: Pokemon not found.`);
  const profileA = testCase.pokemonA.ivPreset === "rank1" ? RANK1_PROFILE : DEFAULT_PROFILE;
  const profileB = testCase.pokemonB.ivPreset === "rank1" ? RANK1_PROFILE : DEFAULT_PROFILE;
  const config = {
    left: createCombatant(pokemonA, "A", profileA, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap),
    right: createCombatant(pokemonB, "B", profileB, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap),
    startEnergyA: 0,
    startEnergyB: 0
  };
  applyPokemonFixture(config.left, testCase.pokemonA, runtime.moveMap);
  applyPokemonFixture(config.right, testCase.pokemonB, runtime.moveMap);
  applyPolicy(config.left, testCase.policy);
  applyPolicy(config.right, testCase.policy);
  config.startEnergyA = Number(testCase.pokemonA.energy || 0);
  config.startEnergyB = Number(testCase.pokemonB.energy || 0);
  return config;
}

function applyPokemonFixture(combatant, fixture, moveMap) {
  if (fixture.ivs && combatant.p) {
    const stats = statsForIvSpread(
      combatant.p,
      Number(fixture.ivs.attack || 0),
      Number(fixture.ivs.defense || 0),
      Number(fixture.ivs.hp || 0)
    );
    Object.assign(combatant, {
      level: stats.level,
      cp: stats.cp,
      ivAtk: stats.ivAtk,
      ivDef: stats.ivDef,
      ivHp: stats.ivHp,
      maxHp: stats.hp,
      hp: stats.hp,
      attack: stats.attack,
      defense: stats.defense,
      cpm: stats.attack / Math.max(1, combatant.p.atk + stats.ivAtk)
    });
  }
  const moves = fixture.moves || {};
  if (moves.fast) combatant.fast = cloneMove(moveMap, moves.fast);
  if (Array.isArray(moves.charged)) combatant.charged = moves.charged.map(id => cloneMove(moveMap, id));
  combatant.hp = fixture.hp === "full" || fixture.hp == null
    ? combatant.maxHp
    : Math.max(0, Math.min(combatant.maxHp, Number(fixture.hp)));
  combatant.energy = Math.max(0, Math.min(100, Number(fixture.energy || 0)));
}

function cloneMove(moveMap, id) {
  const move = moveMap.get(id);
  if (!move) throw new Error(`Move not found: ${id}`);
  return JSON.parse(JSON.stringify(move));
}

function applyPolicy(combatant, policy = {}) {
  if (policy.baiting) combatant.baiting = policy.baiting;
  if (policy.shieldMode) combatant.shieldMode = policy.shieldMode;
}

function runRegressionCase(testCase, runtime, sequence = 1, options = {}) {
  const config = buildCaseConfig(testCase, runtime);
  const startedAt = performance.now();
  const result = runtime.adapter.simulate({
    id: sequence,
    source: "battle-regression",
    key: testCase.id,
    signature: BATTLE_ENGINE_VERSION,
    aShields: Number(testCase.pokemonA.shields || 0),
    bShields: Number(testCase.pokemonB.shields || 0),
    includeSwing: false,
    debugChargedDecisions: false,
    trace: options.trace !== false,
    config
  });
  const durationMs = performance.now() - startedAt;
  const tacticalSummary = buildTacticalPatternSummary({
    league: testCase.league,
    analysisMode: "reliability",
    battleResult: result,
    decisionTrace: result.decisionTrace,
    provenance: result.provenance,
    shieldState: `${testCase.pokemonA.shields || 0}-${testCase.pokemonB.shields || 0}`,
    combatants: {
      A: { id: testCase.pokemonA.id, name: config.left.p.name },
      B: { id: testCase.pokemonB.id, name: config.right.p.name }
    }
  }, { profile: "reliability", measurePerformance: true });
  const failures = evaluateExpectations(testCase, result, tacticalSummary);
  return {
    id: testCase.id,
    description: testCase.description,
    category: testCase.category,
    passed: failures.length === 0,
    durationMs: Number(durationMs.toFixed(3)),
    failures,
    actual: summarizeActual(result, tacticalSummary),
    tacticalSummary,
    trace: result.decisionTrace || null,
    result
  };
}

function evaluateExpectations(testCase, result, tacticalSummary = null) {
  const expectations = testCase.expectations || {};
  const failures = [];
  const winner = winnerSide(result);
  const trace = result.decisionTrace;
  if (trace) {
    for (const error of validateTrace(trace)) failures.push(`Invalid decision trace: ${error}`);
  }
  if (expectations.winner && winner !== expectations.winner) {
    failures.push(`Expected winner ${expectations.winner}; actual ${winner}.`);
  }
  if (Array.isArray(expectations.acceptableWinners) && !expectations.acceptableWinners.includes(winner)) {
    failures.push(`Expected winner in ${expectations.acceptableWinners.join(", ")}; actual ${winner}.`);
  }
  if (expectations.selectedMoveAtDecision) {
    const actualMove = selectedMoveAtDecision(trace, expectations.selectedMoveAtDecision);
    if (actualMove !== expectations.selectedMoveAtDecision.moveId) {
      failures.push(`Expected ${expectations.selectedMoveAtDecision.moveId} at ${decisionLabel(expectations.selectedMoveAtDecision)}; actual ${actualMove || "none"}.`);
    }
  }
  if (expectations.forbiddenMoveAtDecision) {
    const actualMove = selectedMoveAtDecision(trace, expectations.forbiddenMoveAtDecision);
    if (actualMove === expectations.forbiddenMoveAtDecision.moveId) {
      failures.push(`Forbidden move ${actualMove} selected at ${decisionLabel(expectations.forbiddenMoveAtDecision)}.`);
    }
  }
  if (expectations.selectedShieldAtDecision) {
    const actualAction = selectedShieldAtDecision(trace, expectations.selectedShieldAtDecision);
    if (actualAction !== expectations.selectedShieldAtDecision.action) {
      failures.push(`Expected ${expectations.selectedShieldAtDecision.action} at ${shieldDecisionLabel(expectations.selectedShieldAtDecision)}; actual ${actualAction || "none"}.`);
    }
  }
  const reasonCodes = new Set((trace?.decisions || []).map(decision => decision.reasonCode));
  for (const code of expectations.requiredReasonCodes || []) {
    if (!reasonCodes.has(code)) failures.push(`Missing required reason code ${code}.`);
  }
  for (const code of expectations.forbiddenReasonCodes || []) {
    if (reasonCodes.has(code)) failures.push(`Forbidden reason code ${code} was emitted.`);
  }
  const patterns = new Map((tacticalSummary?.findings || []).map(finding => [finding.patternId, finding]));
  for (const patternId of expectations.requiredPatternIds || []) {
    if (!patterns.has(patternId)) failures.push(`Missing required tactical pattern ${patternId}.`);
  }
  for (const patternId of expectations.forbiddenPatternIds || []) {
    if (patterns.has(patternId)) failures.push(`Forbidden tactical pattern ${patternId} was emitted.`);
  }
  for (const [patternId, minimum] of Object.entries(expectations.minimumPatternConfidence || {})) {
    const finding = patterns.get(patternId);
    if (finding && confidenceRank(finding.confidence?.level) < confidenceRank(minimum)) {
      failures.push(`Tactical pattern ${patternId} confidence ${finding.confidence?.level || "none"} is below ${minimum}.`);
    }
  }
  return failures;
}

function confidenceRank(level) {
  return { low: 1, medium: 2, high: 3 }[level] || 0;
}

function selectedMoveAtDecision(trace, expected) {
  const decisions = (trace?.decisions || []).filter(decision =>
    decision.side === expected.side &&
    ["charged-move-selection", "farm-vs-throw"].includes(decision.decisionType) &&
    decision.chosenCandidate?.moveId
  );
  return decisions[Number(expected.occurrence || 0)]?.chosenCandidate?.moveId || null;
}

function selectedShieldAtDecision(trace, expected) {
  const decisions = (trace?.decisions || []).filter(decision =>
    decision.side === expected.side &&
    decision.decisionType === "shield-decision" &&
    decision.chosenCandidate?.action
  );
  return decisions[Number(expected.occurrence || 0)]?.chosenCandidate?.action || null;
}

function shieldDecisionLabel(expected) {
  return `${expected.side} shield decision ${Number(expected.occurrence || 0) + 1}`;
}

function decisionLabel(expected) {
  return `${expected.side} decision ${Number(expected.occurrence || 0) + 1}`;
}

function winnerSide(result) {
  const edge = Number(result?.details?.winnerEdge || 0);
  return edge > 0 ? "A" : edge < 0 ? "B" : "draw";
}

function summarizeActual(result, tacticalSummary = null) {
  return {
    winner: winnerSide(result),
    score: result.score,
    engineVersion: result.decisionTrace?.engineVersion || BATTLE_ENGINE_VERSION,
    decisionCount: result.decisionTrace?.decisions?.length || 0,
    reasonCodes: [...new Set((result.decisionTrace?.decisions || []).map(decision => decision.reasonCode))],
    tacticalPatternIds: (tacticalSummary?.findings || []).map(finding => finding.patternId)
  };
}

function runRegressionSuite(options = {}) {
  const fixture = loadRegressionFixtures(options.fixturesPath || DEFAULT_FIXTURES);
  const runtime = options.runtime || createRuntime();
  const startedAt = performance.now();
  const cases = fixture.cases.map((testCase, index) => runRegressionCase(testCase, runtime, index + 1, options));
  const summary = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    engineVersion: BATTLE_ENGINE_VERSION,
    fixtureFile: path.relative(ROOT, options.fixturesPath || DEFAULT_FIXTURES).replace(/\\/g, "/"),
    total: cases.length,
    passed: cases.filter(item => item.passed).length,
    failed: cases.filter(item => !item.passed).length,
    durationMs: Number((performance.now() - startedAt).toFixed(3)),
    cases: cases.map(({ trace, result, tacticalSummary, ...item }) => item)
  };
  if (options.writeReports !== false) writeRegressionReports(summary, cases, options.reportRoot || DEFAULT_REPORT_ROOT);
  return { summary, cases };
}

function writeRegressionReports(summary, cases, reportRoot) {
  fs.mkdirSync(path.join(reportRoot, "failures"), { recursive: true });
  fs.writeFileSync(path.join(reportRoot, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(reportRoot, "summary.md"), regressionSummaryMarkdown(summary), "utf8");
  for (const item of cases.filter(testCase => !testCase.passed)) {
    fs.writeFileSync(path.join(reportRoot, "failures", `${item.id}.json`), `${JSON.stringify(item, null, 2)}\n`, "utf8");
  }
}

function regressionSummaryMarkdown(summary) {
  const lines = [
    "# Battle Regression Summary",
    "",
    `- Engine: ${summary.engineVersion}`,
    `- Cases: ${summary.total}`,
    `- Passed: ${summary.passed}`,
    `- Failed: ${summary.failed}`,
    `- Duration: ${summary.durationMs} ms`,
    ""
  ];
  for (const item of summary.cases) {
    lines.push(`- ${item.passed ? "PASS" : "FAIL"} \`${item.id}\`${item.failures.length ? `: ${item.failures.join(" ")}` : ""}`);
  }
  return `${lines.join("\n")}\n`;
}

function printSummary(summary) {
  console.log(`Battle regressions: ${summary.total}`);
  for (const item of summary.cases) {
    console.log(`${item.passed ? "PASS" : "FAIL"} ${item.id}`);
    for (const failure of item.failures) console.log(`  ${failure}`);
  }
  console.log(`${summary.passed} passed, ${summary.failed} failed in ${summary.durationMs}ms.`);
}

if (require.main === module) {
  const output = runRegressionSuite();
  printSummary(output.summary);
  if (output.summary.failed) process.exitCode = 1;
}

module.exports = {
  DEFAULT_FIXTURES,
  DEFAULT_REPORT_ROOT,
  createRuntime,
  loadRegressionFixtures,
  buildCaseConfig,
  runRegressionCase,
  runRegressionSuite,
  evaluateExpectations,
  winnerSide,
  writeRegressionReports
};
