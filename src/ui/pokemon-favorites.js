(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PvPeakPokemonFavorites = api;
})(globalThis, function() {
  "use strict";
  const STORAGE_KEY = "pvpeak-pokemon-favorites-v1";
  function createStore(storage) {
    let ids = [];
    try { const value = JSON.parse(storage?.getItem(STORAGE_KEY) || "[]"); if (Array.isArray(value)) ids = [...new Set(value.filter(id => typeof id === "string" && /^[a-z0-9_]{1,100}$/.test(id)))].slice(0,200); } catch (_) {}
    return {
      has: id => ids.includes(id),
      list: () => [...ids],
      toggle(id) {
        if (!/^[a-z0-9_]{1,100}$/.test(id)) throw new Error("Invalid Pokémon.");
        const next = ids.includes(id) ? ids.filter(value => value !== id) : [...ids,id];
        if (next.length > 200) throw new Error("You can save up to 200 favorites.");
        try { storage?.setItem(STORAGE_KEY,JSON.stringify(next)); } catch (_) { throw new Error("Favorites could not be saved in this browser."); }
        ids = next; return ids.includes(id);
      },
      order(list) { return [...list].sort((a,b) => Number(ids.includes(b.id)) - Number(ids.includes(a.id))); }
    };
  }
  return { STORAGE_KEY, createStore };
});
