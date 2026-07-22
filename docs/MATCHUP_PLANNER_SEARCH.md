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
- iterative deepening;
- alpha-beta pruning with lexicographic outcome bounds;
- complete-root iteration retention.

Only the deepest iteration that evaluated every root candidate is authoritative. If a budget expires midway through a deeper iteration, the planner retains the previous complete iteration rather than favoring whichever candidate happened to be searched first.

`src/battle/matchup-planner-adapter.js` defines the compact adapter boundary. It strips presentation state from hashes, caches legal strategic candidates, annotates canonical actions with planning intent, and supplies actionable-energy diagnostics to bounded evaluators. Battle mechanics remain callback-owned; the adapter does not call DOM or rendering code.

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

The pure search is complete only relative to its adapter candidates and horizon. The compact adapter contract is now available, but the production browser has not yet connected canonical joint-turn resolution to it. Normal Battle therefore remains on the existing resolver while `MATCHUP_PLANNER_V2` stays disabled.
