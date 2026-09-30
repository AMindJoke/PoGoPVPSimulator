const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "src", "ui", "home-presentation.css"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const home = html.match(/<div id="homeView"[\s\S]*?<div id="simulatorView"/)?.[0];

assert.ok(home, "The Home view must remain present before Battle.");
assert.doesNotMatch(home, /home-quick-start|Quick Start/);
assert.deepEqual(
  [...home.matchAll(/data-home-target="([^"]+)"/g)].map(match => match[1]).sort(),
  ["analysis", "compendium", "fast-count-trainer", "meta", "scenario-review", "simulator", "team-builder"].sort(),
  "Home must directly expose Battle and all six other tools."
);
assert.match(styles, /\.home-tool-grid-all > \.home-tool-card\.is-simulator \{[\s\S]*?grid-column: 1 \/ -1/);
assert.match(styles, /@media \(max-width: 900px\)[\s\S]*?\.home-tool-grid-all \{ gap: 7px; \}/);
assert.match(html, /src\/ui\/home-presentation\.css\?v=20260929-v1/);
const cacheVersion = serviceWorker.match(/const CACHE_VERSION = "(\d{4})-(\d{2})-(\d{2})-(v\d+)-[^"]+"/);
assert.ok(cacheVersion, "The service worker must have a dated cache version.");
assert.match(serviceWorker, /"\.\/src\/ui\/home-presentation\.css"/);
assert.ok(html.includes(`sw.js?v=${cacheVersion[1]}${cacheVersion[2]}${cacheVersion[3]}-${cacheVersion[4]}`), "The registered worker version must match the active cache version.");

console.log("Home UI contract tests passed.");
