const assert = require("assert");
const path = require("path");
const model = require(path.join(__dirname, "..", "src", "compendium", "compendium-model.js"));

const mechanics = {
  schemaVersion: 1,
  contentType: "mechanics",
  items: [{
    id: "fast-move-timing",
    title: "Fast Move timing",
    summary: "A fixture for the reusable mechanics schema.",
    category: "Timing",
    keywords: ["turn", "fast move"],
    content: [{ id: "overview", heading: "Overview", kind: "text", body: ["Fixture copy."] }],
    related: ["damage-registration"],
    lastUpdated: "2026-08-17"
  }]
};
const rulings = {
  schemaVersion: 1,
  contentType: "rulings",
  items: [{
    id: "dre-window",
    title: "DRE window",
    summary: "A fixture for sourced ruling metadata.",
    category: "Technical issues",
    keywords: ["dre", "damage"],
    content: [{ id: "judge-note", heading: "Judge note", kind: "key-point", body: ["Fixture copy."] }],
    source: "Fixture source",
    sourceType: "official",
    relatedMechanics: ["fast-move-timing"],
    lastUpdated: "2026-08-17"
  }]
};
const glossary = {
  schemaVersion: 1,
  contentType: "glossary",
  items: [{ id: "cmp", term: "CMP", expanded: "Charged Move Priority", definition: "A fixture glossary definition.", keywords: ["priority"], related: ["fast-move-timing"] }]
};

assert.strictEqual(model.SCHEMA_VERSION, 1);
assert.deepStrictEqual(model.CONTENT_TYPES, ["mechanics", "rulings", "glossary"]);
assert.deepStrictEqual(model.CATEGORIES.map(category => category.id), ["quick-reference", "moves", "mechanics", "rulings", "glossary"]);
assert.strictEqual(model.validateDataset("mechanics", mechanics).valid, true);
assert.strictEqual(model.validateDataset("rulings", rulings).valid, true);
assert.strictEqual(model.validateDataset("glossary", glossary).valid, true);

const invalidId = structuredClone(mechanics);
invalidId.items[0].id = "Not stable";
assert.ok(model.validateDataset("mechanics", invalidId).errors.some(error => error.includes("ENTRY_ID_INVALID")));
const invalidSource = structuredClone(rulings);
invalidSource.items[0].sourceType = "unknown";
assert.ok(model.validateDataset("rulings", invalidSource).errors.some(error => error.includes("RULING_SOURCE_TYPE_INVALID")));
const duplicate = structuredClone(glossary);
duplicate.items.push(structuredClone(duplicate.items[0]));
assert.ok(model.validateDataset("glossary", duplicate).errors.some(error => error.includes("ENTRY_ID_DUPLICATE")));

const normalized = model.normalizeDatasets({ mechanics, rulings, glossary });
const index = model.buildSearchIndex(normalized);
assert.strictEqual(index.length, 3);
assert.strictEqual(model.search(index, "DRE")[0].id, "dre-window");
assert.strictEqual(model.search(index, "charged move priority")[0].id, "cmp");
assert.deepStrictEqual(model.search(index, "missing"), []);

const article = model.articleView("rulings", normalized.rulings[0]);
assert.strictEqual(article.id, "dre-window");
assert.strictEqual(article.sourceType, "official");
assert.strictEqual(article.sections[0].id, "judge-note");
assert.deepStrictEqual(article.related, ["fast-move-timing"]);

console.log("Judge Compendium model tests passed.");
