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
    content: [{ id: "overview", heading: "Overview", kind: "timeline", body: ["Fixture copy."], diagram: { turnCount: 3, rows: [{ label: "Fast", segments: [{ start: 1, duration: 3, label: "Move", tone: "fast" }] }] } }],
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
    sourceUrl: "https://example.com/rules.pdf",
    sourceSection: "Section 1.2",
    sourceUpdated: "2026-05-21",
    relatedMechanics: ["fast-move-timing"],
    relatedRulings: [],
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
assert.strictEqual(model.validTimelineDiagram(mechanics.items[0].content[0].diagram), true);
assert.strictEqual(model.validateDataset("rulings", rulings).valid, true);
assert.strictEqual(model.validateDataset("glossary", glossary).valid, true);

const invalidId = structuredClone(mechanics);
invalidId.items[0].id = "Not stable";
assert.ok(model.validateDataset("mechanics", invalidId).errors.some(error => error.includes("ENTRY_ID_INVALID")));
const invalidSource = structuredClone(rulings);
invalidSource.items[0].sourceType = "unknown";
assert.ok(model.validateDataset("rulings", invalidSource).errors.some(error => error.includes("RULING_SOURCE_TYPE_INVALID")));
const invalidSourceUrl = structuredClone(rulings);
invalidSourceUrl.items[0].sourceUrl = "http://example.com/rules.pdf";
assert.ok(model.validateDataset("rulings", invalidSourceUrl).errors.some(error => error.includes("RULING_SOURCE_URL_INVALID")));
const invalidTimeline = structuredClone(mechanics);
invalidTimeline.items[0].content[0].diagram.rows[0].segments[0].duration = 4;
assert.ok(model.validateDataset("mechanics", invalidTimeline).errors.some(error => error.includes("MECHANICS_CONTENT_INVALID")));
const duplicate = structuredClone(glossary);
duplicate.items.push(structuredClone(duplicate.items[0]));
assert.ok(model.validateDataset("glossary", duplicate).errors.some(error => error.includes("ENTRY_ID_DUPLICATE")));

const normalized = model.normalizeDatasets({ mechanics, rulings, glossary });
const index = model.buildSearchIndex(normalized);
assert.strictEqual(index.length, 3);
assert.strictEqual(model.search(index, "DRE")[0].id, "dre-window");
assert.strictEqual(model.search(index, "charged move priority")[0].id, "cmp");
assert.deepStrictEqual(model.search(index, "missing"), []);
assert.strictEqual(model.normalizeSearchText("Pokémon – Timing"), "pokemon timing");

const rankedIndex = model.buildSearchIndex(normalized, [
  { id: "incinerate-guide", type: "mechanics", title: "Understanding Incinerate", summary: "Timing guide", keywords: ["incinerate"] },
  { id: "incinerate", type: "fast-move", title: "Incinerate", summary: "20 damage", keywords: ["fire"] }
]);
assert.deepStrictEqual(model.search(rankedIndex, "incinerate").slice(0, 2).map(entry => entry.id), ["incinerate", "incinerate-guide"]);

const article = model.articleView("rulings", normalized.rulings[0]);
assert.strictEqual(article.id, "dre-window");
assert.strictEqual(article.sourceType, "official");
assert.strictEqual(article.sourceSection, "Section 1.2");
assert.strictEqual(article.sourceUpdated, "2026-05-21");
assert.strictEqual(article.sections[0].id, "judge-note");
assert.deepStrictEqual(article.related, ["fast-move-timing"]);

console.log("Judge Compendium model tests passed.");
