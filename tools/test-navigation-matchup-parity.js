const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const G = require("./build-great-league-meta-database");
const Link = require("../src/team-builder/team-builder-battle-link");
const html = fs.readFileSync("PogoPvp.html", "utf8");
function section(start, end) { return html.slice(html.indexOf(`    function ${start}(`), html.indexOf(`    function ${end}(`)); }
const gm = G.readWindowGlobal("battle-data.js", "BATTLE_GAMEMASTER");
const movesets = G.readWindowGlobal("default-movesets.js", "BATTLE_DEFAULT_MOVESETS");
const moves = new Map(gm.moves.map(move => [move.moveId, G.normalizeMove(move)]));
const pokemon = new Map(gm.pokemon.filter(p => p?.speciesId && p.baseStats).map(p => G.normalizePokemon(p, moves)).map(p => [p.id, p]));
const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true, strict: true });
const fields = {}, selections = {}, charged = {};
const field = id => fields[id] ||= { value: "" };
let runs = 0;
const context = {
  $: field, findPokemon: id => pokemon.get(id), moveMap: moves,
  setPokemonSelection: (prefix, id) => { field(`${prefix}Pokemon`).value = id; },
  ensureChargedMoveSelects: prefix => charged[prefix] ||= [{ value: "" }, { value: "" }],
  chargedMoveSelects: prefix => charged[prefix], colorMoveSelect: () => {}, setIvProfileState: () => {},
  setBaiting: (prefix, value) => { field(`${prefix}Baiting`).value = value; },
  setShieldMode: (prefix, value) => { field(`${prefix}ShieldMode`).value = value; },
  renderShields: () => {}, setStartEnergy: (prefix, value) => { field(`${prefix}StartEnergy`).value = value; },
  startingFastAdvantages: {}, startingFastAdvantageMetadata: (move, count) => count ? { fastMoveId: move.id, count } : null,
  validStartingFastAdvantage: prefix => context.startingFastAdvantages[prefix],
  clearStartingFastAdvantage: prefix => { context.startingFastAdvantages[prefix] = null; },
  syncSelection: () => {}, selectedChargedMoves: prefix => charged[prefix].map(select => moves.get(select.value)).filter(Boolean),
  clampEnergy: value => Math.min(100, Math.max(0, Math.round(Number(value)))),
  selectedChargedMoveLimit: () => 2, setAppView: () => {}, applyIvOptimizationProfile: () => {},
  applyMetaRankingMoves: (prefix, id, side) => { field(`${prefix}Fast`).value = side.fast.id; context.ensureChargedMoveSelects(prefix).forEach((select, i) => { select.value = side.charged[i]?.id || ""; }); },
  resetBattleStateFromSetup: () => {}, runBattleToEnd: () => { runs++; },
  createTeamBuilderBattleConfig: () => selections.config,
  window: { PvPeakTeamBuilderBattleLink: Link }, activeSeasonData: { id: "twilight-trails" }
};
vm.createContext(context);
vm.runInContext(section("teamBuilderBattleLaunchSide", "openTeamBuilderMatchup") + section("validTeamBuilderBattleSide", "loadTeamBuilderBattleFromLocation") + section("loadMetaMatchup", "applyMetaRankingMoves"), context);
const clone = value => JSON.parse(JSON.stringify(value));
function reboundSide(base, prefix) {
  const ivs = ["IvAtk", "IvDef", "IvHp"].map(key => Number(field(prefix + key).value));
  const stats = G.statsForIvSpread(base.p, ...ivs);
  const result = { ...clone(base), ...stats, maxHp: stats.hp, hp: stats.hp,
    fast: clone(moves.get(field(prefix + "Fast").value)), charged: context.selectedChargedMoves(prefix).map(clone),
    energy: Number(field(prefix + "StartEnergy").value), shields: Number(field(prefix + "Shields").value),
    baiting: field(prefix + "Baiting").value, shieldMode: field(prefix + "ShieldMode").value };
  return result;
}
function simulate(config, a, b, source, debugTimeline = false) {
  return adapter.simulate({ id: 1, source, signature: `${source}-${a}-${b}`, config, aShields: a, bShields: b, includeSwing: false, debugTimeline });
}
let comparisons = 0;
for (const [aId, bId, profile] of [["mimikyu", "tinkaton", G.DEFAULT_PROFILE], ["jumpluff_shadow", "talonflame", G.RANK1_PROFILE], ["melmetal", "clodsire", G.DEFAULT_PROFILE]]) {
  const config = G.createBattleConfig(pokemon.get(aId), pokemon.get(bId), profile, moves, movesets, pokemon);
  config.left.shieldMode = "smart"; config.right.shieldMode = "smart";
  if (aId === "melmetal") {
    const stats = G.statsForIvSpread(config.left.p, 4, 12, 13);
    Object.assign(config.left, stats, { hp: stats.hp, maxHp: stats.hp, fast: clone(moves.get(config.left.p.fast[0])), charged: config.left.p.charged.slice(-2).map(id => clone(moves.get(id))), energy: 37, baiting: "off", shieldMode: "no-first" });
    config.startEnergyA = 37;
  }
  for (const [a, b] of [[0, 0], [1, 1], [2, 2], [0, 2], [2, 0]]) {
    config.left.shields = a; config.right.shields = b; selections.config = config;
    const payload = context.teamBuilderBattleLaunchPayload({ shields: `${a}-${b}` });
    const decoded = Link.readLocation(new URL(Link.createUrl("https://example.test/PogoPvp.html?view=team-builder", payload)));
    for (const [prefix, side] of [["p1", decoded.left], ["p2", decoded.right]]) {
      assert.equal(context.validTeamBuilderBattleSide(side), true);
      context.applyTeamBuilderBattleSide(prefix, side);
    }
    const restored = { left: reboundSide(config.left, "p1"), right: reboundSide(config.right, "p2"), startEnergyA: Number(fields.p1StartEnergy.value), startEnergyB: Number(fields.p2StartEnergy.value) };
    const expected = simulate(config, a, b, "team-builder"), battle = simulate(restored, a, b, "battle");
    assert.equal(battle.score, expected.score, `${aId}/${bId} ${a}-${b}: Team Builder → Battle score`);
    assert.deepEqual(battle.details, expected.details, "Battle links must reproduce final HP and energy as well as score.");
    const copied = { version: 1, left: context.battleShareSide("p1"), right: context.battleShareSide("p2") };
    assert.equal(copied.left.startEnergy, config.startEnergyA, "Sharing after a battle uses initial setup energy.");
    assert.deepEqual(copied.left.chargedMoveIds, decoded.left.chargedMoveIds);
    if (!config.startEnergyA) {
      context.loadMetaMatchup(aId, bId, { config, aShields: a, bShields: b });
      const opened = { left: reboundSide(config.left, "p1"), right: reboundSide(config.right, "p2"), startEnergyA: 0, startEnergyB: 0 };
      const quick = simulate(config, a, b, "meta", true), full = simulate(opened, a, b, "battle", true);
      assert.equal(full.score, quick.score, "Quick Matchup → Battle score");
      assert.deepEqual(full.timelineTrace, quick.timelineTrace, "Quick Matchup → Battle timeline and decisions");
    }
    comparisons++;
  }
}
assert.equal(runs, 10);
// Exercise the actual opponent-team bridge with custom builds on both sides.
Object.assign(context, {
  statsForIvSpread:G.statsForIvSpread, clampIv:value=>Math.max(0,Math.min(15,Number(value))),
  cloneMatrixPokemon:clone, cloneMatrixMove:clone, initializeCombatantForms:side=>side,
  isShadow:p=>p.id.endsWith("_shadow"), shadowAtkMultiplier:1.2, shadowDefMultiplier:1/1.2
});
vm.runInContext(section("createTeamBuilderBattleConfig", "simulateTeamBuilderMatchupCell"),context);
const customMember=(id,ivs)=>({pokemonId:id,fastMoveId:pokemon.get(id).fast[0],chargedMoveIds:pokemon.get(id).charged.slice(-2),build:{ivAtk:ivs[0],ivDef:ivs[1],ivHp:ivs[2]}});
for (const [startEnergyA,startEnergyB] of [[0,0],[20,8],[0,60],[100,100]]) for (const [a,b] of [[0,0],[1,1],[2,2],[0,2],[2,0]]) {
  const job={member:customMember("clodsire",[4,12,13]),opponentMember:customMember("abomasnow",[7,14,11]),opponentId:"abomasnow",shields:`${a}-${b}`,startEnergyA,startEnergyB};
  const config=context.createTeamBuilderBattleConfig(job);
  const payload=context.teamBuilderBattleLaunchPayload(job);
  assert.deepEqual([...payload.right.chargedMoveIds],[...job.opponentMember.chargedMoveIds]);
  assert.equal(payload.right.ivAtk,7); assert.equal(payload.right.shields,b);
  assert.equal(payload.left.startEnergy,startEnergyA); assert.equal(payload.right.startEnergy,startEnergyB);
  for (const [prefix,side] of [["p1",payload.left],["p2",payload.right]]) context.applyTeamBuilderBattleSide(prefix,side);
  const restored={left:reboundSide(config.left,"p1"),right:reboundSide(config.right,"p2"),startEnergyA:Number(fields.p1StartEnergy.value),startEnergyB:Number(fields.p2StartEnergy.value)};
  const expected=simulate(config,a,b,"team-builder",true),actual=simulate(restored,a,b,"battle",true);
  assert.equal(actual.score,expected.score); assert.deepEqual(actual.details,expected.details); assert.deepEqual(actual.timelineTrace,expected.timelineTrace);
}
console.log("Opponent-team/Battle parity passed: 20 scenarios with custom builds, shields and starting energy on both sides.");
// Counter alignment results come from the reverse analysis. Opening the
// forward configuration can change equal-Attack tie handling and the outcome.
context.window.PvPeakTeamRoles = require("../src/team-builder/team-builder-roles");
context.window.PvPeakTeamOpponentContext = require("../src/team-builder/team-opponent-context");
context.teamRolesAnalysis = { state: () => ({ phase: "complete", results: new Map(), opponentResults: new Map() }), delay: () => 2 };
let roleUrl;
context.window.open = url => { roleUrl = url; };
context.window.location = new URL("https://example.test/PogoPvp.html?view=team-builder");
vm.runInContext(section("openTeamRoleMatchup", "initTeamOpponent"), context);
for (const [ownId, enemyId] of [["florges", "florges"], ["vigoroth", "sableye_shadow"], ["mimikyu", "melmetal"]]) {
  const job = { slot: 2, opponentSlot: 4, member: customMember(ownId, [4, 12, 13]), opponentMember: customMember(enemyId, [7, 14, 11]), opponentId: enemyId, startEnergyA: 0, startEnergyB: 0 };
  context.teamBuilderOpponentPlan = [job];
  for (const opposing of [false, true]) {
    context.openTeamRoleMatchup(2, 4, "even1", null, opposing);
    const payload = Link.readLocation(new URL(roleUrl));
    const exactJob = opposing ? context.window.PvPeakTeamOpponentContext.reversePlan([job])[0] : job;
    const config = context.createTeamBuilderBattleConfig(exactJob);
    assert.equal(payload.left.pokemonId, opposing ? enemyId : ownId);
    assert.equal(payload.right.pokemonId, opposing ? ownId : enemyId);
    assert.equal(payload.left.ivAtk, opposing ? 7 : 4);
    assert.equal(payload.reactionDelayTurns || 0, 0, "The counter alignment is a fresh 1–1 matchup, not a delayed switch");
    for (const [prefix, side] of [["p1", payload.left], ["p2", payload.right]]) context.applyTeamBuilderBattleSide(prefix, side);
    const restored = { left: reboundSide(config.left, "p1"), right: reboundSide(config.right, "p2"), startEnergyA: 0, startEnergyB: 0 };
    const expected = simulate(config, 1, 1, "roles", true), actual = simulate(restored, 1, 1, "battle", true);
    assert.equal(actual.score, expected.score);
    assert.deepEqual(actual.details, expected.details);
    assert.deepEqual(actual.timelineTrace, expected.timelineTrace);
  }
}
console.log("Role/counter Battle parity passed: 6 launches, including a mirror and reversed orientation.");
context.URLSearchParams = URLSearchParams;
vm.runInContext(section("loadTeamBuilderBattleFromLocation", "closeTeamBuilderMatchup"), context);
context.window.location = new URL("https://example.test/PogoPvp.html?tbBattle=broken");
const beforeInvalid = JSON.stringify(fields);
assert.equal(context.loadTeamBuilderBattleFromLocation(), true, "Bad links must show an error instead of falling through to another view.");
assert.equal(fields.battleShareError.hidden, false);
assert.equal(runs, 10, "Invalid links cannot launch a simulation.");
assert.equal(JSON.stringify({ ...fields, battleShareError: undefined }), beforeInvalid, "Invalid links cannot partly apply Pokemon or settings.");
context.window.location = new URL("https://example.test/PogoPvp.html?view=team-builder");
assert.equal(context.loadTeamBuilderBattleFromLocation(), false, "Ordinary navigation must not be intercepted.");
console.log(`Navigation parity passed: ${comparisons} Team Builder/Battle setups, 10 Quick/Battle timelines, including custom moves, IVs and energy.`);
