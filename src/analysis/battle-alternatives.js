"use strict";
(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakBattleAlternatives = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  const VERSION = "battle-alternatives-v1";

  // The probe runs in a dedicated worker. Both actors still prepare their
  // canonical choices before executing; only an explicit legal choice changes.
  function instrumentWorkerSource(source) {
    const anchor = "const shielded = shieldDecision.shield;";
    if (source.split(anchor).length !== 2) throw new Error("Alternative shield hook is unavailable");
    return source.replace(anchor, `
      if (globalThis.__battleAlternativeProbe && chargedContinuationDepth === 0 && defender.shields > 0) {
        const probe = globalThis.__battleAlternativeProbe;
        const node = { index: probe.nodes.length, kind: "shield", side: defender.trainer,
          turn: Number(battleTurns[attacker.trainer] || 0), moveId: move.id,
          chosen: { type: shieldDecision.shield ? "shield" : "no_shield" },
          legal: [{type:"shield"},{type:"no_shield"}], state: traceStateSnapshot(defender, attacker) };
        probe.nodes.push(node);
        const target = probe.targets.find(item => item.index === node.index);
        if (target) {
          if (!["shield", "no_shield"].includes(target.type)) throw new Error("Illegal alternative choice");
          shieldDecision = {...shieldDecision, shield:target.type === "shield"};
          probe.applied.push({index:node.index, side:node.side, turn:node.turn, type:target.type, executed:true});
        }
      }
      ${anchor}`) + `
      const alternativeOriginalPrepare = prepareAutomaticBattleAction;
      prepareAutomaticBattleAction = function(attacker, defender) {
        const plan = alternativeOriginalPrepare(attacker, defender);
        const probe = globalThis.__battleAlternativeProbe;
        // Shield forecasts must replay the actual changed opening, including
        // the opposing prepared action; otherwise their parity check rejects it.
        if (probe && chargedContinuationDepth > 0 && left.shieldExpectedOpeningActions && plan?.action) {
          const expected = left.shieldExpectedOpeningActions[attacker.trainer];
          const normalize = action => [action?.type === "fast" ? "fast_move" : action?.type === "charged" ? "charged_move" : action?.type, action?.moveId || action?.move?.id || null];
          if (expected && JSON.stringify(normalize(expected)) !== JSON.stringify(normalize(plan.action))) {
            const action = legalBattleActions(attacker,Number(battleTurns[attacker.trainer] || 0)).find(action => JSON.stringify(normalize(action)) === JSON.stringify(normalize(expected)));
            if (action) return {attacker,defender,action,options:{source:"alternative-preview",deferCooldownReset:true}};
          }
        }
        if (!probe || chargedContinuationDepth !== 0 || !plan?.action) return plan;
        const legal = legalBattleActions(attacker, Number(battleTurns[attacker.trainer] || 0));
        const normalize = action => ({type:action.type === "fast" ? "fast_move" : action.type === "charged" ? "charged_move" : action.type,
          moveId:action.moveId || action.move?.id || null});
        let target = null, node = null;
        if (legal.some(action => normalize(action).type === "charged_move")) {
          node = { index:probe.nodes.length, kind:"action", side:attacker.trainer,
            turn:Number(battleTurns[attacker.trainer] || 0), chosen:normalize(plan.action), legal:legal.map(normalize),
            state:traceStateSnapshot(attacker, defender) };
          probe.nodes.push(node);
          target = probe.targets.find(item => item.index === node.index) || null;
          if (target?.followMoveId) probe.follow = {side:node.side, moveId:target.followMoveId, remaining:(target.fastCount || 1)-1};
          else if (!target && probe.follow?.side === attacker.trainer) {
            target = probe.follow.remaining > 0 ? {type:"fast_move"} : {type:"charged_move",moveId:probe.follow.moveId};
            if (probe.follow.remaining > 0) probe.follow.remaining--;
            else probe.follow = null;
          }
        }
        if (!target) return plan;
        const action = legal.find(item => normalize(item).type === target.type && (!target.moveId || normalize(item).moveId === target.moveId));
        if (!action) throw new Error("Illegal alternative choice");
        const applied = {index:node.index,side:node.side,turn:node.turn,...normalize(action),executed:false};
        probe.applied.push(applied);
        return {attacker,defender,action,options:{source:"alternative-preview",deferCooldownReset:true},beforeExecute(){applied.executed=true;}};
      };
      const alternativeOriginalPost = self.postMessage;
      self.postMessage = function(message) {
        const probe = globalThis.__battleAlternativeProbe;
        if (message.result && probe) {
          message.result.alternativeProbe = {...probe, completed:battleEnded(),
            finalState:{A:traceCombatantState(left),B:traceCombatantState(right)},
            timeline:JSON.parse(JSON.stringify(timeline))};
        }
        return alternativeOriginalPost.call(self,message);
      };
      const alternativeOriginalMessage = self.onmessage;
      self.onmessage = function(event) {
        const requested = event.data?.alternativeProbe;
        globalThis.__battleAlternativeProbe = requested ? {targets:requested.targets || [],nodes:[],applied:[],follow:null} : null;
        try {return alternativeOriginalMessage.call(self,event);}
        finally {globalThis.__battleAlternativeProbe=null;}
      };
    `;
  }

  function outcome(result) {
    const state = result?.alternativeProbe?.finalState;
    if (!result?.alternativeProbe?.completed || !state) return null;
    if (state.A.hp <= 0 && state.B.hp <= 0) return "draw";
    if (state.B.hp <= 0) return "A";
    if (state.A.hp <= 0) return "B";
    return null;
  }
  function rank(winner, side) { return winner === side ? 2 : winner === "draw" ? 1 : 0; }
  function timelineIdentity(events = []) {
    return Array.from(events).filter(event => !event.hiddenFromTimeline).map(event => [event.trainer, event.kind,
      event.moveId || event.move?.id || null, Number(event.start || 0), Number(event.duration || 0),
      Number(event.resolutionTurn ?? event.start ?? 0), Number(event.damage || 0), !!event.shielded,
      Number(event.energyBefore || 0), Number(event.energyAfter || 0), Number(event.hpBefore || 0), Number(event.hpAfter || 0)]);
  }
  function baselineMatches(result, expected) {
    if (!outcome(result)) return false;
    if (Number(result.decisionTrace?.intelligenceAudit?.legacyFallbackDecisions || 0) > 0) return false;
    if (!expected) return true;
    return outcome(result) === expected.outcome
      && ["A","B"].every(side => ["hp","energy","shields","attackStage","defenseStage"].every(field =>
        Number(result.alternativeProbe.finalState[side][field] || 0) === Number(expected[side][field] || 0)))
      && JSON.stringify(timelineIdentity(result.alternativeProbe.timeline)) === JSON.stringify(expected.timeline);
  }
  function choices(node) {
    if (node.kind === "shield") return [{type:node.chosen.type === "shield" ? "no_shield" : "shield"}];
    const actions = node.legal.filter(action => action.type !== node.chosen.type || action.moveId !== node.chosen.moveId);
    // Keep one/two Fast + throw distinct from a single Fast followed by replanning.
    if (node.chosen.type === "charged_move") {
      for (const fastCount of [1,2]) actions.push({type:"fast_move",fastCount,followMoveId:node.chosen.moveId});
    }
    return actions;
  }
  function candidates(result) {
    const winner = outcome(result);
    return (result.alternativeProbe?.nodes || []).filter(node => rank(winner,node.side) < 2)
      .flatMap(node => choices(node).map(action => ({node,target:{index:node.index,...action}})));
  }
  function validBranch(baseline, result, node) {
    const probe = result?.alternativeProbe;
    return !!outcome(result) && !probe.follow
      && Number(result.decisionTrace?.intelligenceAudit?.legacyFallbackDecisions || 0) === 0
      && probe.applied.some(item => item.index === node.index && item.side === node.side && item.executed)
      && JSON.stringify(probe.nodes.slice(0,node.index+1)) === JSON.stringify(baseline.alternativeProbe.nodes.slice(0,node.index+1));
  }
  function finding(baseline, result, candidate) {
    const {node,target} = candidate;
    if (!validBranch(baseline,result,node) || rank(outcome(result),node.side) <= rank(outcome(baseline),node.side)) return null;
    return {node,target,outcome:outcome(result),baselineOutcome:outcome(baseline),result,dependency:null,replyCheck:"not-tested"};
  }
  function replyCandidate(item) {
    if (item.node.kind !== "action") return null;
    const moveId = item.target.followMoveId || (item.target.type === "charged_move" ? item.target.moveId : null);
    if (!moveId) return null;
    const node = item.result.alternativeProbe.nodes.find(node => node.index > item.node.index && node.kind === "shield"
      && node.side !== item.node.side && node.moveId === moveId && node.chosen.type === "shield");
    return node ? {node,target:{index:node.index,type:"no_shield"}} : null;
  }
  function confirmReply(item, reply, result) {
    if (!validBranch(item.result,result,reply.node)) {item.replyCheck="incomplete";return;}
    item.replyCheck="checked";
    if (rank(outcome(result),item.node.side) < rank(item.outcome,item.node.side)) {
      item.dependency={side:reply.node.side,moveId:reply.node.moveId,type:"shield",otherwise:outcome(result)};
    }
  }

  function createRunner(makeWorker, options = {}) {
    const maxBranches = options.maxBranches || 96, maxFindings = 3, cache = new Map();
    let worker = null, timer = null, token = 0, sequence = 0;
    function cancel() {token++;clearTimeout(timer);timer=null;worker?.terminate();worker=null;}
    function start(input, onUpdate) {
      cancel();
      const generation=token, key=JSON.stringify([VERSION,input]);
      if(cache.has(key)){const cached=cache.get(key);cache.delete(key);cache.set(key,cached);onUpdate(cached);return;}
      let baseline=null, queue=[], pending=null;
      const state={phase:"checking",checked:0,rejected:0,total:0,findings:[],baseline:null,error:"",bounded:false};
      const started=Date.now();
      const emit=()=>onUpdate({...state,findings:[...state.findings]});
      const finish=(error="")=>{
        if(generation!==token)return;
        cancel();state.phase=error ? "error" : "ready";state.error=error;
        if(!error){cache.set(key,{...state,findings:[...state.findings]});while(cache.size>6)cache.delete(cache.keys().next().value);}
        emit();
      };
      const dispatch=(task)=>{
        if(generation!==token)return;
        if(Date.now()-started>(options.totalTimeoutMs || 25000)) {state.bounded=true;finish(input.testedReply ? 'The tested reply timed out. Please retry.' : '');return;}
        pending=task;const id=++sequence;
        timer=setTimeout(()=>finish("Alternative search timed out. Retry."),options.jobTimeoutMs || 15000);
        try {worker.postMessage({id,key:`alternatives:${id}`,signature:"battle-alternatives",source:"battle-alternatives",
          config:input.config,aShields:input.aShields,bShields:input.bShields,
          includeSwing:false,trace:true,debugTimeline:true,alternativeProbe:{targets:task.kind === "branch" ? [task.candidate.target] : task.targets || []}});}
        catch(_){finish("Alternative search could not start. Retry.");}
      };
      const next=()=>{
        if(!queue.length || state.checked>=maxBranches || state.findings.length>=maxFindings){state.bounded=queue.length>0;finish();return;}
        dispatch({kind:"branch",candidate:queue.shift()});
      };
      emit();
      try {worker=makeWorker();}catch(_){finish("Alternative search is unavailable. Retry.");return;}
      worker.onmessage=event=>{
        if(generation!==token || event.data?.id!==sequence)return;
        clearTimeout(timer);timer=null;
        const message=event.data;
        if(message.type!=="matrixCellResult" || !message.result){
          if(pending?.kind!=="baseline" && String(message.message).includes("Illegal alternative choice")){
            if(input.testedReply){finish('This tested reply is no longer legal. It was not shown.');return;}
            state.rejected++;state.checked++;emit();next();return;
          }
          finish("Alternative search could not finish. Retry.");return;
        }
        const result=message.result;
        if(pending.kind==="baseline"){
          if(!baselineMatches(result,input.expected)){finish("The replay does not match this battle. Alternatives were not shown.");return;}
          baseline=result;state.baseline=result;queue=candidates(result);
          if(input.testedReply){
            const requested=input.testedReply;
            queue=queue.filter(c=>c.node.side==='B' && c.node.kind===requested.kind && c.node.turn===requested.turn
              && ['index','type','moveId','followMoveId','fastCount'].every(field=>c.target[field]===requested.target[field]));
            if(outcome(result)!==requested.baselineOutcome || queue.length!==1){finish('This tested reply no longer matches the battle. It was not shown.');return;}
          }
          state.total=queue.length;emit();next();return;
        }
        if(pending.kind==="reply"){
          confirmReply(pending.item,pending.reply,result);
          if(input.testedReply && pending.item.replyCheck==='incomplete'){finish('The shield response could not be verified. Please retry.');return;}
          state.findings.push(pending.item);emit();next();return;
        }
        state.checked++;
        const item=finding(baseline,result,pending.candidate);
        if(input.testedReply && (!item || item.outcome!==input.testedReply.outcome)){finish('This reply no longer reproduces the reported result. It was not shown.');return;}
        if(item && !state.findings.some(known=>known.node.side===item.node.side && known.node.turn===item.node.turn && known.node.kind===item.node.kind && known.outcome===item.outcome)){
          const reply=replyCandidate(item);
          if(reply){dispatch({kind:"reply",item,reply,targets:[item.target,reply.target]});return;}
          state.findings.push(item);
        }
        emit();next();
      };
      worker.onerror=()=>{if(generation===token)finish("Alternative search could not finish. Retry.");};
      dispatch({kind:"baseline"});
    }
    return {start,cancel};
  }
  return {VERSION,instrumentWorkerSource,outcome,rank,timelineIdentity,baselineMatches,choices,candidates,validBranch,finding,replyCandidate,confirmReply,createRunner};
});
