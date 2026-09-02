(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakPokemonForms = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORM_KINDS = Object.freeze({ STANDARD: "standard", MEGA: "mega", PRIMAL: "primal", SHADOW: "shadow" });

  function tagsOf(pokemon) {
    return new Set((pokemon?.tags || []).map(value => String(value || "").trim().toLowerCase()).filter(Boolean));
  }

  function kind(pokemon) {
    const tags = tagsOf(pokemon);
    if (tags.has("mega")) return FORM_KINDS.MEGA;
    if (tags.has("primal")) return FORM_KINDS.PRIMAL;
    if (tags.has("shadow")) return FORM_KINDS.SHADOW;
    return FORM_KINDS.STANDARD;
  }

  function describe(pokemon) {
    return Object.freeze({
      id: String(pokemon?.speciesId || pokemon?.id || ""),
      kind: kind(pokemon),
      isMega: kind(pokemon) === FORM_KINDS.MEGA,
      isPrimal: kind(pokemon) === FORM_KINDS.PRIMAL,
      tags: Object.freeze([...tagsOf(pokemon)])
    });
  }

  return Object.freeze({ FORM_KINDS, tagsOf, kind, describe, isMega: pokemon => kind(pokemon) === FORM_KINDS.MEGA });
});
