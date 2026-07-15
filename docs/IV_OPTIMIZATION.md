# IV Optimization

PvPeak exposes three Great League IV optimization profiles. They all derive from the same 4096-spread candidate table used by the existing CP, level, stat, and stat-product rank UI.

## Profiles

- **Balanced**: highest stat product, then higher Defense, HP, Attack, lower level, and stable ascending IV order.
- **Attack**: highest final Attack, then stat product, Defense, HP, lower level, and stable ascending IV order.
- **Defense**: highest final Defense, then stat product, HP, Attack, lower level, and stable ascending IV order.

All comparisons use final calculated battle stats, not raw IV values. Candidate level and CP are produced by the existing `pokemonStatsAtLevel()` pipeline and must respect the current 1500 CP cap and supported level table.

## State

Selecting a profile applies its spread immediately. Editing Attack, Defense, or HP IV manually changes the profile state to `Custom` without replacing the entered values. Selecting a profile again reapplies its canonical spread.

Balanced replaces the former Rank 1 shortcut because both select the top stat-product spread. The stat-product rank remains visible for every profile, including Attack and Defense spreads that are not Rank 1. The separate Default IVs preset remains available and is treated as Custom.

## Cache

The existing per-species `rankCache` stores the ranked candidate table and all three profile results. Changing profiles therefore does not repeat the 4096-spread calculation. Forms and Shadow variants use their canonical species IDs as separate cache keys.

## Current Scope

The app currently exposes Great League at a fixed 1500 CP cap. The optimizer uses the existing level table through level 51; it does not add a separate level-cap or Best Buddy subsystem.
