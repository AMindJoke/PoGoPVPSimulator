'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Roles=require('../src/team-builder/team-builder-roles'),Context=require('../src/team-builder/team-opponent-context');
const Link=require('../src/team-builder/team-builder-battle-link'),A=require('../src/analysis/battle-alternatives'),S=require('../src/analysis/battle-sensitivity');
const own=['one','two','three'],enemies=['four','five','six'];
let identity='season-engine-1',edit=false,plan=[];
function rebuild(){plan=own.flatMap((id,slot)=>enemies.map((enemy,opponentSlot)=>({key:`${id}:${enemy}:${edit && slot===0}`,slot,opponentSlot,member:{pokemonId:id,move:edit && slot===0 ? 'NEW' : 'OLD'},opponentMember:{pokemonId:enemy,move:'OLD'}})));}
rebuild();const workers=[];
const context={PvPeakTeamRoles:Roles,PvPeakTeamOpponentContext:Context,PvPeakBattleSensitivity:S,setTimeout:()=>1,clearTimeout(){}};
vm.createContext(context);vm.runInContext(fs.readFileSync('src/team-builder/team-role-analysis.js','utf8'),context);
const controller=context.PvPeakTeamRoleAnalysis.create({plan:()=>plan,cacheIdentity:()=>identity,
  config:job=>({left:{...job.member,trainer:'A'},right:{...job.opponentMember,trainer:'B',fast:{energyGain:9}}}),combatant:m=>m,render(){},
  worker:()=>{const w={postMessage(m){this.message=m;this.sent++;},sent:0,terminate(){this.terminated=true;}};workers.push(w);return w;}});
function complete(){controller.start();const w=workers.at(-1);while(controller.state().phase==='running'){
  w.onmessage({data:{key:w.message.key,type:'matrixCellResult',result:{score:750,details:{outcome:'A'},aUsed:0,bUsed:0,
    sensitivity:w.message.checkSensitivity ? {version:S.VERSION,status:'checked'} : undefined}}});
}assert.equal(controller.state().phase,'complete');return w.sent;}
assert.equal(complete(),144);
controller.setDelay(1);assert.equal(complete(),54,'Only three delayed scenarios per pair need recomputing.');assert.equal(controller.state().reused,90);
edit=true;rebuild();assert.equal(complete(),48,'A changed move invalidates that member against every foe in both orientations.');assert.equal(controller.state().reused,96);
identity='season-engine-2';assert.equal(complete(),144,'Engine/season identity must invalidate both whole-analysis and pair reuse.');
console.log('Incremental roles: 144 initial jobs, 54 after delay change, 48 after one move; runtime invalidation passed.');

const farmWorkers=[];edit=false;rebuild();
const farms=context.PvPeakTeamRoleAnalysis.create({plan:()=>plan,cacheIdentity:()=>identity,
  config:job=>({left:{...job.member,trainer:'A'},right:{...job.opponentMember,trainer:'B',fast:{energyGain:9}}}),combatant:m=>m,render(){},
  worker:()=>{const w={sent:0,postMessage(m){this.message=m;this.sent++;},terminate(){}};farmWorkers.push(w);return w;}});
function completeFarms(){farms.start();const w=farmWorkers.at(-1);while(farms.state().phase==='running'){
  const m=w.message,changed=m.farmCompanions?.some(c=>c.combatant.move==='NEW');
  w.onmessage({data:{key:m.key,type:'matrixCellResult',result:{score:200,details:{outcome:'B'},aUsed:1,bUsed:1,
    sensitivity:m.checkSensitivity ? {version:S.VERSION,status:'not-applicable'} : undefined,
    routes:m.farmCompanions?.map(c=>({status:'safe',slot:c.slot,energyAfter:changed ? 20 : 10,hpAfter:50,hpPercent:50,shieldsUsed:0}))}}});
}assert.equal(farms.state().phase,'complete');assert.equal(farms.state().farms.length,18);return w.sent;}
assert.equal(completeFarms(),153);edit=true;rebuild();assert.equal(completeFarms(),57,'Every affected farm must include changed teammates in its cache key.');
assert(farms.state().farms.some(route=>route.energyAfter===20));
farms.setDelay(1);assert.equal(completeFarms(),54,'Unchanged baseline farm continuations can be reused across reaction settings.');
assert.equal(farms.state().farms.length,18,'Reused farms must not be duplicated.');
console.log('Farm cache passed: teammate invalidation, reaction reuse, resource updates and no duplicate routes.');

