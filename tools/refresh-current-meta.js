"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { execFileSync } = require("node:child_process");
const G = require("./build-great-league-meta-database");
const { MATCHUP_SCORE_VERSION } = require("../src/analysis/matchup-inspector");

const root = path.resolve(__dirname, "..");
const season = "twilight-trails";
const seasonRoot = path.join(root, "data", "seasons", season);
const currentRoot = path.join(root, "data");
const inputRoot = `data/ranking-inputs/${season}`;
const rankingName = "great-league-rankings";
const detailsName = "great-league-ranking-details";
const seedPath = path.join(currentRoot, "great-league-meta.json");

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const same = (a, b, label) => assert.deepStrictEqual(a, b, label);
const ranked = ranking => [...ranking.entries].sort((a, b) => a.rank - b.rank);

function readScript(file, globalName) {
  const browser = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, "utf8"), browser, { filename: file });
  return JSON.parse(JSON.stringify(browser.window[globalName]));
}

function verifyBundle(ranking, details, seed, sourceData) {
  const entries = ranked(ranking);
  assert.equal(ranking.metadata.seasonId, season);
  assert.equal(ranking.metadata.opponentPokemonCount, seed.pokemon.length);
  assert.equal(new Set(seed.pokemon).size, seed.pokemon.length, "Duplicate meta opponents");
  assert.equal(ranking.metadata.pokemonCount, entries.length);
  assert.equal(ranking.metadata.fullCandidateCount, entries.length);
  assert.equal(ranking.metadata.completedSimulations, ranking.metadata.cells);
  assert.equal(ranking.metadata.failedSimulations, 0);
  assert.equal(ranking.metadata.matrixVersion, G.MATRIX_VERSION);
  assert.equal(ranking.metadata.scoreVersion, MATCHUP_SCORE_VERSION);
  same(ranking.metadata.simulationSettings, { ivProfile: "rank1", baiting: "selective", shieldMode: "always", startEnergy: 0 }, "Ranking simulation settings are missing or inconsistent.");
  assert.equal(ranking.metadata.gameMasterHash,
    require("node:crypto").createHash("sha256").update(JSON.stringify(sourceData.gameMaster)).digest("hex"),
    "Ranking Game Master hash is stale");
  assert.equal(ranking.metadata.movesetHash, G.movesetHash(sourceData.standardMovesets),
    "Ranking moveset hash is stale");
  assert.equal(details.sourceRankingGeneratedAt, ranking.metadata.generatedAt);
  assert.equal(details.sourceGameMasterHash, ranking.metadata.gameMasterHash);
  assert.equal(details.sourceMovesetHash, ranking.metadata.movesetHash);
  assert.equal(details.sourceMatrixVersion, ranking.metadata.matrixVersion);
  assert.equal(details.scoreVersion, ranking.metadata.scoreVersion);
  assert.equal(details.top50Size, 50);
  assert.equal(Object.keys(details.entries).length, entries.length);
  const topRanks = new Map(entries.slice(0, 50).map(entry => [entry.id, entry.rank]));
  for (const entry of entries) {
    const detail = details.entries[entry.id];
    assert.ok(entry.build && [entry.build.ivAtk, entry.build.ivDef, entry.build.ivHp].every(iv => Number.isInteger(iv) && iv >= 0 && iv <= 15)
      && entry.build.cp > 0 && entry.build.cp <= 1500, `${entry.id}: missing or invalid saved build`);
    assert.ok(detail, `${entry.id}: missing details`);
    assert.equal(entry.matchups, seed.pokemon.length * ranking.metadata.shieldScenarios.length);
    assert.equal(detail.top50Coverage, 50 - Number(topRanks.has(entry.id)), `${entry.id}: incomplete top 50 cache`);
    for (const [kind, valid] of [["wins", score => score > 500], ["losses", score => score < 500]]) {
      assert.ok(Array.isArray(detail[kind]) && detail[kind].length <= 5, `${entry.id}: invalid ${kind} list`);
      for (const row of detail[kind]) {
        assert.equal(row.rank, topRanks.get(row.id), `${entry.id}: stale ${kind} rank for ${row.id}`);
        assert.ok(valid(row.score), `${entry.id}: invalid ${kind} score for ${row.id}`);
      }
    }
  }
  return entries;
}

