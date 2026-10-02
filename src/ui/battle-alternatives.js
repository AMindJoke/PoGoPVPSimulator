"use strict";
(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakBattleAlternativesUI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  function resultLabel(winner) {return winner === "A" ? "Win" : winner === "B" ? "Loss" : "Draw";}
  function previewEvents(events) {
    return events.filter(event => !event.hiddenFromTimeline && !["denied","pending"].includes(event.fastImpactStatus))
      .map(event=>({...event,moveId:event.move?.id,moveName:event.move?.name}));
  }
  function badgeLabel(state) {
    if (state.findings?.length) return `Alternative → ${resultLabel(state.findings[0].outcome)}`;
    if (state.phase === "checking") return "Checking alternatives…";
    if (state.phase === "error") return "Alternatives · Retry";
    return "Alternatives checked";
  }
  function create(options) {
    const {mount,detail,preview,grid} = options;
    let state=null,input=null,open=false,selected=0,view="standard";
    function reset() {state=null;input=null;open=false;selected=0;view="standard";mount.hidden=true;detail.hidden=true;preview.hidden=true;grid.hidden=false;}
    function timelineHtml(result) {
      const raw=previewEvents(result.alternativeProbe.timeline);
      const model=options.timelineModel(raw), percent=value=>value/model.visualTurns*100;
      const combatants={A:input.config.left,B:input.config.right};
      const rows=["A","B"].map(side=>{
        const combatant=combatants[side];
        const events=model.rows.filter(event=>event.trainer===side).map(event=>{
          const move=event.move, shield=event.kind === "shield" || event.kind === "form-protect";
          const type=shield ? "shield" : event.kind;
          const color=options.typeColor(move?.type);
          const label=`${shield ? event.kind === "form-protect" ? "Form protection" : "Shield" : move?.name || event.kind} · Turn ${event.start}${!shield ? ` · ${Math.round(event.damage || 0)} damage` : ""}`;
          const content=shield ? options.shieldSvg() : event.kind === "charge" ? options.typeIcon(move?.type) : "";
          const trail=event.kind === "charge" ? `<span class="battle-alternative-charge-trail" style="left:${percent(event.visualStart)}%;width:${percent(event.visualTurn-event.visualStart)}%;--alternative-type:${escape(color)}"></span>` : "";
          return `${trail}<span class="battle-alternative-event ${type}" role="img" aria-label="${escape(label)}" title="${escape(label)}" style="left:${percent(event.visualTurn)}%;--alternative-type:${escape(color)}">${content}</span>`;
        }).join("");
        return {label:`<div class="battle-alternative-lane-label"><img src="${escape(options.imageUrl(combatant.p))}" alt="${escape(combatant.p.name)}"></div>`,
          track:`<div class="battle-alternative-track" aria-label="${escape(combatant.p.name)} actions">${events}</div>`};
      });
      return `<div class="battle-alternative-preview-heading"><strong>Alternative preview · ${escape(input.config.left.p.name)}: ${resultLabel(options.api.outcome(result))}</strong><span>Read-only</span></div>
        <div class="battle-alternative-graph"><div class="battle-alternative-lane-labels"><span>Turn</span>${rows.map(row=>row.label).join("")}</div><div class="battle-alternative-scroll" tabindex="0" aria-label="Alternative timeline; scroll for longer battles"><div class="battle-alternative-content" style="min-width:${model.minWidth}px"><div class="battle-alternative-ruler">${model.ticks.map(tick=>`<span style="left:${percent(tick.visualTurn)}%">${tick.turn}</span>`).join("")}</div>${rows.map(row=>row.track).join("")}</div></div></div>`;
    }
    function moveFor(id, side) {const c=side === "A" ? input.config.left : input.config.right;return [c.fast,...c.charged].find(move=>move?.id===id) || options.move(id);}
    function actionHtml(action, node) {
      if(node.kind === "shield") return `<span class="battle-alternative-shield">${options.shieldSvg()}</span>${action.type === "shield" ? "Shield" : "Take the hit"}`;
      if(action.type === "fast_move" && action.followMoveId) return `<span>+${action.fastCount} Fast →</span>${options.movePill(moveFor(action.followMoveId,node.side),"charged")}`;
      const move=moveFor(action.moveId,node.side);
      return move ? options.movePill(move,action.type === "fast_move" ? "fast" : "charged") : escape(action.type === "wait" ? "Wait" : "Fast + replan");
    }
    function resources(result) {
      return ["A","B"].map(side=>{
        const c=side === "A" ? input.config.left : input.config.right,s=result.alternativeProbe.finalState[side];
        return `<span class="battle-alternative-resource"><img src="${escape(options.imageUrl(c.p))}" alt="${escape(c.p.name)}">${s.hp>0 ? `<strong>${Math.round(s.hp)} HP</strong><span>${Math.round(s.energy)} energy</span>` : '<strong class="battle-alternative-ko">KO</strong>'}</span>`;
      }).join("");
    }
    function render() {
      if(!state || !input){reset();return;}
      const focus=detail.contains(document.activeElement) ? document.activeElement.dataset.alternativeAction : null;
      selected=Math.min(selected,Math.max(0,state.findings.length-1));
      const item=state.findings[selected];
      mount.hidden=false;
      mount.innerHTML=`<button type="button" class="battle-alternatives-toggle" data-alternative-action="toggle" aria-expanded="${open}" aria-controls="battleAlternativesDetail" ${state.phase === "checking" && !item ? "disabled" : ""}><span aria-hidden="true">⑂</span>${escape(badgeLabel(state))}<span aria-hidden="true">${open ? "⌃" : "⌄"}</span></button>`;
      mount.dataset.phase=item ? "found" : state.phase;
      detail.hidden=!open;
      if(item){
        const actor=item.node.side === "A" ? input.config.left : input.config.right;
        const incoming=item.node.kind === "shield" ? moveFor(item.node.moveId,item.node.side === "A" ? "B" : "A") : null;
        const dependency=item.dependency ? `${item.dependency.side === "A" ? input.config.left.p.name : input.config.right.p.name} needs to shield ${moveFor(item.dependency.moveId,item.node.side)?.name || "the bait"}.` : "One changed line, with simulated replies. Other replies can change the result.";
        detail.innerHTML=`<div class="battle-alternative-detail-head"><div><img src="${escape(options.imageUrl(actor.p))}" alt=""><strong>${escape(actor.p.name)} changes the ${item.node.kind === "shield" ? "shield choice" : "line"}</strong><span>Turn ${item.node.turn}</span></div>${state.findings.length>1 ? `<label><span class="sr-only">Alternative</span><select data-alternative-action="select" aria-label="Choose alternative">${state.findings.map((known,n)=>`<option value="${n}" ${n===selected ? "selected" : ""}>${n+1} · T${known.node.turn} · ${resultLabel(known.outcome)}</option>`).join("")}</select></label>` : ""}</div>
          <div class="battle-alternative-choices"><div class="battle-alternative-choice"><small>Standard · ${escape(input.config.left.p.name)}: ${resultLabel(item.baselineOutcome)}</small><div class="battle-alternative-decision">${actionHtml(item.node.chosen,item.node)}</div>${incoming ? `<small>vs ${escape(incoming.name)}</small>` : ""}</div><span class="battle-alternative-arrow" aria-hidden="true">→</span><div class="battle-alternative-choice changed"><small>Alternative · ${escape(input.config.left.p.name)}: ${resultLabel(item.outcome)}</small><div class="battle-alternative-decision">${actionHtml(item.target,item.node)}</div>${incoming ? `<small>vs ${escape(incoming.name)}</small>` : ""}</div></div>
          <div class="battle-alternative-resources" aria-label="Alternative final resources">${resources(item.result)}</div>
          <div class="battle-alternative-dependency">${item.dependency ? `<span class="battle-alternative-shield">${options.shieldSvg()}</span><strong>Shield-dependent</strong>` : ""}<span>${escape(dependency)}</span></div>
          <div class="battle-alternative-view-controls" role="group" aria-label="Timeline line"><button type="button" data-alternative-action="standard" aria-pressed="${view === "standard"}">Standard line</button><button type="button" data-alternative-action="alternative" aria-pressed="${view === "alternative"}">View alternative</button></div>
          <details class="battle-alternative-method"><summary>Conditions & checks</summary><p>Same builds, starting HP, energy and shields. The replay matches Battle; actions before the change and simultaneous opposing choices are preserved. The planner resumes after the changed line.</p><p>${state.checked} alternatives checked${state.bounded ? " · bounded search" : ""}. This is a tested continuation, not a guarantee against every reply.${item.replyCheck === "incomplete" ? " The shield response check was incomplete." : ""}</p></details>`;
      }else{
        detail.innerHTML=state.phase === "error" ? `<p role="alert">${escape(state.error)}</p><button type="button" data-alternative-action="retry">Retry</button>` : `<p>No outcome-changing line found in ${state.checked} checked alternatives${state.bounded ? " (bounded search)" : ""}. Other replies or longer sequences may change the result.</p>`;
      }
      const alternative=open && view === "alternative" && !!item;
      grid.hidden=alternative;preview.hidden=!alternative;
      if(alternative) preview.innerHTML=timelineHtml(item.result);
      if(focus)detail.querySelector(`[data-alternative-action="${focus}"]`)?.focus({preventScroll:true});
    }
    function act(event) {
      const element=event.target.closest("[data-alternative-action]");
      if(!element)return;
      const action=element.dataset.alternativeAction;
      if(action === "toggle"){open=!open;if(!open)view="standard";}
      if(action === "select"){selected=Number(element.value);view="standard";}
      if(action === "standard" || action === "alternative"){options.pauseReplay?.();view=action;}
      if(action === "retry"){options.retry();return;}
      render();
    }
    mount.addEventListener("click",act);detail.addEventListener("click",event=>{if(event.target.tagName!=="SELECT")act(event);});detail.addEventListener("change",act);
    return {reset,render,update(next,config){state=next;input=config;render();}};
  }
  return {create,badgeLabel,resultLabel,previewEvents};
});
