const assert = require("assert");
const {
  createTileModel,
  createChargedThresholdModel,
  shouldAnimateCompletion,
  displayMoveName,
  createNextCycleModel,
  shouldPresentNextCycle,
  createNextCycleController
} = require("../src/battle/energy-trainer.js");

const tile = (energy, gain) => createTileModel({ energy, fastEnergy: gain });
assert.deepStrictEqual(tile(0, 13).tiles.map(item => item.state), Array(8).fill("empty"));
assert.deepStrictEqual(tile(13, 13).tiles.map(item => item.state), ["full", ...Array(7).fill("empty")]);
assert.deepStrictEqual(tile(52, 13).tiles.map(item => item.complete), [true, true, true, true, false, false, false, false]);
assert.deepStrictEqual(tile(17, 13).tiles.slice(0, 2).map(item => [item.amount, item.capacity, item.state]), [[13, 13, "full"], [4, 13, "partial"]]);
assert.deepStrictEqual(tile(100, 13).tiles.map(item => item.state), Array(8).fill("full"));
assert.deepStrictEqual(tile(52 - 35, 13).tiles.slice(0, 2).map(item => [item.amount, item.state]), [[13, "full"], [4, "partial"]]);
assert.strictEqual(tile(100, 20).tiles.length, 5);
assert.strictEqual(tile(100, 13).tiles.at(-1).capacity, 9);
const thresholdsBelow = createChargedThresholdModel([{ name: "Body Slam", energyCost: 35 }, { name: "Power Whip", energyCost: 50 }], 34);
assert.deepStrictEqual(thresholdsBelow.map(item => [item.positionPercent, item.ready, item.lane]), [[35, false, 0], [50, false, 1]]);
const thresholdsReady = createChargedThresholdModel([{ name: "Body Slam", energyCost: 35 }, { name: "Power Whip", energyCost: 50 }], 50);
assert.deepStrictEqual(thresholdsReady.map(item => item.ready), [true, true]);
const previous = { side: "A", fastId: "ROLLOUT", energy: 4, completeCount: 0, eventId: "event-1" };
const current = { side: "A", fastId: "ROLLOUT", energy: 17, completeCount: 1, fastEnergy: 13, maxEnergy: 100 };
assert.equal(shouldAnimateCompletion({ previous, current, eventKind: "fast", eventId: "event-2" }), true);
assert.equal(shouldAnimateCompletion({ previous, current, eventKind: "fast", eventId: "event-2", suppressed: true }), false);
assert.equal(shouldAnimateCompletion({ previous, current, eventKind: "charge", eventId: "event-2" }), false);
for (const type of ["Fire", "Ice", "Normal", "Rock", "Water"]) assert.equal(displayMoveName(`Weather Ball (${type})`), "Weather Ball");
assert.equal(displayMoveName("Weather Ball"), "Weather Ball");
assert.equal(displayMoveName("Shadow Ball"), "Shadow Ball");

