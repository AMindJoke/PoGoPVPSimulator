# Principle Engine Migration Status

Runtime baseline on the 30-case reviewed corpus at `battle-planner-v22`:

- automatic decisions: 570;
- hybrid fallback decisions: 6;
- fallback: 1.0526%;
- unresolved principle decisions: 172;
- corpus divergences already present: 3.

This inventory distinguishes strategic ownership from mechanical callbacks. Damage,
legal-action generation, state mutation, stage clamping, event ordering, and CMP
resolution remain canonical mechanics owned by Unified Turn Resolution.

| Area | Current owner | Target owner | Direct migrated | Fallback calls | Status |
|---|---|---|---:|---:|---|
| Availability and charged readiness | Principle Engine | Principle Engine | Yes | 0 | Complete |
| Forced actions, pending Fast lethal, immediate lethal | Principle Engine | Principle Engine | Yes | 0 | Complete |
| Protection/form breaker | Principle Engine plus canonical mechanic capability | Principle Engine | Yes | 0 | Complete |
| Charged timing | Principle Engine; legacy continuation still supplies some route comparison | Principle Engine | Partial | 0 direct timing fallbacks | Remove legacy continuation dependency |
| Compact no-shield route and ROUTE-007 | Principle Engine | Principle Engine | Yes | 0 for supported routes | Extend common comparator |
| Farm-down | `BI_FARM_DOWN` / hybrid route planner | `FARM-033` | No | Included in 6 | Generate first-class route |
| Shield/no-shield | `BI_SHIELD_*` rules | `SHIELD-034`, `SHIELD-043` | No | Separate legacy ownership | Replace rule owners |
| Bait | Pogo candidate evidence and `BI_BAIT_VALUE` | `BAIT-024/037/038/039` | No | Included in unresolved decisions | Replace scalar bonuses |
| Guaranteed and chance effects | Pogo candidate evidence and `BI_GUARANTEED_EFFECT` | `EFFECT-027/031/042`, `MOVE-025`, `TIE-036` | No | Included in unresolved decisions | Project stages in routes |
| Move ordering | candidate `tacticalScore`, `BI_CANDIDATE_EVIDENCE`, `BI_PCSV` | `MOVE-040/041`, `ROUTE-026` | No | Included in 6 | Compare complete routes |
| Outcome comparison | hybrid outcome vector plus candidate scalar ordering | Principle Engine outcome comparator | Partial | Included in 6 | One authoritative comparator |
| Ambiguity | `hybridEvaluation.ambiguity` | Principle Engine ambiguity detector | No | Included in 6 | Compare material route differences |
| Selective continuation | `BI_SELECTIVE_DEEP_SEARCH`, `BI_CONTINUATION`, `chargedContinuationOpening` | Principle Engine continuation search | No | Included in 6 | Equal-horizon principle rollouts |
| Matchup planning | `planLiveMatchup` behind runtime flag | Principle Engine | Partial | 0 when certified | Integrate only certified plans |
| Final automatic ownership | Principle Engine then hybrid/legacy completion | Principle Engine | No | 6 | Remove hybrid final authority |
| Worker/live/offline parity | shared serialized factories, including hybrid | shared Principle Engine factory only | Partial | 6 | Remove hybrid factory from worker |
| Trace/runtime consistency | unified trace contract with fallback fields | direct principle trace | Partial | 6 | Require direct authority |

## Runtime deletion conditions

| Runtime branch | Direct behavior today | Target principle owner | Required test | Delete/disable when |
|---|---:|---|---|---|
| `evaluateHybridBattleAction` | Yes | all remaining strategic principles | live/worker/offline hybrid-call trap | fallback reaches zero |
| `context.evaluateHybrid` and `hybridEvaluation` | Yes | final Principle Engine comparison | hybrid override rejection | all routes are directly comparable |
| `BI_HYBRID_BASELINE` | Yes | compact route and outcome principles | no BI owner in automatic trace | no decisive hybrid result is consumed |
| `BI_SELECTIVE_DEEP_SEARCH`, `BI_CONTINUATION`, `BI_PCSV` | Yes | ambiguity and continuation principles | equal-horizon alternatives | principle continuation owns rollout |
| `BI_FARM_DOWN` | Yes | `FARM-033` | farm versus charged route fixture | farm route uses common comparator |
| `BI_BAIT_VALUE` | Yes | bait principles | OFF/SELECTIVE/ALWAYS fixtures | bait is route evidence, not a bonus |
| `BI_GUARANTEED_EFFECT`, `BI_SELF_DEBUFF_*` | Yes | effect principles | buff/debuff trajectory fixtures | stages are projected directly |
| `BI_CANDIDATE_EVIDENCE` and candidate scalar scores | Yes | move and outcome principles | certified win cannot lose to score | outcome comparator is authoritative |
| `BI_SHIELD_*` | Yes | shield principles | shield/no-shield counterfactual fixtures | trace source is direct principle IDs |
| `chargedContinuationOpening` strategic forcing | Yes | selective continuation | same-root/same-horizon fixture | rollouts re-enter Principle Engine |
| `PvPeakHybridBattleIntelligence` worker factory | Yes | none | production symbol absence test | no production caller remains |

The migration is complete only when the representative automatic corpus reports
zero hybrid fallback, zero legacy fallback, zero unresolved decisions, and direct
Principle Engine authority for every automatic strategic decision.
