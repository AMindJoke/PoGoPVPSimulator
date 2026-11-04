# November content update, 2026-11-04

## Scope

Scoped PvPoke snapshot: 2026-11-03 04:09:55. The exact source hash is stored
in data/content-update-20261104.js. Existing seasonal move overrides are preserved.

Released additions: Mega Chandelure, Shadow Zekrom, Shadow Pancham/Pangoro,
Shadow Fomantis/Lurantis, Shadow Wimpod/Golisopod, Shadow Sandygast/Palossand,
Minior, Arrokuda/Barraskewda, Maschiff/Mabosstiff and Brambleghast.
Mega Sableye gains Night Shade+; Mega Chandelure has Ominous Wind+.

Minior builds use Core stats for CP/level selection. Battles start in Meteor
Form at that same level, changing to Core strictly below half HP while alive.
HP, energy, IVs, level and stat stages are preserved. Internal Meteor Form is
not a separately selectable build. Continuations and switches do not reset it.

Kowtow Cleave (Kingambit) and Magnet Bomb (Magnezone and Shadow Magnezone)
are explicit selectable previews, labelled Upcoming/Preview. They are not
inserted into current ranking pools or silently promoted when the date passes.

## Ranking generation

- Engine: battle-planner-v52.
- Entries: 1558 (15 more ranked entries; Mega forms remain outside the standard ranking).
- Priority opponents: 43.
- Main simulations: 401964, plus complete Top 50 detail coverage.
- Previous Top 50 overlap: 50/50.
- Published locally from reports/meta-refresh-1vr6fQ; no Git push.
- Current release verification: all 1558 entries and 150 canonical score replays pass.

The dataset validator now reads the same content overlays as generation; unknown
Pokemon IDs are still rejected rather than bypassing validation for new species.

## Verification

Passed: november-content, announced-moves, special-form-mechanics, mega-battle,
strategic-continuations (all six scripts), battle-regressions (12/12),
meta-worker-parity (50 cases), continuation-isolation (16 cases),
type-effectiveness (3078 combinations and 144 damage replays),
pending-fast-mechanics, iv-stat-sensitivity, charged-move-collection,
variable-charged-move-ui, fast-threshold-panel, ranking-cache-refresh,
current-meta-release, PWA contract and site-updates.

Browser: completed Minior/Azumarill battle with the Meteor-to-Core transition;
confirmed Mega Chandelure's third charged attack and level scaling; selected
and simulated Kingambit's Kowtow Cleave preview. No browser console errors.

## Primary references

- https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json
- https://pokemongo.com/news/minior-meteor-showers-2026
- https://pokemongo.com/news/chandelure-super-mega-raid-day-2026
- https://pokemongo.com/news/halloween-part-2-2026
- https://pokemongo.com/news/communityday-november-2026-pawniard
- https://pokemongo.com/en/gowildarea/global
- https://pokemongo.com/news/harvest-festival-tgr-2026
- https://pokemongo.com/en/news/water-festival-2026
- https://pokemongo.com/pt-BR/news/mega-squads-2026

Sprite provenance: assets/pokemon/SOURCES.md.
