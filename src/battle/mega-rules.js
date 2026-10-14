(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakMegaRules = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORMATS = Object.freeze({
    standard: Object.freeze({ label: "Great League", cpCap: 1500, mega: true }),
    ultra: Object.freeze({ label: "Ultra League", cpCap: 2500, mega: true }),
    master: Object.freeze({ label: "Master League", cpCap: Infinity, mega: true })
  });
  const LEGACY_FORMATS = Object.freeze({ "mega-great": "standard", "mega-ultra": "ultra", "mega-master": "master" });
  const BONUSES = Object.freeze([1, 1.1, 1.2, 1.3]);

  function canonicalFormatId(id) { return LEGACY_FORMATS[id] || (FORMATS[id] ? id : "standard"); }
  function format(id) { return FORMATS[canonicalFormatId(id)]; }
  function isMega(pokemon) { return (pokemon?.tags || []).includes("mega"); }
  function isEligible(pokemon, formatId) {
    return !!pokemon && (!isMega(pokemon) || pokemon.released !== false);
  }
  function level(value) {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= 1 && numeric <= 4 ? numeric : 3;
  }
  function bonus(value) { return BONUSES[level(value) - 1]; }
  function chargedMove(move, megaLevel) {
    if (!move) return null;
    if (!move.isMegaMove) return { ...move };
    return { ...move, power: move.power * bonus(megaLevel), basePower: move.power, megaLevel: level(megaLevel) };
  }
  function selectedChargedMoves(pokemon, normalMoves, megaLevel, moveMap) {
    const allowed = new Set(pokemon?.charged || []);
    const normal = (normalMoves || []).filter(move => move && allowed.has(move.id)).slice(0, 2);
    if (!isMega(pokemon)) return normal.map(move => chargedMove(move, megaLevel));
    const extraId = (pokemon.extraChargedMoves || [])[0];
    const extra = extraId && moveMap.get(extraId);
    return [...normal, ...(extra ? [extra] : [])].map(move => chargedMove(move, megaLevel));
  }

  return Object.freeze({ FORMATS, canonicalFormatId, format, isMega, isEligible, level, bonus, chargedMove, selectedChargedMoves });
});
