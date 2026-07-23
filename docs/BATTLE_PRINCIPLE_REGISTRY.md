# Battle Principle Registry

Registry version: `principle-registry-v1`

This file is generated from `src/battle/battle-principles.js`. Do not edit it without updating the code registry.

## Validation

- valid: `true`
- principle count: `43`
- errors: `none`

## Priority Groups

- `10` CANONICAL_LEGALITY
- `20` IMMEDIATE_TERMINAL_MECHANICS
- `30` FORCED_SURVIVAL_ACTIONS
- `40` TIMING_SAFETY
- `50` IMMEDIATE_LETHAL
- `60` COMPACT_ROUTE_GENERATION
- `70` FARM_DOWN
- `80` BAIT_SHIELD_POLICY
- `90` BUFF_DEBUFF_SEQUENCING
- `100` OUTCOME_COMPARISON
- `110` AMBIGUITY_ESCALATION
- `120` STABLE_TIE_BREAKS

## Runtime Rule Mapping

The current Battle Intelligence runtime still emits legacy `BI_*` rule IDs. Each active runtime rule must map to one or more principle IDs so no strategic behavior remains anonymous during the rebuild.

| Runtime rule | Principle IDs |
|---|---|
| `BI_ONLY_LEGAL_ACTION` | `AVAIL-001_NO_ACTIVE_CHARGED_MOVE`, `AVAIL-002_CHEAPEST_CHARGED_NOT_AFFORDABLE`, `ROUTE-026_BUILD_TO_SELECTED_MOVE` |
| `BI_THROW_BEFORE_FAINT` | `TACTICAL-006_FORCED_THROW_BEFORE_FAST_FAINT` |
| `BI_REACHABLE_CHARGED` | `ROUTE-004_CHARGED_READINESS_CALCULATION`, `TACTICAL-006_FORCED_THROW_BEFORE_FAST_FAINT` |
| `BI_GUARANTEED_LETHAL` | `TACTICAL-008_IMMEDIATE_UNSHIELDED_CHARGED_LETHAL` |
| `BI_AVOID_LETHAL_OVERFARM` | `SURVIVAL-005_ESTIMATE_SURVIVAL_HORIZON`, `TIMING-019_DO_NOT_WAIT_IF_OPPONENT_REACHES_LETHAL_CHARGED_PRESSURE` |
| `BI_GUARANTEED_EFFECT` | `EFFECT-031_APPLY_GUARANTEED_ATTACK_DEFENSE_EFFECTS` |
| `BI_CMP_AWARE` | `SURVIVAL-005_ESTIMATE_SURVIVAL_HORIZON` |
| `BI_MATCHUP_PLAN` | `COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE`, `SEARCH-029_BOUND_PLANNER_STATE_COUNT` |
| `BI_HYBRID_BASELINE` | `COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE`, `COMPACT-030_ORDER_SEARCH_BY_TIME_BREAKPOINT` |
| `BI_SELECTIVE_DEEP_SEARCH` | `SEARCH-029_BOUND_PLANNER_STATE_COUNT`, `SEARCH-035_PRUNE_DOMINATED_STATES` |
| `BI_FARM_DOWN` | `FARM-033_FARM_DOWN_ROUTE_CANDIDATE` |
| `BI_CONTINUATION` | `COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE`, `MOVE-040_PREFER_USEFUL_IMMEDIATE_DAMAGE_WITHOUT_BAIT_CONSTRAINTS` |
| `BI_PCSV` | `ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE`, `COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE` |
| `BI_TIMING_CONTINUATION` | `TIMING-011_OPTIMIZE_CHARGED_TIMING`, `TIMING-021_SAFE_TIMING_WAIT_MEANS_ONE_FAST_THEN_REPLAN` |
| `BI_OVERFARM` | `TIMING-016_DO_NOT_WAIT_IF_ENERGY_OVERFLOWS`, `TIMING-017_DO_NOT_WAIT_IF_CURRENT_CHARGED_RESOURCES_BECOME_UNUSABLE` |
| `BI_BAIT_VALUE` | `BAIT-024_LONG_MATCHUP_MAY_PREFER_CREDIBLE_BAIT`, `BAIT-037_BUILD_ENERGY_TO_REPRESENT_NUKE`, `BAIT-038_DO_NOT_BAIT_WHEN_OPPONENT_WOULD_NOT_SHIELD` |
| `BI_TIMING_VALUE` | `TIMING-011_OPTIMIZE_CHARGED_TIMING`, `TIMING-012_TARGET_DEPENDS_ON_FAST_DURATIONS`, `TIMING-013_DISABLE_SAME_DURATION_OPTIMIZATION`, `TIMING-014_DISABLE_EXACT_MULTIPLE_OPTIMIZATION` |
| `BI_SELF_DEBUFF_RISK` | `EFFECT-027_STACK_SELF_DEBUFFING_MOVES`, `EFFECT-042_AVOID_NONLETHAL_SELF_DEBUFF_NUKE_WHILE_HEALTHY` |
| `BI_SELF_DEBUFF_AVOIDANCE` | `MOVE-025_LONG_MATCHUP_MAY_PREFER_NON_DEBUFFING_MOVE`, `BAIT-039_AVOID_SELF_DEBUFFING_BAIT_WHEN_INAPPROPRIATE`, `EFFECT-042_AVOID_NONLETHAL_SELF_DEBUFF_NUKE_WHILE_HEALTHY` |
| `BI_CANDIDATE_EVIDENCE` | `MOVE-040_PREFER_USEFUL_IMMEDIATE_DAMAGE_WITHOUT_BAIT_CONSTRAINTS`, `MOVE-041_WITH_SHIELDS_ALLOW_CHEAPER_EFFICIENT_NON_DEBUFFING_MOVE`, `TIE-036_PREFER_FEWER_SELF_DEBUFFS_IN_EQUIVALENT_STATES` |
| `BI_SHIELD_POLICY` | `SHIELD-034_SHIELDED_CHARGED_CONSUMES_SHIELD`, `SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE` |
| `BI_SHIELD_PREVENTS_KO` | `SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE` |
| `BI_SHIELD_PRESERVES_WIN` | `SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE` |
| `BI_SHIELD_AVOIDS_FARM` | `SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE` |
| `BI_SHIELD_HEAVY_PRESSURE` | `SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE` |
| `BI_SAVE_SHIELD_LOW_THREAT` | `SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE` |

