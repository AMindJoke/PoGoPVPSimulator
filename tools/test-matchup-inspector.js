"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  analysisFlagsFromScenarios,
  buildFromCacheFiles,
  buildMatchupInspectorData,
  invertResult
} = require("../src/analysis/matchup-inspector");

const ROOT = path.resolve(__dirname, "..");

function readCache(id) {
  const file = path.join(ROOT, "data", "matchup-cache", "great-league", "rank1", `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function fixturePokemon(id, name) {
  return {
    id,
    name,
    moveset: {
      fast: "TEST_FAST",
      charged: ["TEST_CHARGE_1", "TEST_CHARGE_2"]
    }
  };
}

function testOrientationInversion() {
  const result = {
    score: 620,
    winnerSide: "A",
    hpRatioA: .4,
    hpRatioB: 0,
    winnerEdge: 171,
    hpEdge: 32,
    energyEdge: 4,
    shieldEdge: 0,
    readyEdge: 8,
    dangerEdge: -2,
    closingCostEdge: 5,
    farmPressureEdge: 9,
    outpacePressureEdge: 3
  };
  const inverted = invertResult(result);
  assert.equal(inverted.score, 380);
  assert.equal(inverted.winnerSide, "B");
  assert.equal(inverted.hpRatioA, 0);
  assert.equal(inverted.hpRatioB, .4);
  assert.equal(inverted.winnerEdge, -171);
  assert.equal(inverted.hpEdge, -32);
}

function testScenarioMapping() {
  const a = fixturePokemon("malamar", "Malamar");
  const b = fixturePokemon("pangoro", "Pangoro");
  const inspector = buildMatchupInspectorData({
    a,
    b,
    scenarios: [
      { shieldState: "0-0", result: { score: 520, hpRatioA: .1, hpRatioB: 0 } },
      { shieldState: "1-1", result: { score: 480, hpRatioA: 0, hpRatioB: .1 } },
      { shieldState: "2-2", result: { score: 500, hpRatioA: 0, hpRatioB: 0 } }
    ]
  });
  assert.equal(inspector.evenShield.length, 3);
  assert.equal(inspector.evenShield[0].winner, "Malamar");
  assert.equal(inspector.evenShield[1].winner, "Pangoro");
  assert.equal(inspector.evenShield[2].winner, "Draw");
  assert(inspector.analysis.flags.some(flag => flag.id === "shield-dependent"));
}

function testAnalysisFlags() {
  const flags = analysisFlagsFromScenarios([
    { score: 530, winnerSide: "A", closeness: "close" },
    { score: 470, winnerSide: "B", closeness: "close" },
    { score: 650, winnerSide: "A", closeness: "favored" }
  ]);
  assert(flags.some(flag => flag.id === "shield-dependent"));
  assert(flags.some(flag => flag.id === "close-matchup"));
}

function testMissingCacheFallbackModel() {
  const a = fixturePokemon("a", "A");
  const b = fixturePokemon("b", "B");
  const inspector = buildFromCacheFiles({ a, b, aCache: { cells: {} }, bCache: null });
  assert.equal(inspector.evenShield.length, 3);
  assert(inspector.evenShield.every(item => item.source === "missing"));
}

function testRealCacheIfAvailable() {
  const malamar = readCache("malamar");
  const pangoro = readCache("pangoro");
  if (!malamar || !pangoro) return "real cache skipped";
  const inspector = buildFromCacheFiles({
    a: fixturePokemon("malamar", "Malamar"),
    b: fixturePokemon("pangoro", "Pangoro"),
    aCache: malamar,
    bCache: pangoro
  });
  assert.equal(inspector.evenShield.length, 3);
  assert(inspector.evenShield.some(item => item.source.startsWith("precomputed")));
  return "real cache ok";
}

function run() {
  testOrientationInversion();
  testScenarioMapping();
  testAnalysisFlags();
  testMissingCacheFallbackModel();
  const cacheStatus = testRealCacheIfAvailable();

  console.log(`Matchup Inspector tests passed (${cacheStatus}).`);
}

if (require.main === module) {
  run();
}

module.exports = { run };
