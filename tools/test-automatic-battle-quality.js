"use strict";

const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");
const Audit = require("./audit-planner-alternatives");
const Reliability = require("../src/reliability/battle-reliability");

const runtime = R.createRuntime();
const source = G.extractLiveWorkerSource();
const canonical = G.createWorkerAdapter(source, { dreStandard: true, strict: true });
const instrumented = G.createWorkerAdapter(Audit.instrument(source), { dreStandard: true, strict: true });
let branches = 0;
const allCases = Audit.buildCases(runtime);
const cases = [...allCases.slice(0, 12), ...allCases.filter(item => item.id === "golden--defense-buff-sableye-empoleon-1s")];
for (const [index, item] of cases.entries()) {
  const payload = { id: index + 1, key: item.id, config: item.config, aShields: item.shields,
    bShields: item.bShields ?? item.shields, trace: true, debugTimeline: true, includeSwing: false };
  const base = instrumented.simulate(payload), plain = canonical.simulate(payload);
  assert.deepEqual(Reliability.validateTrace(base.decisionTrace), [], item.id);
  assert.equal(JSON.stringify(Audit.outcome(base)), JSON.stringify(Audit.outcome(plain)), "Instrumentation must preserve outcomes.");
  assert.equal(JSON.stringify(base.timelineTrace), JSON.stringify(plain.timelineTrace), "Instrumentation must preserve simultaneous decisions.");
  assert.equal(base.decisionTrace.intelligenceAudit.legacyFallbackDecisions, 0);
  const openingFasts = base.timelineTrace.filter(event => event.kind === "fast" && event.start === 0);
  if (openingFasts.length === 2 && openingFasts[0].duration === openingFasts[1].duration) {
    for (const event of openingFasts) assert.equal(event.resolutionTurn, event.start + event.duration - 1,
      "Simultaneous Fast tooltips must show the actual impact turn, not the registration turn.");
  }
  const before = Audit.outcome(base);
  for (const node of base.alternativeAudit.nodes) for (const action of Audit.alternatives(node)) {
    let result;
    try { result = instrumented.simulate({ ...payload, auditTarget: { index: node.index, ...action } }); }
    catch (error) {
      if (String(error.message).includes("Illegal audit alternative")) continue;
      throw error;
    }
    assert(result.alternativeAudit.applied.length, "The alternative must actually be applied.");
    assert.equal(JSON.stringify(result.alternativeAudit.nodes.slice(0, node.index + 1)), JSON.stringify(base.alternativeAudit.nodes.slice(0, node.index + 1)),
      "The branch must preserve the complete prefix and simultaneous opposing choice.");
    const after = Audit.outcome(result);
    assert(Audit.value(after, node.side)[0] <= Audit.value(before, node.side)[0],
      `${item.id}: ${node.side} can improve its result at T${node.turn} with ${JSON.stringify(action)}.`);
    branches++;
  }
}
assert(branches >= 200, "The counterfactual gate must cover a substantial set of legal decisions.");
console.log(`Automatic battle decision regression passed: ${cases.length} cases, ${branches} legal alternatives, no missed winning/drawing continuation.`);
