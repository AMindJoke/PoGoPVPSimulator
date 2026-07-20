const assert = require("assert");
const TechnicalReview = require("../src/scenario/technical-review-model.js");

const timeline = [
  { trainer: "A", kind: "fast", start: 0, duration: 2, damage: 4, move: { name: "Psywave" } },
  { trainer: "B", kind: "fast", start: 0, duration: 3, damage: 8, move: { name: "Astonish" } },
  { trainer: "A", kind: "fast", start: 2, duration: 2, damage: 4, energyBefore: 28, move: { name: "Psywave", energyGain: 8 }, state: { A: { hp: 6, energy: 36 }, B: { hp: 90 } } },
  { trainer: "B", kind: "fast", start: 2, duration: 3, damage: 8, move: { name: "Astonish" }, state: { A: { hp: 0 }, B: { hp: 90 } } }
];

const lag = TechnicalReview.createOneTurnLagIssue(timeline, 2, 0);
assert.equal(lag.type, "one-turn-lag");
assert.equal(lag.actionOrdinal, 2);
assert.equal(lag.moveName, "Psywave");

const combatants = {
  A: { charged: [{ id: "FOUL_PLAY", name: "Foul Play", energyCost: 35 }] },
  B: { charged: [] }
};
const dre = TechnicalReview.createDreIssue(timeline, 2, 0, combatants);
assert.equal(dre.type, "dre");
assert.equal(dre.energyFastName, "Psywave");
assert.equal(dre.lethalFastMoveName, "Astonish");
assert.equal(dre.pendingDamage, 8);
assert.equal(dre.energyAfter, 36);
assert.equal(dre.lethalFastOrdinal, 2);

assert.equal(TechnicalReview.createDreIssue(timeline, 0, 0, combatants), null);
assert.equal(TechnicalReview.eventOrdinal(timeline, 2, 1, "fast", "A"), 1);

const review = TechnicalReview.createReview();
TechnicalReview.setResult(review, lag, { winner: "A" }, { winner: "B" });
assert.equal(review.activeBranch, "original");
assert.equal(review.issue.type, "one-turn-lag");
assert.equal(review.sourceState.winner, "A");
TechnicalReview.clearReview(review);
assert.equal(review.issue, null);

console.log("Technical review model tests passed.");
