(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakManualScenarioLibrary = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "pvp-simulator.manual-scenarios.v1";

  function clone(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeName(value, fallback = "Untitled scenario") {
    return String(value || "").trim().slice(0, 96) || fallback;
  }

  function createId(now = Date.now()) {
    return `scenario-${now}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function createLibrary(storage = null, options = {}) {
    const key = options.storageKey || STORAGE_KEY;
    const now = typeof options.now === "function" ? options.now : () => new Date().toISOString();
    const read = () => {
      try {
        const parsed = JSON.parse(storage?.getItem(key) || "[]");
        return Array.isArray(parsed) ? parsed.filter(item => item?.id && item?.payload) : [];
      } catch (_) {
        return [];
      }
    };
    const write = entries => storage?.setItem(key, JSON.stringify(entries));
    const list = () => read().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map(clone);
    const get = id => clone(read().find(item => item.id === id) || null);
    const save = input => {
      const entries = read();
      const existingIndex = entries.findIndex(item => item.id === input?.id);
      const timestamp = now();
      const entry = {
        id: input?.id || createId(Date.parse(timestamp) || Date.now()),
        name: normalizeName(input?.name),
        createdAt: existingIndex >= 0 ? entries[existingIndex].createdAt : timestamp,
        updatedAt: timestamp,
        payload: clone(input?.payload),
        summary: clone(input?.summary || {})
      };
      if (!entry.payload) throw new Error("SCENARIO_PAYLOAD_REQUIRED");
      if (existingIndex >= 0) entries[existingIndex] = entry;
      else entries.push(entry);
      write(entries);
      return clone(entry);
    };
    const remove = id => {
      const entries = read();
      const next = entries.filter(item => item.id !== id);
      if (next.length === entries.length) return false;
      write(next);
      return true;
    };
    const rename = (id, name) => {
      const entry = get(id);
      if (!entry) return null;
      return save({ ...entry, name: normalizeName(name, entry.name) });
    };
    const duplicate = (id, name) => {
      const entry = get(id);
      if (!entry) return null;
      return save({ name: normalizeName(name, `${entry.name} copy`), payload: entry.payload, summary: entry.summary });
    };
    return Object.freeze({ list, get, save, remove, rename, duplicate });
  }

  return Object.freeze({ STORAGE_KEY, createLibrary, normalizeName });
});
