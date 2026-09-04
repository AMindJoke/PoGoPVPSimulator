"use strict";

const assert = require("assert");
const TurnEngine = require("../src/battle/turn-resolution-engine");
const Intelligence = require("../src/battle/battle-intelligence");
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

const gameMaster = readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
const defaultMovesets = readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS") || {};
const moveMap = new Map(gameMaster.moves.map(move => [move.moveId, normalizeMove(move)]));
const pokemonMap = new Map(gameMaster.pokemon
  .filter(pokemon => pokemon?.speciesId && pokemon.baseStats)
  .map(pokemon => normalizePokemon(pokemon, moveMap))
  .map(pokemon => [pokemon.id, pokemon]));
const adapter = createWorkerAdapter(extractLiveWorkerSource());
const clone = value => JSON.parse(JSON.stringify(value));

function fixtureConfig(shieldMode = "smart", profile = RANK1_PROFILE) {
  // Furret is A so the assertion follows the manual line from the reported
  // matchup.  Rank-1 builds are important: default level-50 stats do not
  // reproduce the production regression.
  const config = createBattleConfig(
    pokemonMap.get("furret"),
    pokemonMap.get("talonflame_shadow"),
    profile,
    moveMap,
    defaultMovesets,
    pokemonMap
  );
  config.left.fast = clone(moveMap.get("SUCKER_PUNCH"));
  config.left.charged = [clone(moveMap.get("SWIFT")), clone(moveMap.get("TRAILBLAZE"))];
  config.right.fast = clone(moveMap.get("INCINERATE"));
  config.right.charged = [clone(moveMap.get("FLAME_CHARGE")), clone(moveMap.get("FLY"))];
  config.left.shieldMode = shieldMode;
  config.right.shieldMode = shieldMode;
  return config;
}

function simulate(diagnosticPlan = null, shieldMode = "always", profile = RANK1_PROFILE, shields = 1) {
  return adapter.simulate({
    id: "shadow-talonflame-furret-fast-close",
    key: "shadow-talonflame-furret-fast-close",
    source: "reported-planner-regression",
    aShields: shields,
    bShields: shields,
    includeSwing: false,
    debugTimeline: true,
    trace: true,
    counterfactuals: false,
    diagnosticPlan,
    config: fixtureConfig(shieldMode, profile)
  });
}

const result = simulate();
const smartResult = simulate(null, "smart");
const defaultProfileResult = simulate(null, "always", DEFAULT_PROFILE);
const twoShieldResult = simulate(null, "always", DEFAULT_PROFILE, 2);
const straightSwiftResult = simulate({
  steps: [{ side: "A", turn: 14, type: "charged_move", moveId: "SWIFT" }]
}, "always");

const furretFastStarts = result.timelineTrace
  .filter(event => event.kind === "fast" && event.trainer === "A")
  .map(event => Number(event.start));
const furretLateFastStarts = furretFastStarts.filter(turn => turn >= 21);

