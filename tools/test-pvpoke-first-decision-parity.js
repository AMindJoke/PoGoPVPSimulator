"use strict";

const assert = require("assert");
const Harness = require("./pvpoke-first-decision-parity-harness");

const report = Harness.run({ writeReports: true });
const categories = new Set(report.categoryParity.map(row => row.category));

for (const category of [
  "battle-start",
  "mid-battle",
  "end-game",
  "energy-lead",
  "hp-lead",
  "shield-difference",
  "cmp-win",
  "cmp-loss",
  "equal-shields",
  "different-fast-durations",
  "bait-enabled",
  "buff",
  "debuff",
  "self-debuff",
  "farm-down",
  "immediate-lethal",
  "forced-throw",
  "long-match",
  "timing",
  "protection",
  "pending-fast",
  "queued-fast-impact",
  "shield",
  "no-shield"
]) {
  assert(categories.has(category), `Parity corpus is missing category ${category}.`);
}

assert(report.totalStates >= 500, `Expected at least 500 states, got ${report.totalStates}.`);
assert(report.totalStates <= 1000, `Expected at most 1000 states, got ${report.totalStates}.`);
assert.equal(report.passed + report.failed, report.totalStates);
assert(Number.isFinite(report.overallParityPercent));

console.log(JSON.stringify({
  pvpokeRevision: report.pvpokeRevision,
  objective: report.objective,
  actionStates: report.actionStates,
  shieldStates: report.shieldStates,
  totalStates: report.totalStates,
  overallParityPercent: report.overallParityPercent,
  passed: report.passed,
  failed: report.failed,
  topFailureCategories: report.topFailureCategories,
  reportDir: "reports/pvpoke-first-decision-parity"
}, null, 2));
