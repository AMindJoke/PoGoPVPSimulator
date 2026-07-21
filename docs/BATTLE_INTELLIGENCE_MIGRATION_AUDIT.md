# Battle Intelligence Migration Audit

Audit date: 2026-07-21

## Executive Summary

Unified Battle Intelligence is now the common entry point for most automatic
action and shield decisions, but it is not yet the authoritative owner of every
strategy. The normal battle, matrix, offline, Scenario Review, and Preview paths
all reach the same API. Several difficult charged-move choices are still computed
by legacy continuation, bait, timing, and overfarm helpers and then passed through
Battle Intelligence as compatibility advice.

- **Call-site coverage:** 10 of 13 known strategic call sites, **76.923%**.
- **Runtime decision coverage:** 4,458 of 5,043 representative automatic
  decisions, **88.575%**.
- **Observed legacy fallbacks:** 575, all reported as
  `LEGACY_CONTINUATION_NOT_MIGRATED` in the representative suite.
- **Golden result parity:** 17 of 21 cases currently pass. The four existing
  failures are listed below and are not hidden by this audit.
- **Strict mode:** correctly stops at the first legacy continuation fallback.

These percentages deliberately exclude Unified Turn Resolution. Resolving an
already selected action is not evidence that strategic action selection has been
migrated.

## Current Architecture

```text
Normal Battle / Matrix / Offline / Scenario Review / Preview
  -> runAutomaticBattleToEnd()
  -> automaticBattleStep()
  -> orderedBattleActors()                  [Unified Turn Resolution]
  -> autoAction()
  -> selectBattleIntelligenceAction()
  -> PvPeakBattleIntelligence.selectAction()
       -> native intelligence rules, or
       -> legacy tactical advice adapter
          -> chooseChargedMoveDecision()
          -> chooseChargedMove()
          -> continuation/timing/bait helpers
  -> useFast() / useCharge()
  -> canonical turn and damage resolution
```

Shield decisions use a separate shared route:

```text
useCharge()
  -> shieldDecisionForMove()
  -> battleIntelligenceShieldDecision()
  -> PvPeakBattleIntelligence.selectShieldAction()
  -> canonical shield and damage resolution
```

The central intelligence implementation is
`src/battle/battle-intelligence.js`. The browser and worker integration remains in
`PogoPvp.html` because the application is still distributed as a primarily
single-file client.

## Decision Ownership Matrix

The context columns describe routing. They do not upgrade a legacy-owned choice
to fully migrated merely because it crosses the new API boundary.

| Decision category | Battle | Matrix | Offline | Scenario Review | Preview | Authoritative owner | Status |
|---|---|---|---|---|---|---|---|
| Fast vs charged | Shared API | Shared API | Shared API | Shared API | Shared API | BI for direct rules; legacy tactical advice for difficult lines | PARTIALLY MIGRATED |
| Charged selection | Shared API | Shared API | Shared API | Shared API | Shared API | Legacy `chooseChargedMove*` for broad selection | PARTIALLY MIGRATED |
| Throw before faint | Shared API | Shared API | Shared API | Shared API | Shared API | BI pending-lethal rule | FULLY MIGRATED |
| Guaranteed lethal | Shared API | Shared API | Shared API | Shared API | Shared API | BI and legacy lethal checks | DUPLICATED |
| Cheaper reachable charged | Shared API | Shared API | Shared API | Shared API | Shared API | BI in pending-lethal window; legacy planner elsewhere | PARTIALLY MIGRATED |
| Overfarm | Routed | Routed | Routed | Routed | Routed | Legacy `shouldOverfarmForCloser()` and timing plan | LEGACY ONLY |
| Baiting | Routed | Routed | Routed | Routed | Routed | Legacy bait and continuation helpers | LEGACY ONLY |
| Shield / no shield | Shared API | Shared API | Shared API | Shared API | Shared API | BI `selectShieldAction()` | FULLY MIGRATED |
| CMP action order | Turn engine | Turn engine | Turn engine | Turn engine | Turn engine | `orderedBattleActors()` | FULLY MIGRATED (resolution) |
| Strategic CMP setup | Routed | Routed | Routed | Routed | Routed | Legacy `winningCmpSetupMove()` | LEGACY ONLY |
| Guaranteed buff/debuff | Shared API | Shared API | Shared API | Shared API | Shared API | BI recognizes effect; legacy continuation values line | PARTIALLY MIGRATED |
| Delayed self-debuff | Routed | Routed | Routed | Routed | Routed | Legacy charged planner | LEGACY ONLY |
| Continuation search | Routed adapter | Routed adapter | Routed adapter | Routed adapter | Routed adapter | Legacy `simulateChargedCandidateContinuation()` | LEGACY ONLY |
| Tie-breaking | Shared | Shared | Shared | Shared | Shared | BI stable order plus legacy continuation comparators | DUPLICATED |
| Manual controls | Manual | N/A | N/A | Manual | N/A | User | FULLY OBSERVABLE / OUTSIDE STRICT |
| DRE reconstruction | N/A | N/A | N/A | Direct forced action | N/A | Scenario technical policy | FORCED POLICY BYPASS |

