"use strict";

const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");
const Reliability = require("../src/reliability/battle-reliability");

const runtime = R.createRuntime();
const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true, strict: true });
let sequence = 0;
let checked = 0;
let timingComparisons = 0;
let chargedComparisons = 0;
let sampledShields = 0;
let sampledReplies = 0;

function simulate(a, b, shields, mode = "smart", options = {}) {
  const config = G.createBattleConfig(runtime.pokemonMap.get(a), runtime.pokemonMap.get(b),
    G.DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
  config.left.shieldMode = config.right.shieldMode = mode;
  if (options.baiting) config.left.baiting = config.right.baiting = options.baiting;
  const result = adapter.simulate({
    id: ++sequence, key: `${a}-${b}-${shields}-${mode}`, config,
    aShields: shields, bShields: shields, trace: true, debugTimeline: true, includeSwing: false,
    ...options
  });
  assert.deepEqual(Reliability.validateTrace(result.decisionTrace), [], `${a}/${b}: valid action and damage trace.`);
  checked++;
  return result;
}

function comparisons(result) {
  return result.decisionTrace.decisions.flatMap(decision => {
    const evidence = decision.principleResult?.evidence;
    return [
      { kind: "timing", comparison: evidence?.timingComparison },
      { kind: "charged", comparison: evidence?.compact?.postProcessing?.chargedComparison }
    ].filter(item => item.comparison).map(item => ({ ...item, decision }));
  });
}

function inspectResponses(result, mode = "smart") {
  const records = comparisons(result);
  for (const { kind, comparison, decision } of records) {
    if (kind === "timing") timingComparisons++;
    else chargedComparisons++;
    assert(comparison.complete, "Only completed response comparisons may influence a decision.");
    assert(comparison.branchCount > 0 && comparison.branchCount <= 12,
      "The comparison must stay within twelve sampled continuations.");
    assert.equal(comparison.branchCount,
      comparison.alternatives.reduce((sum, branch) => sum + branch.responses.length, 0));
    assert.equal(new Set(comparison.responseIds).size, comparison.responseIds.length);
    assert(comparison.responseIds.includes("policy"), "Retain the configured policy as a comparison anchor.");
    assert(comparison.alternatives.every(branch => branch.complete
      && branch.responses.every(response => response.complete && [0, 1, 2].includes(response.outcome))),
    "Every sampled legal continuation must terminate before selecting an action.");
    for (const branch of comparison.alternatives) {
      assert.equal(JSON.stringify(branch.responses.map(response => response.responseId)),
        JSON.stringify(comparison.responseIds), "Compare the same response scenarios for each action.");
    }
    const chosen = comparison.alternatives.find(branch => branch.id === comparison.id);
    const original = comparison.alternatives.find(branch => branch.id === comparison.originalId);
    assert(chosen && original);
    const policyOutcome = branch => branch.responses.find(response => response.responseId === "policy").outcome;
    assert(policyOutcome(chosen) >= policyOutcome(original), "A robustness tie-break must preserve the policy outcome class.");
    assert.equal(decision.finalAction.type, decision.principleResult.action.type);
    assert.equal(decision.finalAction.moveId, decision.principleResult.action.moveId);
    for (const response of comparison.opponentResponses) {
      if (response.id === "shield" || response.id === "no-shield") sampledShields++;
      if (response.opponentAction) {
        sampledReplies++;
        assert.equal(response.opponentAction.type, "charged_move");
        assert(response.opponentAction.moveId);
      }
      if (mode !== "smart") assert.equal(response.shieldResponse, undefined,
        "Explicit Always/no-first shielding must not receive Smart Shield alternatives.");
    }
    if (mode !== "smart") {
      assert(comparison.alternatives.every(branch => branch.responses.every(response => !response.shieldResponseApplied)),
        "A configured shield policy must not be overridden by a sampled response.");
    }
  }
  return records;
}

const chargedEvents = (result, side = "A") => result.timelineTrace.filter(event => event.kind === "charge" && event.trainer === side);
const ledger = result => JSON.stringify({ finalState: result.decisionTrace.finalState, timeline: result.timelineTrace });

for (const reverse of [false, true]) {
  const pair = reverse ? ["dewgong", "skeledirge"] : ["skeledirge", "dewgong"];
  const side = reverse ? "B" : "A";
  const result = simulate(...pair, 1);
  assert.equal(result.details.outcome, side, "The early Torch Song line must survive orientation changes.");
  assert.equal(chargedEvents(result, side)[0]?.moveId, "TORCH_SONG");
  assert.equal(chargedEvents(result, side)[0]?.start, 15, "Throw before giving Dewgong another complete Fast window.");
  const records = inspectResponses(result);
  const verified = records.find(record => record.kind === "timing" && record.decision.side === side
    && record.decision.turn === 15)?.comparison;
  assert(verified, "Exercise the completed timing comparison, not a coincidental heuristic result.");
  assert.equal(verified.reason, "STANDARD_OUTCOME_IMPROVED",
    "The configured Smart Shield forecast must now see the loss from delaying Torch Song.");
  assert.equal(verified.action.type, "charged_move");
  assert.equal(verified.action.moveId, "TORCH_SONG");
  assert(verified.responseIds.includes("shield") && verified.responseIds.includes("no-shield"));
}

const corsola = simulate("skeledirge", "corsola_galarian", 1);
assert.equal(corsola.details.outcome, "A");
assert(corsola.timelineTrace.some(event => event.kind === "fast" && event.trainer === "A" && event.start === 15),
  "A beneficial self-buff must not become an unconditional immediate-throw rule.");
assert(chargedEvents(corsola)[0].start > 15, "Retain the verified overfarm line against Galarian Corsola.");
assert(inspectResponses(corsola).some(record => record.kind === "timing" && record.decision.turn === 19
  && record.comparison.actionChanged && record.comparison.action.type === "fast_move"),
"Exercise a completed comparison which deliberately selects another Fast.");

for (const reverse of [false, true]) {
  const pair = reverse ? ["clodsire", "skeledirge"] : ["skeledirge", "clodsire"];
  const side = reverse ? "B" : "A";
  const result = simulate(...pair, 1);
  assert.equal(result.details.outcome, side, "Smart Shield forecasts must preserve the winning overfarm line against Clodsire.");
  assert(result.timelineTrace.some(event => event.kind === "fast" && event.trainer === side && event.start === 15));
  assert(chargedEvents(result, side)[0].start > 15);
  assert(inspectResponses(result).some(record => record.kind === "timing" && record.decision.side === side
    && record.decision.turn === 15 && record.comparison.actionChanged
    && record.comparison.action.type === "fast_move" && record.comparison.reason === "STANDARD_OUTCOME_IMPROVED"),
  "The configured Smart Shield forecast must identify the useful extra Fast, not merely retain a heuristic choice.");
}

const cradily = simulate("cradily", "corsola_galarian", 2);
assert.equal(cradily.details.outcome, "A", "Preserve the Smart Shield line outside the self-buff timing scope.");
assert.equal(chargedEvents(cradily)[0]?.moveId, "GRASS_KNOT");
assert.equal(chargedEvents(cradily)[0]?.start, 15);
assert(!inspectResponses(cradily).some(record => record.kind === "timing"),
  "Having an opponent-debuff move in the moveset must not activate the self-buff timing search.");

for (const opponent of ["kingdra", "kingdra_shadow"]) {
  for (const shields of [1, 2]) {
    const result = simulate("florges", opponent, shields);
    assert.equal(result.details.outcome, "A", "Preserve the original Florges Smart Shield correction.");
    const moves = chargedEvents(result).map(event => event.moveId);
    assert(moves.includes("MOONBLAST"), "Do not replace the closing threat with repeated Chilling Water.");
    if (shields === 1 || opponent === "kingdra") assert.equal(moves[0], "MOONBLAST");
    inspectResponses(result);
  }
}

for (const mode of ["smart", "always", "no-first"]) {
  const result = simulate("talonflame", "dewgong", 1, mode);
  assert(inspectResponses(result, mode).some(record => record.kind === "charged"),
    "Charged move-order comparisons must use the response sampler too.");
  if (mode !== "smart") {
    const timing = simulate("skeledirge", "dewgong", 1, mode);
    assert(inspectResponses(timing, mode).some(record => record.kind === "timing"),
      "Verify explicit shield policies through a real timing comparison.");
  }
}

const baitOff = simulate("skeledirge", "dewgong", 1, "smart", { baiting: "off" });
for (const { decision, comparison } of inspectResponses(baitOff)) {
  if (decision.side !== "A") continue;
  for (const response of comparison.opponentResponses.filter(response => response.opponentAction)) {
    assert.equal(response.opponentAction.moveId, "DRILL_RUN", "Bait-off may sample the strongest legal reply, not a weak bait.");
  }
}

const baseline = simulate("skeledirge", "dewgong", 1);
for (const options of [{ counterfactuals: true }, { includeSwing: true }, { continuationMode: "flip-analysis" }, {}]) {
  assert.equal(ledger(simulate("skeledirge", "dewgong", 1, "smart", options)), ledger(baseline),
    "Diagnostics, swing analysis and a reused worker must not change the visible battle.");
}

// Observe real worker evaluations, including cache reuse across comparison
// entry points. The probe also exercises a legal registration canceled by CMP.
const instrumentedSource = G.extractLiveWorkerSource() + `
  const timingAuditOriginalContinuation = simulateCanonicalActionContinuation;
  simulateCanonicalActionContinuation = function(attacker, action, response) {
    const audit = globalThis.__strategicTimingAudit;
    const frame = { side: attacker.trainer, turn: battleTurns[attacker.trainer], shieldCalls: 0 };
    if (audit) {
      let group = audit.contexts.get(activeAutoTurnContext);
      if (!group) {
        group = { turn: activeAutoTurnContext.currentTurn, calls: { A: 0, B: 0 } };
        audit.contexts.set(activeAutoTurnContext, group);
        audit.groups.push(group);
      }
      group.calls[attacker.trainer]++;
      audit.activeStrategies++;
      audit.frames.push(frame);
    }
    try {
      const result = timingAuditOriginalContinuation(attacker, action, response);
      if (audit) audit.branches.push({ ...frame, ...result });
      return result;
    } finally {
      if (audit) { audit.activeStrategies--; audit.frames.pop(); }
    }
  };
  const timingAuditOriginalShield = simulateShieldDecisionContinuation;
  simulateShieldDecisionContinuation = function(attacker, defender, move, shielded) {
    const audit = globalThis.__strategicTimingAudit;
    const entryDepth = shieldContinuationDepth;
    const withinStrategy = !!audit?.activeStrategies;
    if (withinStrategy) audit.frames[audit.frames.length - 1].shieldCalls++;
    const result = timingAuditOriginalShield(attacker, defender, move, shielded);
    if (audit) audit.shields.push({ entryDepth, withinStrategy, complete: !!result?.complete });
    return result;
  };
  const timingAuditOriginalPrepare = prepareAutomaticBattleAction;
  prepareAutomaticBattleAction = function(attacker, defender) {
    const audit = globalThis.__strategicTimingAudit;
    if (audit?.cmpProbe && !audit.probe && chargedContinuationDepth === 0 && attacker.trainer === "A") {
      audit.probe = { started: true };
      audit.probe = simulateCanonicalActionContinuation(attacker,
        { type: "charged_move", moveId: "DRILL_RUN" },
        { id: "cmp-ko", opponentAction: { type: "charged_move", moveId: "FLY" } });
    }
    return timingAuditOriginalPrepare(attacker, defender);
  };
  const timingAuditOriginalMessage = self.onmessage;
  const timingAuditOriginalPost = self.postMessage;
  self.postMessage = function(message) {
    if (message.result) {
      const audit = globalThis.__strategicTimingAudit;
      message.result.strategicTimingAudit = { groups: audit.groups, shields: audit.shields,
        branches: audit.branches, probe: audit.probe || null };
    }
    return timingAuditOriginalPost.call(self, message);
  };
  self.onmessage = function(event) {
    globalThis.__strategicTimingAudit = { contexts: new WeakMap(), groups: [], shields: [], frames: [],
      branches: [], activeStrategies: 0, cmpProbe: !!event.data.cmpProbe };
    try { return timingAuditOriginalMessage.call(self, event); }
    finally { globalThis.__strategicTimingAudit = null; }
  };
`;
const instrumented = G.createWorkerAdapter(instrumentedSource, { dreStandard: true, strict: true });
let measuredCalls = 0;
let measuredShieldCalls = 0;
let strategicShieldCalls = 0;
for (const [a, b] of [["skeledirge", "dewgong"], ["skeledirge", "corsola_galarian"],
  ["skeledirge", "clodsire"], ["skeledirge", "azumarill"], ["talonflame", "dewgong"]]) {
  const config = G.createBattleConfig(runtime.pokemonMap.get(a), runtime.pokemonMap.get(b),
    G.DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
  config.left.shieldMode = config.right.shieldMode = "smart";
  const payload = { id: ++sequence, key: `measured-${a}-${b}`, config,
    aShields: 1, bShields: 1, trace: true, debugTimeline: true, includeSwing: false };
  const measured = instrumented.simulate(payload);
  const plain = adapter.simulate({ ...payload, id: ++sequence });
  assert.equal(ledger(measured), ledger(plain), "Measuring the real continuation calls must preserve the battle.");
  for (const group of measured.strategicTimingAudit.groups) {
    for (const calls of Object.values(group.calls)) {
      assert(calls <= 12, "Actual continuations across entry points must respect twelve calls per actor/root round.");
      measuredCalls += calls;
    }
  }
  for (const call of measured.strategicTimingAudit.shields) {
    assert.equal(call.entryDepth, 0, "A shield counterfactual must never start inside another shield counterfactual.");
    measuredShieldCalls++;
    if (call.withinStrategy && call.complete) strategicShieldCalls++;
  }
  for (const branch of measured.strategicTimingAudit.branches) {
    assert.equal(branch.shieldCalls, branch.shieldSearches, "The reserved shield budget must equal actual nested rollout calls.");
    assert(branch.shieldCalls <= 16, "Each canonical prediction must respect sixteen nested shield rollouts.");
    if (branch.shieldSearchExhausted) assert.equal(branch.complete, false,
      "An exhausted shield search must never present its fallback outcome as a complete prediction.");
  }
}
assert(measuredCalls >= 12, "Measure actual completed searches rather than only displayed branch counts.");
assert(strategicShieldCalls > 0, "Strategic forecasts must execute completed Smart Shield counterfactuals.");

const cmpConfig = G.createBattleConfig(runtime.pokemonMap.get("dewgong"), runtime.pokemonMap.get("talonflame"),
  G.DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
cmpConfig.left.hp = 30;
cmpConfig.startEnergyA = cmpConfig.startEnergyB = 100;
const cmpPayload = { id: ++sequence, key: "charged-root-cmp-ko", config: cmpConfig,
  aShields: 0, bShields: 0, trace: true, debugTimeline: true, includeSwing: false };
const cmpMeasured = instrumented.simulate({ ...cmpPayload, cmpProbe: true });
const cmpPlain = adapter.simulate({ ...cmpPayload, id: ++sequence });
const probe = cmpMeasured.strategicTimingAudit.probe;
assert(cmpConfig.right.attack > cmpConfig.left.attack, "The opposing registered charge must win CMP.");
assert(probe?.complete, "A legal root charge canceled by a prior CMP KO is a completed losing continuation.");
assert.equal(probe.openingExecuted, false, "Do not claim a canceled charge spent energy or dealt damage.");
assert.equal(probe.moveId, "DRILL_RUN");
assert.equal(probe.opponentAction.moveId, "FLY");
assert.equal(probe.outcome, 0);
assert.equal(probe.remainingHp, 0);
assert.equal(probe.remainingEnergy, 100, "The canceled charge must retain its unspent energy.");
assert.equal(probe.steps, 1, "Resolve the simultaneous root charges through the real engine's single round.");
assert.equal(ledger(cmpMeasured), ledger(cmpPlain), "The CMP probe must restore the untouched outer battle.");

const fallbackAdapter = G.createWorkerAdapter(G.extractLiveWorkerSource()
  + "\ncompareCanonicalStrategyContinuations = function() { return null; };", { dreStandard: true, strict: true });
for (const limit of [0, 2]) {
  // Change only this test worker's bound, leaving the real budget checks and
  // continuation execution intact. The exported production API is immutable.
  const source = instrumentedSource.replace(/const MAX_STRATEGIC_SHIELD_CONTINUATIONS = \d+;/,
    `const MAX_STRATEGIC_SHIELD_CONTINUATIONS = ${limit};`);
  const bounded = G.createWorkerAdapter(source, { dreStandard: true, strict: true });
  const config = G.createBattleConfig(runtime.pokemonMap.get("skeledirge"), runtime.pokemonMap.get("dewgong"),
    G.DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
  config.left.shieldMode = config.right.shieldMode = "smart";
  const payload = { id: ++sequence, key: `exhausted-shield-budget-${limit}`, config,
    aShields: 1, bShields: 1, trace: true, debugTimeline: true, includeSwing: false };
  const result = bounded.simulate(payload);
  const fallback = fallbackAdapter.simulate({ ...payload, id: ++sequence });
  assert.deepEqual(Reliability.validateTrace(result.decisionTrace), [], "Budget exhaustion must preserve a valid live battle.");
  const rootBranches = result.strategicTimingAudit.branches.filter(branch => branch.side === "A" && branch.turn === 15);
  assert(rootBranches.length >= 2 && rootBranches.every(branch => branch.shieldSearchExhausted && !branch.complete),
    "The first timing comparison must reject both alternatives when their Smart forecasts exceed the bound.");
  for (const branch of result.strategicTimingAudit.branches) {
    assert.equal(branch.shieldCalls, branch.shieldSearches);
    assert(branch.shieldSearches <= limit && branch.shieldSearches % 2 === 0,
      "Reserve complete shield/no-shield pairs without exceeding the forced bound.");
    if (branch.shieldSearchExhausted) assert.equal(branch.complete, false);
  }
  const firstAction = battle => battle.timelineTrace.find(event => event.trainer === "A" && event.start === 15);
  assert.equal(firstAction(result)?.kind, "fast");
  assert.equal(firstAction(result)?.moveId, firstAction(fallback)?.moveId,
    "An incomplete root comparison must retain the original configured action.");
  assert(result.strategicTimingAudit.shields.every(call => call.entryDepth === 0),
    "Budget exhaustion must not introduce recursive shield searches.");
  if (limit === 0) assert.equal(ledger(result), ledger(fallback),
    "With no shield-search budget, this fixture must retain the full original-policy battle.");
  assert.equal(ledger(bounded.simulate({ ...payload, id: ++sequence, counterfactuals: true })), ledger(result),
    "Exhausted predictions and diagnostics must not leak mutable budget state across reused-worker runs.");
}

assert(timingComparisons >= 6 && chargedComparisons >= 3, "Exercise both response-comparison entry points.");
assert(sampledShields > 0 && sampledReplies > 0, "Exercise shield and alternative Charged responses.");
console.log(`Strategic timing responses passed: ${checked} battles, ${timingComparisons} timing and ${chargedComparisons} move-order comparisons; ${measuredCalls} strategic and ${measuredShieldCalls} shield calls (${strategicShieldCalls} completed inside strategy), bounds 0/2/16, exhaustion fallback, nesting and CMP cancellation verified.`);
