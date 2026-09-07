# 2026 Trainer Battle mechanics audit

## Scope

The audit started after `git pull --ff-only origin main` at `29a676d98d3900ad5a5806aaf0af4a858a9eaafb` (`Prepare Twilight Trails season promotion workflow`). The pull was already up to date. No season data, provisional move values, rankings, matchup caches, scoring, or planner heuristics were changed.

## Architecture reviewed

- `src/battle/turn-resolution-engine.js` is the shared event layer. It keeps Fast impacts pending, orders same-turn events as Swap, Charged, Fast impact, then state transition, denies impacts from fainted sources, and supports zero-turn post-Charged swaps through the manual timing/switching modules.
- `PogoPvp.html` is the live automatic and Manual/Scenario Review runtime. Its matrix worker is generated from the same runtime functions, so the mechanics path is shared rather than patched separately.
- `src/battle/battle-intelligence.js` consumes pending-event state for decisions; it was not modified.

## Finding: pending Fast damage timing

The audit proved the primary bug. Pending events stored a finalized numeric `damage` at Fast registration, and `resolveFastImpact` / `resolveDueFastImpacts` later subtracted that snapshot. Therefore a target Defense change between registration and impact was ignored.

### Test A

Fixture: a 3-turn Fast starts at T0 and impacts at T2; the target is at Defense stage 0 in the control and stage -2 before impact in the test case.

- Fast start: T0.
- Charged trigger/resolution window: before T2.
- Defense: 0 -> -2.
- Registration damage: 10.
- Control impact damage: 10; target HP 100 -> 90.
- Post-self-debuff impact damage: 15; target HP 100 -> 85.

The old behavior was pre-debuff snapshot damage. The generic fix preserves `damageAtRegistration` for trace/audit but recalculates final damage at impact using the current source, active target, move, and stat stages.

## Damage transfer and ordering

### Test B

For a 5-turn Fast started at T0 (impact T4), a switch resolving at T3 is ordered before the impact and the damage lands on the incoming active Pokemon. A boundary case with the outgoing active identity at T4 receives the due impact itself, so a later switch cannot retroactively transfer it. This matches the one-turn-before-impact transfer boundary.

### Test C

Existing deterministic coverage confirms post-Charged switching is available to either side, costs 0 turns, is consumed independently, closes on the next battle action, and falls back to the normal 1-turn cost outside the window. Pending Fast timing remains compatible with the window.

### Test D

The event order remains `SWAP -> CHARGED_ACTION -> FAST_IMPACT -> STATE_TRANSITION`, while input registration still gives Charged priority over Fast. No `EVENT_PHASE` change was necessary.

## Strict-DRE and planner freeze

Regression coverage passed for same-turn Charged registration, lethal pending Fast, denied Fast after source KO, long Fast/Incinerate timing, Furret vs Shadow Talonflame fast-close, post-Charged switching, and planner QA. The battle-intelligence audit reported 1,858/1,858 intelligence-owned decisions, runtime coverage 100%, and 0 legacy fallback decisions. Planner heuristics, scoring, search, shield policy, and cache strategy were not modified.

Automatic and Manual/Scenario Review use the same resolver contract; the new mechanics fixture asserts equal impact damage and HP for both entry points.

## Changes

- Added impact-time damage resolver support to the shared turn engine.
- Added current attack/Defense stage and active Pokemon identity to runtime event state.
- Routed automatic matrix worker, Manual runtime, and DRE reconstruction through the impact-time resolver.
- Preserved registration damage separately for traceability.
- Added generic deterministic regression coverage for self-debuff timing, incoming-Pokemon transfer, the latest transfer boundary, and automatic/manual parity.
- Bumped `battle-planner-v39` to `battle-planner-v40`, updated script cache-busters, and bumped the service-worker cache to `20260907-v24-pending-fast-impact`.

No Current/Next season promotion or matchup/meta/ranking regeneration was performed. Existing generated datasets remain marked with their previous engine version and will require regeneration later before being considered canonical under v40.