## Static Call-Site Audit

### Routed strategic entry points

1. General automatic action: `PogoPvp.html` `autoAction()` ->
   `selectBattleIntelligenceAction()` -> `selectAction()`.
2. Shield selection: `shieldDecisionForMove()` ->
   `battleIntelligenceShieldDecision()` -> `selectShieldAction()`.
3. Smart-shield counterfactuals use the same shield selector.
4. Matrix simulations set caller context `matrix` before using the normal loop.
5. Offline worker simulations set caller context `offline`.
6. Scenario Review simulations set caller context `scenario-review`.
7. Preview simulations set caller context `preview`.
8. Pending-fast lethal opportunities are presented to BI as state evidence.
9. Manual fast actions are recorded with source `manual`.
10. Manual charged actions are recorded with source `manual`.

### Paths that bypass native Battle Intelligence ownership

1. `chargedContinuationOpening` in `autoAction()` executes legacy continuation
   advice. It is now recorded as `LEGACY_CONTINUATION_NOT_MIGRATED`.
2. `timingPlanMoveId` executes an already selected legacy timing plan. It is
   recorded as `forced-policy` rather than falsely counted as BI strategy.
3. `resolveTechnicalDreIfNeeded()` directly reconstructs the requested technical
   DRE outcome. This is a Scenario Review policy action, not a strategic fallback.

### Principal legacy strategy entry points

- `chooseChargedMoveDecision()` and `chooseChargedMove()`
- `continuationChargedMoveDecision()`
- `simulateChargedCandidateContinuation()`
- `winningCmpSetupMove()`
- `safeDefaultBaitMove()` and `safeBaitMove()`
- `shouldOverfarmForCloser()`
- `chargeTimingWaitReason()`
- `simulateShieldDecisionContinuation()` (counterfactual evidence)

## Runtime Instrumentation

`PvPeakBattleIntelligence` now exposes:

- `configureAudit(options)`
- `resetAudit()`
- `getAuditReport()`
- `recordExternalDecision(entry)`

Every observed decision records or aggregates:

- decision category;
- selected action;
- source (`battle-intelligence`, `legacy-fallback`, `manual`, or
  `forced-policy`);
- rule IDs;
- policy (`FAST`, `STANDARD`, or `DEEP_REVIEW`);
- caller context (`battle`, `matrix`, `offline`, `scenario-review`, or
  `preview`);
- structured fallback reason.

Normal production use retains counters only. Detailed event arrays are retained
only when battle debug tracing is explicitly enabled. This prevents audit
observability from adding per-decision JSON-copy overhead.

The repeatable command is:

```powershell
npm run audit:battle-intelligence
```

## Fallback Reason Codes

The implemented codes are:

- `LEGACY_NO_INTELLIGENCE_API`
- `LEGACY_UNSUPPORTED_ACTION_TYPE`
- `LEGACY_CONTINUATION_NOT_MIGRATED`
- `LEGACY_CALLER_NOT_MIGRATED`

The instrumentation accepts future structured codes such as missing-state and
unsupported-policy failures. There is no longer an intentionally silent strategic
fallback on an instrumented automatic path.

## Strict Mode

Set the developer/test-only environment flag:

```powershell
$env:BATTLE_INTELLIGENCE_STRICT = "true"
```

In strict mode, `legacy-fallback` throws using its exact reason code. Manual user
actions and canonical turn resolution remain allowed. The representative strict
run currently stops with:

```text
LEGACY_CONTINUATION_NOT_MIGRATED
```

This is expected evidence that migration is incomplete, not a test harness bug.

## Representative Runtime Coverage

| Scenario | Decisions | BI-owned | Legacy | Runtime coverage | Result |
|---|---:|---:|---:|---:|---|
| Guaranteed defense buff | 220 | 198 | 22 | 90.00% | Pass |
| Guaranteed attack debuff | 198 | 166 | 32 | 83.84% | Pass |
| Short straight matchup | 37 | 34 | 3 | 91.89% | Pass |
| Shield-sensitive matchup | 612 | 558 | 54 | 91.18% | Pass |
| CMP-sensitive matchup | 247 | 203 | 44 | 82.19% | Pass |
| Bait-sensitive Malamar/Pangoro | 234 | 209 | 25 | 89.32% | Known Golden failure |
| Bulky Dewgong/Azumarill | 791 | 686 | 105 | 86.73% | Pass |

