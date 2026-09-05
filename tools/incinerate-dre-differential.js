"use strict";

const fs = require("fs");
const path = require("path");
const {
  MATRIX_VERSION,
  RANK1_PROFILE,
  readWindowGlobal,
  extractLiveWorkerSource,
  createWorkerAdapter,
  normalizeMove,
  normalizePokemon,
  createCombatant
} = require("./build-great-league-meta-database");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_TOP = 200;
const DEFAULT_REPORT = path.join(ROOT, "reports", "incinerate-dre-differential", "summary.json");
const SHIELD_STATES = ["0-0", "1-1", "2-2"];

function loadRuntime({ dreStandard = false } = {}) {
  const gameMaster = readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
  const standardMovesets = readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS") || {};
  const moveMap = new Map(gameMaster.moves.map(move => [move.moveId, normalizeMove(move)]));
  const pokemonMap = new Map(gameMaster.pokemon
    .filter(pokemon => pokemon && pokemon.speciesId && pokemon.baseStats)
    .map(pokemon => normalizePokemon(pokemon, moveMap))
    .map(pokemon => [pokemon.id, pokemon]));
  return {
    moveMap,
    pokemonMap,
    standardMovesets,
    adapter: createWorkerAdapter(extractLiveWorkerSource(), { dreStandard })
  };
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function configuredCombatant(entry, trainer, runtime) {
  const pokemon = runtime.pokemonMap.get(entry.id);
  if (!pokemon) throw new Error(`Pokemon not found: ${entry.id}`);
  const combatant = createCombatant(
    pokemon,
    trainer,
    RANK1_PROFILE,
    runtime.moveMap,
    runtime.standardMovesets,
    runtime.pokemonMap
  );
  const moveset = entry.moveset || {};
  if (moveset.fast && runtime.moveMap.has(moveset.fast)) combatant.fast = clone(runtime.moveMap.get(moveset.fast));
  if (Array.isArray(moveset.charged)) {
    const charged = moveset.charged.filter(id => runtime.moveMap.has(id)).map(id => clone(runtime.moveMap.get(id)));
    if (charged.length) combatant.charged = [charged[0], charged[1] || null];
  }
  return combatant;
}

function battleConfig(a, b, runtime) {
  return {
    left: configuredCombatant(a, "A", runtime),
    right: configuredCombatant(b, "B", runtime),
    startEnergyA: 0,
    startEnergyB: 0
  };
}

function simulate(adapter, a, b, shieldState, runtime) {
  const [aShields, bShields] = shieldState.split("-").map(Number);
  const result = adapter.simulate({
    id: 1,
    source: "incinerate-dre-differential",
    key: `${a.id}>${b.id}|${shieldState}`,
    signature: MATRIX_VERSION,
    aShields,
    bShields,
    includeSwing: false,
    debugTimeline: false,
    trace: true,
    config: battleConfig(a, b, runtime)
  });
  const details = result.details || {};
  const actions = result.decisionTrace?.actions || [];
  return {
    winner: details.winnerEdge > 0 ? a.id : details.winnerEdge < 0 ? b.id : "tie",
    hpA: Number(details.aHp || 0),
    hpB: Number(details.bHp || 0),
    energyA: Number(details.aChargeProgress || 0),
    energyB: Number(details.bChargeProgress || 0),
    chargedA: actions.filter(action => action.side === "A" && action.actionType === "charged_move" && action.status === "RESOLVED").length,
    chargedB: actions.filter(action => action.side === "B" && action.actionType === "charged_move" && action.status === "RESOLVED").length,
    score: Number(result.score || 500)
  };
}

function parseArgs(argv) {
  const options = { top: DEFAULT_TOP, report: DEFAULT_REPORT };
  argv.forEach(arg => {
    if (arg.startsWith("--top=")) options.top = Math.max(1, Number(arg.slice(6)) || DEFAULT_TOP);
    if (arg.startsWith("--report=")) options.report = path.resolve(ROOT, arg.slice(9));
  });
  return options;
}

function run(options = {}) {
  const top = Math.max(1, Number(options.top || DEFAULT_TOP));
  const ranking = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "great-league-rankings.json"), "utf8"));
  const pool = (ranking.entries || []).slice(0, top);
  const incinerate = pool.filter(entry => entry.moveset?.fast === "INCINERATE");
  const normalRuntime = loadRuntime();
  const dreRuntime = loadRuntime({ dreStandard: true });
  const rows = [];
  let sequence = 0;
  for (const a of pool) {
    for (const b of pool) {
      if (a.id === b.id) continue;
      if (a.moveset?.fast !== "INCINERATE" && b.moveset?.fast !== "INCINERATE") continue;
      for (const shieldState of SHIELD_STATES) {
        const baseline = simulate(normalRuntime.adapter, a, b, shieldState, normalRuntime);
        const strictDre = simulate(dreRuntime.adapter, a, b, shieldState, dreRuntime);
        const winnerChanged = baseline.winner !== strictDre.winner;
        const chargeChanged = baseline.chargedA !== strictDre.chargedA || baseline.chargedB !== strictDre.chargedB;
        const hpChanged = Math.abs(baseline.hpA - strictDre.hpA) > 0.0001 || Math.abs(baseline.hpB - strictDre.hpB) > 0.0001;
        if (winnerChanged || chargeChanged || hpChanged) {
          rows.push({
            id: `${a.id}>${b.id}|${shieldState}`,
            attacker: a.id,
            defender: b.id,
            shieldState,
            baseline,
            strictDre,
            winnerChanged,
            extraChargedA: strictDre.chargedA - baseline.chargedA,
            extraChargedB: strictDre.chargedB - baseline.chargedB
          });
        }
        sequence++;
      }
    }
  }
  const report = {
    schemaVersion: 1,
    suite: "INCINERATE_DRE_DIFFERENTIAL",
    generatedAt: new Date().toISOString(),
    matrixVersion: MATRIX_VERSION,
    poolSize: pool.length,
    incinerateUsersInPool: incinerate.map(entry => ({ id: entry.id, rank: entry.rank, name: entry.name })),
    simulatedStates: sequence,
    changedStates: rows.length,
    winnerFlips: rows.filter(row => row.winnerChanged).length,
    chargedMoveCountChanges: rows.filter(row => row.extraChargedA !== 0 || row.extraChargedB !== 0).length,
    rows
  };
  return report;
}

function writeReport(report, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const report = run(options);
  writeReport(report, options.report);
  console.log(`Incinerate DRE differential: ${report.simulatedStates} states`);
  console.log(`Changed states: ${report.changedStates}`);
  console.log(`Winner flips: ${report.winnerFlips}`);
  console.log(`Charged-count changes: ${report.chargedMoveCountChanges}`);
  console.log(`Report: ${options.report}`);
}

module.exports = { DEFAULT_TOP, DEFAULT_REPORT, loadRuntime, parseArgs, run, writeReport };
