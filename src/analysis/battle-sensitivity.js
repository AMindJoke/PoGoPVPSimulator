(function(root,factory){
  const A=typeof module==='object' && module.exports ? require('./battle-alternatives') : root.PvPeakBattleAlternatives;
  const api=factory(A);
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.PvPeakBattleSensitivity=api;
})(typeof globalThis!=='undefined' ? globalThis : this,function sensitivityFactory(A){
  'use strict';
  const VERSION='battle-sensitivity-v1',MAX_CANDIDATES=6;
  function family(candidate){
    if(candidate.node.kind==='shield')return 'shield';
    if(candidate.target.type==='charged_move')return 'charge';
    return candidate.target.followMoveId ? `extra-fast-${candidate.target.fastCount}` : 'fast';
  }
  function selectCandidates(baseline,limit=MAX_CANDIDATES){
    // One early example of each choice type before spending the remaining
    // budget on later nodes. A fixed count keeps ranking independent of CPU speed.
    const pool=A.candidates(baseline).filter(c=>c.node.side==='B'),selected=[];
    for(const type of ['shield','charge','extra-fast-1','extra-fast-2','fast']){
      const candidate=pool.find(c=>family(c)===type);
      if(candidate && selected.length<limit)selected.push(candidate);
    }
    for(const candidate of pool)if(selected.length<limit && !selected.includes(candidate))selected.push(candidate);
    return {selected,total:pool.length};
  }
  function compactEvidence(item){
    return {turn:item.node.turn,kind:item.node.kind,moveId:item.node.moveId || null,
      chosen:item.node.chosen,target:item.target,outcome:item.outcome,
      dependency:item.dependency,replyCheck:item.replyCheck,
      shieldsLeft:{A:item.result.alternativeProbe.finalState.A.shields,B:item.result.alternativeProbe.finalState.B.shields}};
  }
  function check(baseline,simulate,options={}){
    const state={version:VERSION,status:'incomplete',checked:0,rejected:0,replyChecks:0,unverifiedReplies:0,total:0,bounded:false,evidence:null};
    if(!A.baselineMatches(baseline,options.expected))return state;
    if(!['A','draw'].includes(A.outcome(baseline))){state.status='not-applicable';return state;}
    const {selected,total}=selectCandidates(baseline,options.maxCandidates ?? MAX_CANDIDATES);
    state.total=total;
    for(const candidate of selected){
      let result;
      try{result=simulate([candidate.target]);}catch(error){
        if(String(error.message).includes('Illegal alternative choice')){state.rejected++;continue;}
        state.bounded=true;return state;
      }
      if(!A.validBranch(baseline,result,candidate.node)){state.rejected++;continue;}
      state.checked++;
      const item=A.finding(baseline,result,candidate);
      if(!item)continue;
      const reply=A.replyCandidate(item);
      if(reply){
        try{A.confirmReply(item,reply,simulate([item.target,reply.target]));state.replyChecks++;}
        catch(_){item.replyCheck='incomplete';}
      }
      // An unverified response cannot justify a ranking penalty.
      if(item.replyCheck==='incomplete'){state.unverifiedReplies++;continue;}
      state.status='sensitive';state.evidence=compactEvidence(item);
      state.bounded=state.checked+state.rejected<total;
      return state;
    }
    state.status=state.unverifiedReplies || selected.length && !state.checked ? 'incomplete' : 'checked';
    state.bounded=selected.length<total;
    return state;
  }
  function workerSource(source){
    const functions=['outcome','rank','timelineIdentity','baselineMatches','choices','candidates','validBranch','finding','replyCandidate','confirmReply'];
    // Capture at the original postMessage boundary, before instrumentation
    // saves that function. Each replay uses the unchanged canonical handler.
    const prefix=`const sensitivityOriginalPost=self.postMessage;let sensitivityCaptured=null;
      self.postMessage=function(message){if(sensitivityCaptured)sensitivityCaptured.message=message;else sensitivityOriginalPost.call(self,message);};\n`;
    const addon=`\n;(()=>{
      ${functions.map(name=>`const ${name}=${A[name].toString()};`).join('\n')}
      const sensitivity=(${sensitivityFactory.toString()})({${functions.join(',')}});
      const canonicalMessage=self.onmessage;
      self.onmessage=function(event){
        if(!event.data?.checkSensitivity){canonicalMessage(event);return;}
        const original=event.data;
        function simulate(targets){
          sensitivityCaptured={message:null};
          canonicalMessage({data:{...original,checkSensitivity:false,trace:true,debugTimeline:true,alternativeProbe:{targets}}});
          const message=sensitivityCaptured.message;
          if(message?.type!=='matrixCellResult' || !message.result)throw new Error(message?.message || 'Sensitivity replay failed');
          return message;
        }
        let baseline;
        try{
          baseline=simulate([]);
          const result=baseline.result;
          result.sensitivity=sensitivity.check(result,targets=>simulate(targets).result);
        }catch(error){
          if(baseline)baseline.result.sensitivity={version:sensitivity.VERSION,status:'incomplete',checked:0,evidence:null};
          else baseline={id:original.id,key:original.key,signature:original.signature,type:'matrixCellError',message:String(error.message)};
        }finally{sensitivityCaptured=null;}
        if(baseline?.result){
          delete baseline.result.alternativeProbe;delete baseline.result.decisionTrace;delete baseline.result.timelineTrace;
          delete baseline.result.chargedDecisions;delete baseline.result.battleInsights;
        }
        sensitivityOriginalPost.call(self,baseline);
      };
    })();`;
    return prefix+A.instrumentWorkerSource(source)+addon;
  }
  return {VERSION,MAX_CANDIDATES,selectCandidates,check,workerSource};
});
