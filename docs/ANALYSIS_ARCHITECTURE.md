# PvPeak Analysis Architecture

PvPeak is moving from a battle simulator toward a battle analysis platform. This document defines the boundary between simulation, offline data, analysis, coaching, and UI.

## Pipeline

```text
Battle Engine
  -> Offline Generator
  -> Offline Dataset / Matchup Cache
  -> Tactical Pattern Library
  -> Win Condition Engine
  -> Analysis Layer
  -> UI / Matchup Inspector / Battle Coach
```

## Responsibility Boundaries

### Battle Engine

The battle engine answers: **what happened?**

It owns:
- damage calculation
- move timing
- shields
- buffs and debuffs
- battle result scoring
- timeline events

It should not own:
- matchup explanations
- coaching text
- meta ranking interpretation
- UI rendering

### Offline Generator

The offline generator repeatedly calls the battle engine and stores results.

It owns:
- candidate Pokemon selection
- IV profile selection
- shield scenario generation
- matchup cache reads/writes
- ranking aggregation
- dataset validation trigger

It should not own:
- user-facing coaching
- UI layout
- hand-written matchup opinions

### Offline Dataset

The dataset is the published source of precomputed facts.

It should contain:
- generation metadata
- validation metadata
- ranking entries
- score/category fields
- enough information for analysis helpers to consume

The dataset should not contain UI-specific layout decisions.

### Analysis Layer

The analysis layer answers: **why does this matchup behave this way?**

It consumes simulator or offline data and produces structured analysis objects.

Initial modules live in `src/analysis/`:
- `types.js` defines stable reusable contracts.
- `matchup-analysis.js` converts battle/ranking data into matchup analysis objects.
- `battle-coach.js` defines the coach plug-in architecture.
- `offline-analysis.js` summarizes offline datasets for future tools.
- `win-condition-engine.js` turns supported tactical findings into deterministic, evidence-backed conclusions.

The Win Condition Engine sits after pattern detection and before narrative consumers. Matchup Story must consume eligible conclusions rather than independently interpreting raw detector output. See `docs/WIN_CONDITION_ENGINE.md`.

The analysis layer is allowed to compute:
- matchup complexity
- volatility
- consistency
- shield dependency
- bait dependency
- energy dependency
- flip opportunities
- battle hints
- coach recommendations

It should not duplicate battle mechanics.

### UI

The UI should consume analysis objects.

Future UI features should ask the analysis layer for:
- inspector data
- coach recommendations
- matchup difficulty
- dependency labels
- explanations

The UI should not implement battle or ranking logic directly.

## Core Data Contracts

The first analysis contracts are intentionally broad so future features can fill them incrementally:

- `BattleResult`: what the simulator produced.
- `MatchupAnalysis`: complete analysis object for one matchup or ranking row.
- `BattleLine`: standard or alternate simulated line.
- `FlipOpportunity`: small advantage that can change the result.
- `BattleHint`: lightweight explanation.
- `CoachRecommendation`: actionable coaching output.
- `ComplexityMetrics`: volatility, consistency, dependency scores.
- `DependencyMetrics`: shield, bait, energy, HP, debuff, and CMP sensitivity.

These are plain JavaScript objects for now. If the project later moves to TypeScript, these contracts should become interfaces with the same shape.

## Future Feature Mapping

### Matchup Inspector

Consumes `MatchupAnalysis`.

Expected future sections:
- standard line
- alternate lines
- flip opportunities
- shield-sensitive lines
- bait-sensitive lines
- energy-sensitive lines
- HP-sensitive lines
- breakpoints and bulkpoints
- complexity and difficulty labels

### Battle Coach

Consumes a `CoachContext` and emits `BattleHint` / `CoachRecommendation` objects.

Future modules can specialize in:
- move timing
- shield calls
- bait decisions
- overfarm windows
- self-debuff management
- CMP risk
- switch and alignment advice

### Offline Matchup Analysis

Consumes generated datasets and produces league or format-level metadata.

Future outputs:
- high-complexity matchups
- volatile Pokemon
- shield-dependent Pokemon
- bait-dependent Pokemon
- energy-sensitive Pokemon
- stable core candidates

## League Compatibility

The analysis layer must not assume Great League forever.

Every analysis object should carry:
- `league`
- `format`
- `profile`
- dataset/source metadata when available

This keeps the architecture ready for Ultra League, Master League, Little Cup, custom cups, and future 3v3 tools.
