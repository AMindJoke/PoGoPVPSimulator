# Matchup Planning Engine

## Purpose

The Matchup Planning Engine evaluates complete reachable strategic lines and returns the first canonical legal action of the best line. It sits behind Battle Intelligence; it does not execute mechanics and it does not create a second strategic boundary.

Current migration status: model and pure adversarial search are implemented, but live automatic battles still use the existing Battle Intelligence rollout. Runtime integration remains behind the `MATCHUP_PLANNER_V2` migration boundary until the canonical adapter passes the expert fixture.

## Boundaries

```text
Canonical Battle State
  -> Unified Turn Resolution legal actions
  -> Battle Intelligence
  -> Matchup Planning Engine
  -> first canonical legal action
  -> Unified Turn Resolution mechanics
  -> updated Canonical Battle State
  -> re-plan
```

- Battle Intelligence owns strategic selection.
- Unified Turn Resolution owns legality, turn order, CMP, Fast/Charged resolution, shields, and technical events.
- The planner owns line generation, best-response search, terminal ordering, and principal variations.
- Timing intentions are metadata. They never bypass a fresh legality check.

## Core Models

`OutcomeVector` compares terminal results lexicographically:

1. win, draw, loss;
2. surviving resources;
3. shields;
4. HP;
5. actionable energy;
6. position and time to the next meaningful action;
7. robustness;
8. heuristic and stable tie-breaks.

`MatchupPlan` stores the root hash, policy, principal variation, alternatives, outcome, confidence, search diagnostics, and reason codes.

`StrategicLine` stores actions, opponent responses, final state, outcome vector, completeness, and horizon reason.

`PlanStep` stores one canonical action plus strategic and timing intent metadata.

## Policies

- `FAST`: tight interactive budget for normal Battle.
- `STANDARD`: broader search for Matrix and detailed simulations.
- `DEEP_REVIEW`: larger deterministic search for Scenario Review and validation.

All policies use the same outcome ordering. A deeper policy may prove a better line; a shallower policy must report an incomplete horizon rather than invent certainty.

## Caching

The pure planner accepts a transposition table. Cache keys combine canonical state hash, side, remaining depth, perspective, policy, and mechanics version supplied by the adapter. Presentation-only state must never enter the hash.

## Migration Safety

The planner is not authoritative until:

- the live adapter transitions exclusively through canonical mechanics;
- Shadow Quagsire vs Galarian Corsola 2-2 proves the winning principal variation under best responses;
- normal and deep policies pass focused timing, shield, CMP, and endgame fixtures;
- performance budgets are measured.

No Pokemon-specific condition is permitted.
