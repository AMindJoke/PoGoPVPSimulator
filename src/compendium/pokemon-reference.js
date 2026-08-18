(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakPokemonReference = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function stableId(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function normalizePokemon(pokemon) {
    if (!pokemon?.id || !pokemon?.name) return null;
    return Object.freeze({
      id: stableId(pokemon.id),
      sourceId: pokemon.id,
      name: pokemon.name,
      dex: Number(pokemon.dex || 0),
      types: Object.freeze([...(pokemon.types || [])]),
      atk: Number(pokemon.atk || 0),
      def: Number(pokemon.def || 0),
      hp: Number(pokemon.hp || 0),
      fastMoveIds: Object.freeze([...(pokemon.fast || [])]),
      chargedMoveIds: Object.freeze([...(pokemon.charged || [])]),
      shadow: String(pokemon.id).includes("_shadow"),
      released: pokemon.released !== false
    });
  }

  function createReference(pokemon, moves) {
    const all = (pokemon || []).map(normalizePokemon).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name) || a.sourceId.localeCompare(b.sourceId));
    const byId = new Map(all.map(item => [item.id, item]));
    const moveById = moves instanceof Map ? moves : new Map((moves || []).map(move => [move.id || move.moveId, move]));
    const learnersByMove = new Map();
    all.filter(item => item.released).forEach(item => [...item.fastMoveIds, ...item.chargedMoveIds].forEach(moveId => {
      if (!learnersByMove.has(moveId)) learnersByMove.set(moveId, []);
      learnersByMove.get(moveId).push(item);
    }));
    learnersByMove.forEach((learners, moveId) => learnersByMove.set(moveId, Object.freeze(learners)));
    return Object.freeze({ all: Object.freeze(all), byId, moveById, learnersByMove });
  }

  function filter(reference, options = {}) {
    const query = String(options.query || "").trim().toLocaleLowerCase();
    const type = String(options.type || "all").toLowerCase();
    return Object.freeze((reference?.all || []).filter(item => {
      if (query && !`${item.name} ${item.sourceId} ${item.dex}`.toLocaleLowerCase().includes(query)) return false;
      if (type !== "all" && !item.types.includes(type)) return false;
      return item.released;
    }));
  }

  function searchEntries(reference) {
    return Object.freeze((reference?.all || []).filter(item => item.released).map(item => Object.freeze({
      id: item.id,
      type: "pokemon",
      title: item.name,
      summary: `#${item.dex || "—"} · ${item.types.join(" / ")}`,
      keywords: Object.freeze([item.sourceId, ...item.types]),
      item
    })));
  }

  function learners(reference, moveSourceId) {
    return reference?.learnersByMove?.get(moveSourceId) || Object.freeze([]);
  }

  return Object.freeze({ stableId, normalizePokemon, createReference, filter, searchEntries, learners });
});
