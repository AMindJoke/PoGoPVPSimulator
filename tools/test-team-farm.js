"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const G=require("./build-great-league-meta-database");
const gm=G.readWindowGlobal("battle-data.js","BATTLE_GAMEMASTER"),sets=G.readWindowGlobal("default-movesets.js","BATTLE_DEFAULT_MOVESETS");
const moves=new Map(gm.moves.map(move=>[move.moveId,G.normalizeMove(move)]));
const pokemon=new Map(gm.pokemon.filter(p=>p?.speciesId && p.baseStats).map(p=>G.normalizePokemon(p,moves)).map(p=>[p.id,p]));
const config=(a,b)=>{const value=G.createBattleConfig(pokemon.get(a),pokemon.get(b),G.DEFAULT_PROFILE,moves,sets,pokemon);value.left.shieldMode=value.right.shieldMode="smart";return value;};
const clone=value=>JSON.parse(JSON.stringify(value));
const html=fs.readFileSync("PogoPvp.html","utf8"),helper=html.slice(html.indexOf("    function prepareTeamFarmEntry("),html.indexOf("    function simulateTeamFarmFollowUps("));
const context={};vm.createContext(context);vm.runInContext(helper,context);
const fresh=config("clodsire","talonflame").left, survivor=config("mimikyu","talonflame").right;
Object.assign(survivor,{hp:45,energy:61,shields:1,attackStage:2,defenseStage:-1,timingPlanMoveId:"FLY",timingPlanFastMovesRemaining:2});
const terminal={left:{shields:0},right:survivor,turns:{A:10,B:14},knockoutTurn:10};
const original=JSON.stringify([fresh,terminal]);
const entry=context.prepareTeamFarmEntry(fresh,terminal);
assert.equal(entry.left.hp,fresh.maxHp);assert.equal(entry.left.energy,0);assert.equal(entry.left.shields,0);
assert.equal(entry.right.hp,45);assert.equal(entry.right.energy,61);assert.equal(entry.right.attackStage,2);assert.equal(entry.right.defenseStage,-1);
assert.equal(entry.right.timingPlanMoveId,null);assert.equal(entry.turns.B,3);assert.equal(JSON.stringify([fresh,terminal]),original);

const source=G.extractLiveWorkerSource(), adapter=G.createWorkerAdapter(source,{dreStandard:true});
let count=0, eligible=0;const outcomes=new Set();
for(const [loser,enemy,farmer] of [
  ["abomasnow","talonflame","clodsire"],["abomasnow","talonflame","altaria"],
  ["melmetal","clodsire","abomasnow"],["altaria","abomasnow","talonflame"],
  ["clodsire","abomasnow","mimikyu"],["mimikyu","clodsire","altaria"],
  ["altaria","clodsire","abomasnow"]
]) for(const shields of [0,1,2]) {
  const base=config(loser,enemy), companion={slot:2,combatant:config(farmer,enemy).left};
  base.startEnergyB=13;base.right.energy=13;
  const before=adapter.simulate({id:1,key:"before",config:base,aShields:shields,bShields:shields,includeSwing:false,debugTimeline:true});
  const input=JSON.stringify([base,companion]);
  const result=adapter.simulate({id:2,key:"farm",source:"team-builder-farm",config:base,aShields:shields,bShields:shields,farmCompanions:[companion]});
  assert.equal(result.score,before.score,"Observing farm opportunities must not change the first battle.");
  assert.equal(JSON.stringify([base,companion]),input,"Farm branches must not mutate builds or another branch.");
  if(result.eligible) {
    eligible++;assert.equal(result.routes.length,1);const route=result.routes[0];outcomes.add(route.status);
    assert.ok(Math.abs(route.entry.opponentHp/route.entry.opponentMaxHp-before.details.bHp)<1e-8);
    assert.equal(route.entry.opponentEnergy,before.details.bEnergy);
    assert.ok(route.entry.teamShields<=shields);assert.ok(route.entry.opponentShields<=shields);
    assert.ok(route.energyAfter>=0 && route.energyAfter<=100);assert.ok(route.hpAfter>=0 && route.hpAfter<=route.maxHp);
    assert.ok(route.shieldsAfter<=route.entry.teamShields);
    if(route.status==="safe") {assert.equal(route.chargeWindowOpened,false);assert.equal(route.chargedReceived,0);assert.ok(route.hpAfter>0);}
    if(route.status==="charged")assert.ok(route.chargedReceived>0);
    if(route.status==="risk") {assert.equal(route.chargeWindowOpened,true);assert.equal(route.chargedReceived,0);}
    if(route.status==="failed")assert.equal(route.hpAfter,0);
  } else assert.equal(result.routes.length,0);
  const repeated=adapter.simulate({id:3,key:"after",config:base,aShields:shields,bShields:shields,includeSwing:false,debugTimeline:true});
  assert.deepEqual(repeated.details,before.details,"A farm calculation must not leak policies or state into Battle.");
  assert.deepEqual(repeated.timelineTrace,before.timelineTrace);
  count++;
}
assert.ok(eligible>0);
assert.ok(outcomes.has("safe") && outcomes.has("charged") && outcomes.has("failed"),"Fixtures must exercise safe farms, charged exposure and failed farms.");
console.log(`Farm carry-over and canonical isolation passed: ${count} real setups, ${eligible} losing matchups, statuses ${[...outcomes].join(", ")}.`);

