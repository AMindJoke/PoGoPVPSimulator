"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const updates = require("../data/site-updates");
const News = require("../src/ui/site-updates");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");

assert.ok(updates.length >= 3);
assert.equal(new Set(updates.map(entry => entry.id)).size, updates.length);
for (const entry of updates) {
  assert.equal(News.latestUpdates([entry]).length, 1, entry.id + ": valid release");
  assert.ok(entry.title.length <= 70, "Keep update titles short");
  assert.ok(entry.changes.length <= 2, "Keep each release to one or two short points");
  assert.ok(entry.changes.join(" ").split(/\s+/).length <= 60, "Keep release notes brief");
}
const before = JSON.stringify(updates);
assert.deepEqual(News.latestUpdates(updates).map(entry => entry.id), updates.slice(0, 3).map(entry => entry.id));
assert.equal(JSON.stringify(updates), before, "Rendering must not reorder or mutate the feed");
assert.deepEqual(News.latestUpdates(null), []);
assert.deepEqual(News.latestUpdates({ entries: updates }), []);
const valid = updates[0];
for (const invalid of [null, {}, { ...valid, date: "2026-02-30" }, { ...valid, date: "not-a-date" }, { ...valid, title: " " }, { ...valid, changes: [] }, { ...valid, changes: [null] }]) {
  assert.equal(News.latestUpdates([invalid]).length, 0);
}
const ordered = [
  { ...valid, id: "old", date: "2026-10-10" },
  { ...valid, id: "same-date-first", date: "2026-10-19" },
  { ...valid, id: "newest", date: "2026-10-20" },
  { ...valid, id: "same-date-second", date: "2026-10-19" }
];
assert.deepEqual(News.latestUpdates(ordered).map(entry => entry.id), ["newest", "same-date-first", "same-date-second"]);
assert.equal(News.latestUpdates([valid, valid]).length, 1);
assert.equal(News.render({ getElementById: () => null }, updates), 0, "Other pages need no News markup");
const home = html.slice(html.indexOf('<div id="homeView"'), html.indexOf('<div id="simulatorView"'));
assert.ok(home.indexOf('id="homeNews"') > home.indexOf('data-home-target="compendium"'));
assert.ok(home.indexOf('id="homeNews"') < home.indexOf('class="home-footer"'));
assert.match(home, /aria-labelledby="homeNewsTitle"/);
for (const file of ["data/site-updates.js", "src/ui/site-updates.js", "src/ui/site-updates.css"]) {
  assert.ok(html.includes(file + "?v=20261019-news1"), file + ": HTML version");
  assert.ok(sw.includes(file + "?v=20261019-news1"), file + ": offline precache");
}
console.log("Site updates passed: three newest releases, stable ordering, content limits, invalid/empty data, placement and offline assets.");
