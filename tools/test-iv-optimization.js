"use strict";

const assert = require("assert");
const {
  buildEligibleIvCandidates,
  buildIvOptimizationProfiles,
  resolveIvOptimizationProfile
} = require("../src/iv-optimization");

function candidate(overrides = {}) {
  const base = {
    key: "0/15/15",
    ivAtk: 0,
    ivDef: 15,
    ivHp: 15,
    level: 40,
    cp: 1498,
    attack: 110,
    defense: 130,
    hp: 140,
    statProduct: 2002000
  };
  return { ...base, ...overrides };
}

function testCandidateGeneration() {
  let calls = 0;
  const rows = buildEligibleIvCandidates((ivAtk, ivDef, ivHp) => {
    calls++;
    if (ivAtk !== 1 || ivDef !== 2 || ivHp !== 3) return null;
    return candidate({ key: undefined, ivAtk, ivDef, ivHp });
  });
  assert.strictEqual(calls, 4096);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].key, "1/2/3");
}

function testProfileSelectionAndRanks() {
  const balanced = candidate({ key: "0/15/15", statProduct: 2100000, attack: 108, defense: 140, hp: 139 });
  const attack = candidate({ key: "15/0/1", ivAtk: 15, ivDef: 0, ivHp: 1, statProduct: 1700000, attack: 126, defense: 108, hp: 125 });
  const defense = candidate({ key: "0/15/0", ivAtk: 0, ivDef: 15, ivHp: 0, statProduct: 1850000, attack: 107, defense: 147, hp: 126 });
  const result = buildIvOptimizationProfiles([attack, defense, balanced]);
  assert.strictEqual(result.profiles.balanced.key, balanced.key);
  assert.strictEqual(result.profiles.balanced.statProductRank, 1);
  assert.strictEqual(result.profiles.attack.key, attack.key);
  assert.strictEqual(result.profiles.defense.key, defense.key);
  assert.notStrictEqual(result.profiles.attack.statProductRank, 1);
}

function testDeterministicTieBreaking() {
  const attackLowerProduct = candidate({ key: "15/0/0", ivAtk: 15, ivDef: 0, ivHp: 0, attack: 125, defense: 100, hp: 120, statProduct: 1500000 });
  const attackHigherProduct = candidate({ key: "14/4/4", ivAtk: 14, ivDef: 4, ivHp: 4, attack: 125, defense: 112, hp: 128, statProduct: 1792000 });
  const defenseLowerProduct = candidate({ key: "0/15/0", ivAtk: 0, ivDef: 15, ivHp: 0, attack: 104, defense: 145, hp: 120, statProduct: 1800000 });
  const defenseHigherProduct = candidate({ key: "1/14/8", ivAtk: 1, ivDef: 14, ivHp: 8, attack: 106, defense: 145, hp: 130, statProduct: 1998100 });
  const result = buildIvOptimizationProfiles([attackLowerProduct, defenseLowerProduct, attackHigherProduct, defenseHigherProduct]);
  assert.strictEqual(result.profiles.attack.key, attackHigherProduct.key);
  assert.strictEqual(result.profiles.defense.key, defenseHigherProduct.key);
}

function testInvalidCandidatesAndBestBuddy() {
  assert.deepStrictEqual(buildIvOptimizationProfiles([null, { attack: 1 }]).profiles, {
    balanced: null,
    attack: null,
    defense: null
  });
  const bestBuddy = candidate({ level: 51 });
  assert.strictEqual(buildIvOptimizationProfiles([bestBuddy]).profiles.balanced.bestBuddy, true);
}

function testProfileStateTransitions() {
  assert.strictEqual(resolveIvOptimizationProfile("custom", { type: "select", profile: "attack" }), "attack");
  assert.strictEqual(resolveIvOptimizationProfile("attack", { type: "manual-edit" }), "custom");
  assert.strictEqual(resolveIvOptimizationProfile("defense", { type: "select", profile: "unknown" }), "defense");
}

testCandidateGeneration();
testProfileSelectionAndRanks();
testDeterministicTieBreaking();
testInvalidCandidatesAndBestBuddy();
testProfileStateTransitions();

console.log("IV optimization tests passed.");
