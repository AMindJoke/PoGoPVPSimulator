# Configured Shield Policy Coherence

Work started 2026-10-18; verified 2026-10-19. Local engine: `battle-planner-v49`. No commit, push, dataset regeneration or publication.

## Corrected Behavior

1. Strategic forecasts previously disabled Smart Shield refinement solely because they were forecasts. The same legal opening could predict a loss and win when actually executed. Shield recursion now has a separate counter: canonical strategic forecasts run the normal Smart decision, while shield leaf forecasts remain non-recursive.
2. Shield replay previously replanned the two opening actions with a smaller search budget. A different move caused the expected-action check to reject the forecast, silently leaving live Smart shielding to its heuristic. Replay now freezes both legal prepared actions, options and only the timing callback's primitive state changes. It preserves CMP shield prefixes, registered Fast impacts, form mechanics, missing actions, and legal wait validation.
3. Canonical forecasts also retain an opposing plan already prepared in the current round instead of choosing it again. The cache includes that plan. This is not foreknowledge of a later unprepared plan.
4. Sampled shield/no-shield responses bypass adaptive refinement only for the requested attack, so Smart cannot undo the diagnostic scenario. Always and No-first retain their configured behavior.
5. Configured-policy outcome remains the primary comparison. A tied projected loss/draw must not switch merely because a forced alternative opponent response can produce a win. Strict response-wise dominance is allowed only to protect an already projected configured-policy win. No human probabilities or species-specific rules were added.

The fifth rule fixes a real rejected intermediate regression: Skeledirge/Azumarill originally kept the Fast at T15; a broad Pareto tie-break switched to Torch Song because only the forced-shield scenario won, although both configured projections lost. Retaining the Fast preserves the actual winning adaptive line. Conversely the custom Florges mirror at 0/1 shields has two projected wins: Chilling Water preserves the win against the other legal reply, while Moonblast does not. Win-only protection keeps that useful debuff without treating every cheap debuff as beneficial.

## Work Bounds And Isolation

- At most 12 strategic continuation evaluations per actor per automatic round, shared between timing and move-order entry points.
- At most 16 shield leaf rollouts per canonical strategic continuation. Reserve shield/no-shield atomically in pairs. On exhaustion stop the continuation and return `complete: false`; never certify a heuristic fallback as a complete configured-policy forecast.
- At most 1,000 automatic rounds per rollout. No recursive strategic search and no shield search inside another shield leaf.
- Live top-level Smart shielding is not silently downgraded by the strategic branch budget.
- Restore combatants, timeline, pending impacts, turn state, opening objects, active contexts and both depth counters in `finally`. Tests verify diagnostics and reused workers do not change the battle.

## Verification

- 50 pure selector contracts cover configured outcome priority, win-only protection, losing/drawing ties, response coverage, invalid outcomes, budgets and mutation safety.
- 46 canonical forecasts versus actual forced-opening replays match their entire normalized battle ledger under the same subsequent action policy. Includes Cradily/Corsola, Skeledirge/Clodsire, Talonflame/Shadow Quagsire, explicit shield modes, sampled responses, diagnostics and reused workers.
- Those tests observe 1,164 ordinary shield forecasts with complete results and exact prepared root actions, plus 18 prior-shield CMP prefixes. Eight real Fast callbacks reproduce 32 timing field writes. Natural timing waits do not coexist with an opposing ready Charged action in these snapshots; waits have separate legality/selection coverage.
- 21 targeted timing battles preserve opposite timing choices, Florges/Kingdra, Cradily and CMP cancellation. Instrumented workers measured 71 strategic and 282 shield calls, with 252 completed inside strategy forecasts. Actual call counts agree with the reported budget. Forced limits of 0 and 2 verify atomic reservations, incomplete predictions and conservative fallback.
- Six concrete configured-line scenarios cover Skeledirge/Azumarill, the custom Florges mirrors, and the historical Talonflame openers against Shadow Quagsire, Guzzlord and Galarian Corsola. Forced alternatives use the identical battle prefix; actual Smart decisions have complete forecasts, not heuristic fallback.
- Automatic quality: 13 matchups/313 alternatives; core battle regressions 12/12; continuation isolation 16 cases; shield mechanical parity 17 cases/88 forecasts. Reliability, pending Fast mechanics, special forms, Mega, timing guards, turn engine, principle trace/registry, PWA and Team Builder candidate suites pass.
- The old 30-case golden corpus still has the exact same eight failure records in v48 and v49. The previously documented Marowak timing deadline test is not rewritten. These historical expectation issues remain separate.

