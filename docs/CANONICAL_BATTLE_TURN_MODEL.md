# Canonical Battle Turn Model

## Scope

This document defines the timing vocabulary and the target mechanical order for
all deterministic 1v1 simulations. Battle, Matrix, Preview, workers, diagnostic
fixtures, and Scenario Review must eventually execute this same model.

The canonical source of truth is the resolved state transition, not the
timeline renderer and not a planner's requested action.

## Vocabulary

- **Absolute turn**: zero-based 500 ms simulation boundary.
- **Ready turn**: earliest absolute turn on which a side may request an action.
- **Cooldown**: remaining distance to the ready turn. It is derived as
  `max(0, readyTurn - currentTurn)` and is not independent state.
- **Action request turn**: turn on which policy returns an intent.
- **Queue insertion turn**: turn on which that intent enters the mechanic queue.
- **Action registration turn**: turn on which mechanics accept the queued intent
  as legal. A request can be invalidated instead of registered.
- **Fast Move start**: registration turn of a legal Fast Move.
- **Fast Move completion**: first turn on which the actor is free to request its
  next action: `start + duration`.
- **Fast Move impact**: boundary on which its damage and energy register:
  `start + duration - 1`.
- **Charged input**: policy request for a particular Charged Move.
- **Charged registration**: acceptance after readiness, energy, faint and pending
  lethal checks.
- **Charged resolution**: application of energy cost, shield/form protection,
  damage and stat effects for a registered Charged Move.
- **CMP**: ordering of two Charged intents registered at the same boundary.
  Higher current Attack resolves first; stable side order breaks an exact tie.
  Merely having enough energy for a Charged Move does not enter CMP.
- **Pending action**: requested or queued intent not yet registered.
- **Pending impact**: registered Fast Move whose impact boundary has not resolved.
- **Simultaneous faint**: both sides reach zero HP from impacts in the same
  mechanical phase and boundary.
- **One-turn lag**: diagnostic state in which an action request/registration is
  delayed by one absolute turn; it does not change move choice.
- **DRE**: diagnostic state in which a Fast impact is retained as pending until
  its canonical resolution/denial boundary; it does not change move choice.

## Canonical boundary order

```text
Turn N begins
  1. Activate queued events whose resolution boundary is N
  2. Determine living sides whose readyTurn <= N
  3. Ask each ready side for one action intent
  4. Validate and insert those intents into the mechanical queue
  5. Establish queue order from event age, action phase, and CMP
  6. Resolve mature Fast impacts that precede new registrations
     - impacts sharing a boundary and phase use one phase-start HP snapshot
     - apply their damage together, allowing a simultaneous faint
  7. Register the surviving legal intents
     - Charged vs Charged: order by CMP
     - Charged vs newly started Fast: register Charged first
     - reject an intent whose actor was already fainted by phase 6
  8. Resolve registered Charged actions in order
     - revalidate the second action after the first
  9. Register Fast starts and create their impact events
     - a 1-turn Fast impacts in this same boundary
     - longer Fast impacts remain pending
 10. Resolve same-boundary Fast impacts as one phase
 11. Update readyTurn values and record the resolved state transition
 12. Check terminal state and advance to the next relevant boundary
```

An older pending Fast impact therefore precedes a newly registered Charged
Move on the same boundary. A Charged Move that was legally registered on an
earlier boundary is a different case and must retain its queue age. Queue age,
not a UI timestamp, decides the ordering.

## Phase ownership

| Phase | Sole owner |
| --- | --- |
| Readiness and legal-action enumeration | Turn Resolution Engine |
| Strategic action intent | Decision Engine |
| Queue insertion, legality and CMP | Turn Resolution Engine |
| Damage and energy arithmetic | Battle mechanics |
| Buff, debuff and form effects | Existing battle mechanics |
| Pending-impact scheduling and resolution | Turn Resolution Engine |
| Timeline presentation | Timeline renderer |
| Outcome and terminal state | Turn Resolution Engine |

The Decision Engine may propose an action. It may not apply damage, manufacture
energy, choose CMP order, or convert a request directly into a resolved event.

## Current implementation audit

The reusable turn engine already owns normalized readiness, legal actions,
pending Fast impact events, event ordering, CMP Attack comparison, terminal
outcomes and state validation. It now also exposes intent-based registration
ordering, the canonical Fast impact formula, and simultaneous due-impact
resolution.

Two legacy integration gaps remain and are intentionally visible:

1. Normal `useFast()` applies damage and energy immediately, then records a
   timeline event. Only DRE and one-turn-lag paths currently create a pending
   Fast impact.
2. `automaticBattleStep()` orders actors before collecting their intents.
   Its legacy `orderReadySides()` gives precedence to a side that merely has an
   affordable Charged Move. Canonical CMP requires both selected intents.

Consequently `orderReadySides()` is compatibility scheduling, not canonical CMP.
New mechanics must use `registerActionIntents()` after intent collection. The
normal Battle migration must be performed behind state-transition fixtures so
that existing buff/debuff behavior is preserved.

## Frozen invariants

- A side cannot register before its ready turn.
- Energy is checked at registration and remains within 0–100.
- Fast impact is always `start + duration - 1`.
- Fast completion/next readiness is `start + duration`.
- CMP only compares two registered Charged intents.
- A pending lethal Fast impact due before Charged registration can invalidate
  that Charged request.
- Same-boundary Fast impacts resolve from one phase-start snapshot.
- A Fast impact whose source fainted on an earlier boundary is denied.
- The renderer never determines mechanical timing.
- One-turn lag and DRE alter timing state only, never strategic selection.

The focused executable contract is `tools/test-turn-resolution-engine.js`.
