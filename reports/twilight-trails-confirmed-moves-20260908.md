# Twilight Trails confirmed move update

Source: values supplied by the user on 2026-09-08. Psycho Boost appeared twice;
the 27 distinct moves are preserved in
`data/seasons/twilight-trails/confirmed-moves-20260908.json`.
Charged energy costs are stored as positive numbers, as required by the engine.

Differences from the previous Twilight Trails draft:

| Move | Field | Draft | Confirmed |
| --- | --- | ---: | ---: |
| Shadow Force | Energy cost | 80 | 65 |
| Bulldoze | Energy cost | 50 | 55 |
| Bubble Beam | Energy cost | 45 | 50 |
| Air Cutter | Self Attack boost chance | 10% | 12.5% |

All other supplied numeric values match the draft. Air Cutter's self Attack
increase is explicit; Bulldoze's guaranteed target Defense drop and Draining
Kiss's guaranteed self Defense increase are preserved. Unspecified durations,
costs and effects remain unchanged. All 27 overrides are now confirmed and the
season data version is `twilight-trails-confirmed-1`.

The four corrected moves are available to 145 distinct forms in the resolved
catalog (including forms outside the active Great League ranking). Counts by
move: Air Cutter 35, Bulldoze 60, Bubble Beam 50, Shadow Force 3. These are move
availability counts, not a claim that every form currently selects the move.

Before promotion, regenerate the Twilight Trails matchup data, moveset choices,
rankings and ranking details. Both sides of each affected matchup must be
considered; changed opponents can affect other Pokemon's ranking scores too.
The planner has also changed since the old generated assets. Reuse must require
matching engine, data and moveset signatures.

The existing generated ranking assets still identify themselves as
`twilight-trails-draft-2`; they have not been relabeled as confirmed or regenerated.
The season remains selectable as Twilight Trails preview. The current season
and its canonical Game Master have not been promoted by this data-only update.

Verification: confirmed values for all 27 moves, preservation of unspecified
effects/durations, season runtime/context, promotion validation, generation,
loader, season UI and PWA tests passed. Promotion data validation has no errors;
that check alone does not prove the derived ranking assets are up to date.
