"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {
  DEFAULT_PROFILE, RANK1_PROFILE, extractLiveWorkerSource, createWorkerAdapter, createBattleConfig
} = require("./build-great-league-meta-database");
const { createRuntime, buildCaseConfig } = require("./run-battle-regressions");

const ROOT = path.resolve(__dirname, "..");

function replaceOnce(source, anchor, replacement) {
  if (source.split(anchor).length !== 2) throw new Error(`Audit hook must match exactly once: ${anchor}`);
  return source.replace(anchor, replacement);
}

// Instrument only the offline worker. The normal planner still prepares both
// sides before an intervention, preserving the original simultaneous decision.
function instrument(source) {
  source = replaceOnce(source, "const shielded = shieldDecision.shield;", `
    if (globalThis.__alternativeAudit && chargedContinuationDepth === 0 && defender.shields > 0) {
      const audit = globalThis.__alternativeAudit;
      const node = {
        index: audit.nodes.length, kind: "shield", side: defender.trainer,
        turn: Number(battleTurns[attacker.trainer] || 0), moveId: move.id,
        chosen: { type: shieldDecision.shield ? "shield" : "no_shield" },
        legal: [{ type: "shield" }, { type: "no_shield" }],
        state: traceStateSnapshot(defender, attacker), reason: shieldDecision.reasonCode
      };
      audit.nodes.push(node);
      if (audit.target?.index === node.index) {
        shieldDecision = { ...shieldDecision, shield: audit.target.type === "shield" };
        audit.applied.push({ index: node.index, side: node.side, turn: node.turn, type: audit.target.type });
      }
    }
    const shielded = shieldDecision.shield;`);
  return source + `
    const auditOriginalPrepare = prepareAutomaticBattleAction;
    prepareAutomaticBattleAction = function(attacker, defender) {
      const plan = auditOriginalPrepare(attacker, defender);
      const audit = globalThis.__alternativeAudit;
      if (!audit || chargedContinuationDepth !== 0 || !plan?.action) return plan;
      const legal = legalBattleActions(attacker, Number(battleTurns[attacker.trainer] || 0));
      const normalize = action => ({ type: action.type === "fast" ? "fast_move" : action.type === "charged" ? "charged_move" : action.type, moveId: action.moveId || action.move?.id || null });
      let target = null;
      if (legal.some(action => normalize(action).type === "charged_move")) {
        const node = {
          index: audit.nodes.length, kind: "action", side: attacker.trainer,
          turn: Number(battleTurns[attacker.trainer] || 0),
          chosen: normalize(plan.action), legal: legal.map(normalize),
          state: traceStateSnapshot(attacker, defender),
          fastGain: Number(attacker.fast?.energyGain || 0),
          reason: plan.options?.aiReason || null
        };
        audit.nodes.push(node);
        if (audit.target?.index === node.index) {
          target = audit.target;
          if (target.followMoveId) audit.follow = { side: node.side, moveId: target.followMoveId, remaining: (target.fastCount || 1) - 1 };
        } else if (audit.follow?.side === attacker.trainer) {
          target = audit.follow.remaining > 0 ? { type: "fast_move" } : { type: "charged_move", moveId: audit.follow.moveId };
          if (audit.follow.remaining > 0) audit.follow.remaining--;
          else audit.follow = null;
        }
      }
      if (!target) return plan;
      const action = legal.find(item => normalize(item).type === target.type && (!target.moveId || normalize(item).moveId === target.moveId));
      if (!action) throw new Error("Illegal audit alternative");
      audit.applied.push({ index: audit.nodes.length - 1, side: attacker.trainer, turn: Number(battleTurns[attacker.trainer] || 0), ...normalize(action) });
      return { attacker, defender, action, options: { source: "diagnostic-plan", deferCooldownReset: true } };
    };
    const auditOriginalMessage = self.onmessage;
    const auditOriginalPost = self.postMessage;
    self.postMessage = function(message) {
      if (message.result) message.result.alternativeAudit = globalThis.__alternativeAudit;
      return auditOriginalPost.call(self, message);
    };
    self.onmessage = function(event) {
      globalThis.__alternativeAudit = { target: event.data.auditTarget || null, nodes: [], applied: [] };
      try { return auditOriginalMessage.call(self, event); }
      finally { globalThis.__alternativeAudit = null; }
    };
  `;
}

function outcome(result) {
  const state = result.decisionTrace.finalState;
  return { winner: result.details.outcome, score: result.score, A: state.A, B: state.B };
}

function value(result, side) {
  const other = side === "A" ? "B" : "A";
  const rank = result.winner === side ? 2 : result.winner === other ? 0 : 1;
  return [rank, result[side].hp / result[side].maxHp - result[other].hp / result[other].maxHp];
}

