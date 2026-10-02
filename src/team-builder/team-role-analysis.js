(function (root) {
  'use strict';
  root.PvPeakTeamRoleAnalysis={create(options) {
    const cache=new Map(); let active={signature:'',phase:'idle',done:0,total:0,results:new Map(),farms:[]},worker=null,timer=null,delay=2;
    function signature() {return JSON.stringify([root.PvPeakTeamRoles.VERSION,delay,options.plan().map(job=>[job.slot,job.opponentSlot,job.key])]);}
    function stop() {clearTimeout(timer);timer=null;worker?.terminate();worker=null;}
    function state() {
      const key=signature();
      if(active.signature!==key){stop();active=cache.get(key) || {signature:key,phase:'idle',done:0,total:0,results:new Map(),farms:[]};}
      return active;
    }
    function cancel() {stop();active={...state(),phase:'idle',done:0,results:new Map(),opponentResults:new Map(),farms:[]};options.render();}
    function setDelay(value) {root.PvPeakTeamRoles.scenarios(Number(value));delay=Number(value);state();options.render();}
    function start() {
      const plan=options.plan(),previous=state();
      if(previous.phase==='running' || !plan.length || new Set(plan.map(job=>job.slot)).size<3)return;
      if(previous.phase==='complete'){options.render();return;}
      stop();
      const jobs=root.PvPeakTeamRoles.createJobs(plan,delay);
      const reversePlan=root.PvPeakTeamOpponentContext.reversePlan(plan);
      const reverseJobs=new Set(reversePlan.map(job=>job.slot)).size>=3 ? root.PvPeakTeamRoles.createJobs(reversePlan,delay).map(job=>({...job,key:`opponent:${job.key}`,resultKey:job.key,reverse:true})) : [];
      const farmJobs=plan.map(job=>({key:`farm:${job.slot}:${job.opponentSlot}`,slot:job.slot,opponentSlot:job.opponentSlot,job,farm:true}));
      const queue=[...jobs,...reverseJobs,...farmJobs];
      const run=active={signature:previous.signature,phase:'running',done:0,total:queue.length,results:new Map(),opponentResults:new Map(),farms:[]};
      let current;
      function finish(error='') {
        if(active!==run)return;stop();run.phase=error ? 'error' : 'complete';run.error=error;
        if(!error){
          run.analysis=root.PvPeakTeamRoles.analyze(plan,run.results,delay,run.farms);
          if(!run.analysis.ready){finish('Role analysis is incomplete. Please retry.');return;}
          if(reverseJobs.length){
            const opponent=root.PvPeakTeamRoles.analyze(reversePlan,run.opponentResults,delay);
            if(!opponent.ready){finish('Opponent analysis is incomplete. Please retry.');return;}
            run.analysis=root.PvPeakTeamOpponentContext.analyze(run.analysis,opponent,run.results,run.opponentResults);
          }
          cache.set(run.signature,run);while(cache.size>6)cache.delete(cache.keys().next().value);
        }
        options.render();
      }
      function next() {
        if(active!==run || signature()!==run.signature){state();return;}
        current=queue.shift(); if(!current){finish();return;}
        if(current.farm && root.PvPeakTeamRoles.outcome(run.results.get(root.PvPeakTeamRoles.cellKey(current.slot,current.opponentSlot,{a:1,b:1,delay:0})))!=='B'){run.done++;next();return;}
        let config;
        const scenario=current.scenario || {a:1,b:1,delay:0};
        try {config=root.PvPeakTeamRoles.applyScenario(options.config(current.job),scenario);} catch(_){finish('A role build is unavailable. Please retry.');return;}
        const message={id:run.done+1,key:current.key,signature:current.key,source:'team-builder-roles',config,aShields:scenario.a,bShields:scenario.b,includeSwing:false,roleAnalysis:true};
        if(current.farm)message.farmCompanions=plan.filter(job=>job.opponentSlot===current.opponentSlot && job.slot!==current.slot).map(job=>({slot:job.slot,combatant:options.combatant(job.member,'A')}));
        timer=setTimeout(()=>finish('Role analysis took too long. Please retry.'),20000);
        try {worker.postMessage(message);} catch(error){console.error('Role worker dispatch failed:',error);finish('Role analysis could not start. Please retry.');}
      }
      try {worker=options.worker();} catch(error){console.error('Role worker creation failed:',error);finish('Role analysis could not start. Please retry.');return;}
      worker.onmessage=event=>{
        if(active!==run || signature()!==run.signature){state();return;}
        if(event.data.key!==current?.key)return;
        clearTimeout(timer);timer=null;
        if(event.data.type!=='matrixCellResult' || !event.data.result){finish('A role matchup could not be calculated. Please retry.');return;}
        const result=event.data.result;
        if(current.farm)run.farms.push(...(result.routes || []).filter(route=>route.status==='safe').map(route=>({ownSlot:current.slot,opponentSlot:current.opponentSlot,slot:route.slot,status:route.status,energyAfter:route.energyAfter,hpAfter:route.hpAfter,hpPercent:route.hpPercent,shieldsUsed:route.shieldsUsed})));
        else if(!Number.isFinite(result.score) || !result.details?.outcome){finish('A role matchup is incomplete. Please retry.');return;}
        else (current.reverse ? run.opponentResults : run.results).set(current.resultKey || current.key,result);
        run.done++;if(run.done%6===0 || run.done===run.total)options.render();next();
      };
      worker.onerror=()=>finish('Role analysis could not finish. Please retry.');
      options.render();next();
    }
    return {state,start,cancel,setDelay,delay:()=>delay};
  }};
})(typeof globalThis!=='undefined' ? globalThis : this);