function verifyPublished(sourceData) {
  const seed = read(seedPath);
  const ranking = read(path.join(currentRoot, `${rankingName}.json`));
  const details = read(path.join(currentRoot, `${detailsName}.json`));
  verifyBundle(ranking, details, seed, sourceData);
  for (const [base, prefix] of [[currentRoot, "GREAT_LEAGUE"], [seasonRoot, "TWILIGHT_TRAILS"]]) {
    same(read(path.join(base, `${rankingName}.json`)), ranking, `${base}: ranking differs`);
    same(read(path.join(base, `${detailsName}.json`)), details, `${base}: details differ`);
    same(readScript(path.join(base, `${rankingName}.js`), `${prefix}_RANKINGS`), ranking,
      `${base}: ranking script differs`);
    same(readScript(path.join(base, `${detailsName}.js`), `${prefix}_RANKING_DETAILS`), details,
      `${base}: details script differs`);
  }
  return ranking;
}

function runTool(script, args) {
  execFileSync(process.execPath, [path.join(root, "tools", script), ...args], {
    cwd: root, stdio: "inherit", maxBuffer: 16 * 1024 * 1024
  });
}

function prepare(sourceData, previous) {
  const relative = path.relative(root, fs.mkdtempSync(path.join(root, "reports", "meta-refresh-")));
  const output = name => path.join(relative, name).replaceAll("\\", "/");
  const rankingFile = output("ranking.json");
  const analysisFile = output("analysis.json");
  const detailsFile = output("details.json");
  const cacheArg = process.argv.find(arg => arg.startsWith("--cache-root="));
  const cacheRoot = cacheArg ? cacheArg.slice("--cache-root=".length) : `reports/meta-refresh-cache-${G.MATRIX_VERSION}`;
  runTool("build-great-league-meta-database.js", [
    `--season=${season}`, "--all-pokemon", "--opponents=meta", "--profiles=rank1",
    "--ranking-only", "--matchup-cache", "--native-worker", `--matchup-cache-root=${cacheRoot}`,
    ...(process.argv.includes("--cache-only") ? ["--cache-only"] : []), `--weight-source=${inputRoot}/weights-ranked-core.json`,
    "--weight-mode=prevalence", `--candidate-prior-source=${inputRoot}/expert-candidate-prior.json`,
    "--candidate-prior-weight=0.3", `--ranking-output=${rankingFile}`
  ]);
  runTool("fill-meta-top50-cache.js", [`--ranking=${rankingFile}`, `--cache-root=${cacheRoot}`]);
  runTool("analyze-great-league-dataset.js", [`--input=${rankingFile}`, `--output=${analysisFile}`]);
  runTool("build-ranking-details.js", [
    `--season=${season}`, `--ranking-input=${rankingFile}`, `--analysis-input=${analysisFile}`,
    `--details-output=${detailsFile}`, `--cache-root=${cacheRoot}/rank1`
  ]);
  const ranking = read(path.join(root, rankingFile));
  const details = read(path.join(root, detailsFile));
  verifyBundle(ranking, details, read(seedPath), sourceData);
  const oldTop = new Set(ranked(previous).slice(0, 50).map(entry => entry.id));
  const overlap = ranked(ranking).slice(0, 50).filter(entry => oldTop.has(entry.id)).length;
  assert.ok(overlap >= 40, `Top 50 overlap ${overlap}/50 is below the 40/50 safety threshold.`);
  console.log(`Prepared ${ranking.entries.length} entries and complete top 50 details. Top 50 overlap: ${overlap}/50.`);
  return { relative, ranking, details };
}

function writeAsset(base, name, value, globalName) {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(path.join(base, `${name}.json`), json);
  fs.writeFileSync(path.join(base, `${name}.js`), `window.${globalName} = ${JSON.stringify(value, null, 2)};\n`);
}