function alternatives(node) {
  if (node.kind === "shield") return [{ type: node.chosen.type === "shield" ? "no_shield" : "shield" }];
  const choices = node.legal.filter(action => action.type !== node.chosen.type || action.moveId !== node.chosen.moveId);
  if (node.chosen.type === "charged_move") {
    const maxFast = node.state.actor.fastMoveTurns === 1 && node.state.opponent.fastMoveTurns === 5 ? 4 : 2;
    for (let fastCount = 1; fastCount <= maxFast; fastCount++) {
      choices.push({ type: "fast_move", followMoveId: node.chosen.moveId, fastCount });
    }
  }
  return choices;
}

function buildCases(runtime, options = {}) {
  const ids = ["furret", "talonflame_shadow", "talonflame", "melmetal", "corsola_galarian", "skeledirge", "ho_oh", "cramorant", "dunsparce", "gastrodon", "azumarill", "feraligatr_shadow", "quagsire_shadow", "clodsire", "jumpluff", "guzzlord", "marowak_alolan_shadow", "dewgong"];
  const pairs = new Map();
  const add = (a, b) => {
    const key = [a, b].sort().join("/");
    if (a !== b && !pairs.has(key) && runtime.pokemonMap.has(a) && runtime.pokemonMap.has(b)) pairs.set(key, [a, b]);
  };
  add("melmetal", "corsola_galarian"); add("furret", "talonflame_shadow"); add("furret", "talonflame");
  for (const a of ids.slice(0, 8)) for (const b of ids) add(a, b);
  const cases = [];
  for (const [a, b] of pairs.values()) {
    for (const shields of [0, 1, 2]) {
      const config = createBattleConfig(runtime.pokemonMap.get(a), runtime.pokemonMap.get(b), DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
      config.left.shieldMode = config.right.shieldMode = "smart";
      cases.push({ id: `${a}--${b}--${shields}s`, config, shields });
    }
  }
  const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, "data/golden-corpus/great-league.json"), "utf8"));
  for (const item of corpus.cases) {
    const config = buildCaseConfig(item, runtime);
    config.left.shieldMode = config.right.shieldMode = "smart";
    cases.push({ id: `golden--${item.id}`, config, shields: item.pokemonA.shields, bShields: item.pokemonB.shields, preFastAdvantage: item.preFastAdvantage || null });
  }
  for (const [a, b] of [["melmetal", "corsola_galarian"], ["furret", "talonflame_shadow"]]) {
    for (const shields of [0, 1, 2]) {
      const config = createBattleConfig(runtime.pokemonMap.get(a), runtime.pokemonMap.get(b), RANK1_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
      config.left.shieldMode = config.right.shieldMode = "smart";
      cases.push({ id: `rank1--${a}--${b}--${shields}s`, config, shields });
    }
  }
  return cases.filter(item => !options.match || item.id.includes(options.match)).slice(0, options.limit || Infinity);
}

