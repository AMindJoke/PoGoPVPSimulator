# Battle Intelligence Timing Model

## Purpose

Charged Move timing is a strategic decision, not a cosmetic delay. Battle
Intelligence compares a throw that is legal now with bounded alternatives that
may improve the complete battle line.

The model is generic. It does not contain Pokemon, matchup, or move-pair
exceptions.

## Candidate shapes

At a meaningful Charged Move decision, the planner can compare:

- `THROW_NOW(moveId)`: use a currently legal Charged Move.
- `FAST_THEN_REEVALUATE`: complete one safe Fast Move, then rebuild the legal
  state and select again.
- `BUILD_TO(moveId)`: existing continuation behavior while a more valuable
  Charged Move is not yet legal.
- `CONTINUE_FAST`: ordinary Fast Move progress when no charged timing branch is
  strategically meaningful.

`FAST_THEN_REEVALUATE` is an intent, never a forced script. After its Fast Move
resolves, the planner receives the new HP, Energy, Shield, pending-impact,
alignment, and CMP state. It may throw the originally intended move, use a
different move, use another bounded safe Fast Move, or throw immediately under
new pressure.

## Safe additional Fast Move

A Fast Move is eligible only in a bounded post-opponent-Charged window. The
current evaluator rejects a timing branch when it would:

- allow a lethal opposing Fast Move;
- exceed the 100 Energy cap;
- ignore an immediate unshielded lethal Charged Move;
- leave a zero-shield user exposed to an already-ready opposing Charged Move;
- run outside the opponent Fast Move alignment window; or
- exceed two reconsidered Fast Moves in the same timing window.

This prevents a Fast Move from being considered free merely because the actor
survives it. The canonical state includes both Fast durations, ready turns, and
pending Fast Move impacts.

## Continuation comparison

Throw-now and timing alternatives use the same cloned canonical battle state
and the same turn-resolution path. PCSV-style sequence evaluation records:

- final outcome;
- total Charged Moves reached;
- total Charged damage and shield pressure;
- remaining HP and actionable remaining Energy;
- whether energy is stranded at faint; and
- projected continuation quality.

When Projected Charged Sequence Value compares two Charged Moves, both legal
charged candidates are evaluated before the FAST policy budget may stop the
search. This avoids awarding a continuation score to only one move.

Final Energy is not rewarded by itself. It matters only as part of a reachable
future Charged sequence or another actionable continuation.

## Canonical turn geometry

Timing uses Unified Turn Resolution data rather than display coordinates:

- actor and opponent ready turns;
- Fast Move duration and completion;
- pending Fast Move impacts;
- Charged Move interruption and post-charge cooldown reset;
- CMP ordering; and
- shield and KO state.

This is shared by normal Battle, Matrix, offline generation, Preview, and
Scenario Review.

## Diagnostics

Timing decisions emit a `charged-timing-selection` trace entry containing the
current turn, both combatants' resources and ready turns, pending Fast impacts,
throw-now and safe-Fast candidates, projected outcomes, projected sequence, and
the selected reason code.

Relevant reason codes are:

- `SAFE_EXTRA_FAST`
- `OPTIMAL_CHARGE_TIMING`
- `DELAY_REACHES_ADDITIONAL_CHARGE`
- `AVOID_ENERGY_STRANDING`
- `THROW_NOW_PREVENTS_OPPONENT_CHARGE`
- `TIMING_CONTINUATION_FLIP`
- `ENERGY_CAP_FORCES_THROW`

## Regression fixture

`charged-timing-shadow-quagsire-corsola-2s` captures Shadow Quagsire versus
Galarian Corsola at two shields each. After Corsola's first Night Shade, the
planner compares Aqua Tail now with a safe Mud Shot followed by a fresh decision.
The focused regression requires the timing candidate to be selected and the
post-Fast reevaluation to choose Aqua Tail.

The fixture is also an external PvPoke parity clue. It is not treated as proof
that another simulator's terminal result must be copied; the full timeline and
canonical mechanics remain the source of truth.

## Performance limits

Normal Battle stays bounded:

- timing candidates are only generated in meaningful shielded windows;
- no arbitrary Fast Move counts are simulated;
- at most two live Fast reconsiderations are permitted per timing window;
- Charged candidate comparisons retain only the small legal set;
- state hashing includes timing intent/count; and
- continuation simulations remain cloned, memoized, and depth-limited.
