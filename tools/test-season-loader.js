"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "data", "seasons", "season-generated-loader.js"), "utf8");
function rendered(search, stored = "", next = null) {
  let html = "";
  const context = {
    URLSearchParams,
    window: {
      BATTLE_NEXT_SEASON: next,
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
assert.doesNotMatch(rendered("?season=twilight-trails"), /data\/seasons\/twilight-trails/);
assert.doesNotMatch(rendered("", "twilight-trails"), /data\/seasons\/twilight-trails/);
const next = { id: "future-season", enabled: true, generatedAssets: { rankings: "future/rankings.js", rankingDetails: "future/details.js", defaultMovesets: "future/moves.js" } };
assert.match(rendered("?season=future-season", "", next), /future\/rankings.js/);
assert.match(rendered("", "future-season", next), /future\/moves.js/);
assert.doesNotMatch(rendered("?season=future-season", "", { ...next, enabled: false }), /future\//);
assert.doesNotMatch(rendered("?season=current-2026-06-28", "twilight-trails"), /twilight-trails/);

console.log("Season generated-data loader tests passed.");
