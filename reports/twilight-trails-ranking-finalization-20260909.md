# Twilight Trails ranking finalization

The confirmed-move Great League dataset contains 1,542 unique candidates and
7,128,666 equal-shield matchup cells (0-0, 1-1 and 2-2), using battle-planner-v43.

## Correction

The original parallel run finalized weights independently within each candidate
chunk. Opponents outside that chunk received the default weight during the first
pass, and the merged first-pass scores supplied the competitive second pass.
Consequently, the ranking could depend on chunk boundaries.

Both ranking passes have now been recalculated over the full candidate pool using
the existing compatible cache. Each pass reported 7,128,666 preview cache hits,
zero base-season hits and zero misses. No new battle simulations were required.
The first global pass supplies the weights for the final competitive pass.

The parallel runner now uses four workers for matchup generation followed by
global cache-only ranking passes. A missing compatible cell fails explicitly.
Merge counters also sum completed, theoretical and base cells across chunks.

## Result

| Rank | Pokemon | Score |
| --- | --- | --- |
| 1 | Mimikyu | 705 |
| 2 | Tinkaton | 658 |
| 3 | Carbink | 622 |
| 4 | Regidrago | 610 |
| 5 | Corsola (Galarian) | 610 |
| 6 | Turtonator | 604 |
| 7 | Melmetal | 603 |
| 8 | Sableye (Shadow) | 603 |
| 9 | Araquanid | 600 |
| 10 | Pidgeot | 599 |

The final dataset quality report is VALID. Completed simulations and total cells
both report 7,128,666. Runtime checks require complete candidate coverage, unique
IDs, full-field finalization, zero cache misses and synchronized ranking details.
The season ranking identity and service-worker cache version were updated.

Validation passed: confirmed move data, Twilight Trails runtime, season context,
season loader, season generation, season promotion, season UI and PWA contracts.

These assets belong to the existing Twilight Trails season selection. Promoting
Twilight Trails to the default current season remains a separate change.
