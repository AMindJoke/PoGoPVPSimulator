# Canonical Action Trace Contract

## Purpose

The decision trace and battle timeline are two views of the same resolved
mechanic. A selected move is not a used move. Every automatic battle action
must carry one immutable identity chain from selection through resolution or
invalidation.

## Root cause fixed

The worker previously coupled two independent flags:

```text
trace enabled
=> shield counterfactual evaluation enabled
```

As a result, requesting diagnostic evidence could activate a different shield
policy and change the battle being observed. Trace collection and
counterfactual evaluation are now separate inputs. Counterfactuals run only
when explicitly requested or when the configured smart-shield policy owns that
decision.

Fast and Charged lifecycle IDs are materialized from the resolved timeline
after simulation. This prevents lifecycle bookkeeping from consuming planner
budget between decisions. Internal Swing counterfactual battles are also
excluded from the root battle lifecycle.

## Identity chain

Each automatic action records:

- `decisionId`: the decision record that selected the intent;
- `actionIntentId`: the immutable selected intent;
- `queuedActionId`: acceptance into the battle action queue;
- `registeredActionId`: registration as a legal action at a battle boundary;
- `resolvedActionId`: the mechanic that resolved, or the reserved identity of
  an action that was subsequently invalidated;
- `timelineEventId`: the timeline event created by a resolved Fast or Charged
  Move.

IDs are unique within one battle trace. IDs are diagnostic identity only and do
not influence ordering, legality, damage, or decision policy.

The lifecycle contract proves which action resolved; it does not yet certify
repeated-run planner determinism. Existing elapsed-time planner cutoffs remain
an explicit migration item for equal-continuation work and are not recalibrated
in this trace-only change.

## Lifecycle states

### SELECTED

Battle Intelligence, a timing rule, a diagnostic schedule, or the legal Fast
fallback selected an intent.

Required evidence:

- canonical state hash before the decision;
- legal actor;
- action type;
- move identity when applicable;
- selecting source.

### QUEUED

The battle loop accepted the intent for processing.

The current engine queues and registers automatic actions synchronously at the
same turn boundary. Separate IDs and lifecycle states remain mandatory so a
future asynchronous queue cannot silently change the trace schema.

### REGISTERED

The action passed the registration boundary and may resolve.

Registration does not prove resolution. A registered action may still be
invalidated by canonical mechanics.

### RESOLVED

The mechanic occurred.

Fast and Charged Moves must link to exactly one timeline event. The action and
timeline must agree on:

- actor side;
- action type;
- move ID;
- registration turn;
- resolution turn;
- energy cost;
- energy gain;
- HP change;
- timeline event ID.

Wait intents resolve without a Fast or Charged timeline event because they
change readiness rather than applying a move.

### INVALIDATED

The action did not occur.

The trace must provide an `invalidationReason`. Supported initial reasons are:

- `ILLEGAL_ACTION`;
- `INSUFFICIENT_ENERGY`.

Canonical turn-model work may add:

- `ACTOR_FAINTED`;
- `PENDING_FAST_RESOLVED_FIRST`;
- `REPLACED_BY_PRIORITY_ACTION`;
- `STALE_DECISION_STATE`;
- `CMP_LOSS_FOLLOWED_BY_FAINT`;
- `TIMELINE_REPLAY_CANCELLED`;
- `TECHNICAL_EVENT_OVERRIDE`.

An invalidated action must not have a linked resolved timeline event.

## Canonical state hashes

`stateHashBefore` is calculated from the canonical trace snapshot before action
execution. `stateHashAfter` is calculated after resolution or invalidation.

The hash is evidence of state identity, not a cache key and not a substitute
for the full state snapshot.

## Ownership

- Decision Model owns `SELECTED`.
- Battle loop owns `QUEUED`.
- Unified Turn Resolution owns `REGISTERED`, `RESOLVED`, and `INVALIDATED`.
- Timeline presentation consumes only `RESOLVED` actions.
- Decision explanations may describe intent but may not claim that a selected
  move was used.

## Strict validation

`validateActionTraceContract()` rejects:

- missing immutable IDs;
- missing lifecycle states;
- non-terminal action records;
- duplicate resolved action IDs;
- timeline actions without a resolved action;
- resolved timeline/action disagreement on canonical fields.

The Battle reliability suite runs this validation on deterministic worker
traces. Matchup diagnosis may not use the decision trace as proof until this
validation passes.
