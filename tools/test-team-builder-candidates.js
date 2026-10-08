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
const context = { allPokemon: roster, teamBuilderState: { team: [{ pokemonId: "already", dex: 1 }] }, window: { PvPeakTeamBuilder: State, PvPeakTeamBuilderAnalysis: Analysis }, findPokemon: id => roster.find(p => p.id === id), selectedChargedMoveLimit: () => 2, teamBuilderDefaultMember: p => ({ pokemonId: p.id, dex: p.dex, chargedMoveIds: ["C1", "C2"], build: { cp: p.id === "over-cap" ? 1800 : 1499 } }) };
vm.createContext(context);
vm.runInContext(body, context);
assert.deepEqual(Array.from(context.teamBuilderEligibleOptimizationMembers(), x => x.candidateId), ["outside-meta"]);
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
console.log("Team Builder full-roster candidates and search retention tests passed.");

// Exercise the actual app builders with the canonical runtime roster. The fast
// build path must preserve battle stats and avoid ranking 4096 IV spreads.
const Builder = require("./build-great-league-meta-database.js");
const Charged = require("../src/battle/charged-move-collection.js");
const gm = Builder.readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
const moveMap = new Map(gm.moves.map(move => [move.moveId, Builder.normalizeMove(move)]));
const allPokemon = gm.pokemon.filter(p => p.speciesId && p.baseStats).map(p => ({ ...Builder.normalizePokemon(p, moveMap), form: Forms.describe(p) }));
const runtime = { allPokemon, teamBuilderState: { league: "great", team: [] }, window: { PvPeakTeamBuilder: State, PvPeakTeamBuilderAnalysis: Analysis, PvPeakChargedMoveCollection: Charged }, moveMap, standardMovesets: Builder.readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS"), findPokemon: id => allPokemon.find(p => p.id === id), isShadow: p => p.id.includes("_shadow"), clampIv: n => Math.max(0, Math.min(15, Number(n) || 0)), ivRank: () => { throw Error("Search enumeration must not calculate every IV rank"); } };
vm.createContext(runtime);
vm.runInContext(html.match(/    const cpMultipliers = \[[\s\S]*?\n    \];/)[0], runtime);
for (const name of ["teamBuilderEligibleOptimizationMembers", "teamBuilderDefaultMember", "teamBuilderResolvedBuild", "statsForIvSpread", "pokemonStatsAtLevel", "metaMovesForPokemon", "standardMovesetFor", "selectedChargedMoveLimit", "fastMoveScore", "chargedMoveScore"]) {
  const start = html.indexOf("    function " + name + "(");
  vm.runInContext(html.slice(start, html.indexOf("\n    function ", start + 1)), runtime);
}
const candidates = runtime.teamBuilderEligibleOptimizationMembers();
assert.ok(candidates.length > 1000);
assert.ok(candidates.every(({ member }) => member.build.cp <= 1500 && Number.isFinite(member.build.cp)));
for (const id of ["golisopod", "bulbasaur", "raichu", "clodsire"]) {
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
const cancellation = { teamBuilderAnalysisContext: "final-slot", teamBuilderFinalSlotPendingStart: false, teamBuilderAnalysisRunToken: 4, teamBuilderAnalysisActive: true, teamBuilderAnalysisQueue: [{ key: "pending" }], teamBuilderAnalysisPending: new Map(), teamBuilderAnalysisCache: { persist() {} }, clearTimeout() {}, teamOpponentUIController: { renderResults() {} }, renderTeamBuilderFinalSlotProgress() { calls.push("progress"); }, renderTeamBuilderFinalSlotRanking() { calls.push("ranking"); } };
vm.createContext(cancellation);
const cancelStart = html.indexOf("    function cancelTeamBuilderAnalysis(");
vm.runInContext(html.slice(cancelStart, html.indexOf("\n    function ", cancelStart + 1)), cancellation);
cancellation.cancelTeamBuilderAnalysis();
assert.equal(cancellation.teamBuilderAnalysisActive, false);
assert.equal(cancellation.teamBuilderAnalysisRunToken, 5);
assert.deepEqual(calls, ["progress", "ranking"], "Cancel refreshes completed candidates so their actions are usable.");
console.log("Search cancellation and completed-results refresh tests passed.");
