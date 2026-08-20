"use strict";

const assert = require("assert");
const path = require("path");
const model = require(path.join(__dirname, "..", "src", "compendium", "compendium-model.js"));
const mechanics = require(path.join(__dirname, "..", "data", "compendium", "mechanics.json"));
const rulings = require(path.join(__dirname, "..", "data", "compendium", "rulings.json"));
const glossary = require(path.join(__dirname, "..", "data", "compendium", "glossary.json"));

const datasets = model.normalizeDatasets({ mechanics, rulings, glossary });
const index = model.buildSearchIndex(datasets);

function ids(query) {
  return model.search(index, query, 20).map(entry => entry.id);
}

assert.strictEqual(ids("cmp")[0], "charged-move-priority");
assert.strictEqual(ids("charged move priority")[0], "charged-move-priority");
assert.ok(ids("fast move").includes("fast-move"));
assert.ok(ids("stat changes").includes("stat-stages"));
assert.strictEqual(ids("switch")[0], "catch");
assert.ok(ids("dre").includes("dre"));
assert.ok(ids("lag").includes("general-lag-review"));
assert.ok(ids("shield").length > 0);
assert.ok(ids("timing").length > 0);
assert.ok(!ids("cap").includes("screen-recording-evidence"), "CAP must not match an unrelated occurrence inside capability");

console.log("Judge Compendium search quality tests passed.");