## Principles

### AVAIL-001_NO_ACTIVE_CHARGED_MOVE - No active Charged Move

- category: `availability`
- ownerLayer: `Action Availability`
- priority: `CANONICAL_LEGALITY`
- status: `ACTIVE`
- condition: actor.activeChargedMoves.length === 0
- output: `FAST_MOVE_INTENT_OR_NO_CHARGED_INTENT`
- allowedOutputs: `fast_move`, `no_action_when_no_fast_is_legal`
- reasonCodes: `NO_ACTIVE_CHARGED_MOVE`
- inputs: `actor.activeChargedMoves`, `legalActions`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-avail-001-no-active-charged-move`

Continue with Fast Move when the actor has no active Charged Moves.

### AVAIL-002_CHEAPEST_CHARGED_NOT_AFFORDABLE - Cheapest Charged Move not affordable

- category: `availability`
- ownerLayer: `Action Availability`
- priority: `CANONICAL_LEGALITY`
- status: `MODIFIED_FROM_PVPOKE`
- condition: actor.energy < cheapestActiveChargedMove.energyCost
- output: `FAST_MOVE_INTENT_OR_AMBIGUITY_ESCALATION`
- allowedOutputs: `fast_move`, `retain_future_breakpoint_alternative`
- reasonCodes: `CHEAPEST_CHARGED_NOT_AFFORDABLE`
- inputs: `actor.energy`, `actor.fastMove.energyGain`, `actor.activeChargedMoves`, `ambiguityFlags`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-avail-002-cheapest-not-affordable`

Use the cheap early Fast path while still permitting deeper planning when a future breakpoint is ambiguous.

### POLICY-003_EXPLICIT_FARM_ENERGY_MODE - Explicit farm-energy mode

- category: `policy`
- ownerLayer: `Policy`
- priority: `CANONICAL_LEGALITY`
- status: `ACTIVE`
- condition: actor.farmEnergy === true
- output: `FAST_MOVE_INTENT_UNLESS_FORCED`
- allowedOutputs: `fast_move`, `forced_charged_move`
- reasonCodes: `EXPLICIT_FARM_ENERGY_MODE`
- inputs: `actor.farmEnergy`, `forcedActionFlags`, `legalActions`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-policy-003-explicit-farm-energy`

Honor explicit farm-energy simulation policy unless canonical forced action rules override it.

### ROUTE-004_CHARGED_READINESS_CALCULATION - Charged readiness calculation

- category: `route`
- ownerLayer: `Route Planner`
- priority: `COMPACT_ROUTE_GENERATION`
- status: `MODIFIED_FROM_PVPOKE`
- condition: chargedMoveReachability is requested
- output: `CHARGED_REACHABILITY_VECTOR`
- allowedOutputs: `reachability_vector`
- reasonCodes: `CHARGED_READINESS_CALCULATED`
- inputs: `actor.energy`, `actor.fastMove.energyGain`, `actor.fastMove.turns`, `chargedMove.energyCost`, `pendingEnergyEvents`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-route-004-charged-readiness`

Compute Fast turns needed to reach every Charged Move using canonical ready turns and pending energy events where available.

### SURVIVAL-005_ESTIMATE_SURVIVAL_HORIZON - Estimate survival horizon

- category: `survival`
- ownerLayer: `Survival Evaluator`
- priority: `FORCED_SURVIVAL_ACTIONS`
- status: `MODIFIED_FROM_PVPOKE`
- condition: actor survival pressure must be evaluated
- output: `SURVIVAL_HORIZON`
- allowedOutputs: `survival_horizon`
- reasonCodes: `SURVIVAL_HORIZON_ESTIMATED`
- inputs: `actor.hp`, `actor.shields`, `opponent.energy`, `opponent.fastMove`, `opponent.chargedMoves`, `pendingFastImpacts`, `cmpState`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-survival-005-survival-horizon`

Produce a structured survival horizon under opponent Fast, Charged, pending impact, shield, and CMP pressure.

### TACTICAL-006_FORCED_THROW_BEFORE_FAST_FAINT - Forced throw before Fast faint

- category: `tactical`
- ownerLayer: `Tactical Gates`
- priority: `FORCED_SURVIVAL_ACTIONS`
- status: `ACTIVE`
- condition: survivalHorizon.pendingFastLethal || survivalHorizon.turnsToLive <= nextOwnActionWindow
- output: `CHARGED_MOVE_INTENT`
- allowedOutputs: `charged_move`
- reasonCodes: `PENDING_FAST_IMPACT`, `FORCED_THROW_BEFORE_FAST_FAINT`
- inputs: `survivalHorizon`, `affordableChargedMoves`, `routeValues`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-tactical-006-forced-throw-before-fast-faint`, `tools/test-battle-intelligence.js`

