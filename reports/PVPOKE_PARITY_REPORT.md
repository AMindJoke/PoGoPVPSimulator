# PvPoke planner parity report

Generated on 2026-07-27 for branch `perf-debug-work`.

## Result

The default automatic planner is `PVPOKE_PARITY`. Live battle, Matrix, offline
simulation, scenario review and the worker use the same Principle Engine factory.
For supported strategic states the default mode has no hybrid fallback owner and
does not apply species-, move-, matchup-, IV- or winner-specific rules.

PvPoke source revision:
[`5e1e3d971369a47aaf3e7247f50710d80205d570`](https://github.com/pvpoke/pvpoke/commit/5e1e3d971369a47aaf3e7247f50710d80205d570).

## Principle audit

All 43 registry principles have an exact source block, condition, action,
priority, project behavior and parity classification in
`docs/PVPOKE_PRINCIPLE_PARITY.md`.

| Classification | Principles |
|---|---:|
| `EXACT_PARITY` | 36 |
| `INTENTIONAL_ADAPTATION` | 7 |
| `NOT_MIGRATED` | 0 |
| `PARTIAL_PARITY` | 0 |
| `MECHANICS_BLOCKED` | 0 |
| Total | 43 |

The seven adapted principles are ROUTE-004, SURVIVAL-005, TACTICAL-009,
SPECIAL-010, TIMING-015, TIMING-021 and EFFECT-031. Their authorization,
reason and tests are recorded in `docs/PVPOKE_PARITY_ADAPTATIONS.md`.

## Decision order and migrated behavior

The direct parity path preserves PvPoke's early-return order: availability,
explicit farm, readiness, survival, forced throw, immediate lethal, protection
breaker, timing, long-match shortcut, compact DP, farm-down, effects and shields,
route post-processing, bait ordering, self-debuff handling, then final action.

The compact planner uses the PvPoke BattleState fields, time-ordered queue,
500-state cap, terminal farm candidates, shield damage of 1, guaranteed-effect
projection, deterministic chance behavior, dominance pruning and equivalent-state
tie rules. `wouldShield()` and bait decisions execute directly in parity mode.

## Disabled hybrid ownership

The following previous decision owners are unreachable in `PVPOKE_PARITY`:

- `BI_HYBRID_BASELINE`;
- `BI_SELECTIVE_DEEP_SEARCH`;
- `BI_CONTINUATION`;
- `BI_PCSV`;
- `BI_CANDIDATE_EVIDENCE`;
- legacy tactical and continuation scalar scores;
- post-selection hybrid overrides.

The older principle-advanced implementation remains isolated behind
`PRINCIPLE_ADVANCED`; it is not selected by the UI, Matrix or worker. Runtime
fallback usage in the supported parity corpus is 0/150 (0%).

## First-decision corpus

The pinned fixture corpus contains 140 action states and 10 shield states. It
compares the action type, Charged Move ID, intent, principle ID, direct authority,
fallback state and planner mode.

| Category | Passed | Total | Rate |
|---|---:|---:|---:|
| Availability | 20 | 20 | 100% |
| Tactical | 30 | 30 | 100% |
| Timing | 10 | 10 | 100% |
| Farm / farm-down | 20 | 20 | 100% |
| Shield / no shield | 10 | 10 | 100% |
| Bait | 10 | 10 | 100% |
| Guaranteed and self effects | 20 | 20 | 100% |
| Move/route ordering | 30 | 30 | 100% |
| Entire corpus | 150 | 150 | 100% |

These category buckets are a reporting partition of the fixture families.
Individual fixture metadata also records shields, CMP, pending Fast impacts,
Fast durations and source branches.

The existing 30-case project golden corpus currently passes 16/30 of its
historical winner/reason-code assertions. This is deliberately not reported as
PvPoke parity: those assertions encode earlier PoGoPVPSimulator strategy. For
example, one old golden requires Mud Bomb as Shadow Quagsire's first throw,
whereas current PvPoke starts with Aqua Tail.

## Shadow Quagsire vs Galarian Corsola, 0-0

Before the generic route migration, the first strategic divergence was the
second Charged action: the simulator continued Aqua Tail, producing
`AQUA_TAIL / AQUA_TAIL / AQUA_TAIL`, while current PvPoke uses
`AQUA_TAIL / MUD_BOMB / AQUA_TAIL`.

After the migration, both use that three-move sequence. Project turns
`8 / 21 / 28` correspond to PvPoke UI turns `9 / 22 / 29` because the project
timeline is zero-based. Both resolve Shadow Quagsire as winner with 13 HP and
2 energy. The fix is generic compact-route and post-processing behavior; the
planner source contains none of the involved species or move IDs.

Diagnostic:
<https://pvpoke.com/battle/1500/quagsire_shadow/corsola_galarian/00/0-2-6/0-1-2/>.

## Intentional differences

- Guaranteed effects use the project's canonical `self` / `opponent` / both
  target model, as explicitly approved.
- Pending Fast impacts, simultaneous resolution and CMP use Unified Turn
  Resolution rather than PvPoke cooldown mutation.
- A timing wait is represented explicitly as one Fast followed by re-planning.
- Protection forms are discovered through a generic capability rather than a
  species-name branch.
- Project trace turns are zero-based; PvPoke's visible timeline is one-based.
- Randomized action weighting is excluded from deterministic Matrix parity.
- PvPoke's species-specific Melmetal/Cresselia branch is disabled because it
  violates the no-species-specific-rule requirement; its generic close-move
  bandaids remain part of MOVE-041.

There are no remaining mechanics-blocked differences in the supported fixture
surface. A compact search with insufficient inputs or no guaranteed route
returns an explicit unsupported parity result and never delegates silently.

## Verification

All 34 local `tools/test-*.js` tests pass. The parity-critical set includes:

- `test-pvpoke-principle-parity-audit`;
- `test-pvpoke-first-decision-parity`;
- `test-pvpoke-runtime-parity`;
- `test-principle-engine-complete-migration`;
- `test-battle-intelligence`;
- `test-principle-trace-contract`;
- `test-timing-compatibility`;
- `test-turn-resolution-engine`;
- `test-battle-principles-registry`;
- `test-quagsire-corsola-default-pvpoke`;
- `test-perf-debug`.

The 30-battle historical benchmark executed in 707 ms on the validation run.
This is a runtime observation, not a stable performance contract. Matrix work
continues through the worker and the live page no longer performs planner matrix
ownership on the UI thread.