if (process.argv.includes("--diagnose")) {
  console.log(JSON.stringify({
    score: result.score,
    winnerEdge: result.details.winnerEdge,
    finalState: result.decisionTrace.finalState,
    defaultProfile: {
      score: defaultProfileResult.score,
      winnerEdge: defaultProfileResult.details.winnerEdge,
      finalState: defaultProfileResult.decisionTrace.finalState,
      timeline: defaultProfileResult.timelineTrace.map(event => ({
        side: event.trainer,
        turn: event.start,
        kind: event.kind,
        move: event.moveId,
        hpBefore: event.hpBefore,
        hpAfter: event.hpAfter,
        energyBefore: event.energyBefore,
        energyAfter: event.energyAfter
      })),
      decisions: (defaultProfileResult.decisionTrace.decisions || [])
        .filter(decision => decision.side === "A" && Number(decision.turn) >= 20)
        .map(decision => ({
          turn: decision.turn,
          type: decision.decisionType,
          chosen: decision.chosenCandidate?.action || decision.chosenCandidate?.moveId,
          reasonCode: decision.reasonCode,
          intent: decision.principleResult?.intent,
          timing: decision.principleResult?.evidence?.timing
        }))
    },
    twoShield: {
      score: twoShieldResult.score,
      winnerEdge: twoShieldResult.details.winnerEdge,
      finalState: twoShieldResult.decisionTrace.finalState,
      timeline: twoShieldResult.timelineTrace.map(event => ({
        side: event.trainer,
        turn: event.start,
        duration: event.duration,
        kind: event.kind,
        move: event.moveId,
        hpBefore: event.hpBefore,
        hpAfter: event.hpAfter,
        energyBefore: event.energyBefore,
        energyAfter: event.energyAfter
      })),
      decisions: (twoShieldResult.decisionTrace.decisions || [])
        .filter(decision => decision.side === "A")
        .map(decision => ({
          turn: decision.turn,
          type: decision.decisionType,
          chosen: decision.chosenCandidate?.action || decision.chosenCandidate?.moveId,
          reasonCode: decision.reasonCode,
          intent: decision.principleResult?.intent,
          timing: decision.principleResult?.evidence?.timing,
          survival: decision.principleResult?.evidence?.survival
        }))
    },
    straightSwift: {
      score: straightSwiftResult.score,
      winnerEdge: straightSwiftResult.details.winnerEdge,
      finalState: straightSwiftResult.decisionTrace.finalState,
      timeline: straightSwiftResult.timelineTrace.map(event => ({
        side: event.trainer,
        turn: event.start,
        kind: event.kind,
        move: event.moveId,
        hpBefore: event.hpBefore,
        hpAfter: event.hpAfter,
        energyBefore: event.energyBefore,
        energyAfter: event.energyAfter
      })),
      decisions: (straightSwiftResult.decisionTrace.decisions || [])
        .filter(decision => decision.side === "A" && Number(decision.turn) >= 20)
        .map(decision => ({
          turn: decision.turn,
          type: decision.decisionType,
          chosen: decision.chosenCandidate?.action || decision.chosenCandidate?.moveId,
          reasonCode: decision.reasonCode,
          intent: decision.principleResult?.intent,
          timing: decision.principleResult?.evidence?.timing,
          survival: decision.principleResult?.evidence?.survival,
          forcedThrow: decision.principleResult?.evidence?.forcedThrow
        }))
    },
    timeline: result.timelineTrace.map(event => ({
      side: event.trainer,
      turn: event.start,
      kind: event.kind,
      move: event.moveId,
      hpBefore: event.hpBefore,
      hpAfter: event.hpAfter,
      energyBefore: event.energyBefore,
      energyAfter: event.energyAfter
    })),
    decisions: (result.decisionTrace.decisions || [])
      .filter(decision => decision.side === "A" && Number(decision.turn) >= 14)
      .map(decision => ({
        turn: decision.turn,
        type: decision.decisionType,
        chosen: decision.chosenCandidate?.action || decision.chosenCandidate?.moveId,
        reasonCode: decision.reasonCode,
        intent: decision.principleResult?.intent
      }))
  }, null, 2));
  process.exit(0);
}

assert(result.details.winnerEdge > 0,
  `Furret should win the rank-1 1-1 line straight Swift; score=${result.score}, edge=${result.details.winnerEdge}`);
assert.strictEqual(result.decisionTrace.finalState.A.hp > 0, true,
  "Furret should survive the fast close.");
assert.strictEqual(result.decisionTrace.finalState.B.hp, 0,
  "Shadow Talonflame should faint before starting its next Charged Attack.");
assert.strictEqual(Array.from(furretLateFastStarts.slice(-2)).join(","), "21,23",
  "The planner must preserve both Sucker Punches before the closing Swift.");

const firstFurretCharge = result.timelineTrace.find(event => event.kind === "charge" && event.trainer === "A");
const firstTalonflameShield = result.timelineTrace.find(event => event.kind === "shield" && event.trainer === "B");
assert.strictEqual(firstFurretCharge?.moveId, "SWIFT",
  "The planner must choose the winning straight-Swift opener.");
assert.strictEqual(firstTalonflameShield?.moveId, "SWIFT",
  "Talonflame must shield the first Swift in the standard 1-1 line.");

const t14Decision = (result.decisionTrace.decisions || []).find(decision =>
  decision.side === "A"
  && Number(decision.turn) === 14
  && decision.decisionType === "charged-move-selection"
);
assert.strictEqual(t14Decision?.chosenCandidate?.moveId, "SWIFT",
  "The charged decision trace must retain the winning straight-Swift opener.");

