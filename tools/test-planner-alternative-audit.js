"use strict";

const assert = require("assert");
const { createRuntime } = require("./run-battle-regressions");
const { createWorkerAdapter, extractLiveWorkerSource } = require("./build-great-league-meta-database");
const { instrument, buildCases } = require("./audit-planner-alternatives");

const runtime = createRuntime();
const source = extractLiveWorkerSource();
const adapter = createWorkerAdapter(instrument(source), { dreStandard: true });
const reference = createWorkerAdapter(source, { dreStandard: true });
let checked = 0;
for (const testCase of buildCases(runtime, { limit: 9 })) {
  const payload = { id: testCase.id, key: testCase.id, config: testCase.config,
    aShields: testCase.shields, bShields: testCase.shields,
    includeSwing: false, trace: true, debugTimeline: true };
  const baseline = adapter.simulate(payload);
  const uninstrumented = reference.simulate(payload);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(baseline.timelineTrace)), JSON.parse(JSON.stringify(uninstrumented.timelineTrace)));
  for (const node of baseline.alternativeAudit.nodes) {
    const result = adapter.simulate({ ...payload, auditTarget: { index: node.index, ...node.chosen } });
    assert.deepStrictEqual(result.decisionTrace.finalState, baseline.decisionTrace.finalState,
      `${testCase.id}/${node.index}: a no-op intervention must preserve the battle outcome and resources.`);
    assert.strictEqual(result.alternativeAudit.applied.length, 1);
    checked++;
  }
}
console.log(`Alternative audit controls passed: ${checked} no-op interventions and nine worker parity checks.`);
