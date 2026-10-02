"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");
const html = fs.readFileSync("PogoPvp.html", "utf8");
const tableStart = html.indexOf("    const cpMultipliers = [");
const tableEnd = html.indexOf("];", tableStart) + 2;
const statsStart = html.indexOf("    function statsForIvSpread(");
const statsEnd = html.indexOf("    function ivRank(", statsStart);
assert(tableStart >= 0 && statsStart >= 0 && statsEnd > statsStart);
const ui = { ivRank: () => ({ rank: 0, percent: 0, statProduct: 0 }) };
vm.createContext(ui);
vm.runInContext(html.slice(tableStart, tableEnd) + html.slice(statsStart, statsEnd), ui);
const runtime = R.createRuntime();
const fields = ["level", "cp", "attack", "defense", "hp", "ivAtk", "ivDef", "ivHp"];
const values = stats => fields.map(field => stats[field]);
let comparisons = 0;
for (const id of ["sableye", "empoleon", "florges", "altaria", "vigoroth", "ninetales_shadow", "melmetal", "corsola_galarian", "chansey", "magikarp"]) {
  const p = runtime.pokemonMap.get(id);
  for (const atk of [0, 4, 8, 15]) for (const def of [0, 5, 13, 15]) for (const hp of [0, 7, 14, 15]) {
    const generated = G.statsForIvSpread(p, atk, def, hp);
    assert.deepEqual(values(generated), values(ui.statsForIvSpread(p, atk, def, hp)), `${id} ${atk}/${def}/${hp}`);
    comparisons++;
  }
}
for (const id of ["sableye", "empoleon", "altaria"]) {
  const p = runtime.pokemonMap.get(id);
  let best = null;
  for (let atk = 0; atk <= 15; atk++) for (let def = 0; def <= 15; def++) for (let hp = 0; hp <= 15; hp++) {
    const stats = ui.statsForIvSpread(p, atk, def, hp);
    const product = stats.attack * stats.defense * stats.hp;
    if (!best || product > best.product) best = { stats, product };
  }
  const rank1 = G.rank1Stats(p);
  assert.equal(rank1.statsFormulaVersion, 2, "Old cached ranks must not survive a CP formula change.");
  assert.deepEqual(values(rank1), values(best.stats), `${id}: rank 1 must use Battle's CP cap.`);
}
assert.equal(G.statsForIvSpread(runtime.pokemonMap.get("sableye"), 4, 15, 15).cp, 1496);
console.log(`Generation/Battle build parity passed: ${comparisons} IV spreads and 3 complete rank-1 searches.`);
