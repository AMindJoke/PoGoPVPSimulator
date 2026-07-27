# Turn Resolution Engine

The Turn Resolution Engine is the shared timing and legality layer for 1v1 battles and Scenario Review reconstructions.

The normative vocabulary, phase ownership, and boundary order are defined in
`docs/CANONICAL_BATTLE_TURN_MODEL.md`. This document is an implementation
overview.

## Responsibilities

The engine owns five reusable concepts:

1. A normalized turn state for both combatants.
2. The legal actions available to each side at the current turn.
3. Stable ordering for simultaneous action windows and CMP.
4. Scheduled events, including pending Fast Move impacts.
5. Terminal outcomes and invariant validation.

Move selection remains in the Decision Engine. Damage calculation remains in the battle mechanics. UI and analysis remain consumers of the resulting timeline and trace.

## Decision Flow

```text
Combatant state and ready turns
  -> Turn Resolution Engine
  -> legal actions and pending threats
  -> Battle Intelligence
  -> selected action
  -> battle mechanics
  -> scheduled event resolution
  -> next state
```

The Decision Engine does not need to know whether a timing change came from DRE, one-turn lag, or a future tournament reconstruction. It sees legal actions and scheduled threats. For example, any pending lethal Fast impact creates urgency to use an already legal Charged Move before that impact resolves.

## Scheduled Fast Impacts

A scheduled Fast impact records:

- source and target side;
- move identity;
- start, duration, and resolution turn;
- damage;
- source context, such as normal battle, DRE, or one-turn lag;
- pending, resolved, or denied status.

If the source faints before its pending impact resolves, the event is denied. Otherwise damage is applied at resolution.

The initial integration uses scheduled impacts for timing-sensitive technical reconstructions while preserving established live-simulation results elsewhere. New timing mechanics must use this shared event contract instead of adding feature-specific move-choice rules.

## CMP And Sneak

After both ready sides have selected their intents:

- a selected Charged Move registers before a newly selected Fast Move;
- if both selected Charged Moves, higher Attack wins CMP;
- stable side ordering breaks a true Attack tie deterministically.

Merely having enough energy for a Charged Move does not enter CMP. The legacy
`orderReadySides()` helper is compatibility scheduling; canonical registration
uses `registerActionIntents()` after intent collection.

Sneak detection is derived from the Fast Move active window and the opposing Charged Move turn. The timeline renderer only displays the resulting metadata.

## Invariants

- HP cannot be negative.
- Energy remains between 0 and 100.
- Ready turns cannot be negative.
- Pending event identifiers are unique.
- Fainted combatants receive no legal actions.
- A denied pending Fast impact deals no damage.
- Feature-specific code may alter timing or queue events, but may not directly choose a move.

Run the focused suite with:

```powershell
npm run test:turn-engine
```