The complete 21-case Golden run produced 5,043 automatic strategic decisions:
4,458 intelligence-owned and 575 legacy fallback decisions. All representative
fallbacks had reason `LEGACY_CONTINUATION_NOT_MIGRATED`.

The imminent-faint/pending-fast fixture selected the cheaper reachable charged
move with rules `BI_THROW_BEFORE_FAINT` and `BI_REACHABLE_CHARGED`, reason
`PENDING_FAST_IMPACT`, and 100% BI runtime coverage.

## Context Parity

The same straight Bastiodon/Altaria fixture was run through Battle, Matrix,
Offline, Scenario Review, and Preview caller contexts. Every context produced:

- winner: A;
- score: 821;
- final HP: A 90, B 0;
- final energy: A 17, B 41;
- 37 decisions, of which 34 BI-owned and 3 legacy fallback;
- runtime coverage: 91.8919%.

This verifies shared routing and result parity across contexts. It does not imply
that the three legacy continuation decisions are migrated.

## Result Parity

The audit does not modify battle outcomes. The current Golden suite passes 17 of
21 cases. The four unresolved pre-existing differences are:

- `cheap-vs-nuke-shadow-quagsire-corsola-0s`
- `energy-kingdra-carbink-1s`
- `bait-malamar-pangoro-1s`
- `closing-quagsire-corsola-0s`

These remain **unresolved ambiguities / known planner parity failures**. They are
not approved as improvements merely because the new layer is present.

## Duplicated Logic

| Logic | BI implementation | Legacy implementation | Classification |
|---|---|---|---|
| Guaranteed lethal | native candidate rule | lethal checks in `chooseChargedMove()` | Accidental duplication |
| Pending lethal fast | `nextPendingLethal()` | `pendingLethalFastWindow()` | Accidental duplication |
| Dominance pruning | `pruneDominatedCandidates()` | charged-plan dominance checks | Temporary fallback |
| Guaranteed effects | BI rule/reason | continuation outcome evaluation | Compatibility adapter |
| Stable tie order | BI candidate ordering | legacy continuation comparators | Temporary fallback |
| Shield threat/farm estimates | BI consumes evidence | battle mechanics helpers compute it | Shared mechanics helper; retain |
| CMP order vs CMP setup | Turn engine ordering | `winningCmpSetupMove()` strategy | Separate responsibilities |

No duplicated block should be removed until strict-mode representative runs and
Golden parity both pass.

## Performance Impact

Detailed event retention initially raised a warm representative audit simulation
from the previous approximately 393 ms median to approximately 925 ms. The cause
was retaining and cloning thousands of event objects, not the aggregate counters.

The implementation now retains only aggregate counters in normal traced runs and
keeps event arrays solely under explicit debug tracing. A final warm benchmark
must be rerun in an environment with Node available before claiming a new median.
Performance therefore remains **verification pending**, rather than being marked
as automatically acceptable.

## Prioritized Migration Backlog

### P0 - Establish one charged-decision owner

1. Move tactical charged selection and continuation ownership behind BI's bounded
   continuation interface.
2. Remove the `chargedContinuationOpening` strategic bypass only after parity.
3. Make strict mode pass the short, bulky, shield-sensitive, and CMP fixtures.

### P1 - Migrate major strategic policies

1. Move bait valuation and bait safety into generic BI evidence/rules.
2. Move overfarm and timing-window decisions into BI.
3. Move delayed self-debuff valuation into BI.
4. Feed strategic CMP setup into BI while leaving action order in Turn Resolution.
5. Consolidate lethal, pending-lethal, dominance, and tie-break duplicates.

### P2 - Expand proof and remove adapters safely

1. Resolve or classify the four Golden parity failures.
2. Add dedicated one-turn-lag, DRE, and Scenario Review continuation fixtures.
3. Benchmark Battle, Matrix, and Offline generation with audit counters enabled.
4. Require zero unexplained fallback reasons before deleting any adapter.

## Migration Exit Criteria

The migration is complete only when:

- all strategic automatic call sites route through BI;
- strict mode passes representative and Golden suites;
- runtime legacy fallback is zero for automatic play;
- every remaining forced-policy action is explicitly technical or user-directed;
- result and performance parity are measured;
- legacy strategic helpers can be removed without changing canonical mechanics or
  Unified Turn Resolution.
