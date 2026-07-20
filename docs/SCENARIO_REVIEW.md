# Scenario Review

Scenario Review continues one battle through multiple connected matchup segments. It is intended for judge review, casting, competitive analysis, and educational battle reconstruction.

It is exposed as a dedicated application view. The view reuses the Battle setup, engine, timeline, manual controls, and battle log while omitting matchup scoring, Battle Review, and Key Elements.
Pokemon selection in this workspace intentionally includes unreleased entries so future or tournament-specific scenarios can be reconstructed without changing the standard Battle filters.

## Architecture

`Battle` remains responsible for simulating one active matchup. `Scenario` is an orchestration layer that records completed segments and carries the surviving Pokemon state into the next matchup.

The dependency direction is:

`Scenario -> Battle input/output`

Battle does not depend on Scenario and should remain usable independently.

## Data Model

### Scenario

- schema version and stable id;
- lifecycle status;
- ordered, unbounded `segments` collection;
- active and awaiting sides;
- locked survivor state;
- original simulator snapshot for future restoration flows.

### ScenarioSegment

- initial and final states;
- winner and fainted side;
- timeline range belonging to the segment.
- optional transition metadata for the incoming Pokemon and timeline boundary.

### Locked Pokemon State

- species and form;
- moveset and IVs;
- HP, energy, and shields;
- attack and defense stages;
- a serializable combatant snapshot used to start the next segment.

## First Interaction Flow

1. Simulate a battle to a knockout.
2. Select **Lock State**.
3. Keep the survivor and its resources unchanged.
4. Optionally adjust either side's shields for the next segment.
5. Select the next Pokemon on the fainted side.
6. Continue the same battle and timeline.

The replaced Pokemon remains visible as a subdued card layer behind the incoming Pokemon. This stack communicates history; it is not decorative.

## Deferred Scope

This first iteration does not implement teams, switch timers, branching timelines, judge comparisons, reports, replay export, or Team Builder integration.
