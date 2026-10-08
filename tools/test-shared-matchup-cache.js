"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const Cache = require("../src/analysis/shared-matchup-cache.js");
const G = require("./build-great-league-meta-database.js");
const html = fs.readFileSync(require("node:path").join(__dirname, "..", "PogoPvp.html"), "utf8");
const gm = G.readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
const moveMap = new Map(gm.moves.map(m => [m.moveId, G.normalizeMove(m)]));
const pokemonMap = new Map(gm.pokemon.filter(p => p.speciesId && p.baseStats).map(p => G.normalizePokemon(p, moveMap)).map(p => [p.id, p]));
const config = G.createBattleConfig(pokemonMap.get("raichu"), pokemonMap.get("corviknight"), G.DEFAULT_PROFILE, moveMap, G.readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS"), pokemonMap);
function extract(name) { const start = html.search(new RegExp("    (?:async )?function " + name + "\\(")); const end = html.search(new RegExp("never-match")); return html.slice(start, html.indexOf("\n    function ", start + 1) > 0 ? html.indexOf("\n    function ", start + 1) : end); }
const signatureContext = {}; vm.createContext(signatureContext); vm.runInContext(extract("matrixCombatantSignature"), signatureContext);
const signature = signatureContext.matrixCombatantSignature;
const key = Cache.key("engine-v1", config, 1, 1, signature);
const changed = fn => { const copy = structuredClone(config); fn(copy); return Cache.key("engine-v1", copy, 1, 1, signature); };
assert.equal(key, changed(c => { c.left.trainer = "other"; c.left.rank = 1; }));
for (const change of [c => c.left.ivAtk++, c => c.left.attack++, c => c.left.hp--, c => {c.startEnergyA = c.left.energy = 10;}, c => c.left.fast.power++, c => c.left.charged.reverse(), c => c.left.baiting = "always", c => c.left.shieldMode = "none", c => c.left.shadowAtkMult = 1.2, c => c.left.chargedTaken++, c => c.turns = {A:0,B:2}, c => c.farmFastOnly = true]) assert.notEqual(key, changed(change));
assert.notEqual(key, Cache.key("engine-v2", config, 1, 1, signature));
assert.notEqual(key, Cache.key("engine-v1", config, 0, 1, signature));
assert.ok(Cache.legacyBattleSignature(config));
assert.equal(Cache.legacyBattleSignature({...config, turns:{A:0,B:2}}), null);
assert.equal(Cache.legacyBattleSignature({...config, left:{...config.left, hp:config.left.hp-1}}), null);

// Async IndexedDB adapter: independent store instances share disk, not memory.
// Requests/transaction completion follow IndexedDB's asynchronous ordering.
function fakeIndexedDB(disk = new Map()) {
  let transactions = 0;
  const api = { open() { const request = {}; setImmediate(() => {request.result = { objectStoreNames:{contains:()=>true}, close(){}, transaction() { transactions++; const tx = {}; let operations=0; function operation(fn) { operations++; setImmediate(() => {fn(); if (--operations === 0) setImmediate(() => tx.oncomplete?.());}); }
    tx.objectStore = () => ({ get(k) {const r={}; operation(() => {r.result=structuredClone(disk.get(k)); r.onsuccess?.();}); return r;}, put(v,k) {const copy=structuredClone(v); operation(() => disk.set(k,copy));} }); return tx;} }; request.onsuccess?.();}); return request; }, transactions:()=>transactions };
  return api;
}
async function main() {
  const db=fakeIndexedDB(), first=Cache.createStore(db,{memoryLimit:5});
  for(let i=0;i<12550;i++) first.set("result-"+i,{score:i%1000});
  assert.equal(await first.flush(),true);
  const restarted=Cache.createStore(db,{memoryLimit:5});
  const keys=Array.from({length:12550},(_,i)=>"result-"+i);
  const restored=await restarted.getMany(keys);
  assert.equal(restored.size,12550,"Disk persistence exceeds the old 12,000-entry limit after restart.");
  assert.equal(restored.get("result-0").score,0);
  assert.ok(db.transactions()<150,"Writes are batched, not one transaction per matchup.");
  const unavailable=Cache.createStore(null); unavailable.set("memory",{score:600});
  assert.equal((await unavailable.getMany(["memory"])).get("memory").score,600);
  assert.equal(await unavailable.flush(),true);
  const broken=Cache.createStore({open(){throw Error("blocked");}}); broken.set("fallback",{score:700});
  assert.equal(await broken.flush(),false);assert.equal((await broken.getMany(["fallback"])).get("fallback").score,700);

  // Run the real queue/hydration code: 300 cached cells cross multiple batches
  // without a single simulator dispatch. Also mix compact and shared results.
  const jobs=Array.from({length:300},(_,i)=>({key:"job-"+i,slot:i%6,member:{pokemonId:"x"},opponentId:"y",shields:"1-1"}));
  const values=new Map(jobs.map((job,i)=>[i%2?"shared|"+job.key:"durable|"+job.key,i%2?{score:650,details:{winnerEdge:1,aHp:.5}}:{score:650,slot:99}]));
  let dispatches=0; let finished;
  const complete=new Promise(resolve=>finished=resolve);
  const cache=new Map();
  const ctx={teamBuilderDurableKeys:new Set(),teamBuilderAnalysisActive:true,teamBuilderAnalysisRunToken:1,teamBuilderAnalysisContext:"final-slot",teamBuilderForceRefresh:false,teamBuilderAnalysisQueue:[...jobs],teamBuilderReuseKeys:new Map(),teamBuilderAnalysisDone:0,teamBuilderAnalysisCacheHits:0,teamBuilderAnalysisFailed:0,sharedMatchupCache:{getMany:async keys=>new Map(keys.filter(k=>values.has(k)).map(k=>[k,values.get(k)]))},shieldMatrixCache:new Map(),metaMatchupCache:new Map(),teamBuilderReuseRecord:job=>({job,shared:"shared|"+job.key,durable:"durable|"+job.key}),acceptTeamBuilderCachedResult:(job,result)=>cache.set(job.key,result),storeTeamBuilderAnalysisResult:(job,result)=>cache.set(job.key,{...result,slot:job.slot}),renderTeamBuilderActiveAnalysisProgress(){},finishTeamBuilderAnalysis(){ctx.teamBuilderAnalysisActive=false;finished();},initMatrixComputeWorker(){},matrixComputeWorker:null,requestTeamBuilderMatchupCompute(){dispatches++;return false;},simulateTeamBuilderMatchupCell(){dispatches++;return {score:600};},setTimeout:fn=>setImmediate(fn)};
  vm.createContext(ctx);
  const start=html.indexOf("    async function hydrateTeamBuilderSearchBatch(");
  const end=html.indexOf("    function acceptTeamBuilderCachedResult",start);
  vm.runInContext(html.slice(start,end),ctx);
  const queueStart=html.indexOf("    async function processTeamBuilderAnalysisQueue(");
  vm.runInContext(html.slice(queueStart,html.indexOf("    function requestTeamBuilderMatchupCompute",queueStart)),ctx);
  await ctx.processTeamBuilderAnalysisQueue(1);await complete;
  assert.equal(dispatches,0);assert.equal(cache.size,300);assert.equal(ctx.teamBuilderAnalysisCacheHits,300);assert.equal(cache.get("job-0").slot,0);
  ctx.teamBuilderAnalysisActive=true;ctx.teamBuilderAnalysisRunToken=2;ctx.teamBuilderAnalysisQueue=[jobs[0]];
  ctx.sharedMatchupCache.getMany=async()=>{ctx.teamBuilderAnalysisRunToken=3;return values;};
  const before=ctx.teamBuilderAnalysisDone;await ctx.hydrateTeamBuilderSearchBatch(2);assert.equal(ctx.teamBuilderAnalysisDone,before,"Cancelled reads cannot update a new analysis.");

  // Team Builder -> Battle: use the shared raw result for the matching cell.
  const raw={score:649,details:{winnerEdge:1,aHp:.4,bHp:0}};
  let battleReady;const battleWait=new Promise(resolve=>battleReady=resolve);
  const battleContext={shieldMatrixHydrated:new Set(),shieldMatrixHydrating:new Set(),createMatrixBattleConfig:()=>config,sharedMatchupKey:(cfg,a,b)=>Cache.key("engine-v1",cfg,a,b,signature),shieldMatrixCacheKey:(sig,a,b)=>sig+"|"+a+"-"+b,sharedMatchupCache:{getMany:async()=>new Map([[key,raw]])},handleMatrixCacheWorkerMessage:event=>battleReady(event.data.entries)};
  vm.createContext(battleContext);vm.runInContext(extract("hydrateShieldMatrixCache"),battleContext);
  assert.equal(battleContext.hydrateShieldMatrixCache("battle-input"),true);
  const battleEntries=await battleWait;assert.equal(battleEntries.find(([k])=>k==="battle-input|1-1")[1].score,649);
  // Team Builder -> Meta: shared hit must bypass the compute worker.
  let metaDispatches=0;const metaResults=new Map();
  const metaContext={metaBuildActive:true,metaBuildQueue:[{key:"meta-input",a:{},b:{},aShields:1,bShields:1}],metaMatchupCache:new Map(),metaBuildDone:0,createMetaBattleConfig:()=>config,sharedMatchupKey:()=>key,sharedMatchupCache:{getMany:async()=>new Map([[key,raw]])},storeMetaMatchupResult:(k,v)=>metaResults.set(k,v),requestMetaMatchupCompute:()=>{metaDispatches++;return true;},setTimeout(){},renderMetaRankings(){}};
  vm.createContext(metaContext);
  const metaStart=html.indexOf("    async function processMetaBuildQueue(");
  vm.runInContext(html.slice(metaStart,html.indexOf("    function requestMetaMatchupCompute",metaStart)),metaContext);
  await metaContext.processMetaBuildQueue();assert.equal(metaDispatches,0);assert.equal(metaResults.get("meta-input").score,649);

  for(const [,body] of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(body.trim())new vm.Script(body);
  console.log("Shared cache signatures, durable restart >12,000 cells, fallback, batch reuse (300 hits / 0 simulations), cancellation and inline syntax tests passed.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
