const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const Library = require("../src/team-builder/team-builder-library");
const Team = require("../src/team-builder/team-builder-state");
const code = fs.readFileSync("src/ui/team-library.js", "utf8");
const source = code.slice(code.indexOf("    function download("), code.indexOf('    $("teamBuilderLibrary").onclick'));
const exported = { schemaVersion: 1, teams: [{ id: "team-1", name: "Coppa Ω", state: Team.createState({ team: [{ pokemonId: "mimikyu", name: "Mimikyu", fastMoveId: "SHADOW_CLAW", chargedMoveIds: ["SHADOW_SNEAK", "PLAY_ROUGH"], build: { profile: "custom", ivAtk: 3, ivDef: 12, ivHp: 14 } }], analysisConfig: { shields: "2-2", meta: "great-league-current" } }), comparisonBaseline: null }] };
let blob, clicked = false, removed = false, cleanup;
const anchor = { click() { clicked = true; }, remove() { removed = true; } };
const context = {
  Blob,
  URL: { createObjectURL: value => { blob = value; return "blob:export-test"; }, revokeObjectURL: value => { assert.equal(value, "blob:export-test"); } },
  document: { createElement: tag => { assert.equal(tag, "a"); return anchor; }, body: { append: link => { assert.equal(link, anchor); } } },
  setTimeout: fn => { cleanup = fn; }
};
vm.createContext(context); vm.runInContext(source, context);
context.download(exported, "saved-teams");
assert.equal(clicked, true); assert.equal(removed, true); assert.equal(anchor.download, "saved-teams.json");
assert.equal(blob.type, "application/json");
blob.text().then(text => {
  assert.deepEqual(Library.parse(text), Library.normalize(exported), "The real UI export must produce an importable file with all team settings.");
  cleanup(); console.log("Team library export/import file integrity passed.");
}).catch(error => { console.error(error); process.exitCode = 1; });
