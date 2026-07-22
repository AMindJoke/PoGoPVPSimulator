# Battle State Stat Sensitivity Audit

## Scope

This audit verifies that Battle Intelligence, Matchup Planner, matrix simulations, Scenario Review, and offline ranking simulations distinguish complete current combatant states. Matchup fixtures remain tests only; no species-pair result is used by the planner.

Engine version after the fix: `battle-planner-v17`.

## Root Cause

Four generic state-identity defects were found.

1. `Battle Intelligence.strategicStateKey()` normalized `attack` and `defense` but omitted both values from its memoization key. Two states with equal species, moves, HP, energy, and shields could therefore share a fast-path decision despite different IV-derived combat stats.
2. Offline matchup cache signatures identified combatants by species and move IDs. They omitted level, IVs, derived stats, current resources, stages, move mechanics, and policy state.
3. The browser Meta cache used only species IDs and shields. The main matrix included raw IV inputs, but did not encode the fully derived combatant state or move mechanics.
4. The planner's `fastsBeforeFaint` diagnostic divided current HP by the opposing Fast Move's raw `power`. Raw move power is not battle damage and ignored Attack, Defense, STAB, effectiveness, Shadow modifiers, stages, and damage flooring.

An additional UI stale-state window existed: typing into an IV input marked the profile as custom, but rebuilt the combatant only on the later `change` event. IV `input` now rebuilds immediately.

## Canonical State Completeness

The strategic state now carries or derives all relevant fields:

- species and current form;
- level, CP, and IV triplet;
- derived Attack and Defense;
- max HP and current HP;
- current energy and shields;
- Attack and Defense stages;
- Fast and Charged Move mechanics, including type, power, energy, turns, buffs, target, and chance;
- ready turns and pending impacts;
- CMP and technical delay state;
- baiting, shield, line, and mechanic/form policies.

The Matchup Planner compact state already retained current Attack and Defense. It now also retains level, CP, and IV metadata, making its state hash inspectable and unambiguous. Presentation-only fields remain intentionally excluded.

When `?debugBattle=1` is active, each decision trace now records and logs the initial derived state for both combatants.

## Cache Audit

| Cache | Previous identity | Result |
| --- | --- | --- |
| Battle Intelligence fast path | Omitted Attack and Defense | Fixed with `strategic-state-v2`; includes derived stats, IV metadata, full move mechanics, resources, stages, timing, pending events, and policies |
| Matchup Planner transposition table | Canonical compact state, but without IV metadata | Fixed; exact derived stats were already present and level/CP/IVs are now explicit |
| Matchup Planner candidate cache | Same compact hash as planner | Fixed through compact-state update |
| Main matrix memory/IndexedDB | Raw selection fields | Fixed; signature is rebuilt from derived Attack, Defense, HP, level, CP, IVs, moves, energy, and policies |
| HP swing analysis | Main matrix key | Fixed transitively through the matrix signature |
| Browser Meta cache | Species IDs and shields | Fixed; uses full immutable combatant signatures and engine-version namespace |
| Offline ranking matchup files | Species and move IDs | Fixed; attacker and defender signatures now contain full combatant and move mechanics |
| Rank lookup cache | Species ID | Safe: stores the complete immutable 4096-spread ranking table for that species, not a battle result |
| Form catalog cache | Species/form family | Safe: stores immutable form data and moves, not combat state or outcomes |

Persisted matrix namespaces were advanced to `matrix-v15` and Meta to `meta-v6`, both namespaced by the battle engine version. Old incompatible entries are not reused.

## Damage Audit

All live battle damage and continuation damage use the canonical current-state formula already owned by `estimate()`:

`floor(power * effectiveAttack * 1.3 * 0.5 / effectiveDefense * STAB * effectiveness) + 1`

The planner survival diagnostic now calls this exact calculation against the runtime combatants. The removed raw-power estimate could misclassify reachable Charged Moves and actionable energy.

Remaining ratios in shield and candidate heuristics receive already-calculated canonical damage. They rank candidates or describe pressure; they do not replace terminal simulation. Offline raw-power move scoring is limited to choosing a fallback moveset when no recommended moveset exists and is not evidence for a battle outcome.

## Tinkaton vs Galarian Corsola, 0-0

Galarian Corsola uses default `4/15/14` IVs at level 47.5: 99.336 Attack, 163.077 Defense, 139 HP. Its Astonish deals the values shown below; Night Shade and Power Gem are evaluated canonically for every spread.

