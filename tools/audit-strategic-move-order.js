"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");
const Mechanics = require("./audit-automatic-battle");
const Alternatives = require("./audit-planner-alternatives");
const Reliability = require("../src/reliability/battle-reliability");

const ROOT = path.resolve(__dirname, "..");

function baselineSource(ref) {
  const readGit = file => execFileSync("git", ["show", `${ref}:${file}`], {
    cwd: ROOT, encoding: "utf8", maxBuffer: 20 * 1024 * 1024
  });
  const html = readGit("PogoPvp.html");
  const intelligenceContext = { module: { exports: {} }, console };
  vm.createContext(intelligenceContext);
  vm.runInContext(readGit("src/battle/battle-intelligence.js"), intelligenceContext);
  // Use identical current data/mechanics dependencies for both versions. Only
  // the page's battle functions and strategic selector come from the reference.
  const context = {
    ROOT, path, vm, console, require, URLSearchParams, setTimeout, clearTimeout,
    fs: { readFileSync: (file, ...args) => path.basename(file) === "PogoPvp.html" ? html : fs.readFileSync(file, ...args) },
    battleReliability: Reliability,
    turnEngine: require("../src/battle/turn-resolution-engine"),
    matchupPlanner: require("../src/battle/matchup-planner"),
    matchupPlannerAdapter: require("../src/battle/matchup-planner-adapter"),
    battleIntelligence: intelligenceContext.module.exports,
    result: null
  };
  vm.createContext(context);
  vm.runInContext(`result = (${G.extractLiveWorkerSource.toString()})();`, context);
  return context.result;
}

function buildCases(runtime) {
  const cases = Mechanics.buildCases(runtime);
  const focus = ["talonflame", "talonflame_shadow", "pidgeot", "staraptor", "braviary",
    "melmetal", "sirfetchd", "dewgong", "cradily", "skeledirge"];
  const opponents = require("../data/great-league-rankings.json").entries
    .map(entry => entry.id).filter(id => runtime.pokemonMap.has(id)).slice(0, 8);
  for (const actor of focus) for (const opponent of opponents) {
    if (actor === opponent) continue;
    for (const reverse of [false, true]) for (const mode of ["smart", "always"]) for (const shields of [0, 1, 2]) {
      const pair = reverse ? [opponent, actor] : [actor, opponent];
      const config = G.createBattleConfig(...pair.map(id => runtime.pokemonMap.get(id)),
        G.DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
      config.left.shieldMode = config.right.shieldMode = mode;
      cases.push({ id: `expanded--${pair.join("--")}--${mode}--${shields}s`, config, shields });
    }
  }
  const seen = new Set();
  return cases.filter(item => {
    const key = JSON.stringify({ config: item.config, aShields: item.shields,
      bShields: item.bShields ?? item.shields, preFastAdvantage: item.preFastAdvantage || null });
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function firstDifference(before, after) {
  const signature = node => JSON.stringify([node?.kind, node?.side, node?.turn, node?.chosen]);
  for (let index = 0; index < Math.max(before.length, after.length); index++) {
    if (signature(before[index]) === signature(after[index])) continue;
    const a = before[index], b = after[index];
    return { index, side: a?.side === b?.side && a?.turn === b?.turn ? a.side : null,
      turn: b?.turn ?? a?.turn, before: a?.chosen, after: b?.chosen };
  }
  return null;
}

function run(options = {}) {
  const ref = options.ref || "HEAD";
  const reference = options.baselineSourceFile ? fs.readFileSync(path.resolve(options.baselineSourceFile), "utf8") : baselineSource(ref);
  const adapters = [reference, G.extractLiveWorkerSource()].map(source =>
    G.createWorkerAdapter(Alternatives.instrument(source), { dreStandard: true, strict: true }));
  const cases = buildCases(R.createRuntime()).slice(0, options.limit || Infinity);
  const durationMs = [0, 0], samples = [[], []], changes = [], failures = [];
  let improved = 0, regressed = 0, unresolvedFlips = 0;
  for (const [index, item] of cases.entries()) {
    const payload = { id: index + 1, key: item.id, config: item.config,
      aShields: item.shields, bShields: item.bShields ?? item.shields, preFastAdvantage: item.preFastAdvantage,
      trace: true, debugTimeline: true, includeSwing: false, source: "strategy-comparison" };
    const results = adapters.map((adapter, side) => {
      const started = performance.now();
      const result = adapter.simulate(payload);
      const elapsed = performance.now() - started;
      durationMs[side] += elapsed;
      samples[side].push(elapsed);
      return result;
    });
    const [before, after] = results;
    const errors = Reliability.validateTrace(after.decisionTrace);
    if (after.decisionTrace.finalState.A.hp > 0 && after.decisionTrace.finalState.B.hp > 0) errors.push("Battle did not terminate.");
    for (const decision of after.decisionTrace.decisions) {
      if (!decision.principleResult?.action) continue;
      if (decision.finalAction?.moveId !== decision.principleResult.action.moveId
        || decision.finalAction?.type !== decision.principleResult.action.type) errors.push("Cached action overrode the current principle decision.");
    }
    if (errors.length) failures.push({ id: item.id, errors });
    if (before.details.outcome === after.details.outcome && before.score === after.score) continue;
    const difference = firstDifference(before.alternativeAudit.nodes, after.alternativeAudit.nodes);
    const flipped = before.details.outcome !== after.details.outcome;
    let classification = "resources-only";
    if (flipped && difference?.side) {
      const rank = result => result.details.outcome === difference.side ? 2 : result.details.outcome === "draw" ? 1 : 0;
      classification = rank(after) > rank(before) ? "improved-for-first-changed-side" : "regressed-for-first-changed-side";
      if (rank(after) > rank(before)) improved++; else regressed++;
    } else if (flipped) {
      classification = "unresolved-outcome-flip";
      unresolvedFlips++;
    }
    changes.push({ id: item.id, before: { winner: before.details.outcome, score: before.score },
      after: { winner: after.details.outcome, score: after.score }, classification, firstDifference: difference });
  }
  const timing = samples.map(values => {
    const sorted = [...values].sort((a, b) => a - b);
    const percentile = fraction => Number(sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]?.toFixed(2) || 0);
    return { medianMs: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), maxMs: percentile(1) };
  });
  return { baselineRef: options.baselineSourceFile ? "local-worker-snapshot"
      : execFileSync("git", ["rev-parse", ref], { cwd: ROOT, encoding: "utf8" }).trim(),
    baselineSourceHash: crypto.createHash("sha256").update(reference).digest("hex"),
    currentEngine: Reliability.BATTLE_ENGINE_VERSION, cases: cases.length,
    improved, regressed, unresolvedFlips, changed: changes.length, durationMs: durationMs.map(Math.round), timing, failures, changes,
    scope: "Identical current data and mechanics dependencies; reference HTML battle functions and strategic selector. Outcome classification follows the first changed decision, not a fixed A/B side. Does not certify optimal play." };
}

if (require.main === module) {
  const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
  const report = run({ ref: option("ref"), baselineSourceFile: option("baseline-source"), limit: Number(option("limit")) || undefined });
  const output = option("output");
  if (output) {
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.failures.length || report.regressed || report.unresolvedFlips) process.exitCode = 1;
}

module.exports = { baselineSource, buildCases, firstDifference, run };
