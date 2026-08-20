const assert = require("assert");
const fs = require("fs");
const path = require("path");
const model = require(path.join(__dirname, "..", "src", "compendium", "compendium-model.js"));

const dataset = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "compendium", "mechanics.json"), "utf8"));
const validation = model.validateDataset("mechanics", dataset);
assert.deepStrictEqual(validation.errors, [], `Invalid mechanics dataset: ${validation.errors.join(", ")}`);

const ids = dataset.items.map(item => item.id);
for (const required of ["battle-turns", "fast-move-duration", "fast-move-impact", "energy-generation", "charged-move-priority", "stat-stages"]) {
  assert.ok(ids.includes(required), `Missing core mechanic: ${required}`);
}
assert.strictEqual(new Set(ids).size, ids.length, "Mechanics IDs must be unique");

const timelines = dataset.items.flatMap(item => item.content.filter(section => section.kind === "timeline"));
assert.ok(timelines.length >= 3, "Core timing mechanics need reusable timeline examples");
timelines.forEach(section => assert.strictEqual(model.validTimelineDiagram(section.diagram), true));

const normalized = model.normalizeDatasets({ mechanics: dataset });
const index = model.buildSearchIndex(normalized);
assert.strictEqual(model.search(index, "CAP")[0].id, "charged-move-priority");
assert.strictEqual(model.search(index, "impact turn")[0].id, "fast-move-impact");
assert.strictEqual(model.search(index, "100 energy")[0].id, "energy-generation");

const energyCopy = dataset.items.find(item => item.id === "energy-generation").content.flatMap(section => section.body).join(" ");
assert.match(energyCopy, /switching the Pokémon out does not cause it to lose energy/, "Energy guidance must explain that switching preserves stored energy");

for (const item of dataset.items) {
  assert.ok(item.related.every(id => ids.includes(id)), `${item.id} links to a missing mechanic`);
  assert.ok(item.content.every(section => section.body.every(paragraph => paragraph.length <= 360)), `${item.id} contains an overlong paragraph`);
}

console.log("Judge Compendium mechanics tests passed.");
