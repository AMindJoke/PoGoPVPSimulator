"use strict";

const fs = require("fs");
const path = require("path");
const { buildRankingRatings, selectRelevantMatchups } = require("../src/analysis/ranking-details");
const { inflateCacheResult, MATCHUP_SCORE_VERSION } = require("../src/analysis/matchup-inspector");

const root = path.resolve(__dirname, "..");
const seasonArg = process.argv.find(arg => arg.startsWith("--season="));
const seasonId = (seasonArg ? seasonArg.split("=").slice(1).join("=") : "").replace(/[^a-z0-9_.-]+/gi, "_");
const outputRoot = path.join(root, ...(seasonId ? ["data", "seasons", seasonId] : ["data"]));
const rankingPath = path.join(outputRoot, "great-league-rankings.json");
const analysisPath = path.join(outputRoot, "analysis", "great-league-analysis.json");
const cacheDir = path.join(outputRoot, "matchup-cache", "great-league", "rank1");
const fallbackCacheDir = seasonId ? path.join(root, "data", "matchup-cache", "great-league", "rank1") : null;
const outputJson = path.join(outputRoot, "great-league-ranking-details.json");
const outputJs = path.join(outputRoot, "great-league-ranking-details.js");
const pokemonArg = process.argv.find(arg => arg.startsWith("--pokemon="));
const selectiveIds = new Set((pokemonArg ? pokemonArg.split("=").slice(1).join("=") : "")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean));

const ranking = JSON.parse(fs.readFileSync(rankingPath, "utf8"));
const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
const entries = (ranking.entries || []).filter(entry => entry.profile === "rank1");
const rankById = new Map(entries.map(entry => [entry.id, Number(entry.rank)]));
const entryById = new Map(entries.map(entry => [entry.id, entry]));
const analysisById = new Map((analysis.entries || []).map(entry => [entry.pokemon?.a?.id, entry]));
const existingOutput = selectiveIds.size && fs.existsSync(outputJson)
  ? JSON.parse(fs.readFileSync(outputJson, "utf8"))
  : null;
const details = existingOutput?.entries && typeof existingOutput.entries === "object"
  ? { ...existingOutput.entries }
  : {};

entries.forEach((entry, index) => {
  if (selectiveIds.size && !selectiveIds.has(entry.id)) return;
  const cachePath = path.join(cacheDir, `${entry.id}.json`);
  const fallbackCachePath = fallbackCacheDir ? path.join(fallbackCacheDir, `${entry.id}.json`) : null;
  const cellsByOpponent = new Map();
  const ingestCache = file => {
    if (!file || !fs.existsSync(file)) return;
    const cache = JSON.parse(fs.readFileSync(file, "utf8"));
    Object.entries(cache.cells || {}).forEach(([key, value]) => {
      if (!key.endsWith("|1-1|standard")) return;
      const signature = key.slice(0, key.indexOf("|"));
      let opponentId = signature.slice(0, signature.indexOf(":"));
      if (signature.startsWith("{")) {
        try {
          opponentId = JSON.parse(signature).id || opponentId;
        } catch (_) {}
      }
      const score = Number(inflateCacheResult(value)?.score);
      if (opponentId !== entry.id && Number.isFinite(score)) cellsByOpponent.set(opponentId, { opponentId, score });
    });
  };
  ingestCache(fallbackCachePath);
  ingestCache(cachePath);
  const cells = [...cellsByOpponent.values()];
  const relevant = selectRelevantMatchups(cells, rankById, 5);
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
  scoreVersion: MATCHUP_SCORE_VERSION,
  entries: details
};
const json = `${JSON.stringify(output, null, 2)}\n`;
fs.writeFileSync(outputJson, json);
const globalName = seasonId ? "TWILIGHT_TRAILS_RANKING_DETAILS" : "GREAT_LEAGUE_RANKING_DETAILS";
fs.writeFileSync(outputJs, `window.${globalName} = ${JSON.stringify(output)};\n`);
process.stdout.write(`Wrote ${outputJson} and ${outputJs}\n`);
