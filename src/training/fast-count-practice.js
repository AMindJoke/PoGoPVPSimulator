(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PvPeakFastCountPractice = api;
})(globalThis, function() {
  "use strict";
  const STORAGE_KEY = "pvpeak-fast-count-mistakes-v1", MAX_ENTRIES = 300;
  function normalize(value) {
    if (!value || !["count","shortcut"].includes(value.kind) || ![value.pokemonId,value.fastMoveId,value.chargedMoveId].every(id => typeof id === "string" && id.length > 0 && id.length <= 100)) return null;
    if (![value.fastEnergy,value.chargedCost].every(n => Number.isInteger(n) && n > 0 && n <= 100) || !Number.isInteger(value.startingEnergy) || value.startingEnergy < 0 || value.startingEnergy > 100) return null;
    return { kind:value.kind, pokemonId:value.pokemonId, fastMoveId:value.fastMoveId, chargedMoveId:value.chargedMoveId, fastEnergy:value.fastEnergy, chargedCost:value.chargedCost, startingEnergy:value.kind === "shortcut" ? 0 : value.startingEnergy, debt:Math.min(20,Math.max(0,Number.isInteger(value.debt) ? value.debt : 0)) };
  }
  function key(value) { return [value.kind,value.pokemonId,value.fastMoveId,value.chargedMoveId,value.fastEnergy,value.chargedCost,value.startingEnergy].join("|"); }
  function describe(build, exercise) {
    return normalize({ kind:exercise.kind === "shortcut" ? "shortcut" : "count", pokemonId:build.id, fastMoveId:build.fastMove.id, chargedMoveId:exercise.chargedMove.id, fastEnergy:build.fastMove.energyGain, chargedCost:exercise.chargedMove.energyCost, startingEnergy:exercise.energyBefore ?? 0, debt:0 });
  }
  function compatible(value, catalog) {
    const build = catalog.byId.get(value.pokemonId), charged = build?.chargedMoves.find(move => move.id === value.chargedMoveId);
    return !!build && build.fastMove.id === value.fastMoveId && build.fastMove.energyGain === value.fastEnergy && charged?.energyCost === value.chargedCost;
  }
  function createStore(storage) {
    let entries = [];
    try { const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || "[]"); if (Array.isArray(saved)) entries = [...new Map(saved.slice(-MAX_ENTRIES).map(normalize).filter(Boolean).map(value => [key(value),value])).values()]; } catch (_) {}
    return {
      candidates: catalog => entries.filter(value => value.debt > 0 && compatible(value,catalog)).map(value => ({...value})),
      record(value, correct) {
        const item = normalize(value); if (!item) return false;
        const id = key(item), old = entries.find(entry => key(entry) === id);
        if (correct && !old) return true;
        item.debt = Math.min(20, Math.max(0,(old?.debt || 0) + (correct ? -1 : 2)));
        const next = [...entries.filter(entry => key(entry) !== id),item].slice(-MAX_ENTRIES);
        try { storage?.setItem(STORAGE_KEY,JSON.stringify(next)); } catch (_) { return false; }
        entries = next; return true;
      }
    };
  }
  function pick(candidates, random = Math.random, previous = null) {
    const choices = candidates.filter(value => candidates.length === 1 || key(value) !== previous);
    const total = choices.reduce((sum,value) => sum + Math.max(1,value.debt),0);
    let cursor = Math.max(0,Math.min(.999999,Number(random()) || 0))*total;
    for (const value of choices) { cursor -= Math.max(1,value.debt); if (cursor < 0) return value; }
    return choices.at(-1) || null;
  }
  return { STORAGE_KEY,MAX_ENTRIES,key,describe,compatible,createStore,pick };
});
