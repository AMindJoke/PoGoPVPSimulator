'use strict';
const assert=require('node:assert/strict');
const Roles=require('../src/team-builder/team-builder-roles'),Context=require('../src/team-builder/team-opponent-context');
const plan=[];
for(let slot=0;slot<4;slot++)for(let opponentSlot=0;opponentSlot<4;opponentSlot++)plan.push({slot,opponentSlot,key:`${slot}:${opponentSlot}`,member:{pokemonId:`own-${slot}`},opponentMember:{pokemonId:`enemy-${opponentSlot}`}});
const reverse=Context.reversePlan(plan);
assert.equal(reverse[1].member,plan[1].opponentMember);assert.equal(reverse[1].opponentMember,plan[1].member);
assert.equal(reverse[1].slot,1);assert.equal(reverse[1].opponentSlot,0);assert.equal(reverse[1].opponentId,'own-0');
const results=new Map(),opponentResults=new Map();
for(const job of Roles.createJobs(plan,2)){
  const win=job.slot===0 ? job.opponentSlot!==3 : job.opponentSlot===3 || job.opponentSlot!==job.slot-1;
  results.set(job.key,{score:win ? job.opponentSlot===3 ? 850 : 700 : job.slot===0 ? 150 : 400,details:{outcome:win ? 'A':'B'},aUsed:0,bUsed:0});
}
for(const job of Roles.createJobs(reverse,2)){
  const own=results.get(Roles.cellKey(job.opponentSlot,job.slot,job.scenario));
  opponentResults.set(job.key,{score:1000-own.score,details:{outcome:own.details.outcome==='A' ? 'B':'A'},aUsed:0,bUsed:0});
}
const own=Roles.analyze(plan,results,2),opponent=Roles.analyze(reverse,opponentResults,2);
assert.equal(Context.analyze(own,{ready:false},results,opponentResults),own,'Incomplete opposing data cannot silently change recommendations.');
const before=JSON.stringify(own),context=Context.analyze(own,opponent,results,opponentResults);
assert.equal(JSON.stringify(own),before,'Context ranking must preserve the original full-roster analysis.');
assert.equal(context.opponentContext.poolCount,4);assert.equal(context.opponentContext.options.length,3);
assert.equal(new Set(context.opponentContext.options.map(o=>[...o.slots].sort().join(','))).size,3,'Do not count different orders of one opposing trio as different roster options.');
assert.equal(context.candidates.length,24);assert.equal(new Set(context.suggestions.map(c=>c.slots.join(','))).size,3);
for(const candidate of context.candidates){
  assert.equal(candidate.context.cases.length,3);
  assert.equal(candidate.context.coverageFloor,Math.min(...candidate.context.cases.map(c=>c.coverage)));
  for(const c of candidate.context.cases){
    const expected=c.slots.filter(enemy=>candidate.slots.some(slot=>Roles.outcome(results.get(Roles.cellKey(slot,enemy,{a:1,b:1,delay:0})))==='A')).length;
    assert.equal(c.coverage,expected);
  }
  const reply=candidate.context.reply;
  assert.equal(reply.covered,reply.answers.filter(a=>a.opponentSlot!=null).length);
  for(const a of reply.answers.filter(a=>a.opponentSlot!=null))assert.equal(Roles.outcome(opponentResults.get(Roles.cellKey(a.opponentSlot,a.slot,{a:1,b:1,delay:0}))),'A');
  if(candidate.slots.includes(0)){
    const hard=candidate.context.counters.find(c=>c.slot===0 && c.opponentSlot===3);
    assert.ok(hard,'A hard counter cannot be removed just because the rest of our roster beats it.');
    assert.deepEqual(hard.strongRosterAnswers,[1,2,3]);
    assert.equal(hard.inOptions,context.opponentContext.options.filter(c=>c.slots.includes(3)).length);
  }
}
assert.deepEqual(Context.analyze(own,Roles.analyze([...reverse].reverse(),opponentResults,2),results,opponentResults).suggestions,context.suggestions,'Input order must not change opponent-context suggestions.');
// Context must affect the actual recommendation, rather than just decorate it.
const better={...context.candidates[0],slots:[0,1,2],context:{coverageFloor:3,roleFloor:3,switchFloor:3,closerFloor:3}};
const worse={...context.candidates[0],slots:[0,2,1],covered:100,weakest:1000,context:{coverageFloor:1,roleFloor:1,switchFloor:1,closerFloor:1}};
assert.deepEqual(Roles.selectSuggestions([worse,better],true)[0].slots,better.slots);
console.log('Opponent roster options, distinct combinations, contextual ranking, strongest replies, hard-counter trade-offs and determinism passed.');
