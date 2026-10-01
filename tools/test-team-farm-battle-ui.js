"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Battle=require('../src/team-builder/team-builder-battle-link'),Farm=require('../src/team-builder/team-farm-battle-link');
const side={pokemonId:'abomasnow',fastMoveId:'POWDER_SNOW',chargedMoveIds:['WEATHER_BALL_ICE','ENERGY_BALL'],ivAtk:4,ivDef:15,ivHp:15,shields:1,baiting:'selective',shieldMode:'smart',startEnergy:0};
const recipe={version:1,engineVersion:'battle-v1',first:{version:1,seasonId:'twilight-trails',left:side,right:side},farmer:side};
const html=fs.readFileSync('PogoPvp.html','utf8'),workers=[],fields={};
let copied='',runs=0;
class Worker {constructor(){workers.push(this);}postMessage(message){this.message=message;}terminate(){this.terminated=true;}}
class LocalURL extends URL {static createObjectURL(){return 'blob:test';}static revokeObjectURL(){}}
const field=id=>fields[id] ||= {value:'0',hidden:true,disabled:false,textContent:'',setAttribute(){},removeAttribute(){}};
const context={Worker,Blob:class{},URL:LocalURL,URLSearchParams,JSON,Number,
  farmBattleContext:null,farmBattleLoadWorker:null,farmBattleLoadTimeout:null,forcedMatchupPlan:null,
  battleEngineVersion:'battle-v1',activeSeasonData:{id:'twilight-trails'},$:field,
  setTimeout:fn=>fn,clearTimeout(){},setAppView(){},buildMatrixComputeWorkerSource:()=>'',
  validTeamBuilderBattleSide:()=>true,
  createTeamBuilderCombatant:(member,trainer)=>({trainer,p:{id:member.pokemonId},fast:{id:member.fastMoveId},charged:[],hp:100,maxHp:100,energy:0}),
  applyTeamBuilderBattleSide:(prefix,value)=>{field(prefix+'Shields').value=value.shields;},
  resetBattleStateFromSetup:()=>context.clearFarmBattleContext(),
  setStartEnergy:(prefix,value)=>{field(prefix+'StartEnergy').value=value;},renderShields(){},
  clampEnergy:value=>Math.max(0,Math.min(100,Number(value)||0)),
  startBattle:()=>context.applyFarmBattleEntry(),runBattleToEnd:()=>runs++,setupReadyForBattle:()=>true,
  battleShareSide:()=>side,writeManualScenarioLinkToClipboard:async value=>{copied=value;},
  window:{PvPeakTeamBuilderBattleLink:Battle,PvPeakTeamFarmBattleLink:Farm,location:new URL(Farm.createUrl('https://example.test/PogoPvp.html',recipe)),history:{replaceState(_a,_b,url){context.window.location=new URL(url);}}}
};
vm.createContext(context);
const slice=(start,end)=>html.slice(html.indexOf(`    function ${start}(`),html.indexOf(`    function ${end}(`));
vm.runInContext(slice('clearFarmBattleContext','loadTeamBuilderBattleFromLocation')+html.slice(html.indexOf('    async function copyBattleShareLink('),html.indexOf('    function clearFarmBattleContext(')),context);
const entry={left:{hp:62,maxHp:100,energy:48,shields:0,attackStage:-1,defenseStage:2},right:{hp:41,maxHp:160,energy:8,shields:0,attackStage:-3,defenseStage:0},turns:{A:0,B:2}};
(async()=>{
  assert.equal(context.loadTeamFarmBattleFromLocation(),true);
  const first=workers.at(-1);context.clearFarmBattleContext();
  first.onmessage({data:{type:'matrixCellResult',result:{entry,fastOnly:true}}});
  assert.equal(runs,0,'A setup edit must reject an old worker response.');assert.equal(first.terminated,true);
  context.window.location=new URL(Farm.createUrl('https://example.test/PogoPvp.html',recipe));
  context.loadTeamFarmBattleFromLocation();const active=workers.at(-1);
  active.onmessage({data:{type:'matrixCellResult',result:{entry,fastOnly:true}}});
  assert.equal(runs,1);assert.equal(context.left.hp,62);assert.equal(context.right.energy,8);assert.equal(context.right.attackStage,-3);
  assert.equal(context.farmBattleContext.entry.turns.B,2);assert.equal(context.forcedMatchupPlan.defaultSide,'A');
  await context.copyBattleShareLink();assert.deepEqual(Farm.readLocation(new URL(copied)),Farm.normalize(recipe),'Copy Battle Link must preserve the farm recipe.');
  context.farmBattleContext.start={A:{hp:40,energy:60,shields:1},B:{hp:41,energy:8,shields:0}};
  await context.copyBattleShareLink();assert.deepEqual(Farm.readLocation(new URL(copied)).start,context.farmBattleContext.start,'Sharing a matrix preview must also preserve its initial resource overrides.');
  context.clearFarmBattleContext();assert.equal(context.forcedMatchupPlan,null);assert.equal(context.window.location.searchParams.has('tbFarm'),false);
  context.window.location=new URL('https://example.test/PogoPvp.html?tbFarm=broken');
  const count=workers.length;context.loadTeamFarmBattleFromLocation();assert.equal(workers.length,count);assert.equal(fields.battleShareError.hidden,false);
  context.window.location=new URL(Farm.createUrl('https://example.test/PogoPvp.html',{...recipe,engineVersion:'old-engine'}));
  context.loadTeamFarmBattleFromLocation();assert.equal(workers.length,count,'A link for another engine must fail before starting a worker.');
  console.log('Farm Battle import, stale response rejection, exact resources, copied link and cleanup passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
