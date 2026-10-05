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
  assert.equal(candidate.context.allCases.length,4);
  assert.equal(candidate.context.coverageFloor,Math.min(...candidate.context.allCases.map(c=>c.coverage)));
  for(const c of candidate.context.cases){
    const expected=c.slots.filter(enemy=>candidate.slots.some(slot=>Roles.outcome(results.get(Roles.cellKey(slot,enemy,{a:1,b:1,delay:0})))==='A')).length;
    assert.equal(c.coverage,expected);
  }
  const reply=candidate.context.reply;
  assert.deepEqual(reply.answers.map(answer=>answer.slot),candidate.slots,'Answers must follow each suggested trio order, not the first cached order.');
  assert.deepEqual(reply.alignment.answers.map(answer=>answer.slot),candidate.slots);
  assert.deepEqual(reply.slots,reply.alignment.answers.map(answer=>answer.opponentSlot),'The lineup and each pairing must have exactly the same order.');
  assert.equal(reply.alignment.covered,reply.alignment.answers.filter(answer=>answer.outcome==='A').length);
  assert.equal(new Set(reply.slots).size,3,'Repeated individual answers must not create duplicate members in the opponent trio.');
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
// Six-v-six: a threat omitted from the three examples must still change both
// role floors and the recommendation. No new simulations are necessary.
const largePlan=[];
for(let slot=0;slot<6;slot++)for(let opponentSlot=0;opponentSlot<6;opponentSlot++)largePlan.push({slot,opponentSlot,key:`large-${slot}-${opponentSlot}`,member:{pokemonId:`own-${slot}`},opponentMember:{pokemonId:`enemy-${opponentSlot}`}});
const forward=new Map(),backward=new Map();
for(const job of Roles.createJobs(largePlan,2)){
  const lost=job.slot===1 && job.opponentSlot===5;
  forward.set(job.key,{score:lost ? 100:700,details:{outcome:lost ? 'B':'A'},aUsed:0,bUsed:0});
}
const largeReverse=Context.reversePlan(largePlan);
for(const job of Roles.createJobs(largeReverse,2)){
  const won=job.slot===5 && job.opponentSlot===1;
  backward.set(job.key,{score:won ? 900:300,details:{outcome:won ? 'A':'B'},aUsed:0,bUsed:0});
}
const largeOwn=Roles.analyze(largePlan,forward,2),largeOpponent=Roles.analyze(largeReverse,backward,2);
largeOpponent.candidates.sort((a,b)=>Number(a.slots.includes(5))-Number(b.slots.includes(5)));
const fragile=largeOwn.candidates.find(c=>c.slots.join(',')==='0,1,2'),solid=largeOwn.candidates.find(c=>c.slots.join(',')==='0,3,4');
const audited=Context.analyze({...largeOwn,candidates:[fragile,solid]},largeOpponent,forward,backward);
assert.equal(audited.opponentContext.poolCount,20);
assert.ok(audited.opponentContext.options.every(option=>!option.slots.includes(5)));
const risk=audited.candidates[0].context;
assert.equal(risk.allCases.length,20);
assert.equal(new Set(risk.allCases.map(c=>[...c.slots].sort().join(','))).size,20);
assert.equal(Math.min(...risk.cases.map(c=>c.switch)),3);
assert.equal(risk.switchFloor,2,'A counter outside the displayed examples must lower switch resilience.');
assert.equal(risk.reply.hardCeiling,1);
assert.equal(risk.reply.answers.find(a=>a.slot===1).opponentSlot,5,'The hidden hard counter must stay in the strongest reply.');
assert.deepEqual(audited.suggestions[0].slots,solid.slots,'Exposure to an omitted strong counter must affect the actual suggestion.');
assert.equal(audited.candidates[1].context.fullyAnswered,20);
// Coverage takes precedence; then strong replies; then the selected role.
const strongReply={...better,context:{...better.context,reply:{hardCeiling:2,weakest:900}}};
const mildReply={...better,slots:[0,2,1],context:{...better.context,roleFloor:2,reply:{hardCeiling:1,weakest:700}}};
assert.deepEqual(Roles.selectSuggestions([strongReply,mildReply],true)[0].slots,mildReply.slots);
assert.deepEqual(Roles.selectSuggestions([{...strongReply,context:{...strongReply.context,coverageFloor:3}},{...mildReply,context:{...mildReply.context,coverageFloor:2}}],true)[0].slots,strongReply.slots);
const drawn=new Map(backward);
for(const job of Roles.createJobs(largeReverse,2).filter(job=>job.slot===5 && job.opponentSlot===1))drawn.set(job.key,{score:900,details:{outcome:'draw'},aUsed:0,bUsed:0});
assert.equal(Context.analyze({...largeOwn,candidates:[fragile]},largeOpponent,forward,drawn).candidates[0].context.reply.hardCeiling,0,'A high-rating draw cannot be counted as an opposing winning answer.');
assert.deepEqual(Context.analyze({...largeOwn,candidates:[fragile,solid]},largeOpponent,forward,backward).suggestions,audited.suggestions,'The all-combination audit must be deterministic.');
console.log('Opponent roster options, distinct combinations, contextual ranking, strongest replies, hard-counter trade-offs and determinism passed.');

