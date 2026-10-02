(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PvPeakTeamRoles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'roles-v2';
  function scenarios(delay = 2) {
    if (!Number.isInteger(delay) || delay < 0 || delay > 4) throw new Error('ROLE_DELAY_INVALID');
    return [
      {id:'even0',a:0,b:0,delay:0}, {id:'even1',a:1,b:1,delay:0}, {id:'even2',a:2,b:2,delay:0},
      {id:'closer',a:1,b:0,delay:0},
      ...[0,1,2].map(n=>({id:`switch${n}`,a:n,b:n,delay}))
    ];
  }
  const cellKey = (slot, opponentSlot, scenario) => `${slot}:${opponentSlot}:${scenario.a}-${scenario.b}:${scenario.delay}`;
  function createJobs(plan, delay = 2) {
    const unique = new Map();
    plan.forEach(job=>scenarios(delay).forEach(scenario=>{
      const key=cellKey(job.slot,job.opponentSlot,scenario);
      if(!unique.has(key))unique.set(key,{key,slot:job.slot,opponentSlot:job.opponentSlot,job,scenario});
    }));
    return [...unique.values()];
  }
  function outcome(cell) {
    return cell?.details?.outcome || (cell?.winner==='team' ? 'A' : cell?.winner==='draw' ? 'draw' : cell?.winner==='meta' || cell?.winner==='opponent' ? 'B' : 'unresolved');
  }
  function summary(cells) {
    const wins=cells.filter(c=>outcome(c)==='A'), draws=cells.filter(c=>outcome(c)==='draw'), losses=cells.filter(c=>outcome(c)==='B');
    return {total:cells.length,wins:wins.length,draws:draws.length,losses:losses.length,unresolved:cells.length-wins.length-draws.length-losses.length,
      evenSpend:wins.filter(c=>c.aUsed<=c.bUsed).length,
      evenUnbeaten:[...wins,...draws].filter(c=>c.aUsed<=c.bUsed).length,
      hardLosses:losses.filter(c=>c.score<=250).length,
      weakest:cells.length ? Math.min(...cells.map(c=>c.score)) : 0,
      average:cells.length ? Math.round(cells.reduce((sum,c)=>sum+c.score,0)/cells.length) : 0};
  }
  function analyze(plan, results, delay = 2, farms = []) {
    const jobs=createJobs(plan,delay);
    if (!jobs.length || jobs.some(job=>!results.has(job.key))) return {ready:false,profiles:[],candidates:[],suggestions:[]};
    const slots=[...new Set(plan.map(job=>job.slot))].sort((a,b)=>a-b);
    const opponents=[...new Set(plan.map(job=>job.opponentSlot))].sort((a,b)=>a-b);
    const scene=scenarios(delay), data=new Map();
    const profiles=slots.map(slot=>{
      const values=Object.fromEntries(scene.map(scenario=>{
        const cells=opponents.map(opponentSlot=>({...results.get(cellKey(slot,opponentSlot,scenario)),opponentSlot}));
        data.set(`${slot}:${scenario.id}`,cells);
        return [scenario.id,summary(cells)];
      }));
      const flips=opponents.filter(opponentSlot=>outcome(results.get(cellKey(slot,opponentSlot,scene[1])))!=='A' && outcome(results.get(cellKey(slot,opponentSlot,scene[5])))==='A');
      const switchStable=opponents.filter(opponentSlot=>['switch0','switch1','switch2'].every(id=>{
        const cell=data.get(`${slot}:${id}`).find(c=>c.opponentSlot===opponentSlot);
        return ['A','draw'].includes(outcome(cell)) && cell.aUsed<=cell.bUsed;
      }));
      return {slot,...values,flips,switchStable,switchRisks:opponents.filter(slot=>!switchStable.includes(slot))};
    });
    const profile=slot=>profiles.find(p=>p.slot===slot), get=(slot,id)=>data.get(`${slot}:${id}`);
    const candidates=[];
    for(const lead of slots)for(const safeSwitch of slots)for(const closer of slots) {
      if(new Set([lead,safeSwitch,closer]).size!==3)continue;
      const selected=[lead,safeSwitch,closer], gaps=[], sole=[], shared=[], recovery=[], leadLosses=[];
      let weakest=1000,covered=0,backups=0;
      for(const opponentSlot of opponents) {
        const base=selected.map(slot=>({slot,cell:get(slot,'even1').find(c=>c.opponentSlot===opponentSlot)}));
        const wins=base.filter(x=>outcome(x.cell)==='A');
        weakest=Math.min(weakest,Math.max(...base.map(x=>x.cell.score)));
        if(wins.length)covered++; else gaps.push(opponentSlot);
        if(wins.length>=2)backups++;
        if(wins.length===1)sole.push({opponentSlot,slot:wins[0].slot});
        if(base.filter(x=>outcome(x.cell)==='B').length>=2)shared.push(opponentSlot);
        if(outcome(base[0].cell)==='B') {
          leadLosses.push(opponentSlot);
          if(outcome(get(safeSwitch,'switch1').find(c=>c.opponentSlot===opponentSlot))==='A')recovery.push(opponentSlot);
        }
      }
      const dependency=Math.max(0,...selected.map(slot=>sole.filter(x=>x.slot===slot).length));
      const farmOptions=farms.filter(f=>f.ownSlot===lead && selected.includes(f.slot) && f.status==='safe' && f.shieldsUsed===0 && f.hpAfter>0)
        .sort((a,b)=>b.energyAfter-a.energyAfter || b.hpPercent-a.hpPercent || a.opponentSlot-b.opponentSlot);
      const l=profile(lead),s=profile(safeSwitch),c=profile(closer);
      candidates.push({lead,switch:safeSwitch,closer,slots:selected,total:opponents.length,covered,weakest,backups,gaps,sole,shared,dependency,recovery,leadLosses,uncoveredLead:leadLosses.filter(slot=>!recovery.includes(slot)),unrecovered:leadLosses.length-recovery.length,farm: farmOptions[0] || null,
        leadWins:Math.min(l.even1.wins,l.even2.wins),switchLosses:Math.max(s.switch0.losses+s.switch0.unresolved,s.switch1.losses+s.switch1.unresolved,s.switch2.losses+s.switch2.unresolved),
        switchWins:Math.min(s.switch0.wins,s.switch1.wins,s.switch2.wins),switchEven:s.switchStable.length,
        closerWins:c.closer.wins,closerFresh:c.even0.wins,balanced:Math.min(l.even1.wins,s.switch1.wins,c.closer.wins)});
    }
    const tie=(a,b)=>a.slots.join('').localeCompare(b.slots.join(''));
    const common=(a,b)=>b.covered-a.covered || b.weakest-a.weakest;
    const balanced=(a,b)=>common(a,b) || b.balanced-a.balanced || b.switchEven-a.switchEven || a.switchLosses-b.switchLosses || a.unrecovered-b.unrecovered || a.dependency-b.dependency || a.shared.length-b.shared.length || b.backups-a.backups || b.leadWins-a.leadWins || tie(a,b);
    const switchOrder=(a,b)=>b.covered-a.covered || b.switchEven-a.switchEven || a.switchLosses-b.switchLosses || b.switchWins-a.switchWins || b.balanced-a.balanced || a.unrecovered-b.unrecovered || b.leadWins-a.leadWins || b.weakest-a.weakest || a.dependency-b.dependency || a.shared.length-b.shared.length || tie(a,b);
    const closerOrder=(a,b)=>b.covered-a.covered || b.closerWins-a.closerWins || b.closerFresh-a.closerFresh || b.switchEven-a.switchEven || a.switchLosses-b.switchLosses || b.balanced-a.balanced || a.unrecovered-b.unrecovered || b.leadWins-a.leadWins || b.weakest-a.weakest || tie(a,b);
    candidates.sort(balanced);
    const suggestions=[],seen=new Set();
    for(const [style,compare] of [['Balanced',balanced],['Switch resilience',switchOrder],['Shield closer',closerOrder]]) {
      const choice=[...candidates].sort(compare).find(c=>!seen.has(c.slots.join(',')));
      if(choice){seen.add(choice.slots.join(','));suggestions.push({...choice,style});}
    }
    const leaders={
      lead:[...profiles].sort((a,b)=>Math.min(b.even1.wins,b.even2.wins)-Math.min(a.even1.wins,a.even2.wins) || b.even1.weakest-a.even1.weakest || a.slot-b.slot),
      switch:[...profiles].sort((a,b)=>b.switchStable.length-a.switchStable.length || Math.max(a.switch0.losses+a.switch0.unresolved,a.switch1.losses+a.switch1.unresolved,a.switch2.losses+a.switch2.unresolved)-Math.max(b.switch0.losses+b.switch0.unresolved,b.switch1.losses+b.switch1.unresolved,b.switch2.losses+b.switch2.unresolved) || b.switch1.wins-a.switch1.wins || a.slot-b.slot),
      closer:[...profiles].sort((a,b)=>b.closer.wins-a.closer.wins || b.even0.wins-a.even0.wins || b.closer.weakest-a.closer.weakest || a.slot-b.slot)
    };
    return {ready:true,profiles,candidates,suggestions,leaders,opponents,delay};
  }
  return Object.freeze({VERSION,scenarios,cellKey,createJobs,outcome,summary,analyze});
});
