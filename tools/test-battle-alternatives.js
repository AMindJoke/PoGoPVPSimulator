"use strict";
const assert = require("node:assert/strict");
const A = require("../src/analysis/battle-alternatives");
const UI = require("../src/ui/battle-alternatives");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");
const Audit = require("./audit-planner-alternatives");
const Reliability = require("../src/reliability/battle-reliability");
const runtime = R.createRuntime(), source = G.extractLiveWorkerSource();
const probe = G.createWorkerAdapter(A.instrumentWorkerSource(source),{dreStandard:true,strict:true});
const canonical = G.createWorkerAdapter(source,{dreStandard:true,strict:true});
const cases = Audit.buildCases(runtime);
const sample = [...cases.slice(0,6),...cases.filter(item=>/dedenne.*sableye|kingdra.*carbink|raikou.*pachirisu|abomasnow.*malamar|defense-buff-sableye/.test(item.id))];
let sequence=0, checked=0, findings=0, shieldChecks=0, example=null;
function payload(item, targets=[]) {return {id:++sequence,key:item.id,config:item.config,aShields:item.shields,bShields:item.bShields??item.shields,
  includeSwing:false,trace:true,debugTimeline:true,alternativeProbe:{targets}};}
for(const item of sample){
  const message=payload(item), baseline=probe.simulate(message), ordinary=canonical.simulate({...message,alternativeProbe:undefined});
  assert.equal(A.outcome(baseline),ordinary.details.outcome,item.id);
  assert.deepEqual(A.timelineIdentity(baseline.timelineTrace),A.timelineIdentity(ordinary.timelineTrace),"Probe must preserve the canonical timeline.");
  assert.equal(JSON.stringify(baseline.decisionTrace.finalState),JSON.stringify(ordinary.decisionTrace.finalState),"Probe must preserve all terminal resources.");
  assert.deepEqual(Reliability.validateTrace(baseline.decisionTrace),[]);
  const expected={outcome:A.outcome(baseline),...baseline.alternativeProbe.finalState,timeline:A.timelineIdentity(baseline.alternativeProbe.timeline)};
  assert(A.baselineMatches(baseline,expected));
  assert(!A.baselineMatches(baseline,{...expected,A:{...expected.A,energy:expected.A.energy+1}}));
  assert(!A.baselineMatches(baseline,{...expected,timeline:[]}));
  for(const candidate of A.candidates(baseline)){
    let branch;
    try {branch=probe.simulate(payload(item,[candidate.target]));}
    catch(error){if(error.message.includes("Illegal alternative choice"))continue;throw error;}
    checked++;
    if(!A.validBranch(baseline,branch,candidate.node))continue;
    const found=A.finding(baseline,branch,candidate);
    if(!found)continue;
    assert(A.rank(found.outcome,found.node.side)>A.rank(found.baselineOutcome,found.node.side));
    const reply=A.replyCandidate(found);
    if(reply){
      const response=probe.simulate(payload(item,[found.target,reply.target]));
      A.confirmReply(found,reply,response);
      assert.equal(found.replyCheck,"checked");shieldChecks++;
      if(found.dependency)assert(A.rank(A.outcome(response),found.node.side)<A.rank(found.outcome,found.node.side));
    }
    findings++;example ||= {item,found,baseline};
  }
  const repeated=probe.simulate(payload(item));
  assert.deepEqual(A.timelineIdentity(repeated.alternativeProbe.timeline),A.timelineIdentity(baseline.alternativeProbe.timeline),"Branches must not contaminate later simulations.");
}
assert(checked>100 && findings>0 && shieldChecks>0,"Exercise real outcome flips and alternative shield replies.");
assert.equal(UI.badgeLabel({phase:"checking",findings:[]}),"Checking alternatives…");
assert.equal(UI.badgeLabel({phase:"ready",findings:[{outcome:"B"}]}),"Alternative → Loss");
assert.equal(UI.badgeLabel({phase:"ready",findings:[]}),"Alternatives checked");
assert.deepEqual(UI.previewEvents([{kind:"fast",fastImpactStatus:"denied"},{kind:"fast",fastImpactStatus:"pending"},
  {kind:"charge",hiddenFromTimeline:true},{kind:"charge",move:{id:"FOUL_PLAY",name:"Foul Play"}}]).map(event=>event.moveId),["FOUL_PLAY"],
  "Compact preview must not present unresolved or denied Fast damage as a hit.");

async function controllerTests(){
  const adapters=[];let creates=0,terminated=0;
  const runner=A.createRunner(()=>{
    creates++;const adapter=G.createWorkerAdapter(A.instrumentWorkerSource(source),{dreStandard:true,strict:true});adapters.push(adapter);
    const worker={terminate(){terminated++;this.stopped=true;},postMessage(message){setImmediate(()=>{
      let data;try{data={id:message.id,type:"matrixCellResult",result:adapter.simulate(message)};}catch(error){data={id:message.id,type:"matrixCellError",message:error.message};}
      if(!this.stopped)this.onmessage({data});
    });}};return worker;
  },{maxBranches:96,totalTimeoutMs:60000});
  const item=example.item,input={config:item.config,aShields:item.shields,bShields:item.bShields??item.shields};
  const run=input=>new Promise(resolve=>runner.start(input,state=>{if(state.phase!=="checking")resolve(state);}));
  const completed=await run(input);assert.equal(completed.phase,"ready");assert(completed.findings.length>0);assert(completed.checked<=96);
  const count=creates;const cached=await run(input);assert.equal(creates,count);assert.deepEqual(cached,completed);
  const mismatch=await run({...input,expected:{outcome:"invalid",A:{},B:{},timeline:[]}});assert.equal(mismatch.phase,"error");assert.equal(mismatch.findings.length,0);
  let updates=0;runner.start({...input,engineVersion:"cancel-test"},()=>updates++);runner.cancel();const before=updates;
  await new Promise(resolve=>setImmediate(resolve));assert.equal(updates,before,"Cancelled jobs must not publish late results.");
  assert(terminated>=3);
  console.log(`Battle alternatives passed: ${sample.length} canonical matches, ${checked} legal branches, ${findings} flips, ${shieldChecks} shield-reply checks; cache/cancellation/mismatch gates.`);
}
controllerTests().catch(error=>{console.error(error);process.exitCode=1;});
