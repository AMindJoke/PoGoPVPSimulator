const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const G = require('./build-great-league-meta-database');
const Announced = require('../src/battle/announced-moves');
const gm = G.readWindowGlobal('battle-data.js', 'BATTLE_GAMEMASTER');
const moves = new Map(gm.moves.map(m => [m.moveId, G.normalizeMove(m)]));
const pokemon = new Map(gm.pokemon.filter(p => p.speciesId && p.baseStats).map(p => G.normalizePokemon(p, moves)).map(p => [p.id,p]));
const z = pokemon.get('zoroark'), hisui = pokemon.get('zoroark_hisuian');
assert.ok(z && hisui);
const original = JSON.stringify(z.fast);
assert.ok(!z.fast.includes('SUCKER_PUNCH'));
assert.ok(Announced.fastIds(z).includes('SUCKER_PUNCH'));
assert.ok(!Announced.fastIds(hisui).includes('SUCKER_PUNCH'));
assert.equal(JSON.stringify(z.fast), original);
const before = new Date(2026,9,10,13,59,59);
assert.match(Announced.label(z,'SUCKER_PUNCH',before), /Upcoming/);
assert.equal(Announced.label(z,'SUCKER_PUNCH',new Date(2026,9,10,14,0)), '');
assert.equal(Announced.label(z,'SUCKER_PUNCH',new Date(2026,9,11)), '');
const html = fs.readFileSync('PogoPvp.html','utf8');
function section(start,end) { return html.slice(html.indexOf('    function '+start+'('), html.indexOf('    function '+end+'(')); }
const fields = {}, ctx = { window: { PvPeakAnnouncedMoves: {...Announced,label:(p,id)=>Announced.label(p,id,before)} }, moveMap:moves,
  $: id => fields[id] ||= {}, colorMoveSelect:()=>{}, escapeHtml:s=>s,
  findPokemon:id=>pokemon.get(id), selectedChargedMoveLimit:()=>2,
  standardMovesetFor:()=>({fast:'SUCKER_PUNCH',charged:z.charged.slice(0,2)}),
  fastMoveScore:m=>m.power, chargedMoveScore:m=>m.power };
vm.createContext(ctx);
vm.runInContext(section('selectableFastMoveIds','chooseRecommendedMoves') + section('teamBuilderMoveOptions','teamBuilderChargedMoveSelects') + section('metaMovesForPokemon','metaCacheLabel') + section('validTeamBuilderBattleSide','applyTeamBuilderBattleSide'), ctx);
ctx.fillMoveSelect('p1Fast',z.fast,z);
assert.match(fields.p1Fast.innerHTML, /SUCKER_PUNCH.*Upcoming/);
ctx.fillMoveSelect('p1Charged',z.charged,z);
assert.ok(!fields.p1Charged.innerHTML.includes('Upcoming'));
assert.match(ctx.teamBuilderMoveOptions(ctx.selectableFastMoveIds(z),'SUCKER_PUNCH',new Set(),z), /SUCKER_PUNCH" selected.*Upcoming/);
assert.notEqual(ctx.metaMovesForPokemon(z).fast.id,'SUCKER_PUNCH');
const side = {pokemonId:z.id,fastMoveId:'SUCKER_PUNCH',chargedMoveIds:z.charged.slice(0,2),ivAtk:4,ivDef:14,ivHp:14,shields:1,baiting:'selective',shieldMode:'smart',startEnergy:0};
assert.equal(ctx.validTeamBuilderBattleSide(side),true);
assert.equal(ctx.validTeamBuilderBattleSide({...side,pokemonId:hisui.id}),false);
const defaults=G.readWindowGlobal('default-movesets.js','BATTLE_DEFAULT_MOVESETS');
const config=G.createBattleConfig(z,pokemon.get('corviknight'),G.DEFAULT_PROFILE,moves,defaults,pokemon);
config.left.fast={...moves.get('SUCKER_PUNCH')};
assert.equal(config.left.fast.power,8);assert.equal(config.left.fast.energyGain,7);assert.equal(config.left.fast.turns,2);
const adapter=G.createWorkerAdapter(G.extractLiveWorkerSource(),{dreStandard:true,strict:true});
const result=adapter.simulate({id:'upcoming',key:'upcoming',signature:'upcoming',source:'team-builder',aShields:1,bShields:1,includeSwing:false,config});
assert.ok(Number.isFinite(result.score));
const patches=require('../data/seasons/twilight-trails/confirmed-moves-20260908.json').moves;
let fieldsChecked=0;
for(const [id,patch] of Object.entries(patches)) { const move=gm.moves.find(m=>m.moveId===id); for(const [key,value] of Object.entries(patch)){assert.equal(JSON.stringify(move[key]),JSON.stringify(value),id+' '+key);fieldsChecked++;} }
console.log('Announced moves passed: explicit preview, selectors, Hisui exclusion, auto Meta exclusion, Battle link validation, real worker score '+result.score+', '+fieldsChecked+' seasonal fields.');
