# Matchup Story

Matchup Story is a deterministic tactical summary displayed at the top of the Matchup Inspector. It turns structured matchup analysis into a concise explanation without changing battle simulation behavior.

## Pipeline

```text
Battle result or cached matchup
  -> structured Inspector analysis
  -> buildMatchupStory(input)
  -> Matchup Story UI
```

The story builder lives in `src/analysis/matchup-story.js`. It is a pure function and does not read DOM state, run simulations, or calculate battle mechanics.

## Current Signals

The MVP uses only signals already produced by the simulator and Matchup Inspector:

- winner and score for 0-0, 1-1, and 2-2 shields;
- selected even-shield state;
- matchup closeness;
- HP, energy, charged readiness, closing cost, farm pressure, and outpace score components;
- winner changes across even-shield states;
- reproducible flip suggestions, including side, fast move, fast-move count, timing cost, and line type;
- bait-dependent and debuff-sensitive alternate lines;
- precomputed or live-analysis source.

Unsupported tactical claims are omitted. A missing-data story degrades to a short unavailable-analysis message.

## Deterministic Templates

Templates are selected from evidence keys rather than Pokemon names. For example:

- `hpEdge` describes the stronger remaining HP position;
- `energyEdge` describes the energy race;
- `readyEdge` describes the next meaningful charged-move window;
- a reproducible swing creates a timing win condition;
- a bait swing creates bait-dependent guidance;
- a debuff-sensitive swing creates self-debuff guidance;
- winner changes across shield states create shield-dependent guidance.

New templates should:

1. require a structured analysis signal;
2. use cautious wording when a branch is conditional;
3. include evidence keys;
4. avoid Pokemon-specific checks;
5. respect the item limits exported as `MATCHUP_STORY_LIMITS`.

Copy should read like concise competitive advice. Prefer complete, actionable sentences such as "One extra fast move is enough" or "Baiting isn't required." Avoid exposing implementation language such as detected branches, projections, continuations, or timing-cost labels.

A line is bait-dependent only when the Pokemon can spend less energy on one charged move before threatening a more expensive one. Choosing between equal-cost charged moves is move sequencing, not baiting.

Flip checks add starting energy without applying fast-move damage. Describe this as stored energy or an energy lead; never imply that the opponent was given a free fast move or sneak unless the analysis model explicitly supplies that evidence.

## Confidence

- `high`: precomputed result with a valid score;
- `medium`: live analysis with a valid score;
- `low`: missing or insufficient result data.

Low-confidence stories omit tactical threats and common mistakes instead of presenting speculation as fact.

## Interactive Items

A win condition becomes clickable only when its alternate line is reproducible. The story action contains the same shield state, side, fast-move count, and line type used by the existing Preview Mode. Non-reproducible guidance is rendered as text, never as a dead button.

The raw even-shield Inspector remains below Matchup Story and continues to provide Open and Preview controls.

## Current Limitations

- Exact charged-move threats are shown only when a reliable named threat is supplied by analysis data.
- The current browser cache does not preserve every timeline event for every matrix cell.
- Shield-call mistakes, CMP sensitivity, and detailed branch trees are not inferred without explicit evidence.
- The MVP covers Great League even-shield scenarios only.
- Matchup Story uses Pokemon A as the default player perspective in the current Inspector UI.
