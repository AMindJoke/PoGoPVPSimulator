(function (root) {
  'use strict';
  root.PvPeakTeamRolesUI={create(options) {
    const $=id=>document.getElementById(id),escape=options.escapeHtml;
    let selectedRole='switch',markup='';
    const image=(slot,side='own')=>`<img data-role-sprite="${slot}" data-role-side="${side}" alt="" aria-hidden="true">`;
    const counts=value=>`${value.wins}W · ${value.draws}D · ${value.losses}L${value.unresolved ? ` · ${value.unresolved}?` : ''}`;
    function render() {
      const state=options.analysis.state(), own=options.own(),opponent=options.opponent(),delay=options.analysis.delay();
      const enough=own.team.filter(Boolean).length>=3 && opponent.team.some(Boolean);
      $('teamRolesAnalyze').disabled=!enough || state.phase==='running';
      $('teamRolesAnalyze').textContent=state.phase==='complete' ? 'Roles ready' : state.phase==='error' ? 'Retry role analysis' : 'Find roles & trios';
      $('teamRolesAnalyze').hidden=state.phase==='complete';
      $('teamRolesCancel').hidden=state.phase!=='running';
      $('teamRolesDelay').value=String(delay);
      $('teamRolesStatus').textContent=state.phase==='running' ? `Checking ${state.done}/${state.total}…` : state.phase==='error' ? state.error : state.phase==='complete' ? `Full HP · 0 energy · ${state.analysis.opponents.length} opponents` : enough ? 'Lead · switch · closer · 0 energy' : 'Add at least three Pokémon and an opponent team.';
      if(enough)$('teamTrioSuggestions').querySelector('summary').textContent='Suggested trios';
      const analysis=state.analysis;
      $('teamTrioSuggestionsList').hidden=state.phase==='complete';
      if(state.phase!=='complete' || !analysis?.ready){$('teamRolesResults').innerHTML='';markup='';return;}
      const profile=slot=>analysis.profiles.find(p=>p.slot===slot),name=slot=>own.team[slot].name,enemyName=slot=>opponent.team[slot].name;
      const metric=(value,caption)=>`<strong>${value.wins}/${value.total}</strong><small>${caption}</small>`;
      const cards=analysis.suggestions.map((candidate,index)=>{
        const selected=options.trioIds().join(',')===candidate.slots.map(slot=>own.team[slot].pokemonId).join(',');
        const roles=[['Lead',candidate.lead,'even1','wins · 1–1'],['Switch',candidate.switch,'switch1',`wins · 1–1 · +${delay}t`],['Closer',candidate.closer,'closer','wins · 1–0']];
        const why=candidate.recovery.length ? `<div class="team-role-reason"><b>Switch covers lead losses</b><span>${candidate.recovery.map(slot=>image(slot,'opponent')).join('')}</span></div>` : candidate.leadLosses.length ? `<div class="team-role-warning"><b>Lead loss without switch win</b><span>${candidate.leadLosses.map(slot=>image(slot,'opponent')).join('')}</span></div>` : `<div class="team-role-reason"><b>Lead unbeaten · 1–1</b><span>${counts(profile(candidate.lead).even1)}</span></div>`;
        const caution=candidate.gaps.length ? `<div class="team-role-warning"><b>No winning answer · 1–1</b><span>${candidate.gaps.map(slot=>image(slot,'opponent')).join('')}</span></div>` : candidate.sole.length ? `<div class="team-role-warning"><b>Single answer · ${candidate.sole.length}/${candidate.total}</b><span>${[...new Set(candidate.sole.map(x=>x.opponentSlot))].map(slot=>image(slot,'opponent')).join('')}</span></div>` : '';
        const details=candidate.slots.map((slot,roleIndex)=>{
          const p=profile(slot),role=['lead','switch','closer'][roleIndex],id=role==='lead' ? 'even1' : role==='switch' ? 'switch1' : 'closer',scene=root.PvPeakTeamRoles.scenarios(delay).find(s=>s.id===id);
          return `<div class="team-role-matchup-row"><b>${escape(name(slot))}</b>${analysis.opponents.map(enemy=>{
            const result=state.results.get(root.PvPeakTeamRoles.cellKey(slot,enemy,scene)),outcome=root.PvPeakTeamRoles.outcome(result),mark=outcome==='A' ? '✓' : outcome==='draw' ? '≈' : outcome==='B' ? '×' : '?';
            return `<button type="button" class="team-role-matchup is-${outcome}" data-role-battle="${slot}" data-role-opponent="${enemy}" data-role-scenario="${id}" aria-label="${escape(`${name(slot)} versus ${enemyName(enemy)}: ${outcome==='A' ? 'Win' : outcome==='B' ? 'Loss' : outcome==='draw' ? 'Draw' : 'Unresolved'}. Open Battle.`)}">${image(enemy,'opponent')}<span>${mark}</span></button>`;
          }).join('')}</div>`;
        }).join('');
        const farm=candidate.farm;
        return `<article class="team-role-trio${selected ? ' is-selected' : ''}"><header><b>${escape(candidate.style)}</b><span>${candidate.covered}/${candidate.total} covered · 1–1</span></header><div class="team-role-lineup">${roles.map(([label,slot,id,caption])=>`<div><small>${label}</small>${image(slot)}<b>${escape(name(slot))}</b>${metric(profile(slot)[id],caption)}</div>`).join('')}</div>${why}${caution}<details data-role-detail="trio-${index}"><summary>Why & matchups</summary><p>Lead: ${counts(profile(candidate.lead).even1)} at 1–1 · ${counts(profile(candidate.lead).even2)} at 2–2.</p><p>Switch: ${counts(profile(candidate.switch).switch1)} at 1–1 with +${delay} turns. ${profile(candidate.switch).switch1.evenSpend}/${candidate.total} wins without spending more shields. ${profile(candidate.switch).flips.length} wins gained from the reaction delay.</p><p>Closer: ${counts(profile(candidate.closer).closer)} at 1–0 · ${counts(profile(candidate.closer).even0)} at 0–0.</p>${candidate.sole.length ? `<p>Only winning answer at 1–1: ${candidate.sole.map(x=>`${escape(name(x.slot))} → ${escape(enemyName(x.opponentSlot))}`).join(' · ')}.</p>` : ''}${candidate.shared.length ? `<p>At least two members lose at 1–1: ${candidate.shared.map(slot=>escape(enemyName(slot))).join(' · ')}.</p>` : ''}${farm ? `<div class="team-role-farm"><b>Farm after a lead loss</b>${image(candidate.lead)}<span>→</span>${image(farm.opponentSlot,'opponent')}<span>→</span>${image(farm.slot)}<span><strong>+${farm.energyAfter}</strong> energy · ${farm.hpPercent}% HP</span></div><p>Lead matchup at 1–1. Safe Fast-only farm, no additional shield used. Opponent stays in.</p>` : ''}<div class="team-role-matchups">${details}</div><p>Tap a matchup to open the same scenario in Battle.</p></details><button type="button" class="secondary" data-role-trio="${candidate.slots.join(',')}" aria-pressed="${selected}">${selected ? 'Selected trio ✓' : 'Use trio'}</button></article>`;
      }).join('');
      const leaders=analysis.leaders[selectedRole].map(p=>{
        const roleScenarios=selectedRole==='lead' ? ['even1','even2'] : selectedRole==='switch' ? ['switch0','switch1','switch2'] : ['even0','closer'];
        return `<div class="team-role-profile">${image(p.slot)}<b>${escape(name(p.slot))}</b><div>${roleScenarios.map(id=>{
          const scenario=root.PvPeakTeamRoles.scenarios(delay).find(s=>s.id===id),value=p[id],clean=value.losses===0 && value.unresolved===0;
          return `<span class="${clean ? 'is-unbeaten' : ''}"><small>${scenario.a}–${scenario.b}${selectedRole==='switch' ? ` · +${delay}t` : ''}</small><strong>${counts(value)}</strong>${selectedRole==='switch' ? `<small>${value.evenUnbeaten}/${value.total} unbeaten · even spend</small>` : ''}</span>`;
        }).join('')}</div></div>`;
      }).join('');
      const next=`<div class="team-role-trios">${cards}</div><details class="team-role-leaders" data-role-detail="leaders"><summary>Best Pokémon by role</summary><div class="team-role-tabs" role="group" aria-label="Role">${['lead','switch','closer'].map(role=>`<button type="button" class="secondary" data-role-tab="${role}" aria-pressed="${role===selectedRole}">${role[0].toUpperCase()+role.slice(1)}</button>`).join('')}</div>${leaders}<p>W = win · D = draw · L = loss. Unresolved results are marked ?.</p></details>`;
      if(next===markup)return;
      const open=new Set(Array.from($('teamRolesResults').querySelectorAll('details[open][data-role-detail]')).map(e=>e.dataset.roleDetail));
      markup=next;$('teamRolesResults').innerHTML=next;
      $('teamRolesResults').querySelectorAll('details[data-role-detail]').forEach(e=>e.open=open.has(e.dataset.roleDetail));
      $('teamRolesResults').querySelectorAll('[data-role-sprite]').forEach(img=>{
        const member=(img.dataset.roleSide==='opponent' ? opponent : own).team[Number(img.dataset.roleSprite)];options.setSprite(img,member);img.title=member.name;
        if(img.closest('.team-role-reason,.team-role-warning,.team-role-farm')){img.removeAttribute('aria-hidden');img.alt=member.name;}
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
