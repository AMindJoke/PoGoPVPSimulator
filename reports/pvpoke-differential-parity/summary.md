# PvPoke Differential Parity

Reference:
actual PvPoke runtime

Pinned revision:
5e1e3d971369a47aaf3e7247f50710d80205d570

This is not manual expected fixture conformance.

- Total states: 640
- Comparable states: 640
- Unsupported states: 0
- Matches: 538
- Failures: 102
- Exact first-decision parity: 84.06%
- Charged Move exact parity: 86.56%
- Shield parity: 100%
- Timing/Fast parity: 97.5%

## Loaded PvPoke modules

- src/js/battle/DamageCalculator.js
- src/js/battle/timeline/TimelineAction.js
- src/js/battle/actions/ActionLogic.js

## Corpus uniqueness

- Unique state hashes: 640
- Unique matchups: 80
- Unique species: 80
- Unique move pairs: 80
- Unique decision families: 12

## Top mismatch categories

- MOVE_ID_DIFFERENCE: 61
- PVPOKE_ACTION_DIFFERENCE: 41

## Parity by category

| Category | Total | Matches | Failures | Parity |
| --- | ---: | ---: | ---: | ---: |
| bait-enabled | 54 | 47 | 7 | 87.04% |
| battle-start | 107 | 100 | 7 | 93.46% |
| buff | 53 | 45 | 8 | 84.91% |
| cmp | 53 | 40 | 13 | 75.47% |
| debuff | 53 | 45 | 8 | 84.91% |
| different-fast-duration | 107 | 89 | 18 | 83.18% |
| end-game | 160 | 128 | 32 | 80% |
| energy-lead | 54 | 42 | 12 | 77.78% |
| farm-down | 53 | 45 | 8 | 84.91% |
| forced-throw | 54 | 45 | 9 | 83.33% |
| immediate-lethal | 53 | 38 | 15 | 71.7% |
| long-match | 53 | 46 | 7 | 86.79% |
| mid-battle | 214 | 174 | 40 | 81.31% |
| pending-fast | 53 | 47 | 6 | 88.68% |
| same-fast-duration | 54 | 54 | 0 | 100% |
| self-debuffing-moves | 53 | 42 | 11 | 79.25% |
| shields | 53 | 42 | 11 | 79.25% |
| shields-down | 54 | 45 | 9 | 83.33% |
| shields-up | 54 | 47 | 7 | 87.04% |
| timing | 106 | 94 | 12 | 88.68% |

## Ten representative mismatches

- `real-diff-011` forretress_vs_altaria: MOVE_ID_DIFFERENCE. PvPoke charged:ROCK_TOMB; simulator charged:SAND_TOMB.
- `real-diff-018` clodsire_vs_mantine: MOVE_ID_DIFFERENCE. PvPoke charged:EARTHQUAKE; simulator charged:STONE_EDGE.
- `real-diff-024` guzzlord_vs_corsola_galarian: PVPOKE_ACTION_DIFFERENCE. PvPoke fast_move; simulator charged:BRUTAL_SWING.
- `real-diff-038` sealeo_vs_medicham: MOVE_ID_DIFFERENCE. PvPoke charged:SURF; simulator charged:BODY_SLAM.
- `real-diff-050` moltres_galarian_vs_sliggoo: PVPOKE_ACTION_DIFFERENCE. PvPoke fast_move; simulator charged:FLY.
- `real-diff-056` dewgong_vs_melmetal: PVPOKE_ACTION_DIFFERENCE. PvPoke charged:DRILL_RUN; simulator fast_move.
- `real-diff-057` malamar_vs_altaria_shadow: MOVE_ID_DIFFERENCE. PvPoke charged:FOUL_PLAY; simulator charged:SUPER_POWER.
- `real-diff-060` drapion_shadow_vs_kingdra_shadow: PVPOKE_ACTION_DIFFERENCE. PvPoke charged:AQUA_TAIL; simulator fast_move.
- `real-diff-079` melmetal_vs_morpeko_full_belly: MOVE_ID_DIFFERENCE. PvPoke charged:DYNAMIC_PUNCH; simulator charged:DOUBLE_IRON_BASH.
- `real-diff-083` tinkaton_vs_lapras: PVPOKE_ACTION_DIFFERENCE. PvPoke charged:BULLDOZE; simulator fast_move.