Throw the best meaningful affordable Charged Move when the actor cannot survive another legal Fast/action window.

### ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE - Two copies may outrank one nuke

- category: `route`
- ownerLayer: `Route Planner`
- priority: `COMPACT_ROUTE_GENERATION`
- status: `MODIFIED_FROM_PVPOKE`
- condition: actor.energy >= cheapMove.energyCost * 2 && completeRouteValue(twoCheap) > completeRouteValue(oneNuke)
- output: `RETAIN_ROUTE_ALTERNATIVE`
- allowedOutputs: `retain_route`, `charged_move`
- reasonCodes: `TWO_CHEAP_MOVES_OUTRANK_NUKE`
- inputs: `actor.energy`, `chargedMoves`, `cmpState`, `completeRouteValues`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-route-007-two-copies-outrank-nuke`

Retain a route where two cheaper Charged Moves can outperform one larger move.

### TACTICAL-008_IMMEDIATE_UNSHIELDED_CHARGED_LETHAL - Immediate unshielded Charged lethal

- category: `tactical`
- ownerLayer: `Tactical Gates`
- priority: `IMMEDIATE_LETHAL`
- status: `ACTIVE`
- condition: opponent.shields === 0 && affordableChargedMove.damage >= opponent.hp && !ownPendingFastLethal
- output: `CHARGED_MOVE_INTENT`
- allowedOutputs: `charged_move`
- reasonCodes: `LETHAL_MOVE_AVAILABLE`
- inputs: `opponent.hp`, `opponent.shields`, `affordableChargedMoves`, `ownPendingFastImpacts`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-tactical-008-immediate-unshielded-lethal`, `tools/test-battle-intelligence.js`

Throw the cheapest or safest equivalent lethal Charged Move when shields are down and no own pending Fast already KOs.

### TACTICAL-009_DO_NOT_THROW_WHEN_FAST_ALREADY_KOS - Do not throw when Fast already KOs

- category: `tactical`
- ownerLayer: `Tactical Gates`
- priority: `IMMEDIATE_TERMINAL_MECHANICS`
- status: `CANONICAL_MECHANIC`
- condition: ownPendingFastImpact.damage >= opponent.hp
- output: `NO_CHARGED_INTENT`
- allowedOutputs: `fast_move`, `wait_for_pending_impact`
- reasonCodes: `PENDING_FAST_ALREADY_KOS`
- inputs: `opponent.hp`, `ownPendingFastImpacts`, `legalActions`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-tactical-009-fast-already-kos`

Avoid spending Charged energy when a registered or pending own Fast impact already guarantees the knockout.

### SPECIAL-010_PROTECTION_FORM_MECHANIC_BREAKER - Protection/form mechanic breaker

- category: `special-mechanics`
- ownerLayer: `Special Mechanics`
- priority: `IMMEDIATE_TERMINAL_MECHANICS`
- status: `MODIFIED_FROM_PVPOKE`
- condition: opponent has generic protection/form mechanic && opponent.shields === 0
- output: `CHARGED_MOVE_INTENT`
- allowedOutputs: `charged_move`, `fast_move_until_affordable`
- reasonCodes: `PROTECTION_FORM_BREAKER`
- inputs: `opponent.formMechanics`, `opponent.shields`, `affordableChargedMoves`, `move.selfDebuffing`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-special-010-protection-form-breaker`

Use the cheapest safe non-self-debuffing Charged Move to break a generic protection/form mechanic.

### TIMING-011_OPTIMIZE_CHARGED_TIMING - Optimize Charged timing

- category: `timing`
- ownerLayer: `Timing Evaluator`
- priority: `TIMING_SAFETY`
- status: `MODIFIED_FROM_PVPOKE`
- condition: chargedMoveTimingOptimization is enabled and timing can materially improve
- output: `THROW_NOW_OR_FAST_THEN_REPLAN`
- allowedOutputs: `charged_move`, `fast_move`, `wait`
- reasonCodes: `OPTIMAL_CHARGE_TIMING`
- inputs: `ownFastDuration`, `opponentFastDuration`, `opponentCooldown`, `pendingImpacts`, `safetyChecks`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-timing-011-optimize-charged-timing`, `tools/test-timing-compatibility.js`

Prefer safe throw timing that avoids granting unnecessary opponent Fast Move turns.

### TIMING-012_TARGET_DEPENDS_ON_FAST_DURATIONS - Timing target depends on Fast durations

- category: `timing`
- ownerLayer: `Timing Evaluator`
- priority: `TIMING_SAFETY`
- status: `MODIFIED_FROM_PVPOKE`
- condition: timing target must be computed
- output: `TIMING_TARGET`
- allowedOutputs: `timing_target`
- reasonCodes: `TIMING_TARGET_DERIVED`
- inputs: `ownFastDuration`, `opponentFastDuration`, `opponentPendingImpact`, `currentTurn`, `freeTurnsConceded`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-timing-012-target-fast-durations`

