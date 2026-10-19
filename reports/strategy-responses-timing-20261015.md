# Strategy Responses And Timing, 2026-10-15

Implemented locally as `battle-planner-v48`, after the v47 move-order review. No publication or ranking regeneration is included in this change.

## Changes

- Compare the same small set of opponent response scenarios for each candidate action: configured policy, shield/no-shield only for Smart Shield, and at most one other currently legal Charged reply. Respect farm-energy, bait-off and force-straight policies.
- Prefer the standard projected outcome class (win, draw, loss). For equal standard outcomes, change the choice only for a strict response-wise improvement. Keep the original choice on tied or crossing responses; do not invent bait probabilities or optimize a scalar HP/energy bonus.
- Reconsider the timing of an affordable guaranteed self-buff around Fast Moves lasting at least three turns. Compare throw now, one additional Fast followed by normal replanning, and an already legal one-turn alignment wait. A selected non-buff Charged Move does not activate this timing search merely because a buff exists elsewhere in the moveset.
- Exclude tactical/availability/farm decisions, form transitions, capped/non-beneficial effects, overflow and pending lethal Fast damage. Existing timing limits still apply.
- Resolve every root choice through the complete canonical round, including CMP, registered Fast impacts and form mechanics. A legally registered charge canceled by an earlier CMP KO is a completed losing continuation, not a failed search.
- Share a per-round cache between comparison entry points. At most twelve actual continuation evaluations per actor per round, at most three actions and four response scenarios, at most 1,000 automatic steps per continuation. Incomplete comparisons preserve the original choice; nested strategic search is disabled.

The live page and generated Battle/Matrix/offline workers include the same helpers. Engine and browser cache identities are updated; old results are not relabeled.

## Measured Results

Baseline: exact local v47 worker snapshot saved before phase 2, SHA-256 `763c6ec1a7bf0aeed95e8300bb8a9d324dde14a1bcff34a510ad3b66c80c67b4`. Both versions use identical data/mechanics dependencies. The corpus matches the preceding review: automatic-battle cases plus ten attackers against the first eight ranked opponents, both orientations, Smart/Always and 0/1/2 shields, with duplicate configurations removed.

| Metric | Result |
|---|---:|
| Distinct configurations | 1,385 |
| Better outcome for the side making the first changed decision | 11 |
| Worse outcome for that side | 0 |
| Unresolved outcome flips | 0 |
| Resource-only changes, not classified as better/worse outcomes | 9 |
| Trace/terminal-state failures | 0 |
| v47 / v48 total time | 26.114 / 29.467 seconds |
| v47 / v48 p95 per battle | 58.65 / 65.99 ms |
| v47 / v48 maximum per battle | 153.69 / 145.52 ms |

The measured total overhead is 12.8%. These are local Node/VM timings, not a phone benchmark. Counts include distinct orientation/shield configurations, not eleven unique species pairs. No observed outcome regression in this corpus is not proof of optimal play, and resource-only changes can still be worse.

Examples:

- Skeledirge/Dewgong, Smart 1-1: Torch Song at turn 15 wins instead of another Incinerate.
- Skeledirge/Galarian Corsola, Smart 1-1: the opposite timing decision matters; preserve the additional Fast at turn 19 and replan afterward.
- Shadow Talonflame/Dewgong, 0-0 and 1-1: earlier Flame Charge changes the closing race. Consequently the old Dewgong win after Drill Run is not preserved when Talonflame can improve its own response.
- Cradily/Galarian Corsola, Smart 2-2: preserve Grass Knot at turn 15. A wider prototype including opponent-debuff timing regressed this pair; that prototype was rejected, not shipped.
- Florges/Kingdra and Shadow Kingdra: targeted tests preserve the earlier Moonblast correction.

Raw changes and timing samples: `reports/strategy-responses-timing-20261015.json`.

## Verification

- Forty pure response-selection checks: outcome priority, Pareto ties, response sensitivity, incomplete/mismatched/duplicate coverage, invalid outcomes, no mutation, and the twelve-branch boundary.
- Fifteen synthetic timing-protection fixtures and five positive/boundary/fallback cases verify actual callback eligibility, all three legal timing choices, capped effects, exact 100-energy boundary, and preservation of immediate lethal/farm/form policies.
- Targeted integration checks: nineteen battles, fourteen timing comparisons and three Charged-order comparisons; explicit shield policies, bait-off, both orientations, reused workers, diagnostics, swing and flip-analysis isolation.
- Instrumented canonical worker: forty-five actual continuation calls across four additional matchups stay within the actor/round budget without changing the visible battle. A separate CMP probe verifies a canceled legal charge retains unspent energy and restores the outer state.
- Automatic quality: thirteen matchups and 313 legal alternatives, with no missed win/draw in that gate. Core regressions 12/12; continuation isolation sixteen cases; reliability, pending-Fast, special forms, Mega, turn engine, timing guards, fast-close, principle registry/trace, PWA and Team Builder candidate tests pass.
- Pinned first-decision parity: 640/640 states. With runtime continuation callbacks, TIMING-011 and MOVE-040 are documented intentional adaptations, not exact reference parity.
- Shield continuation mechanical parity: seventeen cases, eighty-eight forecasts/replays. This test disables adaptive shield and strategic refinement in both forecast and replay, so the compared future policies are identical. It does not certify full adaptive-policy prediction.
- The older golden corpus remains 22/30 with the exact same eight failure records in v47 and v48. The Marowak timing regression test also already fails on HEAD and v47: both normal/Shadow Marowak throw Bone Club at turn 18, not its historical turn-12/15 deadline; v48 has identical actions, HP, energy and outcome. These expectations were not rewritten for a green result.

Principal commands:

```sh
npm run test:strategic-continuations
node tools/test-battle-intelligence.js
node tools/test-automatic-battle-quality.js
node tools/test-continuation-isolation.js
node tools/test-shield-continuation-parity.js
node tools/audit-strategic-move-order.js --baseline-source=<saved-v47-worker.js> --output=reports/strategy-responses-timing-20261015.json
```

## Limits And Publication

This is sampled one-level response analysis, not full minimax. The alternative opponent charge is applied only at the root; shield/no-shield modifies the actor's first future charge. Their cross-product and later opponent timing deviations are not searched. The trace marks response-sensitive choices rather than assigning a probability to them.

Future Smart Shield counterfactual search is simplified inside continuations. In particular Skeledirge/Clodsire Smart 1-1 still misses a winning additional-Incinerate line because the projection and subsequent live shield policy can disagree. Restricting timing to self-buffs limits the initial rollout but does not solve that underlying prediction mismatch. More nested search needs a separate accuracy/performance study.

Published rankings, key matchups and saved datasets still carry `battle-planner-v46`. The release gate `tools/test-current-meta-release.js` correctly fails against v48. Regenerate and verify them before publication; do not promote this engine together with stale results or change their version labels without recalculation. No commit or push was made.
