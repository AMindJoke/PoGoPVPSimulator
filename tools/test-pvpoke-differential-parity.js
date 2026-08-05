"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Harness = require("./pvpoke-differential-parity-harness");
const Reference = require("./pvpoke-reference-adapter");

const ROOT = path.resolve(__dirname, "..");

const report = Harness.run({ writeReports: true });

assert.equal(report.reference, "actual PvPoke runtime");
assert.equal(report.pinnedRevision, Reference.PINNED_CANONICAL_REVISION);
assert(report.loadedPvPokeModules.includes("src/js/battle/actions/ActionLogic.js"));
assert(report.loadedPvPokeModules.includes("src/js/battle/DamageCalculator.js"));
assert(report.totalStates >= 500 && report.totalStates <= 1000, "Differential corpus must contain 500-1000 states.");
assert.equal(report.totalStates, report.corpusMetadata.uniqueStateHashes, "Differential corpus states must deduplicate by canonical state hash.");
assert(report.corpusMetadata.uniqueMatchups >= 40, "Differential corpus must cover broad matchups.");
assert(report.corpusMetadata.uniqueSpecies >= 40, "Differential corpus must cover broad species.");
assert(report.comparableStates > 0, "At least one comparable state is required.");
assert(Number.isFinite(report.exactFirstDecisionParityPercent));

const harnessSource = fs.readFileSync(path.join(ROOT, "tools", "pvpoke-differential-parity-harness.js"), "utf8");
assert(!/fixture\s*\.\s*expected|\[\s*["']expected["']\s*\]/.test(harnessSource), "Differential harness must not read fixture.expected.");

const marker = fs.readFileSync(path.join(ROOT, "vendor", "pvpoke", ".pinned-revision"), "utf8").trim();
assert.equal(marker, Reference.PINNED_CANONICAL_REVISION, "Pinned PvPoke revision marker must match the stored baseline/report.");

console.log(JSON.stringify({
  suite: report.suite,
  reference: report.reference,
  pinnedRevision: report.pinnedRevision,
  totalStates: report.totalStates,
  comparableStates: report.comparableStates,
  unsupportedStates: report.unsupportedStates,
  exactFirstDecisionParityPercent: report.exactFirstDecisionParityPercent,
  reportDir: "reports/pvpoke-differential-parity"
}, null, 2));
