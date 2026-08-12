(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./team-builder-state.js") : root.PvPeakTeamBuilder
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakTeamBuilderShare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (TeamBuilder) {
  "use strict";

  const TOKEN_VERSION = "v1";
  const HASH_KEY = "team";
  const MAX_TOKEN_LENGTH = 50_000;
  const MAX_JSON_BYTES = 100_000;
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder("utf-8", { fatal: true });

  function error(code) {
    const result = new Error(code);
    result.code = code;
    return result;
  }

  function bytesToBase64Url(bytes) {
    let base64;
    if (typeof Buffer !== "undefined") base64 = Buffer.from(bytes).toString("base64");
    else {
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      base64 = btoa(binary);
    }
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(value) {
    if (typeof value !== "string" || !value || !/^[A-Za-z0-9_-]+$/.test(value)) throw error("INVALID_TEAM_TOKEN_DATA");
    const standard = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = standard + "=".repeat((4 - standard.length % 4) % 4);
    try {
      if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(padded, "base64"));
      return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
    } catch (_) { throw error("INVALID_TEAM_TOKEN_DATA"); }
  }

  function normalizePayload(payload) {
    if (!TeamBuilder) throw error("TEAM_BUILDER_UNAVAILABLE");
    if (!payload || payload.schemaVersion !== 1 || !payload.state) throw error("INVALID_SHARED_TEAM");
    let state;
    try { state = TeamBuilder.normalizeState(payload.state); }
    catch (_) { throw error("INVALID_SHARED_TEAM_STATE"); }
    if (!state.team.every(Boolean)) throw error("SHARED_TEAM_INCOMPLETE");
    let baseline = null;
    if (payload.comparisonBaseline != null) {
      try { baseline = TeamBuilder.normalizeState({ ...state, team: payload.comparisonBaseline }).team; }
      catch (_) { throw error("INVALID_SHARED_TEAM_BASELINE"); }
      if (!baseline.every(Boolean)) throw error("INVALID_SHARED_TEAM_BASELINE");
    }
    return Object.freeze({ schemaVersion: 1, state, comparisonBaseline: baseline });
  }

  function encodeTeam(payload) {
    const normalized = normalizePayload(payload);
    const bytes = textEncoder.encode(JSON.stringify(normalized));
    if (bytes.byteLength > MAX_JSON_BYTES) throw error("SHARED_TEAM_TOO_LARGE");
    const token = `${TOKEN_VERSION}.r.${bytesToBase64Url(bytes)}`;
    if (token.length > MAX_TOKEN_LENGTH) throw error("SHARED_TEAM_TOO_LARGE");
    return token;
  }

  function decodeTeam(token) {
    if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) throw error("INVALID_TEAM_TOKEN");
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== TOKEN_VERSION || parts[1] !== "r") {
      throw error(parts[0] && parts[0] !== TOKEN_VERSION ? "SHARED_TEAM_VERSION_UNSUPPORTED" : "INVALID_TEAM_TOKEN");
    }
    const bytes = base64UrlToBytes(parts[2]);
    if (bytes.byteLength > MAX_JSON_BYTES) throw error("SHARED_TEAM_TOO_LARGE");
    let payload;
    try { payload = JSON.parse(textDecoder.decode(bytes)); }
    catch (_) { throw error("INVALID_TEAM_JSON"); }
    return normalizePayload(payload);
  }

  function teamTokenFromLocation(locationLike) {
    const hash = String(locationLike?.hash || "").replace(/^#/, "");
    if (!hash) return null;
    try { return new URLSearchParams(hash).get(HASH_KEY); }
    catch (_) { return null; }
  }

  function buildTeamUrl(payload, locationLike) {
    const token = encodeTeam(payload);
    return `${String(locationLike?.origin || "")}${String(locationLike?.pathname || "/")}${String(locationLike?.search || "")}#${HASH_KEY}=${token}`;
  }

  function locationWithoutTeam(locationLike) {
    return `${String(locationLike?.origin || "")}${String(locationLike?.pathname || "/")}${String(locationLike?.search || "")}`;
  }

  return Object.freeze({ TOKEN_VERSION, HASH_KEY, MAX_TOKEN_LENGTH, MAX_JSON_BYTES, normalizePayload, encodeTeam, decodeTeam, teamTokenFromLocation, buildTeamUrl, locationWithoutTeam });
});
