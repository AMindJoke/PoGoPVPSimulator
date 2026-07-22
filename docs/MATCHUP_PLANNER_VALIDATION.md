# Matchup Planner Validation

## Frozen Expert Fixture

`tools/test-matchup-planner-fixture.js` records Shadow Quagsire vs Galarian Corsola, 2 shields each, with default Great League profiles and intended competitive moves.

Current baseline:

- Aqua Tail at T8, T17, T25, T33;
- Night Shade at T18, T26, T40;
- Corsola wins;
- Quagsire faints with 31 stranded energy;
- Corsola remains at 27 HP and 5 energy.

Verified legal candidate line under the project's canonical mechanics:

- Aqua Tail at T8, T17, T30, T37, T44;
- Night Shade at T21, T34;
- Quagsire wins with 19 HP and 5 energy;
- Corsola faints with 50 energy.

The diagnostic plan hook exists only in the matrix worker test path. It is inert unless an explicit `diagnosticPlan` payload is supplied, and it is not exposed by the application UI.

## Model Tests

`tools/test-matchup-planner.js` verifies:

- win always ranks above draw and loss;
- draw always ranks above loss;
- resource heuristics cannot overturn outcome class;
- state hashes are stable across object insertion order;
- the maximizing side selects a winning continuation;
- the opponent selects its minimizing best response;
- principal variation records both decisions.
- iterative deepening replaces an attractive shallow line with a proven deeper win;
- only complete root iterations become authoritative;
- planner diagnostics expose completed depth, cache hits, pruning, elapsed time, and incomplete horizon state.

`tools/test-matchup-planner-adapter.js` verifies:

- presentation-only data does not affect canonical state hashes;
- root states are not mutated by adapter transitions;
- throw-now and Fast-then-re-evaluate are both explicit candidates when a Charged Move is ready;
- the next Charged breakpoint is represented as planning metadata;
- actionable and stranded energy are reported separately.

## Required Next Validation

Before enabling the planner:

1. Connect the compact adapter to canonical joint-turn resolution in the browser worker.
2. Prove whether Quagsire's winning line survives Corsola's best response, not only the reference response.
3. Add synthetic timing, shield, CMP, and endgame fixtures.
4. Run all Golden and tactical suites.
5. Classify every changed expectation.
6. Benchmark FAST, STANDARD, and DEEP_REVIEW.

## Performance Budgets

Budgets are provisional until measured:

- FAST should remain within an interactive single-digit millisecond decision budget where possible.
- STANDARD may use tens of milliseconds per ambiguous root.
- DEEP_REVIEW may use hundreds of milliseconds with explicit diagnostics.

No parity claim is made before benchmark data exists.
