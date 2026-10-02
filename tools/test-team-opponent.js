const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const Team = require("../src/team-builder/team-builder-state"), Opponent = require("../src/team-builder/team-builder-opponent"), Analysis = require("../src/team-builder/team-builder-analysis");
const member = (id,dex) => ({ pokemonId:id, name:id, dex, fastMoveId:"FAST", chargedMoveIds:["ONE","TWO"], build:{profile:"custom",ivAtk:1,ivDef:14,ivHp:15} });
const own = Team.createState({team:[member("mimikyu",778),member("clodsire",980)]}).team;
const opposing = Team.createState({team:[member("talonflame",663),member("abomasnow",460)]}).team;
const input = {team:own,opponentTeam:opposing,seasonIdentity:"season-a",engineVersion:"engine-a",shields:"1-2"};
// The explicit Recheck action must rerun its own jobs without discarding other
// roster/Meta results. A partially prepared plan still resumes from its cache.
const htmlSource=fs.readFileSync('PogoPvp.html','utf8');
const recheckSource=htmlSource.slice(htmlSource.indexOf('    function startTeamOpponentAnalysis()'),htmlSource.indexOf('    function stopTeamTrioFarmAnalysis()'));
const recheckCache=Analysis.createCache(),checkJobs=[{key:'check-a'},{key:'check-b'}];
checkJobs.forEach(job=>recheckCache.set(job.key,{score:500}));recheckCache.set('unrelated',{score:750});
let dispatched=0;
const recheckRuntime={teamBuilderOpponentPlan:checkJobs,teamBuilderAnalysisCache:recheckCache,teamBuilderAnalysisRunToken:1,cancelTeamBuilderAnalysis(){},refreshTeamOpponentPlan(){},renderTeamBuilderAnalysisProgress(){},teamOpponentUIController:{renderResults(){}},processTeamBuilderAnalysisQueue(){dispatched++;}};
vm.createContext(recheckRuntime);vm.runInContext(recheckSource+';startTeamOpponentAnalysis();',recheckRuntime);
assert.equal(recheckRuntime.teamBuilderAnalysisQueue.length,2);assert.equal(dispatched,1);
assert.equal(recheckCache.has('unrelated'),true);
recheckCache.set('check-a',{score:700});vm.runInContext('startTeamOpponentAnalysis();',recheckRuntime);
assert.equal(recheckRuntime.teamBuilderAnalysisQueue.length,1);assert.equal(recheckRuntime.teamBuilderAnalysisCacheHits,1,'Partial plans resume cached work.');
const plan = Opponent.createPlan(input); assert.equal(plan.length,4);
const changed = JSON.parse(JSON.stringify(opposing)); changed[0].build.ivAtk=7;
assert.notEqual(Opponent.createPlan({...input,opponentTeam:changed})[0].key,plan[0].key);
changed[0].fastMoveId="OTHER"; assert.notEqual(Opponent.createPlan({...input,opponentTeam:changed})[0].key,plan[0].key);
for (const change of [{shields:"0-2"},{seasonIdentity:"season-b"},{engineVersion:"engine-b"}]) assert.notEqual(Opponent.createPlan({...input,...change})[0].key,plan[0].key);
const cache = Analysis.createCache();
cache.set(plan[0].key,{slot:5,score:800,winner:"team"});
let row=Opponent.rows(plan,cache)[0]; assert.equal(row.ready,false); assert.equal(row.best,null,"Partial rows must not claim a best answer.");
cache.set(plan[2].key,{slot:4,score:500,winner:"draw"});
row=Opponent.rows(plan,cache)[0]; assert.equal(row.ready,true); assert.equal(row.wins,1); assert.equal(row.draws,1); assert.equal(row.best,0,"Cache slot numbers may belong to an older roster order.");
assert.equal(Opponent.createPlan({...input,team:Array(6).fill(null)}).length,0);
const html=fs.readFileSync("PogoPvp.html","utf8");
const start=html.indexOf("    function createTeamBuilderBattleConfig("),end=html.indexOf("    function createTeamBuilderCombatant(");
const calls=[], context={findPokemon:id=>({id}),createTeamBuilderCombatant:(value,side)=>{calls.push([value,side]);return {...value};},createMetaCombatant:()=>{throw Error("Opponent builds must not use default meta moves");}};
vm.createContext(context); vm.runInContext(html.slice(start,end),context);
context.createTeamBuilderBattleConfig(plan[0]); assert.equal(calls[1][0],opposing[0]); assert.equal(calls[1][1],"B");
console.log("Opponent team planning, cache invalidation, partial results and canonical config passed.");

