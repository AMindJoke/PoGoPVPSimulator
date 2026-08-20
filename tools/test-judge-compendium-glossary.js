const assert = require("assert");
const fs = require("fs");
const path = require("path");
const model = require(path.join(__dirname, "..", "src", "compendium", "compendium-model.js"));

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "compendium", `${name}.json`), "utf8"));
}

const glossary = read("glossary");
const mechanics = read("mechanics");
const rulings = read("rulings");
const validation = model.validateDataset("glossary", glossary);
assert.deepStrictEqual(validation.errors, [], `Invalid glossary dataset: ${validation.errors.join(", ")}`);

const required = ["alignment", "catch", "charged-move", "cmp", "dre", "farm-down", "fast-move", "impact-turn", "one-turn-lag", "sneak", "stat-stage", "turn", "undercharge"];
const glossaryIds = new Set(glossary.items.map(item => item.id));
required.forEach(id => assert.ok(glossaryIds.has(id), `Missing glossary term: ${id}`));
assert.strictEqual(glossaryIds.size, glossary.items.length, "Glossary IDs must be unique");

const relatedIds = new Set([...mechanics.items, ...rulings.items].map(item => item.id));
for (const item of glossary.items) {
  assert.ok(item.definition.length <= 260, `${item.id} definition is not concise`);
  assert.ok(item.category);
  assert.ok(["official", "judge", "competitive", "simulator"].includes(item.usage));
  item.related.forEach(id => assert.ok(relatedIds.has(id), `${item.id} links to missing reference ${id}`));
}

const normalized = model.normalizeDatasets({ glossary, mechanics, rulings });
const index = model.buildSearchIndex(normalized);
assert.strictEqual(model.search(index, "CAP")[0].id, "cmp");
assert.strictEqual(model.search(index, "damage registration error")[0].id, "dre");
assert.strictEqual(model.search(index, "one-turn lag")[0].id, "one-turn-lag");
assert.ok(model.search(index, "1-turn lag").some(entry => entry.id === "one-turn-lag"));
assert.strictEqual(model.search(index, "Fast Attack")[0].id, "fast-move");
assert.strictEqual(model.search(index, "undercharging")[0].id, "undercharge");

console.log("Judge Compendium glossary tests passed.");
