"use strict";
const assert=require("node:assert/strict"), fs=require("node:fs"), vm=require("node:vm");
const Team=require("../src/team-builder/team-builder-state"), Share=require("../src/team-builder/team-matchup-share");
const clone=value=>JSON.parse(JSON.stringify(value));
const member=index=>({pokemonId:`pokemon-${index}`,name:`Pokémon ${index} é`,dex:index+1,types:["Normal"],fastMoveId:`FAST_${index}`,chargedMoveIds:[`CHARGED_${index}`],build:{profile:"custom",league:"great",ivAtk:index,ivDef:15,ivHp:14}});
const payload={schemaVersion:1,own:Team.createState({team:Array.from({length:6},(_,i)=>member(i))}),opponent:Team.createState({team:[member(8),member(9)]}),shields:{A:2,B:1},energy:{A:20,B:8},trioIds:["pokemon-0","pokemon-2","pokemon-5"],seasonId:"twilight-trails"};
const token=Share.encode(payload), expected=Share.normalize(payload);
assert.deepEqual(Share.decode(token),expected,"Both teams, custom moves, IVs, draft slots, shields, energy and trio must survive sharing.");
const url=new URL(Share.createUrl("https://example.test/PogoPvp.html?view=simulator&tbBattle=old&compendium=move&item=old&season=old#team=old",payload));
assert.equal(url.searchParams.get("season"),payload.seasonId);assert.equal(url.searchParams.get("view"),"team-builder");
for(const key of ["tbBattle","compendium","item"])assert.equal(url.searchParams.has(key),false);
assert.equal(Share.tokenFromLocation(url),token);assert.equal(new URLSearchParams(url.hash.slice(1)).has("team"),false);
assert.equal(Share.tokenFromLocation({hash:"#team=old"}),null);
assert.deepEqual(Share.decode(Share.encode({...payload,energy:undefined,trioIds:undefined})).energy,{A:0,B:0});
for(const invalid of ["v2.e30","v1.***","v1.bm90LWpzb24","v1._w","x".repeat(Share.MAX_LENGTH+1)])assert.throws(()=>Share.decode(invalid));
for(const mutate of [
  value=>value.schemaVersion=2,
  value=>value.shields.A=3,
  value=>value.energy.B=101,
  value=>value.energy.B="8",
  value=>value.trioIds=["pokemon-0","pokemon-0"],
  value=>value.trioIds=["pokemon-9"],
  value=>value.trioIds=["pokemon-0","pokemon-1","pokemon-2","pokemon-3"],
  value=>value.opponent.team=Array(6).fill(null),
  value=>value.own.team[0].build.ivAtk=16,
  value=>value.opponent.team[0].chargedMoveIds=["ONE","ONE"],
  value=>value.seasonId="../bad"
]) { const value=clone(payload);mutate(value);assert.throws(()=>Share.encode(value)); }
// Exercise the real loader: all validation must finish before either current team is changed.
const html=fs.readFileSync("PogoPvp.html","utf8");
const loader=html.slice(html.indexOf("    function loadSharedMatchupFromLocation("),html.indexOf("    function teamBuilderEditableState("));
const fields={teamBuilderShareError:{hidden:true,dataset:{},querySelector:()=>({textContent:""})},teamBuilderShareErrorDismiss:{focus(){}}};
let runtimeReject=false,changes=0,opened=0;
const context={window:{PvPeakTeamMatchupShare:Share,PvPeakTeamBuilder:Team,location:url},activeSeasonData:{id:payload.seasonId},
  teamBuilderState:Team.createState({team:[member(10)]}),teamBuilderOpponentState:Team.createState({team:[member(11)]}),
  teamBuilderOpponentShields:{A:1,B:1},teamBuilderOpponentEnergy:{A:0,B:0},teamBuilderTrioIds:[],teamBuilderComparisonBaseline:[member(12)],
  validateSharedTeamForRuntime:value=>{if(runtimeReject && value.state.team[0].pokemonId==="pokemon-8")throw Error("Illegal opponent move");},
  cancelTeamBuilderAnalysis:()=>changes++,persistTeamBuilderState(){},persistTeamBuilderComparisonBaseline(){},persistTeamOpponent(){},
  setAppView(){},refreshTeamOpponentPlan(){},teamOpponentUIController:{open:()=>opened++},teamBuilderFeedback(){},
  $:id=>fields[id],requestAnimationFrame:fn=>fn()};
vm.createContext(context);vm.runInContext(loader,context);
const before=JSON.stringify([context.teamBuilderState,context.teamBuilderOpponentState,context.teamBuilderOpponentShields,context.teamBuilderOpponentEnergy,context.teamBuilderTrioIds,context.teamBuilderComparisonBaseline]);
function unchanged(){assert.equal(JSON.stringify([context.teamBuilderState,context.teamBuilderOpponentState,context.teamBuilderOpponentShields,context.teamBuilderOpponentEnergy,context.teamBuilderTrioIds,context.teamBuilderComparisonBaseline]),before);assert.equal(changes,0);assert.equal(opened,0);}
runtimeReject=true;assert.equal(context.loadSharedMatchupFromLocation(),true);unchanged();assert.equal(fields.teamBuilderShareError.hidden,false);
runtimeReject=false;context.activeSeasonData.id="wrong-season";assert.equal(context.loadSharedMatchupFromLocation(),true);unchanged();
context.window.location=new URL("https://example.test/#teamMatchup=v1.broken");assert.equal(context.loadSharedMatchupFromLocation(),true);unchanged();
context.window.location=url;context.activeSeasonData.id=payload.seasonId;assert.equal(context.loadSharedMatchupFromLocation(),true);
assert.equal(changes,1);assert.equal(opened,1);assert.equal(fields.teamBuilderShareError.hidden,true);
assert.deepEqual(clone(context.teamBuilderState),expected.own);assert.deepEqual(clone(context.teamBuilderOpponentState),expected.opponent);
assert.deepEqual(clone(context.teamBuilderOpponentEnergy),payload.energy);assert.deepEqual(clone(context.teamBuilderTrioIds),payload.trioIds);
assert.equal(context.teamBuilderComparisonBaseline,null);
context.window.location=new URL("https://example.test/?view=team-builder");assert.equal(context.loadSharedMatchupFromLocation(),false);
console.log("Full comparison link roundtrip, Unicode, draft teams, invalid data and atomic runtime loading passed.");
