"use strict";

const assert = require("node:assert/strict");
const { createRunner, timelineModel } = require("../src/analysis/meta-quick-matchup");
const workers = [];
const createWorker = () => {
  const worker = { sent: [], terminated: false,
    postMessage(data) { this.sent.push(data); }, terminate() { this.terminated = true; },
    respond(result = { score: 750, timelineTrace: [] }) {
      const request = this.sent.at(-1);
      this.onmessage({ data: { id: request.id, type: "matrixCellResult", result } });
    }
  };
  workers.push(worker);
  return worker;
};
const runner = createRunner(createWorker);
const updates = [];
const config = { left: { name: "A" }, right: { name: "B" } };
runner.start(config, "first", state => updates.push(state));
assert.equal(workers.length, 1);
assert.equal(workers[0].sent[0].aShields, 1);
assert.equal(workers[0].sent[0].bShields, 1);
assert.equal(workers[0].sent[0].debugTimeline, true);
assert.equal(workers[0].sent[0].includeSwing, true, "The preview must use the same score analysis as the full shield matrix.");
runner.prioritize("2-0");
workers[0].respond();
assert.equal(workers[0].sent[1].aShields, 2);
assert.equal(workers[0].sent[1].bShields, 0);
for (let i = 1; i < 9; i++) workers[0].respond();
assert.equal(updates.at(-1).status, "ready");
assert.equal(Object.keys(updates.at(-1).cells).length, 9);
assert.equal(Object.keys(updates[0].cells).length, 0, "Published updates must not change retroactively.");
assert.equal(workers[0].terminated, true);
runner.start(config, "first", state => updates.push(state));
assert.equal(workers.length, 1, "Reopening a fully computed pair must reuse its results.");
assert.equal(updates.at(-1).status, "ready");
runner.start(config, "second", state => updates.push(state));
const staleCallback = workers[1].onmessage, staleError = workers[1].onerror;
const staleRequest = workers[1].sent.at(-1);
runner.start(config, "third", state => updates.push(state));
const count = updates.length;
staleCallback({ data: { id: staleRequest.id, type: "matrixCellResult", result: { score: 100 } } });
staleError();
assert.equal(updates.length, count, "Old replies and errors cannot overwrite the newly selected pair.");
workers[2].respond({ score: NaN });
assert.equal(updates.at(-1).status, "error");
assert.equal(workers[2].terminated, true);
runner.cancel();
const timeline = timelineModel([{ trainer: "A", start: 0, duration: 2 }, { trainer: "B", start: 6, duration: 1 }]);
assert.equal(timeline.turns, 7);
assert.equal(timeline.seconds, 3.5);
assert.equal(timeline.rows.length, 2);
assert.equal(timelineModel([]).turns, 1);

// Run the same canonical worker used by the preview, with its actual trace output.
const G = require("./build-great-league-meta-database");
const gm = G.readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
const movesets = G.readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS");
const moves = new Map(gm.moves.map(move => [move.moveId, G.normalizeMove(move)]));
const pokemon = new Map(gm.pokemon.filter(p => p?.speciesId && p.baseStats).map(p => G.normalizePokemon(p, moves)).map(p => [p.id,p]));
const battle = G.createBattleConfig(pokemon.get("mimikyu"), pokemon.get("tinkaton"), G.DEFAULT_PROFILE, moves, movesets, pokemon);
const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource());
const payload = { id: 1, source: "live", key: "quick-preview", signature: "quick-preview", config: battle, aShields: 1, bShields: 1, includeSwing: true };
const normal = adapter.simulate(payload);
const preview = adapter.simulate({ ...payload, debugTimeline: true });
assert.equal(preview.score, normal.score, "Exporting a compact timeline must not change the simulation result.");
assert.ok(preview.timelineTrace.length > 0);
assert.ok(timelineModel(preview.timelineTrace).rows.some(event => event.trainer === "A"));
assert.ok(timelineModel(preview.timelineTrace).rows.some(event => event.trainer === "B"));

// Exercise the actual Battle launch bridge with deliberately different shields.
const fs = require("node:fs"), vm = require("node:vm");
const html = fs.readFileSync("PogoPvp.html", "utf8");
const bridge = html.slice(html.indexOf("    function loadMetaMatchup("), html.indexOf("    function applyMetaRankingMoves("));
const inputs = {}, appliedMoves = [];
let resetCount = 0;
const context = {
  $: id => inputs[id] ||= { value: null }, findPokemon: id => ({ id }),
  setAppView: () => {}, setPokemonSelection: () => {}, applyIvOptimizationProfile: () => {},
  setIvProfileState: () => {}, clearStartingFastAdvantage: () => {}, setBaiting: () => {}, setShieldMode: () => {},
  applyMetaRankingMoves: (...args) => appliedMoves.push(args), renderShields: () => {},
  resetBattleStateFromSetup: () => { resetCount++; },
  runBattleToEnd: () => { assert.equal(resetCount, 1, "The new shields must reach the timeline before simulation starts."); }
};
vm.createContext(context);
vm.runInContext(bridge, context);
context.loadMetaMatchup("mimikyu", "tinkaton", { config: battle, aShields: 0, bShields: 2 });
assert.equal(inputs.p1Shields.value, "0");
assert.equal(inputs.p2Shields.value, "2");
assert.equal(inputs.p1IvAtk.value, battle.left.ivAtk);
assert.equal(inputs.p1StartEnergy.value, "0");
assert.equal(appliedMoves[0][2], battle.left);
console.log(`Meta quick matchup tests passed (canonical score ${preview.score}, ${preview.timelineTrace.length} timeline events).`);
