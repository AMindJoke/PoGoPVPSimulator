"use strict";

// Exercise the production 2026 engine, rather than the legacy timing default
// of old offline fixtures. This checks mechanics/contracts, not optimal play.
const fs = require("node:fs");
const path = require("node:path");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");
const Alternatives = require("./audit-planner-alternatives");
const Reliability = require("../src/reliability/battle-reliability");

const OWN = [
  ["empoleon", "METAL_SOUND", ["HYDRO_CANNON", "DRILL_PECK"], [0, 13, 15]],
  ["florges", "FAIRY_WIND", ["MOONBLAST", "CHILLING_WATER"], [6, 13, 14]],
  ["ninetales_shadow", "EMBER", ["WEATHER_BALL_FIRE", "ENERGY_BALL"], [4, 15, 14]],
  ["sableye_shadow", "SHADOW_CLAW", ["FOUL_PLAY", "DRAIN_PUNCH"], [0, 15, 15]],
  ["vigoroth", "SCRATCH", ["BODY_SLAM", "BULLDOZE"], [1, 15, 15]],
  ["altaria", "DRAGON_BREATH", ["MOONBLAST", "FLAMETHROWER"], [4, 12, 13]]
];
const OPPONENTS = ["vigoroth", "sableye_shadow", "florges", "stunfisk", "corviknight", "araquanid"];

function buildCases(runtime) {
  const cases = Alternatives.buildCases(runtime);
  for (const [id, fast, charged, ivs] of OWN) for (const opponent of OPPONENTS) for (const shields of [0, 1, 2]) {
    const config = G.createBattleConfig(runtime.pokemonMap.get(id), runtime.pokemonMap.get(opponent),
      G.DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
    const stats = G.statsForIvSpread(config.left.p, ...ivs);
    Object.assign(config.left, stats, { hp: stats.hp, maxHp: stats.hp,
      fast: runtime.moveMap.get(fast), charged: charged.map(move => runtime.moveMap.get(move)) });
    config.left.shieldMode = config.right.shieldMode = "smart";
    cases.push({ id: `reported-rosters--${id}--${opponent}--${shields}s`, config, shields });
  }
  return cases;
}

function run(options = {}) {
  const runtime = R.createRuntime();
  const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true, strict: true });
  const cases = buildCases(runtime).slice(0, options.limit || Infinity);
  const failures = [];
  let decisions = 0, actions = 0;
  const started = performance.now();
  for (const [index, item] of cases.entries()) {
    const payload = { id: index + 1, key: item.id, config: item.config, aShields: item.shields,
      bShields: item.bShields ?? item.shields, preFastAdvantage: item.preFastAdvantage,
      trace: true, debugTimeline: true, includeSwing: false, source: "production-mechanics-audit" };
    const result = adapter.simulate(payload), trace = result.decisionTrace;
    const errors = Reliability.validateTrace(trace);
    if (trace.intelligenceAudit.legacyFallbackDecisions !== 0 || trace.intelligenceAudit.hybridFallbackDecisions > 0) errors.push("Strategic fallback used.");
    for (const side of ["A", "B"]) {
      const state = trace.finalState[side];
      if (!Number.isFinite(state.hp) || state.hp < 0 || state.hp > state.maxHp) errors.push(`${side}: invalid HP.`);
      if (!Number.isFinite(state.energy) || state.energy < 0 || state.energy > 100) errors.push(`${side}: invalid energy.`);
      if (!Number.isInteger(state.shields) || state.shields < 0 || state.shields > 2) errors.push(`${side}: invalid shields.`);
    }
    const a = trace.finalState.A.hp, b = trace.finalState.B.hp;
    const expected = a > 0 && b === 0 ? "A" : b > 0 && a === 0 ? "B" : a === 0 && b === 0 ? "draw" : null;
    if (!expected) errors.push("Battle did not reach a KO terminal state.");
    if (result.details.outcome !== expected) errors.push("Outcome disagrees with terminal HP.");
    for (const event of result.timelineTrace.filter(event => event.kind === "charge")) {
      const move = runtime.moveMap.get(event.moveId);
      if (move && event.energyBefore < move.energyCost) errors.push(`Unaffordable charge: ${event.moveId}.`);
    }
    if (index < 12) {
      const repeated = adapter.simulate(payload);
      if (JSON.stringify(result.timelineTrace) !== JSON.stringify(repeated.timelineTrace)
        || JSON.stringify(trace.finalState) !== JSON.stringify(repeated.decisionTrace.finalState)) errors.push("Repeated state has different results.");
    }
    if (errors.length) failures.push({ id: item.id, errors });
    decisions += trace.decisions.length;
    actions += trace.actions.length;
  }
  const report = { engineVersion: Reliability.BATTLE_ENGINE_VERSION, timing: "production-2026", cases: cases.length,
    decisions, actions, failures, durationMs: Math.round(performance.now() - started),
    scope: "Trace integrity, legal energy, resource bounds, terminal outcome consistency, determinism. Does not certify optimal strategy.",
    opponentBuilds: "The reported opponent species use default moves and IVs; the user's link did not include the opponent roster." };
  if (options.output) {
    const output = path.resolve(__dirname, "..", options.output);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  }
  return report;
}

if (require.main === module) {
  const output = process.argv.find(arg => arg.startsWith("--output="))?.slice(9);
  const report = run({ output });
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length) process.exitCode = 1;
}
module.exports = { buildCases, run };
