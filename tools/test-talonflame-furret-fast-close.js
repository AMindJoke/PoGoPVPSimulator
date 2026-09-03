"use strict";

const assert = require("assert");
const TurnEngine = require("../src/battle/turn-resolution-engine");
const Intelligence = require("../src/battle/battle-intelligence");
const {
  RANK1_PROFILE,
  readWindowGlobal,
  extractLiveWorkerSource,
  createWorkerAdapter,
  normalizeMove,
  normalizePokemon,
  createBattleConfig
} = require("./build-great-league-meta-database");

const gameMaster = readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
const defaultMovesets = readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS") || {};
const moveMap = new Map(gameMaster.moves.map(move => [move.moveId, normalizeMove(move)]));
const pokemonMap = new Map(gameMaster.pokemon
  .filter(pokemon => pokemon?.speciesId && pokemon.baseStats)
  .map(pokemon => normalizePokemon(pokemon, moveMap))
  .map(pokemon => [pokemon.id, pokemon]));
const adapter = createWorkerAdapter(extractLiveWorkerSource());
const clone = value => JSON.parse(JSON.stringify(value));

function fixtureConfig() {
  // Furret is A so the assertion follows the manual line from the reported
  // matchup.  Rank-1 builds are important: default level-50 stats do not
  // reproduce the production regression.
  const config = createBattleConfig(
    pokemonMap.get("furret"),
    pokemonMap.get("talonflame_shadow"),
    RANK1_PROFILE,
    moveMap,
    defaultMovesets,
    pokemonMap
  );
  config.left.fast = clone(moveMap.get("SUCKER_PUNCH"));
  config.left.charged = [clone(moveMap.get("SWIFT")), clone(moveMap.get("TRAILBLAZE"))];
  config.right.fast = clone(moveMap.get("INCINERATE"));
  config.right.charged = [clone(moveMap.get("FLAME_CHARGE")), clone(moveMap.get("FLY"))];
  config.left.shieldMode = "smart";
  config.right.shieldMode = "smart";
  return config;
}

const result = adapter.simulate({
  id: "shadow-talonflame-furret-fast-close",
  key: "shadow-talonflame-furret-fast-close",
  source: "reported-planner-regression",
  aShields: 1,
  bShields: 1,
  includeSwing: false,
  debugTimeline: true,
  trace: true,
  counterfactuals: false,
  config: fixtureConfig()
});

const furretFastStarts = result.timelineTrace
  .filter(event => event.kind === "fast" && event.trainer === "A")
  .map(event => Number(event.start));
const furretLateFastStarts = furretFastStarts.filter(turn => turn >= 23);

assert(result.details.winnerEdge > 0,
  `Furret should win the rank-1 1-1 line by closing with Sucker Punch; score=${result.score}, edge=${result.details.winnerEdge}`);
assert.strictEqual(result.decisionTrace.finalState.A.hp > 0, true,
  "Furret should survive the fast close.");
assert.strictEqual(result.decisionTrace.finalState.B.hp, 0,
  "Shadow Talonflame should faint before starting its next Charged Attack.");
assert.strictEqual(Array.from(furretLateFastStarts.slice(-2)).join(","), "23,25",
  "The planner must preserve both closing Sucker Punches at turns 23 and 25.");

const t23Decision = (result.decisionTrace.decisions || []).find(decision =>
  decision.side === "A"
  && Number(decision.turn) === 23
  && ["charged-timing-selection", "charged-move-selection"].includes(decision.decisionType)
);
assert.strictEqual(t23Decision?.chosenCandidate?.moveId, "SUCKER_PUNCH",
  "At turn 23 the planner must choose the safe Fast close instead of Swift.");
assert.strictEqual(t23Decision?.principleResult?.evidence?.timing?.canCloseWithFast, true,
  "The decision trace must record the safe Fast closure before the opponent threat.");

const t25Decision = (result.decisionTrace.decisions || []).find(decision =>
  decision.side === "A"
  && Number(decision.turn) === 25
  && ["charged-timing-selection", "charged-move-selection"].includes(decision.decisionType)
);
assert(!t25Decision || t25Decision.chosenCandidate?.moveId !== "SWIFT",
  "Once Sucker Punch is lethal, the planner must not force a nonlethal Charged Attack.");

// Control: a pending lethal Fast impact must still take priority over a
// tempting Fast farm.  This prevents the closure exception from becoming a
// blanket "always farm" rule.
const controlState = TurnEngine.createState({
  currentTurn: 5,
  sides: {
    A: {
      id: "control-a",
      hp: 40,
      maxHp: 40,
      energy: 50,
      shields: 0,
      attack: 120,
      fastMove: { id: "CONTROL_FAST_A", turns: 2, energyGain: 8, damage: 10 },
      chargedMoves: [{ id: "CONTROL_CHARGED_A", energyCost: 35, damage: 50 }],
      readyTurn: 5
    },
    B: {
      id: "control-b",
      hp: 100,
      maxHp: 100,
      energy: 0,
      shields: 0,
      attack: 100,
      fastMove: { id: "CONTROL_FAST_B", turns: 3, energyGain: 8, damage: 5 },
      chargedMoves: [{ id: "CONTROL_CHARGED_B", energyCost: 35, damage: 60 }],
      readyTurn: 7
    }
  },
  pendingEvents: [TurnEngine.createFastImpactEvent({
    id: "control-incoming-lethal",
    sourceSide: "B",
    targetSide: "A",
    moveId: "CONTROL_FAST_B",
    damage: 40,
    startTurn: 5,
    duration: 1,
    source: "regression-control"
  })]
});
const controlActions = TurnEngine.getLegalActions(controlState, "A");
const controlDecision = Intelligence.selectAction({
  state: controlState,
  side: "A",
  legalActions: controlActions,
  policy: "FAST",
  context: {
    estimateDamage: action => Number(action.move?.damage || 0),
    estimateFastDamage: side => side === "opponent" ? 5 : 10,
    chargedTimingOptimization: true
  }
});
assert.strictEqual(controlDecision.action.type, "charged_move",
  "A pending lethal Fast must still force a Charged Attack before farming.");

console.log("Shadow Talonflame/Furret fast-close regression passed.");