Derive timing targets from Fast durations, pending impact, action window, and conceded turns.

### TIMING-013_DISABLE_SAME_DURATION_OPTIMIZATION - Disable timing optimization for same durations

- category: `timing`
- ownerLayer: `Timing Evaluator`
- priority: `TIMING_SAFETY`
- status: `ACTIVE`
- condition: actor.fastMove.turns === opponent.fastMove.turns
- output: `TIMING_OPTIMIZATION_DISABLED`
- allowedOutputs: `throw_now`, `normal_move_selection`
- reasonCodes: `SAME_FAST_DURATION_NO_TIMING_GAIN`
- inputs: `ownFastDuration`, `opponentFastDuration`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-timing-013-disable-same-duration`

Do not wait solely for alignment when both Fast Moves have the same duration.

### TIMING-014_DISABLE_EXACT_MULTIPLE_OPTIMIZATION - Disable timing optimization for exact multiples

- category: `timing`
- ownerLayer: `Timing Evaluator`
- priority: `TIMING_SAFETY`
- status: `ACTIVE`
- condition: ownFastDuration > opponentFastDuration && ownFastDuration % opponentFastDuration === 0
- output: `TIMING_OPTIMIZATION_DISABLED`
- allowedOutputs: `throw_now`, `normal_move_selection`
- reasonCodes: `EXACT_MULTIPLE_FAST_DURATION_NO_TIMING_GAIN`
- inputs: `ownFastDuration`, `opponentFastDuration`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-timing-014-disable-exact-multiple`

Do not wait solely for timing when the longer Fast duration is an exact multiple of the shorter duration.

### TIMING-015_DO_NOT_WAIT_IF_ACTOR_FAINTS - Do not wait if actor faints

- category: `timing-safety`
- ownerLayer: `Timing Safety`
- priority: `TIMING_SAFETY`
- status: `ACTIVE`
- condition: waitProjection.actorFaints === true
- output: `THROW_NOW`
- allowedOutputs: `charged_move`
- reasonCodes: `FAINTS_WHILE_WAITING`
- inputs: `waitProjection`, `pendingImpacts`, `incomingDamage`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-timing-015-do-not-wait-if-faints`

Reject a wait/Fast timing line if the actor faints before the next decision.

### TIMING-016_DO_NOT_WAIT_IF_ENERGY_OVERFLOWS - Do not wait if energy overflows

- category: `timing-safety`
- ownerLayer: `Timing Safety`
- priority: `TIMING_SAFETY`
- status: `ACTIVE`
- condition: projectedEnergyAfterWait > 100
- output: `THROW_MEANINGFUL_CHARGED`
- allowedOutputs: `charged_move`, `proven_wait_exception`
- reasonCodes: `ENERGY_CAP_FORCES_THROW`
- inputs: `actor.energy`, `queuedFastEnergy`, `proposedFastEnergy`, `provenOutcomeOverride`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-timing-016-energy-overflow`

Reject waiting when current, queued, and proposed Fast energy would exceed 100 unless a proven superior outcome requires it.

### TIMING-017_DO_NOT_WAIT_IF_CURRENT_CHARGED_RESOURCES_BECOME_UNUSABLE - Do not wait if current Charged resources become unusable

- category: `timing-safety`
- ownerLayer: `Timing Safety`
- priority: `TIMING_SAFETY`
- status: `MODIFIED_FROM_PVPOKE`
- condition: survivingActionWindows < currentReachableChargedCount
- output: `THROW_NOW`
- allowedOutputs: `charged_move`
- reasonCodes: `CURRENT_CHARGED_RESOURCES_BECOME_UNUSABLE`
- inputs: `actionableEnergy`, `reachableChargedCount`, `survivalHorizon`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-timing-017-current-resources-unusable`

Use actionable energy and reachable Charged count to reject waits that strand currently useful Charged resources.

### TIMING-018_DO_NOT_WAIT_IF_CHARGED_ALREADY_KOS - Do not wait if a Charged Move already KOs

- category: `timing-safety`
- ownerLayer: `Timing Safety`
- priority: `TIMING_SAFETY`
- status: `ACTIVE`
- condition: affordableChargedMove.damage >= opponent.hp && chargedMoveLegal
- output: `THROW_NOW`
- allowedOutputs: `charged_move`
- reasonCodes: `IMMEDIATE_LETHAL_LOST`
- inputs: `affordableChargedMoves`, `opponent.hp`, `legalActions`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-timing-018-charged-already-kos`

Reject timing waits when an affordable Charged Move is an immediate legal lethal.

### TIMING-019_DO_NOT_WAIT_IF_OPPONENT_REACHES_LETHAL_CHARGED_PRESSURE - Do not wait if opponent reaches lethal Charged pressure

