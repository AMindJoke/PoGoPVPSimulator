# Current 2026 Timing Regeneration

## Inputs

- Season: `current-2026-06-28`
- Baseline: `battle-planner-v33`, generated `2026-08-25T14:07:52.001Z`, commit `89feb01`
- Current: `battle-planner-v39`, generated `2026-09-05T11:26:31.307Z`
- Game Master inputs were recorded in the differential report; no configured input differences were detected.
- Scope: 1,541 attackers x 1,541 opponents x 3 equal-shield scenarios = 7,119,420 cells.

## Regeneration

All four ranking chunks completed without failed cells. The merged ranking passed the dataset quality pipeline (`VALID`). Split matchup output contains all 1,541 attackers for `0-0`, `1-1`, and `2-2`; the split index was rewritten after merge to reflect the complete dataset.

The compact-result formatter was corrected during this run:

- simultaneous faints remain `winner: tie`;
- HP ratios use the simulator's `aHp`/`bHp` fields;
- a legitimate score of `0` is no longer coerced to `500`.

## Differential Summary

- Unchanged: 6,651,820 (93.43%)
- Minor: 53,904 (0.76%)
- Meaningful: 47,639 (0.67%)
- Major: 366,057 (5.14%)
- Winner flips: 79,108 (1.11%)
- Long-fast states: 283,650; meaningful changes: 46,029; winner flips: 7,563.
- Same-duration winner flips retained for review: 19,372.

Same-duration changes were spot-checked with traced battles. They are caused by the timing migration changing the ordering between fast-move impacts and charged resolution even when both fast moves have the same duration; the current traces show the expected deferred-impact ordering, not a missing turn or duplicate action. Full flip records are in `differential-summary.winner-flips.jsonl`.

Largest rank risers include Yveltal (+374), Vivillon (+368), Rhyhorn Shadow (+335), Chandelure Shadow (+330), and Ceruledge (+321). Largest fallers include Raichu (-417), Serperior Shadow (-411), Swampert Shadow (-403), Pawmot (-395), and Aegislash Shield (-391).

## Incinerate Review

The top-100 ranking pool contained 23 Incinerate users. The strict-DRE differential covered 12,144 states: 5,833 changed, 859 winner flips, and 1,394 charged-count changes. The detailed output is in `reports/incinerate-dre-differential/summary.json`.

## Verification

- PWA contract: passed
- Matrix simultaneous-faint regression: passed
- Turn-resolution engine tests: passed
- Talonflame/Furret fast-close regression: passed
- Battle regressions: 12/12 passed
- Dataset quality report: `VALID`
