(function (root) {
  'use strict';
  root.PvPeakTeamRolesUI={create(options) {
    const $=id=>document.getElementById(id),escape=options.escapeHtml;
    let selectedRole='switch',markup='';
    const image=(slot,side='own')=>`<img data-role-sprite="${slot}" data-role-side="${side}" alt="" aria-hidden="true">`;
    const counts=value=>`${value.wins}W · ${value.draws}D · ${value.losses}L${value.unresolved ? ` · ${value.unresolved}?` : ''}`;
    const shields=(a,b,extra='')=>`<span class="team-role-condition"><svg viewBox="0 0 16 18" aria-hidden="true"><path d="M8 1 14 3v5c0 4-3 7-6 9-3-2-6-5-6-9V3Z"/></svg><span>${a}–${b}${extra}</span></span>`;
    function route(candidate,name,enemyName){
      const enemies=candidate.recovery;
      if(!enemies.length)return '';
      const label=`${name(candidate.lead)} loses to ${enemies.map(enemyName).join(', ')} at 1–1; ${name(candidate.switch)} wins an energy check with the opponent banking one Fast move of energy, full HP, no reaction delay and 1–1 shields. This is not a replay of the opening.`;
      return `<div class="team-role-route" aria-label="${escape(label)}"><div><small>Lead loses</small>${image(candidate.lead)}</div><span aria-hidden="true">→</span><div><small>Against</small><span>${enemies.slice(0,2).map(slot=>image(slot,'opponent')).join('')}${enemies.length>2 ? `<b>+${enemies.length-2}</b>` : ''}</span></div><span aria-hidden="true">→</span><div><small>Switch wins</small>${image(candidate.switch)}</div><small class="team-role-route-condition">Energy check · foe +1 Fast · 1–1</small></div>`;
    }
    function reliability(p,opponents,enemyName){
      return `<div class="team-role-reliability"><div><b>Switch reliability</b><strong>${p.switchStable.length}/${opponents.length} hold</strong></div><div class="team-role-checks">${opponents.map(slot=>`<span class="${p.switchStable.includes(slot) ? 'is-safe' : 'is-conditional'}" title="${escape(enemyName(slot))}: ${p.switchStable.includes(slot) ? 'Win/draw at 0–0, 1–1 and 2–2 without extra shields' : 'Fails the win/draw or shield-spend condition in at least one scenario'}">${image(slot,'opponent')}<b aria-hidden="true">${p.switchStable.includes(slot) ? '✓' : '!'}</b></span>`).join('')}</div><small>✓ Holds at 0–0, 1–1 & 2–2 · no extra shields · ! Varies</small></div>`;
    }
    function answerPairs(answers,name,enemyName){
      return `<div class="team-role-answer-pairs">${answers.map(answer=>`<span aria-label="${escape(`${name(answer.slot)} is the only winning answer to ${enemyName(answer.opponentSlot)} at 1–1`)}">${image(answer.opponentSlot,'opponent')}<span>→</span>${image(answer.slot)}</span>`).join('')}</div>`;
    }
    function opponentPanel(context,enemyName){
      if(!context)return '';
      return `<details class="team-role-options" data-role-detail="opponent-options"><summary>Opponent options · ${context.options.length} examples</summary><p>Strong options against your full roster. Model hypotheses, not predicted picks.</p><div>${context.options.map((option,index)=>`<article><b>Option ${index+1}</b><div class="team-role-option-lineup">${option.slots.map((slot,i)=>`<div><small>${['Lead','Switch','Closer'][i]}</small>${image(slot,'opponent')}<b>${escape(enemyName(slot))}</b></div>`).join('')}</div><span>${option.covered}/${option.total} of your roster answered · 1–1</span></article>`).join('')}</div><p>Recommendations check all ${context.poolCount} distinct opposing trios, including those not shown here.</p></details>`;
    }
    function contextDetails(candidate,name,enemyName){
      const context=candidate.context;if(!context)return '';
      return `<section class="team-role-context"><b>All ${context.poolCount} opposing combinations checked</b><small>At least ${context.coverageFloor}/3 opponents have a winning answer at 1–1. All three answered in ${context.fullyAnswered}/${context.poolCount} combinations.</small><b>Worst role counts across all combinations</b><small>All roles: at least ${context.roleFloor}/3 tested successes · reliable switch ${context.switchFloor}/3 · closer ${context.closerFloor}/3 with a shield advantage.</small><b>Their strongest answers to this trio</b><div class="team-role-reply">${context.reply.slots.map(slot=>image(slot,'opponent')).join('')}<span>${context.reply.covered}/3 of your trio have an opposing answer · 1–1</span></div><div class="team-role-answer-pairs">${context.reply.answers.filter(a=>a.opponentSlot!=null).map(a=>`<span aria-label="${escape(`${enemyName(a.opponentSlot)} beats ${name(a.slot)} at 1–1`)}">${image(a.opponentSlot,'opponent')}<span>→</span>${image(a.slot)}</span>`).join('')}</div><small>Ranking first preserves winning coverage, then limits strong opposing answers, then compares the chosen role. Strong means a winning Battle rating of at least 751; it is not a pick probability.</small>${context.counters.length ? `<b>Hard counters · roster trade-offs</b>${context.counters.map(counter=>`<div class="team-role-counter"><div>${image(counter.opponentSlot,'opponent')}<span>→</span>${image(counter.slot)}</div><small>${escape(enemyName(counter.opponentSlot))} beats ${escape(name(counter.slot))} clearly at 1–1.</small><span>${counter.strongRosterAnswers.length} strong answers in your roster</span><div>${counter.strongRosterAnswers.map(slot=>image(slot)).join('') || 'None'}</div><small>In ${counter.inOptions}/${context.cases.length} displayed examples. Still available as an opposing pick.</small></div>`).join('')}` : ''}<p>Individual matchups, not a full 3v3 simulation. Alignment and adaptation remain decisive.</p></section>`;
    }
    function render() {
      const state=options.analysis.state(), own=options.own(),opponent=options.opponent(),delay=options.analysis.delay();
      const enough=own.team.filter(Boolean).length>=3 && opponent.team.some(Boolean);
      $('teamRolesAnalyze').disabled=!enough || state.phase==='running';
      $('teamRolesAnalyze').textContent=state.phase==='complete' ? 'Roles ready' : state.phase==='error' ? 'Retry role analysis' : 'Find roles & trios';
      $('teamRolesAnalyze').hidden=state.phase==='complete';
      $('teamRolesCancel').hidden=state.phase!=='running';
      $('teamRolesDelay').value=String(delay);
      $('teamRolesStatus').textContent=state.phase==='running' ? `Checking ${state.done}/${state.total}…` : state.phase==='error' ? state.error : state.phase==='complete' ? `Full HP · ${state.analysis.opponents.length} opponents` : enough ? 'Lead · switch · closer · 0 energy' : 'Add at least three Pokémon and an opponent team.';
      if(enough)$('teamTrioSuggestions').querySelector('summary').textContent='Suggested trios';
      const analysis=state.analysis;
      $('teamTrioSuggestionsList').hidden=state.phase==='complete' || state.phase==='running';
      if(state.phase!=='complete' || !analysis?.ready){$('teamRolesResults').innerHTML='';markup='';return;}
      const profile=slot=>analysis.profiles.find(p=>p.slot===slot),name=slot=>own.team[slot].name,enemyName=slot=>opponent.team[slot].name;
      const metric=(value,caption,condition)=>`<strong>${value}/${analysis.opponents.length}</strong><small>${caption}</small>${condition}`;
      const cards=analysis.suggestions.map((candidate,index)=>{
        const selected=options.trioIds().join(',')===candidate.slots.map(slot=>own.team[slot].pokemonId).join(',');
        const roles=[['Lead',candidate.lead,profile(candidate.lead).even1.wins,'wins',shields(1,1)],['Switch',candidate.switch,profile(candidate.switch).switch1.wins,'counter wins',shields(1,1,` · +${delay}t`)],['Closer',candidate.closer,profile(candidate.closer).closer.wins,'wins · +1 shield',shields(1,0)]];
        const caution=candidate.gaps.length ? `<div class="team-role-warning"><b>No winning answer · 1–1</b><span>${candidate.gaps.map(slot=>image(slot,'opponent')).join('')}</span></div>` : candidate.sole.length ? `<div class="team-role-warning"><b>Only one answer · 1–1</b>${answerPairs(candidate.sole,name,enemyName)}</div>` : '';
        const sameTrio=analysis.suggestions.slice(0,index).some(other=>[...other.slots].sort().join(',')===[...candidate.slots].sort().join(','));
        const strength=candidate.style==='Switch resilience' ? `${candidate.switchEven}/${candidate.total} counter matchups hold at all even shields` : candidate.style==='Shield closer' ? `${candidate.closerWins}/${candidate.total} closer wins with +1 shield` : `${candidate.backups}/${candidate.total} opponents have two or more answers`;
        const decision=`<div class="team-role-decision"><b>Best for</b><span>${escape(strength)}</span>${sameTrio ? '<small>Same three Pokémon · different roles</small>' : ''}</div>`;
        const risk=caution || (candidate.context?.reply.covered ? `<div class="team-role-warning"><b>Main risk · opposing answers</b><span>${candidate.context.reply.slots.map(slot=>image(slot,'opponent')).join('')}</span></div>` : candidate.uncoveredLead.length ? `<div class="team-role-warning"><b>Lead losses not recovered</b><span>${candidate.uncoveredLead.map(slot=>image(slot,'opponent')).join('')}</span></div>` : '<div class="team-role-reason"><b>No coverage gaps · 1–1</b></div>');
        const details=[['Lead',candidate.lead,'even1'],['Switch · new counter',candidate.switch,'switch1'],['Switch · foe stays',candidate.switch,'stay1'],['Closer',candidate.closer,'closer']].map(([label,slot,id])=>{
          const scene=root.PvPeakTeamRoles.scenarios(delay).find(s=>s.id===id);
          return `<div class="team-role-matchup-row"><b>${escape(name(slot))}<small>${label} · ${scene.a}–${scene.b}${id==='switch1' ? ` · +${delay}t` : scene.bankFoeFast ? ' · foe +1 Fast energy' : ''}</small></b>${analysis.opponents.map(enemy=>{
            const result=state.results.get(root.PvPeakTeamRoles.cellKey(slot,enemy,scene)),outcome=root.PvPeakTeamRoles.outcome(result),mark=outcome==='A' ? '✓' : outcome==='draw' ? '≈' : outcome==='B' ? '×' : '?';
            return `<button type="button" class="team-role-matchup is-${outcome}" data-role-battle="${slot}" data-role-opponent="${enemy}" data-role-scenario="${id}" aria-label="${escape(`${name(slot)} versus ${enemyName(enemy)}: ${outcome==='A' ? 'Win' : outcome==='B' ? 'Loss' : outcome==='draw' ? 'Draw' : 'Unresolved'}. Open Battle.`)}">${image(enemy,'opponent')}<span>${mark}</span></button>`;
          }).join('')}</div>`;
        }).join('');
        const farm=candidate.farm, switchProfile=profile(candidate.switch), strategic=contextDetails(candidate,name,enemyName);
        const scenarioRows=[['Lead',candidate.lead,['even1','even2']],['Switch',candidate.switch,['switch0','switch1','switch2']],['Closer',candidate.closer,['even0','closer']]].map(([role,slot,ids])=>`<div class="team-role-scenario-group"><b>${role}</b>${ids.map(id=>{
          const scene=root.PvPeakTeamRoles.scenarios(delay).find(s=>s.id===id),value=profile(slot)[id];
          return `<div><span>${scene.a}–${scene.b}${role==='Switch' ? ` · +${delay}t` : ''}</span><strong>${counts(value)}</strong>${role==='Switch' ? `<small>${value.evenUnbeaten}/${value.total} win/draw · no extra shields</small>` : ''}</div>`;
        }).join('')}</div>`).join('');
        return `<article class="team-role-trio${selected ? ' is-selected' : ''}"><header><b>${escape(candidate.style)}</b><span>Answers to ${candidate.covered}/${candidate.total} · 1–1</span></header><div class="team-role-lineup">${roles.map(([label,slot,value,caption,condition])=>`<div><small>${label}</small>${image(slot)}<b>${escape(name(slot))}</b>${metric(value,caption,condition)}</div>`).join('')}</div>${decision}${reliability(switchProfile,analysis.opponents,enemyName)}${route(candidate,name,enemyName)}<div class="team-role-warning team-role-lead-risk"${candidate.uncoveredLead.length ? '' : ' aria-hidden="true"'}>${candidate.uncoveredLead.length ? `<b>Foe +1 Fast · no switch win</b><span>${candidate.uncoveredLead.map(slot=>image(slot,'opponent')).join('')}</span>` : ''}</div>${risk}<button type="button" class="secondary" data-role-trio="${candidate.slots.join(',')}" aria-pressed="${selected}">${selected ? 'Selected trio ✓' : 'Use trio'}</button><details data-role-detail="trio-${index}"><summary>Why & matchups</summary><details data-role-detail="matchups-${index}"><summary>Role matchups · open in Battle</summary><div class="team-role-matchups">${details}</div><p>Tap a matchup to open the same scenario in Battle.</p></details>${strategic ? `<details data-role-detail="replies-${index}"><summary>Why this trio · opponent replies</summary>${strategic}</details>` : ''}<details data-role-detail="conditions-${index}"><summary>Conditions & results</summary><div class="team-role-scenarios">${scenarioRows}</div><p>New counter: zero starting energy with +${delay} turns of reaction delay. Staying lead: foe has one Fast move of energy, no delay, full HP and 1–1 shields. This energy check does not replay opening damage or cooldowns.</p><p>Switch reliability: win/draw against the same opponent at 0–0, 1–1 and 2–2 without using more shields. Closer wins at 1–0 require a shield advantage.</p>${candidate.uncoveredLead.length ? `<div class="team-role-warning"><b>Foe +1 Fast · no switch win</b><span>${candidate.uncoveredLead.map(slot=>image(slot,'opponent')).join('')}</span></div>` : ''}${switchProfile.flips.length ? `<div class="team-role-reason"><b>Wins gained · +${delay}t · 1–1</b><span>${switchProfile.flips.map(slot=>image(slot,'opponent')).join('')}</span></div>` : ''}${candidate.shared.length ? `<p>At least two members lose at 1–1: ${candidate.shared.map(slot=>escape(enemyName(slot))).join(' · ')}.</p>` : ''}${farm ? `<div class="team-role-farm"><b>Farm after a lead loss</b>${image(candidate.lead)}<span>→</span>${image(farm.opponentSlot,'opponent')}<span>→</span>${image(farm.slot)}<span><strong>+${farm.energyAfter}</strong> energy · ${farm.hpPercent}% HP</span></div><p>Lead matchup at 1–1. Safe Fast-only farm, no additional shield used. Opponent stays in.</p>` : ''}</details></details></article>`;
      }).join('');
      const leaders=analysis.leaders[selectedRole].map(p=>{
        const roleScenarios=selectedRole==='lead' ? ['even1','even2'] : selectedRole==='switch' ? ['switch0','switch1','switch2'] : ['even0','closer'];
        return `<div class="team-role-profile">${image(p.slot)}<b>${escape(name(p.slot))}${selectedRole==='switch' ? `<small>${p.switchStable.length}/${analysis.opponents.length} consistent · all three shield scenarios</small>` : ''}</b><div>${roleScenarios.map(id=>{
          const scenario=root.PvPeakTeamRoles.scenarios(delay).find(s=>s.id===id),value=p[id],clean=value.losses===0 && value.unresolved===0;
          return `<span class="${clean ? 'is-unbeaten' : ''}"><small>${scenario.a}–${scenario.b}${selectedRole==='switch' ? ` · +${delay}t` : ''}</small><strong>${counts(value)}</strong>${selectedRole==='switch' ? `<small>${value.evenUnbeaten}/${value.total} win/draw · no extra shields</small>` : ''}</span>`;
        }).join('')}</div></div>`;
      }).join('');
      const next=`<p class="team-role-scope">${analysis.opponentContext ? `All ${analysis.opponentContext.poolCount} opposing trios checked · ` : ''}Individual matchups · full HP</p>${opponentPanel(analysis.opponentContext,enemyName)}<div class="team-role-trios">${cards}</div><details class="team-role-leaders" data-role-detail="leaders"><summary>Best Pokémon by role</summary><div class="team-role-tabs" role="group" aria-label="Role">${['lead','switch','closer'].map(role=>`<button type="button" class="secondary" data-role-tab="${role}" aria-pressed="${role===selectedRole}">${role[0].toUpperCase()+role.slice(1)}</button>`).join('')}</div>${leaders}<p>W = win · D = draw · L = loss. Unresolved results are marked ?.</p></details>`;
      if(next===markup)return;
      const open=new Set(Array.from($('teamRolesResults').querySelectorAll('details[open][data-role-detail]')).map(e=>e.dataset.roleDetail));
      markup=next;$('teamRolesResults').innerHTML=next;
      $('teamRolesResults').querySelectorAll('details[data-role-detail]').forEach(e=>e.open=open.has(e.dataset.roleDetail));
      $('teamRolesResults').querySelectorAll('[data-role-sprite]').forEach(img=>{
        const member=(img.dataset.roleSide==='opponent' ? opponent : own).team[Number(img.dataset.roleSprite)];options.setSprite(img,member);img.title=member.name;
        if(img.closest('.team-role-reason,.team-role-warning,.team-role-farm,.team-role-route,.team-role-reliability,.team-role-options,.team-role-context')){img.removeAttribute('aria-hidden');img.alt=member.name;}
      });
    }
    $('teamRolesAnalyze').onclick=()=>options.analysis.start();
    $('teamRolesCancel').onclick=()=>options.analysis.cancel();
    $('teamRolesDelay').onchange=e=>options.analysis.setDelay(e.target.value);
    $('teamRolesResults').onclick=e=>{
      const tab=e.target.closest('[data-role-tab]');if(tab){selectedRole=tab.dataset.roleTab;render();$('teamRolesResults').querySelector(`[data-role-tab="${selectedRole}"]`)?.focus({preventScroll:true});}
      const trio=e.target.closest('[data-role-trio]');if(trio){options.useTrio(trio.dataset.roleTrio.split(',').map(Number));options.renderOpponent();render();}
      const battle=e.target.closest('[data-role-battle]');if(battle)options.battle(Number(battle.dataset.roleBattle),Number(battle.dataset.roleOpponent),battle.dataset.roleScenario);
    };
    return {render};
  }};
})(typeof globalThis!=='undefined' ? globalThis : this);