- category: `timing-safety`
- ownerLayer: `Timing Safety`
- priority: `TIMING_SAFETY`
- status: `MODIFIED_FROM_PVPOKE`
- condition: waitProjection.opponentGetsLethalCharged === true
- output: `THROW_NOW`
- allowedOutputs: `charged_move`
- reasonCodes: `LETHAL_CHARGED_CONCEDED`
- inputs: `opponent.energy`, `opponent.fastMove.energyGain`, `opponent.chargedMoves`, `actor.hp`, `actor.shields`, `waitWindow`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-timing-019-opponent-lethal-charged`

Distinguish opponent energy access, Charged access, and canonically lethal Charged resolution before allowing a wait.

### TIMING-020_DO_NOT_WAIT_IF_FITTED_FAST_MOVES_ARE_LETHAL - Do not wait if fitted Fast Moves are lethal

- category: `timing-safety`
- ownerLayer: `Timing Safety`
- priority: `TIMING_SAFETY`
- status: `ACTIVE`
- condition: waitProjection.fittedOpponentFastDamage >= actor.hp
- output: `THROW_NOW`
- allowedOutputs: `charged_move`
- reasonCodes: `FAST_DAMAGE_LETHAL_WHILE_WAITING`
- inputs: `actor.hp`, `opponent.fastMove.damage`, `opponent.fastMove.turns`, `waitWindow`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-timing-020-fitted-fast-lethal`

Reject a wait when opponent Fast Moves fitting into the proposed window KO the actor.

### TIMING-021_SAFE_TIMING_WAIT_MEANS_ONE_FAST_THEN_REPLAN - Safe timing wait means one Fast then re-plan

- category: `timing`
- ownerLayer: `Timing Evaluator`
- priority: `TIMING_SAFETY`
- status: `MODIFIED_FROM_PVPOKE`
- condition: timingPoor && allTimingSafetyChecksPass
- output: `FAST_MOVE_INTENT_THEN_REPLAN`
- allowedOutputs: `fast_move`
- reasonCodes: `SAFE_EXTRA_FAST`, `OPTIMAL_CHARGE_TIMING`
- inputs: `timingQuality`, `timingSafety`, `canonicalStateHash`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-timing-021-one-fast-then-replan`

A safe timing wait returns only one Fast Move and requires re-planning after canonical resolution.

### PERF-022_DETECT_LONG_REPEATED_CYCLE_MATCHUPS - Detect long repeated-cycle matchups

- category: `performance`
- ownerLayer: `Performance Policy`
- priority: `COMPACT_ROUTE_GENERATION`
- status: `PERFORMANCE_SHORTCUT`
- condition: opponent.hp / bestChargedCycleDamage > longCycleThreshold
- output: `LONG_CYCLE_SHORTCUT_ELIGIBLE`
- allowedOutputs: `shortcut_eligible`, `full_planner_required`
- reasonCodes: `LONG_REPEATED_CYCLE_MATCHUP`
- inputs: `bestChargedDamage`, `fastDamageToReach`, `opponent.hp`, `benchmarkPolicy`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-perf-022-long-cycle-detect`

Allow a benchmarked, disableable shortcut when repeated Charged cycles dominate a long matchup.

### LONG-023_LONG_MATCHUP_STARTS_FROM_BEST_CHARGED_CYCLE - Long matchup starts from best Charged cycle

- category: `long-match`
- ownerLayer: `Long-Match Policy`
- priority: `COMPACT_ROUTE_GENERATION`
- status: `STRATEGIC_HEURISTIC`
- condition: longCycleShortcutEligible === true
- output: `SELECT_BASELINE_CYCLE_MOVE`
- allowedOutputs: `charged_move_candidate`
- reasonCodes: `BEST_LONG_CYCLE_MOVE`
- inputs: `chargedMoveDpe`, `chargedMoveDamage`, `fastMovesToReach`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-long-023-best-charged-cycle`

Use the strongest efficient repeated Charged cycle as long-match baseline.

### BAIT-024_LONG_MATCHUP_MAY_PREFER_CREDIBLE_BAIT - Long matchup may prefer a credible bait

- category: `bait`
- ownerLayer: `Bait Policy`
- priority: `BAIT_SHIELD_POLICY`
- status: `MODIFIED_FROM_PVPOKE`
- condition: longCycle && baitingEnabled && opponent.shields > 0 && wouldShield(expensiveThreat)
- output: `BAIT_ROUTE_CANDIDATE`
- allowedOutputs: `charged_move_candidate`, `straight_route`
- reasonCodes: `SHIELD_PRESSURE`
- inputs: `baitPolicy`, `opponent.shields`, `wouldShield`, `cheapMove`, `expensiveThreat`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-bait-024-long-credible-bait`

Allow a cheaper bait in long matchups only when shields remain, baiting is enabled, and the expensive threat would draw a shield.

### MOVE-025_LONG_MATCHUP_MAY_PREFER_NON_DEBUFFING_MOVE - Long matchup may prefer non-self-debuffing move

