"use strict";
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const Analysis = require("../src/team-builder/team-builder-analysis.js");
const State = require("../src/team-builder/team-builder-state.js");
const Forms = require("../src/battle/pokemon-form.js");
const html = fs.readFileSync(require("node:path").join(__dirname, "..", "PogoPvp.html"), "utf8");
const p = (id, dex, extra = {}) => ({ id, dex, released: true, fast: ["FAST"], charged: ["C1", "C2"], form: { kind: "standard" }, ...extra });
const roster = [p("already", 1), p("shadow", 1), p("outside-meta", 2), p("unreleased", 3, { released: false }), p("mega", 4, { form: { isMega: true } }), p("primal", 5, { form: { isPrimal: true } }), p("one-charge", 6, { charged: ["C1"] }), p("giratina_altered", 7), p("mewtwo_armored", 8), p("over-cap", 9)];
const body = html.slice(html.indexOf("    function teamBuilderEligibleOptimizationMembers() {"), html.indexOf("    function teamBuilderEligibleReplacementMembers()"));
const context = { metaRankingPreferredProfile: "rank1", metaRankingData: { entries: roster.map((p,i)=>({id:p.id,rank:i+1,profile:"rank1"})) }, allPokemon: roster, teamBuilderState: { team: [{ pokemonId: "already", dex: 1 }] }, window: { PvPeakTeamBuilder: State, PvPeakTeamBuilderAnalysis: Analysis }, findPokemon: id => roster.find(p => p.id === id), selectedChargedMoveLimit: () => 2, teamBuilderDefaultMember: p => ({ pokemonId: p.id, dex: p.dex, chargedMoveIds: ["C1", "C2"], build: { cp: p.id === "over-cap" ? 1800 : 1499 } }) };
vm.createContext(context);
vm.runInContext(body, context);
assert.deepEqual(Array.from(context.teamBuilderEligibleOptimizationMembers(), x => x.candidateId), ["outside-meta"]);
assert.deepEqual(Analysis.rankedOptimizationPokemon(roster, []), [], "No exhaustive fallback without ranking.");
const shortlist = Analysis.rankedOptimizationPokemon([p("b", 20), p("a", 21), p("unranked",22)], [{id:"b",rank:10,profile:"rank1"},{id:"a",rank:1,profile:"other"},{id:"a",rank:20,profile:"rank1"},{id:"a",rank:2,profile:"rank1"}]);
assert.deepEqual(shortlist.map(p=>p.id), ["a", "b"], "Rank order, profile and duplicate handling are deterministic.");
const cache = Analysis.createCache(null);
const plan = Array.from({ length: Analysis.MAX_CACHE_ENTRIES + 500 }, (_, i) => ({ key: "job-" + i }));
let results = Analysis.createSearchResults(plan, cache);
for (const job of plan) { const result = { score: 600, winner: "team" }; cache.set(job.key, result); results.set(job.key, result); }
assert.equal(cache.has(plan[0].key), false);
assert.equal(results.size, plan.length);
results = Analysis.createSearchResults(plan, cache, results);
assert.equal(results.size, plan.length, "Re-evaluation and resume preserve results evicted from persistence.");
assert.equal(Analysis.createSearchResults([{ key: "new-context" }], cache, results).size, 0, "Different contexts must not reuse old outcomes.");
const groups = [{ opponentId: "threat", cells: [{ score: 300 }, { score: 400 }] }];
const ranked = Analysis.rankTeamCandidates({ mode: "append", baselineGroups: groups, candidates: { "curated-member": { threat: { score: 450 } }, "outside-meta": { threat: { score: 750 } } } });
assert.equal(ranked[0].candidateId, "outside-meta", "A useful candidate outside the curated pool must outrank a member that does not repair the gap.");
assert.equal(ranked[0].zeroToOne, 1);
console.log("Team Builder ranked candidates and search retention tests passed.");

