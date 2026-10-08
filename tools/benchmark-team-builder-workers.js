"use strict";
const assert = require("node:assert/strict");
const { Worker } = require("node:worker_threads");
const { performance } = require("node:perf_hooks");
const os = require("node:os"), fs = require("node:fs");
const G = require("./build-great-league-meta-database.js");
const Pool = require("../src/analysis/simulation-worker-pool.js");
const source = G.extractLiveWorkerSource();
const gm = G.readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
const moves = new Map(gm.moves.map(m=>[m.moveId,G.normalizeMove(m)]));
const pokemon = new Map(gm.pokemon.filter(p=>p.speciesId&&p.baseStats).map(p=>G.normalizePokemon(p,moves)).map(p=>[p.id,p]));
const defaults = G.readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS");
const ids = ["mimikyu","melmetal","florges","talonflame","altaria","clodsire","corviknight","sableye_shadow","vigoroth","araquanid","stunfisk","raichu","golisopod","abomasnow","empoleon","ninetales_shadow"];
const jobs=[];
for(const a of ids) for(const b of ids) for(const shields of [0,1]) {
  const config=G.createBattleConfig(pokemon.get(a),pokemon.get(b),G.DEFAULT_PROFILE,moves,defaults,pokemon);
  config.left.shieldMode=config.right.shieldMode="smart";
  const id=jobs.length+1;
  jobs.push({id,key:a+":"+b+":"+shields,signature:"bench-"+id,source:"team-builder",config,aShields:shields,bShields:shields,includeSwing:false});
}
function createNativeWorker(batch) {
  const wrapper = 'const {parentPort}=require("node:worker_threads");globalThis.self={postMessage:m=>parentPort.postMessage(m)};parentPort.on("message",data=>self.onmessage({data}));\n';
  const worker=new Worker(wrapper+(batch?Pool.batchWorkerSource(source):source),{eval:true});
  const adapter={onmessage:null,onerror:null,postMessage:m=>worker.postMessage(m),terminate:()=>worker.terminate()};
  worker.on("message",data=>adapter.onmessage?.({data}));worker.on("error",error=>adapter.onerror?.(error));
  return adapter;
}
async function run(size,batchSize) {
  const start=performance.now(),results=new Map();
  let next=0,pool;
  await new Promise((resolve,reject)=>{
    const dispatch=()=>{while(next<jobs.length&&pool.available()){const group=jobs.slice(next,next+batchSize);next+=group.length;pool.dispatch(group);}};
    pool=Pool.createPool({size,createWorker:()=>{
      const worker=createNativeWorker(batchSize>1);
      if(batchSize===1){const post=worker.postMessage;worker.postMessage=message=>post(message.simulationBatch[0]);}
      return worker;
    },timeoutMs:60000,onFailure:()=>{pool.dispose();reject(new Error("Worker failed or timed out"));},onResult:message=>{
      if(message.type!=="matrixCellResult"){pool.dispose();reject(new Error(message.message));return;}
      results.set(message.key,message.result);
      if(results.size===jobs.length){pool.dispose();resolve();}else dispatch();
    }});
    dispatch();
  });
  return {ms:performance.now()-start,results};
}
(async()=>{
  console.log("Benchmark: "+jobs.length+" real Battle cells, cold workers; machine cores: "+os.availableParallelism());
  const serial=await run(1,1);console.log("Before (1 worker, single messages): "+Math.round(serial.ms)+" ms");
  const parallel=await run(Pool.workerLimit({cores:os.availableParallelism(),memory:os.totalmem()/2**30}),4);
  for(const job of jobs)assert.deepEqual(parallel.results.get(job.key),serial.results.get(job.key),job.key);
  const report={cells:jobs.length,serialMs:Math.round(serial.ms),parallelMs:Math.round(parallel.ms),speedup:Number((serial.ms/parallel.ms).toFixed(2)),reductionPercent:Number((100*(1-parallel.ms/serial.ms)).toFixed(1)),exactResultParity:true,environment:"Node native worker threads; cold startup included, no browser/UI/IndexedDB timing",date:new Date().toISOString()};
  fs.mkdirSync("reports",{recursive:true});fs.writeFileSync("reports/team-builder-worker-benchmark.json",JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
