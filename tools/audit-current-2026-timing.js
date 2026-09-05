"use strict";

const fs = require("fs");
const path = require("path");
const { inflateCacheResult } = require("../src/analysis/matchup-inspector");
const { readWindowGlobal, normalizeMove, normalizePokemon } = require("./build-great-league-meta-database");

const ROOT = path.resolve(__dirname, "..");
const SHIELDS = ["0-0", "1-1", "2-2"];
const DEFAULT_OUT = path.join(ROOT, "reports", "current-2026-timing-audit", "differential-summary.json");

function parseArgs(argv) {
  const options = {
    baseline: path.join(ROOT, "reports", "current-2026-timing-audit", "baseline", "great-league-rankings.json"),
    oldCache: path.join(ROOT, "data", "matchup-cache", "great-league", "rank1"),
    newMatchups: path.join(ROOT, "data", "matchups", "great-league"),
    currentRankings: path.join(ROOT, "data", "great-league-rankings.json"),
    out: DEFAULT_OUT
  };
  for (const arg of argv) {
    if (arg.startsWith("--baseline=")) options.baseline = path.resolve(ROOT, arg.slice(11));
    if (arg.startsWith("--old-cache=")) options.oldCache = path.resolve(ROOT, arg.slice(12));
    if (arg.startsWith("--new-matchups=")) options.newMatchups = path.resolve(ROOT, arg.slice(15));
    if (arg.startsWith("--current-rankings=")) options.currentRankings = path.resolve(ROOT, arg.slice(19));
    if (arg.startsWith("--out=")) options.out = path.resolve(ROOT, arg.slice(6));
  }
  return options;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function moveDurations() {
  const gameMaster = readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
  const moves = new Map(gameMaster.moves.map(move => [move.moveId, normalizeMove(move)]));
  return {
    moves,
    pokemon: new Map(gameMaster.pokemon
      .filter(pokemon => pokemon && pokemon.speciesId && pokemon.baseStats)
      .map(pokemon => normalizePokemon(pokemon, moves))
      .map(pokemon => [pokemon.id, pokemon]))
  };
}

function loadOldCells(file) {
  const data = readJson(file);
  const cells = new Map();
  for (const [key, value] of Object.entries(data.cells || {})) {
    const parts = key.split("|");
    const shieldState = parts[parts.length - 2];
    const category = parts[parts.length - 1];
    if (category !== "standard" || !SHIELDS.includes(shieldState)) continue;
    let defenderId = null;
    try {
      defenderId = JSON.parse(parts[0]).id || null;
    } catch (_) {}
    if (!defenderId) continue;
    cells.set(`${defenderId}|${shieldState}`, inflateCacheResult(value));
  }
  return cells;
}

function winnerIdFromNew(row, attackerId) {
  if (row.winnerId) return row.winnerId;
  if (row.winner === "A") return attackerId;
  if (row.winner === "B") return row.opponentId;
  return "tie";
}

function winnerIdFromOld(result) {
  if (!result) return null;
  if (result.winnerId) return result.winnerId;
  if (result.winnerSide === "A") return result.winnerId || null;
  if (result.winnerSide === "B") return result.winnerId || null;
  return "tie";
}

function durationPair(aId, bId, entries, moves) {
  const aMove = entries.get(aId)?.moveset?.fast || null;
  const bMove = entries.get(bId)?.moveset?.fast || null;
  const aTurns = Number(moves.get(aMove)?.turns || 0);
  const bTurns = Number(moves.get(bMove)?.turns || 0);
  const pair = aTurns && bTurns ? `${Math.min(aTurns, bTurns)} vs ${Math.max(aTurns, bTurns)}` : "unknown";
  return { aMove, bMove, aTurns, bTurns, pair };
}

function classifyTiming(aTurns, bTurns) {
  if (!aTurns || !bTurns) return "other";
  if (aTurns === bTurns) return "same-duration";
  return `${Math.min(aTurns, bTurns)}-turn vs ${Math.max(aTurns, bTurns)}-turn`;
}

function classifyFlip(aTurns, bTurns) {
  if (aTurns === bTurns) return "SUSPICIOUS";
  if (aTurns === 5 || bTurns === 5) return "EXPECTED_TIMING_CHANGE";
  return "LIKELY_TIMING_CHANGE";
}

function bucket(delta) {
  const absolute = Math.abs(delta);
  if (absolute <= 2) return "UNCHANGED";
  if (absolute <= 9) return "MINOR";
  if (absolute <= 24) return "MEANINGFUL";
  return "MAJOR";
}

function increment(map, key) {
  map[key] = Number(map[key] || 0) + 1;
}

function keepTop(list, row, direction) {
  list.push(row);
  list.sort((a, b) => direction * (b.delta - a.delta) || a.id.localeCompare(b.id));
  if (list.length > 25) list.length = 25;
}

function run(options = {}) {
  const baseline = readJson(options.baseline);
  const current = readJson(options.currentRankings);
  const entries = new Map((baseline.entries || []).map(entry => [entry.id, entry]));
  const currentEntries = new Map((current.entries || []).map(entry => [entry.id, entry]));
  const { moves } = moveDurations();
  const summary = {
    schemaVersion: 1,
    suite: "CURRENT_2026_TIMING_DIFFERENTIAL",
    generatedAt: new Date().toISOString(),
    baseline: {
      generatedAt: baseline.metadata?.generatedAt || null,
      matrixVersion: baseline.metadata?.matrixVersion || null,
      engineVersion: baseline.metadata?.engineVersion || null,
      gameMasterHash: baseline.metadata?.gameMasterHash || null,
      gitCommitSha: baseline.metadata?.gitCommitSha || null,
      seasonId: baseline.metadata?.seasonId || "current-2026-06-28"
    },
    current: {
      generatedAt: current.metadata?.generatedAt || null,
      matrixVersion: current.metadata?.matrixVersion || null,
      engineVersion: current.metadata?.engineVersion || null,
      gameMasterHash: current.metadata?.gameMasterHash || null,
      seasonId: current.metadata?.seasonId || "current-2026-06-28"
    },
    inputDifferences: [],
    totalSimulations: 0,
    matchedCells: 0,
    missingOldCells: 0,
    missingNewCells: 0,
    distribution: { UNCHANGED: 0, MINOR: 0, MEANINGFUL: 0, MAJOR: 0, WINNER_FLIP: 0 },
    byShieldState: {},
    byTimingPair: {},
    byFastMove: {},
    longFast: { states: 0, changed: 0, meaningful: 0, winnerFlips: 0 },
    winnerFlips: [],
    suspiciousFlips: [],
    suspiciousFlipCount: 0,
    topPositiveChanges: [],
    topNegativeChanges: [],
    rankMovement: { largestRisers: [], largestFallers: [] },
    unavailableTraceFields: ["battleLengthOld", "battleLengthNew", "criticalTurn", "criticalAction", "finalEnergyOld", "finalEnergyNew"]
  };
  const winnerFlipsFile = options.out.replace(/\.json$/i, ".winner-flips.jsonl");
  fs.mkdirSync(path.dirname(winnerFlipsFile), { recursive: true });
  const winnerFlipsFd = fs.openSync(winnerFlipsFile, "w");
  let winnerFlipsBuffer = "";
  const writeWinnerFlip = flip => {
    winnerFlipsBuffer += `${JSON.stringify(flip)}\n`;
    if (winnerFlipsBuffer.length >= 1024 * 1024) {
      fs.writeSync(winnerFlipsFd, winnerFlipsBuffer, "utf8");
      winnerFlipsBuffer = "";
    }
  };
  const allNew = new Set();
  const firstDirectory = path.join(options.newMatchups, SHIELDS[0].replace("-", "v"));
  const attackerFiles = fs.existsSync(firstDirectory)
    ? fs.readdirSync(firstDirectory).filter(item => item.endsWith(".json") && item !== "index.json")
    : [];
  for (const name of attackerFiles) {
    const attackerId = name.slice(0, -5);
    const oldFile = path.join(options.oldCache, `${attackerId}.json`);
    const oldCells = fs.existsSync(oldFile) ? loadOldCells(oldFile) : new Map();
    for (const shieldState of SHIELDS) {
      const file = path.join(options.newMatchups, shieldState.replace("-", "v"), name);
      if (!fs.existsSync(file)) continue;
      const payload = readJson(file);
      for (const row of payload.matchups || []) {
        const id = `${attackerId}>${row.opponentId}|${shieldState}`;
        allNew.add(id);
        summary.totalSimulations++;
        const old = oldCells.get(`${row.opponentId}|${shieldState}`);
        if (!old) {
          summary.missingOldCells++;
          continue;
        }
        summary.matchedCells++;
        const oldWinner = winnerIdFromOld(old);
        const newWinner = winnerIdFromNew(row, attackerId);
        const delta = Number(row.score ?? 500) - Number(old.score ?? 500);
        const absDelta = Math.abs(delta);
        const category = bucket(delta);
        increment(summary.distribution, category);
        increment(summary.byShieldState, shieldState);
        const duration = durationPair(attackerId, row.opponentId, entries, moves);
        const timingClass = classifyTiming(duration.aTurns, duration.bTurns);
        if (!summary.byTimingPair[timingClass]) summary.byTimingPair[timingClass] = { states: 0, changed: 0, winnerFlips: 0 };
        summary.byTimingPair[timingClass].states++;
        if (absDelta > 2) summary.byTimingPair[timingClass].changed++;
        const moveKey = duration.aMove || "unknown";
        if (!summary.byFastMove[moveKey]) summary.byFastMove[moveKey] = { states: 0, changed: 0, winnerFlips: 0 };
        summary.byFastMove[moveKey].states++;
        if (absDelta > 2) summary.byFastMove[moveKey].changed++;
        const longFast = duration.aTurns >= 5 || duration.bTurns >= 5;
        if (longFast) {
          summary.longFast.states++;
          if (absDelta > 2) summary.longFast.changed++;
          if (category === "MEANINGFUL" || category === "MAJOR" || category === "WINNER_FLIP") {
            summary.longFast.meaningful++;
          }
        }
        const winnerFlip = oldWinner !== newWinner && oldWinner !== "tie" && newWinner !== "tie";
        if (winnerFlip) {
          summary.distribution.WINNER_FLIP++;
          if (!summary.byTimingPair[timingClass]) summary.byTimingPair[timingClass] = { states: 0, changed: 0, winnerFlips: 0 };
          summary.byTimingPair[timingClass].winnerFlips++;
          summary.byFastMove[moveKey].winnerFlips++;
          if (longFast) summary.longFast.winnerFlips++;
          const flip = {
            id,
            pokemonA: attackerId,
            pokemonB: row.opponentId,
            shieldState,
            oldScore: Number(old.score ?? 500),
            newScore: Number(row.score ?? 500),
            delta,
            oldWinner,
            newWinner,
            fastMoveA: duration.aMove,
            fastMoveB: duration.bMove,
            fastDurationA: duration.aTurns,
            fastDurationB: duration.bTurns,
            durationPair: duration.pair,
            classification: classifyFlip(duration.aTurns, duration.bTurns),
            chargedMovesUsed: null,
            battleLengthOld: null,
            battleLengthNew: null,
            finalHpOld: { A: old.hpRatioA ?? null, B: old.hpRatioB ?? null },
            finalHpNew: { A: row.remainingHpRatio?.pokemon ?? null, B: row.remainingHpRatio?.opponent ?? null },
            finalEnergyOld: null,
            finalEnergyNew: null,
            criticalTurn: null,
            criticalAction: null
          };
          writeWinnerFlip(flip);
          if (summary.winnerFlips.length < 100) summary.winnerFlips.push(flip);
          if (flip.classification === "SUSPICIOUS") {
            summary.suspiciousFlipCount++;
            if (summary.suspiciousFlips.length < 100) summary.suspiciousFlips.push(flip);
          }
        }
        const compact = {
          id,
          pokemonA: attackerId,
          pokemonB: row.opponentId,
          shieldState,
          oldScore: Number(old.score ?? 500),
          newScore: Number(row.score ?? 500),
          delta,
          oldWinner,
          newWinner,
          durationPair: duration.pair,
          fastMoveA: duration.aMove,
          fastMoveB: duration.bMove
        };
        if (delta > 0) keepTop(summary.topPositiveChanges, compact, 1);
        if (delta < 0) keepTop(summary.topNegativeChanges, compact, -1);
      }
    }
  }
  if (winnerFlipsBuffer) fs.writeSync(winnerFlipsFd, winnerFlipsBuffer, "utf8");
  fs.closeSync(winnerFlipsFd);
  summary.winnerFlipsFile = path.relative(ROOT, winnerFlipsFile).replace(/\\/g, "/");
  summary.winnerFlipsStoredInSummary = summary.winnerFlips.length;
  summary.missingNewCells = Math.max(0, (baseline.metadata?.cells || summary.totalSimulations) - summary.totalSimulations);
  summary.distribution.percentages = Object.fromEntries(Object.entries(summary.distribution).map(([key, value]) => [key, Number((value / Math.max(1, summary.matchedCells) * 100).toFixed(2))]));
  const rankRows = [];
  for (const [id, oldEntry] of entries) {
    const newEntry = currentEntries.get(id);
    if (!newEntry) continue;
    const oldRank = Number(oldEntry.rank || 0);
    const newRank = Number(newEntry.rank || 0);
    rankRows.push({ id, name: newEntry.name || oldEntry.name, oldRank, newRank, movement: oldRank - newRank });
  }
  summary.rankMovement.largestRisers = rankRows.filter(row => row.movement > 0).sort((a, b) => b.movement - a.movement).slice(0, 25);
  summary.rankMovement.largestFallers = rankRows.filter(row => row.movement < 0).sort((a, b) => a.movement - b.movement).slice(0, 25);
  return summary;
}

function writeReport(report, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const report = run(options);
  writeReport(report, options.out);
  console.log(`Current 2026 timing differential: ${report.matchedCells}/${report.totalSimulations} matched cells`);
  console.log(`Winner flips: ${report.distribution.WINNER_FLIP}`);
  console.log(`Suspicious same-duration flips: ${report.suspiciousFlipCount}`);
  console.log(`Report: ${options.out}`);
}

module.exports = { parseArgs, run, writeReport };