// Florges / Vigoroth / Sableye: the matching counters are Melmetal /
// Sableye / Florges, even when another role order populated the roster cache.
const lineupPlan=plan.filter(job=>job.slot<3 && job.opponentSlot<3),lineupReverse=Context.reversePlan(lineupPlan);
const lineupForward=new Map(),lineupBackward=new Map(),counterFor=[2,0,1];
for(const job of Roles.createJobs(lineupPlan,2)){
  const loss=counterFor[job.slot]===job.opponentSlot;
  lineupForward.set(job.key,{score:loss ? 150 : 750,details:{outcome:loss ? 'B' : 'A'},aUsed:0,bUsed:0});
}
for(const job of Roles.createJobs(lineupReverse,2)){
  const win=counterFor[job.opponentSlot]===job.slot;
  lineupBackward.set(job.key,{score:win ? 850 : 250,details:{outcome:win ? 'A' : 'B'},aUsed:0,bUsed:0});
}
const lineupOwn=Roles.analyze(lineupPlan,lineupForward,2),lineupFoe=Roles.analyze(lineupReverse,lineupBackward,2);
const reordered=Context.analyze({...lineupOwn,candidates:[[1,2,0],[0,1,2]].map(slots=>lineupOwn.candidates.find(c=>c.slots.join(',')===slots.join(',')))},lineupFoe,lineupForward,lineupBackward);
assert.deepEqual(reordered.candidates[0].context.reply.slots,[0,1,2]);
assert.deepEqual(reordered.candidates[1].context.reply.slots,[2,0,1]);
assert.deepEqual(reordered.candidates[1].context.reply.answers.map(a=>[a.opponentSlot,a.slot]),[[2,0],[0,1],[1,2]]);
assert.equal(reordered.candidates[1].context.reply.covered,3);
assert.notEqual(reordered.candidates[0].context.reply,reordered.candidates[1].context.reply,'Presentation must not mutate or share the first role order.');
assert.deepEqual(reordered.candidates[1].context.reply.alignment.answers.map(a=>[a.opponentSlot,a.slot]),[[2,0],[0,1],[1,2]]);
const repeatedAnswers=new Map(lineupBackward);
for(const job of Roles.createJobs(lineupReverse,2))repeatedAnswers.set(job.key,{score:job.slot===0 ? 850 : 250,details:{outcome:job.slot===0 ? 'A' : 'B'},aUsed:0,bUsed:0});
const repeated=Context.analyze({...lineupOwn,candidates:[lineupOwn.candidates.find(c=>c.slots.join(',')==='0,1,2')]},Roles.analyze(lineupReverse,repeatedAnswers,2),lineupForward,repeatedAnswers).candidates[0].context.reply;
assert.equal(repeated.covered,3,'The existing individual-answer ranking is preserved.');
assert.equal(repeated.alignment.covered,1,'One counter cannot occupy three positions in an alignment.');
assert.equal(new Set(repeated.alignment.slots).size,3);
assert.deepEqual(repeated.alignment.answers.map(a=>a.outcome),['A','B','B'],'Losing pairings must remain explicit, not invented wins.');
console.log('Lead/switch/closer counter alignment passed, including reuse of the same opposing roster.');