// Exercise the actual app builders with the canonical runtime roster. The fast
// build path must preserve battle stats and avoid ranking 4096 IV spreads.
const Builder = require("./build-great-league-meta-database.js");
const Charged = require("../src/battle/charged-move-collection.js");
const gm = Builder.readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
const moveMap = new Map(gm.moves.map(move => [move.moveId, Builder.normalizeMove(move)]));
const allPokemon = gm.pokemon.filter(p => p.speciesId && p.baseStats).map(p => ({ ...Builder.normalizePokemon(p, moveMap), form: Forms.describe(p) }));
const runtime = { metaRankingPreferredProfile: "rank1", metaRankingData: require("../data/great-league-rankings.json"), allPokemon, teamBuilderState: { league: "great", team: [] }, window: { PvPeakTeamBuilder: State, PvPeakTeamBuilderAnalysis: Analysis, PvPeakChargedMoveCollection: Charged }, moveMap, standardMovesets: Builder.readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS"), findPokemon: id => allPokemon.find(p => p.id === id), isShadow: p => p.id.includes("_shadow"), clampIv: n => Math.max(0, Math.min(15, Number(n) || 0)), ivRank: () => { throw Error("Search enumeration must not calculate every IV rank"); } };
vm.createContext(runtime);
vm.runInContext(html.match(/    const cpMultipliers = \[[\s\S]*?\n    \];/)[0], runtime);
for (const name of ["teamBuilderEligibleOptimizationMembers", "teamBuilderDefaultMember", "teamBuilderResolvedBuild", "statsForIvSpread", "pokemonStatsAtLevel", "metaMovesForPokemon", "standardMovesetFor", "selectedChargedMoveLimit", "fastMoveScore", "chargedMoveScore"]) {
  const start = html.indexOf("    function " + name + "(");
  vm.runInContext(html.slice(start, html.indexOf("\n    function ", start + 1)), runtime);
}
const candidates = runtime.teamBuilderEligibleOptimizationMembers();
assert.equal(candidates.length, 600);
assert.ok(!candidates.some(c => ["magikarp", "bulbasaur"].includes(c.candidateId)));
assert.ok(candidates.every(({ member }) => member.build.cp <= 1500 && Number.isFinite(member.build.cp)));
for (const id of ["golisopod", "raichu", "clodsire"]) {
  const candidate = candidates.find(c => c.candidateId === id);
  assert.ok(candidate, id + " must be evaluated");
  const stats = Builder.defaultStats(runtime.findPokemon(id));
  assert.equal(candidate.member.build.cp, stats.cp);
  assert.equal(candidate.member.build.level, stats.level);
  assert.equal(candidate.member.build.ivAtk, stats.ivAtk);
  assert.equal(candidate.member.build.ivDef, stats.ivDef);
  assert.equal(candidate.member.build.ivHp, stats.ivHp);
}
console.log("Canonical runtime roster: " + candidates.length + " legal candidate builds, battle stats preserved.");

const raichu = candidates.find(c => c.candidateId === "raichu");
assert.equal(Analysis.memberSignature(raichu.member), Analysis.memberSignature({ ...raichu.member, build: { ...raichu.member.build, rank: 42 } }), "Completing display rank must not change battle cache identity.");
const adapter = Builder.createWorkerAdapter(Builder.extractLiveWorkerSource(), { native: true, strict: true, dreStandard: true });
const pokemonMap = new Map(allPokemon.map(p => [p.id, p]));
const config = Builder.createBattleConfig(pokemonMap.get("raichu"), pokemonMap.get("corviknight"), Builder.DEFAULT_PROFILE, moveMap, runtime.standardMovesets, pokemonMap);
const result = adapter.simulate({ id: "outside-meta-counter", key: "outside-meta-counter", signature: "outside-meta-counter", source: "team-builder", aShields: 1, bShields: 1, includeSwing: false, config });
assert.ok(result.score > 500, "Real outside-meta fixture: Raichu provides a winning answer to Corviknight.");
const actualRanking = Analysis.rankTeamCandidates({ mode: "append", baselineGroups: [{ opponentId: "corviknight", cells: [{ score: 300 }] }], candidates: { raichu: { corviknight: result } } });
assert.equal(actualRanking[0].zeroToOne, 1);
console.log("Live Battle worker outside-meta coverage test passed (Raichu vs Corviknight: " + result.score + ").");
const calls = [];
const cancellation = { sharedMatchupCache: { flush() {} }, teamBuilderReuseKeys: new Map(), teamBuilderAnalysisContext: "final-slot", teamBuilderFinalSlotPendingStart: false, teamBuilderAnalysisRunToken: 4, teamBuilderAnalysisActive: true, teamBuilderAnalysisQueue: [{ key: "pending" }], teamBuilderAnalysisPending: new Map(), teamBuilderAnalysisCache: { persist() {} }, clearTimeout() {}, teamOpponentUIController: { renderResults() {} }, renderTeamBuilderFinalSlotProgress() { calls.push("progress"); }, renderTeamBuilderFinalSlotRanking() { calls.push("ranking"); } };
vm.createContext(cancellation);
const cancelStart = html.indexOf("    function cancelTeamBuilderAnalysis(");
vm.runInContext(html.slice(cancelStart, html.indexOf("\n    function ", cancelStart + 1)), cancellation);
cancellation.cancelTeamBuilderAnalysis();
assert.equal(cancellation.teamBuilderAnalysisActive, false);
assert.equal(cancellation.teamBuilderAnalysisRunToken, 5);
assert.deepEqual(calls, ["progress", "ranking"], "Cancel refreshes completed candidates so their actions are usable.");
console.log("Search cancellation and completed-results refresh tests passed.");

// Removing a team species must fill its place with the next ranked legal build.
runtime.teamBuilderState.team = [candidates.find(c => c.candidateId === "raichu").member];
const withoutRaichu = runtime.teamBuilderEligibleOptimizationMembers();
assert.equal(withoutRaichu.length, 600);
assert.ok(withoutRaichu.every(c => State.speciesKey(c.member) !== State.speciesKey(runtime.teamBuilderState.team[0])));
assert.ok(withoutRaichu.some(c => !candidates.some(old => old.candidateId === c.candidateId)));

const status = { textContent: "" };
const loading = { metaRankingData: null, metaRankingLoadPromise: null, $: () => status, ensureMetaRankingData() { loading.metaRankingLoadPromise = Promise.resolve().then(() => { loading.metaRankingData = { entries: [{id:"raichu"}] }; }); } };
vm.createContext(loading);
const readyStart = html.indexOf("    async function teamBuilderCandidateRankingReady(");
vm.runInContext(html.slice(readyStart, html.indexOf("\n    async function ", readyStart + 1)), loading);
(async () => {
  const ready = loading.teamBuilderCandidateRankingReady("status");
  assert.match(status.textContent, /Loading/);
  assert.equal(await ready, true);
  loading.metaRankingData = null;
  loading.ensureMetaRankingData = () => { loading.metaRankingLoadPromise = Promise.resolve(); };
  assert.equal(await loading.teamBuilderCandidateRankingReady("status"), false);
  assert.match(status.textContent, /unavailable/);
  console.log("Ranking readiness, missing-data guard and shortlist refill tests passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
