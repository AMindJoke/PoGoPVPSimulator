(function (root) {
  "use strict";
  root.PvPeakTeamOpponentUI = { create(options) {
    const $ = id => document.getElementById(id), escape = options.escapeHtml;
    const section = $("teamOpponentPanel");
    let mobileSlot = 0, trioPickerMarkup = "", trioSuggestionsMarkup = "";
    let farmSignature = "", farmMarkup = "", showAllFarm = false;
    const farmTargets = new Map();
    function selectedSlots() { return options.own().team.map((member,index) => member && options.trioIds().includes(member.pokemonId) ? index : null).filter(index=>index!=null); }
    function sprite(member, attr) { return member ? `<img ${attr} alt="${escape(member.name)}">` : ""; }
    function cell(member, ownSlot, opponentSlot, result, includeName = false) {
      if (!member) return '<span class="opponent-empty-cell" aria-label="Empty team slot">—</span>';
      const label = result ? options.resultLabel(result) : "Not calculated";
      const name = `${member.name} versus ${options.opponent().team[opponentSlot].name}: ${label}${result ? `. Rating ${result.score}. Open Battle` : ""}`;
      return `<button type="button" class="opponent-matchup${includeName ? " is-mobile" : ""}${selectedSlots().includes(ownSlot) ? " is-in-trio" : ""}" data-opponent-battle="${ownSlot}" data-opponent-slot="${opponentSlot}" aria-label="${escape(name)}" title="${escape(name)}"${result ? "" : " disabled"}>${includeName ? `${sprite(member, `data-own-result-sprite="${ownSlot}"`)}<strong>${escape(member.name)}</strong>` : ""}${result ? options.resultMarkup(result) : '<span class="opponent-empty-cell">—</span>'}${includeName ? `<small>${escape(label)}</small>` : ""}</button>`;
    }
    function rowLabel(row) {
      if (!row.ready) return "Pending";
      return `${row.wins} ${row.wins === 1 ? "win" : "wins"}${row.draws ? ` · ${row.draws} ${row.draws === 1 ? "draw" : "draws"}` : ""}`;
    }
    function render() {
      const own = options.own(), opponent = options.opponent(), plan = options.plan(), cache = options.cache;
      const roster = $("teamOpponentRoster");
      roster.innerHTML = opponent.team.map(options.renderSlot).join("");
      opponent.team.forEach((member, index) => { if (member) options.setSprite(roster.querySelector(`[data-team-sprite="${index}"]`), member); });
      $("teamOpponentCount").textContent = `${opponent.team.filter(Boolean).length} of 6 selected`;
      $("teamOpponentSave").disabled = !opponent.team.some(Boolean);
      $("teamOpponentClear").disabled = !opponent.team.some(Boolean);
      $("teamOpponentShare").disabled = !own.team.some(Boolean) || !opponent.team.some(Boolean);
      options.rosterPresentation();
      renderResults();
    }
    function renderResults() {
      const own = options.own(), opponent = options.opponent(), plan = options.plan(), cache = options.cache;
      const rows = root.PvPeakTeamOpponent.rows(plan, cache);
      const prepared = plan.filter(job => cache.has(job.key)).length;
      const active = options.isActive();
      $("teamOpponentAnalyze").disabled = !plan.length || active;
      $("teamOpponentAnalyze").textContent = prepared === plan.length && plan.length ? "Recheck matchups" : "Analyze matchups";
      $("teamOpponentCancel").hidden = !active;
      $("teamOpponentStatus").textContent = !plan.length ? "Add Pokémon to both teams to compare matchups." : active ? `Preparing ${prepared} / ${plan.length} matchups…` : `${prepared} / ${plan.length} matchups ready${options.failed() ? ` · ${options.failed()} failed. Retry the remaining matchups.` : ""}`;
      ["A", "B"].forEach(side => { $("teamOpponentShields" + side).value = opponent.shields?.[side] ?? "1"; });
      ["A", "B"].forEach(side => { const input=$("teamOpponentEnergy"+side); if(document.activeElement!==input)input.value=opponent.energy?.[side] ?? 0; });
      const a=opponent.energy?.A || 0, b=opponent.energy?.B || 0;
      $("teamOpponentEnergySummary").textContent = a || b ? `Starting energy · ${a} / ${b}` : "Starting energy · 0 / 0";
      $("teamOpponentConditions").textContent = `Individual matchups · full HP · energy ${a} / ${b}. Select a result to open Battle.`;
      renderTrio(rows);
      $("teamOpponentResults").hidden = !rows.length;
      const table = $("teamOpponentTable");
      table.innerHTML = `<thead><tr><th scope="col">Opponent / Your team</th>${own.team.map((member, index) => `<th scope="col"${selectedSlots().includes(index) ? ' class="opponent-trio-column"' : ""}>${sprite(member, `data-own-sprite="${index}"`)}<span>${escape(member?.name || `Slot ${index + 1}`)}${selectedSlots().includes(index) ? ' <b aria-label="In your trio">✓</b>' : ""}</span></th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${sprite(row.member, `data-opponent-sprite="${row.slot}"`)}<span>${escape(row.member.name)}</span><small class="${row.ready && !row.wins ? "is-threat" : ""}">${rowLabel(row)}</small>${row.best != null ? `<small>Best: ${escape(own.team[row.best].name)}</small>` : ""}</th>${own.team.map((member, index) => `<td>${cell(member, index, row.slot, row.cells[index])}</td>`).join("")}</tr>`).join("")}</tbody>`;
      own.team.forEach((member, index) => { if (member) options.setSprite(table.querySelector(`[data-own-sprite="${index}"]`), member); });
      rows.forEach(row => options.setSprite(table.querySelector(`[data-opponent-sprite="${row.slot}"]`), row.member));
      mobileSlot = Math.max(0, Math.min(rows.length - 1, mobileSlot));
      const current = rows[mobileSlot];
      const mobile = $("teamOpponentMobile");
      mobile.innerHTML = current ? `<div class="opponent-mobile-head"><button type="button" class="secondary" data-opponent-page="-1" aria-label="Previous opponent"${mobileSlot === 0 ? " disabled" : ""}>‹</button><div>${sprite(current.member, 'data-mobile-opponent-sprite')}<strong>${escape(current.member.name)}</strong><small>${rowLabel(current)} · ${mobileSlot + 1}/${rows.length}</small></div><button type="button" class="secondary" data-opponent-page="1" aria-label="Next opponent"${mobileSlot === rows.length - 1 ? " disabled" : ""}>›</button></div><div class="opponent-mobile-grid">${own.team.map((member, index) => cell(member, index, current.slot, current.cells[index], true)).join("")}</div>${current.best != null ? `<p>Best answer: <strong>${escape(own.team[current.best].name)}</strong></p>` : ""}` : "";
      if (current) options.setSprite(mobile.querySelector("[data-mobile-opponent-sprite]"), current.member);
      own.team.forEach((member, index) => { const img = mobile.querySelector(`[data-own-result-sprite="${index}"]`); if (img && member) options.setSprite(img, member); });
    }
    function renderTrio(rows) {
      const own=options.own(), slots=selectedSlots(), api=root.PvPeakTeamOpponent;
      $("teamTrioCount").textContent=`${slots.length}/3 selected`;
      const picker=$("teamTrioPicker");
      const pickerMarkup=own.team.map((member,index)=>`<button type="button" class="secondary team-trio-member" data-trio-slot="${index}" aria-pressed="${slots.includes(index)}" aria-label="${escape(member?.name || `Slot ${index+1}`)}${member ? ' · Toggle in your trio' : ' · Empty slot'}"${!member || (slots.length===3 && !slots.includes(index)) ? " disabled" : ""}>${sprite(member,`data-trio-sprite="${index}"`)}<span>${escape(member?.name || `Slot ${index+1}`)}</span>${slots.includes(index) ? '<b aria-hidden="true">✓</b>' : ""}</button>`).join("");
      if(pickerMarkup!==trioPickerMarkup) {
        trioPickerMarkup=pickerMarkup; picker.innerHTML=pickerMarkup;
        own.team.forEach((member,index)=>{if(member)options.setSprite(picker.querySelector(`[data-trio-sprite="${index}"]`),member);});
      }
      const summary=api.analyzeTrio(rows,slots), output=$("teamTrioSummary");
      const summaryMarkup=slots.length!==3 ? '<p>Choose three Pokémon to check their coverage.</p>' : !summary.ready ? '<p>Prepare the remaining matchups to evaluate this trio.</p>' : `<div class="team-trio-metrics"><span><strong>${summary.covered}/${summary.total}</strong> opponents covered</span><span><strong>${summary.backups}/${summary.total}</strong> with backup answers</span></div>${summary.gaps.length ? `<p class="team-trio-gaps"><strong>No winning answer:</strong> ${summary.gaps.map(row=>`${escape(row.member.name)}${row.draws.length ? " (draw available)" : ""}`).join(" · ")}</p>` : '<p>At least one winning answer to every opposing Pokémon.</p>'}`;
      if(output.innerHTML!==summaryMarkup)output.innerHTML=summaryMarkup;
      const candidates=api.suggestTrios(rows,own.team.map((member,index)=>member ? index : null).filter(index=>index!=null)).slice(0,3);
      const details=$("teamTrioSuggestions"), list=$("teamTrioSuggestionsList");
      const suggestionsMarkup=candidates.length ? `<p>Ranked by winning coverage, weakest matchup and backup answers. Ratings range from 0 to 1000.</p>${candidates.map(candidate=>`<button type="button" class="secondary team-trio-suggestion" data-trio-suggestion="${candidate.slots.join(',')}"><strong>${candidate.slots.map(slot=>escape(own.team[slot].name)).join(' · ')}</strong><span>${candidate.covered}/${candidate.total} covered · weakest ${candidate.weakest} · ${candidate.backups} with backups</span><b>Use trio</b></button>`).join('')}` : '<p>Add at least three Pokémon to your team and prepare all matchups to see suggested trios.</p>';
      if(suggestionsMarkup!==trioSuggestionsMarkup) { trioSuggestionsMarkup=suggestionsMarkup; list.innerHTML=suggestionsMarkup; }
      details.querySelector('summary').textContent = candidates.length ? 'Suggested trios' : 'Suggested trios · pending';
      renderFarm(summary);
    }
    function renderFarm(summary) {
      const state=options.farm(), own=options.own(), opponent=options.opponent();
      const panel=$("teamTrioFarm"); panel.hidden=selectedSlots().length!==3;
      if(state.signature!==farmSignature) { farmSignature=state.signature; showAllFarm=false; farmTargets.clear(); }
      const running=state.phase==="running", complete=state.phase==="complete";
      $("teamTrioFarmAnalyze").disabled=!summary.ready || running;
      $("teamTrioFarmAnalyze").hidden=complete;
      $("teamTrioFarmCancel").hidden=!running;
      $("teamTrioFarmStatus").textContent=running ? `Checking ${state.done}/${state.total} losing matchups…` : state.phase==="error" ? state.error : !summary.ready ? "Prepare this trio's matchups first." : !complete ? "Check which teammates can farm the surviving opponent." : "";
      const routes=state.results.flatMap(result=>result.routes.map(route=>({...route,ownSlot:result.ownSlot,opponentSlot:result.opponentSlot,score:result.score})));
      const safe=routes.filter(route=>route.status==="safe");
      $("teamTrioFarmHeading").textContent=complete ? `Farm after a loss · ${safe.length} safe ${safe.length===1 ? "route" : "routes"}` : "Farm after a loss";
      const rank={safe:0,risk:1,charged:2,failed:3,incomplete:4};
      routes.sort((a,b)=>rank[a.status]-rank[b.status] || a.opponentSlot-b.opponentSlot || a.ownSlot-b.ownSlot || a.slot-b.slot);
      const successful=routes.filter(route=>route.status==="risk" || route.status==="charged");
      const preferred=(safe.length ? routes.filter(route=>route.status==="safe") : successful.length ? successful : routes.slice(0,3)).slice(0,6);
      const visible=showAllFarm ? routes : preferred;
      const filter=$("teamTrioFarmFilter"); filter.hidden=!complete || routes.length<=preferred.length;
      filter.textContent=showAllFarm ? "Show summary" : `Show all ${routes.length} routes`;
      filter.setAttribute("aria-pressed",String(showAllFarm));
      const label=route=>route.status==="safe" ? "Safe farm" : route.status==="risk" ? "Charged risk" : route.status==="charged" ? `${route.chargedReceived} charged` : route.status==="failed" ? "Farm fails" : "Not resolved";
      const detail=route=>route.status==="safe" ? "KO before the opponent can launch a Charged Attack." : route.status==="risk" ? "The opponent can launch a Charged Attack before the KO, even though it did not in this simulated line." : route.status==="charged" ? `Farm completed with ${route.chargedReceived} opposing Charged Attack${route.chargedReceived===1 ? "" : "s"} and ${route.shieldsUsed} shield${route.shieldsUsed===1 ? "" : "s"} used.` : route.status==="incomplete" ? "This farm did not resolve within the simulation limit." : "The teammate did not survive a complete farm in this simulated line.";
      const markup=!complete ? "" : !routes.length ? '<p>No losing matchups to follow up in this scenario.</p>' : `<p>${safe.length ? "Safe farms shown first." : "No farm finishes before an opposing Charged Attack becomes possible."} Open a route for the starting conditions.</p>${visible.map(route=>{
        const lost=own.team[route.ownSlot], farmer=own.team[route.slot], enemy=opponent.team[route.opponentSlot];
        if(!lost || !farmer || !enemy)return "";
        const metrics=(route.status==="failed" || route.status==="incomplete" ? "No surviving farmer" : `${route.fastCount} ${escape(route.fastMoveName)} · +${route.energyGained} energy · ${route.hpPercent}% HP`)+` · ${route.shieldsUsed} ${route.shieldsUsed===1 ? "shield" : "shields"} used`;
        const stages=route.entry.attackStage || route.entry.defenseStage ? ` · ATK ${route.entry.attackStage>0 ? "+" : ""}${route.entry.attackStage} / DEF ${route.entry.defenseStage>0 ? "+" : ""}${route.entry.defenseStage}` : "";
        const routeKey=`${route.ownSlot}-${route.opponentSlot}-${route.slot}`;
        return `<details class="team-farm-route is-${route.status}" data-farm-detail="${routeKey}"><summary><span class="team-farm-enemy">vs ${escape(enemy.name)}</span><strong>${escape(lost.name)} → ${escape(farmer.name)}</strong><b class="team-farm-badge">${label(route)}</b><small>${route.score<=250 ? "Hard" : "Soft"} loss → ${metrics}</small></summary><div class="team-farm-route-body"><p>${detail(route)}</p>${farmTimeline(route,farmer,enemy)}<p>Opponent: ${route.entry.opponentHp}/${route.entry.opponentMaxHp} → ${route.opponentHpAfter} HP · ${route.entry.opponentEnergy} → ${route.opponentEnergyAfter} energy${stages}. Shields at entry: ${route.entry.teamShields} yours / ${route.entry.opponentShields} opponent.</p>${farmNext(route,routeKey,opponent)}<button type="button" class="secondary" data-farm-first="${route.ownSlot}" data-farm-opponent="${route.opponentSlot}">Open first matchup in Battle</button></div></details>`;
      }).join("")}`;
      if(markup!==farmMarkup) {
        const open=new Set(Array.from($("teamTrioFarmResults").querySelectorAll('details[open][data-farm-detail]')).map(el=>el.dataset.farmDetail));
        farmMarkup=markup; $("teamTrioFarmResults").innerHTML=markup;
        $("teamTrioFarmResults").querySelectorAll('details[data-farm-detail]').forEach(el=>{el.open=open.has(el.dataset.farmDetail);});
      }
    }
    function farmTimeline(route,farmer,enemy) {
      const events=route.timeline || [], end=Math.max(1,...events.map(event=>event.end));
      const lanes=[["A",farmer.name],["B",enemy.name]].map(([side,name])=>`<div class="team-farm-lane${side==="B" ? " is-opponent" : ""}"><span>${escape(name)}</span><div class="team-farm-track">${events.filter(event=>event.side===side).map(event=>{
        const start=Math.max(0,Math.min(98,100*Math.min(event.start,end)/end)), width=Math.max(.8,100*Math.max(1,event.duration || event.end-event.start)/end);
        const description=`${event.moveName}${event.shielded ? " · shielded" : ""} · turn ${event.end}`;
        return `<span class="team-farm-event is-${event.kind}${event.shielded ? " is-shielded" : ""}" style="left:${Math.min(98,start)}%;width:${Math.min(100-start,width)}%" title="${escape(description)}" aria-label="${escape(description)}">${event.kind==="charge" ? event.shielded ? "S" : "◆" : ""}</span>`;
      }).join("")}</div></div>`).join("");
      return `<div class="team-farm-timeline" role="group" aria-label="Farm timeline"><div class="team-farm-timeline-head"><b>Farm timeline</b><span>0 → ${end} turns · ${route.continuation ? "KO" : route.status==="failed" ? "Fainted" : "Stopped"}</span></div>${lanes}<p class="team-farm-legend">Bars: Fast · ◆ Charged${events.some(event=>event.kind==="charge") ? ` (${[...new Set(events.filter(event=>event.kind==="charge").map(event=>escape(event.moveName)))].join(" / ")})` : ""} · S Shielded</p><div class="team-farm-resources"><span>Your HP <b>100% → ${route.hpPercent}%</b></span><span>Energy <b>0 → ${route.energyAfter}</b></span><span>Shields <b>${route.entry.teamShields} → ${route.shieldsAfter}</b></span></div></div>`;
    }
    function farmNext(route,routeKey,opponent) {
      if(!route.continuation)return "";
      const targets=opponent.team.map((member,slot)=>({member,slot})).filter(value=>value.member && value.slot!==route.opponentSlot);
      if(!targets.length)return '<p>Add another opposing Pokémon to check the next matchup.</p>';
      const target=farmTargets.get(routeKey) ?? targets[0].slot; farmTargets.set(routeKey,target);
      const next=options.farmNext(routeKey,target), result=next.result;
      const outcome=value=>value.details.outcome==="A" ? "Win" : value.details.outcome==="B" ? "Loss" : value.details.outcome==="draw" ? "Draw" : "Unresolved";
      const stages=result && (result.entry.attackStage || result.entry.defenseStage) ? ` · ATK ${result.entry.attackStage>0 ? "+" : ""}${result.entry.attackStage} / DEF ${result.entry.defenseStage>0 ? "+" : ""}${result.entry.defenseStage}` : "";
      const output=next.phase==="running" ? '<p role="status">Checking next matchup…</p>' : next.phase==="error" ? `<p role="alert">${escape(next.error)}</p>` : next.phase==="complete" ? `<div class="team-farm-next-result" role="status"><div><span>After farm</span><strong>${outcome(result.carried)}</strong><small>${Math.round(result.carried.details.aHp*100)}% HP · ${result.carried.energyAfter} energy · ${result.carried.shieldsAfter} shields left</small></div><div><span>Fresh start</span><strong>${outcome(result.fresh)}</strong><small>${Math.round(result.fresh.details.aHp*100)}% HP · ${result.fresh.details.aEnergy} energy<br>Full HP · 0 energy · same shields</small></div></div><p>Starting with ${result.entry.hp}/${result.entry.maxHp} HP · ${result.entry.energy} energy · ${result.entry.shields} shields${stages}.</p>` : "";
      return `<details class="team-farm-next" data-farm-detail="next-${routeKey}"><summary>Use the energy · Next matchup</summary><p>Next opponent: full HP, 0 energy and their remaining team shields. Both can use Charged Attacks.</p><div class="team-farm-next-controls"><label>Next opponent<select data-farm-next-target="${routeKey}">${targets.map(({member,slot})=>`<option value="${slot}"${slot===target ? " selected" : ""}>${escape(member.name)}</option>`).join("")}</select></label><button type="button" class="secondary" data-farm-next-route="${routeKey}"${next.phase==="running" ? " disabled" : ""}>${next.phase==="complete" ? "Checked" : "Check matchup"}</button>${next.phase==="running" ? '<button type="button" class="secondary" data-farm-next-cancel>Cancel</button>' : ""}</div>${output}</details>`;
    }
    $("teamTrioFarmAnalyze").onclick=options.analyzeFarm;
    $("teamTrioFarmCancel").onclick=options.cancelFarm;
    $("teamTrioFarmFilter").onclick=()=>{showAllFarm=!showAllFarm; renderResults();};
    $("teamTrioFarmResults").onclick=event=>{
      const first=event.target.closest('[data-farm-first]'); if(first)options.battle(Number(first.dataset.farmFirst),Number(first.dataset.farmOpponent));
      const next=event.target.closest('[data-farm-next-route]'); if(next)options.analyzeFarmNext(next.dataset.farmNextRoute,farmTargets.get(next.dataset.farmNextRoute));
      if(event.target.closest('[data-farm-next-cancel]')) { options.cancelFarmNext(); renderResults(); }
    };
    $("teamTrioFarmResults").onchange=event=>{
      const select=event.target.closest('[data-farm-next-target]'); if(!select)return;
      farmTargets.set(select.dataset.farmNextTarget,Number(select.value)); options.cancelFarmNext(); renderResults();
      $("teamTrioFarmResults").querySelector(`[data-farm-next-target="${select.dataset.farmNextTarget}"]`)?.focus({preventScroll:true});
    };
    $("teamTrioPicker").onclick=event=>{
      const button=event.target.closest('[data-trio-slot]'); if(!button || button.disabled)return;
      options.toggleTrio(Number(button.dataset.trioSlot)); renderResults();
      $("teamTrioPicker").querySelector(`[data-trio-slot="${button.dataset.trioSlot}"]`)?.focus({preventScroll:true});
    };
    $("teamTrioSuggestionsList").onclick=event=>{
      const button=event.target.closest('[data-trio-suggestion]'); if(!button)return;
      const slots=button.dataset.trioSuggestion.split(',').map(Number);
      options.useTrio(slots); renderResults(); $("teamTrioPicker").querySelector(`[data-trio-slot="${slots[0]}"]`)?.focus({preventScroll:true});
    };
    $("teamOpponentRoster").onclick = event => {
      const button = event.target.closest("button"); if (!button) return;
      if (button.dataset.teamAdd != null || button.dataset.teamReplace != null) options.pick(Number(button.dataset.teamAdd ?? button.dataset.teamReplace), button);
      else if (button.dataset.teamEdit != null) options.edit(Number(button.dataset.teamEdit), button);
      else if (button.dataset.teamRemove != null) options.remove(Number(button.dataset.teamRemove));
    };
    $("teamOpponentResults").onclick = event => {
      const button = event.target.closest("button"); if (!button) return;
      if (button.dataset.opponentBattle != null) options.battle(Number(button.dataset.opponentBattle), Number(button.dataset.opponentSlot));
      else if (button.dataset.opponentPage) { mobileSlot += Number(button.dataset.opponentPage); renderResults(); }
    };
    $("teamOpponentAnalyze").onclick = options.analyze;
    $("teamOpponentCancel").onclick = options.cancel;
    $("teamOpponentLoad").onclick = options.load;
    $("teamOpponentSave").onclick = options.save;
    $("teamOpponentClear").onclick = options.clear;
    $("teamOpponentShare").onclick = options.share;
    ["A", "B"].forEach(side => { $("teamOpponentShields" + side).onchange = event => options.shields(side, event.target.value); });
    ["A", "B"].forEach(side => { $("teamOpponentEnergy" + side).onchange=event=>options.energy(side,event.target.value); });
    return { render, renderResults, open() { section.open = true; render(); } };
  } };
})(globalThis);
