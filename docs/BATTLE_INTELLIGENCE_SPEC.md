# Battle Intelligence Specification

## Purpose

Battle Intelligence is the shared deterministic action-selection layer for PvPeak. It chooses an action from the latest authoritative battle state. It does not execute that action or own battle mechanics.

The canonical flow is:

```text
Authoritative Battle State
  -> Turn Resolution normalization and legal actions
  -> Battle Intelligence candidates
  -> cheap tactical rules and conservative pruning
  -> deterministic priority resolution
  -> optional bounded continuation
  -> selected BattleAction
  -> Unified Turn Resolution and battle mechanics
  -> updated authoritative state
```

## Responsibility Boundaries

### Battle State

The state is the only source of battle facts: turn, HP, energy, shields, stat stages, move progress, pending events, forms, delays and action order. UI state must not change legal or tactical conclusions.

### Battle Intelligence

Battle Intelligence may normalize actions, score candidates, reject objectively dominated actions, identify urgency, request bounded continuation and retain reason codes. It must not apply damage, spend energy, alter shields, apply effects or advance turns.

### Unified Turn Resolution

The Turn Resolution Engine owns legal actions, ready-side ordering, CMP, pending events, terminal outcomes and timing invariants. Existing battle mechanics execute damage, energy, shields, effects and form transitions.

Analysis and UI consume results and traces. They do not select production battle actions.

## Canonical Models

`BattleAction` has a stable `type`, `side`, optional `moveId`, target, timing and metadata. Supported types are `fast_move`, `charged_move`, `shield`, `no_shield`, `wait` and `switch`. No Pokemon-specific action type is allowed.

`ActionCandidate` contains:

- the canonical action;
- legal status;
- named priority class;
- source rule IDs;
- tactical and optional continuation scores;
- confidence;
- structured reason codes;
- whether continuation search is required;
- compact evidence.

## Priority Classes

Priority is resolved in this order:

1. legality and mandatory resolution;
2. immediate survival and guaranteed lethal;
3. outcome-changing effects;
4. continuation value;
5. resource efficiency;
6. stable fallback.

The same state, policy and game data must always select the same action. Stable action identity is the final tie breaker.

## Policies And Budgets

All policies use identical legal-action generation and mechanics.

| Policy | Primary use | Depth | Candidates | States | Decision budget |
| --- | --- | ---: | ---: | ---: | ---: |
| `FAST` | Normal Battle | 1 | 2 | 96 | 4 ms |
| `STANDARD` | Offline validation and broader analysis | 2 | 4 | 384 | 15 ms |
| `DEEP_REVIEW` | Explicit Scenario Review reconstruction | 4 | 6 | 2,000 | 75 ms |

The budgets are hard ceilings, not targets. Obvious actions return through the fast path before continuation search. Budget exhaustion uses a deterministic fallback.

## Initial Tactical Rules

- `BI_ONLY_LEGAL_ACTION`: use the sole legal progression.
- `BI_THROW_BEFORE_FAINT`: reconsider a legal Charged Move before pending lethal damage.
- `BI_REACHABLE_CHARGED`: include a useful lower-cost move when a higher-cost move is unreachable.
- `BI_GUARANTEED_LETHAL`: prefer the cheapest equivalent legal knockout.
- `BI_AVOID_LETHAL_OVERFARM`: reject another Fast Move when it gives the opponent a lethal action window.
- `BI_GUARANTEED_EFFECT`: preserve guaranteed-effect candidates for continuation comparison.
- `BI_CMP_AWARE`: use authoritative CMP ordering rather than arbitrary side order.
- `BI_SHIELD_POLICY`: respect explicit Always and No First shield policies.
- `BI_SHIELD_PREVENTS_KO`: shield a lethal Charged Move when policy permits it.
- `BI_SHIELD_PRESERVES_WIN`: use bounded shield/no-shield outcomes for Smart decisions.
- `BI_SHIELD_AVOIDS_FARM`: preserve a charged threat or avoid immediate farm range.
- `BI_TACTICAL_PLAN`: resolve structured bait, timing, overfarm and charged-continuation evidence into the final action.
- `BI_LEGACY_ADAPTER`: temporary compatibility boundary for ambiguous planner logic not migrated yet.

Rules adjust priority or request search. Only legality and mandatory state constraints may act as unconditional commands.

## Reason Codes

Rules emit the existing reliability vocabulary, including `LETHAL_MOVE_AVAILABLE`, `PENDING_FAST_IMPACT`, `FORCED_BY_OPPONENT_PRESSURE`, `BETTER_PROJECTED_OUTCOME`, `CMP_WIN_SETUP`, `MEMOIZED_RESULT` and `HEURISTIC_FALLBACK`.

Prose is generated only by trace consumers. Normal selection stores compact codes and evidence.

## State Hashing And Memoization

The strategic key includes policy, identities/forms, HP, energy, shields, stat stages, selected moves, ready turns, current turn, pending events, CMP state, delay state, battle policy and mechanic state. It excludes DOM and presentation state.

Only deterministic fast-path results are cached. Ambiguous tactical and continuation choices are deliberately not cached. Timing or pending-event changes produce a different key.

## Conservative Dominance Pruning

The first safe pruning rule removes a lower-damage Charged Move only when another move has the same energy cost and neither move has a guaranteed strategic effect. Residual energy, shield pressure, effects, CMP and timing-sensitive candidates must remain available.

## Adding A Tactical Rule

1. Reproduce the behavior with a generic fixture and, when useful, a real matchup regression.
2. Confirm the rule depends only on battle concepts, never a Pokemon name.
3. Assign a stable rule ID, priority class and existing or newly documented reason code.
4. Define trigger evidence and whether continuation is required.
5. Add conflict, determinism and policy-consistency tests.
6. Run focused suites, Golden Corpus and performance comparison.
7. Increment the planner version if observable action selection changes.
8. Review cache invalidation and offline dataset regeneration.

## Required Regression Coverage

Coverage must protect legal generation, each production rule, priority conflicts, deterministic selection, policy consistency, state-key invalidation, lag/no-lag separation, CMP ordering, guaranteed effects, pruning and budget fallback. Scenario Review must be tested with inherited HP, energy, shields and effects.

No broad golden expectation may be rewritten merely to make a refactor pass. Changed outcomes require individual investigation.

## Migration Status

Milestone 2 makes Battle Intelligence the final resolver for Fast/Charged and Shield/No Shield actions. Existing bait, timing, overfarm and charged-continuation code now supplies structured tactical evidence instead of executing an action directly. The Smart shield counterfactual is resolved by the same module.

Battle, Preview, matrix workers, offline generation, the Meta fallback and Scenario Review use the shared automatic battle loop. The compatibility adapter remains only for isolated fixtures and callers not yet supplying structured evidence; production browser battles no longer use it.

## Prohibition On Matchup Patches

Production code must never select an action by Pokemon or matchup name. Names belong only in regression fixtures. Rules must express generic concepts such as lethal access, guaranteed effects, timing windows, CMP, shield value and continuation quality.
