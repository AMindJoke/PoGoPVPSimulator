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
    const chargedMoveIds = Array.isArray(side.chargedMoveIds) ? side.chargedMoveIds.filter(Boolean).slice(0, 2).map(String) : [];
    return Object.freeze({
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
    });
  }

  function normalizePayload(payload) {
    if (!payload || Number(payload.version) !== VERSION) throw new Error("TEAM_BUILDER_BATTLE_VERSION_UNSUPPORTED");
    return Object.freeze({ version: VERSION, left: normalizeSide(payload.left), right: normalizeSide(payload.right) });
  }

  function encode(payload) {
    const json = JSON.stringify(normalizePayload(payload));
    return encodeUtf8(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function decode(token) {
    try {
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
