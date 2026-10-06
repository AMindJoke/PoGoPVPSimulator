"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const Roles = require("../src/team-builder/team-builder-roles");
const Context = require("../src/team-builder/team-opponent-context");
const plan = [];
for (let slot = 0; slot < 4; slot++) for (let opponentSlot = 0; opponentSlot < 4; opponentSlot++) {
  plan.push({ slot, opponentSlot, key: `${slot}:${opponentSlot}`, member: { pokemonId: `own-${slot}` }, opponentMember: { pokemonId: `foe-${opponentSlot}` } });
}
const results = new Map(), opponentResults = new Map();
for (const job of Roles.createJobs(plan, 2)) results.set(job.key, { score: job.slot === job.opponentSlot ? 200 : 750, details: { outcome: job.slot === job.opponentSlot ? "B" : "A" }, aUsed: 0, bUsed: 0 });
const reverse = Context.reversePlan(plan);
for (const job of Roles.createJobs(reverse, 2)) opponentResults.set(job.key, { score: job.slot === job.opponentSlot ? 800 : 250, details: { outcome: job.slot === job.opponentSlot ? "A" : "B" }, aUsed: 0, bUsed: 0 });
const analysis = Context.analyze(Roles.analyze(plan, results, 2), Roles.analyze(reverse, opponentResults, 2), results, opponentResults);
const elements = new Map();
const element = id => {
  if (!elements.has(id)) elements.set(id, { innerHTML: "", querySelectorAll: () => [], querySelector: () => ({ textContent: "" }) });
  return elements.get(id);
};
const context = { PvPeakTeamRoles: Roles, document: { getElementById: element } };
vm.createContext(context);
vm.runInContext(fs.readFileSync("src/ui/team-roles.js", "utf8"), context);
const calls = [];
const team = prefix => ({ team: Array.from({ length: 4 }, (_, index) => ({ name: `${prefix} ${index}`, pokemonId: `${prefix}-${index}` })) });
const uiOptions = {
  own: () => team("Own"), opponent: () => team("Foe"), trioIds: () => [],
  escapeHtml: text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
  shieldSvg: () => "<svg></svg>", setSprite: () => {}, moveName: id => id,
  analysis: { state: () => ({ phase: "complete", analysis, results, opponentResults }), delay: () => 2 },
  battle: (...args) => calls.push(args)
};
const ui = context.PvPeakTeamRolesUI.create(uiOptions);
ui.render();
const markup = element("teamRolesResults").innerHTML;
assert(markup.includes("✓ Win · ≈ Draw · × Loss"), "Results need a visible non-color legend");
for (let enemy = 0; enemy < 4; enemy++) assert(markup.includes(`class="team-role-matchup-name">Foe ${enemy}</small>`), "Opponent identity must not depend on hover");
const pairs = [...markup.matchAll(/<button[^>]*data-role-battle="(\d+)" data-role-opponent="(\d+)" data-role-scenario="even1" data-role-perspective="opponent"/g)];
assert.equal(pairs.length, analysis.suggestions.length * 3);
for (const [index, candidate] of analysis.suggestions.entries()) {
  assert.deepEqual(pairs.slice(index * 3, index * 3 + 3).map(pair => [Number(pair[1]), Number(pair[2])]),
    candidate.context.reply.alignment.answers.map(answer => [answer.slot, answer.opponentSlot]), "All three clickable counters must retain the ordered alignment");
}
function click(dataset) {
  element("teamRolesResults").onclick({ target: { closest: selector => selector === "[data-role-battle]" ? { dataset } : null } });
}
click({ roleBattle: "2", roleOpponent: "1", roleScenario: "even1", rolePerspective: "opponent" });
assert.deepEqual(calls.pop(), [2, 1, "even1", null, true], "Opposing counters must launch the exact opponent-side simulation");
click({ roleBattle: "2", roleOpponent: "1", roleScenario: "switch1" });
assert.deepEqual(calls.pop(), [2, 1, "switch1", null, false], "Own role matrices keep their own perspective and scenario");
const conditional=analysis.suggestions[0].context.reply.alignment.answers[0];
conditional.evenShields=[{shields:0,outcome:'A',fragile:false},{shields:1,outcome:'B',fragile:false},{shields:2,outcome:'A',fragile:false}];
ui.render();
assert(element("teamRolesResults").innerHTML.includes('Wins · 0–0, 2–2'),"A conditional counter must show exactly which equal shields it wins");
conditional.evenShields[0].fragile=true;
ui.render();
assert(element("teamRolesResults").innerHTML.includes('Wins · 0–0 !, 2–2'),"Detected flips cannot be presented as unconditional counter wins");
assert(element("teamRolesResults").innerHTML.includes('! Tested reply can change this result'));
const cmp={version:'cmp-dependency-v1',status:'dependent',evidence:{turn:25,first:'B',attackA:120.97,attackB:121.56,baselineOutcome:'B',alternateOutcome:'A'}};
conditional.cmpDependency=cmp;
const cmpKey=Roles.cellKey(conditional.opponentSlot,conditional.slot,{a:1,b:1,delay:0});
opponentResults.get(cmpKey).cmpDependency=cmp;
const cmpCalls=[];context.PvPeakCmpDependencyUI={show:(...args)=>cmpCalls.push(args)};
ui.render();
assert(element("teamRolesResults").innerHTML.includes('data-role-cmp'),'Verified CMP dependence needs a visible badge');
assert(element("teamRolesResults").innerHTML.includes('CMP dependent; tap the CMP label for details.'),'The parent matchup must announce the CMP warning');
const cmpDataset={roleBattle:String(conditional.slot),roleOpponent:String(conditional.opponentSlot),roleScenario:'even1',rolePerspective:'opponent'};
const beforeCmpClick=calls.length;
element('teamRolesResults').onclick({target:{closest:selector=>selector==='[data-role-battle]'?{dataset:cmpDataset}:selector==='[data-role-cmp]'?{}:null}});
assert.equal(calls.length,beforeCmpClick,'Tapping CMP opens its explanation instead of unexpectedly launching Battle');
assert.equal(cmpCalls[0][0],cmp);
assert.equal(cmpCalls[0][1].A,`Foe ${conditional.opponentSlot}`);
assert.equal(cmpCalls[0][1].B,`Own ${conditional.slot}`);
const inspected=[];uiOptions.inspect=data=>inspected.push(data);
click({roleBattle:'2',roleOpponent:'1',roleScenario:'switch1'});
assert.deepEqual(JSON.parse(JSON.stringify(inspected.pop())),{slot:2,enemy:1,scenario:'switch1'},'Matchup details must preserve the precise role scenario');
const inspectCount=inspected.length;
click({roleBattle:'2',roleOpponent:'1',roleScenario:'even1',rolePerspective:'opponent'});
assert.equal(inspected.length,inspectCount,'Opposing alignment must retain its reversed Battle route');
assert.deepEqual(calls.pop(),[2,1,'even1',null,true]);
const navigations=[],selections=[];
uiOptions.navigate=(...args)=>navigations.push(args);uiOptions.useTrio=slots=>selections.push(slots);uiOptions.renderOpponent=()=>{};
const trioTrigger={dataset:{roleTrio:'1,2,3'},closest:()=>({dataset:{roleIndex:'1'}})};
element('teamRolesResults').onclick({target:{closest:selector=>selector==='[data-role-trio]'?trioTrigger:null}});
assert.deepEqual(JSON.parse(JSON.stringify(selections.pop())),[1,2,3]);
assert.deepEqual(navigations.pop(),[1,'lead',true],'Choosing a trio must retain its role order and navigate to the matchup view');
console.log("Team role readability: named results, result legend, ordered clickable counters and perspective routing passed.");
