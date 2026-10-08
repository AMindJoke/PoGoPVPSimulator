"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm");
const Pool = require("../src/analysis/simulation-worker-pool.js");
const html = fs.readFileSync(require("node:path").join(__dirname, "..", "PogoPvp.html"), "utf8");
function extract(name) {
  const start = html.search(new RegExp("    (?:async )?function " + name + "\\("));
  const tail = html.slice(start + 1).search(/\n    (?:async )?function /);
  return html.slice(start, tail < 0 ? html.length : start + 1 + tail);
}
assert.equal(Pool.workerLimit({cores:16,memory:16}),4);
assert.equal(Pool.workerLimit({cores:8,memory:8,mobile:true}),2);
assert.equal(Pool.workerLimit({cores:8,memory:2}),1);
assert.equal(Pool.workerLimit({cores:1}),1);

async function queueCase(crash) {
  const jobs = Array.from({length:53},(_,i)=>({key:"job-"+i, member:{pokemonId:"a"}, opponentId:"b", shields:"1-1", slot:0}));
  const results = new Map();
  let finished, crashTriggered=false, maxPending=0, dispatched=0, serialRetries=0, workers=0;
  const done = new Promise(resolve=>finished=resolve);
  class FakeWorker {
    constructor() { this.dead=false; this.number=workers++; }
    postMessage({simulationBatch:batch}) {
      assert.ok(batch.length<=4);
      dispatched+=batch.length;
      if(crash && !crashTriggered) {
        crashTriggered=true;
        setImmediate(()=>this.onerror());
        return;
      }
      batch.slice().reverse().forEach((job,i)=>setTimeout(()=>{
        if(!this.dead) this.onmessage({data:{id:job.id,key:job.key,type:"matrixCellResult",result:{score:600+Number(job.key.split("-")[1])}}});
      },2+i));
    }
    terminate() {this.dead=true;}
  }
  const c={ console, setTimeout, clearTimeout, navigator:{hardwareConcurrency:8,deviceMemory:8},
    window:{Worker:FakeWorker,PvPeakSimulationWorkerPool:Pool,matchMedia:()=>({matches:false})},Worker:FakeWorker,
    URL:{createObjectURL:()=>"blob:test",revokeObjectURL(){}},Blob:function(){},matrixComputeWorkerSourceCache:"source",matrixComputeWorkerSeq:0,
    teamBuilderQueuePumpToken:null,teamBuilderPoolAttemptToken:-1,teamBuilderSimulationPool:null,
    teamBuilderAnalysisActive:true,teamBuilderAnalysisRunToken:1,teamBuilderAnalysisContext:"final-slot",teamBuilderForceRefresh:false,
    teamBuilderAnalysisQueue:[...jobs],teamBuilderAnalysisPending:new Map(),teamBuilderReuseKeys:new Map(),teamBuilderDurableKeys:new Set(),
    teamBuilderAnalysisDone:0,teamBuilderAnalysisCacheHits:0,teamBuilderAnalysisFailed:0,
    sharedMatchupCache:{getMany:async keys=>{await new Promise(r=>setTimeout(r,1));return new Map(keys.filter(k=>k==="durable|job-0").map(k=>[k,{score:600}]));}},
    shieldMatrixCache:new Map(),metaMatchupCache:new Map(),
    teamBuilderReuseRecord:job=>({job,durable:"durable|"+job.key,shared:"shared|"+job.key}),
    createTeamBuilderBattleConfig:()=>({left:{},right:{}}),
    acceptTeamBuilderCachedResult:(job,r)=>results.set(job.key,r),storeTeamBuilderAnalysisResult:(job,r)=>{assert.ok(!results.has(job.key));results.set(job.key,r);},
    renderTeamBuilderActiveAnalysisProgress(){maxPending=Math.max(maxPending,c.teamBuilderAnalysisPending.size);},
    finishTeamBuilderAnalysis(){assert.equal(c.teamBuilderAnalysisPending.size,0);assert.equal(results.size,jobs.length);c.teamBuilderAnalysisActive=false;c.teamBuilderSimulationPool?.dispose();finished();},
    matrixComputeWorker:{},initMatrixComputeWorker(){},
    requestTeamBuilderMatchupCompute(job,token){
      serialRetries++;const id=++c.matrixComputeWorkerSeq;c.teamBuilderAnalysisPending.set(job.key,{job,token,serialRequestId:id});
      setImmediate(()=>c.handleTeamBuilderComputeWorkerMessage({id,key:job.key,type:"matrixCellResult",result:{score:600+Number(job.key.split("-")[1])}}));return true;
    }
  };
  vm.createContext(c);
  for(const name of ["hydrateTeamBuilderSearchBatch","initTeamBuilderSimulationPool","processTeamBuilderAnalysisQueue","handleTeamBuilderComputeWorkerMessage"])vm.runInContext(extract(name),c);
  await Promise.all([c.processTeamBuilderAnalysisQueue(1),c.processTeamBuilderAnalysisQueue(1)]);
  await done;
  assert.equal(c.teamBuilderAnalysisDone,53);assert.equal(c.teamBuilderAnalysisCacheHits,1);assert.equal(c.teamBuilderAnalysisFailed,0);
  assert.ok(maxPending>4,"Multiple workers must be busy together.");
  assert.equal(workers,4);assert.ok(crash?serialRetries>0:serialRetries===0);
  for(let i=0;i<53;i++)assert.equal(results.get("job-"+i).score,600+i);
  // An old response for the same key must not consume a new request.
  c.teamBuilderAnalysisActive=true;c.teamBuilderAnalysisRunToken=2;
  c.teamBuilderAnalysisPending.set("job-0",{job:jobs[0],token:2,requestId:999});
  c.handleTeamBuilderComputeWorkerMessage({id:1,key:"job-0",type:"matrixCellResult",result:{score:0}});
  assert.equal(c.teamBuilderAnalysisPending.size,1);
}