const zero=Opponent.createPlan({...input,startEnergyA:0,startEnergyB:0});
assert.equal(zero[0].key,plan[0].key,"Zero energy must retain existing cache entries.");
for(const settings of [{startEnergyA:20},{startEnergyB:20},{startEnergyA:20,startEnergyB:8}]) {
  const jobs=Opponent.createPlan({...input,...settings});
  assert.notEqual(jobs[0].key,plan[0].key);
  const config=context.createTeamBuilderBattleConfig(jobs[0]);
  assert.equal(config.left.energy,settings.startEnergyA || 0);
  assert.equal(config.right.energy,settings.startEnergyB || 0);
  assert.equal(config.startEnergyA,config.left.energy); assert.equal(config.startEnergyB,config.right.energy);
}
for(const invalid of [-1,101,1.5,"oops"])assert.throws(()=>Opponent.createPlan({...input,startEnergyB:invalid}));
assert.equal(own[0].energy,undefined,"Creating an energy scenario must not mutate stored builds.");

const result=(score,winner)=>({score,winner:winner || (score>500 ? "team" : score===500 ? "draw" : "opponent")});
const rows=[
  {slot:0,member:member("enemy-one",1),ready:true,cells:[800,400,300,600,300,400].map(score=>result(score))},
  {slot:1,member:member("enemy-two",2),ready:true,cells:[300,700,500,350,620,300].map(score=>result(score))},
  {slot:2,member:member("enemy-three",3),ready:true,cells:[300,400,690,300,400,610].map(score=>result(score))}
];
const summary=Opponent.analyzeTrio(rows,[2,0,1]);
assert.equal(summary.covered,3);assert.equal(summary.backups,0);assert.equal(summary.weakest,690);
assert.deepEqual(summary.slots,[0,1,2]);
assert.equal(Opponent.analyzeTrio(rows,[0,1]).ready,false);
assert.equal(Opponent.analyzeTrio(rows,[0,0,1]).ready,false);
assert.equal(Opponent.analyzeTrio(rows,[0,1,6]).ready,false);
const partial=rows.map(row=>({...row,ready:false,cells:row.cells.map((cell,slot)=>slot===5 ? null : cell)}));
assert.equal(Opponent.analyzeTrio(partial,[0,1,2]).ready,true,"A selected trio can be evaluated once its own cells are complete.");
assert.equal(Opponent.analyzeTrio(partial,[0,1,5]).ready,false);
assert.deepEqual(Opponent.suggestTrios(partial,[0,1,2,3,4,5]),[],"Suggestions must wait for every candidate's results.");
const candidates=Opponent.suggestTrios(rows,[5,4,3,2,1,0]);
assert.equal(candidates.length,20); assert.deepEqual(candidates[0].slots,[0,1,2]);
assert.equal(Opponent.suggestTrios(rows,[0,1]).length,0);
assert.equal(Opponent.suggestTrios(rows,[0,1,2,2]).length,1);
assert.deepEqual(Opponent.suggestTrios([...rows].reverse(),[0,1,2,3,4,5]),candidates.map(candidate=>({...candidate,matchups:[...candidate.matchups].reverse(),gaps:[...candidate.gaps].reverse()})));
const drawRows=[{...rows[0],cells:[result(700,"draw"),result(500),result(400),result(600),result(600),result(400)]}];
const draws=Opponent.analyzeTrio(drawRows,[0,1,2]);
assert.equal(draws.covered,0,"Canonical draws never count as winning answers even with a high rating.");
assert.equal(draws.gaps.length,1); assert.deepEqual(draws.gaps[0].draws,[0,1]);
const ties=[{...rows[0],cells:[600,600,600,600,600,600].map(score=>result(score))}];
assert.deepEqual(Opponent.suggestTrios(ties,[0,1,2,3])[0].slots,[0,1,2]);
assert.equal(Opponent.analyzeTrio(ties,[0,1,2]).backups,1);
console.log("Trio coverage, draws, partial results, deterministic recommendations and energy cache isolation passed.");
