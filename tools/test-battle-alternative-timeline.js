"use strict";
const assert=require("node:assert/strict"), fs=require("node:fs"), vm=require("node:vm");
const UI=require("../src/ui/battle-alternatives.js");
const html=fs.readFileSync("PogoPvp.html","utf8");
function extract(name){const start=html.indexOf("    function "+name+"(");const end=html.indexOf("\n    function ",start+1);return html.slice(start,end);}
const element=()=>({innerHTML:"",style:{setProperty(){}},classList:{toggle(){},add(){}},querySelector(){return null;}});
const standard=[{kind:"fast",trainer:"A",start:0,duration:2,move:{id:"OLD",name:"Old move",type:"water"}}];
const fast={id:"FAST",name:"Fast",type:"electric"}, charge={id:"CHARGE",name:"Charge",type:"electric"};
const events=[
  {trainer:"A",kind:"fast",start:0,duration:2,move:fast,damage:4,hpBefore:100,hpAfter:96,state:{A:{hp:100},B:{hp:96}}},
  {trainer:"A",kind:"charge",start:3,duration:1,move:charge,damage:1,state:{A:{hp:100},B:{hp:95}}},
  {trainer:"B",kind:"shield",start:3,duration:1,move:charge,chargeIndex:1,state:{A:{hp:100},B:{hp:95}}},
  {trainer:"A",kind:"fast",start:5,duration:2,move:fast,damage:95,hpBefore:95,hpAfter:0,state:{A:{hp:100},B:{hp:0}}}
];
const config={left:{p:{id:"a"},hp:100},right:{p:{id:"b"},hp:100}};
const ruler=element(),a=element(),b=element(),scroll={clientWidth:800,classList:{toggle(){}},append(){}};
const container={querySelector:selector=>selector===".timeline-scroll"?scroll:selector==="[data-alternative-ruler]"?ruler:selector.includes('track="A"')?a:selector.includes('track="B"')?b:null};
const before=JSON.stringify(events),originalLeft={hp:27},originalRight={hp:0},originalInitial={A:{hp:150},B:{hp:150}};
const c={timeline:standard,left:originalLeft,right:originalRight,initialTimelineState:originalInitial,selectedTimelineIndex:2,
  chargePauseTurns:3,chargeWindowTurns:1,manualModeState:{enabled:false},typeColors:{electric:"#eee",water:"#abc"},
  $:()=>null,document:{createElement:()=>({style:{},dataset:{},setAttribute(){}})},
  timelineZoomPercent:()=>100,timelineIsFit:()=>true,timelineMoveTitle:e=>e.move.name,
  manualTimelineCollisionLanes:()=>new Map(),timelineStageEffectClass:()=>"",timelineStageEffectHtml:()=>"",
  darken:color=>color,contrastText:()=>"#000",shieldSvg:()=>"<svg>shield</svg>",disguiseSvg:()=>"<svg>protection</svg>",
  escapeHtml:String,moveShortLabel:m=>m.name,title:String,timelineTurnPixels:()=>18};
