"use strict";

const assert = require("node:assert/strict");
const Intelligence = require("../src/battle/battle-intelligence");

function alternative(id, outcomes, responseIds = ["policy", "shield", "charged"]) {
  return {
    id,
    responses: outcomes.map((outcome, index) => ({
      responseId: responseIds[index], complete: true, outcome
    }))
  };
}

let checks = 0;
function select(alternatives, originalId = "original") {
  const before = JSON.stringify(alternatives);
  const result = Intelligence.selectRobustContinuation(alternatives, originalId);
  assert.equal(JSON.stringify(alternatives), before, "Selecting a continuation must not mutate its evidence.");
  checks++;
  return result;
}

function fallback(alternatives, label, originalId = "original") {
  assert.deepEqual(select(alternatives, originalId), {
    id: originalId, complete: false, reason: "INCOMPLETE_RESPONSE_COMPARISON"
  }, label);
}

let result = select([
  alternative("original", [0, 2, 2]),
  alternative("draw", [1, 0, 0]),
  alternative("win", [2, 0, 0])
]);
assert.equal(result.id, "win", "Standard outcome orders win above draw above loss.");
assert.equal(result.defaultChoiceId, "win");
assert.equal(result.reason, "STANDARD_OUTCOME_IMPROVED");
assert.equal(result.responseSensitive, true,
  "A better standard outcome remains eligible even when another opponent response defeats it.");
assert.equal(result.worstOutcome, 0);

result = select([
  alternative("original", [0, 2, 2]),
  alternative("draw", [1, 0, 0])
]);
assert.equal(result.id, "draw", "A configured-policy draw outranks a loss despite less favorable diagnostic responses.");
assert.equal(result.reason, "STANDARD_OUTCOME_IMPROVED");

result = select([
  alternative("original", [2, 0, 1]),
  alternative("robust", [2, 1, 2])
]);
assert.equal(result.id, "robust", "A response-wise improvement may protect an already projected configured-policy win.");
assert.equal(result.defaultChoiceId, "original");
assert.equal(result.reason, "ROBUST_WIN_PRESERVED");
assert.equal(result.worstOutcome, 1);
assert.equal(result.responseSensitive, true);

result = select([
  alternative("original", [2, 0, 1]),
  alternative("robust", [2, 2, 2])
]);
assert.equal(result.id, "robust", "Preserve the projected win with the alternative that also wins against every modeled reply.");
assert.equal(result.responseSensitive, false, "Sensitivity describes the selected alternative.");
assert.equal(result.worstOutcome, 2);

result = select([
  alternative("original", [2, 2, 2]),
  alternative("other", [2, 0, 1])
]);
assert.equal(result.id, "original");
assert.equal(result.responseSensitive, false, "Equal outcomes against every modeled reply are response-independent.");
assert.equal(result.worstOutcome, 2);

for (const alternatives of [
  [alternative("original", [1, 1, 1]), alternative("equal", [1, 1, 1])],
  [alternative("equal", [1, 1, 1]), alternative("original", [1, 1, 1])],
  [alternative("original", [2, 2, 2]), alternative("equal", [2, 2, 2])],
  [alternative("equal", [2, 2, 2]), alternative("original", [2, 2, 2])],
  [alternative("original", [2, 2, 0]), alternative("crossing", [2, 1, 2])],
  [alternative("crossing", [2, 1, 2]), alternative("original", [2, 2, 0])],
  [alternative("original", [1, 0, 0]), alternative("off-policy-win", [1, 2, 2])],
  [alternative("off-policy-win", [1, 2, 2]), alternative("original", [1, 0, 0])],
  [alternative("original", [0, 0, 0]), alternative("off-policy-win", [0, 2, 0])],
  [alternative("off-policy-win", [0, 2, 0]), alternative("original", [0, 0, 0])]
]) {
  result = select(alternatives);
  assert.equal(result.id, "original", "Equal or crossing reply outcomes must retain the original choice.");
  assert.equal(result.reason, "ORIGINAL_CHOICE_RETAINED");
}

