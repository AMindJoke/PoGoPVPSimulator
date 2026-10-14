"use strict";

const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");

const runtime = R.createRuntime();
const adapter = G.createWorkerAdapter(G.extractLiveWorkerSource(), { dreStandard: true, strict: true });

for (const opponentId of ["kingdra", "kingdra_shadow"]) {
  for (const shields of [1, 2]) {
    const config = G.createBattleConfig(
      runtime.pokemonMap.get("florges"), runtime.pokemonMap.get(opponentId),
      G.DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap
    );
    config.left.shieldMode = "smart";
    config.right.shieldMode = "smart";
    const result = adapter.simulate({
      id: 1, key: `florges-${opponentId}-${shields}-smart`, config,
      aShields: shields, bShields: shields, trace: true, debugTimeline: true, includeSwing: false
    });
    assert.equal(result.details.outcome, "A", `${opponentId} ${shields}-${shields}: Florges should win`);
    const charged = result.timelineTrace
      .filter(event => event.kind === "charge" && event.trainer === "A")
      .map(event => event.moveId);
    assert(charged.includes("MOONBLAST"), `${opponentId} ${shields}-${shields}: Moonblast must be used`);
    if (shields === 1 || opponentId === "kingdra") {
      assert.equal(charged[0], "MOONBLAST", `${opponentId} ${shields}-${shields}: do not open with low-pressure Chilling Water`);
    }
  }
}

console.log("Smart-shield charged-route regressions passed.");
