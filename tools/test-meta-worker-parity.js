"use strict";
const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const data = G.generationData("twilight-trails");
const moves = new Map(data.gameMaster.moves.map(move => [move.moveId, G.normalizeMove(move)]));
const pokemon = new Map(data.gameMaster.pokemon.filter(p => p?.speciesId && p.baseStats)
  .map(p => G.normalizePokemon(p, moves)).map(p => [p.id, p]));
const source = G.extractLiveWorkerSource();
const vmWorker = G.createWorkerAdapter(source, { dreStandard: true, strict: true });
const nativeWorker = G.createWorkerAdapter(source, { dreStandard: true, strict: true, native: true });
const ids = ["mimikyu", "tinkaton", "florges", "corviknight", "clodsire", "altaria", "melmetal", "cramorant", "morpeko_full_belly", "aegislash_shield"];
const normalize = value => JSON.parse(JSON.stringify(value));
let count = 0;
for (const a of ids) for (const b of ids.slice(0, 5)) {
  const config = G.createBattleConfig(pokemon.get(a), pokemon.get(b), G.RANK1_PROFILE, moves, data.standardMovesets, pokemon);
  if (count % 2) config.left.shieldMode = config.right.shieldMode = "smart";
  const payload = { id: ++count, key: `${a}:${b}`, source: "offline-ranking", config,
    aShields: count % 3, bShields: (count + 1) % 3, includeSwing: false, debugTimeline: true };
  const expected = normalize(vmWorker.simulate(payload));
  assert.deepEqual(normalize(nativeWorker.simulate(payload)), expected, payload.key);
  const live = normalize(nativeWorker.simulate({ ...payload, source: "meta-quick-matchup" }));
  assert.equal(live.score, expected.score);
  assert.deepEqual(live.details, expected.details);
  assert.deepEqual(live.timelineTrace, expected.timelineTrace);
}
assert.equal(globalThis.BATTLE_DRE_STANDARD, undefined, "Native worker state must remain private.");
console.log(`Meta worker parity passed: ${count} cases, VM/native/live scores, final resources and timelines.`);