result = select([
  alternative("original", [2, 0, 0]),
  alternative("first-improvement", [2, 1, 0]),
  alternative("dominant", [2, 1, 2])
]);
assert.equal(result.id, "dominant", "Select successive response-wise improvements when all configured outcomes already win.");
assert.equal(result.reason, "ROBUST_WIN_PRESERVED");

result = select([
  alternative("original", [0, 0, 0]),
  alternative("first-policy-improvement", [1, 0, 0]),
  alternative("diagnostic-improvement", [1, 2, 2])
]);
assert.equal(result.id, "first-policy-improvement",
  "After finding a better configured outcome, diagnostic replies must not switch between equal-policy alternatives.");
assert.equal(result.defaultChoiceId, "first-policy-improvement");
assert.equal(result.reason, "STANDARD_OUTCOME_IMPROVED");

result = select([
  alternative("original", [0, 0, 0]),
  alternative("first-policy-win", [2, 0, 0]),
  alternative("preserved-win", [2, 2, 2])
]);
assert.equal(result.id, "preserved-win", "Response-wise protection applies once the best configured outcome is a win.");
assert.equal(result.defaultChoiceId, "first-policy-win");
assert.equal(result.reason, "ROBUST_WIN_PRESERVED");

result = select([
  alternative("original", [0, 0, 0]),
  alternative("improved", [1, 0, 0], ["policy", "charged", "shield"])
]);
assert.equal(result.id, "improved", "Reply coverage is matched by identity rather than array position.");

fallback([], "Missing comparison alternatives must preserve the original choice.");
fallback([alternative("original", [2])], "A single alternative is not a comparison.");
fallback([alternative("a", [2]), alternative("b", [1])], "Missing original choice must fail closed.");
fallback([alternative("original", [2, 2]), { id: "other" }], "Missing response coverage must fail closed.");
fallback([alternative("original", [2, 2]), alternative("other", [2])], "Partial response coverage must fail closed.");
fallback([
  alternative("original", [2, 2], ["policy", "shield"]),
  alternative("other", [2, 2], ["policy", "different"])
], "Mismatched reply identities must fail closed even when the counts match.");
fallback([
  alternative("original", [2, 2], ["shield", "charged"]),
  alternative("other", [2, 2], ["shield", "charged"])
], "Every comparison must include the standard policy response.");
fallback([
  alternative("original", [2, 2], ["policy", "policy"]),
  alternative("other", [2, 2], ["policy", "policy"])
], "Duplicate original response identities must fail closed.");
fallback([
  alternative("original", [2, 2], ["policy", "shield"]),
  alternative("other", [2, 2], ["policy", "policy"])
], "Duplicate alternative response identities must not substitute for missing replies.");

for (const side of [0, 1]) {
  const alternatives = [alternative("original", [1, 1]), alternative("other", [2, 2])];
  alternatives[side].responses[1].complete = false;
  fallback(alternatives, "An incomplete branch on either choice invalidates the comparison.");
}

const sixResponses = ["policy", "shield", "charged", "combined", "fast", "wait"];
result = select([
  alternative("original", [1, 1, 1, 1, 1, 1], sixResponses),
  alternative("other", [2, 2, 2, 2, 2, 2], sixResponses)
]);
assert.equal(result.complete, true, "Exactly twelve continuations are within the deterministic budget.");
assert.equal(result.id, "other");
const sevenResponses = [...sixResponses, "extra"];
fallback([
  alternative("original", [1, 1, 1, 1, 1, 1, 1], sevenResponses),
  alternative("other", [2, 2, 2, 2, 2, 2, 2], sevenResponses)
], "Complete comparisons above twelve continuations must fail closed.");

for (const invalidOutcome of [NaN, Infinity, -Infinity, -1, 3, 1.5, "2", null, undefined]) {
  for (const side of [0, 1]) {
    const alternatives = [alternative("original", [1, 1]), alternative("other", [2, 2])];
    alternatives[side].responses[1].outcome = invalidOutcome;
    fallback(alternatives, `Reject invalid outcome ${String(invalidOutcome)} on either choice.`);
  }
}

console.log(`Strategic response selection passed: ${checks} pure contract checks.`);