- category: `move-selection`
- ownerLayer: `Move Selection`
- priority: `BUFF_DEBUFF_SEQUENCING`
- status: `MODIFIED_FROM_PVPOKE`
- condition: bestMove.selfDebuffing && stableAlternativeEfficiencyAcceptable
- output: `NON_DEBUFFING_MOVE_CANDIDATE`
- allowedOutputs: `charged_move_candidate`
- reasonCodes: `PREFER_NON_DEBUFF_ROUTE`
- inputs: `bestMove`, `alternativeMoves`, `selfDebuffRisk`, `routeOutcome`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-move-025-long-non-debuffing`

Prefer a stable non-self-debuffing alternative when the strongest long-cycle move self-debuffs and efficiency remains acceptable.

### ROUTE-026_BUILD_TO_SELECTED_MOVE - Build to selected move

- category: `route`
- ownerLayer: `Route Planner`
- priority: `COMPACT_ROUTE_GENERATION`
- status: `ACTIVE`
- condition: selectedMove.energyCost > actor.energy
- output: `FAST_MOVE_INTENT`
- allowedOutputs: `fast_move`
- reasonCodes: `BUILD_TO_SELECTED_MOVE`
- inputs: `selectedMove.energyCost`, `actor.energy`, `legalActions`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-route-026-build-to-selected-move`

Continue with Fast Move while the selected route move is not yet affordable.

### EFFECT-027_STACK_SELF_DEBUFFING_MOVES - Stack self-debuffing moves

- category: `effect-sequencing`
- ownerLayer: `Effect Sequencing`
- priority: `BUFF_DEBUFF_SEQUENCING`
- status: `ACTIVE`
- condition: selectedMove.selfDebuffing && canSafelyBankAdditionalCopies
- output: `FAST_MOVE_OR_CHARGED_STACK_RELEASE`
- allowedOutputs: `fast_move`, `charged_move`
- reasonCodes: `SELF_DEBUFF_STACKING`
- inputs: `actor.energy`, `energyCap`, `selectedMove.energyCost`, `survivalHorizon`, `selfDebuffStages`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-effect-027-stack-self-debuffing`

Safely bank multiple self-debuffing moves to reduce time spent under the debuff.

### COMPACT-028_SEARCH_FASTEST_EFFECTIVE_KO_ROUTE - Search for the fastest effective KO route

- category: `compact-planner`
- ownerLayer: `Compact Planner`
- priority: `COMPACT_ROUTE_GENERATION`
- status: `MODIFIED_FROM_PVPOKE`
- condition: compact route evaluation is requested
- output: `COMPACT_ROUTE_SET`
- allowedOutputs: `route_set`
- reasonCodes: `COMPACT_ROUTE_GENERATED`
- inputs: `canonicalState`, `legalActions`, `chargedMoves`, `shieldPolicy`, `effectState`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-compact-028-fastest-effective-ko-route`

Generate bounded routes using Fast continuation, Charged Moves, shields, farm-down, guaranteed effects, and self-debuff stacking.

### SEARCH-029_BOUND_PLANNER_STATE_COUNT - Bound planner state count

- category: `search`
- ownerLayer: `Search Budget`
- priority: `AMBIGUITY_ESCALATION`
- status: `MODIFIED_FROM_PVPOKE`
- condition: search is running
- output: `SEARCH_BUDGET_STATE`
- allowedOutputs: `complete`, `incomplete`
- reasonCodes: `SEARCH_BUDGET_APPLIED`
- inputs: `policy.maxStates`, `policy.maxTurns`, `policy.timeBudgetMs`, `exploredStates`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-search-029-bound-state-count`

Define explicit state budget, turn horizon, wall-clock budget, and completeness flag.

### COMPACT-030_ORDER_SEARCH_BY_TIME_BREAKPOINT - Order compact search by time/breakpoint

- category: `compact-planner`
- ownerLayer: `Compact Planner`
- priority: `COMPACT_ROUTE_GENERATION`
- status: `STRATEGIC_HEURISTIC`
- condition: multiple route frontier states are available
- output: `ORDERED_FRONTIER`
- allowedOutputs: `ordered_route_frontier`
- reasonCodes: `SEARCH_ORDERED_BY_BREAKPOINT`
- inputs: `frontierStates`, `meaningfulBreakpoints`, `turn`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-compact-030-order-by-breakpoint`

Explore earlier meaningful actions first to find short decisive routes quickly.

### EFFECT-031_APPLY_GUARANTEED_ATTACK_DEFENSE_EFFECTS - Apply guaranteed Attack and Defense effects

- category: `effect-projection`
- ownerLayer: `Effect Projection`
- priority: `BUFF_DEBUFF_SEQUENCING`
- status: `ACTIVE`
- condition: move has guaranteed Attack or Defense stage effect
- output: `PROJECTED_EFFECT_STATE`
- allowedOutputs: `projected_stage_state`, `route_candidate`
- reasonCodes: `GUARANTEED_EFFECT_PROJECTED`
- inputs: `move.buffs`, `move.buffsSelf`, `move.buffTarget`, `stageState`, `damageCalculator`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-effect-031-guaranteed-effects`, `tools/test-hybrid-battle-intelligence.js`

Guaranteed own buffs and opponent debuffs must alter future route damage and survival with canonical stage clamping.

### CHANCE-032_DO_NOT_EXPLODE_ORDINARY_SEARCH_ON_CHANCE_EFFECTS - Do not explode ordinary search on chance effects

- category: `chance-policy`
- ownerLayer: `Chance Policy`
- priority: `BUFF_DEBUFF_SEQUENCING`
- status: `MODIFIED_FROM_PVPOKE`
- condition: move has non-guaranteed effect
- output: `NO_PROC_MATRIX_OR_REVIEW_BRANCHES`
- allowedOutputs: `no_proc`, `scenario_review_proc_branch`, `scenario_review_no_proc_branch`
- reasonCodes: `NON_GUARANTEED_EFFECT_NO_PROC_MATRIX`
- inputs: `move.buffApplyChance`, `callerContext`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-chance-032-no-proc-matrix`, `DM-02`

