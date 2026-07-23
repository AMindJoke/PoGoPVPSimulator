# Hybrid Battle Intelligence Audit

## Scope and frozen baseline

This audit follows the automatic 1v1 path on `perf-debug-work` at `f6975d6`
before the hybrid policy changes. Unified Turn Resolution remains the mechanics
authority. The audit concerns strategic selection only.

Measured on 2026-07-23 with the bundled Node runtime:

- Golden Planner corpus: 22/30 passed, 8 failed, 15,798 ms simulation time.
- Reliability corpus: 5/7 passed, 2 failed, 2,496 ms.
- Quagsire/Corsola fixture: red; the automatic Aqua Tail turns were
  `8, 17, 34, 37, 44`, while the locked expectation was `8, 17, 30, 37, 44`.
- Known weak categories: shield-dependent, extra-Fast flips, energy management,
  closing moves, and cheap-move-versus-nuke.

## Production call path

```text
runAutomaticBattleToEnd()
  -> automaticBattleStep()
  -> orderedBattleActors()                       Unified Turn Resolution
  -> autoAction()
  -> legalBattleActions()                        Unified Turn Resolution
  -> selectBattleIntelligenceAction()
  -> PvPeakBattleIntelligence.selectAction()
  -> immediate tactical rules
  -> battleIntelligenceCandidateEvidence()
  -> optional cloned terminal continuations
  -> selected canonical action
  -> useFast() / useCharge() / useTimingWait()
  -> resetCooldownsAfterChargedTurn()
```

The Matrix worker embeds this same path. Interactive Battle and Scenario Review
run it on the main thread; Matrix and offline cells run it inside workers.

## Decision and override inventory

### Fast versus Charged selection

1. Unified Turn Resolution generates Fast plus every affordable Charged Move.
2. `autoAction()` may execute a diagnostic fixture action.
3. A persisted timing micro-plan may force a Fast or a previously planned
   Charged Move.
4. `PvPeakBattleIntelligence.selectAction()` selects among canonical actions.
5. Missing planned Charged legality falls back to Fast.
6. DRE reconstruction retains a separate explicit technical action path; it is
   not normal automatic strategy.

### Selection overrides

- sole legal action;
- immediate unshielded lethal;
- technical pending lethal Fast impact;
- optional matchup plan, but only when enabled and terminally proven;
- candidate priority class before continuation value;
- persisted timing-plan follow-through;
- diagnostic plans in test/worker payloads;
- shield policy during `useCharge()`;
- canonical faint, energy, CMP, form, and technical-event resolution.

### Timing rules

- `perfectChargeTimingWindow()` rewards the final active opposing Fast turn.
- `chargeTimingWaitWindow()` can add a one-turn Wait action.
- `shouldEvaluateChargedTimingContinuation()` admits at most two extra Fast
  Moves, rejects energy overflow, immediate lethal, lethal incoming Fast damage,
  and an already-ready unshielded opponent Charged Move.
- `chargeTimingWaitReason()`, `betterChargedWaitReason()`,
  `shieldedResidualOverfarmReason()`, and `shouldOverfarmForCloser()` add
  overlapping scalar timing or energy evidence.
- A selected timing continuation can persist `timingPlanMoveId` and
  `timingPlanFastMovesRemaining` across re-planning.

These rules are generic, but they overlap and are ordered. They do not return one
shared structured timing evaluation.

## Planning and continuation inventory

| Function | Role | Effective search |
| --- | --- | --- |
| `boundedContinuation()` | Battle Intelligence candidate comparison | One explicit action plus terminal heuristic rollout |
| `simulateBattleIntelligenceContinuation()` | Fast/Charged/Wait continuation | Deep clones global combatants and runs local AI to terminal |
| `simulateBestChargedTimingContinuation()` | Throw-now versus 1-2 Fast/Wait plans | Multiple terminal rollouts |
| `simulateChargedCandidateContinuation()` | Guaranteed-effect comparison | Forced opening plus terminal rollout |
| `simulateShieldDecisionContinuation()` | Shield/no-shield counterfactual | Two terminal rollouts |
| `bestNoShieldChargedPlan()` | Local offensive route | Bounded 360-state shortest-KO search |
| `PvPeakMatchupPlanner.search()` | Iterative-deepening minimax | Disabled by default; 600/5,000/50,000 node policies |

The Battle Intelligence `maxDepth` values do not control terminal rollout depth.
Rollouts can execute up to 1,000 automatic steps while nested strategic
continuations are disabled.

## Scalar scores and bonuses

