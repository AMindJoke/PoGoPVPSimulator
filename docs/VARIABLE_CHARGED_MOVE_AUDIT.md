# Variable Charged Attack architecture audit

Baseline: `74b499756a43930d92c7cac8ef6a3389807632f0` (`main`).

This inventory separates real two-Charged-Attack assumptions from unrelated uses of the number two (two battle sides, two comparison branches, two types, or two shields). The latter are intentionally out of scope.

## Already collection-based

- `src/battle/turn-resolution-engine.js` normalizes `chargedMoves[]`, emits one legal action per affordable move, and resolves an action by stable move ID.
- `src/battle/manual-action.js`, `src/battle/matchup-planner-adapter.js`, and almost all of `src/battle/battle-intelligence.js` search or iterate `chargedMoves[]`.
- legacy technical-review DRE eligibility already returns a collection of eligible Charged Attack IDs; new manual reconstructions use Timing Anomaly instead.
- Compendium Pokémon reference already renders every learnable Charged Attack from `chargedMoveIds[]`.
- canonical runtime snapshots store the combatant's full `charged[]` collection.

These paths need regression coverage, not a rewrite.

## Fixed two-slot assumptions that require migration

### Battle setup and application shell

- `PogoPvp.html` declares `p1Charged1/2` and `p2Charged1/2` as fixed controls.
- setup listeners, duplicate prevention, default moveset application, selection validation, battle creation, form transitions, fingerprints, Team Builder deep links, and reset/serialization control lists name those four IDs explicitly.
- automatic default selection deliberately chooses two moves with `.slice(0, 2)`; this remains the normal default but must not cap a form whose configured selected-move limit is higher.

### Manual Mode and Scenario Review

- `p1UseCharge1/2` and `p2UseCharge1/2` are static action buttons with static click handlers.
- HUD energy orbs use `combatant.charged.slice(0, 2)`.
- legality/visibility code owns fixed arrays of the four Charged buttons.
- `src/battle/manual-scenario-io.js` serializes participant moves from only `Charged1/2`; old scenario controls must remain readable while new documents preserve `chargedMoves[]`.
- old import/share fixtures contain `p1Charged1/2` and `p2Charged1/2` and therefore require a defensive normalization path.

### Team Builder

- `src/team-builder/team-builder-state.js` truncates `chargedMoveIds` to two.
- `src/team-builder/team-builder-battle-link.js` truncates shared battle links to two.
- the build editor owns exactly two selects and requires `charged.length === 2`.
- default candidate construction and matchup conversion use `.slice(0, 2)`.
- final-slot and replacement filters treat two selected moves as completion.

The standard non-Mega editing experience should still select two moves. A form capability must supply a higher selected-move limit; the state, links, analysis, and engine must preserve the resulting collection.

### Energy Trainer

- `src/battle/energy-trainer.js` truncates threshold and next-cycle rows to two. It should render the selected collection and let responsive layout handle the count.

### Matrix, rankings, and generated data

- `PogoPvp.html` and `tools/build-great-league-meta-database.js` pick two recommended Charged Attacks and clone two fixed entries into matrix combatants.
- cache signatures currently include the selected move data but have no season ID/data version.
- Mega forms are explicitly excluded from Great League ranking generation in `tools/build-great-league-meta-database.js`.
- the differential reference corpus intentionally creates two-move fixtures; it is a parity fixture rather than the canonical model, but should gain a separate N-move regression.

### Documentation and UI contracts

- `docs/CHARGED_MOVE_PLANNER.md` states that there are at most two candidates.
- `docs/MANUAL_MODE_ARCHITECTURE.md` documents fixed `UseCharge1/2` controls.
- Team Builder and Manual Mode UI contract tests assert fixed IDs and exactly two selected moves.

## Mega form representation

The canonical game master already contains distinct Mega form records with stable IDs such as `charizard_mega_x`, `charizard_mega_y`, and `abomasnow_mega`; each record owns stats, typing, move pools, and a structured `mega` tag. Fifty-five tagged Mega forms are currently present. The migration should use that structured identity and must not infer Mega status from display names.

The current ranking generator excludes Mega forms. No canonical repository source currently identifies which Mega forms receive an additional selected Charged Attack or which additional move is granted. That data must be supplied or sourced explicitly before production Mega-specific move access is enabled.

## Season and cache map

- runtime data is loaded directly from global `BATTLE_GAMEMASTER`, `DEFAULT_MOVESETS`, `GREAT_LEAGUE_RANKINGS`, and `GREAT_LEAGUE_RANKING_DETAILS`.
- the page has in-memory matrix/meta caches and IndexedDB matrix persistence; identities contain engine/data fingerprints but no season ID.
- Team Builder persists state and analysis in localStorage; scenario library/share documents do not currently carry season identity.
- generated rankings and matchup outputs have one unqualified current location.
- the service worker precaches the single current dataset and uses a deployment cache version.

A season context must resolve the active game master/defaults/generated-data handles before consumers initialize. Season ID and data version must join every derived-cache identity and season-dependent serialization. An empty/disabled preview must resolve exactly to Current Season and render no banner.

## Migration order

1. introduce and test a shared Charged Attack collection/capability normalizer;
2. remove truncation from state, links, engine adapters, Scenario IO, and Energy Trainer while preserving old fields on read;
3. render setup and Manual Mode controls from collections;
4. extend Team Builder editing and matchup generation;
5. add Mega capability data only from an explicit canonical source;
6. add season context, cache identity, serialization, validation, and promotion tooling;
7. add preview data/UI only after exact confirmed or user-supplied provisional values exist.
