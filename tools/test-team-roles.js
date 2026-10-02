'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Roles=require('../src/team-builder/team-builder-roles'),Link=require('../src/team-builder/team-builder-battle-link');
const OpponentContext=require('../src/team-builder/team-opponent-context');
const plan=[];for(let slot=0;slot<4;slot++)for(let opponentSlot=0;opponentSlot<4;opponentSlot++)plan.push({slot,opponentSlot,key:`build-${slot}-${opponentSlot}`,member:{pokemonId:`own-${slot}`},opponentMember:{pokemonId:`enemy-${opponentSlot}`}});
const jobs=Roles.createJobs(plan,2),results=new Map();assert.equal(jobs.length,128);assert.equal(Roles.createJobs(plan,0).length,80,'Zero reaction must reuse equal-shield scenarios while retaining the distinct energy check.');
for(const job of jobs) {
  const {slot,opponentSlot,scenario}=job;
  let outcome=(slot===1 && ['even1','even2'].includes(scenario.id)) || (slot===2 && (scenario.id.startsWith('switch') || scenario.id==='stay1')) || (slot===3 && scenario.id==='closer') ? 'A' : 'B';
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
const stayScene=Roles.scenarios(2).find(s=>s.id==='stay1');
assert.deepEqual(stayScene,Roles.scenarios(0).find(s=>s.id==='stay1'),'Reaction setting must not change the staying-lead check.');
assert.notEqual(Roles.cellKey(2,1,stayScene),Roles.cellKey(2,1,{a:1,b:1,delay:0}),'Banked-energy checks cannot reuse fresh-start results.');
mixedRecovery.set(Roles.cellKey(2,1,stayScene),{score:200,details:{outcome:'B'},aUsed:1,bUsed:1});
const mixed=Roles.analyze(plan,mixedRecovery,2).candidates.find(c=>c.lead===1 && c.switch===2 && c.closer===3);
assert.deepEqual(mixed.recovery,[0]);assert.deepEqual(mixed.uncoveredLead,[1],'Covered lead losses must not hide an uncovered one.');
assert.equal(Roles.outcome(mixedRecovery.get(Roles.cellKey(2,1,{a:1,b:1,delay:2}))),'A','The switch can win against a fresh delayed counter and still fail against a staying lead with energy.');
assert.equal(mixed.unrecovered,1,'The energy-check failure must also affect trio ranking.');
mixedRecovery.set(Roles.cellKey(2,1,stayScene),{score:700,details:{outcome:'draw'},aUsed:1,bUsed:1});
assert.deepEqual(Roles.analyze(plan,mixedRecovery,2).candidates.find(c=>c.lead===1 && c.switch===2 && c.closer===3).recovery,[0],'A high-rated energy-check draw must not appear under Switch wins.');
const noEnergyCheck=new Map(results);noEnergyCheck.delete(Roles.cellKey(2,1,stayScene));
assert.equal(Roles.analyze(plan,noEnergyCheck,2).ready,false,'Fresh results cannot stand in for an uncalculated banked-energy check.');
const partial=new Map(results);partial.delete(jobs[0].key);assert.equal(Roles.analyze(plan,partial,2).ready,false);
for(const invalid of [-1,5,1.5])assert.throws(()=>Roles.scenarios(invalid));
const side={pokemonId:'abomasnow',fastMoveId:'POWDER_SNOW',chargedMoveIds:['WEATHER_BALL_ICE'],ivAtk:0,ivDef:15,ivHp:15,shields:1,startEnergy:0};
const payload={version:1,left:side,right:side,reactionDelayTurns:2};
assert.equal(Link.readLocation(new URL(Link.createUrl('https://example.test/PogoPvp.html',payload))).reactionDelayTurns,2);
for(const invalid of [-1,5,'2',1.5])assert.throws(()=>Link.normalizePayload({...payload,reactionDelayTurns:invalid}));
console.log('Role coverage, role assignment, diverse alternatives, draws, shield spend, dependency and reaction links passed.');

const queued=[],timers=new Set();let currentPlan=plan,rendered=0;
const context={PvPeakTeamRoles:Roles,PvPeakTeamOpponentContext:OpponentContext,setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn)};vm.createContext(context);vm.runInContext(fs.readFileSync('src/team-builder/team-role-analysis.js','utf8'),context);
const coordinator=context.PvPeakTeamRoleAnalysis.create({plan:()=>currentPlan,config:job=>({left:{energy:20,pokemonId:job.member.pokemonId,trainer:'A'},right:{energy:8,pokemonId:job.opponentMember.pokemonId,trainer:'B',fast:{energyGain:9}}}),combatant:member=>member,render:()=>rendered++,worker:()=>{const worker={postMessage(message){this.message=message;},terminate(){this.terminated=true;}};queued.push(worker);return worker;}});
coordinator.start();const first=queued[0];assert.equal(first.message.config.startEnergyA,0);assert.equal(first.message.config.startEnergyB,0,'Role scenarios must not inherit the comparison energy bonus.');
coordinator.cancel();first.onmessage({data:{key:first.message.key,type:'matrixCellResult',result:{details:{outcome:'A'}}}});assert.equal(coordinator.state().phase,'idle');assert.equal(coordinator.state().done,0);assert.equal(first.terminated,true);
coordinator.start();const second=queued.at(-1);currentPlan=plan.map(job=>({...job,key:job.key+'-changed'}));coordinator.state();second.onmessage({data:{key:second.message.key,type:'matrixCellResult',result:{details:{outcome:'A'}}}});assert.equal(coordinator.state().phase,'idle');assert.equal(second.terminated,true);
coordinator.start();const active=queued.at(-1);
let reversedJobs=0,energyChecks=0;
while(coordinator.state().phase==='running'){
  if(active.message.key.endsWith(':foe-fast-energy')){energyChecks++;assert.equal(active.message.config.startEnergyA,0);assert.equal(active.message.config.left.energy,0);assert.equal(active.message.config.startEnergyB,9);assert.equal(active.message.config.right.energy,9);assert.equal(active.message.config.turns.B,0,'A staying lead cannot receive the new-counter reaction delay.');}
  if(active.message.key.startsWith('opponent:')){reversedJobs++;assert.ok(active.message.config.left.pokemonId.startsWith('enemy-'));assert.ok(active.message.config.right.pokemonId.startsWith('own-'));assert.equal(active.message.config.left.trainer,'A');assert.equal(active.message.config.turns.B,active.message.key.endsWith(':2') ? 2 : 0);}
  active.onmessage({data:{key:active.message.key,type:'matrixCellResult',result:{score:750,details:{outcome:'A'},aUsed:0,bUsed:0,routes:[]}}});
}
assert.equal(reversedJobs,jobs.length);assert.equal(coordinator.state().opponentResults.size,jobs.length);assert.equal(coordinator.state().analysis.opponentContext.poolCount,4);
assert.equal(energyChecks,32,'One energy check per pair on each side.');
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

