"use strict";
(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakBattleAlternativesUI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  function resultLabel(winner) {return winner === "A" ? "Win" : winner === "B" ? "Loss" : "Draw";}
  function pokemonLabel(side,input) {
    const left=input?.config?.left?.p?.name,right=input?.config?.right?.p?.name;
    const name=side === "A" ? left : right;
    return name ? `${name}${left === right ? ` (${side})` : ""}` : side;
  }
  function outcomeLabel(winner,input) {return winner === "draw" ? "Draw" : `${pokemonLabel(winner,input)} wins`;}
  function opportunityLabel(item,input) {return `${pokemonLabel(item.node.side,input)} can ${item.outcome === "draw" ? "draw" : "win"}`;}
  function previewEvents(events) {
    return events.map((event,sourceIndex)=>({...event,sourceIndex}))
      .filter(event => !event.hiddenFromTimeline && !["denied","pending"].includes(event.fastImpactStatus))
      .map(event=>({...event,moveId:event.move?.id,moveName:event.move?.name}));
  }
  // A skipped shield has no shield event. Mark the incoming attack instead.
  function decisionEventIndex(events,item,alternative=false) {
    if(!item)return -1;
    const node=item.node,action=alternative ? item.target : node.chosen;
    const isShield=node.kind === "shield",usesShield=isShield && action.type === "shield";
    const kind=isShield ? usesShield ? "shield" : "charge" : action.type === "charged_move" ? "charge" : action.type === "fast_move" ? "fast" : null;
    if(!kind)return -1;
    const side=isShield && !usesShield ? node.side === "A" ? "B" : "A" : node.side;
    const moveId=isShield ? node.moveId : action.moveId;
    return events.findIndex(event=>!event.hiddenFromTimeline && !["denied","pending"].includes(event.fastImpactStatus)
      && event.trainer === side && event.kind === kind && Number(event.start) === Number(node.turn)
      && (!moveId || (event.move?.id || event.moveId) === moveId));
  }
  function badgeLabel(state,input,selected=0) {
    if (state.findings?.length) return input ? opportunityLabel(state.findings[selected] || state.findings[0],input) : "Alternative available";
    if (state.phase === "checking") return "Checking alternatives…";
    if (state.phase === "error") return "Alternatives · Retry";
    return "No flips found";
  }
  function create(options) {
    const {mount,detail,preview,grid} = options;
    let state=null,input=null,open=false,selected=0,view="standard",requestedShown=false;
    function sprite(side,alt="") {
      const combatant=side === "A" ? input.config.left : input.config.right;
      return `<img data-alternative-side="${side}" src="${escape(options.imageUrl(combatant.p))}" alt="${escape(alt)}"${!alt ? ' aria-hidden="true"' : ""}>`;
    }
    function bindImages(container) {
      if(!options.setPokemonImage)return;
      container.querySelectorAll("img[data-alternative-side]").forEach(img=>{
        const alt=img.alt;
        options.setPokemonImage(img,(img.dataset.alternativeSide === "A" ? input.config.left : input.config.right).p);
        img.alt=alt;
      });
    }
    function clearHighlights() {
      grid.querySelectorAll(".battle-alternative-decisive").forEach(element=>element.classList.remove("battle-alternative-decisive"));
      grid.querySelectorAll(".battle-alternative-standard-marker").forEach(element=>element.remove());
    }
    function reset() {clearHighlights();state=null;input=null;open=false;selected=0;view="standard";requestedShown=false;mount.hidden=true;detail.hidden=true;preview.hidden=true;grid.hidden=false;}
    function refreshHighlights(reveal=false) {
      clearHighlights();
      const item=state?.findings[selected];
      if(!open || view!=="standard" || !item)return;
      const index=decisionEventIndex(options.standardEvents(),item);
      const block=grid.querySelector(`.timeline-block[data-event-index="${index}"]`),scroll=grid.querySelector(".timeline-scroll");
      if(!block || !scroll)return;
      block.classList.add("battle-alternative-decisive");
      const marker=document.createElement("span"),bounds=block.getBoundingClientRect(),origin=scroll.getBoundingClientRect();
      const x=bounds.left-origin.left+scroll.scrollLeft-scroll.clientLeft+bounds.width/2;
      marker.className="battle-alternative-standard-marker";marker.dataset.label=`Change · T${item.node.turn}`;marker.setAttribute("aria-hidden","true");marker.style.left=`${x}px`;scroll.append(marker);
      if(reveal)scroll.scrollLeft=Math.max(0,x-scroll.clientWidth/2);
    }
    function timelineHtml(result,item) {
      const raw=previewEvents(result.alternativeProbe.timeline);
      const model=options.timelineModel(raw), percent=value=>value/model.visualTurns*100;
      const changedIndex=decisionEventIndex(result.alternativeProbe.timeline,item,true);
      const changed=model.rows.find(event=>event.sourceIndex===changedIndex);
      const combatants={A:input.config.left,B:input.config.right};
      const rows=["A","B"].map(side=>{
        const combatant=combatants[side];
        const events=model.rows.filter(event=>event.trainer===side).map(event=>{
          const move=event.move, shield=event.kind === "shield" || event.kind === "form-protect";
          const type=shield ? "shield" : event.kind;
          const color=options.typeColor(move?.type);
          const decisive=event.sourceIndex===changedIndex;
          const label=`${decisive ? "Changed choice · " : ""}${shield ? event.kind === "form-protect" ? "Form protection" : "Shield" : move?.name || event.kind} · Turn ${event.start}${!shield ? ` · ${Math.round(event.damage || 0)} damage` : ""}`;
          const content=shield ? options.shieldSvg() : event.kind === "charge" ? options.typeIcon(move?.type) : "";
          const trail=event.kind === "charge" ? `<span class="battle-alternative-charge-trail" style="left:${percent(event.visualStart)}%;width:${percent(event.visualTurn-event.visualStart)}%;--alternative-type:${escape(color)}"></span>` : "";
          return `${trail}<span class="battle-alternative-event ${type}${decisive ? " battle-alternative-decisive" : ""}" role="img" aria-label="${escape(label)}" title="${escape(label)}" style="left:${percent(event.visualTurn)}%;--alternative-type:${escape(color)}">${content}</span>`;
        }).join("");
        return {label:`<div class="battle-alternative-lane-label">${sprite(side,pokemonLabel(side,input))}</div>`,
          track:`<div class="battle-alternative-track" aria-label="${escape(combatant.p.name)} actions">${events}</div>`};
      });
      return `<div class="battle-alternative-preview-heading"><strong>Alternative · ${escape(outcomeLabel(options.api.outcome(result),input))}</strong><span>Read-only</span></div>
        <div class="battle-alternative-graph"><div class="battle-alternative-lane-labels"><span>Turn</span>${rows.map(row=>row.label).join("")}</div><div class="battle-alternative-scroll" tabindex="0" aria-label="Alternative timeline; scroll for longer battles"><div class="battle-alternative-content" style="min-width:${model.minWidth}px"><div class="battle-alternative-ruler">${model.ticks.map(tick=>`<span style="left:${percent(tick.visualTurn)}%">${tick.turn}</span>`).join("")}</div><div class="battle-alternative-tracks">${changed ? `<span class="battle-alternative-preview-marker" data-label="Change · T${item.node.turn}" aria-hidden="true" style="left:${percent(changed.visualTurn)}%"></span>` : ""}${rows.map(row=>row.track).join("")}</div></div></div></div>`;
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
        const s=result.alternativeProbe.finalState[side];
        return `<span class="battle-alternative-resource">${sprite(side,pokemonLabel(side,input))}${s.hp>0 ? `<strong>${Math.round(s.hp)} HP</strong><span>${Math.round(s.energy)} energy</span>` : '<strong class="battle-alternative-ko">KO</strong>'}</span>`;
      }).join("");
    }
    function render(reveal=false) {
      if(!state || !input){reset();return;}
      const focus=detail.contains(document.activeElement) || mount.contains(document.activeElement) ? document.activeElement.dataset.alternativeAction : null;
      const methodOpen=!!detail.querySelector(".battle-alternative-method")?.open;
      const previewScroll=preview.hidden ? null : preview.querySelector(".battle-alternative-scroll")?.scrollLeft;
      selected=Math.min(selected,Math.max(0,state.findings.length-1));
      const item=state.findings[selected];
      mount.hidden=false;
      const beneficiary=item ? item.node.side === "A" ? input.config.left : input.config.right : null;
      const statusTitle=item ? "A tested alternative; other replies can change the result." : state.phase === "ready" ? `No outcome changes in ${state.checked} checked lines${state.bounded ? "; limited search" : ""}.` : "Check outcome-changing alternatives";
      mount.innerHTML=`<button type="button" class="battle-alternatives-toggle" data-alternative-action="toggle" title="${escape(statusTitle)}" aria-expanded="${open}" aria-controls="battleAlternativesDetail" ${state.phase === "checking" && !item ? "disabled" : ""}>${beneficiary ? sprite(item.node.side) : '<span aria-hidden="true">⑂</span>'}<span>${escape(badgeLabel(state,input,selected))}</span><span aria-hidden="true">${open ? "⌃" : "⌄"}</span></button>`;
      mount.dataset.phase=item ? "found" : state.phase;
      detail.hidden=!open;
      if(item){
        const incoming=item.node.kind === "shield" ? moveFor(item.node.moveId,item.node.side === "A" ? "B" : "A") : null;
        const dependency=item.dependency ? `${item.dependency.side === "A" ? input.config.left.p.name : input.config.right.p.name} needs to shield ${moveFor(item.dependency.moveId,item.node.side)?.name || "the bait"}.` : "One changed line, with simulated replies. Other replies can change the result.";
        detail.innerHTML=`<div class="battle-alternative-detail-head"><div>${sprite(item.node.side)}<strong>${escape(pokemonLabel(item.node.side,input))} changes the ${item.node.kind === "shield" ? "shield choice" : "line"}</strong><span class="battle-alternative-turn-key">Change · T${item.node.turn}</span></div>${state.findings.length>1 ? `<label><span class="sr-only">Alternative</span><select data-alternative-action="select" aria-label="Choose alternative">${state.findings.map((known,n)=>`<option value="${n}" ${n===selected ? "selected" : ""}>${n+1} · T${known.node.turn} · ${escape(opportunityLabel(known,input))}</option>`).join("")}</select></label>` : ""}</div>
          <div class="battle-alternative-choices"><div class="battle-alternative-choice"><small>Standard · ${escape(outcomeLabel(item.baselineOutcome,input))}</small><div class="battle-alternative-decision">${actionHtml(item.node.chosen,item.node)}</div>${incoming ? `<small>vs ${escape(incoming.name)}</small>` : ""}</div><span class="battle-alternative-arrow" aria-hidden="true">→</span><div class="battle-alternative-choice changed"><small>Alternative · ${escape(outcomeLabel(item.outcome,input))}</small><div class="battle-alternative-decision">${actionHtml(item.target,item.node)}</div>${incoming ? `<small>vs ${escape(incoming.name)}</small>` : ""}</div></div>
          <div class="battle-alternative-resources" aria-label="Alternative final resources">${resources(item.result)}</div>
          <div class="battle-alternative-dependency">${item.dependency ? `<span class="battle-alternative-shield">${options.shieldSvg()}</span><strong>Shield-dependent</strong>` : ""}<span>${escape(dependency)}</span></div>
          <div class="battle-alternative-view-controls" role="group" aria-label="Timeline line"><button type="button" data-alternative-action="standard" aria-pressed="${view === "standard"}">Standard line</button><button type="button" data-alternative-action="alternative" aria-pressed="${view === "alternative"}">View alternative</button></div>
          <details class="battle-alternative-method"><summary>Conditions & checks</summary><p>Same builds, starting HP, energy and shields. The replay matches Battle; actions before the change and simultaneous opposing choices are preserved. The planner resumes after the changed line.</p><p>${state.checked} alternatives checked${state.bounded ? " · bounded search" : ""}. This is a tested continuation, not a guarantee against every reply.${item.replyCheck === "incomplete" ? " The shield response check was incomplete." : ""}</p></details>`;
      }else{
        detail.innerHTML=state.phase === "error" ? `<p role="alert">${escape(state.error)}</p><button type="button" data-alternative-action="retry">Retry</button>` : `<p>No outcome-changing line found in ${state.checked} checked alternatives${state.bounded ? " (bounded search)" : ""}. Other replies or longer sequences may change the result.</p>`;
      }
      const alternative=open && view === "alternative" && !!item;
      grid.hidden=alternative;preview.hidden=!alternative;
      if(alternative) {
        preview.innerHTML=timelineHtml(item.result,item);
        const changed=preview.querySelector(".battle-alternative-decisive"),scroll=preview.querySelector(".battle-alternative-scroll");
        if(scroll && !reveal && previewScroll!==null)scroll.scrollLeft=previewScroll;
        else if(changed && scroll)scroll.scrollLeft=Math.max(0,changed.offsetLeft-scroll.clientWidth/2);
      }
      refreshHighlights(reveal);
      [mount,detail,preview].forEach(bindImages);
      if(methodOpen && detail.querySelector(".battle-alternative-method"))detail.querySelector(".battle-alternative-method").open=true;
      if(focus)(focus === "toggle" ? mount : detail).querySelector(`[data-alternative-action="${focus}"]`)?.focus({preventScroll:true});
    }
    function act(event) {
      const element=event.target.closest("[data-alternative-action]");
      if(!element)return;
      const action=element.dataset.alternativeAction;
      if(action === "toggle"){options.pauseReplay?.();open=!open;if(!open)view="standard";}
      if(action === "select"){selected=Number(element.value);view="standard";}
      if(action === "standard" || action === "alternative"){options.pauseReplay?.();view=action;}
      if(action === "retry"){options.retry();return;}
      render(true);
    }
    mount.addEventListener("click",act);detail.addEventListener("click",event=>{if(event.target.tagName!=="SELECT")act(event);});detail.addEventListener("change",act);
    return {reset,render,refreshHighlights,update(next,config){state=next;input=config;
      if(input.testedReply && !requestedShown && state.findings.length){requestedShown=true;open=true;view="alternative";options.pauseReplay?.();}
      render();}};
  }
  return {create,badgeLabel,resultLabel,previewEvents,pokemonLabel,outcomeLabel,decisionEventIndex};
});
