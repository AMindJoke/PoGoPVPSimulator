"use strict";

const fs = require("fs");
const path = require("path");
const TurnEngine = require("../src/battle/turn-resolution-engine");
const Intelligence = require("../src/battle/battle-intelligence");
const Fixtures = require("../data/pvpoke-first-decision-parity-fixtures");

const ROOT = path.resolve(__dirname, "..");
const REPORT_DIR = path.join(ROOT, "reports", "pvpoke-first-decision-parity");

const FAILURE_CATEGORIES = Object.freeze([
  "MECHANICS_DIFFERENCE",
  "STATE_REPRESENTATION",
  "PRINCIPLE_CONDITION",
  "PRINCIPLE_PRIORITY",
  "PRINCIPLE_IMPLEMENTATION",
  "TIMING",
  "SHIELD_POLICY",
  "BAIT_POLICY",
  "FARM_POLICY",
  "SELF_DEBUFF_POLICY",
  "UNSUPPORTED",
  "INTENTIONAL_ADAPTATION",
  "UNKNOWN"
]);

const CATEGORY_TO_FAILURE = Object.freeze({
  timing: "TIMING",
  shield: "SHIELD_POLICY",
  "no-shield": "SHIELD_POLICY",
  bait: "BAIT_POLICY",
  "bait-enabled": "BAIT_POLICY",
  farm: "FARM_POLICY",
  "farm-down": "FARM_POLICY",
  "self-debuff": "SELF_DEBUFF_POLICY",
  protection: "MECHANICS_DIFFERENCE",
  "pending-fast": "MECHANICS_DIFFERENCE",
  "queued-fast-impact": "MECHANICS_DIFFERENCE",
  availability: "PRINCIPLE_CONDITION",
  compact: "PRINCIPLE_IMPLEMENTATION",
  route: "PRINCIPLE_PRIORITY",
  effects: "PRINCIPLE_IMPLEMENTATION",
  "guaranteed-effect": "PRINCIPLE_IMPLEMENTATION"
});

function buildContext(fixture, state) {
  return {
    callerContext: "parity-harness",
    farmEnergy: fixture.context?.farmEnergy,
    chargedTimingOptimization: fixture.context?.chargedTimingOptimization,
    estimateDamage: action => Number(action.move?.damage || 0),
    estimateFastDamage: side => Number(
      side === "opponent" ? state.sides.B.fastMove?.damage || 0 : state.sides.A.fastMove?.damage || 0
    ),
    estimateOpponentDamage: move => Number(move?.damage || 0),
    compactDamage: (_side, move) => Number(move?.damage || 0),
    willOpponentShield: () => fixture.context?.wouldShield === true,
    hasGuaranteedEffect: action => Number(action.move?.buffApplyChance || 0) >= 1
  };
}

function normalizeAction(decision) {
  const action = decision?.action || {};
  if (action.type === "charged_move") return `charged:${action.moveId || "unknown"}`;
  if (action.type === "fast_move") return "fast";
  if (action.type === "wait") return "wait";
  if (action.type === "shield") return "shield";
  if (action.type === "no_shield") return "no_shield";
  return action.type || "none";
}

function normalizeExpected(expected) {
  if (expected.type === "charged_move") return `charged:${expected.moveId || "unknown"}`;
  if (expected.type === "fast_move") return "fast";
  if (expected.type === "wait") return "wait";
  if (expected.type === "shield") return "shield";
  if (expected.type === "no_shield") return "no_shield";
  return expected.type || "none";
}

function classifyFailure(fixture, decision, expected) {
  const triggered = new Set(decision?.principlesTriggered || decision?.principleIds || []);
  if (expected?.principleId && !triggered.has(expected.principleId)) {
    for (const category of fixture.categories || []) {
      if (CATEGORY_TO_FAILURE[category]) return CATEGORY_TO_FAILURE[category];
    }
    return "PRINCIPLE_IMPLEMENTATION";
  }
  if ((fixture.categories || []).includes("timing")) return "TIMING";
  if ((fixture.categories || []).includes("shield")) return "SHIELD_POLICY";
  if ((fixture.categories || []).includes("bait")) return "BAIT_POLICY";
  if ((fixture.categories || []).includes("farm")) return "FARM_POLICY";
  return "PRINCIPLE_PRIORITY";
}