// A delayed worker response cannot publish a route for an old trio/build/scenario.
const Team=require("../src/team-builder/team-builder-state"),Opponent=require("../src/team-builder/team-builder-opponent");
const member=id=>({pokemonId:id,name:id,fastMoveId:"FAST",chargedMoveIds:["CHARGE"],build:{ivAtk:0,ivDef:15,ivHp:15}});
const own=Team.createState({team:[member("one"),member("two"),member("three")]}),other=Team.createState({team:[member("enemy")]}),workers=[],timers=new Set();
class FakeWorker { constructor(){workers.push(this);} postMessage(message){this.message=message;} terminate(){this.terminated=true;} }
const queueContext={teamBuilderState:own,teamBuilderTrioIds:["one","two","three"],teamBuilderOpponentPlan:Opponent.createPlan({team:own.team,opponentTeam:other.team}),
  teamBuilderAnalysisCache:{has:()=>true,get:()=>({winner:"meta"})},teamTrioFarmState:{signature:"",phase:"idle",results:[],done:0,total:0},
  teamTrioFarmCache:new Map(),teamTrioFarmWorker:null,teamTrioFarmTimeout:null,
  Worker:FakeWorker,Blob:class {},URL:{createObjectURL:()=>"blob:test",revokeObjectURL(){}},
  setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn),
  teamOpponentUIController:{renderResults(){}},buildMatrixComputeWorkerSource:()=>"worker",
  createTeamBuilderBattleConfig:job=>({slot:job.slot}),createTeamBuilderCombatant:value=>value};
vm.createContext(queueContext);
vm.runInContext(html.slice(html.indexOf("    function stopTeamTrioFarmAnalysis("),html.indexOf("    function initTeamOpponent(")),queueContext);
queueContext.startTeamTrioFarmAnalysis();const first=workers[0];assert.equal(queueContext.teamTrioFarmState.phase,"running");
queueContext.teamBuilderOpponentPlan=Opponent.createPlan({team:own.team,opponentTeam:other.team,startEnergyB:10});
queueContext.currentTeamTrioFarmState();assert.equal(first.terminated,true);
first.onmessage({data:{key:first.message.key,type:"matrixCellResult",result:{eligible:true,routes:[]}}});
assert.equal(queueContext.teamTrioFarmState.done,0);assert.equal(queueContext.teamTrioFarmState.results.length,0);
queueContext.startTeamTrioFarmAnalysis();const second=workers[1];
second.onmessage({data:{key:second.message.key,type:"matrixCellError"}});assert.equal(queueContext.teamTrioFarmState.phase,"error");assert.equal(second.terminated,true);
queueContext.startTeamTrioFarmAnalysis();const third=workers[2];
for(let i=0;i<3;i++)third.onmessage({data:{key:third.message.key,type:"matrixCellResult",result:{eligible:true,routes:[]}}});
assert.equal(queueContext.teamTrioFarmState.phase,"complete");assert.equal(queueContext.teamTrioFarmState.done,3);assert.equal(third.terminated,true);assert.equal(timers.size,0);
queueContext.startTeamTrioFarmAnalysis();const fourth=workers[3];
queueContext.teamBuilderTrioIds=["one","two"];queueContext.currentTeamTrioFarmState();assert.equal(fourth.terminated,true);
queueContext.teamBuilderTrioIds=["one","two","three"];queueContext.currentTeamTrioFarmState();assert.equal(queueContext.teamTrioFarmState.phase,"complete","Returning to unchanged conditions may reuse completed results.");
console.log("Farm queue cancellation, stale-result rejection, retry and condition-aware reuse passed.");
