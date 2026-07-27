"use strict";

const fs = require("fs");
const path = require("path");
const {
  DEFAULT_PROFILE,
  RANK1_PROFILE,
  readWindowGlobal,
  extractLiveWorkerSource,
  createWorkerAdapter,
  normalizeMove,
  normalizePokemon,
  createBattleConfig
} = require("./build-great-league-meta-database");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(ROOT, "data", "baselines");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "principle-planner-baseline-8e8f2b0.json");
const SCHEMA_VERSION = 1;
const BASELINE_COMMIT = "8e8f2b0efaa04c17847763f0478b54bb6c8571cc";

const gamemaster = readWindowGlobal("gamemaster-data.js", "PVPOKE_GAMEMASTER");
const movesets = readWindowGlobal("pvpoke-default-movesets.js", "PVPOKE_DEFAULT_MOVESETS") || {};
const moveMap = new Map(gamemaster.moves.map(move => [move.moveId, normalizeMove(move)]));
const pokemonMap = new Map(gamemaster.pokemon
  .filter(pokemon => pokemon?.speciesId && pokemon.baseStats)
  .map(pokemon => normalizePokemon(pokemon, moveMap))
  .map(pokemon => [pokemon.id, pokemon]));
const adapter = createWorkerAdapter(extractLiveWorkerSource());

