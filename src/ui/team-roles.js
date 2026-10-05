(function (root) {
  'use strict';
  root.PvPeakTeamRolesUI={create(options) {
    const $=id=>document.getElementById(id),escape=options.escapeHtml;
    let selectedRole='switch',markup='';
    const detailViews=new Map();
    function showDetail(card,view,focus=false,expand=true) {
      const detail=card.querySelector('.team-role-detail');
      if(expand)detail.open=true;
      detailViews.set(detail.dataset.roleDetail,view);
      detail.querySelectorAll('[data-role-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.roleView===view)));
      detail.querySelectorAll('[data-role-panel]').forEach(panel=>panel.hidden=panel.dataset.rolePanel!==view);
      if(focus){detail.querySelector(`[data-role-view="${view}"]`)?.focus({preventScroll:true});detail.scrollIntoView({block:'nearest'});}
    }
    const image=(slot,side='own')=>`<img data-role-sprite="${slot}" data-role-side="${side}" alt="" aria-hidden="true">`;
    const counts=value=>`${value.wins}W · ${value.draws}D · ${value.losses}L${value.unresolved ? ` · ${value.unresolved}?` : ''}`;
    const shields=(a,b,extra='')=>`<span class="team-role-condition">${options.shieldSvg()}<span>${a}–${b}${extra}</span></span>`;
    function route(candidate,name,enemyName){
      const enemies=candidate.recovery;
      if(!enemies.length)return '';
      const label=`${name(candidate.lead)} loses to ${enemies.map(enemyName).join(', ')} at 1–1; ${name(candidate.switch)} wins an energy check with the opponent banking one Fast move of energy, full HP, no reaction delay and 1–1 shields. This is not a replay of the opening.`;
      return `<div class="team-role-route" aria-label="${escape(label)}"><div><small>Lead loses</small>${image(candidate.lead)}</div><span aria-hidden="true">→</span><div><small>Against</small><span>${enemies.slice(0,2).map(slot=>image(slot,'opponent')).join('')}${enemies.length>2 ? `<b>+${enemies.length-2}</b>` : ''}</span></div><span aria-hidden="true">→</span><div><small>Switch wins</small>${image(candidate.switch)}</div><small class="team-role-route-condition">Energy check · foe +1 Fast · 1–1</small></div>`;
    }
    function reliability(p,opponents,enemyName){
      const stable=p.testedSwitchStable || p.switchStable, tested=!!p.testedSwitchStable;
      const condition=tested ? 'Win/draw at all even shields without extra shields; no losing or extra-shield reply detected in the 1–1 check' : 'Win/draw at 0–0, 1–1 and 2–2 without extra shields';
      return `<div class="team-role-reliability"><div><b>Switch reliability</b><strong>${stable.length}/${opponents.length} hold</strong></div><div class="team-role-checks">${opponents.map(slot=>`<span class="${stable.includes(slot) ? 'is-safe' : 'is-conditional'}" title="${escape(enemyName(slot))}: ${stable.includes(slot) ? condition : 'Fails a baseline hold condition or has a tested losing/extra-shield reply'}">${image(slot,'opponent')}<b aria-hidden="true">${stable.includes(slot) ? '✓' : '!'}</b></span>`).join('')}</div><small>✓ 0–0, 1–1 & 2–2 · no extra shields${tested ? ' · tested 1–1 replies included' : ' · ! Varies'}</small></div>`;
    }
    function answerPairs(answers,name,enemyName){
      return `<div class="team-role-answer-pairs">${answers.map(answer=>`<span aria-label="${escape(`${name(answer.slot)} is the only winning answer to ${enemyName(answer.opponentSlot)} at 1–1`)}">${image(answer.opponentSlot,'opponent')}<span>→</span>${image(answer.slot)}</span>`).join('')}</div>`;
    }
    function opponentPanel(context,enemyName){
      if(!context)return '';
      return `<details class="team-role-options" data-role-detail="opponent-options"><summary>Opponent options · ${context.options.length} examples</summary><p>Strong options against your full roster. Model hypotheses, not predicted picks.</p><div>${context.options.map((option,index)=>`<article><b>Option ${index+1}</b><div class="team-role-option-lineup">${option.slots.map((slot,i)=>`<div><small>${['Lead','Switch','Closer'][i]}</small>${image(slot,'opponent')}<b>${escape(enemyName(slot))}</b></div>`).join('')}</div><span>${option.covered}/${option.total} of your roster answered · 1–1</span></article>`).join('')}</div><p>Recommendations check all ${context.poolCount} distinct opposing trios, including those not shown here.</p></details>`;
    }
    function counterLineup(candidate,index,name,enemyName) {
      const reply=candidate.context?.reply;if(!reply?.alignment)return '';
      const pairs=reply.alignment.answers;
      return `<details class="team-role-counter-lineup" data-role-detail="counter-${index}"><summary><b>Toughest opposing trio</b><span>${reply.slots.map(slot=>image(slot,'opponent')).join('')}</span></summary><div class="team-role-counter-pairs">${pairs.map((answer,i)=>`<div><small>vs your ${['Lead','Switch','Closer'][i]}</small><span aria-label="${escape(`${enemyName(answer.opponentSlot)} ${answer.outcome==='A' ? 'wins' : answer.outcome==='draw' ? 'draws' : 'loses'} versus ${name(answer.slot)} at 1–1`)}">${image(answer.opponentSlot,'opponent')}<b class="team-role-alignment-${answer.outcome}" aria-hidden="true">${answer.outcome==='A' ? '→' : answer.outcome==='draw' ? '≈' : '×'}</b>${image(answer.slot)}</span></div>`).join('')}</div><small>${reply.alignment.covered}/3 opposing wins in this alignment · 1–1</small><small>→ Opponent wins · ≈ Draw · × Opponent loses</small></details>`;
    }
    function contextDetails(candidate,name,enemyName){
      const context=candidate.context;if(!context)return '';
      const roleFloor=candidate.sensitivity ? context.testedRoleFloor : context.roleFloor;
      const switchFloor=candidate.sensitivity ? context.testedSwitchFloor : context.switchFloor;
      const closerFloor=candidate.sensitivity ? context.testedCloserFloor : context.closerFloor;
      return `<section class="team-role-context"><b>All ${context.poolCount} opposing combinations checked</b><small>At least ${context.coverageFloor}/3 opponents have a winning answer at 1–1. All three answered in ${context.fullyAnswered}/${context.poolCount} combinations.</small><b>Worst role counts across all combinations</b><small>All roles: at least ${roleFloor}/3 successes${candidate.sensitivity ? ' after tested replies' : ''} · reliable switch ${switchFloor}/3 · closer ${closerFloor}/3 with a shield advantage.</small>${context.counters.length ? `<b>Hard counters · roster trade-offs</b>${context.counters.map(counter=>`<div class="team-role-counter"><div>${image(counter.opponentSlot,'opponent')}<span>→</span>${image(counter.slot)}</div><small>${escape(enemyName(counter.opponentSlot))} beats ${escape(name(counter.slot))} clearly at 1–1.</small><span>${counter.strongRosterAnswers.length} strong answers in your roster</span><div>${counter.strongRosterAnswers.map(slot=>image(slot)).join('') || 'None'}</div><small>In ${counter.inOptions}/${context.cases.length} displayed examples. Still available as an opposing pick.</small></div>`).join('')}` : ''}</section>`;
    }
    function replyChecks(candidate,name,enemyName,delay){
      const value=candidate.sensitivity;
      if(!value)return '<p>Reply checks are incomplete; they did not change the ranking.</p>';
      const change=e=>e.kind==='shield' ? e.target.type==='shield' ? 'Shield' : 'Take the hit' : e.target.followMoveId ? `+${e.target.fastCount} Fast → ${options.moveName(e.target.followMoveId)}` : e.target.type==='fast_move' ? 'Fast + replan' : options.moveName(e.target.moveId);
      const label=id=>id==='closer' ? '1–0' : id==='switch1' ? `1–1 · +${delay}t` : id==='stay1' ? '1–1 · foe +1 Fast' : '1–1';
      const tiles=value.risks.map(risk=>`<button type="button" class="team-role-tested-reply" data-role-reply="${risk.slot}" data-role-opponent="${risk.opponentSlot}" data-role-scenario="${risk.scenario}" aria-label="${escape(`${name(risk.slot)} versus ${enemyName(risk.opponentSlot)}: view the tested alternative in Battle`)}"><div title="${escape(`${name(risk.slot)} versus ${enemyName(risk.opponentSlot)}`)}">${image(risk.slot)}<span>vs</span>${image(risk.opponentSlot,'opponent')}</div><small>Opponent choice · ${label(risk.scenario)}</small><b>T${risk.evidence.turn} · ${escape(change(risk.evidence))}</b><small>${risk.baselineOutcome==='draw' ? 'Draw → opponent can' : 'Opponent can'} ${risk.evidence.outcome==='draw' ? 'draw' : 'win'}${risk.evidence.dependency ? ' · depends on your shield' : ''}</small><span class="team-role-reply-link">View in Battle ↗</span></button>`);
      return `<p><strong>${candidate.covered-value.coverageRisks.length}/${candidate.total}</strong> opponents have an answer with no detected flip.</p><div class="team-role-tested-replies">${tiles.slice(0,6).join('')}</div>${tiles.length>6 ? `<details><summary>${tiles.length-6} more tested replies</summary><div class="team-role-tested-replies">${tiles.slice(6).join('')}</div></details>` : ''}`;
    }
    function render() {
      const state=options.analysis.state(), own=options.own(),opponent=options.opponent(),delay=options.analysis.delay();
      const enough=own.team.filter(Boolean).length>=3 && opponent.team.some(Boolean);
      $('teamRolesAnalyze').disabled=!enough || state.phase==='running';
      $('teamRolesAnalyze').textContent=state.phase==='complete' ? state.replyIncomplete ? 'Retry reply checks' : 'Roles ready' : state.phase==='error' ? 'Retry role analysis' : 'Find roles & trios';
      $('teamRolesAnalyze').hidden=state.phase==='complete' && !state.replyIncomplete;
      $('teamRolesCancel').hidden=state.phase!=='running';
      $('teamRolesDelay').value=String(delay);
      $('teamRolesStatus').textContent=state.phase==='running' ? `Matchups & replies · ${state.done}/${state.total}…${state.reused ? ` · ${state.reused} reused` : ''}` : state.phase==='error' ? state.error : state.phase==='complete' ? `Full HP · ${state.analysis.opponents.length} opponents${state.reused ? ` · ${state.reused} reused` : ''}${state.replyIncomplete ? ' · reply check incomplete' : ''}` : enough ? 'Lead · switch · closer · 0 energy' : 'Add at least three Pokémon and an opponent team.';
      if(enough)$('teamTrioSuggestions').querySelector('summary').textContent='Suggested trios';
      const analysis=state.analysis;
      $('teamTrioSuggestionsList').hidden=state.phase==='complete' || state.phase==='running';
      if(state.phase!=='complete' || !analysis?.ready){$('teamRolesResults').innerHTML='';markup='';return;}
      const profile=slot=>analysis.profiles.find(p=>p.slot===slot),name=slot=>own.team[slot].name,enemyName=slot=>opponent.team[slot].name;
      const metric=(value,caption,condition)=>`<strong>${value}/${analysis.opponents.length}</strong><small>${caption}</small>${condition}`;
      const cards=analysis.suggestions.map((candidate,index)=>{
        const selected=options.trioIds().join(',')===candidate.slots.map(slot=>own.team[slot].pokemonId).join(',');
        const roles=[['Lead',candidate.lead,profile(candidate.lead).even1.wins,'wins',shields(1,1)],['Switch',candidate.switch,(profile(candidate.switch).testedSwitchStable || profile(candidate.switch).switchStable).length,'hold · no extra shields',`<span class="team-role-condition" title="0–0, 1–1 and 2–2 shields; +${delay} turns reaction">${options.shieldSvg()}<span>Even · +${delay}t</span></span>`],['Closer',candidate.closer,profile(candidate.closer).closer.wins,'wins · +1 shield',shields(1,0)]];
        const caution=candidate.gaps.length ? `<div class="team-role-warning"><b>No winning answer · 1–1</b><span>${candidate.gaps.map(slot=>image(slot,'opponent')).join('')}</span></div>` : candidate.sole.length ? `<div class="team-role-warning"><b>Only one answer · 1–1</b>${answerPairs(candidate.sole,name,enemyName)}</div>` : '';
        const sameTrio=analysis.suggestions.slice(0,index).some(other=>[...other.slots].sort().join(',')===[...candidate.slots].sort().join(','));
        const switchHolds=candidate.sensitivity?.switchHolds ?? candidate.switchEven;
        const strength=candidate.style==='Switch resilience' ? `${switchHolds}/${candidate.total} hold at all even shields` : candidate.style==='Shield closer' ? `${candidate.closerWins}/${candidate.total} closer wins with +1 shield` : `${candidate.backups}/${candidate.total} covered by two or more answers`;
        const replyCount=candidate.sensitivity?.risks.length;
        const decision=`<div class="team-role-decision"><b>Advantage</b><span>${escape(strength)}</span>${sameTrio ? '<small>Same Pokémon · different roles</small>' : ''}</div>`;
        const risk=caution || (candidate.context?.reply.covered ? `<div class="team-role-warning"><b>Main risk · opposing answers</b><span>${candidate.context.reply.slots.map(slot=>image(slot,'opponent')).join('')}</span></div>` : candidate.uncoveredLead.length ? `<div class="team-role-warning"><b>Lead losses not recovered</b><span>${candidate.uncoveredLead.map(slot=>image(slot,'opponent')).join('')}</span></div>` : '<div class="team-role-reason"><b>No coverage gaps · 1–1</b></div>');
        const details=[['Lead',candidate.lead,'even1'],['Switch · new counter',candidate.switch,'switch1'],['Switch · foe stays',candidate.switch,'stay1'],['Closer',candidate.closer,'closer']].map(([label,slot,id])=>{
          const scene=root.PvPeakTeamRoles.scenarios(delay).find(s=>s.id===id);
          return {role:id==='even1' ? 'lead' : id==='closer' ? 'closer' : 'switch', markup:`<div class="team-role-matchup-row"><b>${escape(name(slot))}<small>${label} · ${scene.a}–${scene.b}${id==='switch1' ? ` · +${delay}t` : scene.bankFoeFast ? ' · foe +1 Fast energy' : ''}</small></b>${analysis.opponents.map(enemy=>{
            const result=state.results.get(root.PvPeakTeamRoles.cellKey(slot,enemy,scene)),outcome=root.PvPeakTeamRoles.outcome(result),mark=outcome==='A' ? '✓' : outcome==='draw' ? '≈' : outcome==='B' ? '×' : '?',fragile=root.PvPeakTeamRoles.sensitive(result);
            return `<button type="button" class="team-role-matchup is-${outcome}" data-role-battle="${slot}" data-role-opponent="${enemy}" data-role-scenario="${id}" aria-label="${escape(`${name(slot)} versus ${enemyName(enemy)}: ${outcome==='A' ? 'Win' : outcome==='B' ? 'Loss' : outcome==='draw' ? 'Draw' : 'Unresolved'}${fragile ? '; a tested reply can change this result' : ''}. Open Battle.`)}">${image(enemy,'opponent')}<span>${mark}${fragile ? '<small class="team-role-flip-mark"> !</small>' : ''}</span></button>`;
          }).join('')}</div>`};
        });
        const farm=candidate.farm, switchProfile=profile(candidate.switch), strategic=contextDetails(candidate,name,enemyName);
        const scenarioRows=[['Lead',candidate.lead,['even1','even2']],['Switch',candidate.switch,['switch0','switch1','switch2']],['Closer',candidate.closer,['even0','closer']]].map(([role,slot,ids])=>`<div class="team-role-scenario-group"><b>${role}</b>${ids.map(id=>{
          const scene=root.PvPeakTeamRoles.scenarios(delay).find(s=>s.id===id),value=profile(slot)[id];
          return `<div><span>${scene.a}–${scene.b}${role==='Switch' ? ` · +${delay}t` : ''}</span><strong>${counts(value)}</strong>${role==='Switch' ? `<small>${value.evenUnbeaten}/${value.total} win/draw · no extra shields</small>` : ''}</div>`;
        }).join('')}</div>`).join('');
        const riskSlots=candidate.gaps.length ? candidate.gaps : candidate.sole.length ? candidate.sole.map(answer=>answer.opponentSlot) : candidate.context?.reply.covered ? candidate.context.reply.slots : candidate.uncoveredLead;
        const riskLabel=candidate.gaps.length ? 'No winning answer' : candidate.sole.length ? 'Only one answer' : candidate.context?.reply.covered ? 'Opposing answers' : candidate.uncoveredLead.length ? 'Lead not recovered' : '';
        const preview=riskSlots.length ? `<span class="team-role-risk-enemies">${riskSlots.slice(0,2).map(slot=>image(slot,'opponent')).join('')}${riskSlots.length>2 ? `<small>+${riskSlots.length-2}</small>` : ''}</span>` : '';
        const riskSummary=riskLabel || (replyCount ? 'Tested replies can flip results' : 'No coverage gaps · 1–1');
        const riskButton=`<button type="button" class="team-role-risk-preview${riskSlots.length || replyCount ? ' has-risk' : ''}" aria-controls="team-role-details-${index}" data-role-open="${riskSlots.length ? 'plan' : replyCount ? 'replies' : 'plan'}"><span><b>${escape(riskSummary)}</b>${preview}${replyCount && riskSlots.length ? `<small>${replyCount} tested flip${replyCount===1 ? '' : 's'}</small>` : ''}${replyCount==null ? '<small>Reply check incomplete</small>' : ''}</span><span aria-hidden="true">›</span></button>`;
        const panel=(id,body)=>`<section class="team-role-detail-panel" data-role-panel="${id}" aria-label="${id[0].toUpperCase()+id.slice(1)} details"${id==='lead' ? '' : ' hidden'}>${body}</section>`;
        const rolePanels=['lead','switch','closer'].map(role=>panel(role,`${role==='switch' ? reliability(switchProfile,analysis.opponents,enemyName) : ''}<div class="team-role-matchups">${details.filter(row=>row.role===role).map(row=>row.markup).join('')}</div><p>Tap a matchup to open these conditions in Battle.</p>${role==='switch' ? route(candidate,name,enemyName) : ''}`)).join('');
        const plan=panel('plan',`${risk}${candidate.uncoveredLead.length ? `<div class="team-role-warning"><b>Foe +1 Fast · no switch win</b><span>${candidate.uncoveredLead.map(slot=>image(slot,'opponent')).join('')}</span></div>` : ''}${strategic}`);
        const conditions=panel('conditions',`<div class="team-role-scenarios">${scenarioRows}</div><p>New counter: zero starting energy with +${delay} turns of reaction delay. Staying lead: foe has one Fast move of energy, no delay, full HP and 1–1 shields. This energy check does not replay opening damage or cooldowns.</p><p>Switch hold: win/draw at 0–0, 1–1 and 2–2 without using more shields; tested 1–1 replies included when complete. Closer wins at 1–0 require a shield advantage.</p>${switchProfile.flips.length ? `<div class="team-role-reason"><b>Wins gained · +${delay}t · 1–1</b><span>${switchProfile.flips.map(slot=>image(slot,'opponent')).join('')}</span></div>` : ''}${candidate.shared.length ? `<p>At least two members lose at 1–1: ${candidate.shared.map(slot=>escape(enemyName(slot))).join(' · ')}.</p>` : ''}${farm ? `<div class="team-role-farm"><b>Farm after a lead loss</b>${image(candidate.lead)}<span>→</span>${image(farm.opponentSlot,'opponent')}<span>→</span>${image(farm.slot)}<span><strong>+${farm.energyAfter}</strong> energy · ${farm.hpPercent}% HP</span></div><p>Lead matchup at 1–1. Safe Fast-only farm, no additional shield used. Opponent stays in.</p>` : ''}`);
        return `<article class="team-role-trio${selected ? ' is-selected' : ''}"><header><b>${escape(candidate.style)}</b><span>Answers to ${candidate.covered}/${candidate.total} · 1–1</span></header><div class="team-role-lineup">${roles.map(([label,slot,value,caption,condition])=>`<button type="button" class="team-role-pick" data-role-open="${label.toLowerCase()}" aria-controls="team-role-details-${index}" aria-label="${escape(`${label}: ${name(slot)}, ${value}/${candidate.total} ${caption}${label==='Switch' ? ` at 0–0, 1–1 and 2–2, with ${delay} turns reaction` : label==='Lead' ? ' at 1–1 shields' : ' at 1–0 shields'}. Show matchups.`)}"><small>${label}</small>${image(slot)}<b>${escape(name(slot))}</b>${metric(value,caption,condition)}<span class="team-role-pick-action">Matchups ⌄</span></button>`).join('')}</div>${decision}${riskButton}${counterLineup(candidate,index,name,enemyName)}<button type="button" class="secondary" data-role-trio="${candidate.slots.join(',')}" aria-pressed="${selected}">${selected ? 'Selected trio ✓' : 'Use trio'}</button><details class="team-role-detail" id="team-role-details-${index}" data-role-detail="trio-${index}"><summary>Matchups & details</summary><div class="team-role-detail-tabs" role="group" aria-label="Trio details">${['lead','switch','closer','plan','replies','conditions'].map(view=>`<button type="button" data-role-view="${view}" aria-pressed="${view==='lead'}">${view[0].toUpperCase()+view.slice(1)}${view==='replies' && replyCount ? ` · ${replyCount}` : ''}</button>`).join('')}</div>${rolePanels}${plan}${panel('replies',replyChecks(candidate,name,enemyName,delay))}${conditions}</details></article>`;
      }).join('');
      const leaders=analysis.leaders[selectedRole].map(p=>{
        const roleScenarios=selectedRole==='lead' ? ['even1','even2'] : selectedRole==='switch' ? ['switch0','switch1','switch2'] : ['even0','closer'];
        return `<div class="team-role-profile">${image(p.slot)}<b>${escape(name(p.slot))}${selectedRole==='switch' ? `<small>${(p.testedSwitchStable || p.switchStable).length}/${analysis.opponents.length} hold · ${p.testedSwitchStable ? 'tested replies included' : 'all even shields'}</small>` : ''}</b><div>${roleScenarios.map(id=>{
          const scenario=root.PvPeakTeamRoles.scenarios(delay).find(s=>s.id===id),value=p[id],clean=value.losses===0 && value.unresolved===0;
          return `<span class="${clean ? 'is-unbeaten' : ''}"><small>${scenario.a}–${scenario.b}${selectedRole==='switch' ? ` · +${delay}t` : ''}</small><strong>${counts(value)}</strong>${selectedRole==='switch' ? `<small>${value.evenUnbeaten}/${value.total} win/draw · no extra shields</small>` : ''}</span>`;
        }).join('')}</div></div>`;
      }).join('');
      const next=`<p class="team-role-scope">${analysis.opponentContext ? `All ${analysis.opponentContext.poolCount} opposing trios checked · ` : ''}Individual matchups · full HP · 0 energy</p><div class="team-role-trios">${cards}</div>${opponentPanel(analysis.opponentContext,enemyName)}<details class="team-role-leaders" data-role-detail="leaders"><summary>Best Pokémon by role</summary><div class="team-role-tabs" role="group" aria-label="Role">${['lead','switch','closer'].map(role=>`<button type="button" class="secondary" data-role-tab="${role}" aria-pressed="${role===selectedRole}">${role[0].toUpperCase()+role.slice(1)}</button>`).join('')}</div>${leaders}<p>W = win · D = draw · L = loss. Unresolved results are marked ?.</p></details>`;
      if(next===markup)return;
      const open=new Set(Array.from($('teamRolesResults').querySelectorAll('details[open][data-role-detail]')).map(e=>e.dataset.roleDetail));
      markup=next;$('teamRolesResults').innerHTML=next;
      $('teamRolesResults').querySelectorAll('details[data-role-detail]').forEach(e=>e.open=open.has(e.dataset.roleDetail));
      $('teamRolesResults').querySelectorAll('.team-role-detail').forEach(detail=>showDetail(detail.closest('.team-role-trio'),detailViews.get(detail.dataset.roleDetail) || 'lead',false,false));
      $('teamRolesResults').querySelectorAll('[data-role-sprite]').forEach(img=>{
        const member=(img.dataset.roleSide==='opponent' ? opponent : own).team[Number(img.dataset.roleSprite)];options.setSprite(img,member);img.title=member.name;
        if(img.closest('.team-role-counter-lineup,.team-role-risk-preview,.team-role-reason,.team-role-warning,.team-role-farm,.team-role-route,.team-role-reliability,.team-role-options,.team-role-context')){img.removeAttribute('aria-hidden');img.alt=member.name;}
      });
    }
    $('teamRolesAnalyze').onclick=()=>options.analysis.start();
    $('teamRolesCancel').onclick=()=>options.analysis.cancel();
    $('teamRolesDelay').onchange=e=>options.analysis.setDelay(e.target.value);
    $('teamRolesResults').onclick=e=>{
      const tab=e.target.closest('[data-role-tab]');if(tab){selectedRole=tab.dataset.roleTab;render();$('teamRolesResults').querySelector(`[data-role-tab="${selectedRole}"]`)?.focus({preventScroll:true});}
      const trio=e.target.closest('[data-role-trio]');if(trio){options.useTrio(trio.dataset.roleTrio.split(',').map(Number));options.renderOpponent();render();}
      const battle=e.target.closest('[data-role-battle]');if(battle)options.battle(Number(battle.dataset.roleBattle),Number(battle.dataset.roleOpponent),battle.dataset.roleScenario);
      const view=e.target.closest('[data-role-view]');if(view)showDetail(view.closest('.team-role-trio'),view.dataset.roleView);
      const trigger=e.target.closest('[data-role-open]');if(trigger)showDetail(trigger.closest('.team-role-trio'),trigger.dataset.roleOpen,true);
      const reply=e.target.closest('[data-role-reply]');if(reply){
        const slot=Number(reply.dataset.roleReply),enemy=Number(reply.dataset.roleOpponent),scenario=root.PvPeakTeamRoles.scenarios(options.analysis.delay()).find(s=>s.id===reply.dataset.roleScenario);
        const cell=options.analysis.state().results.get(root.PvPeakTeamRoles.cellKey(slot,enemy,scenario));
        if(cell?.sensitivity?.status==='sensitive')options.battle(slot,enemy,scenario.id,cell.sensitivity.evidence);
      }
    };
    return {render};
  }};
})(typeof globalThis!=='undefined' ? globalThis : this);
