(function (root) {
  "use strict";
  root.PvPeakTeamOpponentUI = { create(options) {
    const $ = id => document.getElementById(id), escape = options.escapeHtml;
    const section = $("teamOpponentPanel");
    let mobileSlot = 0, trioPickerMarkup = "", trioSuggestionsMarkup = "";
    let farmSignature = "", farmMarkup = "", showAllFarm = false;
    const farmTargets = new Map(), openFarmRoutes = new Map();
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
      const comparison=options.opponent();
      const conditions=slots.length===3 && summary.ready ? `<p class="team-trio-conditions">Comparison · shields ${comparison.shields?.A ?? 1}–${comparison.shields?.B ?? 1} · energy ${comparison.energy?.A || 0}/${comparison.energy?.B || 0}</p>` : '';
      const completeSummary=conditions+summaryMarkup;
      if(output.innerHTML!==completeSummary)output.innerHTML=completeSummary;
      const candidates=api.suggestTrios(rows,own.team.map((member,index)=>member ? index : null).filter(index=>index!=null)).slice(0,3);
      const details=$("teamTrioSuggestions"), list=$("teamTrioSuggestionsList");
      const suggestionsMarkup=candidates.length ? `<p>Coverage only · current comparison · roles not assigned.</p>${candidates.map(candidate=>`<button type="button" class="secondary team-trio-suggestion" data-trio-suggestion="${candidate.slots.join(',')}"><span class="team-coverage-lineup">${candidate.slots.map(slot=>`<span>${sprite(own.team[slot],`data-coverage-sprite="${slot}"`)}<strong>${escape(own.team[slot].name)}</strong></span>`).join('')}</span><span>${candidate.covered}/${candidate.total} opponents answered · ${candidate.backups}/${candidate.total} with two or more answers</span><b>Use trio</b></button>`).join('')}` : '<p>Add at least three Pokémon to your team and prepare all matchups to see suggested trios.</p>';
      if(suggestionsMarkup!==trioSuggestionsMarkup) {
        trioSuggestionsMarkup=suggestionsMarkup; list.innerHTML=suggestionsMarkup;
        list.querySelectorAll('[data-coverage-sprite]').forEach(img=>options.setSprite(img,own.team[Number(img.dataset.coverageSprite)]));
      }
      details.querySelector('summary').textContent = candidates.length ? 'Suggested trios' : 'Suggested trios · pending';
      options.roles?.();
      renderFarm(summary);
    }
    function farmIcon(kind) {
      const paths={hp:'M12 20 4 12C-1 6 6 0 12 6c6-6 13 0 8 6Z',energy:'m13 2-9 12h7l-1 8 10-13h-7Z',shield:'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z',fast:'m4 7 5 5-5 5m7-10 5 5-5 5m7-10 5 5-5 5'};
      return `<svg viewBox="0 0 24 24" aria-hidden="true" class="team-farm-icon is-${kind}"><path d="${paths[kind]}" fill="${kind==='fast' ? 'none' : 'currentColor'}" stroke="currentColor" stroke-width="${kind==='fast' ? '2' : '0'}" stroke-linejoin="round"/></svg>`;
    }
    function farmImage(slot,side) { return `<img data-farm-sprite-slot="${slot}" data-farm-sprite-side="${side}" alt="" aria-hidden="true">`; }
    function farmHp(percent,label) {
      const hp=Math.max(0,Math.min(100,Number(percent)||0));
      return `<span class="team-farm-hp" role="meter" aria-label="${escape(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${hp}"><span style="width:${hp}%;background:var(${hp>45 ? '--good' : hp>20 ? '--warn' : '--danger'})"></span></span>`;
    }
    function farmStats(hp,energy,shields,shieldLabel="Shields used") {
      return `<div class="team-farm-stats"><div><span>${farmIcon('hp')}HP left</span><b>${hp}%</b>${farmHp(hp,'Remaining HP')}</div><div><span>${farmIcon('energy')}Energy</span><b>${energy}</b></div>${shields==null ? '' : `<div><span>${farmIcon('shield')}${shieldLabel}</span><b>${shields}</b></div>`}</div>`;
    }
    function farmReadyMoves(route) {
      const moves=root.PvPeakTeamFarmPresentation.chargedReadiness(route);
      if(!moves.length)return '';
      return `<div class="team-farm-moves"><span>Charged after farm</span>${moves.map(({move,ready,fastCount})=>`<div class="team-farm-ready-move${ready ? ' is-ready' : ''}">${options.movePill(move)}<b>${ready ? '✓ Ready' : fastCount==null ? 'Unavailable' : `+${fastCount} Fast`}</b></div>`).join('')}</div>`;
    }
    function renderFarm(summary) {
      const state=options.farm(), own=options.own(), opponent=options.opponent();
      const panel=$("teamTrioFarm"); panel.hidden=selectedSlots().length!==3;
      if(state.signature!==farmSignature) { farmSignature=state.signature; showAllFarm=false; farmTargets.clear(); openFarmRoutes.clear(); }
      const running=state.phase==="running", complete=state.phase==="complete";
      $("teamTrioFarmAnalyze").disabled=!summary.ready || running;
      $("teamTrioFarmAnalyze").hidden=complete;
      $("teamTrioFarmAnalyze").closest('.team-farm-controls').hidden=complete;
      $("teamTrioFarmCancel").hidden=!running;
      $("teamTrioFarmStatus").textContent=running ? `Checking ${state.done}/${state.total}…` : state.phase==="error" ? state.error : !summary.ready ? "Prepare this trio's matchups first." : "";
      const routes=state.results.flatMap(result=>result.routes.map(route=>({...route,ownSlot:result.ownSlot,opponentSlot:result.opponentSlot,score:result.score})));
      const safe=routes.filter(route=>route.status==="safe");
      $("teamTrioFarmHeading").textContent=complete ? `Farm after a loss · ${safe.length} safe ${safe.length===1 ? "route" : "routes"}` : "Farm after a loss";
      const groups=root.PvPeakTeamFarmPresentation.groupRoutes(routes);
      const successful=groups.filter(group=>['safe','risk','charged'].includes(group.routes[0].status));
      const preferred=(successful.length ? successful : groups).slice(0,3), visible=showAllFarm ? groups : preferred;
      const filter=$("teamTrioFarmFilter"); filter.hidden=!complete || groups.length<=preferred.length;
      filter.textContent=showAllFarm ? "Best matchups" : `All matchups (${groups.length})`;
      filter.setAttribute("aria-pressed",String(showAllFarm));
      const label=route=>route.status==="safe" ? "✓ Safe farm" : route.status==="risk" ? "! Charged risk" : route.status==="charged" ? `Farm · ${route.shieldsUsed ? `${route.shieldsUsed} shield${route.shieldsUsed===1 ? "" : "s"} used` : `${route.chargedReceived} Charged`}` : route.status==="failed" ? "× Farm fails" : "Not resolved";
      const detail=route=>route.status==="safe" ? "KO before the opponent can launch a Charged Attack." : route.status==="risk" ? "The opponent can launch a Charged Attack before the KO, even though it did not in this simulated line." : route.status==="charged" ? `Farm completed with ${route.chargedReceived} opposing Charged Attacks and ${route.shieldsUsed} shields used.` : route.status==="incomplete" ? "This farm did not resolve within the simulation limit." : "The teammate did not survive a complete farm in this simulated line.";
      const markup=!complete ? "" : !groups.length ? '<p>No losing matchups in this scenario.</p>' : `${!safe.length ? '<p class="team-farm-notice">No safe farm in this scenario.</p>' : ''}${visible.map(group=>{
        const lost=own.team[group.ownSlot], enemy=opponent.team[group.opponentSlot], entry=group.routes[0].entry;
        if(!lost || !enemy)return '';
        const hp=Math.round(100*entry.opponentHp/entry.opponentMaxHp), selected=openFarmRoutes.get(group.key);
        const route=group.routes.find(route=>`${group.key}-${route.slot}`===selected);
        const cards=group.routes.map(route=>{
          const farmer=own.team[route.slot], key=`${group.key}-${route.slot}`, open=key===selected;
          if(!farmer)return '';
          return `<button type="button" class="team-farm-choice is-${route.status}${open ? ' is-selected' : ''}" data-farm-choice="${key}" data-farm-group="${group.key}" aria-expanded="${open}" aria-controls="farm-route-${key}" aria-label="${escape(`${farmer.name}: ${label(route)}. ${route.hpPercent}% HP left, ${route.continuation ? route.energyAfter : 'no usable'} energy, ${route.shieldsUsed} shields used. Show farm details.`)}"><b class="team-farm-badge">${label(route)}</b><div class="team-farm-person">${farmImage(route.slot,'own')}<b>${escape(farmer.name)}</b></div>${farmStats(route.hpPercent,route.continuation ? route.energyAfter : '—',route.shieldsUsed)}<div class="team-farm-card-foot"><span>${farmIcon('fast')}<b>${route.fastCount}×</b> ${escape(route.fastMoveName)}</span></div>${farmReadyMoves(route)}<span class="team-farm-choice-action">${open ? 'Close details ⌃' : 'Farm details ⌄'}</span></button>`;
        }).join('');
        let body='';
        if(route) {
          const key=`${group.key}-${route.slot}`, farmer=own.team[route.slot], stages=entry.attackStage || entry.defenseStage ? ` · ATK ${entry.attackStage} / DEF ${entry.defenseStage}` : '';
          body=`<div class="team-farm-route-body" id="farm-route-${key}" data-farm-detail="${key}" role="region" aria-label="${escape(`${farmer.name} farm details`)}"><div class="team-farm-detail-title">${farmImage(route.slot,'own')}<b>${escape(farmer.name)}</b><span>VS ${escape(enemy.name)}</span></div>${farmTimeline(route,enemy)}<button type="button" class="secondary team-farm-battle" data-farm-battle="${key}">Open farm in Battle ↗</button>${farmNext(route,key,opponent,farmer)}<div class="team-farm-route-actions"><button type="button" class="secondary" data-farm-first="${group.ownSlot}" data-farm-opponent="${group.opponentSlot}">First matchup ↗ Battle</button><details class="team-farm-conditions" data-farm-detail="conditions-${key}"><summary>Farm conditions</summary><p>${detail(route)}</p><p>${route.score<=250 ? 'Hard' : 'Soft'} loss. Fresh farmer: full HP, 0 energy. Opponent: ${entry.opponentHp}/${entry.opponentMaxHp} → ${route.opponentHpAfter} HP · ${entry.opponentEnergy} → ${route.opponentEnergyAfter} energy${stages}. Shields at entry: ${entry.teamShields} yours / ${entry.opponentShields} opponent. Opponent stays in. Charged readiness counts energy only; the next opponent can interrupt your Fast Attacks.</p></details></div></div>`;
        }
        return `<section class="team-farm-group" aria-label="${escape(`Farm ${enemy.name} after ${lost.name} faints`)}"><div class="team-farm-group-head"><div class="team-farm-loss-context">${farmImage(group.ownSlot,'own')}<span>After ${escape(lost.name)} <b>KO</b></span></div><div class="team-farm-opponent">${farmImage(group.opponentSlot,'opponent')}<div><b>${escape(enemy.name)}</b><span>Start · ${hp}% HP · ${farmIcon('energy')}${entry.opponentEnergy}</span>${farmHp(hp,`${enemy.name} starting HP`)}</div></div></div><div class="team-farm-choices">${cards}</div>${body}</section>`;
      }).join('')}`;
      if(markup!==farmMarkup) {
        const open=new Set(Array.from($("teamTrioFarmResults").querySelectorAll('details[open][data-farm-detail]')).map(el=>el.dataset.farmDetail));
        farmMarkup=markup; $("teamTrioFarmResults").innerHTML=markup;
        $("teamTrioFarmResults").querySelectorAll('details[data-farm-detail]').forEach(el=>{el.open=open.has(el.dataset.farmDetail);});
        $("teamTrioFarmResults").querySelectorAll('[data-farm-sprite-slot]').forEach(image=>{
          const member=(image.dataset.farmSpriteSide==='own' ? own : opponent).team[Number(image.dataset.farmSpriteSlot)];
          if(member)options.setSprite(image,member);
        });
      }
    }
    function farmTimeline(route,enemy) {
      const events=route.timeline || [], end=Math.max(1,...events.map(event=>event.end));
      const lanes=[['A',route.slot,'own',route.hpPercent],['B',route.opponentSlot,'opponent',Math.round(100*route.opponentHpAfter/route.entry.opponentMaxHp)]].map(([side,slot,owner,hp])=>`<div class="team-farm-lane${side==='B' ? ' is-opponent' : ''}">${farmImage(slot,owner)}<div class="team-farm-track">${events.filter(event=>event.side===side).map(event=>{
        const start=Math.max(0,Math.min(98,100*Math.min(event.start,end)/end)), width=Math.max(.8,100*Math.max(1,event.duration || event.end-event.start)/end);
        const description=`${event.moveName}${event.shielded ? ' · shielded' : ''} · turn ${event.end}`;
        return `<span class="team-farm-event is-${event.kind}${event.shielded ? ' is-shielded' : ''}" style="left:${start}%;width:${Math.min(100-start,width)}%" title="${escape(description)}" role="img" aria-label="${escape(description)}">${event.kind==='charge' ? farmIcon(event.shielded ? 'shield' : 'energy') : ''}</span>`;
      }).join('')}</div><span class="team-farm-lane-hp">${hp<=0 ? 'KO' : `${hp}%`}${farmHp(hp,side==='A' ? 'Farmer final HP' : `${enemy.name} final HP`)}</span></div>`).join('');
      const charges=events.filter(event=>event.kind==='charge');
      return `<div class="team-farm-timeline" role="group" aria-label="Farm timeline"><div class="team-farm-timeline-head"><b>Timeline</b><span>${end} turns</span></div>${lanes}<div class="team-farm-legend"><span>${farmIcon('fast')}Fast</span><span>${farmIcon('energy')}Charged</span><span>${farmIcon('shield')}Shield</span></div>${charges.length ? `<div class="team-farm-charge-list">${[...new Set(charges.map(event=>event.moveName))].map(name=>`<span>${escape(name)} <b>×${charges.filter(event=>event.moveName===name).length}</b></span>`).join('')}</div>` : ''}</div>`;
    }
    function farmNext(route,routeKey,opponent,farmer) {
      if(!route.continuation)return '';
      const targets=opponent.team.map((member,slot)=>({member,slot})).filter(value=>value.member && value.slot!==route.opponentSlot);
      if(!targets.length)return '';
      const target=farmTargets.get(routeKey) ?? targets[0].slot; farmTargets.set(routeKey,target);
      const next=options.farmNext(routeKey,target), result=next.result;
      const outcome=value=>value.details.outcome==='A' ? ['Win','win'] : value.details.outcome==='B' ? ['Loss','loss'] : value.details.outcome==='draw' ? ['Draw','draw'] : ['Unresolved','draw'];
      const resultCard=(value,label,energy)=>{
        const [text,tone]=outcome(value), hp=Math.round(value.details.aHp*100);
        return `<div class="team-farm-result-card is-${tone}"><span>${label}</span><div class="team-farm-outcome"><b aria-hidden="true">${tone==='win' ? '✓' : tone==='loss' ? '×' : '≈'}</b><strong>${text}</strong></div>${farmStats(hp,hp>0 ? energy : '—',value.shieldsAfter,'Shields left')}</div>`;
      };
      const stages=result && (result.entry.attackStage || result.entry.defenseStage) ? ` · ATK ${result.entry.attackStage>0 ? '+' : ''}${result.entry.attackStage} / DEF ${result.entry.defenseStage>0 ? '+' : ''}${result.entry.defenseStage}` : '';
      const output=next.phase==='running' ? '<span class="team-farm-next-status" role="status">Checking…</span>' : next.phase==='error' ? `<p role="alert">${escape(next.error)}</p>` : next.phase==='complete' ? `<div class="team-farm-next-result" role="status">${resultCard(result.carried,'After farm',result.carried.energyAfter)}${resultCard(result.fresh,'Fresh start',result.fresh.details.aEnergy)}</div>` : '';
      return `<details class="team-farm-next" data-farm-detail="next-${routeKey}"><summary>Next matchup</summary><div class="team-farm-next-pair"><div class="team-farm-next-farmer">${farmImage(route.slot,'own')}<b>${escape(farmer.name)}</b><span>${route.hpPercent}% HP · ${farmIcon('energy')}${route.energyAfter}</span></div><span class="team-farm-vs">VS</span><label class="team-farm-next-enemy">${farmImage(target,'opponent')}<span class="team-farm-sr">Next opponent</span><select data-farm-next-target="${routeKey}" aria-label="Next opponent">${targets.map(({member,slot})=>`<option value="${slot}"${slot===target ? ' selected' : ''}>${escape(member.name)}</option>`).join('')}</select><span>100% HP · ${farmIcon('energy')}0</span></label></div><div class="team-farm-next-controls">${next.phase==='complete' ? '' : `<button type="button" class="secondary" data-farm-next-route="${routeKey}"${next.phase==='running' ? ' disabled' : ''}>Check matchup</button>`}${next.phase==='running' ? '<button type="button" class="secondary" data-farm-next-cancel>Cancel</button>' : ''}</div>${output}${next.phase==='complete' ? `<button type="button" class="secondary team-farm-battle" data-farm-next-battle="${routeKey}">Open next matchup in Battle ↗</button>` : ''}<details class="team-farm-conditions" data-farm-detail="next-conditions-${routeKey}"><summary>Matchup conditions</summary><p>New opponent: full HP, 0 energy, remaining team shields. Both can use Charged Attacks. Fresh start: full HP, 0 energy, original build, same remaining shields.</p>${result ? `<p>After farm starts with ${result.entry.hp}/${result.entry.maxHp} HP · ${result.entry.energy} energy · ${result.entry.shields} shields${stages}. Final shields: ${result.carried.shieldsAfter}.</p>` : ''}</details></details>`;
    }
    $("teamTrioFarmAnalyze").onclick=options.analyzeFarm;
    $("teamTrioFarmCancel").onclick=options.cancelFarm;
    $("teamTrioFarmFilter").onclick=()=>{showAllFarm=!showAllFarm; renderResults();};
    $("teamTrioFarmResults").onclick=event=>{
      const choice=event.target.closest('[data-farm-choice]');
      if(choice) {
        const key=choice.dataset.farmChoice,group=choice.dataset.farmGroup;
        if(openFarmRoutes.get(group)===key)openFarmRoutes.delete(group); else openFarmRoutes.set(group,key);
        renderResults(); $("teamTrioFarmResults").querySelector(`[data-farm-choice="${key}"]`)?.focus({preventScroll:true}); return;
      }
      const farmBattle=event.target.closest('[data-farm-battle]'); if(farmBattle)options.farmBattle(farmBattle.dataset.farmBattle);
      const nextBattle=event.target.closest('[data-farm-next-battle]'); if(nextBattle)options.farmBattle(nextBattle.dataset.farmNextBattle,farmTargets.get(nextBattle.dataset.farmNextBattle));
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
