"use strict";

const fs = require("fs");
const path = require("path");
const { buildRankingRatings, selectRelevantMatchups } = require("../src/analysis/ranking-details");

const root = path.resolve(__dirname, "..");
const rankingPath = path.join(root, "data", "great-league-rankings.json");
const analysisPath = path.join(root, "data", "analysis", "great-league-analysis.json");
const cacheDir = path.join(root, "data", "matchup-cache", "great-league", "rank1");
const outputJson = path.join(root, "data", "great-league-ranking-details.json");
const outputJs = path.join(root, "data", "great-league-ranking-details.js");

const ranking = JSON.parse(fs.readFileSync(rankingPath, "utf8"));
const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
const entries = (ranking.entries || []).filter(entry => entry.profile === "rank1");
const rankById = new Map(entries.map(entry => [entry.id, Number(entry.rank)]));
const entryById = new Map(entries.map(entry => [entry.id, entry]));
const analysisById = new Map((analysis.entries || []).map(entry => [entry.pokemon?.a?.id, entry]));
const details = {};

entries.forEach((entry, index) => {
  const cachePath = path.join(cacheDir, `${entry.id}.json`);
  const cells = [];
  if (fs.existsSync(cachePath)) {
    const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    Object.entries(cache.cells || {}).forEach(([key, value]) => {
      if (!key.endsWith("|1-1|standard")) return;
      const opponentId = key.slice(0, key.indexOf(":"));
      const score = Number(Array.isArray(value) ? value[0] : value?.score);
      if (opponentId !== entry.id && Number.isFinite(score)) cells.push({ opponentId, score });
    });
  }
  const relevant = selectRelevantMatchups(cells, rankById, 3);
  const mapRow = row => ({
    id: row.opponentId,
    name: entryById.get(row.opponentId)?.name || row.opponentId,
    rank: row.opponentRank,
    score: Math.round(row.score)
  });
  details[entry.id] = {
    ratings: buildRankingRatings(entry, analysisById.get(entry.id) || {}),
    wins: relevant.wins.map(mapRow),
    losses: relevant.losses.map(mapRow)
  };
  if ((index + 1) % 100 === 0) process.stdout.write(`Prepared ${index + 1}/${entries.length}\n`);
});

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceRankingGeneratedAt: ranking.metadata?.generatedAt || null,
  entries: details
};
const json = `${JSON.stringify(output, null, 2)}\n`;
fs.writeFileSync(outputJson, json);
fs.writeFileSync(outputJs, `window.GREAT_LEAGUE_RANKING_DETAILS = ${JSON.stringify(output)};\n`);
process.stdout.write(`Wrote ${outputJson} and ${outputJs}\n`);
