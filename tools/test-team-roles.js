'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Roles=require('../src/team-builder/team-builder-roles'),Link=require('../src/team-builder/team-builder-battle-link');
const plan=[];for(let slot=0;slot<4;slot++)for(let opponentSlot=0;opponentSlot<4;opponentSlot++)plan.push({slot,opponentSlot,key:`build-${slot}-${opponentSlot}`,member:{pokemonId:`own-${slot}`}});
const jobs=Roles.createJobs(plan,2),results=new Map();assert.equal(jobs.length,112);assert.equal(Roles.createJobs(plan,0).length,64,'Zero reaction must reuse identical equal-shield scenarios.');
for(const job of jobs) {
  const {slot,opponentSlot,scenario}=job;
  let outcome=(slot===1 && ['even1','even2'].includes(scenario.id)) || (slot===2 && scenario.id.startsWith('switch')) || (slot===3 && scenario.id==='closer') ? 'A' : 'B';
  if(slot===0 && scenario.id==='switch1')outcome=opponentSlot===0 ? 'draw' : 'A';
  results.set(job.key,{score:outcome==='A' ? 750 : outcome==='draw' ? 700 : 200,details:{outcome},aUsed:slot===0 ? 1 : 0,bUsed:0});
}
const analysis=Roles.analyze(plan,results,2);
assert.equal(analysis.ready,true);assert.equal(analysis.candidates.length,24,'All six orders of every trio must be considered.');
assert.deepEqual(analysis.suggestions[0].slots,[1,2,3]);assert.equal(analysis.leaders.lead[0].slot,1);assert.equal(analysis.leaders.switch[0].slot,2);assert.equal(analysis.leaders.closer[0].slot,3);
assert.equal(new Set(analysis.suggestions.map(c=>c.slots.join(','))).size,3,'Alternatives must be distinct ordered trios.');
assert.equal(analysis.profiles[0].switch1.wins,3);assert.equal(analysis.profiles[0].switch1.draws,1,'A high-rating draw must not become a win.');
assert.equal(analysis.profiles[0].switch1.evenSpend,0,'Winning by spending more shields is not an even-spend win.');
assert.equal(analysis.profiles[3].closer.wins,4);assert.equal(analysis.profiles[3].even0.wins,0,'Shield-advantage success must stay separate from 0–0 performance.');
assert.equal(analysis.suggestions[0].sole.length,4);assert.equal(analysis.suggestions[0].dependency,4,'Single-answer dependence must remain visible despite full coverage.');
assert.deepEqual(Roles.analyze([...plan].reverse(),results,2).suggestions,analysis.suggestions,'Input order cannot change recommendations.');
const splitRisks=new Map(results);
for(const job of jobs.filter(job=>job.slot===0 && job.scenario.id.startsWith('switch'))) {
  const extra=(job.scenario.id==='switch1' && job.opponentSlot===0) || (job.scenario.id==='switch2' && job.opponentSlot===1);
  splitRisks.set(job.key,{score:750,details:{outcome:job.opponentSlot===2 ? 'draw' : 'A'},aUsed:extra ? 1 : 0,bUsed:0});
}
const stable=Roles.analyze(plan,splitRisks,2).profiles[0];
assert.equal(stable.switch1.evenUnbeaten,3);assert.equal(stable.switch2.evenUnbeaten,3);
assert.deepEqual(stable.switchStable,[2,3],'Reliability must intersect the SAME opponents across all shields, including draws without extra shield spend.');
assert.deepEqual(stable.switchRisks,[0,1]);
for(const job of jobs.filter(job=>job.slot===1 && job.scenario.id.startsWith('switch'))) {
  splitRisks.set(job.key,{score:job.opponentSlot===0 ? 200 : 750,details:{outcome:job.opponentSlot===0 ? 'B' : 'A'},aUsed:0,bUsed:0});
}
const stabilityOrder=Roles.analyze(plan,splitRisks,2).leaders.switch.map(p=>p.slot);
assert.ok(stabilityOrder.indexOf(1)<stabilityOrder.indexOf(0),'More consistently unbeaten opponents without extra shields must outrank wins purchased with more shields.');
const mixedRecovery=new Map(results);
for(const enemy of [0,1])mixedRecovery.set(Roles.cellKey(1,enemy,{a:1,b:1,delay:0}),{score:200,details:{outcome:'B'},aUsed:1,bUsed:1});
mixedRecovery.set(Roles.cellKey(2,1,{a:1,b:1,delay:2}),{score:200,details:{outcome:'B'},aUsed:1,bUsed:1});
const mixed=Roles.analyze(plan,mixedRecovery,2).candidates.find(c=>c.lead===1 && c.switch===2 && c.closer===3);
assert.deepEqual(mixed.recovery,[0]);assert.deepEqual(mixed.uncoveredLead,[1],'Covered lead losses must not hide an uncovered one.');
const partial=new Map(results);partial.delete(jobs[0].key);assert.equal(Roles.analyze(plan,partial,2).ready,false);
for(const invalid of [-1,5,1.5])assert.throws(()=>Roles.scenarios(invalid));
const side={pokemonId:'abomasnow',fastMoveId:'POWDER_SNOW',chargedMoveIds:['WEATHER_BALL_ICE'],ivAtk:0,ivDef:15,ivHp:15,shields:1,startEnergy:0};
const payload={version:1,left:side,right:side,reactionDelayTurns:2};
assert.equal(Link.readLocation(new URL(Link.createUrl('https://example.test/PogoPvp.html',payload))).reactionDelayTurns,2);
for(const invalid of [-1,5,'2',1.5])assert.throws(()=>Link.normalizePayload({...payload,reactionDelayTurns:invalid}));
console.log('Role coverage, role assignment, diverse alternatives, draws, shield spend, dependency and reaction links passed.');

