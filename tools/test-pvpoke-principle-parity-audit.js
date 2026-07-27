"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Principles = require("../src/battle/battle-principles");
const Fixtures = require("../data/pvpoke-first-decision-parity-fixtures");

const root = path.resolve(__dirname, "..");
const audit = fs.readFileSync(path.join(root, "docs", "PVPOKE_PRINCIPLE_PARITY.md"), "utf8");
const adaptations = fs.readFileSync(path.join(root, "docs", "PVPOKE_PARITY_ADAPTATIONS.md"), "utf8");
const planner = fs.readFileSync(path.join(root, "src", "battle", "battle-intelligence.js"), "utf8");
const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");

const rows = [...audit.matchAll(/^\| ([A-Z]+-\d{3}) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([A-Z_]+) \|$/gm)];
const documentedIds = rows.map(match => match[1]);
const registryIds = Principles.BATTLE_PRINCIPLES.map(principle => principle.id.match(/^[A-Z]+-\d{3}/)[0]);
const allowedStatuses = new Set([
  "EXACT_PARITY",
  "INTENTIONAL_ADAPTATION",
  "NOT_MIGRATED",
  "PARTIAL_PARITY",
  "MECHANICS_BLOCKED",
  "REPLACED",
  "DISABLED"
]);

assert.equal(rows.length, 43, `Expected 43 audit rows, got ${rows.length}.`);
assert.equal(new Set(documentedIds).size, 43, "Every audit row must have a unique principle ID.");
assert.deepEqual([...documentedIds].sort(), [...registryIds].sort(), "The audit must cover the complete registry.");
assert(rows.every(row => allowedStatuses.has(row[5])), "Every principle needs an allowed parity status.");
assert(rows.every(row => /ActionLogic|Battle|DamageCalculator|canonical|approved/.test(row[2])),
  "Every principle needs a precise source mapping.");
assert(audit.includes(Fixtures.PVPOKE_REVISION), "Audit source revision must match the parity fixtures.");
assert(adaptations.includes(Fixtures.PVPOKE_REVISION), "Adaptation revision must match the parity fixtures.");

const classification = rows.reduce((counts, row) => {
  counts[row[5]] = (counts[row[5]] || 0) + 1;
  return counts;
}, {});
assert.deepEqual(classification, { EXACT_PARITY: 36, INTENTIONAL_ADAPTATION: 7 });

for (const forbidden of [
  "quagsire", "corsola", "aqua_tail", "mud_bomb",
  "melmetal", "cresselia", "super_power", "obstruct", "zap_cannon", "focus_blast"
]) {
  assert(!planner.toLowerCase().includes(forbidden), `Default planner must not contain species/move patch: ${forbidden}.`);
}

assert(planner.includes('PVPOKE_PARITY: "PVPOKE_PARITY"'));
assert(planner.includes("DEFAULT_PLANNER_MODE = PLANNER_MODES.PVPOKE_PARITY"));
assert(html.includes('plannerMode: "PVPOKE_PARITY"'));
assert(!html.includes("battleIntelligenceCandidateEvidence,"));

console.log(JSON.stringify({
  pvpokeRevision: Fixtures.PVPOKE_REVISION,
  principles: rows.length,
  classification,
  defaultMode: "PVPOKE_PARITY",
  speciesSpecificRules: 0,
  activeHybridFallbackOwners: 0
}, null, 2));
