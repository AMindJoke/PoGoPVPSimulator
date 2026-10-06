(function(root,factory){
  const api=factory(root);
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.PvPeakCmpDependencyUI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dependent=check=>check?.version==='cmp-dependency-v1' && check.status==='dependent' && !!check.evidence;
  function describe(check,names){
    if(!dependent(check))return null;
    if(names.A===names.B)names={A:`${names.A} (A)`,B:`${names.B} (B)`};
    const e=check.evidence,outcome=side=>side==='draw'?'Draw':`${names[side]} wins`;
    return {heading:`T${e.turn} · ${names[e.first]} fires first`,
      attacks:`${names.A}: ${Number(e.attackA).toFixed(2)} · ${names.B}: ${Number(e.attackB).toFixed(2)}`,
      change:`${outcome(e.baselineOutcome)} → ${outcome(e.alternateOutcome)}`};
  }
  let dialog=null;
  function close(){if(dialog?.open)dialog.close();}
  function show(check,names){
    const copy=describe(check,names);if(!copy)return;
    if(!dialog){
      dialog=document.createElement('dialog');dialog.className='cmp-dialog';document.body.append(dialog);
      dialog.addEventListener('click',event=>{if(event.target.closest('[data-cmp-close]'))close();});
    }
    dialog.innerHTML=`<div class="cmp-dialog-head"><h3 id="cmpDialogTitle">⇄ CMP dependent</h3><button type="button" data-cmp-close aria-label="Close CMP details">×</button></div><strong>${escape(copy.heading)}</strong><p>${escape(copy.attacks)}</p><div class="cmp-dialog-change">${escape(copy.change)}</div><p>Reversing Charged Attack priority changes the result.</p><small>Priority-only test · same IVs and starting resources.</small>`;
    dialog.setAttribute('aria-labelledby','cmpDialogTitle');
    if(!dialog.open)dialog.showModal();
    dialog.querySelector('[data-cmp-close]').focus();
  }
  function create(options){
    let check=null,names=null;
    function clear(){options.grid.querySelectorAll('.cmp-timeline-mark').forEach(e=>e.remove());}
    function refresh(){
      clear();if(!dependent(check))return;
      const e=check.evidence,index=options.events().findIndex(event=>event.kind==='charge' && event.trainer===e.first && Number(event.start)===e.turn);
      const block=options.grid.querySelector(`.timeline-block[data-event-index="${index}"]`);if(!block)return;
      const mark=document.createElement('span');mark.className='cmp-timeline-mark';mark.textContent='⇄';mark.title='Outcome changes with CMP priority';mark.setAttribute('aria-hidden','true');block.append(mark);
    }
    options.mount.onclick=()=>show(check,names);
    return {refresh,reset(){check=null;names=null;clear();options.mount.hidden=true;close();},update(value,labels){
      check=value;names=labels;options.mount.hidden=!dependent(value);
      if(dependent(value))options.mount.innerHTML='<button type="button" class="cmp-badge" aria-label="CMP dependent: view the decisive priority check">⇄ CMP</button>';
      refresh();
    }};
  }
  return {dependent,describe,show,close,create};
});
