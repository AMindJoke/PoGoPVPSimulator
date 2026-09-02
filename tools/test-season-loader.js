"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "data", "seasons", "season-generated-loader.js"), "utf8");
function rendered(search, stored = "") {
  let html = "";
  const context = {
    URLSearchParams,
    window: {
      location: { search },
      localStorage: { getItem: () => stored }
    },
    document: { write: value => { html += value; } }
  };
  context.globalThis = context.window;
  vm.createContext(context);
  vm.runInContext(source, context);
  return html;
}

assert.match(rendered(""), /data\/great-league-rankings\.js/);
assert.doesNotMatch(rendered(""), /twilight-trails/);
assert.match(rendered("?season=twilight-trails"), /data\/seasons\/twilight-trails\/great-league-rankings\.js/);
assert.match(rendered("", "twilight-trails"), /data\/seasons\/twilight-trails\/default-movesets\.js/);
assert.doesNotMatch(rendered("?season=current-2026-06-28", "twilight-trails"), /twilight-trails/);

console.log("Season generated-data loader tests passed.");
