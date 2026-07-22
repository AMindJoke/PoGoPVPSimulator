# Matchup Planner Audit

## Scope

This audit freezes the pre-planner behavior and follows the automatic 1v1 path used by Battle, Matrix, Offline generation, and Scenario Review. It does not change normal battle strategy.

Primary fixture:

- Shadow Quagsire vs Galarian Corsola
- default Great League IV profiles
- Mud Shot, Aqua Tail, Mud Bomb
- Astonish, Night Shade, Power Gem
- 2 shields each
- 0 starting energy
- Selective baiting and Always shield logic

## Current Call Path

1. `PogoPvp.html:runAutomaticBattleToEnd()` repeatedly calls `automaticBattleStep()`.
2. `automaticBattleStep()` obtains the ready actors from `orderedBattleActors()` and calls `autoAction()` once per actor.
3. `autoAction()` reads canonical legal actions through `legalBattleActions()` and the Unified Turn Resolution API.
4. `selectBattleIntelligenceAction()` adapts those actions for `src/battle/battle-intelligence.js:selectAction()`.
5. Battle Intelligence scores immediate evidence and may call the continuation callback.
6. `simulateBattleIntelligenceContinuation()` clones the mutable battle globals, applies one candidate action, and lets the existing automatic AI finish the battle.
7. The selected canonical action is executed through `useFast()`, `useCharge()`, or `useTimingWait()`.

Battle Intelligence is the strategic selection boundary. Unified Turn Resolution remains the legal-action and turn-order boundary.

## Answers to the Decision Audit

### 1. Generated actions

`src/battle/turn-resolution-engine.js:getLegalActions()` generates one Fast Move and every affordable Charged Move for a ready side. `PogoPvp.html:buildChargeTimingWaitAction()` may add a one-turn Wait candidate at a narrow alignment window.

Shield and no-shield choices are selected separately by `selectShieldAction()` while resolving a Charged Move. Switching is not part of this 1v1 path.

### 2. Throw now and Fast then throw

They are explicit only when `shouldEvaluateChargedTimingContinuation()` returns true. Throw-now is a Charged Move candidate. Fast-then-throw is represented as the current Fast Move plus `timingFollowUpMoveId` metadata in the cloned rollout. A one-turn Wait may also be included.

This is not a persistent plan. The future Charged Move is temporarily forced only inside the rollout, and normal execution re-plans after the Fast Move.

### 3. Candidates receiving continuation search

Only candidates marked `requiresContinuationSearch` are searched, except the PCSV charged comparison. Timing comparisons retain a small set of Fast, Wait, and Charged candidates. Many ordinary Fast-versus-Charged decisions still use immediate evidence only.

### 4. Maximum and effective horizon

Declared policy depth is FAST 1, STANDARD 2, and DEEP_REVIEW 4 in `src/battle/battle-intelligence.js:POLICIES`.

The continuation callback does not consume `maxDepth`. It applies one explicit root action, disables nested charged continuation with `chargedContinuationDepth`, then rolls the local heuristic AI to terminal state or 1000 automatic steps. Effective strategic search depth is therefore one chosen action followed by a heuristic rollout, not a depth-1/2/4 adversarial tree.

### 5. Equivalent depth

`boundedContinuation()` guarantees a minimum number of comparable candidates for timing decisions, but each candidate still receives only one explicit action followed by the same heuristic rollout. Time and state budgets can stop later candidates after that minimum.

### 6. Termination

Rollouts terminate on faint, no progress, or 1000 automatic steps. Candidate iteration terminates on policy state/time budgets after the minimum comparable set.

### 7. Opponent response

The opponent is not searched adversarially. It calls the same local `autoAction()` heuristic during the rollout.

### 8. Symmetric planning quality

Both sides use the same local rules, but neither side performs nested strategic search while a continuation is being evaluated. This is symmetric heuristic play, not symmetric best-response search.

### 9. Heuristic application

Immediate evidence is assembled in `battleIntelligenceCandidateEvidence()`. Rule priority, tactical components, continuation penalties, PCSV, timing evidence, bait logic, overfarm logic, and move-specific effects feed `selectAction()` and `compareCandidates()`.

### 10. Terminal winner information

