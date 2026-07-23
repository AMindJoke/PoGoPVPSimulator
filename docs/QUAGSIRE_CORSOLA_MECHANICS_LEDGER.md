# Shadow Quagsire vs Galarian Corsola Mechanics Ledger

## Frozen inputs

The fixture uses Great League rank-1 stat-product builds, zero shields, zero
starting energy, and deterministic no-proc mechanics.

| Side | Build | Combat stats | Moves |
| --- | --- | --- | --- |
| A | Shadow Quagsire, L29, 0/15/14 | 165 HP, 109.3487 Atk, 113.6651 Def | Mud Shot, Aqua Tail, Mud Bomb |
| B | Galarian Corsola, L50.5, 0/13/15 | 143 HP, 97.7653 Atk, 164.3468 Def | Astonish, Night Shade, Power Gem |

Local CP labels are 1497 and 1498. PvPoke 1.37.3.27 displays 1499 and 1500 for
the same level, IVs, rounded Attack/Defense, and HP. The combat stats and
per-move damage match, so the CP-label difference does not explain the result.

Reference:
[`0-0 rank-1 PvPoke battle`](https://pvpoke.com/battle/1500/quagsire_shadow-29-0-15-14-4-4-1-1/corsola_galarian-50.5-0-13-15-4-4-1-1/00/0-2-6/0-1-2/)

## Forced lines

The diagnostic plan selects no moves strategically. It either consumes a
specified Charged sequence at the first legal window or registers an exact
turn/move schedule. Both sides otherwise use Fast Moves.

| Line | Quagsire schedule | Corsola schedule | Result |
| --- | --- | --- | --- |
| A | earliest Aqua Tail → Aqua Tail → Aqua Tail, T8/T16/T25 | earliest Night Shade, T15/T26 | Corsola wins with 14 HP |
| B | request earliest Aqua Tail → Aqua Tail → Mud Bomb | earliest Night Shade, T15/T26 | Mud Bomb never becomes legal before Quagsire faints; Corsola has 47 HP |
| C | PvPoke schedule: Aqua Tail T8/T17, Mud Bomb T28 | Night Shade T21/T28 | Corsola wins with 6 HP |

PvPoke displays turns one-based: A at 9/18/29 and B at 22/29. The local
timeline is zero-based. PvPoke reports the same Line C totals: Quagsire deals
137 (26 Fast + 111 Charged), Corsola deals 204 (90 Fast + 114 Charged), and
Quagsire has 2 energy left after spending 115.

## Decisive Line C ledger

The executable test emits every Fast and Charged row with
`npm run test:quagsire-corsola-ledger -- --json`. The decisive state
transitions are:

| T | Actor | Registered/resolved action | Damage | Energy | Target HP | Next ready |
| ---: | --- | --- | ---: | ---: | ---: | ---: |
| 8 | A | Aqua Tail | 35 | 36 → 1 | B 135 → 100 | 9 |
| 17 | A | Aqua Tail | 35 | 37 → 2 | B 92 → 57 | 18 |
| 18 | B | Astonish | 10 | 60 → 70 | A 105 → 95 | 21 |
| 21 | B | Night Shade | 57 | 70 → 25 | A 95 → 38 | 22 |
| 22 | A | Mud Shot | 2 | 20 → 29 | B 57 → 55 | 24 |
| 22 | B | Astonish | 10 | 25 → 35 | A 38 → 28 | 25 |
| 24 | A | Mud Shot | 2 | 29 → 38 | B 55 → 53 | 26 |
| 25 | B | Astonish | 10 | 35 → 45 | A 28 → 18 | 28 |
| 26 | A | Mud Shot | 2 | 38 → 47 | B 53 → 51 | 28 |
| 28 | A | Mud Bomb (CMP first) | 41 | 47 → 2 | B 47 → 6 | 29 |
| 28 | B | Night Shade | 57 | 45 → 0 | A 18 → 0 | 29 |

The full output also contains action registration, canonical Fast impact,
queue ID, resolved-action ID, HP before/after, and energy before/after for every
row in all three lines.

## Proven answers

1. **Is Aqua Tail → Aqua Tail → Mud Bomb legal?** Yes on the delayed PvPoke
   schedule T8/T17/T28. It is not executable as an earliest-throw sequence:
   Quagsire has only 38 energy at T25 and is defeated at T26.
2. **When is each move affordable?** In Line C, Aqua Tail is registered with
   36 energy at T8 and 37 at T17; Mud Bomb is registered with 47 at T28.
3. **Does Mud Bomb resolve?** Yes. Quagsire wins CMP and deals 41, leaving
   Corsola at 6 HP.
4. **Which Night Shade creates the divergence?** The second, registered at T28.
5. **Which Fast supplied its energy?** Corsola's T25 Astonish takes it from 35
   to 45 energy; its canonical impact boundary is T27.
6. **Was Charged incorrectly allowed after lethal Fast damage?** No. Mud Bomb
   is nonlethal and resolves first. Corsola is alive at 6 HP when Night Shade
   resolves.
7. **Was input incorrectly delayed?** Not in Line C; every exact forced action
   appears in the resolved timeline with the requested move and turn.
8. **Do stats explain the difference?** Damage matches PvPoke. Two Aqua Tails,
   one Mud Bomb, and thirteen Mud Shots total 137, exactly 6 short of Corsola's
   143 HP.
9. **Is the claimed 0-0 win valid under identical current inputs?** No. Both
   simulators produce the same loss and the same 6 HP Corsola remainder.

## Separate canonical integration defect

The normal runtime currently applies Fast damage and energy inside `useFast()`
at Fast start, while the timeline labels the canonical impact as
`start + duration - 1`. In Line C the T25 Astonish energy is needed only at T28,
after its T27 impact, so correcting this defect does not flip the matchup. It
remains a class-A mechanics integration issue and must be migrated through the
timing compatibility fixtures rather than patched in this matchup.
