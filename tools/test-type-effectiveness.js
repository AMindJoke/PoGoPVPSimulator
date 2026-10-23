"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
const charts = html.slice(html.indexOf("    const strong = {"), html.indexOf("    const typeColors = {"));
const formula = html.slice(html.indexOf("    function effectiveness("), html.indexOf("    function estimate("));
const actual = vm.createContext({});
vm.runInContext(`${charts}\n${formula}\nglobalThis.types = Object.keys(weak);`, actual);
// Independent defensive chart, already used by the PvPoke state translator.
const translator = fs.readFileSync(path.join(root, "tools/pvpoke-state-translator.js"), "utf8");
const reference = vm.createContext({});
vm.runInContext(translator.slice(translator.indexOf("function effectiveness("), translator.indexOf("function baitPolicy(")), reference);
const mismatches = [];
let checks = 0;
for (const moveType of actual.types) {
  for (let i = 0; i < actual.types.length; i++) {
    const targets = [[actual.types[i]], ...actual.types.slice(i + 1).map(type => [actual.types[i], type])];
    for (const types of targets) {
      const expected = reference.effectiveness(moveType, types);
      const value = actual.effectiveness(moveType, types);
      checks++;
      if (Math.abs(value - expected) > 1e-7) mismatches.push({ moveType, types, actual: value, expected });
    }
  }
}
const report = { checks, mismatches, reference: "PvPoke DamageCalculator defensive type chart", generatedAt: new Date().toISOString() };
fs.mkdirSync(path.join(root, "reports/type-immunity-audit"), { recursive: true });
fs.writeFileSync(path.join(root, `reports/type-immunity-audit/${process.argv.includes("--audit-before") ? "before" : "after"}.json`), JSON.stringify(report, null, 2) + "\n");
if (process.argv.includes("--audit-before")) { console.log(JSON.stringify(report)); process.exit(0); }
assert.deepEqual(mismatches, [], "All single and dual defensive types must match the independent chart.");
const immunities = { dragon: "fairy", electric: "ground", fighting: "ghost", ghost: "normal",
  ground: "flying", normal: "ghost", poison: "steel", psychic: "dark" };
const runtime = R.createRuntime();
const worker = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true, strict: true });
let sequence = 0;
for (const [moveType, targetType] of Object.entries(immunities)) {
  assert.equal(actual.effectiveness(moveType, [targetType]), .390625);
  for (const extraType of [null, ...actual.types.filter(type => type !== targetType)]) {
  const config = G.createBattleConfig(runtime.pokemonMap.get("altaria"), runtime.pokemonMap.get("azumarill"),
    G.RANK1_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
  config.left.p.types = [moveType]; config.right.p.types = [targetType, extraType].filter(Boolean);
  config.left.fast = { ...config.left.fast, id: "IMMUNITY_TEST", type: moveType, power: 20 };
  config.left.attack = config.right.defense = 100;
  const result = worker.simulate({ id: ++sequence, key: moveType, config, aShields: 0, bShields: 0,
    includeSwing: false, debugTimeline: true });
  const hit = result.timelineTrace.find(event => event.trainer === "A" && event.kind === "fast");
  const multiplier = reference.effectiveness(moveType, config.right.p.types);
  assert.equal(hit.damage, Math.floor(20 * 1.3 * .5 * 1.2 * multiplier) + 1, `${moveType}/${config.right.p.types}: actual worker damage`);
  }
}
const config = G.createBattleConfig(runtime.pokemonMap.get("altaria"), runtime.pokemonMap.get("azumarill"),
  G.RANK1_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
const result = worker.simulate({ id: ++sequence, key: "reported-altaria-azumarill", config,
  aShields: 1, bShields: 1, includeSwing: false, debugTimeline: true });
assert.equal(result.timelineTrace.find(event => event.trainer === "A" && event.kind === "fast").damage, 1);
console.log(`Type effectiveness passed: ${checks} single/dual type combinations, ${sequence - 1} immunity damage replays, Rank 1 Altaria/Azumarill Dragon Breath = 1.`);
