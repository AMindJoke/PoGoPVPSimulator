# Battle Engine Reliability

This document describes the first reliability layer around the shared 1v1 battle engine. Its purpose is observability and reproducibility, not proof that every simulated line is optimal.

## Planner Version

`src/reliability/battle-reliability.js` owns `BATTLE_ENGINE_VERSION`.

`battle-planner-v2` adds sequence-aware Smart shielding: the existing heuristic remains the default choice unless shield and no-shield continuations produce different winners. In that decisive case, Smart selects the winning branch and records a player-facing critical decision.

Increment it whenever a behavior-affecting rule changes, including move choice, shield policy, bait policy, stat-effect valuation, continuation search, CMP handling, or move timing. Browser matrix cache keys and offline matchup cache files include this version.

An offline or cached result is stale when its engine version is missing or differs from the current planner version. Stale data may be inspected, but it must not be silently presented as current engine output.

## Battle Trace

Tracing is disabled by default. Offline callers enable it with:

```js
adapter.simulate({
  trace: true,
  source: "battle-regression",
  config
});
```

For browser debugging, open the simulator with `?debugBattle=1`. Matrix traces are printed as collapsed groups in the developer console and are removed before results enter IndexedDB.

A trace contains compact snapshots and normalized candidates rather than live engine objects:

```json
{
  "schemaVersion": 1,
  "battleId": "sableye-empoleon-1s",
  "engineVersion": "battle-planner-v1",
  "source": "battle-regression",
  "decisions": [
    {
      "turn": 27,
      "side": "A",
      "pokemonId": "sableye",
      "decisionType": "charged-move-selection",
      "chosenCandidate": { "moveId": "DRAIN_PUNCH", "projectedOutcome": "win" },
      "reasonCode": "GUARANTEED_DEFENSE_BUFF_VALUE",
      "explanation": "projected continuation favors Drain Punch"
    }
  ]
}
```

Completed traced battles also expose:

- `shieldCounterfactuals`: the same decision simulated with and without a shield, including outcome, remaining HP, energy, shields, and charged-move access;
- `terminalSnapshots`: energy, affordable or lethal charged moves, faint cause, and action-window evidence for each fainted Pokemon.

These fields are observational. A terminal snapshot only sets `legalMoveCouldChangeOutcome` when an evaluated same-turn planner candidate already demonstrated a winning continuation. Remaining energy by itself is not enough to accuse the planner of missing a move.

Reason codes and bug categories are documented by their exported lists in `src/reliability/battle-reliability.js`. Add new values there before emitting them.

## Regression Cases

Fixtures live in `data/battle-regressions/great-league.json`. A case contains:

- Pokemon ids and move overrides;
- IV preset, HP, starting energy, and shields;
- battle policy;
- expected winner or acceptable winners;
- expected or forbidden move choices;
- required or forbidden reason codes;
- notes and reusable bug categories.

Keep expectations focused on the behavior under review. Do not assert a winner when the case is only intended to protect move sequencing.

Run the suite with:

```powershell
npm run test:battle-regressions
```

The summary is written to `reports/battle-regressions/`. A failed case also writes its full result and trace to `reports/battle-regressions/failures/<case-id>.json`.

## Contradiction Scanner

Run:

```powershell
npm run scan:battle-contradictions
```

The first scanner checks only evidence-backed conditions:

- a chosen charged move projects a loss while an evaluated legal alternative projects a win;
- a guaranteed effect candidate has a demonstrably better continuation;
- a shield has a supplied no-shield counterfactual with no meaningful gain;
- a fainted Pokemon has supplied evidence for an outcome-changing legal charged move;
- directly simulated A/B orientations fail safe inversion.
- Smart selects a losing shield call while the opposite call has a demonstrated winning continuation (`MISSED_WINNING_SHIELD`). Explicit `Always` policy outcomes are not classified as missed-winning Smart decisions.

If the required counterfactual is absent, the scanner skips the rule. Findings are labelled `potential`; they are leads for review, not confirmed bugs.

Reports are written below `reports/battle-contradictions/` and are ignored by Git.

## Bug Workflow

```text
Reported wrong matchup
  -> reproduce with trace
  -> classify the bug
  -> add or refine a regression fixture
  -> implement a generic fix
  -> run the reliability and regression suites
  -> increment BATTLE_ENGINE_VERSION when behavior changes
  -> invalidate affected caches
  -> regenerate affected offline data when needed
```

Never patch the planner for a named Pokemon or matchup. A confirmed issue must be expressed as a generic battle rule and protected by external fixtures.

The Matchup Inspector can expose `battleInsights` generated by live matrix results. These are intentionally limited to decisions that change the winner; raw trace decisions remain developer-only.

## Commands

```powershell
npm run test:battle-reliability
npm run test:battle-regressions
npm run scan:battle-contradictions
```

`test:battle-reliability` covers trace defaults and determinism, reason-code validation, fixture loading, failure reports, provenance staleness, scanner rules, and A/B orientation handling.

## Current Limits

- The trace covers charged-move selection, farm-versus-throw waits, continuation comparisons, and shield decisions.
- Branch-pruning fields exist in the trace contract, but the current shallow continuation planner does not yet expose a complete pruning tree.
- Wasteful-shield checks use traced shield/no-shield continuations. Unused-lethal checks remain intentionally stricter and require a demonstrated legal same-turn winning candidate.
- The scanner does not replace an oracle search or expert review.

The recommended next step is to review real scanner findings, promote confirmed examples into the regression corpus, and add a timing-window model that can distinguish CMP loss, fast-move lock, and genuinely missed charged-move access.
