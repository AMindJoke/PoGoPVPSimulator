# PvPoke Differential Parity

Reference:
actual PvPoke runtime

Pinned revision:
5e1e3d971369a47aaf3e7247f50710d80205d570

This is not manual expected fixture conformance.

- Total states: 640
- Comparable states: 640
- Unsupported states: 0
- Matches: 550
- Failures: 90
- Exact first-decision parity: 85.94%
- Charged Move exact parity: 88.28%
- Shield parity: 100%
- Timing/Fast parity: 97.66%

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

- MOVE_ID_DIFFERENCE: 59
- PVPOKE_ACTION_DIFFERENCE: 31

## Parity by category

| Category | Total | Matches | Failures | Parity |
| --- | ---: | ---: | ---: | ---: |
| bait-enabled | 54 | 50 | 4 | 92.59% |
| battle-start | 107 | 103 | 4 | 96.26% |
| buff | 53 | 43 | 10 | 81.13% |
| cmp | 53 | 39 | 14 | 73.58% |
| debuff | 53 | 43 | 10 | 81.13% |
| different-fast-duration | 107 | 87 | 20 | 81.31% |
| end-game | 160 | 145 | 15 | 90.63% |
| energy-lead | 54 | 43 | 11 | 79.63% |
| farm-down | 53 | 48 | 5 | 90.57% |
| forced-throw | 54 | 49 | 5 | 90.74% |
| immediate-lethal | 53 | 48 | 5 | 90.57% |
| long-match | 53 | 49 | 4 | 92.45% |
| mid-battle | 214 | 175 | 39 | 81.78% |
| pending-fast | 53 | 39 | 14 | 73.58% |
| same-fast-duration | 54 | 54 | 0 | 100% |
| self-debuffing-moves | 53 | 44 | 9 | 83.02% |
| shields | 53 | 44 | 9 | 83.02% |
| shields-down | 54 | 49 | 5 | 90.74% |
| shields-up | 54 | 50 | 4 | 92.59% |
| timing | 106 | 83 | 23 | 78.3% |

## Ten representative mismatches

- `real-diff-018` clodsire_vs_mantine: MOVE_ID_DIFFERENCE. PvPoke charged:EARTHQUAKE; simulator charged:STONE_EDGE.
- `real-diff-050` moltres_galarian_vs_sliggoo: PVPOKE_ACTION_DIFFERENCE. PvPoke fast_move; simulator charged:FLY.
- `real-diff-053` mantine_vs_steelix_shadow: MOVE_ID_DIFFERENCE. PvPoke charged:TWISTER; simulator charged:WATER_PULSE.
- `real-diff-060` drapion_shadow_vs_kingdra_shadow: PVPOKE_ACTION_DIFFERENCE. PvPoke charged:AQUA_TAIL; simulator fast_move.
- `real-diff-065` aegislash_shield_vs_ninetales_alolan: MOVE_ID_DIFFERENCE. PvPoke charged:SHADOW_BALL; simulator charged:GYRO_BALL.
- `real-diff-066` bastiodon_vs_registeel: MOVE_ID_DIFFERENCE. PvPoke charged:STONE_EDGE; simulator charged:FLAMETHROWER.
- `real-diff-070` stunfisk_galarian_vs_jumpluff: PVPOKE_ACTION_DIFFERENCE. PvPoke fast_move; simulator charged:ROCK_SLIDE.
- `real-diff-074` dunsparce_vs_lapras_shadow: MOVE_ID_DIFFERENCE. PvPoke charged:DRILL_RUN; simulator charged:ROCK_SLIDE.
- `real-diff-083` tinkaton_vs_lapras: PVPOKE_ACTION_DIFFERENCE. PvPoke charged:BULLDOZE; simulator fast_move.
- `real-diff-094` forretress_shadow_vs_corviknight_shadow: MOVE_ID_DIFFERENCE. PvPoke charged:SAND_TOMB; simulator charged:ROCK_TOMB.