const MATCHUPS = [
  {
    id: "shadow-quagsire-galarian-corsola-default-0s",
    profile: DEFAULT_PROFILE,
    a: "quagsire_shadow",
    b: "corsola_galarian",
    aShields: 0,
    bShields: 0,
    moves: {
      A: { fast: "MUD_SHOT", charged: ["AQUA_TAIL", "MUD_BOMB"] },
      B: { fast: "ASTONISH", charged: ["NIGHT_SHADE", "POWER_GEM"] }
    }
  },
  {
    id: "shadow-quagsire-galarian-corsola-rank1-0s",
    profile: RANK1_PROFILE,
    a: "quagsire_shadow",
    b: "corsola_galarian",
    aShields: 0,
    bShields: 0,
    moves: {
      A: { fast: "MUD_SHOT", charged: ["AQUA_TAIL", "MUD_BOMB"] },
      B: { fast: "ASTONISH", charged: ["NIGHT_SHADE", "POWER_GEM"] }
    }
  },
  {
    id: "shadow-quagsire-galarian-corsola-default-2s",
    profile: DEFAULT_PROFILE,
    a: "quagsire_shadow",
    b: "corsola_galarian",
    aShields: 2,
    bShields: 2,
    moves: {
      A: { fast: "MUD_SHOT", charged: ["AQUA_TAIL", "MUD_BOMB"] },
      B: { fast: "ASTONISH", charged: ["NIGHT_SHADE", "POWER_GEM"] }
    }
  },
  { id: "kingdra-carbink-default-1s", profile: DEFAULT_PROFILE, a: "kingdra", b: "carbink", aShields: 1, bShields: 1 },
  { id: "azumarill-skarmory-default-1s", profile: DEFAULT_PROFILE, a: "azumarill", b: "skarmory", aShields: 1, bShields: 1 },
  { id: "lanturn-talonflame-default-1s", profile: DEFAULT_PROFILE, a: "lanturn", b: "talonflame", aShields: 1, bShields: 1 },
  { id: "medicham-bastiodon-default-1s", profile: DEFAULT_PROFILE, a: "medicham", b: "bastiodon", aShields: 1, bShields: 1 },
  { id: "sableye-shadow-victreebel-default-0s", profile: DEFAULT_PROFILE, a: "sableye", b: "victreebel_shadow", aShields: 0, bShields: 0 },
  { id: "registeel-whiscash-default-2s", profile: DEFAULT_PROFILE, a: "registeel", b: "whiscash", aShields: 2, bShields: 2 },
  { id: "froslass-altaria-default-1s", profile: DEFAULT_PROFILE, a: "froslass", b: "altaria", aShields: 1, bShields: 1 },
  { id: "charjabug-annihilape-default-1s", profile: DEFAULT_PROFILE, a: "charjabug", b: "annihilape", aShields: 1, bShields: 1 },
  { id: "lickitung-clodsire-default-1s", profile: DEFAULT_PROFILE, a: "lickitung", b: "clodsire", aShields: 1, bShields: 1 },
  { id: "mandibuzz-dewgong-default-1s", profile: DEFAULT_PROFILE, a: "mandibuzz", b: "dewgong", aShields: 1, bShields: 1 }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyExplicitMoves(combatant, moves = {}) {
  if (moves.fast) combatant.fast = clone(requiredMove(moves.fast));
  if (Array.isArray(moves.charged)) combatant.charged = moves.charged.map(requiredMove).map(clone);
}

function requiredPokemon(id) {
  const pokemon = pokemonMap.get(id);
  if (!pokemon) throw new Error(`Unknown Pokemon id: ${id}`);
  return pokemon;
}

function requiredMove(id) {
  const move = moveMap.get(id);
  if (!move) throw new Error(`Unknown move id: ${id}`);
  return move;
}

function configFor(matchup) {
  const config = createBattleConfig(
    requiredPokemon(matchup.a),
    requiredPokemon(matchup.b),
    matchup.profile,
    moveMap,
    movesets,
    pokemonMap
  );
  applyExplicitMoves(config.left, matchup.moves?.A);
  applyExplicitMoves(config.right, matchup.moves?.B);
  return config;
}

function timelineAction(event) {
  return {
    turn: Number(event.start || 0),
    side: event.trainer,
    kind: event.kind,
    moveId: event.moveId || event.move?.id || null,
    damage: Number(event.damage || 0),
    energyBefore: Number(event.energyBefore || 0),
    energyAfter: Number(event.energyAfter || 0),
    hpBefore: Number(event.hpBefore || 0),
    hpAfter: Number(event.hpAfter || 0),
    selected: event.actionIntentId || null,
    queued: event.queuedActionId || null,
    resolved: event.resolvedActionId || null
  };
}

function summarizeDecisions(trace = {}) {
  return Array.from(trace.decisions || []).map(decision => ({
    turn: Number(decision.turn || 0),
    side: decision.side || null,
    decisionType: decision.decisionType || null,
    reasonCode: decision.reasonCode || null,
    selectedAction: decision.selectedAction || decision.action || null,
    chosenCandidate: decision.chosenCandidate || null,
    candidateCount: Array.isArray(decision.candidates) ? decision.candidates.length : 0
  }));
}

function simulate(matchup) {
  const config = configFor(matchup);
  const startedAt = Date.now();
  const result = adapter.simulate({
    id: matchup.id,
    key: matchup.id,
    source: "principle-planner-baseline",
    aShields: matchup.aShields,
    bShields: matchup.bShields,
    includeSwing: false,
    debugTimeline: true,
    trace: true,
    counterfactuals: false,
    config
  });
  const runtimeMs = Date.now() - startedAt;
  const details = result.details || {};
  const winner = details.winnerEdge > 0 ? "A" : details.winnerEdge < 0 ? "B" : "tie";
  const timeline = Array.from(result.timelineTrace || []).map(timelineAction);
  const chargedTimeline = timeline.filter(event => event.kind === "charge");
  return {
    id: matchup.id,
    profile: matchup.profile,
    shields: { A: matchup.aShields, B: matchup.bShields },
    pokemon: {
      A: combatantSummary(config.left),
      B: combatantSummary(config.right)
    },
    result: {
      winner,
      winnerId: winner === "A" ? matchup.a : winner === "B" ? matchup.b : null,
      score: Math.round(Number(result.score || 500)),
      winnerEdge: Number(details.winnerEdge || 0),
      finalState: result.decisionTrace?.finalState || null
    },
    runtime: {
      runtimeMs,
      plannerCalls: countDecisions(result.decisionTrace),
      continuationCalls: countContinuationDecisions(result.decisionTrace),
      nodes: countEvaluatedStates(result.decisionTrace),
      cacheHits: countReason(result.decisionTrace, "MEMOIZED_RESULT")
    },
    selectedActions: summarizeDecisions(result.decisionTrace),
    resolvedActions: timeline,
    chargedTimeline
  };
}

function combatantSummary(combatant) {
  return {
    id: combatant.p?.id || null,
    level: combatant.level,
    cp: combatant.cp,
    ivs: [combatant.ivAtk, combatant.ivDef, combatant.ivHp],
    hp: combatant.maxHp,
    attack: combatant.attack,
    defense: combatant.defense,
    fast: combatant.fast?.id || null,
    charged: Array.from(combatant.charged || []).map(move => move?.id || null)
  };
}

function countDecisions(trace = {}) {
  return Array.isArray(trace.decisions) ? trace.decisions.length : 0;
}

function countContinuationDecisions(trace = {}) {
  return Array.from(trace.decisions || []).filter(decision =>
    Array.from(decision.reasonCodes || [decision.reasonCode]).some(reason => String(reason || "").includes("CONTINUATION"))
    || JSON.stringify(decision.chosenCandidate || {}).includes("continuation")
  ).length;
}

function countEvaluatedStates(trace = {}) {
  const text = JSON.stringify(trace.decisions || []);
  const matches = text.match(/"evaluatedStates":\s*(\d+)/g) || [];
  return matches.reduce((sum, item) => sum + Number(item.match(/\d+/)?.[0] || 0), 0);
}

function countReason(trace = {}, reasonCode) {
  return Array.from(trace.decisions || []).filter(decision =>
    Array.from(decision.reasonCodes || [decision.reasonCode]).includes(reasonCode)
  ).length;
}

function main() {
  const results = MATCHUPS.map(simulate);
  const output = {
    schemaVersion: SCHEMA_VERSION,
    baselineCommit: BASELINE_COMMIT,
    generatedAt: new Date().toISOString(),
    source: "before principle planner behavior changes",
    backupBranch: "hybrid-before-principle-planner-rebuild",
    matchups: results
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)} with ${results.length} matchup baselines.`);
}

if (require.main === module) main();

module.exports = { MATCHUPS, simulate, main, OUTPUT_PATH };