function nextOfflineCache() {
  const workerPath = path.join(root, "sw.js");
  const htmlPath = path.join(root, "PogoPvp.html");
  const worker = fs.readFileSync(workerPath, "utf8");
  const html = fs.readFileSync(htmlPath, "utf8");
  const match = worker.match(/const CACHE_VERSION = "(\d{4}-\d{2}-\d{2})-v(\d+)-[^"]+";/);
  assert.ok(match, "Unrecognized service-worker cache version");
  const current = `${match[1].replaceAll("-", "")}-v${match[2]}`;
  assert.ok(html.includes(`sw.js?v=${current}`), "HTML service-worker version does not match");
  const nextNumber = Number(match[2]) + 1;
  const next = `${match[1].replaceAll("-", "")}-v${nextNumber}`;
  const loaderPath = path.join(root, "data", "seasons", "season-generated-loader.js");
  const loader = fs.readFileSync(loaderPath, "utf8").replace(/const currentAssetVersion = "[^"]+";/, `const currentAssetVersion = "${next}-rankings";`);
  const rankingVersion = `great-league-${season}-confirmed-${G.MATRIX_VERSION.replace("battle-planner-", "")}-score-v5-${nextNumber}`;
  const descriptors = ["season-catalog.js", "next-season.js"].map(name => {
    const file = path.join(root, "data", "seasons", name);
    return { file, content: fs.readFileSync(file, "utf8").replace(/rankingVersion: "[^"]+"/, `rankingVersion: "${rankingVersion}"`) };
  });
  return {
    workerPath,
    htmlPath,
    loaderPath, loader, descriptors,
    worker: worker.replace(match[0], `const CACHE_VERSION = "${match[1]}-v${nextNumber}-meta-refresh";`)
      .replace(/(\.\/data\/great-league-(?:rankings|ranking-details)\.js)\?v=[^"]+/g, `$1?v=${next}-rankings`)
      .replace(/"\.\/data\/seasons\/season-generated-loader\.js(?:\?v=[^"]+)?"/, `"./data/seasons/season-generated-loader.js?v=${next}"`)
      .replace(/(\.\/src\/ui\/meta-quick-matchup\.js)\?v=[^"]+/g, `$1?v=${next}`),
    html: html.replace(`sw.js?v=${current}`, `sw.js?v=${next}`)
      .replace(/(data\/seasons\/season-generated-loader\.js)\?v=[^"]+/g, `$1?v=${next}`)
      .replace(/(src\/ui\/meta-quick-matchup\.js)\?v=[^"]+/g, `$1?v=${next}`)
  };
}

function main() {
  const mode = process.argv[2] || "--check";
  assert.ok(["--check", "--prepare", "--publish"].includes(mode), "Use --check, --prepare or --publish");
  const sourceData = G.generationData(season);
  if (mode === "--check") {
    const published = verifyPublished(sourceData);
    console.log(`Published meta verified: ${published.entries.length} entries, ${published.metadata.opponentPokemonCount} opponents.`);
    return;
  }
  const previous = read(path.join(currentRoot, `${rankingName}.json`));
  assert.ok(previous.entries?.length >= 50, "Published ranking is unavailable for the top 50 comparison");
  for (const name of ["weights-ranked-core.json", "expert-candidate-prior.json"]) {
    assert.ok(fs.existsSync(path.join(root, inputRoot, name)), `Missing versioned input: ${name}`);
  }
  const preparedArg = process.argv.find(arg => arg.startsWith("--prepared="));
  let prepared;
  if (preparedArg) {
    const folder = path.resolve(root, preparedArg.slice("--prepared=".length));
    const safeRelative = path.relative(path.join(root, "reports"), folder);
    assert.ok(!safeRelative.startsWith("..") && !path.isAbsolute(safeRelative), "Prepared release must be inside reports.");
    prepared = { relative: path.relative(root, folder), ranking: read(path.join(folder, "ranking.json")), details: read(path.join(folder, "details.json")) };
    verifyBundle(prepared.ranking, prepared.details, read(seedPath), sourceData);
    const oldTop = new Set(ranked(previous).slice(0, 50).map(entry => entry.id));
    assert.ok(ranked(prepared.ranking).slice(0, 50).filter(entry => oldTop.has(entry.id)).length >= 40, "Top 50 overlap below 40/50.");
  } else prepared = prepare(sourceData, previous);
  console.log(`Reviewable output: ${prepared.relative}`);
  if (mode === "--prepare") return;
  const backup = path.join(root, prepared.relative, "previous-assets");
  fs.mkdirSync(backup, { recursive: true });
  for (const [base, label] of [[currentRoot, "current"], [seasonRoot, "season"]]) {
    for (const name of [rankingName, detailsName]) for (const extension of ["json", "js"]) {
      const file = path.join(base, `${name}.${extension}`);
      fs.copyFileSync(file, path.join(backup, `${label}-${name}.${extension}`));
    }
  }
  const offlineCache = nextOfflineCache();
  writeAsset(currentRoot, rankingName, prepared.ranking, "GREAT_LEAGUE_RANKINGS");
  writeAsset(currentRoot, detailsName, prepared.details, "GREAT_LEAGUE_RANKING_DETAILS");
  writeAsset(seasonRoot, rankingName, prepared.ranking, "TWILIGHT_TRAILS_RANKINGS");
  writeAsset(seasonRoot, detailsName, prepared.details, "TWILIGHT_TRAILS_RANKING_DETAILS");
  fs.writeFileSync(offlineCache.workerPath, offlineCache.worker);
  fs.writeFileSync(offlineCache.htmlPath, offlineCache.html);
  fs.writeFileSync(offlineCache.loaderPath, offlineCache.loader);
  for (const descriptor of offlineCache.descriptors) fs.writeFileSync(descriptor.file, descriptor.content);
  verifyPublished(sourceData);
  console.log("Published files updated and verified. Review the diff before committing or pushing.");
}

if (require.main === module) main();
module.exports = { verifyBundle, verifyPublished };