async function directedReplay(){
  const G=require('./build-great-league-meta-database'),R=require('./run-battle-regressions'),Audit=require('./audit-planner-alternatives');
  const runtime=R.createRuntime(),source=G.extractLiveWorkerSource(),probe=G.createWorkerAdapter(A.instrumentWorkerSource(source),{dreStandard:true,strict:true});
  let fixture,baseline,item;
  for(const f of Audit.buildCases(runtime).filter(f=>!f.preFastAdvantage && /dedenne.*sableye|defense-buff-sableye|kingdra.*carbink/.test(f.id))){
    const result=probe.simulate({id:1,key:'base',config:f.config,aShields:f.shields,bShields:f.bShields??f.shields,includeSwing:false,trace:true,debugTimeline:true,alternativeProbe:{targets:[]}});
    const sensitivity=S.check(result,targets=>probe.simulate({id:2,key:'branch',config:f.config,aShields:f.shields,bShields:f.bShields??f.shields,includeSwing:false,trace:true,debugTimeline:true,alternativeProbe:{targets}}));
    if(sensitivity.status==='sensitive'){fixture=f;baseline=result;item=sensitivity.evidence;break;}
  }
  assert(fixture,'A real outcome-changing reply must be exercised.');
  const side=c=>({pokemonId:c.p.id,fastMoveId:c.fast.id,chargedMoveIds:c.charged.map(m=>m.id),ivAtk:0,ivDef:15,ivHp:15,shields:1,startEnergy:0});
  const recipe={version:S.VERSION,baselineOutcome:A.outcome(baseline),...item};
  const url=Link.createUrl('https://example.test/PogoPvp.html',{version:1,left:side(fixture.config.left),right:side(fixture.config.right),testedReply:recipe});
  const imported=Link.readLocation(new URL(url));assert(imported.testedReply);assert.equal(imported.testedReply.target.index,item.target.index);
  for(const invalid of [{...recipe,turn:-1},{...recipe,target:{...item.target,index:1.5}},{...recipe,target:{...item.target,type:'arbitrary'}}])assert.throws(()=>Link.normalizePayload({...imported,testedReply:invalid}));
  const runner=A.createRunner(()=>({terminate(){this.stopped=true;},postMessage(message){setImmediate(()=>{
    let data;try{data={id:message.id,type:'matrixCellResult',result:probe.simulate(message)};}catch(e){data={id:message.id,type:'matrixCellError',message:e.message};}
    if(!this.stopped)this.onmessage({data});
  });}}));
  function run(reply){return new Promise(resolve=>runner.start({config:fixture.config,aShields:fixture.shields,bShields:fixture.bShields??fixture.shields,testedReply:reply},state=>{if(state.phase!=='checking')resolve(state);}));}
  const verified=await run(imported.testedReply);assert.equal(verified.phase,'ready');assert.equal(verified.findings.length,1);assert.equal(verified.findings[0].outcome,item.outcome);
  assert.equal(verified.checked,1,'The clicked reply must be replayed directly, not found again by broad search.');
  const stale=await run({...imported.testedReply,turn:item.turn+1});assert.equal(stale.phase,'error');assert.equal(stale.findings.length,0,'A mismatched reply must never be presented as verified.');
  console.log(`Directed Battle replay passed: ${fixture.id}, T${item.turn}, ${item.outcome}; invalid and stale requests rejected.`);
}
directedReplay().catch(error=>{console.error(error);process.exitCode=1;});
