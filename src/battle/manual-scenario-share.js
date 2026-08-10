(function (root, factory) {
  const api = factory(
    typeof module === "object" && module.exports ? require("./manual-scenario-io.js") : root.PvPeakManualScenarioIO
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualScenarioShare = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (ScenarioIO) {
  "use strict";

  const TOKEN_VERSION = "v1";
  const HASH_KEY = "scenario";
  const MAX_TOKEN_LENGTH = 2_000_000;
  const MAX_JSON_BYTES = 4_000_000;
  const PACK_KEY = "$pvpeakShare";
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
      const chunkSize = 0x8000;
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
      }
      base64 = btoa(binary);
    }
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function base64UrlToBytes(value) {
    if (typeof value !== "string" || !value || !/^[A-Za-z0-9_-]+$/.test(value)) throw error("INVALID_SCENARIO_TOKEN_DATA");
    const standard = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = standard + "=".repeat((4 - standard.length % 4) % 4);
    try {
      if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(padded, "base64"));
      const binary = atob(padded);
      return Uint8Array.from(binary, character => character.charCodeAt(0));
    } catch (_) {
      throw error("INVALID_SCENARIO_TOKEN_DATA");
    }
  }

  async function transformBytes(bytes, stream) {
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    const outputPromise = (async () => {
      const chunks = [];
      let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > MAX_JSON_BYTES) {
            await reader.cancel("SHARED_SCENARIO_TOO_LARGE");
            throw error("SHARED_SCENARIO_TOO_LARGE");
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const output = new Uint8Array(total);
      let offset = 0;
      chunks.forEach(chunk => {
        output.set(chunk, offset);
        offset += chunk.byteLength;
      });
      return output;
    })();
    const inputPromise = (async () => {
      try {
        await writer.write(bytes);
        await writer.close();
      } finally {
        writer.releaseLock();
      }
    })();
    const [output] = await Promise.all([outputPromise, inputPromise]);
    return output;
  }

  async function gzip(bytes) {
    if (typeof CompressionStream !== "function") return null;
    try { return await transformBytes(bytes, new CompressionStream("gzip")); }
    catch (_) { return null; }
  }

  async function gunzip(bytes) {
    if (typeof DecompressionStream !== "function") throw error("SHARED_SCENARIO_COMPRESSION_UNSUPPORTED");
    try { return await transformBytes(bytes, new DecompressionStream("gzip")); }
    catch (cause) {
      if (cause?.code === "SHARED_SCENARIO_TOO_LARGE") throw cause;
      throw error("INVALID_COMPRESSED_SCENARIO");
    }
  }

  function packScenario(payload) {
    const canonical = JSON.parse(ScenarioIO.stringifyScenario(payload, 0));
    const timeline = canonical?.timeline?.events;
    if (!Array.isArray(timeline) || !timeline.length) return canonical;
    const serializedTimeline = JSON.stringify(timeline);
    const references = [];
    const visit = (value, path = []) => {
      if (Array.isArray(value)) {
        if (value.length === timeline.length && JSON.stringify(value) === serializedTimeline) {
          references.push(path);
          return null;
        }
        return value.map((child, index) => visit(child, [...path, index]));
      }
      if (!value || typeof value !== "object") return value;
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child, [...path, key])]));
    };
    const packed = visit(canonical);
    if (references.length < 2) return canonical;
    const registryCandidates = new Map();
    const collectRegistryStates = (value, path = []) => {
      if (!value || typeof value !== "object") return;
      if (
        !Array.isArray(value)
        && value.schemaVersion === 1
        && typeof value.activeBranchId === "string"
        && value.branches
        && Number.isInteger(value.revision)
        && !Object.hasOwn(value, "history")
      ) {
        const serialized = JSON.stringify(value);
        const entries = registryCandidates.get(serialized) || [];
        entries.push(path);
        registryCandidates.set(serialized, entries);
      }
      Object.entries(value).forEach(([key, child]) => collectRegistryStates(child, [...path, key]));
    };
    collectRegistryStates(packed);
    (packed.session?.snapshots || []).forEach((snapshot, snapshotIndex) => {
      Object.entries(snapshot?.state || {}).forEach(([key, value]) => {
        if (!value || typeof value !== "object") return;
        const serialized = JSON.stringify(value);
        if (serialized.length < 100) return;
        const entries = registryCandidates.get(serialized) || [];
        entries.push(["session", "snapshots", snapshotIndex, "state", key]);
        registryCandidates.set(serialized, entries);
      });
    });
    const objects = [];
    const objectReferences = [];
    registryCandidates.forEach((paths, serialized) => {
      if (paths.length < 2) return;
      const index = objects.length;
      objects.push(JSON.parse(serialized));
      paths.forEach(path => {
        setPackedPath(packed, path, null);
        objectReferences.push({ index, path });
      });
    });
    return { [PACK_KEY]: 1, timeline, references, objects, objectReferences, scenario: packed };
  }

  function validPathSegment(segment) {
    return ["string", "number"].includes(typeof segment) && !["__proto__", "prototype", "constructor"].includes(segment);
  }

  function setPackedPath(root, path, value) {
    if (!Array.isArray(path) || !path.length) throw error("INVALID_SCENARIO_PACK");
    let target = root;
    path.slice(0, -1).forEach(segment => {
      if (!validPathSegment(segment)) throw error("INVALID_SCENARIO_PACK");
      target = target?.[segment];
      if (!target || typeof target !== "object") throw error("INVALID_SCENARIO_PACK");
    });
    const finalSegment = path.at(-1);
    if (!validPathSegment(finalSegment)) throw error("INVALID_SCENARIO_PACK");
    target[finalSegment] = value;
  }

  function unpackScenario(payload) {
    if (!payload || payload[PACK_KEY] !== 1) return payload;
    if (!Array.isArray(payload.timeline) || !Array.isArray(payload.references) || !payload.scenario) throw error("INVALID_SCENARIO_PACK");
    const scenario = payload.scenario;
    if (!Array.isArray(payload.objects || []) || !Array.isArray(payload.objectReferences || [])) throw error("INVALID_SCENARIO_PACK");
    (payload.objectReferences || []).forEach(reference => {
      if (!reference || !Number.isInteger(reference.index) || reference.index < 0 || reference.index >= payload.objects.length) throw error("INVALID_SCENARIO_PACK");
      setPackedPath(scenario, reference.path, JSON.parse(JSON.stringify(payload.objects[reference.index])));
    });
    payload.references.forEach(path => {
      setPackedPath(scenario, path, JSON.parse(JSON.stringify(payload.timeline)));
    });
    return scenario;
  }

  async function encodeScenario(payload, options = {}) {
    if (!ScenarioIO) throw error("SCENARIO_SERIALIZER_UNAVAILABLE");
    const json = JSON.stringify(packScenario(payload));
    const raw = textEncoder.encode(json);
    if (raw.byteLength > MAX_JSON_BYTES) throw error("SHARED_SCENARIO_TOO_LARGE");
    const compressed = options.compression === false ? null : await gzip(raw);
    const encoding = compressed && compressed.byteLength < raw.byteLength ? "g" : "r";
    const bytes = encoding === "g" ? compressed : raw;
    const token = `${TOKEN_VERSION}.${encoding}.${bytesToBase64Url(bytes)}`;
    if (token.length > MAX_TOKEN_LENGTH) throw error("SHARED_SCENARIO_TOO_LARGE");
    return token;
  }

  async function decodeScenario(token) {
    if (typeof token !== "string" || !token || token.length > MAX_TOKEN_LENGTH) throw error("INVALID_SCENARIO_TOKEN");
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== TOKEN_VERSION || !["g", "r"].includes(parts[1])) {
      throw error(parts[0] && parts[0] !== TOKEN_VERSION ? "SHARED_SCENARIO_VERSION_UNSUPPORTED" : "INVALID_SCENARIO_TOKEN");
    }
    const encoded = base64UrlToBytes(parts[2]);
    const bytes = parts[1] === "g" ? await gunzip(encoded) : encoded;
    if (bytes.byteLength > MAX_JSON_BYTES) throw error("SHARED_SCENARIO_TOO_LARGE");
    let json;
    try { json = textDecoder.decode(bytes); }
    catch (_) { throw error("INVALID_SCENARIO_TEXT"); }
    let payload;
    try { payload = JSON.parse(json); }
    catch (_) { throw error("INVALID_SCENARIO_JSON"); }
    try {
      const scenario = unpackScenario(payload);
      if (textEncoder.encode(JSON.stringify(scenario)).byteLength > MAX_JSON_BYTES) throw error("SHARED_SCENARIO_TOO_LARGE");
      return scenario;
    }
    catch (cause) {
      if (["INVALID_SCENARIO_PACK", "SHARED_SCENARIO_TOO_LARGE"].includes(cause?.code)) throw cause;
      throw error("INVALID_SCENARIO_PACK");
    }
  }

  function scenarioTokenFromLocation(locationLike) {
    const hash = String(locationLike?.hash || "").replace(/^#/, "");
    if (!hash) return null;
    try { return new URLSearchParams(hash).get(HASH_KEY); }
    catch (_) { return null; }
  }

  async function buildScenarioUrl(payload, locationLike) {
    const token = await encodeScenario(payload);
    const origin = String(locationLike?.origin || "");
    const pathname = String(locationLike?.pathname || "/");
    const search = String(locationLike?.search || "");
    return `${origin}${pathname}${search}#${HASH_KEY}=${token}`;
  }

  function locationWithoutScenario(locationLike) {
    const origin = String(locationLike?.origin || "");
    const pathname = String(locationLike?.pathname || "/");
    const search = String(locationLike?.search || "");
    return `${origin}${pathname}${search}`;
  }

  return Object.freeze({
    TOKEN_VERSION,
    HASH_KEY,
    MAX_TOKEN_LENGTH,
    MAX_JSON_BYTES,
    encodeScenario,
    decodeScenario,
    scenarioTokenFromLocation,
    buildScenarioUrl,
    locationWithoutScenario
  });
});
