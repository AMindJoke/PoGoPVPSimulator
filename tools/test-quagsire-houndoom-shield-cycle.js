"use strict";

const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");
const Alternatives = require("../src/analysis/battle-alternatives");
const Reliability = require("../src/reliability/battle-reliability");

const runtime = R.createRuntime();
const source = G.extractLiveWorkerSource();
const plain = G.createWorkerAdapter(source, { dreStandard: true, strict: true });
const probe = G.createWorkerAdapter(Alternatives.instrumentWorkerSource(source), { dreStandard: true, strict: true });
let sequence = 0;
let checked = 0;

function customIvs(combatant, atk, def, hp) {
  const stats = G.statsForIvSpread(combatant.p, atk, def, hp);
  Object.assign(combatant, {
    level: stats.level, cp: stats.cp, ivAtk: atk, ivDef: def, ivHp: hp,
    maxHp: stats.hp, hp: stats.hp, attack: stats.attack, defense: stats.defense,
    cpm: stats.attack / (combatant.p.atk + atk)
  });
}

for (const reverse of [false, true]) {
  for (const reverseMoves of [false, true]) {
    const config = G.createBattleConfig(runtime.pokemonMap.get("quagsire_shadow"),
      runtime.pokemonMap.get("houndoom_shadow"), G.DEFAULT_PROFILE,
      runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
    customIvs(config.left, 4, 15, 10);
    customIvs(config.right, 4, 15, 13);
    config.left.charged = ["AQUA_TAIL", "STONE_EDGE"].map(id => runtime.moveMap.get(id));
    if (reverseMoves) config.left.charged.reverse();
    config.right.charged = ["FOUL_PLAY", "TRAILBLAZE"].map(id => runtime.moveMap.get(id));
    config.left.fast = runtime.moveMap.get("MUD_SHOT");
    config.right.fast = runtime.moveMap.get("INCINERATE");
    config.left.shieldMode = config.right.shieldMode = "always";
    config.left.baiting = config.right.baiting = "selective";
    config.left.energy = config.startEnergyA = 0;
    config.right.energy = config.startEnergyB = 20;
    if (reverse) {
      [config.left, config.right] = [config.right, config.left];
      [config.startEnergyA, config.startEnergyB] = [config.startEnergyB, config.startEnergyA];
    }
    config.left.trainer = "A";
    config.right.trainer = "B";
    const quag = reverse ? "B" : "A", hound = reverse ? "A" : "B";
    const run = (targets, adapter = probe) => JSON.parse(JSON.stringify(adapter.simulate({
      id: ++sequence, key: `shield-cycle-${sequence}`, config, aShields: 2, bShields: 2,
      trace: true, debugTimeline: true, includeSwing: false,
      ...(targets ? { alternativeProbe: { targets } } : {})
    })));
    const baseline = run([]);
    const canonical = run(null, plain);
    assert.deepEqual(baseline.timelineTrace, canonical.timelineTrace,
      "The observational probe must preserve the ordinary battle.");
    assert.equal(Alternatives.outcome(baseline), quag);
    const opener = baseline.alternativeProbe.nodes.find(node => node.side === hound
      && node.kind === "action" && node.turn === 5);
    assert(opener?.legal.some(action => action.moveId === "FOUL_PLAY"));
    const branch = run([{ index: opener.index, type: "charged_move", moveId: "FOUL_PLAY" }]);
    assert.deepEqual(branch.alternativeProbe.nodes.slice(0, opener.index + 1),
      baseline.alternativeProbe.nodes.slice(0, opener.index + 1),
      "Only the explicit Houndoom opening may change the shared prefix.");
    assert.equal(Alternatives.outcome(branch), quag,
      "Opening Foul Play must not manufacture a Houndoom win through Quagsire overfarming.");
    assert.deepEqual(Reliability.validateTrace(branch.decisionTrace), []);
    const charges = branch.timelineTrace.filter(event => event.trainer === quag && event.kind === "charge");
    assert(charges.length >= 3, "Remove both shields and land the finishing Aqua Tail.");
    assert(charges.every(event => event.moveId === "AQUA_TAIL"));
    const review = branch.decisionTrace.decisions.find(decision => decision.side === quag
      && decision.principleResult?.evidence?.timingComparison?.actionChanged);
    assert.equal(review?.principleResult.evidence.timingComparison.action.moveId, "AQUA_TAIL");
    assert.equal(review.principleResult.evidence.timingComparison.reason, "STANDARD_OUTCOME_IMPROVED");
    assert.equal(branch.decisionTrace.intelligenceAudit.legacyFallbackDecisions, 0);
    checked++;
  }
}
console.log(`Quagsire/Houndoom shield cycle passed: ${checked} exact-IV energy-advantage cases, both orientations and move orders.`);