Use deterministic no-proc Matrix behavior while preserving extension points for probabilistic Scenario Review.

### FARM-033_FARM_DOWN_ROUTE_CANDIDATE - Farm-down is always a route candidate

- category: `farm`
- ownerLayer: `Farm Planner`
- priority: `FARM_DOWN`
- status: `ACTIVE`
- condition: meaningful route state is evaluated
- output: `FARM_DOWN_ROUTE`
- allowedOutputs: `farm_down_route`, `unsafe_farm_down_rejection`
- reasonCodes: `FARM_DOWN_ROUTE`
- inputs: `fastDamage`, `opponent.hp`, `incomingDamage`, `opponentEnergyGain`, `endingEnergy`, `actionableEnergy`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-farm-033-route-candidate`

Calculate whether pure Fast continuation can KO safely from every meaningful route state.

### SHIELD-034_SHIELDED_CHARGED_CONSUMES_SHIELD - Shielded Charged Move consumes a shield

- category: `shield`
- ownerLayer: `Shield Model`
- priority: `BAIT_SHIELD_POLICY`
- status: `CANONICAL_MECHANIC`
- condition: route branch assumes defender shields a Charged Move
- output: `SHIELDED_ROUTE_STATE`
- allowedOutputs: `shielded_route_state`
- reasonCodes: `SHIELDED_CHARGED_CONSUMES_SHIELD`
- inputs: `defender.shields`, `shieldPolicy`, `chargedMove`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-shield-034-shield-consumption`

When a route assumes a defender shield, Charged damage is shield damage and one shield is consumed under explicit policy.

### SEARCH-035_PRUNE_DOMINATED_STATES - Prune dominated states

- category: `search`
- ownerLayer: `Search Pruning`
- priority: `AMBIGUITY_ESCALATION`
- status: `MODIFIED_FROM_PVPOKE`
- condition: candidate state is dominated by a comparable state
- output: `PRUNE_WITH_REASON`
- allowedOutputs: `prune`, `retain`
- reasonCodes: `DOMINATED_STATE_PRUNED`
- inputs: `turn`, `energy`, `opponentHp`, `stageState`, `opponentShields`, `strategicFuture`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-search-035-prune-dominated-states`

Prune only comparable states with an explainable dominance reason.

### TIE-036_PREFER_FEWER_SELF_DEBUFFS_IN_EQUIVALENT_STATES - Prefer fewer self-debuffs in equivalent states

- category: `tie-break`
- ownerLayer: `Search Tie-Breaking`
- priority: `STABLE_TIE_BREAKS`
- status: `ACTIVE`
- condition: states are outcome/resource equivalent
- output: `STABLE_TIE_BREAK_ORDER`
- allowedOutputs: `prefer_state_a`, `prefer_state_b`
- reasonCodes: `FEWER_SELF_DEBUFFS_TIE_BREAK`
- inputs: `selfDebuffCount`, `positiveBuffCount`, `outcomeVector`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-tie-036-fewer-self-debuffs`

Prefer fewer self-debuffs and more guaranteed positive buffs when two states are otherwise equivalent.

### BAIT-037_BUILD_ENERGY_TO_REPRESENT_NUKE - Build enough energy to represent the nuke

- category: `bait`
- ownerLayer: `Bait Policy`
- priority: `BAIT_SHIELD_POLICY`
- status: `MODIFIED_FROM_PVPOKE`
- condition: baitingEnabled && cheapMoveAvailable && expensiveThreatWouldShield
- output: `FAST_UNTIL_BAIT_CREDIBLE_OR_BAIT_ROUTE`
- allowedOutputs: `fast_move`, `charged_move_candidate`
- reasonCodes: `BUILD_TO_CREDIBLE_NUKE`
- inputs: `actor.energy`, `expensiveMove.energyCost`, `cheapMove.energyCost`, `baitPolicy`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-bait-037-build-to-nuke`

Build enough energy for the expensive threat before baiting when bait policy requires credibility.

### BAIT-038_DO_NOT_BAIT_WHEN_OPPONENT_WOULD_NOT_SHIELD - Do not bait when the opponent would not shield

- category: `bait`
- ownerLayer: `Bait Policy`
- priority: `BAIT_SHIELD_POLICY`
- status: `ACTIVE`
- condition: wouldShield(expensiveMove) === false
- output: `STRAIGHT_ROUTE`
- allowedOutputs: `charged_move_candidate`, `straight_route`
- reasonCodes: `BAIT_NOT_CREDIBLE`
- inputs: `wouldShield`, `straightRoute`, `baitRoute`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-bait-038-do-not-bait-without-shield`

Use the stronger straight line when the expensive move would not reasonably draw a shield.