function compactStateForReport(state) {
  return {
    currentTurn: state.currentTurn,
    cmpState: state.cmpState,
    pendingEvents: state.pendingEvents,
    A: state.sides?.A,
    B: state.sides?.B
  };
}

function evaluateActionFixture(fixture) {
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
    context: buildContext(fixture, state)
  });
  const expectedDecision = normalizeExpected(fixture.expected);
  const actualDecision = normalizeAction(decision);
  const principleMatch = fixture.expected.principleId
    ? (decision.principlesTriggered || []).includes(fixture.expected.principleId)
    : true;
  const intentMatch = fixture.expected.intent
    ? decision.principleResult?.intent === fixture.expected.intent
    : true;
  const pass = expectedDecision === actualDecision
    && principleMatch
    && intentMatch
    && decision.finalAuthority === "PRINCIPLE_ENGINE"
    && decision.fallbackUsed === false;
  return {
    id: fixture.id,
    family: fixture.family,
    kind: "action",
    categories: fixture.categories || [],
    source: fixture.source,
    pvpoke: {
      decision: expectedDecision,
      principleId: fixture.expected.principleId,
      intent: fixture.expected.intent || null,
      source: fixture.source
    },
    simulator: {
      decision: actualDecision,
      principleIds: decision.principlesTriggered || [],
      intent: decision.principleResult?.intent || null,
      finalAuthority: decision.finalAuthority,
      fallbackUsed: decision.fallbackUsed
    },
    pass,
    failureCategory: pass ? null : classifyFailure(fixture, decision, fixture.expected),
    state: pass ? null : compactStateForReport(fixture.state),
    why: pass ? null : explainFailure(fixture, expectedDecision, actualDecision, decision)
  };
}

function evaluateShieldFixture(fixture) {
  const decision = Intelligence.selectShieldAction({
    ...fixture.input,
    intelligencePolicy: "FAST",
    callerContext: "parity-harness"
  });
  const expectedDecision = fixture.expected.shield ? "shield" : "no_shield";
  const actualDecision = decision.shield ? "shield" : "no_shield";
  const principleMatch = decision.principleIds.includes(fixture.expected.principleId);
  const pass = expectedDecision === actualDecision
    && principleMatch
    && decision.finalAuthority === "PRINCIPLE_ENGINE";
  return {
    id: fixture.id,
    family: fixture.family,
    kind: "shield",
    categories: fixture.categories || [],
    source: fixture.source,
    pvpoke: {
      decision: expectedDecision,
      principleId: fixture.expected.principleId,
      source: fixture.source
    },
    simulator: {
      decision: actualDecision,
      principleIds: decision.principleIds || [],
      reasonCodes: decision.reasonCodes || [],
      finalAuthority: decision.finalAuthority
    },
    pass,
    failureCategory: pass ? null : classifyFailure(fixture, decision, fixture.expected),
    state: pass ? null : fixture.input,
    why: pass ? null : explainFailure(fixture, expectedDecision, actualDecision, decision)
  };
}

function explainFailure(fixture, expectedDecision, actualDecision, decision) {
  const expectedPrinciple = fixture.expected?.principleId;
  const actualPrinciples = decision?.principlesTriggered || decision?.principleIds || [];
  if (expectedDecision !== actualDecision) {
    return `First decision differs: PvPoke expected ${expectedDecision}, simulator selected ${actualDecision}.`;
  }
  if (expectedPrinciple && !actualPrinciples.includes(expectedPrinciple)) {
    return `Decision matched but principle differed: expected ${expectedPrinciple}, got ${actualPrinciples.join(", ") || "none"}.`;
  }
  if (decision?.fallbackUsed) return "Simulator used fallback where parity requires Principle Engine ownership.";
  return "Parity contract mismatch.";
}

