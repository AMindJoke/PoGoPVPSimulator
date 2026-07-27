"use strict";

const assert = require("assert");
const {
  BATTLE_PRINCIPLES,
  PRINCIPLE_PRIORITY_GROUPS,
  validateBattlePrincipleRegistry
} = require("../src/battle/battle-principles");

const report = validateBattlePrincipleRegistry();
assert.deepStrictEqual(report.errors, []);
assert.strictEqual(report.valid, true);
assert.strictEqual(report.count, 43);
assert.strictEqual(new Set(BATTLE_PRINCIPLES.map(item => item.id)).size, 43);

for (let index = 1; index <= 43; index++) {
  const serial = String(index).padStart(3, "0");
  assert(
    BATTLE_PRINCIPLES.some(item => item.id.includes(serial)),
    `Missing principle serial ${serial}`
  );
}

for (const item of BATTLE_PRINCIPLES) {
  assert(Number.isFinite(item.priority), `${item.id} must have numeric priority`);
  assert(
    Object.values(PRINCIPLE_PRIORITY_GROUPS).includes(item.priority),
    `${item.id} priority must map to a documented priority group`
  );
  assert(
    item.forbiddenSideEffects.includes("MUST_NOT_USE_SPECIES_ID_EXCEPTION"),
    `${item.id} must forbid species-specific exceptions`
  );
}

console.log("Battle principle registry validation passed.");