function templatesCase() {
  let own=0,foe=0;
  const c={teamBuilderPreparedCombatants:new Map(),window:{PvPeakTeamBuilderAnalysis:{memberSignature:m=>m.pokemonId+":"+m.iv}},findPokemon:id=>({id}),
    createTeamBuilderCombatant:(m,side)=>{own++;return {id:m.pokemonId,side,hp:100,energy:0};},
    createMetaCombatant:(p,side)=>{foe++;return {id:p.id,side,hp:100,energy:0};}};
  vm.createContext(c);vm.runInContext(extract("createTeamBuilderBattleConfig"),c);
  const job={member:{pokemonId:"a",iv:1},opponentId:"b"};
  const first=c.createTeamBuilderBattleConfig(job);
  for(let i=0;i<100;i++)assert.equal(c.createTeamBuilderBattleConfig(job).left,first.left);
  c.createTeamBuilderBattleConfig({...job,opponentId:"c"});
  c.createTeamBuilderBattleConfig({...job,member:{pokemonId:"a",iv:2}});
  c.createTeamBuilderBattleConfig({...job,startEnergyA:10});
  c.createTeamBuilderBattleConfig({...job,opponentMember:{pokemonId:"b",iv:3}});
  assert.equal(own,4);assert.equal(foe,2);assert.equal(first.left.energy,0);
  c.teamBuilderPreparedCombatants.clear();c.createTeamBuilderBattleConfig(job);assert.equal(own,5);
}

function timeoutAndDisposeCase() {
  let callback,failures=0,results=0;
  const worker={postMessage(){},terminate(){}};
  const pool=Pool.createPool({size:1,createWorker:()=>worker,onResult:()=>results++,onFailure:jobs=>failures+=jobs.length,setTimer:fn=>{callback=fn;return 1;},clearTimer(){}});
  pool.dispatch([{id:1,key:"a"},{id:2,key:"b"}]);callback();assert.equal(failures,2);assert.equal(pool.alive(),false);
  worker.onmessage({data:{id:1,key:"a"}});assert.equal(results,0);
  const worker2={postMessage(){},terminate(){}};
  const second=Pool.createPool({size:1,createWorker:()=>worker2,onResult:()=>results++,onFailure:()=>failures++,setTimer:()=>1,clearTimer(){}});
  second.dispatch([{id:3,key:"c"}]);second.dispose();worker2.onmessage({data:{id:3,key:"c"}});assert.equal(results,0);assert.equal(failures,2);
}
(async()=>{templatesCase();timeoutAndDisposeCase();await queueCase(false);await queueCase(true);console.log("Adaptive workers, parallel queue/cache, out-of-order parity, failure retry, stale replies, timeout/dispose and combatant reuse passed.");})().catch(e=>{console.error(e);process.exitCode=1;});
