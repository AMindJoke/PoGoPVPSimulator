"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const model = require(path.join(__dirname, "..", "src", "compendium", "compendium-model.js"));

const root = path.join(__dirname, "..");
const read = name => JSON.parse(fs.readFileSync(path.join(root, "data", "compendium", `${name}.json`), "utf8"));
const raw = { mechanics: read("mechanics"), rulings: read("rulings"), glossary: read("glossary") };
const normalized = model.normalizeDatasets(raw);
const index = model.buildSearchIndex(normalized);
const entry = (type, id) => normalized[type].find(item => item.id === id);
const body = (type, id) => entry(type, id).content.flatMap(section => section.body).join(" ");
const glossaryText = id => [entry("glossary", id).term, entry("glossary", id).definition, ...(entry("glossary", id).keywords || [])].join(" ");

[
  "fast-move-impact", "charged-attack-timing", "pending-fast", "switching-timing",
  "post-charged-switch", "disconnect-state"
].forEach(id => assert.ok(entry("mechanics", id), `Missing current 2026 mechanic: ${id}`));

assert.ok(!entry("mechanics", "timing-anomaly"), "Timing Anomaly must not be presented as a current mechanic");
assert.ok(!entry("glossary", "timing-anomaly"), "Timing Anomaly must not be presented as a current glossary term");

assert.match(body("mechanics", "fast-move-impact"), /end of the appropriate turn/i);
assert.match(body("mechanics", "pending-fast"), /registered/i);
assert.match(body("mechanics", "pending-fast"), /immediate knockout/i);
assert.match(body("mechanics", "charged-attack-timing"), /next turn/i);
assert.match(body("mechanics", "charged-attack-timing"), /before the end-of-turn impact/i);
assert.match(body("mechanics", "switching-timing"), /before the pending damage/i);
assert.match(body("mechanics", "switching-timing"), /one turn.*zero turns.*zero turns/i);
assert.match(body("mechanics", "post-charged-switch"), /zero-turn switch/i);
assert.match(body("mechanics", "disconnect-state"), /continues to progress/i);
const capCopy = body("mechanics", "charged-move-priority");
assert.match(capCopy, /priority Attack/i);
assert.match(capCopy, /Temporary Attack stage changes during battle do not change CAP order/i);
assert.match(capCopy, /Defense changes do not affect CAP; they only affect damage/i);
assert.doesNotMatch(capCopy, /Attack buff or debuff can change/i);
assert.doesNotMatch(capCopy, /Fast pending on Pokémon B/i);
const stageCopy = body("mechanics", "stat-stages");
assert.match(stageCopy, /Defense changes affect damage, not CAP itself/i);
assert.doesNotMatch(stageCopy, /Fast pending on Pokémon B/i);
const pendingFastCopy = body("mechanics", "pending-fast");
assert.match(pendingFastCopy, /Pokémon A has a Fast Attack pending on Pokémon B/i);
assert.match(pendingFastCopy, /B's current Defense stage at impact time/i);

const historical = body("rulings", "fast-attack-prevents-charged-attack");
assert.match(historical, /historical/i);
assert.match(historical, /deterministic/i);
assert.match(glossaryText("dre"), /Historical/i);
assert.match(glossaryText("sneak"), /Historical|historical/i);
assert.doesNotMatch(body("mechanics", "disconnect-state"), /random DRE/i);

assert.strictEqual(model.search(index, "pending")[0].id, "pending-fast");
assert.strictEqual(model.search(index, "damage transfer")[0].id, "switching-timing");
assert.strictEqual(model.search(index, "self debuff")[0].id, "self-defense-debuff");
assert.strictEqual(model.search(index, "zero turn")[0].id, "post-charged-switch");
assert.ok(model.search(index, "sneak").some(result => result.id === "sneak"));
assert.ok(model.search(index, "leak").some(result => result.id === "sneak"));

assert.doesNotMatch(JSON.stringify(raw), /Timing Anomaly|timing anomaly|timing-anomaly/i);
assert.doesNotMatch(JSON.stringify(raw), /simulator|duplicate KO marker|event marker|state snapshot|HP bar|damage animation/i);

console.log("Judge Compendium 2026 migration tests passed.");