// The staying lead has banked energy, rather than the new counter's reaction delay.
let stayingChecks=0;
for(const enemy of ['florges','stunfisk','talonflame','altaria']) {
  const config=G.createBattleConfig(pokemon.get('florges'),pokemon.get(enemy),G.DEFAULT_PROFILE,moves,sets,pokemon);
  config.left.shieldMode=config.right.shieldMode='smart';
  const hp=[config.left.hp,config.right.hp],expectedEnergy=config.right.fast.energyGain;
  Roles.applyScenario(config,stayScene);
  assert.deepEqual([config.left.hp,config.right.hp],hp,'The check must not invent damage from the opening.');
  assert.equal(config.startEnergyB,expectedEnergy);assert.equal(config.right.energy,expectedEnergy);assert.equal(config.turns.B,0);
  const request={id:1,key:`staying-${enemy}`,source:'team-builder-roles',config,aShields:1,bShields:1,includeSwing:false,debugTimeline:true};
  const result=adapter.simulate({...request,roleAnalysis:true}),plain=adapter.simulate({...request,key:'staying-battle',source:'battle'});
  assert.equal(result.score,plain.score);assert.deepEqual(result.details,plain.details);
  assert.equal(result.timelineTrace.find(e=>e.trainer==='B').energyBefore,expectedEnergy);
  const battlePayload={version:1,seasonId:'twilight-trails',left:{...side,pokemonId:'florges',fastMoveId:config.left.fast.id,chargedMoveIds:config.left.charged.filter(Boolean).map(m=>m.id),ivAtk:config.left.ivAtk,ivDef:config.left.ivDef,ivHp:config.left.ivHp,startEnergy:config.startEnergyA},right:{...side,pokemonId:enemy,fastMoveId:config.right.fast.id,chargedMoveIds:config.right.charged.filter(Boolean).map(m=>m.id),ivAtk:config.right.ivAtk,ivDef:config.right.ivDef,ivHp:config.right.ivHp,startEnergy:config.startEnergyB},reactionDelayTurns:0};
  const decoded=Link.readLocation(new URL(Link.createUrl('https://example.test/PogoPvp.html',battlePayload)));
  assert.equal(decoded.right.startEnergy,expectedEnergy);assert.equal(decoded.left.startEnergy,0);assert.equal(decoded.reactionDelayTurns,undefined);
  if(enemy==='florges') {
    const fresh=G.createBattleConfig(pokemon.get('florges'),pokemon.get(enemy),G.DEFAULT_PROFILE,moves,sets,pokemon);
    fresh.left.shieldMode=fresh.right.shieldMode='smart';Roles.applyScenario(fresh,Roles.scenarios(2).find(s=>s.id==='switch1'));
    const delayed=adapter.simulate({...request,key:'fresh-mirror',config:fresh,roleAnalysis:true});
    assert.equal(delayed.details.outcome,'A','The delayed fresh mirror should favor the switch in this reference build.');
    assert.equal(result.details.outcome,'B','The same mirror must not be advertised as a win when the staying foe banks a Fast.');
  }
  stayingChecks++;
}
assert.throws(()=>Roles.applyScenario({left:{},right:{fast:{energyGain:NaN}}},stayScene));
console.log(`Staying-lead energy checks, mirror reversal, Battle parity and shared-link resources passed: ${stayingChecks} scenarios.`);

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
