(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.PvPeakCmpDependency=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='cmp-dependency-v1',MAX_CHECKS=4;
  function workerSource(source){
    source=source.replace(/\r\n/g,'\n');
    const anchor=`const preparedActors = actors.map(([attacker, defender]) => ({
          attacker,
          defender,
          plan: prepareAutomaticBattleAction(attacker, defender)
        }));`;
    if(source.split(anchor).length!==2)throw new Error('CMP diagnostic hook unavailable');
    source=source.replace(anchor,anchor+`
        if(globalThis.__cmpProbe && chargedContinuationDepth===0
          && !globalThis.__battleAlternativeProbe?.targets?.length
          && preparedActors.length===2
          && preparedActors.every(item=>['charged','charged_move'].includes(item.plan?.action?.type))){
          globalThis.__cmpProbe.nodes.push({turn:currentTurn,first:actors[0][0].trainer,
            attackA:left.attack,attackB:right.attack,
            moves:preparedActors.map(item=>[item.attacker.trainer,item.plan.action.moveId || item.plan.action.move?.id]).sort(),
            prefix:JSON.stringify(timeline.filter(event=>event.start<currentTurn).map(event=>[event.trainer,event.kind,event.move?.id || event.moveId,event.start,event.duration,event.damage,event.energyBefore,event.energyAfter,event.hpBefore,event.hpAfter]))});
        }`);
    const prefix=`const cmpOriginalPost=self.postMessage;let cmpCaptured=null;self.postMessage=function(message){if(cmpCaptured)cmpCaptured.message=message;else cmpOriginalPost.call(self,message);};\n`;
    return prefix+source+`\n;(()=>{
      const originalState=turnEngineState;
      turnEngineState=function(turn){
        const state=originalState(turn),target=globalThis.__cmpProbe?.target;
        // Change the copied priority state only. Combatant Attack, damage,
        // HP, IVs, energy and the original result remain untouched.
        if(state && target && state.currentTurn===target.turn){
          const other=target.first==='A'?'B':'A';
          state.sides[target.first].attack=state.sides[other].attack+0.001;
        }
        return state;
      };
      const originalMessage=self.onmessage;
      self.onmessage=function(event){
        if(!event.data?.checkCmpDependency || event.data.alternativeProbe?.targets?.length){originalMessage(event);return;}
        const input=event.data;
        function run(target=null,baseline=false){
          cmpCaptured={message:null};globalThis.__cmpProbe={target,nodes:[]};
          originalMessage({data:{...input,checkCmpDependency:false,...(baseline?{}:{checkSensitivity:false,alternativeProbe:undefined,trace:false,debugTimeline:false})}});
          const message=cmpCaptured.message,nodes=globalThis.__cmpProbe.nodes;
          if(message?.type!=='matrixCellResult' || !message.result)throw new Error(message?.message || 'CMP replay unavailable');
          return {message,nodes};
        }
        let baseline;
        const check={version:'${VERSION}',status:'incomplete',checked:0,total:0,bounded:false,evidence:null};
        try{
          baseline=run(null,true);
          const nodes=baseline.nodes.filter((node,index,list)=>list.findIndex(other=>other.turn===node.turn)===index);
          check.total=nodes.length;check.bounded=nodes.length>${MAX_CHECKS};
          for(const node of nodes.slice(-${MAX_CHECKS}).reverse()){
            const target={turn:node.turn,first:node.first==='A'?'B':'A'},branch=run(target);
            const applied=branch.nodes.find(other=>other.turn===node.turn && other.first===target.first
              && other.prefix===node.prefix && JSON.stringify(other.moves)===JSON.stringify(node.moves));
            if(!applied)continue;
            check.checked++;
            if(branch.message.result.details.outcome!==baseline.message.result.details.outcome){
              check.status='dependent';check.evidence={turn:node.turn,first:node.first,
                attackA:node.attackA,attackB:node.attackB,moves:node.moves,
                baselineOutcome:baseline.message.result.details.outcome,alternateOutcome:branch.message.result.details.outcome};
              break;
            }
          }
          if(check.status!=='dependent')check.status=nodes.length && !check.checked?'unverified':'checked';
        }catch(error){
          // A failed diagnostic cannot erase a valid canonical result.
          if(!baseline){cmpCaptured=null;globalThis.__cmpProbe=null;originalMessage(event);return;}
        }finally{cmpCaptured=null;globalThis.__cmpProbe=null;}
        baseline.message.result.cmpDependency=check;
        cmpOriginalPost.call(self,baseline.message);
      };
    })();`;
  }
  return {VERSION,MAX_CHECKS,workerSource};
});
