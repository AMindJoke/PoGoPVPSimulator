(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakSharedMatchupCache = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function key(version, config, a, b, signature) {
    if (!config?.left || !config?.right) return null;
    const extras = Object.fromEntries(Object.keys(config).filter(k => !["left", "right", "startEnergyA", "startEnergyB"].includes(k)).sort().map(k => [k, config[k]]));
    const sideExtras = side => [side.chargedTaken || 0, side.shadowAtkMult || 1, side.shadowDefMult || 1, side.initialFormId || side.p?.id, side.lastFastStart ?? null];
    return "shared-matchup-v1|" + version + "|" + signature(config.left) + ">" + signature(config.right) + "|" + a + "-" + b + "|" + JSON.stringify([config.startEnergyA || 0, config.startEnergyB || 0, sideExtras(config.left), sideExtras(config.right), extras]);
  }
  function legacyBattleSignature(config) {
    if (!config?.left || !config?.right || Object.keys(config).some(k => !["left", "right", "startEnergyA", "startEnergyB"].includes(k))) return null;
    if ((config.startEnergyA || 0) !== (config.left.energy || 0) || (config.startEnergyB || 0) !== (config.right.energy || 0)) return null;
    if ([config.left, config.right].some(side => side.hp !== side.maxHp || side.attackStage || side.defenseStage || side.chargedTaken || side.linePolicy || side.lastFastStart != null)) return null;
    return [config.left, config.right].map(side => JSON.stringify({ id: side.p.id, level: side.level, cp: side.cp, ivs: [side.ivAtk, side.ivDef, side.ivHp], attack: side.attack, defense: side.defense, maxHp: side.maxHp, moves: [side.fast, ...(side.charged || [])].filter(Boolean).map(move => move.id), startEnergy: side.energy || 0, baiting: side.baiting, shieldMode: side.shieldMode })).join("|");
  }
  function createStore(indexedDB, options = {}) {
    const memory = new Map(), writes = new Map();
    const limit = options.memoryLimit || 1500;
    let dbPromise = null, timer = null, status = indexedDB ? "pending" : "unavailable";
    function remember(k, v) { memory.delete(k); memory.set(k, v); while (memory.size > limit) memory.delete(memory.keys().next().value); }
    function open() {
      if (!indexedDB || status === "unavailable") return Promise.resolve(null);
      if (!dbPromise) dbPromise = new Promise(resolve => {
        let settled = false, timeout;
        function finish(db) {
          if (settled) { db?.close(); return; }
          settled = true; clearTimeout(timeout); status = db ? "ready" : "unavailable"; resolve(db);
        }
        try {
          const request = indexedDB.open("pogo-pvp-simulator", 1);
          timeout = setTimeout(() => finish(null), 2000);
          request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains("matrix-cache")) request.result.createObjectStore("matrix-cache"); };
          request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); finish(request.result); };
          request.onerror = request.onblocked = () => finish(null);
        } catch (_) { finish(null); }
      });
      return dbPromise;
    }
    async function getMany(keys) {
      const output = new Map();
      const missing = [...new Set(keys.filter(Boolean))].filter(k => { const v = writes.get(k) || memory.get(k); if (v) output.set(k, v); return !v; });
      if (!missing.length) return output;
      const db = await open(); if (!db) return output;
      await new Promise(resolve => {
        try {
          const tx = db.transaction("matrix-cache", "readonly"), store = tx.objectStore("matrix-cache");
          const timeout = setTimeout(() => { try { tx.abort(); } catch (_) {} resolve(); }, 2000);
          for (const k of missing) { const request = store.get(k); request.onsuccess = () => { if (request.result) { output.set(k, request.result); remember(k, request.result); } }; }
          tx.oncomplete = tx.onerror = tx.onabort = () => { clearTimeout(timeout); resolve(); };
        } catch (_) { resolve(); }
      });
      return output;
    }
    async function flush() {
      if (timer) { clearTimeout(timer); timer = null; }
      const entries = [...writes]; writes.clear(); if (!entries.length) return true;
      const db = await open(); if (!db) return false;
      return new Promise(resolve => {
        try {
          const tx = db.transaction("matrix-cache", "readwrite"), store = tx.objectStore("matrix-cache");
          for (const [k, v] of entries) store.put(v, k);
          tx.oncomplete = () => resolve(true);
          tx.onerror = tx.onabort = () => { status = "unavailable"; resolve(false); };
        } catch (_) { status = "unavailable"; resolve(false); }
      });
    }
    function set(k, v) {
      if (!k || !v) return;
      remember(k, v);
      if (status === "unavailable") return;
      writes.set(k, v);
      if (writes.size >= 100) void flush();
      else if (!timer) timer = setTimeout(() => void flush(), 300);
    }
    return { get: k => writes.get(k) || memory.get(k) || null, getMany, set, flush, status: () => status };
  }
  return Object.freeze({ key, legacyBattleSignature, createStore });
});