| Tinkaton spread | Level | CP | Attack | Defense | HP | Fairy Wind | Incoming Astonish | Gigaton / Bulldoze | Night Shade / Power Gem | Charged reached | CMP | Principal variation | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Rank 1 `0/10/14` | 26 | 1500 | 105.581 | 140.320 | 144 | 3 | 7 | 66 / 19 | 39 / 25 | 2 | Tinkaton | FW, Gigaton, FW, Gigaton | Win, 3 HP / 6 energy |
| High Attack `15/0/0` | 25 | 1492 | 113.549 | 130.915 | 132 | 3 | 8 | 71 / 21 | 42 / 27 | 1 | Tinkaton | FW, Gigaton, FW | Loss, Corsola 26 HP |
| Default `4/15/14` | 25 | 1497 | 106.202 | 140.934 | 141 | 3 | 7 | 67 / 20 | 39 / 25 | 1 | Tinkaton | FW, Gigaton, FW | Loss, Corsola 30 HP |
| Nearby `0/12/10` | 26 | 1492 | 105.581 | 141.682 | 141 | 3 | 7 | 66 / 19 | 39 / 25 | 1 | Tinkaton | FW, Gigaton, FW | Loss, Corsola 31 HP |
| Nearby `0/12/11` | 26 | 1497 | 105.581 | 141.682 | 142 | 3 | 7 | 66 / 19 | 39 / 25 | 2 | Tinkaton | FW, Gigaton, FW, Gigaton | Win, 1 HP / 6 energy |

Initial Fast-Move-only KO counts are 47 Fairy Winds into Corsola. Incoming Astonish requires 21 hits for all non-high-Attack entries and 17 against `15/0/0`. These counts are diagnostics, not substitutes for the mixed Fast/Charged principal variation.

The adjacent `0/12/10` and `0/12/11` fixtures are the decisive HP survival test. Attack, Defense, and per-move damage are identical. One additional max HP makes the second Gigaton Hammer reachable and flips the terminal line. The emitted comparison codes are `STAT_REACHES_EXTRA_CHARGED` and `STAT_TERMINAL_LINE_FLIPPED`.

## Additional IV Sensitivity Fixtures

- **Fast Move breakpoint:** Altaria Rank 1 Dragon Breath deals 2 to Rank 1 Lickilicky; `15/0/0` Altaria deals 3.
- **Incoming bulkpoint:** Rank 1 Altaria takes 5 from Rank 1 Lickilicky's Rollout; `15/0/0` Altaria takes 6.
- **CMP and head-to-head tradeoff:** `15/0/0` Swampert has 129.848 Attack and 131 HP; Rank 1 has 121.114 Attack and 139 HP. High Attack wins CMP and the 1-1 mirror, proving Rank 1 is not assumed to be the best head-to-head spread.
- **HP survival / extra Charged reachability:** Tinkaton `0/12/10` versus `0/12/11`, as documented above.
- **High Attack versus bulk:** the Altaria and Swampert fixtures explicitly verify that greater Attack can gain a breakpoint or CMP while losing incoming bulk and HP.

Diagnostic vocabulary is exposed through `src/reliability/stat-sensitivity-diagnostics.js`:

- `STAT_FAST_DAMAGE_BREAKPOINT`
- `STAT_FAST_DAMAGE_BULKPOINT`
- `STAT_SURVIVES_EXTRA_FAST`
- `STAT_REACHES_EXTRA_CHARGED`
- `STAT_CMP_CHANGED`
- `STAT_TERMINAL_LINE_FLIPPED`

## Matchup-Derived Assumption Audit

No production planner condition was found for Tinkaton, Galarian Corsola, or any other species pair. Named species IDs in the simulator source belong to the curated Great League Meta pool, not Battle Intelligence. Golden Corpus names and expected winners remain fixture assertions only.

No expected fixture was changed to match current output. No species-specific branch was introduced.

## Validation

Passing focused tests:

- `test-battle-intelligence.js`
- `test-matchup-planner.js`
- `test-matchup-planner-adapter.js`
- `test-turn-resolution-engine.js`
- `test-battle-reliability.js`
- `test-special-form-mechanics.js`
- `test-scenario-model.js`
- `test-iv-optimization.js`
- `test-iv-stat-sensitivity.js`

The IV suite verifies distinct strategic hashes, distinct offline cache signatures, exact breakpoint and bulkpoint changes, one-HP Charged reachability, CMP tradeoffs, state restoration, and deterministic repeated execution.

The current general battle regression suite reports 5/7. The two existing failures are `raikou-pachirisu-self-debuff-1s` (reason-code expectation only) and `dedenne-shadow-sableye-smart-shields-2s` (existing Smart-shield outcome). Re-running those cases with the old raw-power survival estimate produces the same failures and scores, so this task introduced no new failure. The broader Golden Corpus remains 22/30, with its previously tracked tactical weaknesses.

For the Tinkaton/Corsola fixture, Battle Intelligence reports 100% runtime ownership and zero legacy fallback. Ten isolated simulations measured 445.8 ms cold and 314.0 ms average warm in the local worker harness. Longer Golden Corpus timings reflect exhaustive tactical fixtures and are not the normal single-Battle UI path.

## Remaining Limitations

- The engine still contains bounded-search heuristics for ordering and depth limits. Terminal proof and actual transitions use exact current state, but a sufficiently deep tactical branch can remain outside the configured search budget.
- The full Golden Corpus has known tactical failures unrelated to stat identity. They should be addressed as planner strategy work, not by weakening state completeness.
- Existing persisted offline ranking files are stale under `battle-planner-v17` and must be regenerated before publishing refreshed rankings. They are rejected by version/signature checks in the meantime.
