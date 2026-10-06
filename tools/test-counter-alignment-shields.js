"use strict";
const assert=require("node:assert/strict");
const G=require("./build-great-league-meta-database");
const Roles=require("../src/team-builder/team-builder-roles");
const Context=require("../src/team-builder/team-opponent-context");
const gm=G.readWindowGlobal("battle-data.js","BATTLE_GAMEMASTER");
const movesets=G.readWindowGlobal("default-movesets.js","BATTLE_DEFAULT_MOVESETS");
const moves=new Map(gm.moves.map(move=>[move.moveId,G.normalizeMove(move)]));
const pokemon=new Map(gm.pokemon.filter(p=>p?.speciesId&&p.baseStats).map(p=>G.normalizePokemon(p,moves)).map(p=>[p.id,p]));
const adapter=G.createWorkerAdapter(G.extractLiveWorkerSource(),{dreStandard:true,strict:true});
const own=["mimikyu","clodsire","abomasnow"],enemy=["talonflame","mimikyu","melmetal"];
const loadouts={talonflame:["INCINERATE","FLY","BRAVE_BIRD"],melmetal:["THUNDER_SHOCK","DOUBLE_IRON_BASH","DYNAMIC_PUNCH"],mimikyu:["SHADOW_CLAW","SHADOW_SNEAK","PLAY_ROUGH"],abomasnow:["POWDER_SNOW","WEATHER_BALL_ICE","ENERGY_BALL"],clodsire:["POISON_STING","EARTHQUAKE","STONE_EDGE"]};
const plan=own.flatMap((id,slot)=>enemy.map((enemyId,opponentSlot)=>({key:`${slot}:${opponentSlot}`,slot,opponentSlot,member:{pokemonId:id},opponentMember:{pokemonId:enemyId},opponentId:enemyId})));
const reverse=Context.reversePlan(plan);
let simulations=0;
function prepare(job){
  const config=G.createBattleConfig(pokemon.get(job.member.pokemonId),pokemon.get(job.opponentMember.pokemonId),G.DEFAULT_PROFILE,moves,movesets,pokemon);
  for(const side of [config.left,config.right]){
    const ids=loadouts[side.p.id];side.fast=structuredClone(moves.get(ids[0]));side.charged=ids.slice(1).map(id=>structuredClone(moves.get(id)));side.shieldMode="smart";
  }
  return config;
}
function run(jobs){return new Map(Roles.createJobs(jobs,2).map(job=>[job.key,adapter.simulate({id:++simulations,key:job.key,config:Roles.applyScenario(prepare(job.job),job.scenario),aShields:job.scenario.a,bShields:job.scenario.b,includeSwing:false})]));}
const forward=run(plan),backward=run(reverse);
const analysis=Roles.analyze(plan,forward,2),opposing=Roles.analyze(reverse,backward,2);
const candidate=analysis.candidates.find(c=>c.slots.join(',')==='0,1,2');
const audited=Context.analyze({...analysis,candidates:[candidate]},opposing,forward,backward).candidates[0];
const reply=audited.context.reply;
assert.deepEqual(reply.slots,[2,1,0],"A conditional Melmetal answer and the consistent Talonflame answer must outrank the milder but always losing Talonflame/Mimikyu pairing");
assert.deepEqual(reply.alignment.answers[0].evenShields.map(cell=>cell.outcome),['A','B','A'],"Melmetal/Mimikyu is conditional, not an invented 1–1 win");
assert.deepEqual(reply.alignment.answers[2].evenShields.map(cell=>cell.outcome),['A','A','A'],"Talonflame/Abomasnow wins at all even shields with these exact builds");
assert.equal(reply.alignment.answers[0].outcome,'B');
assert.equal(reply.alignment.covered,2,"Improved cross-shield assignment cannot change the 1–1 win count");
assert.equal(reply.alignment.answers[0].score,backward.get(Roles.cellKey(2,0,{a:1,b:1,delay:0})).score);
assert.deepEqual(audited.slots,candidate.slots,"Only the counter presentation changes, not our recommended roles");
assert.equal(new Set(reply.slots).size,3);
// Coverage at the displayed 1–1 still wins over versatility at other shields.
const moreCoverage=new Map(backward);
moreCoverage.set(Roles.cellKey(0,0,{a:1,b:1,delay:0}),{score:510,details:{outcome:'A'}});
const covered=Context.analyze({...analysis,candidates:[candidate]},Roles.analyze(reverse,moreCoverage,2),forward,moreCoverage).candidates[0].context.reply;
assert.deepEqual(covered.slots,[0,1,2]);
assert.equal(covered.alignment.covered,3);
console.log(`Counter alignment reference passed: ${simulations} canonical role battles; conditional Melmetal/Mimikyu, Talonflame/Abomasnow and 1–1 coverage priority.`);
