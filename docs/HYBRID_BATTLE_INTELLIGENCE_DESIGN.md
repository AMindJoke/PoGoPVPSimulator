# Hybrid Battle Intelligence Design

## Decision boundary

Every automatic caller still enters through:

```text
runAutomaticBattleToEnd
  -> automaticBattleStep
  -> Unified Turn Resolution actor order
  -> autoAction
  -> legalBattleActions
  -> selectBattleIntelligenceAction
  -> PvPeakBattleIntelligence.selectAction
```

The hybrid module supplies structured evidence to the existing Battle
Intelligence boundary. It does not replace legal-action generation, Fast
registration, pending impacts, CMP ordering, shield resolution, damage, buff
application, or terminal scoring.

Normal Battle, Preview, Scenario Review, Matrix workers, and offline generation
therefore share the same policy. Matchup Planner V2 remains optional and is not
enabled by this architecture.

## Default pipeline

```text
legal actions
  -> only Fast legal: Fast
  -> pending own Fast is lethal: Fast
  -> lowest-cost unshielded Charged KO: throw
  -> one more Fast faints / overcaps / concedes lethal charge: throw
  -> active pending Fast is already at optimal timing: throw
  -> compact offensive routes and farm-down routes
  -> high-impact ambiguity?
       no: execute compact result
       yes: compare the complete small alternative set at equal treatment
```

Search eligibility is intentionally score-neutral. Marking an alternative for
continuation cannot improve its priority before the continuation is evaluated.
Certified terminal outcomes outrank heuristics; provisional rollout labels do
not.

Hybrid selection is disabled inside legacy cloned continuations. This keeps the
rollout policy constant across root alternatives instead of changing the
response model halfway through a comparison.

## Structured timing evaluator

`evaluateTiming(input)` accepts canonical actor/opponent state, both Fast Moves,
ready turns, pending events, current energy and HP, and the proposed Fast count.
It returns:

- `safeToWait` and `recommendedFastCount`;
- `actorReadyTurn`, `opponentReadyTurn`, and `timingTarget`;
- `opponentFastInFlight` and `currentTimingOptimal`;
- projected own/opponent energy and Charged counts;
- damage received before the new decision;
- whether a Fast is conceded or denied;
- immediate lethal lost, faint while waiting, cap overflow, pending Fast lethal;
- opponent Charged access and the stricter
  `opponentGetsLethalCharged`; and
- stable reason codes.

The evaluator never treats a cooldown gap as an active Fast Move. Optimal timing
requires a matching pending opponent Fast impact.

## Compact offensive planner

`planOffensiveRoutes(input)` is a bounded dynamic program over:

```text
energy
defender HP and shields
turn
actor and defender attack/defense stages
Fast and Charged counts
first action
action sequence
```

It expands one Fast transition and legal Charged transitions, applies
guaranteed stat effects, models shield consumption through the supplied
canonical shield callback, records farm-down routes, and prunes dominated
states. FAST, STANDARD, and DEEP_REVIEW have explicit state, turn, and
wall-clock budgets.

The planner never embeds Pokemon ids, move-pair exceptions, or matchup-specific
weights. Damage and shield decisions enter through mechanics callbacks.

Pseudo-code:

```text
queue <- root state
while queue not empty and budget remains:
  state <- deterministic best-first pop
  record best bounded route for state.firstAction
  if defender fainted: record terminal route
  if dominated: continue
  record possible farm-down
  enqueue one Fast
  enqueue each affordable Charged Move with guaranteed effects applied

routes <- best non-dominated route per first action
return lexicographically best outcome vector and alternatives
```

## Outcome vectors and actionable energy

Routes compare lexicographically:

1. outcome class;
2. surviving resources;
3. shield value;
4. HP;
5. actionable energy;
6. positional value;
7. time to the next meaningful action;
8. robustness;
9. tactical efficiency;
10. stable deterministic order.

An outcome-class improvement cannot be traded for HP, damage, or energy.

`actionableEnergy` distinguishes stored energy that can reach another legal
Charged Move before faint from stranded energy. Route evaluation tracks the
next reachable Charged Move, Fast count, extra Charged count, conversion
efficiency, and future lethal access.

## Bait, farming, CMP, and effects

Bait policy is explicit:

- `OFF`: do not select a move primarily to draw a shield;
- `SELECTIVE`: retain credible, outcome-relevant bait routes;
- `ALWAYS`: allow bait-first routes without inventing a guaranteed shield.

Farm-down is a route with projected HP loss, turns, final energy, incoming
Charged access, and the same outcome vector as throw routes. It is not a scalar
Fast-damage bonus.

Guaranteed stat changes are applied to route state immediately. Attack buffs,
opponent Attack drops, Defense buffs, and self-debuffs affect subsequent
canonical damage. Repeated self-debuffs therefore accumulate across the route.

CMP is represented as win/draw/loss at simultaneous Charged boundaries and is
part of ambiguity detection.

## Selective response search

Compact disagreements escalate only when they concern:

- outcome class;
- shield allocation;
- CMP boundary;
- lethal timing;
- explicit Fast timing;
- guaranteed-effect sequencing;
- projected Charged sequence; or
- different charged routes while shields remain.

The complete retained alternative set receives the same evaluator and minimum
comparison depth. Time/state budgets may stop only after that comparable set is
evaluated. Low-impact sequence-shape and actionable-energy tie-breaks remain in
the compact planner.

This is selective response analysis, not a mathematical minimax proof.
Opponent continuation behavior remains an approximation in legacy cloned
rollouts.

## Caches and isolation

- Hybrid routes use canonical strategic state, policy, and budget identity.
- Battle Intelligence fast paths include strategic state and legal actions.
- Diagnostic plans clear Battle Intelligence, hybrid-route, and live-planner
  memo tables before replay because they are independent scenario roots.
- Caches are bounded and expose hits, misses, rates, and sizes.
- The Matrix worker instantiates the same hybrid factory as the main page.

## Quagsire/Corsola result

The published fixed Shadow Quagsire line:

```text
Aqua Tail 8/17/30/37/44
Night Shade 21/34
```

is legal and wins with Quagsire at 19 HP. It is not robust to every legal
response. Corsola can use Night Shade at `21/31/44`; holding Quagsire to the
fixed action schedule then loses, with Corsola at 23 HP.

The automatic engine replans instead of following the fixed script and finds
the adaptive winning line `8/17/34/37/44`. The focused fixture protects both
facts: the adaptive win and the fixed-line counterexample.

## Known limits

- Compact survival projection compresses opponent behavior rather than
  enumerating every response.
- Legacy ambiguous continuations still clone mutable combatants and timeline.
- FAST wall-clock budgets can produce bounded rather than complete route sets.
- The remaining Golden weaknesses are the Kingdra/Carbink bait family and
  regular/Shadow Quagsire no-shield opening-move expectations.
