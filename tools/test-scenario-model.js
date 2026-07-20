const assert = require("assert");
const Scenario = require("../src/scenario/scenario-model.js");

const survivor = {
  trainer: "A",
  p: { id: "malamar", name: "Malamar", types: ["dark", "psychic"] },
  hp: 18,
  maxHp: 140,
  energy: 27,
  shields: 1,
  attackStage: 0,
  defenseStage: -1,
  level: 24.5,
  cp: 1498,
  ivAtk: 6,
  ivDef: 15,
  ivHp: 15,
  fast: { id: "PSYWAVE" },
  charged: [{ id: "SUPERPOWER" }, { id: "FOUL_PLAY" }]
};

const scenario = Scenario.createScenario({ id: "test-scenario", originalState: { setup: "original" } });
const survivorState = Scenario.createPokemonState(survivor);
const segment = Scenario.createSegment({
  index: 0,
  initialState: { A: { hp: 140 }, B: { hp: 130 } },
  finalState: { A: survivorState, B: { hp: 0 } },
  winnerSide: "A",
  faintedSide: "B",
  timelineStart: 0,
  timelineEnd: 24
});

Scenario.lockSegment(scenario, segment, survivorState);
assert.equal(scenario.status, "awaiting-incoming");
assert.equal(scenario.activeSide, "A");
assert.equal(scenario.awaitingSide, "B");
assert.equal(scenario.lockedState.hp, 18);
assert.equal(scenario.lockedState.energy, 27);
assert.equal(scenario.lockedState.defenseStage, -1);
assert.equal(scenario.segments.length, 1);

Scenario.setIncomingTransition(scenario, {
  turn: 24,
  incomingSide: "B",
  faintedPokemonName: "Pangoro",
  incomingPokemonName: "Azumarill"
});
assert.equal(scenario.segments[0].transition.turn, 24);
assert.equal(scenario.segments[0].transition.incomingPokemonName, "Azumarill");

survivor.hp = 1;
assert.equal(scenario.lockedState.hp, 18, "Scenario state must not retain mutable battle references.");

Scenario.continueWithIncoming(scenario);
assert.equal(scenario.status, "active");
assert.equal(scenario.awaitingSide, null);

console.log("Scenario model tests passed.");
