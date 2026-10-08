(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakAnnouncedMoves = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // Explicit previews only. Promotion into current data requires release verification.
  const updates = Object.freeze([Object.freeze({
    pokemonId: "zoroark", moveId: "SUCKER_PUNCH", kind: "fast", status: "upcoming",
    eventDate: "2026-10-10", eventStartLocal: "14:00", labelDate: "10 Oct",
    source: "https://pokemongo.com/news/communityday-october-2026-zorua"
  })]);
  function forPokemon(pokemon) {
    return updates.filter(update => update.pokemonId === (pokemon?.id || pokemon?.speciesId));
  }
  function fastIds(pokemon) {
    const current = pokemon?.fast || pokemon?.fastMoves || [];
    return [...new Set([...current, ...forPokemon(pokemon).filter(u => u.kind === "fast").map(u => u.moveId)])];
  }
  function label(pokemon, moveId, now = new Date()) {
    const update = forPokemon(pokemon).find(u => u.moveId === moveId && u.status === "upcoming");
    if (!update) return "";
    const [year, month, day] = update.eventDate.split("-").map(Number);
    const [hour, minute] = update.eventStartLocal.split(":").map(Number);
    const release = new Date(year, month - 1, day, hour, minute);
    return now.getTime() < release.getTime() ? " · Upcoming (" + update.labelDate + ")" : "";
  }
  return Object.freeze({ updates, forPokemon, fastIds, label });
});
