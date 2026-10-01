(function (root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('./team-builder-battle-link') : root.PvPeakTeamBuilderBattleLink);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PvPeakTeamFarmBattleLink = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (BattleLink) {
  'use strict';
  const PARAM = 'tbFarm';
  function normalize(payload) {
    if (!payload || payload.version !== 1 || !/^[a-zA-Z0-9._:-]{1,120}$/.test(payload.engineVersion || '')) throw new Error('FARM_LINK_INVALID');
    const first = BattleLink.normalizePayload(payload.first);
    const side = value => BattleLink.normalizePayload({version:1,left:value,right:first.right}).left;
    if (first.left.startingFastCount || first.right.startingFastCount || first.reactionDelayTurns) throw new Error('FARM_LINK_INVALID');
    const start=payload.start ? Object.fromEntries(['A','B'].map(key=>{
      const value=payload.start[key];
      if(!value || !Number.isInteger(value.hp) || value.hp<1 || value.hp>4096 || !Number.isInteger(value.energy) || value.energy<0 || value.energy>100 || !Number.isInteger(value.shields) || value.shields<0 || value.shields>2)throw new Error('FARM_LINK_INVALID');
      return [key,Object.freeze({hp:value.hp,energy:value.energy,shields:value.shields})];
    })) : null;
    return Object.freeze({version:1,engineVersion:payload.engineVersion,first,farmer:side(payload.farmer),nextOpponent:payload.nextOpponent ? side(payload.nextOpponent) : null,start});
  }
  function encode(payload) {
    const json=JSON.stringify(normalize(payload));
    const bytes=new TextEncoder().encode(json);
    let binary=''; bytes.forEach(value=>{binary+=String.fromCharCode(value);});
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
  }
  function decode(token) {
    try {
      if (!token || token.length>12000 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
      const base=token.replace(/-/g,'+').replace(/_/g,'/');
      const bytes=Uint8Array.from(atob(base+'='.repeat((4-base.length%4)%4)),letter=>letter.charCodeAt(0));
      return normalize(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (_) { return null; }
  }
  function createUrl(currentUrl,payload) {
    const recipe=normalize(payload),url=new URL(String(currentUrl));
    ['tbBattle','compendium','item'].forEach(key=>url.searchParams.delete(key));
    url.searchParams.set('view','simulator'); url.searchParams.set(PARAM,encode(recipe));
    if(recipe.first.seasonId)url.searchParams.set('season',recipe.first.seasonId);
    url.hash=''; return url.toString();
  }
  function readLocation(location) { return decode(new URLSearchParams(location?.search || '').get(PARAM)); }
  return Object.freeze({PARAM,normalize,encode,decode,createUrl,readLocation});
});
