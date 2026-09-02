# Twilight Trails Preview Data

Canonical announcement: <https://pokemongo.com/news/go-battle-league-twilight-trails>

The draft is stored only in `data/seasons/next-season.js` and remains disabled. It currently contains all explicit Trainer Battle power changes, Bulldoze's guaranteed Defense drop, Draining Kiss's guaranteed self-Defense increase, and all announced Attack availability updates. Availability is also applied to the corresponding canonical Shadow and Mega forms where that same announced form exists.

## Values awaiting a provisional decision

| Move | Field | Current | Announcement |
| --- | --- | ---: | --- |
| Air Cutter | Energy cost | 35 | Increased |
| Air Cutter | Self Attack boost chance | 30% | Decreased |
| Bulldoze | Energy cost | 45 | Increased |
| Body Slam | Energy cost | 35 | Increased |
| Sand Tomb | Energy cost | 40 | Increased |
| Brine | Energy cost | 50 | Increased |
| Bubble Beam | Energy cost | 40 | Increased |
| Mirror Coat | Energy cost | 55 | Decreased |
| High Horsepower | Energy cost | 60 | Decreased |
| Blaze Kick | Energy cost | 40 | Decreased |
| Bite | Energy generation | 2 | Increased |
| Take Down | Energy generation | 8 | Increased |
| Scratch | Energy generation | 2 | Increased |
| Moonblast | Energy cost | 60 | Decreased |
| Dark Pulse | Energy cost | 50 | Decreased |
| Rage Fist | Energy cost | 35 | Increased |
| Magnet Bomb | Energy cost | 45 | Decreased |
| Shadow Force | Energy cost | 90 | Decreased |

These fields must not be guessed. Once supplied, they should be added as `estimated` field values, the pending list emptied, and preview-derived rankings regenerated before `enabled` is set to true.
