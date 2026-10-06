// Exercise the actual workspace coordinator without the renderer or battle engine.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('src/ui/team-workspace.js', 'utf8');
const start = source.indexOf('    function advance(){');
const end = source.indexOf('    actions.onclick=', start);
assert(start >= 0 && end > start);
function harness(overrides = {}) {
  const h = {key:'current',active:false,ready:true,failed:0,phase:'complete',starts:0,cancels:0,renders:0,scrolls:0,...overrides};
  const tasks = [];
  const flow = new Function('h','queueMicrotask', `
    let pending={key:'current',phase:'comparison'}, advancing=false,accepted='',editing=true,view='farm',flowError='';
    const inputKey=()=>h.key,comparisonReady=()=>h.ready,sync=()=>h.renders++;
    const options={comparisonActive:()=>h.active,comparisonFailed:()=>h.failed,
      startRoles:()=>{h.starts++;h.phase=h.afterStart||h.phase;},
      cancelRoles:()=>h.cancels++,rolesState:()=>({phase:h.phase})};
    const nav={scrollIntoView:()=>h.scrolls++};
    ${source.slice(start,end)}
    return {advance,state:()=>({pending,accepted,editing,view,flowError})};
  `)(h, fn=>tasks.push(fn));
  return {h,flow,tick(){flow.advance();assert.equal(tasks.length,1);tasks.shift()();}};
}
{
  const t=harness({active:true});t.tick();assert.equal(t.h.starts,0);assert.equal(t.flow.state().accepted,'');
  t.h.active=false;t.h.afterStart='running';t.tick();assert.equal(t.h.starts,1);assert.equal(t.flow.state().pending.phase,'roles');
  t.tick();assert.equal(t.h.starts,1);assert.equal(t.flow.state().accepted,'');
  t.h.phase='complete';t.tick();assert.equal(t.flow.state().accepted,'current');assert.equal(t.flow.state().editing,false);assert.equal(t.flow.state().view,'trios');assert.equal(t.h.scrolls,1);
}
{
  const t=harness();t.tick();assert.equal(t.h.starts,1);assert.equal(t.flow.state().accepted,'current');assert.equal(t.flow.state().pending,null);
}
{
  const t=harness({key:'changed'});t.tick();assert.equal(t.h.cancels,1);assert.equal(t.h.starts,0);assert.equal(t.flow.state().accepted,'');assert.equal(t.flow.state().editing,true);
}
for(const input of [{ready:false},{failed:1}]){
  const t=harness(input);t.tick();assert.equal(t.h.starts,0);assert.equal(t.flow.state().pending,null);assert.match(t.flow.state().flowError,/retry/);assert.equal(t.flow.state().accepted,'');
}
{
  const t=harness({phase:'error'});t.tick();assert.equal(t.flow.state().pending,null);assert.equal(t.flow.state().editing,true);assert.equal(t.flow.state().accepted,'');
}
console.log('Unified setup: sequential comparison/roles, warm reuse, stale cancellation and incomplete/error results passed.');
