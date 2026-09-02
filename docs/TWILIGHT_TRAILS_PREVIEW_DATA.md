# Twilight Trails Preview Data

Canonical announcement: <https://pokemongo.com/news/go-battle-league-twilight-trails>

The draft is stored only in `data/seasons/next-season.js` and remains disabled until its derived rankings are generated. It contains all explicit Trainer Battle power changes, Bulldoze's guaranteed Defense drop, Draining Kiss's guaranteed self-Defense increase, all announced Attack availability updates, and the provisional values supplied for fields the announcement leaves unspecified. Availability is also applied to the corresponding canonical Shadow and Mega forms where that same announced form exists.

## Provisional values

| Move | Field | Current | Provisional |
| --- | --- | ---: | ---: |
| Air Cutter | Energy cost | 35 | 40 |
| Air Cutter | Self Attack boost chance | 30% | 10% |
| Bulldoze | Energy cost | 45 | 50 |
| Body Slam | Energy cost | 35 | 40 |
| Sand Tomb | Energy cost | 40 | 45 |
| Brine | Energy cost | 50 | 60 |
| Bubble Beam | Energy cost | 40 | 45 |
| Mirror Coat | Energy cost | 55 | 45 |
| High Horsepower | Energy cost | 60 | 55 |
| Blaze Kick | Energy cost | 40 | 35 |
| Bite | Energy generation | 2 | 4 |
| Take Down | Energy generation | 8 | 9 |
| Scratch | Energy generation | 2 | 4 |
| Moonblast | Energy cost | 60 | 50 |
| Dark Pulse | Energy cost | 50 | 45 |
| Rage Fist | Energy cost | 35 | 40 |
| Magnet Bomb | Energy cost | 45 | 40 |
| Shadow Force | Energy cost | 90 | 80 |

These fields are marked `estimated` in runtime metadata and must be replaced with confirmed values after the live Game Master update. The pending list is now empty; preview-derived rankings must still be regenerated before `enabled` is set to true.
