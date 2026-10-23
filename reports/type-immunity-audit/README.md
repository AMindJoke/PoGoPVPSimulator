# Type Immunity Audit, 2026-10-23

## Scope and Findings

Compared all 18 attacking types against every single defensive type and every
unordered pair of distinct defensive types: 3,078 combinations. The independent
defensive chart is the existing PvPoke state translator, cross-checked against
PvPoke's DamageCalculator.js.

Before correction there were 18 mismatches, all Dragon attacks into a Fairy
defender, alone or paired with one of the other 17 types. These are manifestations
of one missing double resistance, not 18 separate defects.

| Attack | Defensive immunity | Correct multiplier | Previous result |
|---|---|---:|---|
| Dragon | Fairy | 0.390625 | Incorrect: 0.625 |
| Electric | Ground | 0.390625 | Already correct |
| Fighting | Ghost | 0.390625 | Already correct |
| Ghost | Normal | 0.390625 | Already correct |
| Ground | Flying | 0.390625 | Already correct |
| Normal | Ghost | 0.390625 | Already correct |
| Poison | Steel | 0.390625 | Already correct |
| Psychic | Dark | 0.390625 | Already correct |

The seven correct cases previously applied two 0.625 reductions because both
the ordinary resistance and immunity tables contained them. Dragon/Fairy did
not have that overlap. The corrected function explicitly selects immunity,
then ordinary resistance, then weakness for each defending type. Modifiers
from the two different defending types still multiply normally.

Examples: Dragon into Fairy/Steel is now 0.244140625, while Dragon into
Fairy/Dragon is 0.625. A normal resistance or a weakness is not changed.

## Damage Verification

Rank 1 Altaria: 0/14/15, level 29, Attack 101.43527169.
Rank 1 Azumarill: 0/15/15, level 45.5, Defense 136.5732513.

Dragon Breath's pre-floor amount changes from 1.08622357185 to 0.67888973241.
The final damage therefore changes from 2 to 1, using floor(amount) + 1.

`tools/test-type-effectiveness.js` also checks actual worker timeline damage
for each of the eight immunities with every possible second type (144 replays),
plus the reported unmodified Rank 1 Altaria/Azumarill battle. All pass.

The live page and matrix worker share this function. Fast and Charged damage,
threshold estimates and simulated decisions therefore receive the same fix.
Engine version v51 invalidates persisted v50 matchup results.

The IV sensitivity test's independent damage helper had copied the old formula;
it was corrected too. A Florges/Kingdra two-shield strategy assertion was updated
to the verified new winning sequence: one shielded Chilling Water followed by
two Moonblasts. No strategy algorithm was changed in this correction.

## Reproduction

The local ranking bundle was regenerated with v51: 398,094 category simulations
for 1,543 entries against the same 43-opponent field. Complete Top 50 key matchup
details were rebuilt. All entry checks and 149 independent canonical saved-score
replays pass. Game Master and moveset hashes are unchanged from v50.

Selected raw dataset ranks: Altaria 9 -> 26, Kingdra 39 -> 65, Azumarill 68 -> 60,
Florges 25 -> 21. The Top 50 retains 48 of its previous entries. These are
consequences of recalculation, not manual adjustments to ranking positions.

Full per-entry rank/score changes are in `ranking-impact.json`. Generation and
audit commands do not automatically push Git changes.

```text
node tools/test-type-effectiveness.js
```

`before.json` preserves the original mismatches; `after.json` records zero.
Reference: https://github.com/pvpoke/pvpoke/blob/master/src/js/battle/DamageCalculator.js
