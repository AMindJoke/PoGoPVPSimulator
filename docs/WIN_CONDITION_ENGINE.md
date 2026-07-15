# Win Condition Engine

The Win Condition Engine is the deterministic interpretation layer between tactical pattern detection and player-facing explanation.

```text
Battle Engine / alternate continuations
  -> Tactical Pattern Library
  -> Win Condition Engine
  -> Battle Review / Matchup Story / future Battle Coach
```

It answers three structured questions:

- Why did a line work?
- What resource or decision changed the continuation?
- Could the same side still win without that factor?

It does not simulate battles, choose actions, render UI, or invent counterfactuals. Counterfactual conclusions are derived only from comparisons already present in tactical evidence.

## Initial Categories

- `guaranteed-defense-buff`
- `guaranteed-attack-debuff`
- `extra-fast-move`
- `delayed-self-debuff`

These categories are Pokemon-independent adapters over versioned Tactical Pattern Library findings.

## Condition Contract

Each condition includes:

- stable ID, schema version, category, and side;
- confidence and importance as independent fields;
- concise summary and structured answers;
- supporting pattern IDs and unmodified evidence;
- decisive moments and related alternate-line IDs;
- a counterfactual with observed and expected outcomes when available;
- visibility and source/version metadata.

Importance is `critical`, `major`, `minor`, or `informational`. An outcome-changing counterfactual is critical. A material resource improvement can be major without changing the winner.

Confidence describes evidence quality, not tactical impact. A major conclusion with incomplete branch coverage remains medium confidence and must not be promoted as definitive advice.

## Consumer Rules

Battle Review keeps the full structured summary and exposes complete conditions in developer mode.

Matchup Story consumes only conditions that are:

- high confidence;
- at least major importance;
- marked user-facing;
- generated from current, non-stale evidence.

If none qualifies, Matchup Story falls back to its existing matchup-edge explanation. It must not independently reinterpret raw tactical findings.

## Determinism And Performance

The engine performs a linear transformation of existing findings. It does not launch continuation search. Stable sorting uses importance, confidence, decisive turn, and condition ID, so identical evidence produces identical output.

Analysis-only changes do not invalidate the battle simulation cache. Persisted analysis would need regeneration if the schema or adapter behavior changes.

## Adding A Category

1. Add or reuse a generic Tactical Pattern Library finding with measurable evidence.
2. Add one deterministic adapter in `src/analysis/win-condition-engine.js`.
3. Preserve raw supporting evidence and line IDs.
4. Define the counterfactual only from an existing compared continuation.
5. Add positive, negative, confidence, ordering, and consumer-filter tests.
6. Update this document and the Tactical Pattern Library reference.