const queued=[],timers=new Set();let currentPlan=plan,rendered=0;
const context={PvPeakTeamRoles:Roles,setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn)};vm.createContext(context);vm.runInContext(fs.readFileSync('src/team-builder/team-role-analysis.js','utf8'),context);
const coordinator=context.PvPeakTeamRoleAnalysis.create({plan:()=>currentPlan,config:()=>({left:{energy:20},right:{energy:8}}),combatant:member=>member,render:()=>rendered++,worker:()=>{const worker={postMessage(message){this.message=message;},terminate(){this.terminated=true;}};queued.push(worker);return worker;}});
coordinator.start();const first=queued[0];assert.equal(first.message.config.startEnergyA,0);assert.equal(first.message.config.startEnergyB,0,'Role scenarios must not inherit the comparison energy bonus.');
coordinator.cancel();first.onmessage({data:{key:first.message.key,type:'matrixCellResult',result:{details:{outcome:'A'}}}});assert.equal(coordinator.state().phase,'idle');assert.equal(coordinator.state().done,0);assert.equal(first.terminated,true);
coordinator.start();const second=queued.at(-1);currentPlan=plan.map(job=>({...job,key:job.key+'-changed'}));coordinator.state();second.onmessage({data:{key:second.message.key,type:'matrixCellResult',result:{details:{outcome:'A'}}}});assert.equal(coordinator.state().phase,'idle');assert.equal(second.terminated,true);
coordinator.start();const active=queued.at(-1);
while(coordinator.state().phase==='running')active.onmessage({data:{key:active.message.key,type:'matrixCellResult',result:{score:750,details:{outcome:'A'},aUsed:0,bUsed:0,routes:[]}}});
assert.equal(coordinator.state().phase,'complete');assert.equal(coordinator.state().analysis.candidates.length,24);assert.equal(timers.size,0);assert.equal(active.terminated,true);
const before=queued.length;coordinator.start();assert.equal(queued.length,before,'A completed unchanged analysis must not be recalculated.');
const completedPlan=currentPlan;
currentPlan=completedPlan.map(job=>({...job,slot:job.slot+1,opponentSlot:job.opponentSlot+1}));
assert.equal(coordinator.state().phase,'idle','Identical builds in different slots cannot reuse a result assigned to old slots.');
currentPlan=completedPlan;assert.equal(coordinator.state().phase,'complete','Restoring the original slot layout should reuse its complete analysis.');
coordinator.setDelay(1);assert.equal(coordinator.state().phase,'idle');coordinator.start();const changed=queued.at(-1);changed.onmessage({data:{key:changed.message.key,type:'matrixCellError'}});assert.equal(coordinator.state().phase,'error');coordinator.start();assert.equal(coordinator.state().phase,'running');coordinator.cancel();
console.log('Role worker cancellation, stale responses, condition cache, bounded queue, errors and retry passed.');