const t23Decision = (result.decisionTrace.decisions || []).find(decision =>
  decision.side === "A"
  && Number(decision.turn) === 23
  && decision.decisionType === "charged-timing-selection"
);
assert.strictEqual(t23Decision?.chosenCandidate?.action, "FAST_THEN_REEVALUATE",
  "At turn 23 Furret must use the second Sucker Punch instead of throwing Swift early.");
assert.strictEqual(t23Decision?.principleResult?.evidence?.timing?.canCloseWithFastThenCharged, true,
  "The planner must identify the Fast-then-Charged lethal window before Talonflame is ready.");

const t25Decision = (result.decisionTrace.decisions || []).find(decision =>
  decision.side === "A"
  && Number(decision.turn) === 25
  && ["charged-timing-selection", "charged-move-selection"].includes(decision.decisionType)
);
assert.strictEqual(t25Decision?.chosenCandidate?.moveId, "SWIFT",
  "After two Sucker Punches the planner must use the lethal closing Swift.");

const smartFirstShield = smartResult.timelineTrace.find(event => event.kind === "shield" && event.trainer === "B");
assert.strictEqual(smartFirstShield?.moveId, "SWIFT",
  "Smart shield logic must block Swift when taking it concedes a duration-adjusted farm range.");
assert(smartResult.details.winnerEdge > 0,
  "Furret must retain the straight-Swift win when both sides use Smart shield logic.");

const defaultProfileFurretFasts = defaultProfileResult.timelineTrace
  .filter(event => event.kind === "fast" && event.trainer === "A" && Number(event.start) >= 21)
  .map(event => Number(event.start));
const defaultProfileFurretCharges = defaultProfileResult.timelineTrace
  .filter(event => event.kind === "charge" && event.trainer === "A")
  .map(event => event.moveId);
assert.strictEqual(defaultProfileResult.decisionTrace.finalState.A.maxHp, 160,
  "The reported Furret profile must retain its exact 160 HP breakpoint.");
assert.strictEqual(defaultProfileResult.decisionTrace.finalState.B.maxHp, 135,
  "The reported Shadow Talonflame profile must retain its exact 135 HP breakpoint.");
assert.strictEqual(defaultProfileFurretFasts.slice(0, 2).join(","), "21,23",
  "The reported 160/135 profile must execute both late Sucker Punches.");
assert.strictEqual(Array.from(defaultProfileFurretCharges).join(","), "SWIFT,SWIFT",
  "The reported 160/135 profile must win straight Swift.");
assert(defaultProfileResult.details.winnerEdge > 0,
  "The reported 160/135 profile must remain a Furret win.");

const twoShieldLateFasts = twoShieldResult.timelineTrace
  .filter(event => event.kind === "fast" && event.trainer === "A" && Number(event.start) >= 26)
  .map(event => Number(event.start));
const twoShieldClosingSwift = [...twoShieldResult.timelineTrace].reverse().find(event =>
  event.kind === "charge" && event.trainer === "A" && event.moveId === "SWIFT"
);
const deferredIncinerate = twoShieldResult.timelineTrace.find(event =>
  event.kind === "fast" && event.trainer === "B" && Number(event.start) === 31
);
assert(twoShieldResult.details.winnerEdge > 0,
  "Furret must win the reported 2-2 line instead of fainting when Incinerate is registered.");
assert.strictEqual(twoShieldResult.decisionTrace.finalState.A.hp, 17,
  "The pending Incinerate must not damage Furret after Talonflame faints.");
assert.strictEqual(twoShieldLateFasts.join(","), "26,28,30,32",
  "Furret must fit the fourth Sucker Punch before the pending Incinerate impact.");
assert.strictEqual(Number(twoShieldClosingSwift?.start), 34,
  "Furret must close with Swift after the safe fourth Sucker Punch.");
assert.strictEqual(deferredIncinerate?.hpAfter, deferredIncinerate?.hpBefore,
  "A lethal long Fast Attack must remain pending at registration when the target can act first.");

const twoShieldOverfarmDecision = (twoShieldResult.decisionTrace.decisions || []).find(decision =>
  decision.side === "A"
  && Number(decision.turn) === 32
  && decision.decisionType === "charged-timing-selection"
);
assert.strictEqual(twoShieldOverfarmDecision?.chosenCandidate?.action, "FAST_THEN_REEVALUATE",
  "A pending lethal Fast must not force an early throw when Fast-then-Charged closes first.");

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
