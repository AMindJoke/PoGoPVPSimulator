(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.PvPeakTeamBuilderBattleLink = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PARAM = "tbBattle";
  const VERSION = 1;

  function encodeUtf8(text) {
    if (typeof Buffer !== "undefined") return Buffer.from(text, "utf8").toString("base64");
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function decodeUtf8(text) {
    if (typeof Buffer !== "undefined") return Buffer.from(text, "base64").toString("utf8");
    const binary = atob(text);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function normalizeSide(side) {
    if (!side || typeof side !== "object") throw new Error("TEAM_BUILDER_BATTLE_SIDE_INVALID");
    const chargedMoveIds = Array.isArray(side.chargedMoveIds)
      ? [...new Set(side.chargedMoveIds.filter(Boolean).map(String))]
      : [];
    const normalized = {
      pokemonId: String(side.pokemonId || ""),
      fastMoveId: String(side.fastMoveId || ""),
      chargedMoveIds: Object.freeze(chargedMoveIds),
      ivAtk: Number(side.ivAtk),
      ivDef: Number(side.ivDef),
      ivHp: Number(side.ivHp),
      shields: Number(side.shields),
      baiting: String(side.baiting || "selective"),
      shieldMode: String(side.shieldMode || "smart"),
      startEnergy: Number(side.startEnergy || 0)
    };
    if (side.startingFastCount != null) normalized.startingFastCount = Number(side.startingFastCount);
    if (!normalized.pokemonId || !normalized.fastMoveId || !chargedMoveIds.length || chargedMoveIds.length > 10
      || ![normalized.ivAtk, normalized.ivDef, normalized.ivHp].every(value => Number.isInteger(value) && value >= 0 && value <= 15)
      || !Number.isInteger(normalized.shields) || normalized.shields < 0 || normalized.shields > 2
      || !["off", "selective", "on"].includes(normalized.baiting)
      || !["always", "smart", "no-first"].includes(normalized.shieldMode)
      || !Number.isInteger(normalized.startEnergy) || normalized.startEnergy < 0 || normalized.startEnergy > 100
      || (normalized.startingFastCount != null && (!Number.isInteger(normalized.startingFastCount) || normalized.startingFastCount < 0 || normalized.startingFastCount > 100))) throw new Error("BATTLE_SETUP_INVALID");
    return Object.freeze(normalized);
  }

  function normalizePayload(payload) {
    if (!payload || Number(payload.version) !== VERSION) throw new Error("TEAM_BUILDER_BATTLE_VERSION_UNSUPPORTED");
    const result = { version: VERSION, left: normalizeSide(payload.left), right: normalizeSide(payload.right) };
    if (payload.seasonId != null) {
      if (!/^[a-z0-9-]{1,80}$/.test(payload.seasonId)) throw new Error("BATTLE_SEASON_INVALID");
      result.seasonId = payload.seasonId;
    }
    return Object.freeze(result);
  }

  function encode(payload) {
    const json = JSON.stringify(normalizePayload(payload));
    return encodeUtf8(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decode(token) {
    try {
      if (!token || token.length > 20000 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
      const normalized = String(token || "").replace(/-/g, "+").replace(/_/g, "/");
      const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
      return normalizePayload(JSON.parse(decodeUtf8(padded)));
    } catch (_) {
      return null;
    }
  }

  function createUrl(currentUrl, payload) {
    const url = new URL(String(currentUrl));
    url.searchParams.set(PARAM, encode(payload));
    url.searchParams.set("view", "simulator");
    url.searchParams.delete("compendium");
    url.searchParams.delete("item");
    url.searchParams.delete("tbFarm");
    if (payload.seasonId) url.searchParams.set("season", payload.seasonId);
    url.hash = "";
    return url.toString();
  }

  function readLocation(locationLike) {
    try {
      const params = new URLSearchParams(locationLike?.search || "");
      return decode(params.get(PARAM));
    } catch (_) {
      return null;
    }
  }

  return Object.freeze({ PARAM, VERSION, normalizePayload, encode, decode, createUrl, readLocation });
});
