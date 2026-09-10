"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { inflateCacheResult, MATCHUP_SCORE_VERSION } = require("../src/analysis/matchup-inspector");
const { buildRankingRatings, selectRelevantMatchups } = require("../src/analysis/ranking-details");
const { validateDataset } = require("./validate-great-league-dataset");
const root = path.resolve(__dirname, "..");
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const write = (p, text) => fs.writeFileSync(path.join(root, p), text);
const current = read("data/great-league-rankings.json");
const refreshArg = process.argv.find(a => a.startsWith("--moveset-refresh="));
const refreshDir = refreshArg ? refreshArg.slice("--moveset-refresh=".length) : null;
const refresh = refreshDir ? read(`${refreshDir}/manifest.json`) : null;
if (refresh) {
  assert.ok(refresh.completed);
  assert.equal(refresh.sourceGeneratedAt, current.metadata.generatedAt);
}
const approvedPath = refreshDir ? `${refreshDir}/ranking-comparison.json` : "reports/top100-fixed-weight-score-correction-20260909.json";
const approved = refresh ? { entries: current.entries, weights: current.metadata.weightUpdate.weights, checkedCells: current.metadata.cells } : read(approvedPath);
const analysis = read("data/analysis/great-league-analysis.json");
const technicalScores = new Map(analysis.entries.map(e => [e.pokemon?.a?.id, e.complexity?.score]));
const byId = new Map(current.entries.map(e => [e.id, e]));
const ranks = new Map(approved.entries.map(e => [e.id, e.rank]));
const categories = ["closer", "core", "lead"];
const geometric = values => Math.round(Math.exp(values.reduce((s, v) => s + Math.log(v), 0) / values.length) * 10);
const rating = score => Math.round(Math.max(1, Math.min(100, score / 10)));
const entries = [], details = {}, matchupRows = new Map();
const started = Date.now();
let checked = 0;
for (const selected of approved.entries) {
  const entry = structuredClone(byId.get(selected.id));
  assert.ok(entry);
  if (refresh?.selected[entry.id]) entry.moveset = refresh.selected[entry.id];
  const cache = read(`data/seasons/twilight-trails/matchup-cache/great-league/rank1/${entry.id}.json`);
  assert.equal(cache.matrixVersion, current.metadata.engineVersion);
  assert.equal(cache.dataVersion, current.metadata.dataVersion);
  if (refresh) {
    const overlay = read(`${refreshDir}/overlays/${entry.id}.json`);
    if (overlay.replaceAll) cache.cells = overlay.cells;
    else {
      cache.cells = Object.fromEntries(Object.entries(cache.cells).filter(([key]) => !refresh.selected[JSON.parse(key.split("|")[0]).id]));
      Object.assign(cache.cells, overlay.cells);
    }
  }
  const stats = categories.map(() => ({ sum: 0, squares: 0, weighted: 0, count: 0, wins: 0, losses: 0, ties: 0 }));
  const cells = [], seen = new Set();
  for (const [key, value] of Object.entries(cache.cells)) {
    const [signature, state, mode] = key.split("|");
    const s = ["0-0", "1-1", "2-2"].indexOf(state);
    if (s < 0 || mode !== "standard") continue;
    const id = JSON.parse(signature).id;
    if (id === entry.id || !ranks.has(id)) continue;
    assert.ok(!seen.has(`${id}/${s}`)); seen.add(`${id}/${s}`);
    const score = inflateCacheResult(value).score;
    assert.equal(score, Array.isArray(value) ? value[0] : value.score);
    const stat = stats[s];
    stat.sum += score; stat.squares += score * score; stat.count++;
    stat.weighted += score * approved.weights[id];
    stat[score > 500 ? "wins" : score < 500 ? "losses" : "ties"]++;
    if (s === 1) cells.push({ opponentId: id, score });
    checked++;
  }
  const weighted = stats.map(s => s.weighted / (1 - approved.weights[entry.id]));
  const calculatedScore = geometric(weighted.map(rating));
  if (!refresh) assert.equal(calculatedScore, selected.overallScore);
  stats.forEach((s, i) => {
    assert.equal(s.count, approved.entries.length - 1);
    const category = entry.categoryScores[categories[i]];
    Object.assign(category, { averageScore: Math.round(s.sum / s.count), weightedScore: Math.round(weighted[i]), competitiveScore: Math.round(weighted[i]), rawRating: rating(s.sum / s.count), weightedRating: rating(weighted[i]), competitiveRating: rating(weighted[i]), score: rating(weighted[i]), matchups: s.count, wins: s.wins, losses: s.losses, ties: s.ties });
    entry.shieldStates[`${i}-${i}`] = { averageScore: category.averageScore, matchups: s.count, wins: s.wins, losses: s.losses, ties: s.ties };
  });
  const count = stats.reduce((s, x) => s + x.count, 0), sum = stats.reduce((s, x) => s + x.sum, 0);
  Object.assign(entry, { rank: selected.rank, overallScore: selected.overallScore, competitiveScore: selected.overallScore, weightedScore: selected.overallScore, rawScore: geometric(stats.map(s => rating(s.sum / s.count))), averageScore: Math.round(sum / count), weightedAverageScore: Math.round(weighted.reduce((a, b) => a + b) / 3), externalWeightedAverageScore: Math.round(weighted.reduce((a, b) => a + b) / 3), scoreStdDev: Number(Math.sqrt(Math.max(0, stats.reduce((s, x) => s + x.squares, 0) / count - (sum / count) ** 2)).toFixed(2)), matchups: count, wins: stats.reduce((s, x) => s + x.wins, 0), losses: stats.reduce((s, x) => s + x.losses, 0), ties: stats.reduce((s, x) => s + x.ties, 0) });
  entry.winRate = Number((entry.wins / count).toFixed(4));
  if (refresh) entry.overallScore = entry.competitiveScore = entry.weightedScore = calculatedScore;
  if (refresh?.selected[entry.id]) {
    for (const category of Object.values(entry.categoryScores)) {
      category.moveUsage = { fast: [{ id: entry.moveset.fast, uses: category.matchups }], charged: entry.moveset.charged.map(id => ({ id, uses: category.matchups })) };
    }
  }
  entries.push(entry);
  matchupRows.set(entry.id, cells);
  if (entries.length % 100 === 0) console.log(`${entries.length}/${approved.entries.length}`);
}
assert.equal(checked, approved.checkedCells);
if (refresh) {
  entries.sort((a, b) => b.overallScore - a.overallScore || b.averageScore - a.averageScore || b.winRate - a.winRate || a.name.localeCompare(b.name));
  entries.forEach((entry, i) => { entry.rank = i + 1; ranks.set(entry.id, entry.rank); });
  write(approvedPath, JSON.stringify({ weights: approved.weights, checkedCells: checked, entries, sourceGeneratedAt: current.metadata.generatedAt }, null, 2) + "\n");
}
for (const entry of entries) {
  const relevant = selectRelevantMatchups(matchupRows.get(entry.id), ranks, 5);
  const row = r => ({ id: r.opponentId, name: byId.get(r.opponentId).name, rank: r.opponentRank, score: r.score });
  details[entry.id] = { ratings: buildRankingRatings(entry, { complexity: { score: technicalScores.get(entry.id) } }), wins: relevant.wins.map(row), losses: relevant.losses.map(row), ...(refresh?.alternatives[entry.id] ? { alternativeMovesets: refresh.alternatives[entry.id] } : {}) };
}
const generatedAt = new Date().toISOString();
const metadata = { ...current.metadata, generatedAt, generator: "tools/publish-approved-top100-ranking.js", scoreVersion: MATCHUP_SCORE_VERSION, weightSource: approvedPath, weightMode: "fixed-approved-top100", weightUpdate: { method: "fixed-approved-top100-v1", weights: approved.weights }, generationDurationSeconds: (Date.now() - started) / 1000, matchupCache: { enabled: true, hits: checked, misses: 0, writes: 0, filesRead: entries.length, filesWritten: 0 }, rankingModel: { ...current.metadata.rankingModel, weighting: "fixed-approved-top100", weightingIterations: 0, competitiveWeightingIterations: 0, tieBreak: "Approved comparison order retained; aggregate statistics recomputed", notes: ["Fixed opponent weights from the approved meta70 experiment; no additional weight iteration.", "70% reference top100, 30% remaining field; equal 0/1/2 shield scenarios.", "Modern cache scores preserved exactly. Raw aggregates and matchup details regenerated."] } };
const ranking = { ...current, metadata, entries };
if (refresh) {
  metadata.movesetRefresh = { source: `${refreshDir}/manifest.json`, simulations: refresh.simulations, policy: refresh.rankingPolicy };
  metadata.rankingModel.tieBreak = "Corrected full-field average, win rate, then name";
}
const validation = validateDataset(ranking);
assert.equal(validation.issues.length, 0, JSON.stringify(validation));
if (!refresh) assert.deepEqual(entries.map(e => [e.id, e.rank, e.overallScore]), approved.entries.map(e => [e.id, e.rank, e.overallScore]));
const json = JSON.stringify(ranking, null, 2) + "\n";
write("data/great-league-rankings.json", json);
write("data/rankings/great-league-full.json", json);
write("data/great-league-rankings.js", `window.GREAT_LEAGUE_RANKINGS = ${json};\n`);
const detailOutput = { schemaVersion: 1, generatedAt, sourceRankingGeneratedAt: generatedAt, scoreVersion: MATCHUP_SCORE_VERSION, entries: details };
write("data/great-league-ranking-details.json", JSON.stringify(detailOutput, null, 2) + "\n");
write("data/great-league-ranking-details.js", `window.GREAT_LEAGUE_RANKING_DETAILS = ${JSON.stringify(detailOutput)};\n`);
console.log(`Published local assets: ${entries.length} entries, ${checked} cells; approved order and scores verified.`);
