# Scenario Comparison branch model v1

Phase 5 introduces a UI-independent, canonical two-branch comparison model. It does not create comparison controls or change Manual Mode behavior.

## Shape

`PvPeakScenarioComparison.deriveComparison()` projects two complete Manual Mode branches into:

- `base.initialState`, `base.initialStateHash` and `base.events`: the shared history, stored once;
- `branchPoint`: stable event, boundary, turn, state hash and optional canonical runtime state at divergence;
- exactly two entries in `branches`, with slots `A` and `B`;
- each branch's divergent event suffix, runtime/manual state, pending Fast events, Technical Issue, edits and terminal result.

The branch entries can point back to existing Manual Mode registry branches through `sourceBranchId`. The current registry remains authoritative for normal branch editing and Undo/Redo; the comparison model is a compact projection intended for comparison, persistence and later shared links.

## Reconstruction

`materializeTimeline()` and `materializeTimelineModel()` rebuild either complete branch by concatenating the immutable shared prefix with that branch's suffix. Returned values are independent clones and never alias live battle state.

## Validation

The model rejects unsupported versions, malformed branch points, anything other than exactly two branches, duplicate identifiers, invalid A/B slot ordering and inconsistent shared-history metadata. Canonical Scenario Review validation also validates every shared and divergent semantic timeline event and verifies referenced source branches.

Scenarios without a `comparison` field remain valid and backward compatible under canonical schema v1.