### BAIT-039_AVOID_SELF_DEBUFFING_BAIT_WHEN_INAPPROPRIATE - Avoid self-debuffing bait when inappropriate

- category: `bait`
- ownerLayer: `Bait Policy`
- priority: `BUFF_DEBUFF_SEQUENCING`
- status: `ACTIVE`
- condition: baitMove.selfDebuffing && strongerMoveNonDebuffing && baitOutcome <= straightOutcome
- output: `NON_DEBUFFING_STRAIGHT_ROUTE`
- allowedOutputs: `charged_move_candidate`, `route_rejection`
- reasonCodes: `AVOID_SELF_DEBUFFING_BAIT`
- inputs: `baitMove`, `straightMove`, `routeOutcomes`, `selfDebuffRisk`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-bait-039-avoid-self-debuffing-bait`

Reject self-debuffing bait when it does not produce a superior outcome over a stronger non-debuffing line.

### MOVE-040_PREFER_USEFUL_IMMEDIATE_DAMAGE_WITHOUT_BAIT_CONSTRAINTS - Without bait constraints, prefer useful immediate damage

- category: `move-ordering`
- ownerLayer: `Move Ordering`
- priority: `OUTCOME_COMPARISON`
- status: `MODIFIED_FROM_PVPOKE`
- condition: noShieldConstraint && noSelfDebuffDominance && outcomeIsPreserved
- output: `DAMAGE_ORDERED_ROUTE`
- allowedOutputs: `charged_move_candidate`
- reasonCodes: `BEST_IMMEDIATE_DAMAGE`
- inputs: `moveDamage`, `routeOutcome`, `selfDebuffRisk`, `shieldState`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-move-040-useful-immediate-damage`

Prefer useful immediate damage only when shields and self-debuff sequencing do not dominate and it cannot turn a proven win into a loss.

### MOVE-041_WITH_SHIELDS_ALLOW_CHEAPER_EFFICIENT_NON_DEBUFFING_MOVE - With shields, allow cheaper efficient non-debuffing move

- category: `move-ordering`
- ownerLayer: `Move Ordering`
- priority: `BAIT_SHIELD_POLICY`
- status: `ACTIVE`
- condition: opponent.shields > 0 && cheapMove.efficient && !cheapMove.selfDebuffing && routeOutcome >= alternativeOutcome
- output: `CHEAPER_EFFICIENT_ROUTE`
- allowedOutputs: `charged_move_candidate`
- reasonCodes: `CHEAPER_EFFICIENT_NON_DEBUFFING_MOVE`
- inputs: `opponent.shields`, `moveEfficiency`, `selfDebuffRisk`, `routeOutcome`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-move-041-cheaper-efficient-with-shields`

Allow a cheaper efficient non-self-debuffing move to lead when it preserves or improves outcome.

### EFFECT-042_AVOID_NONLETHAL_SELF_DEBUFF_NUKE_WHILE_HEALTHY - Avoid nonlethal self-debuff nuke while healthy

- category: `effect-sequencing`
- ownerLayer: `Effect Sequencing`
- priority: `BUFF_DEBUFF_SEQUENCING`
- status: `ACTIVE`
- condition: actorHealthy && shieldsDown && nuke.selfDebuffing && !nukeLethal && stableAlternativeExists
- output: `STABLE_NON_DEBUFF_ROUTE`
- allowedOutputs: `charged_move_candidate`, `route_rejection`
- reasonCodes: `AVOID_EARLY_SELF_DEBUFF`
- inputs: `actor.hp`, `opponent.shields`, `nuke.damage`, `opponent.hp`, `alternativeRoutes`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-effect-042-avoid-nonlethal-self-debuff-nuke`

Prefer a stable alternative when a nonlethal self-debuffing nuke is not needed and outcome is equal or better.

### SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE - Shield based on current and future resource value

- category: `shield`
- ownerLayer: `Shield Policy`
- priority: `BAIT_SHIELD_POLICY`
- status: `MODIFIED_FROM_PVPOKE`
- condition: defender is asked to shield a Charged Move
- output: `SHIELD_OR_NO_SHIELD_DECISION`
- allowedOutputs: `shield`, `no_shield`, `retain_material_counterfactual`
- reasonCodes: `SHIELD_PREVENTS_KO`, `SHIELD_HEAVY_PRESSURE`, `SHIELD_PRESERVES_WIN_CONDITION`, `SHIELD_SAVED_LOW_THREAT`
- inputs: `incomingDamage`, `defender.hp`, `defender.shields`, `attacker.fastDpt`, `futureChargedReachability`, `baitPolicy`, `selfDebuffNukeSignal`
- forbiddenSideEffects: `MUST_NOT_APPLY_DAMAGE`, `MUST_NOT_APPLY_ENERGY`, `MUST_NOT_REGISTER_ACTION`, `MUST_NOT_RESOLVE_ACTION`, `MUST_NOT_MUTATE_CANONICAL_STATE`, `MUST_NOT_USE_SPECIES_ID_EXCEPTION`
- tests: `principle-shield-043-current-future-resource-value`, `DM-01`

Shield decisions consider immediate lethal, damage pressure, remaining shields, next-cycle pressure, Fast DPT, future Charged reachability, self-debuff nuke pressure, and bait policy.

