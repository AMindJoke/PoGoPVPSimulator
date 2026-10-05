(function(root,factory){
  const api=factory(typeof module!=='undefined' && module.exports ? require('./team-builder-roles') : root.PvPeakTeamRoles);
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  if(root)root.PvPeakTeamOpponentContext=api;
})(typeof globalThis!=='undefined' ? globalThis : this,function(Roles){
  'use strict';
  function reversePlan(plan){return plan.map(job=>({...job,key:`opponent-roles:${job.key}`,slot:job.opponentSlot,opponentSlot:job.slot,member:job.opponentMember,opponentMember:job.member,opponentId:job.member.pokemonId}));}
  const trioKey=slots=>[...slots].sort((a,b)=>a-b).join(',');
  function analyze(own,opponent,results,opponentResults){
    if(!own.ready || !opponent.ready || !opponent.candidates.length)return own;
    // Three distinct roster options, ordered by the same full-roster criteria.
    // These are hypotheses, never estimated selection probabilities.
    const pool=[],seen=new Set();
    for(const candidate of opponent.candidates){const key=trioKey(candidate.slots);if(!seen.has(key)){seen.add(key);pool.push(candidate);}}
    const options=pool.slice(0,3),base={a:1,b:1,delay:0},close={a:1,b:0,delay:0},switchScene={a:1,b:1,delay:own.delay};
    const cell=(map,slot,enemy,scene=base)=>map.get(Roles.cellKey(slot,enemy,scene));
    const wins=(map,slot,enemies,scene)=>enemies.filter(enemy=>Roles.outcome(cell(map,slot,enemy,scene))==='A').length;
    const replies=new Map();
    const candidates=own.candidates.map(candidate=>{
      const key=trioKey(candidate.slots),switchProfile=own.profiles.find(p=>p.slot===candidate.switch);
      const allCases=pool.map((option,index)=>{
        const coverage=option.slots.filter(enemy=>candidate.slots.some(slot=>Roles.outcome(cell(results,slot,enemy))==='A')).length;
        const lead=wins(results,candidate.lead,option.slots,base),safe=option.slots.filter(enemy=>switchProfile.switchStable.includes(enemy)).length,closer=wins(results,candidate.closer,option.slots,close);
        const testedLead=option.slots.filter(enemy=>Roles.outcome(cell(results,candidate.lead,enemy))==='A' && !Roles.sensitive(cell(results,candidate.lead,enemy))).length;
        const testedSwitch=option.slots.filter(enemy=>switchProfile.switchStable.includes(enemy) && !Roles.losesHold(cell(results,candidate.switch,enemy,switchScene))).length;
        const testedCloser=option.slots.filter(enemy=>Roles.outcome(cell(results,candidate.closer,enemy,close))==='A' && !Roles.sensitive(cell(results,candidate.closer,enemy,close))).length;
        return {index,slots:option.slots,coverage,lead,switch:safe,closer,roleFloor:Math.min(lead,safe,closer),testedRoleFloor:Math.min(testedLead,testedSwitch,testedCloser),testedSwitch,testedCloser};
      });
      if(!replies.has(key)){
        const evaluated=pool.map(option=>{
          const answers=candidate.slots.map(slot=>{
            const winning=option.slots.filter(enemy=>Roles.outcome(cell(opponentResults,enemy,slot))==='A');
            const best=[...winning].sort((a,b)=>cell(opponentResults,b,slot).score-cell(opponentResults,a,slot).score || a-b)[0];
            return {slot,opponentSlot:best,score:best==null ? null : cell(opponentResults,best,slot).score};
          });
          const covered=answers.filter(answer=>answer.opponentSlot!=null).length;
          const hardCovered=answers.filter(answer=>answer.score>=751).length;
          const weakest=Math.min(...candidate.slots.map(slot=>Math.max(...option.slots.map(enemy=>cell(opponentResults,enemy,slot).score))));
          return {slots:option.slots,covered,hardCovered,weakest,answers,rosterCovered:option.covered};
        });
        evaluated.sort((a,b)=>b.covered-a.covered || b.hardCovered-a.hardCovered || b.weakest-a.weakest || b.rosterCovered-a.rosterCovered || trioKey(a.slots).localeCompare(trioKey(b.slots)));
        // Keep the maximum strong-counter exposure even when it occurs in a
        // different trio from the one answering the most of our members.
        evaluated[0].hardCeiling=Math.max(...evaluated.map(reply=>reply.hardCovered));
        replies.set(key,evaluated[0]);
      }
      const counters=candidate.slots.flatMap(slot=>own.opponents.filter(enemy=>Roles.outcome(cell(results,slot,enemy))==='B' && cell(results,slot,enemy).score<=250).map(enemy=>({
        slot,opponentSlot:enemy,
        rosterAnswers:own.profiles.filter(p=>Roles.outcome(cell(results,p.slot,enemy))==='A').map(p=>p.slot),
        strongRosterAnswers:own.profiles.filter(p=>Roles.outcome(cell(results,p.slot,enemy))==='A' && cell(results,p.slot,enemy).score>=751).map(p=>p.slot),
        inOptions:options.filter(option=>option.slots.includes(enemy)).length
      })));
      return {...candidate,context:{cases:allCases.slice(0,options.length),allCases,poolCount:pool.length,fullyAnswered:allCases.filter(c=>c.coverage===c.slots.length).length,coverageFloor:Math.min(...allCases.map(c=>c.coverage)),roleFloor:Math.min(...allCases.map(c=>c.roleFloor)),switchFloor:Math.min(...allCases.map(c=>c.switch)),closerFloor:Math.min(...allCases.map(c=>c.closer)),testedRoleFloor:Math.min(...allCases.map(c=>c.testedRoleFloor)),testedSwitchFloor:Math.min(...allCases.map(c=>c.testedSwitch)),testedCloserFloor:Math.min(...allCases.map(c=>c.testedCloser)),reply:replies.get(key),counters}};
    });
    return {...own,candidates,suggestions:Roles.selectSuggestions(candidates,true),opponentContext:{options,poolCount:pool.length,profiles:opponent.profiles}};
  }
  return Object.freeze({reversePlan,analyze});
});