`battleIntelligenceCandidateEvidence()` currently combines independent numbers
for immediate damage, energy gain, DPE, CMP, bait value, line policy, future
damage, shield pressure, timing, timing alignment, overfarm, direct pressure,
self-debuff risk/avoidance, guaranteed effects, and generic risk.

`projectedChargedSequenceValue()` then scalarizes outcome and resources with
million/120k/90k/18k/9k/8k/5k prefixes. `compareCandidates()` compares:

1. priority class;
2. continuation scalar;
3. timing score;
4. tactical scalar;
5. stable action order.

Consequently, a stronger priority class can outrank a proven better terminal
outcome. Raw remaining energy also receives value without proving it is
actionable.

## Caches

- Battle Intelligence fast-path cache: 2,048 entries, module lifetime.
- Matchup Planner candidate cache: 4,096 entries, module lifetime.
- Live matchup transposition table: cleared above 50,000 entries.
- Matrix memory cache: 900 cells.
- IndexedDB Matrix cache: engine-versioned.
- Matrix signature/config caches and worker config cache.

The expensive cloned rollout results are not shared as a compact offensive
transposition cache across a Matrix.

## Fallbacks and unequal depth

- No actions: no selection.
- Sole/Fast-only legal action: deterministic fast path.
- Missing intelligence API: legacy fallback unless strict mode rejects it.
- Incomplete matchup plan: discard plan and return to weighted resolver.
- Missing planned Charged Move: Fast.
- Budget exhaustion in `boundedContinuation()`: later candidates can remain
  unevaluated after a minimum comparison set.
- Candidate types get different depth: ordinary Fast often gets no
  continuation; Charged, timing, effect, PCSV, and shield candidates may each
  launch terminal rollouts.

## Opponent approximation

- Terminal continuations use the same local automatic policy for the opponent,
  not a rational best-response branch.
- Shield choice is a fast heuristic except for Smart states that trigger two
  terminal rollouts.
- `bestNoShieldChargedPlan()` models only the acting side's offensive route.
- The disabled Matchup Planner is adversarial, but its live adapter repeatedly
  clones runtime state and its bounded evaluator labels nonterminal horizons as
  draw-like.

## Matrix cost and thread ownership

The nine base Matrix cells run in the compute worker. Worker configuration is
cached and shared static data is no longer retransferred per cell. The main
thread handles configuration, queueing, result rendering, and optional Swing
enrichment.

The strategic hot spots inside each worker cell are:

- repeated JSON deep clones of both combatants and timeline;
- terminal rollouts for Charged, timing, PCSV, and shield candidates;
- repeated canonical damage calls during those rollouts;
- repeated state serialization/hashing;
- Smart shield counterfactuals nested inside battle simulations;
- up to 1,000 automatic steps per continuation.

Interactive Battle and Scenario Review can perform the same continuation work on
the main thread, which can create long tasks even though Matrix cells themselves
are worker-owned.

## Classification and migration decision

| Current logic | Classification | Hybrid disposition |
| --- | --- | --- |
| Unified Turn Resolution, damage, energy, CMP, effects, forms | Canonical mechanics | Preserve unchanged |
| Lethal and technical pending-impact gates | Generic tactical rule | Normalize and extend |
| `bestNoShieldChargedPlan()` | Strategic search | Replace with shared compact route planner |
| Perfect/window timing helpers | Timing rule | Feed one structured guarded evaluator |
| Worker config/signature caches | Performance optimization | Preserve |
| Timing-plan forcing and continuation-opening globals | Obsolete compensation | Remove after hybrid parity |
| Multiple overfarm/timing bonuses | Duplicated rule | Replace with route/timing evidence |
| Priority-before-outcome comparison | Unsafe heuristic | Replace with outcome-first comparison |
| Full terminal rollout at routine Charged nodes | Unsafe heuristic/performance defect | Make ambiguity-only |
| Species identifiers in fixtures only | Test data | Preserve; none allowed in production policy |

## Root causes

Poor decisions come from missing multi-action route information followed by
ordered scalar compensations. The engine sometimes compares complete terminal
rollouts, but candidate classes are unequal and the opponent is locally greedy.
The Matrix slowdown comes from using those cloned terminal rollouts as the
ordinary planner instead of a compact bounded baseline.

The migration target is therefore:

```text
canonical legal actions
  -> cheap Fast default and tactical gates
  -> bounded compact offensive routes with dominance pruning
  -> structured guarded timing and farm-down
  -> ambiguity test
  -> selective equal-treatment opponent responses
  -> lexicographic outcome comparison
  -> canonical execution and deterministic re-plan
```
