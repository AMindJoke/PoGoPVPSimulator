(function (root, factory) {
  const api=factory();
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  if(root)root.PvPeakTeamFarmPresentation=api;
})(typeof globalThis!=='undefined' ? globalThis : this,function () {
  'use strict';
  const rank={safe:0,risk:1,charged:2,failed:3,incomplete:4};
  function groupRoutes(routes) {
    const groups=new Map();
    routes.forEach(route=>{
      const key=`${route.ownSlot}-${route.opponentSlot}`;
      if(!groups.has(key))groups.set(key,{key,ownSlot:route.ownSlot,opponentSlot:route.opponentSlot,routes:[]});
      groups.get(key).routes.push(route);
    });
    return [...groups.values()].map(group=>({...group,routes:group.routes.slice().sort((a,b)=>rank[a.status]-rank[b.status] || a.slot-b.slot)}))
      .sort((a,b)=>rank[a.routes[0].status]-rank[b.routes[0].status] || a.opponentSlot-b.opponentSlot || a.ownSlot-b.ownSlot);
  }
  function chargedReadiness(route) {
    const side=route.continuation?.combatant;
    if(!side || side.hp<=0)return [];
    const energy=Math.max(0,Math.min(100,Number(side.energy)||0)),gain=Number(side.fast?.energyGain)||0;
    return (side.charged || []).filter(Boolean).map(move=>{
      const missing=Math.max(0,Number(move.energyCost)-energy);
      return {move,ready:missing===0,fastCount:missing===0 ? 0 : gain>0 && move.energyCost<=100 ? Math.ceil(missing/gain) : null};
    });
  }
  return Object.freeze({groupRoutes,chargedReadiness});
});