function run(options = {}) {
  const runtime = createRuntime();
  let source = extractLiveWorkerSource();
  if (options["source-engine-version"]) {
    if (!/^battle-planner-v\d+$/.test(options["source-engine-version"])) throw new Error("Invalid source engine version");
    source = source.replace(/battle-planner-v\d+/g, options["source-engine-version"]);
  }
  const adapter = createWorkerAdapter(instrument(source), { dreStandard: true });
  const plain = createWorkerAdapter(source, { dreStandard: true });
  const output = path.resolve(ROOT, options.output || "reports/planner-alternatives-20260908");
  fs.mkdirSync(output, { recursive: true });
  const cases = buildCases(runtime, options);
  const fingerprint = crypto.createHash("sha256").update(source).update(fs.readFileSync(path.join(ROOT, "battle-data.js"))).update(JSON.stringify(cases)).digest("hex");
  const checkpoint = path.join(output, "summary.json");
  let report = { startedAt: new Date().toISOString(), fingerprint, status: "running", totalCases: cases.length, cases: [] };
  if (options.resume && fs.existsSync(checkpoint)) {
    report = JSON.parse(fs.readFileSync(checkpoint));
    if (report.fingerprint !== fingerprint) throw new Error("Cannot resume with changed source, data or cases");
    report.status = "running";
  }
  const save = () => {
    report.updatedAt = new Date().toISOString();
    report.completedCases = report.cases.length;
    report.branches = report.cases.reduce((sum, c) => sum + c.branches, 0);
    report.flips = report.cases.reduce((sum, c) => sum + c.findings.filter(f => f.rankGain > 0).length, 0);
    fs.writeFileSync(checkpoint + ".tmp", JSON.stringify(report, null, 2) + "\n");
    fs.renameSync(checkpoint + ".tmp", checkpoint);
  };
  save();
  let sequence = 0;
  for (const testCase of cases) {
    if (report.cases.some(item => item.id === testCase.id)) continue;
    const start = Date.now();
    const payload = { key: testCase.id, config: testCase.config, aShields: testCase.shields, bShields: testCase.bShields ?? testCase.shields, preFastAdvantage: testCase.preFastAdvantage, includeSwing: false, trace: true, debugTimeline: true, source: "planner-alternative-audit" };
    const simulate = (simulator, auditTarget = null) => simulator.simulate({ ...payload, id: ++sequence, auditTarget });
    const baseline = simulate(adapter);
    const baseOutcome = outcome(baseline);
    const reference = simulate(plain);
    if (JSON.stringify(outcome(reference)) !== JSON.stringify(baseOutcome) || JSON.stringify(reference.timelineTrace) !== JSON.stringify(baseline.timelineTrace)) throw new Error(`Instrumentation changed baseline: ${testCase.id}`);
    const swappedConfig = JSON.parse(JSON.stringify(testCase.config));
    [swappedConfig.left, swappedConfig.right] = [swappedConfig.right, swappedConfig.left];
    swappedConfig.left.trainer = "A";
    swappedConfig.right.trainer = "B";
    [swappedConfig.startEnergyA, swappedConfig.startEnergyB] = [swappedConfig.startEnergyB, swappedConfig.startEnergyA];
    const swapped = outcome(plain.simulate({ ...payload, id: ++sequence, config: swappedConfig, aShields: payload.bShields, bShields: payload.aShields,
      preFastAdvantage: payload.preFastAdvantage ? { ...payload.preFastAdvantage, side: payload.preFastAdvantage.side === "A" ? "B" : "A" } : null }));
    const orientationMismatch = JSON.stringify([baseOutcome.A, baseOutcome.B]) !== JSON.stringify([swapped.B, swapped.A]);
    const record = { id: testCase.id, baseline: baseOutcome, nodes: baseline.alternativeAudit.nodes.length, branches: 0, rejected: [], findings: [], orientationMismatch, swapped: orientationMismatch ? swapped : undefined };
    for (const node of baseline.alternativeAudit.nodes) {
      for (const action of alternatives(node)) {
        const target = { index: node.index, ...action };
        let branch;
        try {
          branch = simulate(adapter, target);
        } catch (error) {
          if (!String(error.message).includes("Illegal audit alternative")) throw error;
          record.rejected.push({ target, reason: error.message });
          continue;
        }
        record.branches++;
        if (!branch.alternativeAudit.applied.length) throw new Error(`Intervention not applied: ${testCase.id} / ${node.index}`);
        const prefix = branch.alternativeAudit.nodes.slice(0, node.index + 1);
        if (JSON.stringify(prefix) !== JSON.stringify(baseline.alternativeAudit.nodes.slice(0, node.index + 1))) throw new Error(`Prefix changed before intervention: ${testCase.id} / ${node.index}`);
        const branchOutcome = outcome(branch);
        const before = value(baseOutcome, node.side), after = value(branchOutcome, node.side);
        const rankGain = after[0] - before[0], hpGain = after[1] - before[1];
        if (rankGain > 0 || (rankGain === 0 && hpGain > 0.05)) {
          const finding = { node, target, rankGain, hpGain, outcome: branchOutcome, applied: branch.alternativeAudit.applied };
          record.findings.push(finding);
          const filename = `${testCase.id}--${node.index}--${record.findings.length}.json`;
          fs.writeFileSync(path.join(output, filename), JSON.stringify({ config: testCase.config, payload: { ...payload, config: undefined }, baseline: baseOutcome, finding, baselineTimeline: baseline.timelineTrace, branchTimeline: branch.timelineTrace, baselineDecisions: baseline.decisionTrace.decisions.filter(d => d.turn === node.turn && d.side === node.side) }, null, 2));
        }
      }
    }
    record.durationMs = Date.now() - start;
    report.cases.push(record);
    save();
    console.log(`${report.completedCases}/${cases.length} ${testCase.id}: ${record.branches} alternatives, ${record.findings.filter(f => f.rankGain > 0).length} flips (${record.durationMs}ms)`);
  }
  report.status = "complete";
  save();
  console.log(JSON.stringify({ output, cases: report.completedCases, branches: report.branches, flips: report.flips }));
  return report;
}

if (require.main === module) {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [key, ...value] = arg.replace(/^--/, "").split("="); return [key, value.length ? value.join("=") : true]; }));
  run({ ...args, limit: args.limit ? Number(args.limit) : undefined });
}

module.exports = { instrument, alternatives, outcome, value, buildCases, run };
