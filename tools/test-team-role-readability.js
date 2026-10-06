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
const ui = context.PvPeakTeamRolesUI.create({
  own: () => team("Own"), opponent: () => team("Foe"), trioIds: () => [],
  escapeHtml: text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;"),
  shieldSvg: () => "<svg></svg>", setSprite: () => {}, moveName: id => id,
  analysis: { state: () => ({ phase: "complete", analysis, results, opponentResults }), delay: () => 2 },
  battle: (...args) => calls.push(args)
});
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
console.log("Team role readability: named results, result legend, ordered clickable counters and perspective routing passed.");
