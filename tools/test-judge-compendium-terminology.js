const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const visibleFields = new Set(["term", "expanded", "definition", "title", "summary", "category", "heading", "body", "label"]);
const datasets = ["mechanics", "rulings", "glossary"].map(name => JSON.parse(fs.readFileSync(path.join(root, "data", "compendium", `${name}.json`), "utf8")));
const visibleStrings = [];

function collect(value, key = "") {
  if (typeof value === "string" && visibleFields.has(key)) visibleStrings.push(value);
  else if (Array.isArray(value)) value.forEach(item => collect(item, key));
  else if (value && typeof value === "object") Object.entries(value).forEach(([childKey, child]) => collect(child, childKey));
}

datasets.forEach(dataset => collect(dataset));
const editorialCopy = visibleStrings.join("\n");
assert.ok(!/\bFast Moves?\b|\bCharged Moves?\b|\bCMP\b|\bCharge Attack\b/.test(editorialCopy), "Visible Compendium editorial copy must use Play! Pokémon terminology.");
assert.match(editorialCopy, /Fast Attack/);
assert.match(editorialCopy, /Charged Attack/);
assert.match(editorialCopy, /Charged Attack Priority/);

const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
const compendiumStart = html.indexOf("let compendiumActiveCategory");
const compendiumEnd = html.indexOf("function setAppView", compendiumStart);
const compendiumUi = html.slice(compendiumStart, compendiumEnd);
assert.ok(!/\bFast Moves?\b|\bCharged Moves?\b|\bCMP\b|\bCharge Attack\b/.test(compendiumUi), "Visible Compendium UI must use Play! Pokémon terminology.");
assert.match(compendiumUi, /Fast Attacks/);
assert.match(compendiumUi, /Charged Attacks/);
assert.match(compendiumUi, /Fast Attack Timing Visualizer/);

console.log("Judge Compendium terminology tests passed.");