function summarize(results) {
  const failed = results.filter(result => !result.pass);
  const byCategory = new Map();
  const byFamily = new Map();
  const failureCategories = new Map(FAILURE_CATEGORIES.map(category => [category, 0]));
  for (const result of results) {
    for (const category of result.categories) {
      const row = byCategory.get(category) || { category, pass: 0, fail: 0, total: 0, ratePercent: 0 };
      row.total++;
      if (result.pass) row.pass++;
      else row.fail++;
      byCategory.set(category, row);
    }
    const family = byFamily.get(result.family) || { family: result.family, pass: 0, fail: 0, total: 0, ratePercent: 0 };
    family.total++;
    if (result.pass) family.pass++;
    else family.fail++;
    byFamily.set(result.family, family);
    if (!result.pass) failureCategories.set(result.failureCategory || "UNKNOWN", (failureCategories.get(result.failureCategory || "UNKNOWN") || 0) + 1);
  }
  for (const collection of [byCategory, byFamily]) {
    for (const row of collection.values()) row.ratePercent = percent(row.pass, row.total);
  }
  return {
    schemaVersion: 1,
    suite: "RULE_CONFORMANCE",
    reference: "manual expected fixture conformance",
    generatedAt: new Date().toISOString(),
    pvpokeRevision: Fixtures.CANONICAL_REVISION,
    objective: "first-strategic-decision-parity",
    totalStates: results.length,
    actionStates: results.filter(result => result.kind === "action").length,
    shieldStates: results.filter(result => result.kind === "shield").length,
    passed: results.length - failed.length,
    failed: failed.length,
    overallParityPercent: percent(results.length - failed.length, results.length),
    categoryParity: [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category)),
    familyParity: [...byFamily.values()].sort((a, b) => a.family.localeCompare(b.family)),
    topFailureCategories: [...failureCategories.entries()]
      .map(([category, count]) => ({ category, count }))
      .filter(row => row.count > 0)
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
    failures: failed
  };
}

function percent(part, total) {
  return total ? Number(((part / total) * 100).toFixed(2)) : 0;
}

function run(options = {}) {
  const actionFixtures = Fixtures.buildActionFixtures();
  const shieldFixtures = Fixtures.buildShieldFixtures();
  const results = [
    ...actionFixtures.map(evaluateActionFixture),
    ...shieldFixtures.map(evaluateShieldFixture)
  ];
  const report = summarize(results);
  if (options.writeReports) writeReports(report, options.reportDir || REPORT_DIR);
  return report;
}

function writeReports(report, reportDir = REPORT_DIR) {
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, "summary.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(reportDir, "summary.md"), markdownReport(report), "utf8");
}

function markdownReport(report) {
  const lines = [
    "# PvPoke First Decision Parity",
    "",
    "- Suite: `RULE_CONFORMANCE`",
    "- Reference: manual expected fixture conformance",
    "- This is separate from `CANONICAL_DIFFERENTIAL_PARITY`, which executes the actual pinned PvPoke runtime.",
    "",
    `- PvPoke revision: \`${report.pvpokeRevision}\``,
    `- Objective: ${report.objective}`,
    `- Total states: ${report.totalStates}`,
    `- Action states: ${report.actionStates}`,
    `- Shield states: ${report.shieldStates}`,
    `- Overall parity: ${report.overallParityPercent}%`,
    "",
    "## Heatmap",
    "",
    "| Principle / category | Pass | Fail | Parity |",
    "| --- | ---: | ---: | ---: |"
  ];
  for (const row of report.categoryParity) {
    lines.push(`| ${row.category} | ${row.pass} | ${row.fail} | ${row.ratePercent}% |`);
  }
  lines.push("", "## Top failure categories", "");
  if (!report.topFailureCategories.length) lines.push("No failures.");
  for (const row of report.topFailureCategories) lines.push(`- ${row.category}: ${row.count}`);
  lines.push("", "## First failing examples", "");
  if (!report.failures.length) lines.push("No failures.");
  for (const failure of report.failures.slice(0, 20)) {
    lines.push(
      `- \`${failure.id}\` (${failure.failureCategory}): PvPoke ${failure.pvpoke.decision}; simulator ${failure.simulator.decision}. ${failure.why}`
    );
  }
  return `${lines.join("\n")}\n`;
}

if (require.main === module) {
  const writeReports = process.argv.includes("--write");
  const report = run({ writeReports });
  console.log(JSON.stringify({
    pvpokeRevision: report.pvpokeRevision,
    totalStates: report.totalStates,
    actionStates: report.actionStates,
    shieldStates: report.shieldStates,
    overallParityPercent: report.overallParityPercent,
    passed: report.passed,
    failed: report.failed,
    topFailureCategories: report.topFailureCategories,
    reportDir: writeReports ? path.relative(ROOT, REPORT_DIR).replace(/\\/g, "/") : null
  }, null, 2));
}

module.exports = {
  FAILURE_CATEGORIES,
  REPORT_DIR,
  run,
  writeReports
};