## Differential Audit

Raw report: `reports/strategy-shield-policy-20261018.json`.

Baseline is the exact local v48 worker saved before this work, SHA-256 `910ff6fddf6da95b1be88602ec20991ca515d796ecf92339f401226a8ae1916f`. Both engines use identical data/mechanics dependencies. On 1,385 distinct configurations:

| Metric | Result |
|---|---:|
| Configurations with changed outcome or resource score | 19 |
| Outcome flips favorable to the first changed decision's side | 1 |
| Outcome flips unfavorable to that side | 5 |
| Unresolved flips | 0 |
| Resource-only changes | 13 |
| Trace/terminal failures | 0 |
| v48 / v49 total time | 27.466 / 30.929 seconds |
| v48 / v49 p95 | 61.30 / 74.84 ms |
| v48 / v49 maximum | 145.32 / 337.65 ms |

Aggregate runtime rises 12.6% in this local Node/VM run. Tail latency also increases; these are not phone measurements or a guarantee for a large Team Builder job.

The raw A/B audit exits nonzero because it conservatively labels those five unfavorable flips as regressions; those records were not hidden or rewritten. All five belong to three pairs (orientation counts separately):

- Talonflame/Shadow Quagsire, Smart 1-1: the previous Fly opener also loses when actually forced under corrected Smart. Quagsire takes Fly and retains its shield for Brave Bird, rather than shielding Fly through an incomplete replay fallback.
- Talonflame/Guzzlord, Smart 1-1: the same-prefix forced Fly likewise loses under complete Smart forecasts; this is not an available old winning opener being ignored.
- Shadow Talonflame/Galarian Corsola, Smart 1-1: the old Flame Charge T15 opener also loses when forced with the same prefix. Corsola's complete Smart forecast takes Flame Charge and conserves its shield.

These are reviewed changes under corrected shield behavior, not proof that either side now plays optimally. The gained configuration is Skeledirge/Clodsire Smart 1-1: the normal forecast now recognizes the winning extra-Fast line. Cradily/Corsola 2-2 did not flip outcome because it already won live; its previously wrong Grass Knot projection is now correct.

## Remaining Limits And Publication

Strategic forecasts still disable subsequent strategic refinement. Shield leaf forecasts disable further shield refinement. Therefore exact forecast/live parity applies only when the subsequent action policy is the same; this is not full minimax or a universal prediction guarantee. An opposing plan already prepared at the root is preserved, but an unprepared opponent can still choose differently when later evaluated with full strategic refinement.

The self-buff timing scope remains limited; this work does not broaden debuff timing or introduce matchup patches. More accurate future action-policy prediction and phone/large-job performance warrant a separate measured change.

At the time of this audit, rankings and key matchups still identified `battle-planner-v46`, so the release gate rejected them. This was subsequently resolved by real v49 regeneration and independent saved-score replays; see `reports/prepush-v49/verification.md`. Legacy aggregate datasets were not relabeled as current results. The reviewed outcome changes remain relevant when assessing the release.

Principal checks:

```sh
npm run test:battle-intelligence
npm run test:strategic-continuations
npm run test:shield-policy-parity
node tools/test-automatic-battle-quality.js
node tools/test-shield-continuation-parity.js
node tools/audit-strategic-move-order.js --baseline-source=<saved-v48-worker.js> --output=reports/strategy-shield-policy-20261018.json
```
