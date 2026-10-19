# Strategy Review, 2026-10-15

Implemented locally as `battle-planner-v47`. Baseline: `135d9153d190e4248ddc4a25d8535c6cb6c03c3c`.

## Findings And Changes

1. The compact offensive search plans a Charged sequence, then damage/bait heuristics can replace its opener. An early self-debuff or a more expensive guaranteed-effect move can lose the race even when its immediate damage looks better.
2. Nested continuations revisit the same strategic state with further searches disabled. Their cached action could overwrite the fresh outer decision. The returned action could therefore disagree with its own Principle Engine evidence. The current evaluation now owns both action and evidence; memoization only recognizes an agreeing action.
3. The legacy Charged continuation helper does not reliably force its requested opener. The new comparison uses a separate helper that registers the chosen legal Charged action and replays the full canonical round, including CMP, pending Fast impacts and form changes.

The new search is deliberately bounded: compare exactly two affordable openers when post-processing disagrees with the compact route, and either a self-debuff matters with shields or a guaranteed effect matters without shields. Each continuation runs for at most 1,000 automatic steps. Both must terminate and apply their opening action. Prefer win over draw over loss; keep the existing choice on equal outcomes. Recursion is disabled inside continuations, and the live battle state is restored in `finally`.

This is a general move-ordering rule with no species or move-name exceptions. The same callback is included in the live page and generated workers, including swing analysis.

## Measured Results

The reproducible A/B audit uses identical current data and mechanics dependencies for the reference and current strategic code. It includes the automatic-battle corpus plus ten effect-bearing attackers against the first eight ranked opponents, both orientations, Smart/Always shields and 0/1/2 equal-shield scenarios. Duplicate configurations are removed.

| Metric | Result |
|---|---:|
| Distinct scenarios executed | 1,385 |
| Better outcome for the side making the first changed decision | 17 |
| Worse outcome for that side | 0 |
| Unresolved outcome flips | 0 |
| Trace/terminal-state failures | 0 |
| Baseline / current total time | 26.492 / 26.455 seconds |
| Baseline / current p95 per battle | 58.70 / 57.99 ms |
| Baseline / current maximum per battle | 183.02 / 175.80 ms |

Timing is a local Node/VM measurement, not a phone benchmark. The small difference is within run-to-run noise. The result counts scenarios, not unique species pairs; shield policies and orientation remain separate configurations. Two recovered scenarios are Florges mirrors retained as regression coverage; the other fifteen are outside Florges.

| Example | Improved choice |
|---|---|
| Talonflame vs Dewgong, 1-1 and 2-2 Smart | Preserve Fly pressure instead of taking the early Brave Bird defense drop |
| Talonflame vs Gastrodon, 1-1 Smart | Retain Brave Bird: it is useful for drawing the shield |
| Talonflame vs Alolan Marowak Shadow, 1-1 Smart | Retain the winning Brave Bird route and shield allocation |
| Dewgong vs Talonflame Shadow, 0-0 | Drill Run before Icy Wind wins the closing race |
| Skeledirge vs Azumarill, 1-1 Smart | A second Torch Song before Shadow Ball preserves the winning line |

Raw case changes and timings: `reports/strategy-review-20261015.json`.

## Verification

- Targeted move-order tests cover nine matchups, repeated workers, diagnostics and swing-analysis mode.
- Automatic decision quality gate: 13 matchups and 313 legal counterfactual alternatives passed.
- Continuation isolation: 16 cases, diagnostics on/off, swing calculation and repeated worker use passed.
- Battle regressions: 12/12 passed. Reliability, pending-Fast mechanics, special forms, Mega architecture and PWA contracts passed.
- The older golden corpus remains at 22/30 expectations, with the same eight failure messages in baseline and current. Its historical moveset/winner expectations need a separate review; they were not rewritten to make this change pass.

Reproduce the principal checks:

```sh
node tools/test-battle-intelligence.js
node tools/test-automatic-battle-quality.js
node tools/test-continuation-isolation.js
node tools/audit-strategic-move-order.js --ref=135d9153 --output=reports/strategy-review-20261015.json
```

## Remaining Work Before Publication

The engine and browser cache identities are updated. Published rankings and saved matchup datasets still identify `battle-planner-v46`; `tools/test-current-meta-release.js` correctly rejects their version mismatch. Regenerate and verify those datasets before publishing v47. Do not relabel old results as new-engine results.

The audit does not prove optimal play. Continuations follow the existing deterministic policy with nested strategic searches and Smart Shield counterfactual searches disabled. Multiple future deviations may therefore be missed. Timing/overfarm also needs further work: the Skeledirge/Dewgong and Skeledirge/Clodsire examples need opposite timing decisions, so a universal throw-now or wait-one-Fast rule is not justified. Chance-effect evaluation remains deterministic and unchanged.

Reference design context: [PvPoke trainer AI](https://pvpoke.com/articles/development/developing-trainer-battle-ai/) and the pinned reference mappings in `docs/PVPOKE_PRINCIPLE_PARITY.md`. The bounded outcome comparison is documented as an intentional project adaptation.
