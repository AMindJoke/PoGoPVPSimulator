const assert = require("assert");
const fs = require("fs");
const path = require("path");
const Essentials = require("../src/compendium/judge-essentials.js");

const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "compendium", name), "utf8"));
const datasets = { mechanics: read("mechanics.json").items, rulings: read("rulings.json").items, glossary: read("glossary.json").items };

assert.equal(Essentials.CURRICULUM.length, 9, "Judge Essentials should provide the initial nine-step curriculum");
assert.deepEqual(Essentials.CURRICULUM.map(step => step.order), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
assert.ok(Essentials.curriculumIsValid(datasets), "Every curriculum step must reuse an existing canonical Compendium item");

const memory = new Map();
const storage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) };
let progress = Essentials.readProgress(storage);
assert.equal(Essentials.nextStep(progress).id, "turns");
progress = Essentials.markOpened(progress, "energy");
progress = Essentials.writeProgress(storage, progress);
assert.equal(Essentials.readProgress(storage).lastOpened, "energy", "Last opened step should persist locally");
progress = Essentials.markCompleted(progress, "turns");
progress = Essentials.markCompleted(progress, "fast-attack-duration");
assert.equal(Essentials.nextStep(progress).id, "energy", "Continue should select the next incomplete step");
assert.equal(Essentials.previousStep("energy").id, "fast-attack-duration");
assert.equal(Essentials.followingStep("energy").id, "cap");

console.log("Judge Essentials tests passed.");