`simulateBattleIntelligenceContinuation()` derives win/draw/loss at rollout termination. PCSV encodes outcome with a large scalar prefix. Other continuations expose a perspective score and outcome label.

### 11. Can heuristics override outcome class?

Yes. `compareCandidates()` compares `priorityClass` before `continuationScore`. A candidate in a stronger priority class can outrank a proven better terminal outcome. Outside PCSV, continuation is also a scalar. There is no shared lexicographic `Win > Draw > Loss` comparison object.

### 12. Pending Fast Move impacts

Unified Turn Resolution supports pending Fast impacts for technical Scenario Review events. Normal Fast Move damage and energy are currently applied by `useFast()` when the action is recorded; their duration controls readiness and timeline geometry. This audit treats that as current canonical application behavior and does not rewrite it.

### 13. Shields, CMP, and effects

- Shields: selected during `useCharge()` through configured policy or Battle Intelligence shield logic.
- CMP: actor order comes from Unified Turn Resolution attack ordering.
- Guaranteed buffs/debuffs: included in candidate evidence and canonical Charged resolution.
- Self-debuffs: handled by charged-choice evidence and line-policy helpers.

These mechanics are present, but shield decisions are not branches in an adversarial search tree.

### 14. Residual energy

PCSV rewards final raw energy. The matrix scorer also values readiness. Neither layer proves that residual energy is actionable before faint. Shadow Quagsire's baseline 31 energy is stranded but still contributes as a resource signal.

### 15. Future Charged count

Some helpers estimate charged reachability and PCSV counts Charged events after a rollout. The search does not explicitly branch on meaningful future Charged breakpoints, so an extra Fast Move can change the reachable Charged count without being discovered if the heuristic rollout leaves that line.

### 16. Exact fixture divergence

The current baseline is:

- Quagsire Aqua Tail: T8, T17, T25, T33
- Corsola Night Shade: T18, T26, T40
- Corsola wins; Quagsire faints with 31 stranded energy; Corsola has 27 HP and 5 energy.

A legal winning line under the same project mechanics is:

- Quagsire Aqua Tail: T8, T17, T30, T37, T44
- Corsola Night Shade: T21, T34
- Quagsire wins with 19 HP and 5 energy; Corsola faints with 50 energy.

The first full-line divergence is Corsola's T18 decision. The local rollout throws Night Shade immediately, while the verified candidate line continues Astonish to T21. Quagsire's subsequent decisions then diverge: the baseline never reaches the fifth Aqua Tail.

This does not yet prove that the verified line survives every rational Corsola response. It proves independently that a legal winning line exists and that the current one-action-plus-rollout model cannot discover or compare the complete strategic alternatives.

## Recent Timing Rules

| Rule or helper | Classification | Migration note |
| --- | --- | --- |
| `perfectChargeTimingWindow()` | Generic strategic evidence | Keep as candidate-generation evidence, not an outcome bonus. |
| `chargeTimingWaitWindow()` / `buildChargeTimingWaitAction()` | Generic legal timing representation | Can become a strategic candidate boundary. |
| `BI_TIMING_CONTINUATION` | Temporary compensation | Becomes obsolete when full strategic lines receive equal search. |
| `BI_TIMING_VALUE` and timing components | Duplicated/compensating heuristic | Must not outrank proven outcomes. |
| first-perfect-window branch in `shouldEvaluateChargedTimingContinuation()` | Generic trigger with patch-shaped scope | Useful fixture trigger; review after planner authority. |
| `timingPlanMoveId` | Temporary continuation metadata | Replace with non-stale plan metadata and re-planning. |
| PCSV weighted scalar | Generic sequence evidence | Retain as a same-outcome tie-break only, never as outcome ordering. |

## Root Cause

The current system compares one explicitly chosen action followed by a locally greedy terminal rollout. It does not search complete strategic lines, does not ask for an opponent best response, and does not order terminal outcomes lexicographically before heuristics. Timing bonuses cannot repair this because the missing information is several decision nodes later.

## Migration Boundary

The next implementation step should add a planner model and explicit outcome vector without enabling it by default. The deterministic fixture in `tools/test-matchup-planner-fixture.js` is the safety gate for that work.
