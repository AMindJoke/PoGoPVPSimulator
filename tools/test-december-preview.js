"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const G = require("./build-great-league-meta-database");
const Season = require("../src/season/season-context");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const hash = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const html = read("PogoPvp.html");
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
const stop = scripts.findIndex(file => file.startsWith("src/season/season-context.js"));

async function bootstrap(search, stored) {
  const browser = { console, URL, URLSearchParams, setTimeout, clearTimeout,
    location: { search, href: `http://localhost/PogoPvp.html${search}#keep-team`, assign(url) { this.assigned = url; } },
    localStorage: { getItem: () => stored, setItem(_key, value) { browser.savedSeason = value; } } };
  browser.window = browser;
  browser.globalThis = browser;
  const context = vm.createContext(browser);
  function load(url) {
    const file = url.split("?")[0];
    vm.runInContext(read(file), context, { filename: file });
  }
  browser.document = {
    body: { dataset: {} },
    createElement: () => ({ remove() {} }),
    head: { appendChild(script) { load(script.src); queueMicrotask(() => script.onload()); } },
    write(markup) { for (const match of markup.matchAll(/<script src="([^"]+)"/g)) load(match[1]); }
  };
  scripts.slice(0, stop + 1).forEach(load);
  if (browser.PvPeakSeasonGeneratedLoader) await browser.PvPeakSeasonGeneratedLoader.load();
  const season = browser.PvPeakSeasonContext.create({
    catalog: browser.BATTLE_SEASON_CATALOG, gameMaster: browser.BATTLE_GAMEMASTER,
    defaultMovesets: browser.BATTLE_DEFAULT_MOVESETS, rankings: browser.GREAT_LEAGUE_RANKINGS,
    rankingDetails: browser.GREAT_LEAGUE_RANKING_DETAILS,
    location: browser.location, storage: browser.localStorage,
    validation: { additionalPokemon: browser.BATTLE_MEGA_OVERLAY.pokemon }
  });
  assert.equal(season.errors.length, 0);
  assert.equal(season.previewAvailable, true);
  assert.notEqual(season.current.id, season.next.id);
  const controls = { seasonBanner: { hidden: true }, seasonBannerAction: {}, seasonBannerText: {} };
  Object.assign(browser, { seasonContext: season, activeSeasonData: season.activeSeasonData, $: id => controls[id] });
  const start = html.indexOf("    function initSeasonControls()");
  const end = html.indexOf("    function init()", start);
  vm.runInContext(html.slice(start, end) + "\ninitSeasonControls();", context);
  assert.equal(controls.seasonBanner.hidden, false);
  controls.seasonBannerAction.onclick();
  const target = new URL(browser.location.assigned);
  assert.equal(target.hash, "#keep-team");
  assert.equal(target.searchParams.get("view"), new URL(browser.location.href).searchParams.get("view"));
  const preview = season.activeSeasonData.status === "preview";
  assert.equal(controls.seasonBannerAction.textContent, preview ? "Return to Current Season" : "Preview Next Season");
  assert.equal(target.searchParams.get("season"), preview ? null : "december-2026");
  assert.equal(browser.savedSeason, preview ? "twilight-trails" : "december-2026");
  return { browser, season };
}

async function main() {
  for (const [search, stored, expected] of [
    ["?view=home", "", "current"],
    ["?view=simulator&season=december-2026", "", "preview"],
    ["?view=team-builder", "december-2026", "preview"],
    ["?view=meta&season=twilight-trails", "december-2026", "current"]
  ]) {
    const { browser, season } = await bootstrap(search, stored);
    const data = season.activeSeasonData;
    assert.equal(data.status, expected);
    assert.equal(data.gameMaster.moves.find(m => m.moveId === "ROCK_THROW").energyGain, expected === "preview" ? 4 : 5);
    assert.equal(data.gameMaster.moves.find(m => m.moveId === "SYNCHRONOISE").energy, expected === "preview" ? 40 : 50);
    assert.equal(data.gameMaster.pokemon.find(p => p.speciesId === "electabuzz_shadow").fastMoves.includes("KARATE_CHOP"), expected === "preview");
    if (expected === "preview") {
      assert.equal(data.rankings.metadata.seasonId, "december-2026");
      assert.equal(data.rankings, browser.DECEMBER_2026_RANKINGS);
      assert.equal(data.rankingDetails, browser.DECEMBER_2026_RANKING_DETAILS);
      assert.equal(data.defaultMovesets, browser.DECEMBER_2026_DEFAULT_MOVESETS);
      const overlay = Season.applyPokemonMoveOverrides(browser.BATTLE_MEGA_OVERLAY, season.next.pokemonMoveOverrides);
      assert(overlay.pokemon.find(p => p.speciesId === "clefable_mega").chargedMoves.includes("MYSTICAL_FIRE"));
      assert(overlay.pokemon.find(p => p.speciesId === "starmie_mega").chargedMoves.includes("TRIPLE_AXEL"));
    } else assert.equal(data.rankings, browser.GREAT_LEAGUE_RANKINGS);
  }

  const data = G.generationData("december-2026");
  const currentDefaults = JSON.parse(read("data/seasons/twilight-trails/default-movesets.json"));
  for (const id of ["morpeko_full_belly", "persian", "persian_shadow"]) {
    assert.equal(JSON.stringify(data.standardMovesets[id]), JSON.stringify(currentDefaults[id]),
      `${id}: an unchanged moveset must inherit the published current-season default`);
  }
  const ranking = JSON.parse(read("data/seasons/december-2026/great-league-rankings.json"));
  const defaults = JSON.parse(read("data/seasons/december-2026/default-movesets.json"));
  for (const [id, fast, charged] of [
    ["clefable", "FAIRY_WIND", ["MOONBLAST", "MYSTICAL_FIRE"]],
    ["cradily", "ACID", ["ROCK_TOMB", "GRASS_KNOT"]],
    ["cradily_b", "ACID", ["ROCK_TOMB", "GRASS_KNOT"]],
    ["eelektross", "VOLT_SWITCH", ["LUNGE", "PSYCHIC_FANGS"]],
    ["houndstone", "BITE", ["SHADOW_BALL", "PSYCHIC_FANGS"]],
    ["pidgeot", "WING_ATTACK", ["BRAVE_BIRD", "FEATHER_DANCE"]],
    ["starmie", "PSYWAVE", ["SURF", "TRIPLE_AXEL"]]
  ]) {
    const entry = ranking.entries.find(candidate => candidate.id === id);
    assert.deepEqual(defaults[id], { fast, charged }, id);
    assert.deepEqual(entry.moveset || entry.moves, { fast, charged }, id);
  }
  const details = JSON.parse(read("data/seasons/december-2026/great-league-ranking-details.json"));
  assert.equal(ranking.metadata.gameMasterHash, hash(data.gameMaster));
  assert.equal(ranking.metadata.movesetHash, G.movesetHash(data.standardMovesets));
  assert.equal(ranking.metadata.fullCandidateCount, ranking.entries.length);
  assert.equal(ranking.metadata.completedSimulations, ranking.metadata.cells);
  assert.equal(ranking.metadata.failedSimulations, 0);
  assert.equal(details.sourceGameMasterHash, ranking.metadata.gameMasterHash);
  assert.equal(details.sourceMovesetHash, ranking.metadata.movesetHash);
  assert.equal(details.sourceRankingGeneratedAt, ranking.metadata.generatedAt);
  assert.equal(Object.keys(details.entries).length, ranking.entries.length);
  const top = new Map(ranking.entries.slice(0, 50).map(p => [p.id, p.rank]));
  for (const entry of ranking.entries) {
    assert.equal(details.entries[entry.id].top50Coverage, 50 - Number(top.has(entry.id)));
    for (const row of [...details.entries[entry.id].wins, ...details.entries[entry.id].losses]) {
      assert.equal(row.rank, top.get(row.id));
    }
  }
  const moves = new Map(data.gameMaster.moves.map(m => [m.moveId, G.normalizeMove(m)]));
  const pokemon = new Map(data.gameMaster.pokemon.map(p => G.normalizePokemon(p, moves)).map(p => [p.id, p]));
  G.addRankingVariants(pokemon, data.standardMovesets);
  const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true, strict: true });
  let count = 0;
  for (const entry of ranking.entries.slice(0, 10)) {
    const detail = details.entries[entry.id];
    for (const row of [...detail.wins.slice(0, 2), ...detail.losses.slice(0, 2)]) {
      const config = G.createBattleConfig(pokemon.get(entry.id), pokemon.get(row.id), G.RANK1_PROFILE,
        moves, data.standardMovesets, pokemon);
      const result = adapter.simulate({ id: ++count, key: `${entry.id}:${row.id}`, config,
        aShields: 1, bShields: 1, includeSwing: false });
      assert.equal(result.score, row.score, `${entry.id}/${row.id}: saved score differs from canonical replay`);
    }
  }
  console.log(`December preview passed: URL/storage switching, buttons, Mega move pools, ${ranking.entries.length} entries, ${count} canonical replays.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
