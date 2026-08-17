const assert = require("assert");
const fs = require("fs");
const path = require("path");
const model = require(path.join(__dirname, "..", "src", "compendium", "compendium-model.js"));

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "compendium", `${name}.json`), "utf8"));
}

const rulings = read("rulings");
const mechanics = read("mechanics");
const validation = model.validateDataset("rulings", rulings);
assert.deepStrictEqual(validation.errors, [], `Invalid rulings dataset: ${validation.errors.join(", ")}`);

const required = [
  "technical-review-request",
  "technical-review-resolution",
  "screen-recording-evidence",
  "fast-attack-prevents-charged-attack",
  "general-lag-review",
  "technical-review-reporting"
];
const rulingIds = new Set(rulings.items.map(item => item.id));
required.forEach(id => assert.ok(rulingIds.has(id), `Missing initial ruling: ${id}`));
assert.strictEqual(rulingIds.size, rulings.items.length, "Ruling IDs must be unique");

const mechanicIds = new Set(mechanics.items.map(item => item.id));
for (const ruling of rulings.items) {
  assert.strictEqual(ruling.sourceType, "official");
  assert.ok(ruling.sourceUrl.startsWith("https://mcdn.pokemon.com/"), `${ruling.id} must link to the official handbook`);
  assert.match(ruling.sourceSection, /^Sections? /);
  assert.strictEqual(ruling.sourceUpdated, "2026-05-21");
  ruling.relatedMechanics.forEach(id => assert.ok(mechanicIds.has(id), `${ruling.id} links to missing mechanic ${id}`));
  ruling.relatedRulings.forEach(id => assert.ok(rulingIds.has(id), `${ruling.id} links to missing ruling ${id}`));
}

const normalized = model.normalizeDatasets({ mechanics, rulings });
const index = model.buildSearchIndex(normalized);
assert.strictEqual(model.search(index, "DRE")[0].id, "fast-attack-prevents-charged-attack");
assert.strictEqual(model.search(index, "one-turn lag")[0].id, "general-lag-review");
assert.strictEqual(model.search(index, "screen recording")[0].id, "screen-recording-evidence");

const dreArticle = model.articleView("rulings", normalized.rulings.find(item => item.id === "fast-attack-prevents-charged-attack"));
assert.strictEqual(dreArticle.sourceType, "official");
assert.ok(dreArticle.related.includes("fast-move-impact"));
assert.ok(dreArticle.related.includes("technical-review-resolution"));

console.log("Judge Compendium rulings tests passed.");