const G=require('./build-great-league-meta-database'),gm=G.readWindowGlobal('battle-data.js','BATTLE_GAMEMASTER'),sets=G.readWindowGlobal('default-movesets.js','BATTLE_DEFAULT_MOVESETS');
const moves=new Map(gm.moves.map(move=>[move.moveId,G.normalizeMove(move)])),pokemon=new Map(gm.pokemon.filter(p=>p?.speciesId && p.baseStats).map(p=>G.normalizePokemon(p,moves)).map(p=>[p.id,p]));
const adapter=G.createWorkerAdapter(G.extractLiveWorkerSource(),{dreStandard:true});let comparisons=0;
for(const own of ['altaria','abomasnow','melmetal','talonflame'])for(const shields of [0,1,2])for(const delay of [0,2]) {
  const config=G.createBattleConfig(pokemon.get(own),pokemon.get('clodsire'),G.DEFAULT_PROFILE,moves,sets,pokemon);config.left.shieldMode=config.right.shieldMode='smart';config.turns={A:0,B:delay};
  const request={id:1,key:`${own}-${shields}-${delay}`,source:'team-builder-roles',config,aShields:shields,bShields:shields,includeSwing:false,debugTimeline:true};
  const input=JSON.stringify(config),role=adapter.simulate({...request,roleAnalysis:true}),plain=adapter.simulate({...request,key:'plain',source:'battle'});
  assert.deepEqual(role.details,plain.details);assert.equal(role.score,plain.score);assert.equal(JSON.stringify(config),input);assert.equal(role.terminal,undefined,'Role results do not transfer whole combatants.');
  assert.ok(role.aUsed>=0 && role.aUsed<=shields);assert.ok(role.bUsed>=0 && role.bUsed<=shields);
  const a=role.timelineTrace.find(e=>e.trainer==='A'),b=role.timelineTrace.find(e=>e.trainer==='B');assert.equal(a.start,0);assert.equal(a.energyBefore,0);assert.ok(b.start>=delay,'The counter must not act before its reaction delay.');assert.equal(a.duration,config.left.fast.turns,'Two turns are not two Fast moves.');
  const replay=adapter.simulate({...request,key:'replay',source:'battle'});assert.deepEqual(replay.timelineTrace,plain.timelineTrace,'Role observation cannot change subsequent ordinary battles.');comparisons++;
}
console.log(`Canonical role/Battle parity, real Fast duration, reaction delay and planner isolation passed: ${comparisons} scenarios.`);

// Import and share the same reaction scenario through the real Battle UI functions.
const html=fs.readFileSync('PogoPvp.html','utf8'),fields={};let starts=0,runs=0,copied='';
const field=id=>fields[id] ||= {disabled:false,hidden:true,textContent:'',setAttribute(){},removeAttribute(){}};
const battle={battleReactionDelay:0,farmBattleContext:null,activeSeasonData:{id:'twilight-trails'},URLSearchParams,$:field,
  validTeamBuilderBattleSide:()=>true,setAppView(){},applyTeamBuilderBattleSide(){},
  resetBattleStateFromSetup(){battle.battleReactionDelay=0;},startBattle(){starts++;},runBattleToEnd(){runs++;},
  setupReadyForBattle:()=>true,battleShareSide:()=>side,writeManualScenarioLinkToClipboard:async url=>{copied=url;},
  window:{PvPeakTeamBuilderBattleLink:Link,location:new URL(Link.createUrl('https://example.test/PogoPvp.html',{...payload,seasonId:'twilight-trails'}))}};
vm.createContext(battle);vm.runInContext(html.slice(html.indexOf('    function loadTeamBuilderBattleFromLocation('),html.indexOf('    function closeTeamBuilderMatchup('))+html.slice(html.indexOf('    async function copyBattleShareLink('),html.indexOf('    function clearFarmBattleContext(')),battle);
assert.equal(battle.loadTeamBuilderBattleFromLocation(),true);assert.equal(battle.battleReactionDelay,2);assert.equal(starts,1,'A reaction scenario must initialize its real turn state before running.');assert.equal(runs,1);
(async()=>{
  await battle.copyBattleShareLink();assert.equal(Link.readLocation(new URL(copied)).reactionDelayTurns,2);
  battle.window.location=new URL(Link.createUrl('https://example.test/PogoPvp.html',{...payload,reactionDelayTurns:0}));battle.loadTeamBuilderBattleFromLocation();assert.equal(battle.battleReactionDelay,0,'Ordinary links must clear a prior switch delay.');
  console.log('Battle reaction import, initial state, copied link and ordinary setup isolation passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
