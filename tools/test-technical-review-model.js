const assert = require("assert");
const TechnicalReview = require("../src/scenario/technical-review-model.js");

const timeline = [
  { trainer: "A", kind: "fast", start: 0, duration: 2, damage: 4, move: { name: "Psywave" } },
  { trainer: "B", kind: "fast", start: 0, duration: 3, damage: 8, move: { name: "Astonish" } },
  { trainer: "A", kind: "fast", start: 2, duration: 2, damage: 4, move: { name: "Psywave" } },
  { trainer: "A", kind: "charge", start: 2, duration: 1, damage: 60, move: { name: "Foul Play" }, state: { A: { hp: 6 }, B: { hp: 90 } } }
];

const lag = TechnicalReview.createOneTurnLagIssue(timeline, 2, 0);
assert.equal(lag.type, "one-turn-lag");
assert.equal(lag.actionOrdinal, 2);
assert.equal(lag.moveName, "Psywave");

const dre = TechnicalReview.createDreIssue(timeline, 3, 0);
assert.equal(dre.type, "dre");
assert.equal(dre.fastMoveName, "Astonish");
assert.equal(dre.pendingDamage, 8);
assert.equal(dre.hpAtThrow, 6);

assert.equal(TechnicalReview.createDreIssue(timeline, 2, 0), null);
assert.equal(TechnicalReview.eventOrdinal(timeline, 2, 1, "fast", "A"), 1);

const review = TechnicalReview.createReview();
TechnicalReview.setResult(review, lag, { winner: "A" }, { winner: "B" });
assert.equal(review.activeBranch, "original");
assert.equal(review.issue.type, "one-turn-lag");
assert.equal(review.sourceState.winner, "A");
TechnicalReview.clearReview(review);
assert.equal(review.issue, null);

console.log("Technical review model tests passed.");
