"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {
  selectRoleRankingSource, rankingDetailsCurrent, rankingDetailsState
} = require("../src/analysis/ranking-details");

const categories = Object.fromEntries(["lead", "closer", "switch", "charger", "attacker"].map(role => [role, { score: 80 }]));
const base = {
  metadata: { seasonId: "current", generatedAt: "2026-09-29T13:16:44.821Z", movesetHash: "new-moves", gameMasterHash: "gm", matrixVersion: "v45" },
  entries: [
    { id: "first", profile: "rank1", rank: 1, categoryScores: categories },
    { id: "outside", profile: "rank1", rank: 51, categoryScores: categories }
  ]
};
const oldRoles = { ...base, metadata: { ...base.metadata, generatedAt: "2026-09-18T18:16:18.771Z", movesetHash: "old-moves" } };
const details = {
  sourceRankingGeneratedAt: base.metadata.generatedAt,
  sourceMovesetHash: base.metadata.movesetHash,
  sourceGameMasterHash: base.metadata.gameMasterHash,
  sourceMatrixVersion: base.metadata.matrixVersion,
  top50Size: 50,
  entries: { first: { top50Coverage: 49, wins: [], losses: [] }, outside: { top50Coverage: 50 } }
};
assert.equal(selectRoleRankingSource(base, null, "current"), base, "Embedded role scores work before the separate file arrives.");
assert.equal(selectRoleRankingSource(base, oldRoles, "current"), base, "The late arrival of an older role file must not roll back the ranking.");
assert.equal(selectRoleRankingSource(base, oldRoles, "preview"), null, "Current-season data cannot leak into a different season.");
const futureRoles = { ...base, metadata: { ...base.metadata, generatedAt: "2026-10-01T00:00:00Z" } };
assert.equal(selectRoleRankingSource(base, futureRoles, "current"), futureRoles);
assert.equal(rankingDetailsCurrent(details, oldRoles), false);
assert.equal(rankingDetailsCurrent(details, futureRoles), false, "A newer ranking still requires matching matchup details.");
assert.equal(rankingDetailsCurrent(details, selectRoleRankingSource(base, oldRoles, "current")), true);
assert.equal(rankingDetailsCurrent({ top50Size: 50 }, { metadata: {} }), false, "Missing fingerprints must never count as a valid generation.");
assert.equal(rankingDetailsState(details, base, "first"), "ready");
assert.equal(rankingDetailsState(details, base, "outside"), "ready");
assert.equal(rankingDetailsState(details, base, "absent"), "missing");
assert.equal(rankingDetailsState({ ...details, entries: { first: { top50Coverage: 48 } } }, base, "first"), "incomplete");
assert.equal(rankingDetailsState(details, oldRoles, "first"), "stale");
assert.equal(rankingDetailsState(details, base, "first", "rank1", { loading: true }), "loading");
assert.equal(rankingDetailsState(details, base, "first", "rank1", { error: "Network failure" }), "error");
assert.equal(rankingDetailsState(details, base, "first", "rank1", { engineVersion: "v46" }), "engine-stale",
  "Matching ranking/details fingerprints must not present an old engine's wins as current.");
assert.equal(rankingDetailsState(details, base, "first", "rank1", { engineVersion: "v45" }), "ready");
assert.equal(rankingDetailsState(details, base, "absent", "rank1", { engineVersion: "v46" }), "missing");
assert.equal(rankingDetailsState({ ...details, entries: { first: { top50Coverage: 48 } } }, base, "first", "rank1", { engineVersion: "v46" }), "incomplete");

// Execute the actual UI presenter: selected role rank is not source Overall rank,
// and an unavailable matchup must not suppress the role summary or alternatives.
const html = fs.readFileSync("PogoPvp.html", "utf8");
const render = html.slice(html.indexOf("    function metaRankingDetailsHtml(entry)"), html.indexOf("    function metaAlternativeMovesets(entry, detail)"));
const context = {
  rankingDetailsPresenter: { rankingDetailsState }, metaRankingDetails: details,
  activeMetaRankingSource: () => base, metaRankingPreferredProfile: "rank1",
  metaRankingLoading: false, metaRankingLoadError: "", metaRankingRole: "lead",
  battleEngineVersion: "v45",
  currentMetaMatchupRows: rows => rows, metaAlternativeMovesets: () => [],
  metaRankingRoleLabel: () => "Lead", metaRankingRoleDefinition: () => ({ short: "1-1 shields" }),
  escapeHtml: value => value, metaMatchupGroup: label => `<section>${label}</section>`
};
vm.createContext(context);
vm.runInContext(render, context);
const entry = { p: { id: "first" }, rankingData: { rank: 70 }, roleSnapshot: { score: 80 } };
assert.match(context.metaRankingDetailsHtml(entry), /Overall Key Wins/);
context.battleEngineVersion = "v46";
const historical = context.metaRankingDetailsHtml(entry);
assert.match(historical, /data-meta-detail-state="engine-stale"/);
assert.match(historical, /Overall Key Wins · Top 50 snapshot/);
assert.match(historical, /Open a matchup/);
assert.match(historical, /Saved results · older simulator/);
assert.match(historical, /Saved: v45\. Live: v46\. Results may differ/);
context.battleEngineVersion = "v45";
context.metaRankingDetails = { ...details, sourceMovesetHash: "outdated" };
const unavailable = context.metaRankingDetailsHtml(entry);
assert.match(unavailable, /data-meta-detail-state="stale"/);
assert.match(unavailable, /Lead role summary/);
assert.doesNotMatch(unavailable, /being updated/);
console.log("Meta details availability tests passed.");
