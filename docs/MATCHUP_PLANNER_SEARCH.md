# Matchup Planner Search

## Search Contract

`src/battle/matchup-planner.js` is mechanics-agnostic. A live adapter must provide:

- `hash(state, policy)`;
- `terminal(state, perspective)`;
- `evaluate(state, perspective)` for bounded horizons;
- `candidates(state, side, context)`;
- `apply(state, side, candidate, context)`.

The adapter, not the planner, understands simultaneous turn geometry and Unified Turn Resolution.

## Adversarial Choice

At nodes owned by the perspective side, search maximizes the `OutcomeVector`. At opponent nodes, it minimizes that same vector. Both sides therefore use the same search quality and terminal ordering.

The initial implementation uses deterministic depth-bounded minimax with:

- transposition caching;
- node and time budgets;
- stable candidate ordering;
- terminal and bounded-horizon leaves;
- principal-variation retention.

Alpha-beta and dominance pruning will be added with the canonical adapter, where legal simultaneous responses can be ordered safely.

## Strategic Candidates

The live adapter should expose only meaningful decisions:

- throw an affordable Charged Move now;
- continue one Fast Move;
- Fast to the next Charged breakpoint;
- Fast to an opponent threat/CMP boundary;
- overfarm to a future Charged-count breakpoint;
- shield or no-shield when policy permits;
- forced throw before faint;
- legal technical timing choices supplied by Scenario Review.

Arbitrary Fast counts should not be enumerated.

## Actionable Energy

Raw energy is not automatically valuable. The live evaluator must distinguish:

- actionable energy that reaches pressure before faint/horizon;
- stranded energy that cannot affect the result;
- an additional Charged Move made reachable by one more Fast Move.

PCSV may remain a same-outcome sequence-quality signal. It must never replace the outcome vector.

## Known Limitation

The pure search is complete only relative to its adapter candidates and horizon. The current production rollout is not yet a canonical planner adapter and remains unchanged during this migration stage.
