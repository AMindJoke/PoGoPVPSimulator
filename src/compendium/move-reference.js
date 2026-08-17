(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakMoveReference = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SORTS = Object.freeze(["name", "power", "energy", "efficiency"]);

  function stableMoveId(moveId) {
    return String(moveId || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function effectRows(move) {
    const chance = Math.max(0, Math.min(1, finite(move.buffApplyChance, 0)));
    const rows = [];
    const append = (target, buffs) => {
      if (!Array.isArray(buffs)) return;
      [["attack", buffs[0]], ["defense", buffs[1]]].forEach(([stat, stages]) => {
        const amount = finite(stages, 0);
        if (amount) rows.push(Object.freeze({ target, stat, stages: amount, chance }));
      });
    };
    if (move.buffTarget === "both") {
      append("self", move.buffsSelf);
      append("opponent", move.buffsOpponent);
    } else {
      append(move.buffTarget === "opponent" ? "opponent" : "self", move.buffs);
    }
    return Object.freeze(rows);
  }

  function normalizeMove(move, options = {}) {
    if (!move || !move.moveId || move.unlisted === true) return null;
    const energyGain = Math.max(0, finite(move.energyGain));
    const energyCost = Math.max(0, finite(move.energy));
    const kind = energyGain > 0 ? "fast" : energyCost > 0 ? "charged" : null;
    if (!kind) return null;
    const power = Math.max(0, finite(move.power));
    const turns = kind === "fast" ? Math.max(1, Math.round(finite(move.turns, finite(move.cooldown, 500) / 500))) : 1;
    const displayName = typeof options.displayName === "function" ? options.displayName(move.name || move.moveId, move) : move.name || move.moveId;
    const effects = effectRows(move);
    return Object.freeze({
      id: stableMoveId(move.moveId),
      sourceId: move.moveId,
      kind,
      name: displayName,
      sourceName: move.name || move.moveId,
      type: String(move.type || "normal").toLowerCase(),
      power,
      energyGain,
      energyCost,
      turns,
      dpt: kind === "fast" ? power / turns : null,
      ept: kind === "fast" ? energyGain / turns : null,
      dpe: kind === "charged" && energyCost ? power / energyCost : null,
      effects
    });
  }

  function createReference(rawMoves, options = {}) {
    const all = (rawMoves || []).map(move => normalizeMove(move, options)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type) || a.sourceId.localeCompare(b.sourceId));
    const ids = new Set();
    all.forEach(move => {
      if (ids.has(move.id)) throw new Error(`MOVE_REFERENCE_DUPLICATE_ID:${move.id}`);
      ids.add(move.id);
    });
    const fast = Object.freeze(all.filter(move => move.kind === "fast"));
    const charged = Object.freeze(all.filter(move => move.kind === "charged"));
    const byId = new Map(all.map(move => [move.id, move]));
    return Object.freeze({ all: Object.freeze(all), fast, charged, byId });
  }

  function filterMoves(reference, filters = {}) {
    const kind = filters.kind === "charged" ? "charged" : "fast";
    const query = String(filters.query || "").trim().toLocaleLowerCase();
    const type = String(filters.type || "all").toLowerCase();
    const turns = filters.turns === "all" || filters.turns == null ? null : Math.max(1, Math.round(finite(filters.turns)));
    const sort = SORTS.includes(filters.sort) ? filters.sort : "name";
    const source = reference?.[kind] || [];
    const result = source.filter(move => {
      if (query && !`${move.name} ${move.sourceName} ${move.type}`.toLocaleLowerCase().includes(query)) return false;
      if (type !== "all" && move.type !== type) return false;
      if (kind === "fast" && turns && move.turns !== turns) return false;
      return true;
    });
    const metric = move => sort === "power" ? move.power : sort === "energy" ? (kind === "fast" ? move.energyGain : move.energyCost) : sort === "efficiency" ? (kind === "fast" ? move.ept : move.dpe) : 0;
    result.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) || a.sourceId.localeCompare(b.sourceId) : metric(b) - metric(a) || a.name.localeCompare(b.name));
    return Object.freeze(result);
  }

  function effectLabel(effect) {
    if (!effect) return "";
    const target = effect.target === "opponent" ? "Opponent" : "Self";
    const stat = effect.stat === "attack" ? "Attack" : "Defense";
    const delta = effect.stages > 0 ? `+${effect.stages}` : String(effect.stages);
    const chance = effect.chance >= 1 ? "100%" : `${Number((effect.chance * 100).toFixed(1))}%`;
    return `${target} ${stat} ${delta} · ${chance}`;
  }

  return Object.freeze({ SORTS, stableMoveId, normalizeMove, createReference, filterMoves, effectLabel });
});