const mudShot = { id: "MUD_SHOT", name: "Mud Shot", energyGain: 9 };
const mudBomb = { id: "MUD_BOMB", name: "Mud Bomb", energyCost: 40, type: "ground" };
const scald = { id: "SCALD", name: "Scald", energyCost: 50, type: "water" };
const afterMudBomb = createNextCycleModel({
  usedMove: mudBomb,
  chargedMoves: [mudBomb, scald],
  remainingEnergy: 5,
  fastMove: mudShot
});
assert.deepStrictEqual(afterMudBomb.rows.map(row => [row.name, row.fastMovesNeeded, row.ready]), [
  ["Mud Bomb", 4, false],
  ["Scald", 5, false]
]);
const afterScald = createNextCycleModel({
  usedMove: scald,
  chargedMoves: [mudBomb, scald],
  remainingEnergy: 0,
  fastMove: mudShot
});
assert.deepStrictEqual(afterScald.rows.map(row => row.fastMovesNeeded), [5, 6]);
const overfarm = createNextCycleModel({
  usedMove: mudBomb,
  chargedMoves: [mudBomb, scald],
  remainingEnergy: 60,
  fastMove: mudShot
});
assert.equal(overfarm.cycleCarryEnergy, 6);
assert.deepStrictEqual(overfarm.rows.map(row => [row.fastMovesNeeded, row.ready]), [[4, false], [5, false]]);
const powderSnow = { id: "POWDER_SNOW", name: "Powder Snow", energyGain: 8 };
const weatherBall = { id: "WEATHER_BALL_ICE", name: "Weather Ball (Ice)", energyCost: 35, type: "ice" };
const abomasnowOverfarm = createNextCycleModel({
  usedMove: weatherBall,
  chargedMoves: [weatherBall],
  remainingEnergy: 21,
  fastMove: powderSnow
});
assert.equal(abomasnowOverfarm.cycleCarryEnergy, 5);
assert.deepStrictEqual(abomasnowOverfarm.rows.map(row => [row.name, row.fastMovesNeeded]), [["Weather Ball", 4]]);
const alreadyReady = createNextCycleModel({
  usedMove: { id: "CHEAP_MOVE", name: "Cheap Move", energyCost: 5 },
  chargedMoves: [{ id: "CHEAP_MOVE", name: "Cheap Move", energyCost: 5 }],
  remainingEnergy: 8,
  fastMove: mudShot
});
assert.deepStrictEqual(alreadyReady.rows.map(row => [row.fastMovesNeeded, row.ready]), [[0, true]]);
const equalCost = createNextCycleModel({
  usedMove: mudBomb,
  chargedMoves: [mudBomb, { ...mudBomb, id: "OTHER_40", name: "Other Move" }],
  remainingEnergy: 4,
  fastMove: mudShot
});
assert.deepStrictEqual(equalCost.rows.map(row => [row.name, row.fastMovesNeeded]), [["Mud Bomb", 4], ["Other Move", 4]]);
assert.strictEqual(createNextCycleModel({
  usedMove: mudBomb,
  chargedMoves: [mudBomb],
  remainingEnergy: 5,
  fastMove: mudShot
}).rows.length, 1);
assert.strictEqual(createNextCycleModel({ usedMove: mudBomb, chargedMoves: [mudBomb], remainingEnergy: 0, fastMove: null }), null);
assert.strictEqual(createNextCycleModel({ usedMove: mudBomb, chargedMoves: [mudBomb], remainingEnergy: 0, fastMove: { energyGain: 0 } }), null);
assert.equal(shouldPresentNextCycle({
  executionOk: true,
  actionType: "CHARGED_MOVE",
  actionSide: "A",
  trackedSide: "A",
  model: afterMudBomb
}), true);
assert.equal(shouldPresentNextCycle({
  executionOk: false,
  actionType: "CHARGED_MOVE",
  actionSide: "A",
  trackedSide: "A",
  model: afterMudBomb
}), false);
assert.equal(shouldPresentNextCycle({
  executionOk: true,
  actionType: "CHARGED_MOVE",
  actionSide: "B",
  trackedSide: "A",
  model: afterMudBomb
}), false);

let nextTimerId = 0;
const scheduled = new Map();
const cancelled = [];
const controllerStates = [];
const controller = createNextCycleController({
  schedule(callback, delay) {
    const id = ++nextTimerId;
    scheduled.set(id, { callback, delay });
    return id;
  },
  cancel(id) {
    cancelled.push(id);
    scheduled.delete(id);
  },
  onChange(state) {
    controllerStates.push(state ? `${state.usedMoveName}:${state.phase}` : "cleared");
  }
});
const firstState = controller.show(afterMudBomb);
const firstToken = firstState.token;
assert.equal(scheduled.size, 2);
const secondState = controller.show(afterScald);
assert.notEqual(secondState.token, firstToken);
assert(cancelled.length >= 2);
assert.equal(controller.getState().usedMoveName, "Scald");
const secondEntrance = [...scheduled.entries()].find(([, timer]) => timer.delay === 190);
secondEntrance[1].callback();
assert.equal(controller.getState().phase, "visible");
const secondHide = [...scheduled.entries()].find(([, timer]) => timer.delay === 2690);
secondHide[1].callback();
assert.equal(controller.getState().phase, "leaving");
controller.clear();
assert.equal(controller.getState(), null);
assert.equal(controllerStates.at(-1), "cleared");

let persistentTimerCount = 0;
const persistentController = createNextCycleController({
  persistent: true,
  schedule() {
    persistentTimerCount++;
    return persistentTimerCount;
  }
});
persistentController.show(afterMudBomb);
assert.equal(persistentController.getState().phase, "visible");
assert.equal(persistentTimerCount, 0);
persistentController.show(afterScald);
assert.equal(persistentController.getState().usedMoveName, "Scald");
assert.equal(persistentTimerCount, 0);

console.log("Energy Trainer tile and Next Cycle tests passed.");
