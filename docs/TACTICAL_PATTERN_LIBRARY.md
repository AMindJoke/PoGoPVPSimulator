# Tactical Pattern Library

The Tactical Pattern Library gives the planner, reliability tools, Analysis Layer, Battle Review, and future Battle Coach a shared tactical vocabulary. It detects structured battle concepts; it does not execute mechanics, choose actions by itself, or render UI text.

## Architecture

```text
Battle state, decision trace, and alternate lines
  -> Tactical Pattern Registry
  -> Structured Tactical Findings
  -> Tactical Pattern Summary
  -> Win Condition Engine
  -> Planner hints, reliability assertions, and analysis
  -> Separate user-facing translator
```

The main modules are:

- `src/tactical/tactical-patterns.js`: domain model, registry, profiles, detectors, prioritization, summaries, and planner-hint contract.
- `src/analysis/tactical-insights.js`: natural-language translation for eligible findings.
- `src/analysis/win-condition-engine.js`: deterministic conclusions and evidence-backed counterfactuals.
- `src/analysis/battle-review.js`: user-facing high-confidence moments plus developer evidence.
- `src/analysis/matchup-story.js`: consumes translated findings without knowing detector internals.

## Finding Contract

Every finding includes:

- versioned `patternId` and `patternVersion`;
- category, side, Pokemon, move, turn, and decision references;
- relevance and confidence as separate concepts;
- impact and whether the compared outcome changes;
- structured evidence and related line IDs;
- reason codes and visibility;
- source engine version and stale status.

Evidence is mandatory. A detector must not report that a buff matters merely because a move has a buff. It needs a measurable comparison such as a changed outcome, projected rating, retained HP, retained energy, or a reproducible alternate line.

## Initial Patterns

The first complete detector set is:

- `guaranteed-defense-buff-value`
- `guaranteed-attack-debuff-value`
- `delay-self-debuff`
- `extra-fast-move-flip`
- `bait-required`
- `straight-play-sufficient`

The first three use deterministic planner candidate comparisons. Flip detection adapts the existing flip model. Bait and straight-play findings become definitive only when reproducible alternate branches exist. A reason code without a complete shield branch remains analysis-only.

Safe overfarm and CMP-sensitive detection are intentionally deferred until their alternate timing branches expose enough evidence. They should not be inferred from labels alone.

## Relevance And Confidence

Relevance measures how much a pattern matters in this battle. Outcome changes rank highest, followed by material changes to projected rating, HP, energy, or move access.

Confidence measures how well the conclusion is supported:

- `high`: deterministic effect or reproducible branch with complete continuation evidence;
- `medium`: measurable evidence exists, but branch coverage is incomplete;
- `low`: stale, ambiguous, or incomplete evidence.

These values are prioritization aids, not scientific probabilities. Normal users never see their raw values.

## Visibility

- `user-facing`: concrete, current, meaningful evidence with sufficient confidence;
- `analysis`: useful internally but not safe as definitive advice;
- `developer-only`: low-confidence, stale, or diagnostic evidence.

Translation is separate from detection. Detectors never create prose. The translator uses short competitive language and cautious wording for medium-confidence findings.

The Win Condition Engine is also separate from detection. It maps only supported findings into structured conclusions and never launches new battle search. Player-facing narrative consumers filter these conclusions by confidence, importance, freshness, and visibility.

## Analysis Profiles

- `planner-critical`: guaranteed stat effects and self-debuff sequencing.
- `interactive-analysis`: planner-critical plus flip, bait, and straight-play adapters.
- `offline-deep`: all currently supported detectors with richer evidence when available.
- `reliability`: all detectors and diagnostic output.

The library scans existing decisions and lines linearly. It does not run deep battle search. Measured duration is included only when `measurePerformance` is explicitly enabled, keeping normal findings deterministic. Deep branch generation must remain opt-in for offline pipelines until benchmarked.

## Planner Integration

Patterns support continuation search; they do not replace it. `plannerHintsFromTacticalFindings()` exposes candidate IDs that should be preserved or explored later. The current planner already performs the continuation comparisons that produce guaranteed-effect and self-debuff evidence, so this first version does not alter planner behavior.

Future planner integration may use findings to prevent premature pruning or request a specific delayed-use branch. A pattern alone must never force an action.

## Adding A Detector

1. Define a generic, Pokemon-independent condition.
2. Require normalized state, trace, or alternate-line input.
3. Produce measurable structured evidence.
4. Separate relevance from confidence.
5. Choose the narrowest safe visibility.
6. Register and version the detector centrally.
7. Add positive, negative, stale, and A/B-orientation tests.
8. Add a regression fixture when the detector protects a reported matchup.
9. Add translation only when the finding is safe for players.
10. Decide whether the change affects planner output, analysis only, or wording only.

Never branch on a species name or species ID. Shadow variants and future Pokemon must work through the same mechanics and evidence.

## Regression Assertions

Battle fixtures may now declare:

```json
{
  "requiredPatternIds": ["guaranteed-defense-buff-value"],
  "forbiddenPatternIds": ["straight-play-sufficient"],
  "minimumPatternConfidence": {
    "guaranteed-defense-buff-value": "high"
  }
}
```

A reported bug can therefore protect the winner, planner decision, reason code, and tactical interpretation independently.

## Versioning And Cache Impact

Pattern and translation versions are separate from the battle engine version.

- Planner-affecting detector changes require a battle-planner version bump and simulation cache review.
- Analysis-only detector changes require regenerated analysis only when findings are persisted.
- Wording-only changes do not invalidate simulations or analysis evidence.

This initial implementation is analysis-only and does not itself change battle outcomes. The current `battle-planner-v4` cache version also excludes impossible terminal pressure from fainted combatants.

## Development Workflow

```text
Wrong matchup reported
  -> reproduce through Battle Review
  -> inspect decision trace
  -> identify tactical pattern
  -> confirm detector coverage
  -> add regression fixture
  -> improve generic detector or planner integration
  -> run regression suite
  -> evaluate cache invalidation
  -> expose user insight only when confidence is sufficient
```

## Known Limits

- Chance-based effects are not treated as guaranteed.
- Bait findings need explicit alternate branches for high-confidence user advice.
- Current trace candidates expose projected HP, energy, rating, and outcome, but not every intermediate damage packet.
- Safe-overfarm and CMP-sensitive detectors need richer timing counterfactuals.
- Offline ranking generation does not run tactical analysis by default.
