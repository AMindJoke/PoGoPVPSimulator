"use strict";

const assert = require("node:assert/strict");
const Library = require("../src/battle/manual-scenario-library.js");

const data = new Map();
const storage = { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value) };
let tick = 0;
const library = Library.createLibrary(storage, { now: () => `2026-07-30T10:00:0${tick++}.000Z` });
const saved = library.save({ name: "Abomasnow vs Lickilicky", payload: { schemaVersion: 1 }, summary: { events: 4 } });
assert.equal(library.list().length, 1);
assert.equal(saved.name, "Abomasnow vs Lickilicky");
assert.equal(library.rename(saved.id, "Snow matchup").name, "Snow matchup");
assert.equal(library.duplicate(saved.id).name, "Snow matchup copy");
assert.equal(library.list().length, 2);
assert.equal(library.remove(saved.id), true);
assert.equal(library.list().length, 1);
console.log("Manual scenario library tests passed.");
