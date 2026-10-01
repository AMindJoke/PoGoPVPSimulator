const assert=require("node:assert/strict"), Practice=require("../src/training/fast-count-practice"), Trainer=require("../src/training/fast-count-trainer"), Engine=require("../src/training/fast-count-engine");
const data={moves:[{moveId:"FAST",energyGain:7},{moveId:"ONE",energy:45},{moveId:"TWO",energy:60}],pokemon:[{speciesId:"test",speciesName:"Test",dex:1,fastMoves:["FAST"],chargedMoves:["ONE","TWO"]}]};
const catalog=Trainer.createCatalog({gameMaster:data,defaultMovesets:{test:{fast:"FAST",charged:["ONE","TWO"]}}});
const build=catalog.builds[0], exercise=Engine.createExercise({fastEnergy:7,chargedCost:45,currentEnergy:13,fastMove:build.fastMove,chargedMove:build.chargedMoves[0]});
const values=new Map([[Trainer.STORAGE_KEY,JSON.stringify({completed:20,correct:12,bestStreak:3})]]),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
const descriptor=Practice.describe(build,exercise),store=Practice.createStore(storage); store.record(descriptor,false);
assert.equal(store.candidates(catalog)[0].debt,2);
let trainer=Trainer.createTrainer({catalog,storage,random:()=>0}); trainer.setMode("mistakes");
assert.equal(trainer.getState().exercise.energyBefore,13); assert.equal(trainer.getState().exercise.answer,exercise.answer); assert.equal(trainer.getState().stats.completed,20);
store.record(descriptor,true); assert.equal(store.candidates(catalog)[0].debt,1); store.record(descriptor,true); assert.equal(store.candidates(catalog).length,0);
trainer=Trainer.createTrainer({catalog,storage}); trainer.setMode("mistakes"); assert.equal(trainer.getState().mode,"guided","Empty review is unavailable.");
store.record(descriptor,false);
const changed=Trainer.createCatalog({gameMaster:{...data,moves:[{moveId:"FAST",energyGain:8},...data.moves.slice(1)]},defaultMovesets:{test:{fast:"FAST",charged:["ONE","TWO"]}}});
assert.equal(store.candidates(changed).length,0,"Updated move energy must invalidate old exercises.");
const shortcut=Practice.describe(build,{kind:"shortcut",chargedMove:build.chargedMoves[1]}); store.record(shortcut,false);
const restored=Practice.createStore(storage); assert.equal(restored.candidates(catalog).length,2);
assert.equal(Practice.pick(restored.candidates(catalog),()=>0,Practice.key(descriptor)).kind,"shortcut");
assert.deepEqual(Practice.createStore({getItem:()=>'{bad'}).candidates(catalog),[]);
const failing=Practice.createStore({getItem:()=>null,setItem:()=>{throw Error("quota");}}); assert.equal(failing.record(descriptor,false),false); assert.equal(failing.candidates(catalog).length,0);
console.log("Fast Count mistake persistence, exact-energy recreation, shortcut and season compatibility passed.");
// Drive the real trainer handlers through a minimal DOM fixture.
const fixtureStorage={getItem:key=>fixtureValues.get(key),setItem:(key,value)=>fixtureValues.set(key,value)},fixtureValues=new Map([[Trainer.STORAGE_KEY,JSON.stringify({completed:20,correct:12,bestStreak:3})]]);
Practice.createStore(fixtureStorage).record(descriptor,false);
const container={innerHTML:"", answers:[], next:null,
  querySelectorAll(selector) {
    if(selector!=="[data-fast-count-answer]")return [];
    this.answers=[...this.innerHTML.matchAll(/data-fast-count-answer="(\d+)"/g)].map(match=>({dataset:{fastCountAnswer:match[1]},addEventListener(event,fn){this.click=fn;},focus(){}}));return this.answers;
  },
  querySelector(selector){ if(selector!=="[data-fast-count-next]" || !this.innerHTML.includes("data-fast-count-next"))return null; return this.next ||= {addEventListener(event,fn){this.click=fn;},focus(){}}; }
};
global.document={addEventListener(){},removeEventListener(){}};
const live=Trainer.createTrainer({catalog,storage:fixtureStorage,random:()=>0}); live.mount(container); live.setMode("mistakes");
for(let i=0;i<2;i++) {
  const current=live.getState(); assert.equal(current.exercise.energyBefore,13);
  container.answers.find(button=>Number(button.dataset.fastCountAnswer)===current.exercise.answer).click();
  assert.equal(live.getState().answered,true); container.next.click();
}
assert.equal(live.getState().sessionDone,true,"Review finishes when all pending exercises are mastered.");
assert.equal(live.getState().stats.completed,22); assert.equal(live.getState().stats.correct,14);
assert.equal(Practice.createStore(fixtureStorage).candidates(catalog).length,0); assert.match(container.innerHTML,/All caught up!/);
live.destroy(); delete global.document;
console.log("Real trainer review answers, existing stats and early completion passed.");
