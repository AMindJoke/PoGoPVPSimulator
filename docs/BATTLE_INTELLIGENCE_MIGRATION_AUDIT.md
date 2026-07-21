# Battle Intelligence Migration Audit

Audit date: 2026-07-21

## Executive Summary

Unified Battle Intelligence is the sole owner of automatic strategic decisions.
Normal Battle, Matrix, Offline generation, Scenario Review, and Preview all use
the same action-selection API and candidate model.

- **Static call-site coverage:** 13 of 13, **100%**.
- **Runtime ownership:** 7,540 of 7,540 observed automatic decisions, **100%**.
- **Legacy strategic fallback:** **0**.
- **Strict mode:** passes with runtime coverage 1.0 and zero rejected fallback.
- **Golden parity:** 18 of 21 cases pass. The three failures are pre-existing
  planner weaknesses, not migration regressions.
- **Focused tactical regressions:** 7 of 7 pass.

## Authoritative Flow

```text
Battle / Matrix / Offline / Scenario Review / Preview
  -> runAutomaticBattleToEnd()
  -> automaticBattleStep()                  [Unified Turn Resolution]
  -> autoAction()
  -> selectBattleIntelligenceAction()
  -> PvPeakBattleIntelligence.selectAction()
       -> legal candidate generation
       -> independent candidate evidence
       -> optional bounded continuation
       -> final comparison across every legal candidate
  -> useFast() / useCharge()                 [canonical mechanics]
```

Shield selection uses the same boundary:

```text
useCharge()
  -> shieldDecisionForMove()
  -> PvPeakBattleIntelligence.selectShieldAction()
  -> canonical shield and damage resolution
```

## Ownership Matrix

| Decision category | Owner | Status |
|---|---|---|
| Fast vs Charged | Unified Battle Intelligence | Migrated |
| Charged Move choice | Unified Battle Intelligence | Migrated |
| Guaranteed lethal / throw before faint | Unified Battle Intelligence | Migrated |
| Bait and shield pressure | Unified Battle Intelligence | Migrated |
| Overfarm and move timing | Unified Battle Intelligence | Migrated |
| Strategic CMP setup | Unified Battle Intelligence | Migrated |
| Guaranteed buff/debuff valuation | Unified Battle Intelligence | Migrated |
| Self-debuff sequencing | Unified Battle Intelligence | Migrated |
| Bounded continuation comparison | Unified Battle Intelligence | Migrated |
| Shield / no shield | Unified Battle Intelligence | Migrated |
| Actor order, impacts, KO, CMP resolution | Unified Turn Resolution | Mechanics boundary |
| Manual controls | User | Intentional manual policy |
| DRE / one-turn-lag reconstruction | Scenario Review technical policy | Intentional forced policy |

Candidate evaluation returns structured score components, rule IDs, reason
codes, confidence, and player-readable reasons. Continuation search enriches
candidates; it does not bypass the final comparison or exclude legal Fast Move
alternatives.

## Runtime Proof

Run:

```powershell
npm run audit:battle-intelligence
```

The audit verifies:

- all 13 known automatic strategic call sites route through BI;
- every observed automatic decision is intelligence-owned;
- no `legacy-fallback` decision is emitted;
- strict mode completes without fallback;
- Battle, Matrix, Offline, Scenario Review, and Preview produce identical output
  for the shared context-parity fixture;
- pending Fast Move lethal windows remain BI-owned.

Representative results include guaranteed Defense buffs, guaranteed Attack
debuffs, straight play, Smart shielding, winning CMP setup, credible bait and
self-debuff avoidance, and extra-Fast-Move flips.

## Legacy Code Classification

Some compatibility helpers remain in `PogoPvp.html`, including the old charged
planner and continuation simulator. They no longer select normal automatic
actions. Their remaining uses are limited to evaluation support, diagnostics, or
explicit Scenario Review technical reconstruction. In particular:

- `autoAction()` has no `chargedContinuationOpening` execution path;
- `timingPlanMoveId` no longer executes an automatic strategic choice;
- normal charged selection does not call `chooseChargedMoveDecision()`;
- the remaining direct charged planner call belongs to DRE reconstruction.

These helpers can be deleted in a later cleanup after their diagnostic and
technical consumers are separated. Their presence is not runtime ownership.

## Result Parity

The migration currently passes 18 of 21 Golden cases. The unresolved cases are:

- `cheap-vs-nuke-shadow-quagsire-corsola-0s`
- `energy-kingdra-carbink-1s`
- `closing-quagsire-corsola-0s`

The migration also corrected two regressions discovered during verification:

- continuation search no longer ignores a winning Fast Move CMP candidate;
- equal-cost lower-damage moves are not pruned when the stronger alternative has
  a harmful self-debuff, preserving credible bait and safe sequencing.

## Performance

The complete 21-case ownership audit runs in roughly 0.8-1.0 seconds on the
local bundled Node runtime after warm-up. Aggregate audit counters are retained
in production; detailed event retention remains debug-only. Focused tactical
regressions complete in roughly 0.35-0.45 seconds.

## Charged Timing Follow-up

Charged timing now has an explicit candidate model rather than being only a
penalty on a charged move. `THROW_NOW` is compared with
`FAST_THEN_REEVALUATE` from the same cloned canonical state. Timing intent is
part of the strategic state key, so a cached pre-Fast decision cannot be reused
after the state changes.

The Shadow Quagsire versus Galarian Corsola 2-2 regression validates the
post-Night-Shade window: the planner selects a safe Mud Shot, then re-evaluates
and uses Aqua Tail. The trace captures ready turns, Fast Move durations, pending
impacts, resources, candidate continuations, and reason codes. See
`BATTLE_INTELLIGENCE_TIMING_MODEL.md` for the bounded timing model.

## Exit Criteria

The strategic migration exit criteria are satisfied:

- 100% known automatic call-site routing;
- 100% observed runtime ownership;
- zero legacy strategic fallback;
- strict mode passes;
- manual and technical forced actions remain explicitly classified;
- result parity is measured and migration regressions are resolved;
- canonical mechanics, Unified Turn Resolution, DRE, and one-turn-lag behavior
  remain separate from strategic ownership.

The three remaining Golden failures are future planner-quality work, not a
reason to reintroduce legacy decision ownership.
