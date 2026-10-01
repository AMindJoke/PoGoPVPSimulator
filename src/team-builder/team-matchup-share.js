(function(root,factory) {
  const api=factory(typeof module === "object" && module.exports ? require("./team-builder-library") : root.PvPeakTeamLibrary);
  if(typeof module === "object" && module.exports)module.exports=api;
  root.PvPeakTeamMatchupShare=api;
})(globalThis,function(Library) {
  "use strict";
  const HASH_KEY="teamMatchup", MAX_LENGTH=50000;
  function normalize(payload) {
    if(payload?.schemaVersion!==1)throw new Error("This comparison link is incompatible.");
    const own=Library.snapshot({state:payload.own}).state, opponent=Library.snapshot({state:payload.opponent}).state;
    if(own.league!==opponent.league || !own.team.some(Boolean) || !opponent.team.some(Boolean))throw new Error("Both teams are required.");
    const shields={}, energy={};
    for(const side of ["A","B"]) {
      const shield=payload.shields?.[side], value=payload.energy?.[side] ?? 0;
      if(!Number.isInteger(shield) || shield<0 || shield>2 || !Number.isInteger(value) || value<0 || value>100)throw new Error("This comparison's shields or energy are invalid.");
      shields[side]=shield; energy[side]=value;
    }
    const trioIds=payload.trioIds ?? [];
    if(!Array.isArray(trioIds) || trioIds.length>3 || new Set(trioIds).size!==trioIds.length || trioIds.some(id=>!own.team.some(member=>member?.pokemonId===id)))throw new Error("This trio is invalid.");
    if(!/^[a-z0-9-]{1,80}$/.test(payload.seasonId || ""))throw new Error("This comparison's season is invalid.");
    return {schemaVersion:1,own,opponent,shields,energy,trioIds:[...trioIds],seasonId:payload.seasonId};
  }
  function encode(payload) {
    const bytes=new TextEncoder().encode(JSON.stringify(normalize(payload)));
    let base64;
    if(typeof Buffer!=="undefined")base64=Buffer.from(bytes).toString("base64");
    else { let text=""; bytes.forEach(byte=>text+=String.fromCharCode(byte)); base64=btoa(text); }
    const token="v1."+base64.replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
    if(token.length>MAX_LENGTH)throw new Error("This comparison is too large to share.");
    return token;
  }
  function decode(token) {
    if(typeof token!=="string" || token.length>MAX_LENGTH || !/^v1\.[A-Za-z0-9_-]+$/.test(token))throw new Error("This comparison link is invalid.");
    const text=token.slice(3).replace(/-/g,"+").replace(/_/g,"/"), padded=text+"=".repeat((4-text.length%4)%4);
    const bytes=typeof Buffer!=="undefined" ? new Uint8Array(Buffer.from(padded,"base64")) : Uint8Array.from(atob(padded),char=>char.charCodeAt(0));
    return normalize(JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes)));
  }
  function tokenFromLocation(location) { return new URLSearchParams(String(location.hash || "").replace(/^#/,"")).get(HASH_KEY); }
  function createUrl(current,payload) {
    const url=new URL(String(current));
    ["tbBattle","compendium","item"].forEach(key=>url.searchParams.delete(key));
    url.searchParams.set("view","team-builder"); url.searchParams.set("season",payload.seasonId);
    url.hash=new URLSearchParams({[HASH_KEY]:encode(payload)}).toString(); return url.toString();
  }
  return {HASH_KEY,MAX_LENGTH,normalize,encode,decode,tokenFromLocation,createUrl};
});