vm.createContext(c);
for(const name of ["withAlternativeTimelineContext","renderAlternativeBattleTimeline","timelineChargeSlots","uniqueChargeStarts","visualTurn","renderTimelineRuler","chargeVisualTurn","renderTimelineRow","renderFastTimelineEvent","timelineEditorMoveLabel","fastMoveImpactTurn","timelineFastImpactTurn","timelineFastVisualTurn","timelineFastSize","timelineChargeWidth","timelineShieldWidth","chargeTrail","moveTypeIcon","timelineMarkers","timelineKoMarkersForTrainer","timelineKoMarkerLeft","koTimelineIndexes"])vm.runInContext(extract(name),c);
c.renderAlternativeBattleTimeline(container,events,config,-1,3);
const alternative={a:a.innerHTML,b:b.innerHTML,ruler:ruler.innerHTML};
assert.match(alternative.a,/timeline-block fast/);assert.match(alternative.a,/timeline-block charge/);assert.match(alternative.a,/charge-dot/);
assert.match(alternative.b,/timeline-block shield/);assert.match(alternative.b,/timeline-marker ko/);
assert.equal(c.timeline,standard);assert.equal(c.left,originalLeft);assert.equal(c.right,originalRight);assert.equal(c.initialTimelineState,originalInitial);assert.equal(c.selectedTimelineIndex,2);
assert.equal(JSON.stringify(events),before);
c.withAlternativeTimelineContext(events,config,()=>{
  const slots=c.timelineChargeSlots();c.renderTimelineRuler(26,18,ruler);
  c.renderTimelineRow("A",a,26,18,slots,c.uniqueChargeStarts(slots));c.renderTimelineRow("B",b,26,18,slots,c.uniqueChargeStarts(slots));
});
assert.equal(a.innerHTML,alternative.a);assert.equal(b.innerHTML,alternative.b);assert.equal(ruler.innerHTML,alternative.ruler,"Alternative and normal renderers must produce the exact same markup for the same events.");
assert.throws(()=>c.withAlternativeTimelineContext(events,config,()=>{throw Error("render failure");}));
assert.equal(c.timeline,standard);assert.equal(c.left,originalLeft);assert.equal(c.right,originalRight);assert.equal(c.selectedTimelineIndex,2);
const zoom={timelineZoomPercent:()=>100,manualMobileTimelineScrollEnabled:()=>false,$:()=>({querySelector:()=>({clientWidth:802})})};
vm.createContext(zoom);vm.runInContext(extract("timelineTurnPixels"),zoom);
assert.equal(zoom.timelineTurnPixels(100,{clientWidth:0}),8,"Zooming with the standard grid hidden must retain the visible timeline width.");

const node=()=>({hidden:true,innerHTML:"",dataset:{},listeners:{},contains:()=>false,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(type,callback){this.listeners[type]=callback;}});
const mount=node(),detail=node(),preview=node(),grid=node();let renders=0;
global.document={activeElement:{dataset:{}}};
const ui=UI.create({mount,detail,preview,grid,imageUrl:()=>"sprite.png",movePill:()=>"Move",move:()=>charge,shieldSvg:()=>"Shield",standardEvents:()=>[],api:{outcome:()=>"A"},renderTimeline(root,received,cfg,index){renders++;assert.equal(root,preview);assert.equal(received,events);assert.equal(cfg,config);assert.equal(index,1);}});
const finding={node:{side:"A",kind:"action",turn:3,chosen:{type:"fast_move",moveId:"FAST"}},target:{type:"charged_move",moveId:"CHARGE"},outcome:"A",baselineOutcome:"B",result:{alternativeProbe:{timeline:events,finalState:{A:{hp:100,energy:5},B:{hp:0,energy:0}}}}};
config.left.p.name="Left";config.right.p.name="Right";
config.left.fast=config.right.fast=fast;config.left.charged=config.right.charged=[charge];
ui.update({phase:"ready",findings:[finding],checked:1},{config});
const click=action=>({target:{tagName:"BUTTON",closest:()=>({dataset:{alternativeAction:action}})}});
mount.listeners.click(click("toggle"));detail.listeners.click(click("alternative"));
assert.equal(renders,1);assert.equal(grid.hidden,true);assert.equal(preview.hidden,false);assert.match(preview.innerHTML,/class="timeline-grid"/);assert.match(preview.innerHTML,/data-alternative-label="A"/);assert.doesNotMatch(preview.innerHTML,/battle-alternative-event/);
ui.refreshTimeline();assert.equal(renders,2);detail.listeners.click(click("standard"));assert.equal(grid.hidden,false);assert.equal(preview.hidden,true);
delete global.document;
console.log("Alternative timeline: exact shared markup (Fast/Charged/shield/KO), state restoration on success/error, zoom and view toggles passed.");
