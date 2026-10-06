(function(root){
  'use strict';
  root.PvPeakTeamWorkspace={create(options){
    const $=id=>document.getElementById(id),escape=options.escapeHtml;
    const workspace=$('teamOpponentPanel').querySelector('.team-trio');
    workspace.id='teamAnalysisWorkspace';workspace.dataset.workspaceView='trios';
    let view='trios',preview=null,baselineSlot=null,ownTouched=false,setupTouched=false,mode='meta',modeTouched=false;
    const selectionKey='pogo-pvp-team-workspace-lineup-v1';let savedSelection=null;
    const switchViews=new Map();
    try{savedSelection=JSON.parse(localStorage.getItem(selectionKey));}catch(_){}
    const fingerprint=()=>JSON.stringify([options.own().league,options.own().team,options.opponent().team]);
    const node=(tag,id,markup)=>{const el=document.createElement(tag);if(id)el.id=id;if(markup)el.innerHTML=markup;return el;};
    const nav=node('nav','teamWorkspaceNav',['trios','matchups','farm'].map((id,i)=>`<button type="button" data-workspace-view="${id}" aria-controls="teamWorkspace${id}" aria-pressed="${i===0}">${['Which three?','Matchups','Farm'][i]}</button>`).join(''));nav.setAttribute('aria-label','Team analysis');
    $('teamTrioTitle').textContent='Prepare your trio';
    const setup=node('details','teamWorkspaceSetup','<summary>Opponent & comparison conditions</summary>');
    const opponent=$('teamOpponentPanel');
    [opponent.querySelector('.team-opponent-toolbar'),$('teamOpponentRoster'),opponent.querySelector('.team-opponent-controls'),opponent.querySelector('.team-opponent-energy'),$('teamOpponentStatus')].forEach(el=>setup.append(el));
    workspace.querySelector('header').after(setup);setup.after(nav);
    const current=node('div','teamWorkspaceCurrent');setup.before(current);
    const panels={};['trios','matchups','farm'].forEach(id=>{panels[id]=node('section','teamWorkspace'+id);panels[id].className='team-workspace-panel';panels[id].setAttribute('aria-label',id==='trios'?'Suggested trios':id==='matchups'?'Trio matchups':'Farm after a loss');workspace.append(panels[id]);});
    const manual=node('details','teamWorkspaceManual','<summary>Choose your own trio</summary>');manual.append($('teamTrioPicker'),$('teamTrioSummary'));
    panels.trios.append($('teamTrioSuggestions'));current.after(manual);$('teamTrioSuggestions').open=true;
    const baseline=node('div','teamWorkspaceBaseline');panels.matchups.append(baseline);
    const roster=node('details','teamWorkspaceRoster','<summary>Full roster matchup matrix</summary>');roster.append($('teamOpponentResults'));panels.matchups.append(roster);
    const farmEmpty=node('p','teamWorkspaceFarmEmpty');panels.farm.append(farmEmpty,$('teamTrioFarm'));$('teamTrioFarm').open=true;
    const farmPrepare=node('div','teamWorkspaceFarmPrepare','<button type="button">Prepare comparison matchups</button>');farmEmpty.after(farmPrepare);
    farmPrepare.querySelector('button').onclick=()=>$('teamOpponentAnalyze').click();
    const ownSetup=node('details','teamWorkspaceOwnSetup','<summary>Your team · edit Pokémon & moves</summary>');$('teamBuilderRoster').before(ownSetup);ownSetup.append($('teamBuilderRoster'));
    const metaTools=node('details','teamWorkspaceMetaTools','<summary>Against the Meta</summary>');
    const metaSiblings=[];for(let next=opponent.nextElementSibling;next;next=next.nextElementSibling)metaSiblings.push(next);
    opponent.after(metaTools);metaSiblings.forEach(el=>metaTools.append(el));
    const modes=node('div','teamWorkspaceModes');opponent.before(modes);
    const modeTabs=node('div','teamWorkspaceModeTabs',['team','meta'].map((id,i)=>`<button type="button" id="teamMode-${id}" role="tab" data-analysis-mode="${id}" aria-controls="${i===0?'teamOpponentPanel':'teamWorkspaceMetaTools'}" aria-selected="false"><b>${i===0?'Against a team':'Against the Meta'}</b><span>${i===0?'Choose a trio & plan your matchups':'Check coverage & improve your six'}</span></button>`).join(''));modeTabs.setAttribute('role','tablist');modeTabs.setAttribute('aria-label','Choose your analysis');
    modes.append(modeTabs,opponent,metaTools);
    [opponent,metaTools].forEach((panel,i)=>{panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',`teamMode-${i===0?'team':'meta'}`);panel.open=true;});
    const teamIntro=node('div',null,'<h3>Prepare your trio</h3><p>Add the opposing team, then explore trios, matchups and farm routes.</p>');teamIntro.className='team-workspace-intro';opponent.querySelector(':scope > summary').after(teamIntro);
    workspace.querySelector('header').hidden=true;
    const metaIntro=node('div',null,'<h3>Test your team against the Meta</h3><p>Choose the field and shields, then prepare matchups to see your coverage.</p>');metaIntro.className='team-workspace-intro';metaTools.querySelector('summary').after(metaIntro);
    $('teamMetaTitle').textContent='Conditions';
    function selectMode(next,focus=false){mode=next;modeTouched=true;sync();if(focus)modeTabs.querySelector(`[data-analysis-mode="${mode}"]`).focus({preventScroll:true});}
    modeTabs.onclick=e=>{const button=e.target.closest('[data-analysis-mode]');if(button)selectMode(button.dataset.analysisMode);};
    modeTabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();selectMode(e.key==='Home'?'team':e.key==='End'?'meta':mode==='team'?'meta':'team',true);};
    const results=$('teamRolesResults');
    const selectedSlots=()=>options.trioIds().map(id=>options.own().team.findIndex(member=>member?.pokemonId===id)).filter(slot=>slot>=0);
    const sprite=(member,slot)=>`<img data-workspace-sprite="${slot}" alt="${escape(member.name)}">`;
    function show(next,focus=false){view=next;workspace.dataset.workspaceView=next;sync();if(focus){nav.querySelector(`[data-workspace-view="${next}"]`).focus({preventScroll:true});nav.scrollIntoView({block:'nearest'});}}
    function showMatchups(index,role='lead',selected=false){preview=options.rolesState().analysis?.suggestions[index]?.slots.map(slot=>options.own().team[slot]?.pokemonId).join(',')||null;if(selected&&preview){savedSelection={ids:preview,source:fingerprint()};try{localStorage.setItem(selectionKey,JSON.stringify(savedSelection));}catch(_){}}show('matchups');options.rolesUI().show(index,role);nav.scrollIntoView({block:'nearest'});}
    function baselineMarkup(slots){
      const rows=options.rows(),own=options.own(),enemy=options.opponent();
      if(!slots.includes(baselineSlot))baselineSlot=slots[0];
      if(slots.length!==3)return '<p>Choose a trio in Which three? to view its matchups.</p>';
      const member=own.team[baselineSlot];
      return `<div class="team-workspace-baseline-head"><b>Your trio · comparison matchups</b><small>Roles not assigned · use a suggested trio for role checks</small></div><div class="team-workspace-members">${slots.map(slot=>`<button type="button" data-workspace-slot="${slot}" aria-pressed="${slot===baselineSlot}">${sprite(own.team[slot],slot)}<b>${escape(own.team[slot].name)}</b></button>`).join('')}</div><div class="team-workspace-comparison"><b>${escape(member.name)}</b><small>Shields ${enemy.shields?.A??1}–${enemy.shields?.B??1} · energy ${enemy.energy?.A||0}/${enemy.energy?.B||0}</small></div><div class="team-role-matchup-row">${rows.map(row=>{const result=row.cells[baselineSlot];return `<button type="button" class="team-role-matchup" data-workspace-battle="${baselineSlot}" data-workspace-opponent="${row.slot}"${result?'':' disabled'} aria-label="${escape(`${member.name} versus ${row.member.name}: ${result?options.resultLabel(result):'Not calculated'}. Open Battle.`)}"><img data-workspace-enemy="${row.slot}" alt=""><small class="team-role-matchup-name">${escape(row.member.name)}</small>${result?options.resultMarkup(result):'<span>?</span>'}</button>`;}).join('')}</div>${rows.some(row=>!row.cells[baselineSlot])?'<p>Prepare comparison matchups in Opponent & comparison conditions.</p>':''}`;
    }
    function sync(){
      const own=options.own(),enemy=options.opponent(),slots=selectedSlots();
      const state=options.rolesState(),candidates=state.analysis?.ready&&state.phase==='complete'?state.analysis.suggestions:[];
      const actual=options.trioIds().join(',');
      const sameMembers=(a,b)=>a.split(',').sort().join(',')===b.split(',').sort().join(',');
      const assigned=savedSelection?.source===fingerprint()&&typeof savedSelection.ids==='string'&&sameMembers(savedSelection.ids,actual)?savedSelection.ids:actual;
      const chosen=candidates.findIndex(c=>c.slots.map(slot=>own.team[slot]?.pokemonId).join(',')===(preview||assigned));
      if(preview&&chosen<0)preview=null;
      const active=chosen>=0?chosen:candidates.findIndex(c=>c.slots.map(slot=>own.team[slot]?.pokemonId).join(',')===assigned);
      panels.trios.hidden=view!=='trios';panels.matchups.hidden=view!=='matchups';panels.farm.hidden=view!=='farm';
      nav.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.workspaceView===view)));
      const shownSlots=view==='matchups'&&active>=0?candidates[active].slots:assigned.split(',').map(id=>own.team.findIndex(member=>member?.pokemonId===id)).filter(slot=>slot>=0);
      current.innerHTML=`<div><small>${view==='matchups'&&preview&&preview!==assigned?'Preview trio':'Your trio'}</small><span>${shownSlots.map(slot=>`<span class="team-workspace-member">${sprite(own.team[slot],slot)}<b>${escape(own.team[slot].name)}</b></span>`).join('')||'<span class="team-workspace-no-trio">Choose three Pokémon from your team</span>'}</span></div><button type="button" data-workspace-change>${shownSlots.length===3?'Change trio':'Choose trio'}</button>`;
      manual.hidden=view!=='trios';manual.open=view==='trios';
      if(view==='matchups')panels.matchups.insertBefore(results,baseline);else $('teamTrioSuggestions').querySelector('.team-role-controls').after(results);
      results.querySelectorAll('.team-role-trio').forEach((card,index)=>{card.hidden=view==='farm'||view==='matchups'&&index!==active;});
      results.querySelectorAll('.team-role-trio').forEach((card,index)=>{
        const selected=candidates[index].slots.map(slot=>own.team[slot]?.pokemonId).join(',')===assigned;
        card.classList.toggle('is-selected',selected);const use=card.querySelector('[data-role-trio]');use.setAttribute('aria-pressed',String(selected));use.textContent=selected?'Selected trio ✓':'Use trio';
        const detail=card.querySelector('.team-role-detail');
        card.querySelector('.team-role-lineup').after(detail);
        if(!detail.querySelector('.team-workspace-more')){
          const more=node('details',null,'<summary>Plan & analysis details</summary>');more.className='team-workspace-more';more.dataset.roleDetail=`more-${index}`;
          more.append(detail.querySelector('.team-role-detail-tabs'));
          ['plan','replies','conditions'].forEach(id=>more.append(detail.querySelector(`[data-role-panel="${id}"]`)));detail.append(more);
        }
        const switchPanel=detail.querySelector('[data-role-panel="switch"]');
        if(!switchPanel.querySelector('.team-workspace-switch-tabs')){
          const rows=[...switchPanel.querySelectorAll('.team-role-matchup-row')],key=candidates[index].slots.join(',');
          const controls=node('div',null,`<button type="button" data-switch-case="0">New counter · +${options.delay()}t</button><button type="button" data-switch-case="1">Opponent stays</button>`);controls.className='team-workspace-switch-tabs';controls.setAttribute('role','group');controls.setAttribute('aria-label','Switch opponent response');
          const apply=which=>{rows.forEach((row,i)=>row.hidden=i!==which);controls.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.switchCase)===which)));};
          controls.onclick=e=>{const button=e.target.closest('[data-switch-case]');if(button){const which=Number(button.dataset.switchCase);switchViews.set(key,which);apply(which);}};
          switchPanel.querySelector('.team-role-matchups').before(controls);apply(switchViews.get(key)||0);
          const reliability=switchPanel.querySelector('.team-role-reliability');
          const checks=node('details',null,`<summary>Across even shields · ${escape(reliability.querySelector('strong').textContent)}</summary>`);checks.dataset.roleDetail=`shields-${index}`;checks.append(reliability);switchPanel.append(checks);
          const route=switchPanel.querySelector('.team-role-route');if(route){const recovery=node('details',null,'<summary>After a lead loss</summary>');recovery.dataset.roleDetail=`recovery-${index}`;recovery.append(route);switchPanel.append(recovery);}
        }
      });
      baseline.hidden=view!=='matchups'||active>=0;
      if(!baseline.hidden){baseline.innerHTML=baselineMarkup(slots);baseline.querySelectorAll('[data-workspace-enemy]').forEach(img=>options.setSprite(img,enemy.team[Number(img.dataset.workspaceEnemy)]));}
      if(view==='matchups'&&active>=0){const card=results.querySelectorAll('.team-role-trio')[active];card.querySelector('.team-role-detail').open=true;}
      farmEmpty.hidden=slots.length===3;farmEmpty.textContent='Choose three Pokémon in Which three? to check farm routes.';
      const rows=options.rows(),prepared=slots.length===3&&rows.length&&rows.every(row=>slots.every(slot=>!!row.cells[slot]));
      farmPrepare.hidden=slots.length!==3||!!prepared;farmPrepare.querySelector('button').disabled=$('teamOpponentAnalyze').disabled;
      farmPrepare.querySelector('button').textContent=$('teamOpponentCancel').hidden?'Prepare comparison matchups':'Preparing matchups…';
      const comparison=$('teamWorkspaceFarmConditions')||node('p','teamWorkspaceFarmConditions');
      if(!comparison.parentElement)farmPrepare.after(comparison);
      comparison.textContent=`Comparison · shields ${enemy.shields?.A??1}–${enemy.shields?.B??1} · energy ${enemy.energy?.A||0}/${enemy.energy?.B||0}`;comparison.hidden=slots.length!==3;
      current.querySelectorAll('[data-workspace-sprite]').forEach(img=>options.setSprite(img,own.team[Number(img.dataset.workspaceSprite)]));
      baseline.querySelectorAll('[data-workspace-sprite]').forEach(img=>options.setSprite(img,own.team[Number(img.dataset.workspaceSprite)]));
      if(!ownTouched)ownSetup.open=true;if(!setupTouched)setup.open=!enemy.team.some(Boolean);
      if(!own.team.some(Boolean))ownSetup.open=true;if(!enemy.team.some(Boolean))setup.open=true;
      if(!modeTouched)mode=enemy.team.some(Boolean)?'team':'meta';
      modes.dataset.analysisMode=mode;opponent.open=true;metaTools.open=true;opponent.hidden=mode!=='team';metaTools.hidden=mode!=='meta';
      modeTabs.querySelectorAll('[data-analysis-mode]').forEach(button=>{const selected=button.dataset.analysisMode===mode;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
    }
    nav.onclick=e=>{const button=e.target.closest('[data-workspace-view]');if(button)show(button.dataset.workspaceView);};
    ownSetup.addEventListener('click',()=>ownTouched=true);setup.addEventListener('click',()=>setupTouched=true);
    current.onclick=e=>{if(e.target.closest('[data-workspace-change]')){preview=null;show('trios',true);manual.open=true;manual.scrollIntoView({block:'nearest'});}};
    baseline.onclick=e=>{const pick=e.target.closest('[data-workspace-slot]');if(pick){baselineSlot=Number(pick.dataset.workspaceSlot);sync();baseline.querySelector(`[data-workspace-slot="${baselineSlot}"]`).focus({preventScroll:true});}const battle=e.target.closest('[data-workspace-battle]');if(battle)options.battle(Number(battle.dataset.workspaceBattle),Number(battle.dataset.workspaceOpponent));};
    function inspect(data){
      const state=options.rolesState(),scenario=root.PvPeakTeamRoles.scenarios(options.delay()).find(s=>s.id===data.scenario);
      const result=state.results.get(root.PvPeakTeamRoles.cellKey(data.slot,data.enemy,scenario));if(!result)return;
      const own=options.own().team[data.slot],enemy=options.opponent().team[data.enemy];
      let dialog=$('teamWorkspaceMatchupDialog');if(!dialog){dialog=node('dialog','teamWorkspaceMatchupDialog');dialog.className='team-workspace-dialog';document.body.append(dialog);}
      const outcome=result.details.outcome==='A'?'Win':result.details.outcome==='B'?'Loss':result.details.outcome==='draw'?'Draw':'Unresolved';
      const sensitive=root.PvPeakTeamRoles.sensitive(result),cmp=root.PvPeakCmpDependencyUI.dependent(result.cmpDependency);
      dialog.setAttribute('aria-label',`${own.name} versus ${enemy.name} matchup details`);
      dialog.innerHTML=`<div class="team-workspace-dialog-head"><h3>${escape(own.name)} vs ${escape(enemy.name)}</h3><button type="button" data-dialog-close aria-label="Close matchup details">×</button></div><div class="team-workspace-dialog-pair"><img data-dialog-own alt="${escape(own.name)}"><b>${outcome}</b><img data-dialog-enemy alt="${escape(enemy.name)}"></div><p>Shields ${scenario.a}–${scenario.b}${scenario.delay?` · switch +${scenario.delay}t`:''}${scenario.bankFoeFast?' · foe +1 Fast energy':''}</p>${cmp?'<button type="button" class="team-workspace-cmp" data-dialog-cmp>⇄ CMP can change the result</button>':''}${sensitive?'<div class="team-workspace-reply"><b>! A tested reply can change this result</b><button type="button" data-dialog-reply>View alternative in Battle ↗</button></div>':''}<button type="button" class="team-workspace-battle" data-dialog-battle>Open in Battle ↗</button>`;
      options.setSprite(dialog.querySelector('[data-dialog-own]'),own);options.setSprite(dialog.querySelector('[data-dialog-enemy]'),enemy);
      dialog.onclick=e=>{if(e.target.closest('[data-dialog-close]'))dialog.close();if(e.target.closest('[data-dialog-cmp]')){dialog.close();root.PvPeakCmpDependencyUI.show(result.cmpDependency,{A:own.name,B:enemy.name});}if(e.target.closest('[data-dialog-battle]')||e.target.closest('[data-dialog-reply]')){const evidence=e.target.closest('[data-dialog-reply]')?result.sensitivity.evidence:null;dialog.close();options.roleBattle(data.slot,data.enemy,data.scenario,evidence);}};
      dialog.showModal();dialog.querySelector('[data-dialog-close]').focus();
    }
    function clearSelection(){preview=null;savedSelection=null;try{localStorage.removeItem(selectionKey);}catch(_){}sync();}
    sync();return {sync,show,showMatchups,inspect,clearSelection};
  }};
})(globalThis);
