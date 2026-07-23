# Principle Planner Rebuild Baseline

Baseline date: 2026-07-23

## Safety snapshot

- working branch: `perf-debug-work`
- baseline commit: `8e8f2b0efaa04c17847763f0478b54bb6c8571cc`
- backup branch: `hybrid-before-principle-planner-rebuild`
- generated baseline data: `data/baselines/principle-planner-baseline-8e8f2b0.json`
- generator: `tools/record-principle-planner-baseline.js`

This baseline was recorded before the principle registry was allowed to change
strategic behavior. It captures the current hybrid planner as the preserved
comparison point for the principle-based rebuild.

## Frozen behavior families

The following existing suites must remain protected during the rebuild:

- `tools/test-hybrid-battle-intelligence.js`
- `tools/test-battle-intelligence.js`
- `tools/test-turn-resolution-engine.js`
- `tools/test-timing-compatibility.js`
- `tools/test-matchup-planner-fixture.js`
- `tools/test-quagsire-corsola-mechanics-ledger.js`
- `tools/test-quagsire-corsola-default-pvpoke.js`
- `tools/test-scenario-model.js`
- `tools/test-battle-review.js`
- `tools/run-battle-regressions.js`
- `data/golden-corpus/great-league.json`
- `data/battle-regressions/iv-sensitivity.json`

## Before-change matchup summary

| Fixture | Winner | Score | Runtime ms | Planner calls | Continuation calls | Charged timeline |
|---|---:|---:|---:|---:|---:|---|
| `shadow-quagsire-galarian-corsola-default-0s` | B | 359 | 313 | 9 | 6 | A8 Aqua Tail, A17 Aqua Tail, B21 Night Shade, A26 Aqua Tail, B27 Night Shade |
| `shadow-quagsire-galarian-corsola-rank1-0s` | B | 346 | 232 | 8 | 4 | A8 Aqua Tail, B18 Night Shade, A21 Aqua Tail, A26 Aqua Tail, B27 Night Shade |
| `shadow-quagsire-galarian-corsola-default-2s` | A | 556 | 833 | 20 | 14 | A8 Aqua Tail, A17 Aqua Tail, B21 Night Shade, B31 Night Shade, A34 Aqua Tail, A37 Aqua Tail, A44 Aqua Tail |
| `kingdra-carbink-default-1s` | A | 572 | 803 | 12 | 8 | A13 Surf, B18 Rock Slide, A24 Surf, A36 Surf |
| `azumarill-skarmory-default-1s` | A | 612 | 592 | 11 | 5 | A15 Ice Beam, A31 Ice Beam, B32 Brave Bird, B45 Brave Bird, A45 Ice Beam |
| `lanturn-talonflame-default-1s` | A | 689 | 244 | 4 | 2 | A20 Surf, A31 Surf |
| `medicham-bastiodon-default-1s` | A | 787 | 583 | 11 | 8 | A14 Dynamic Punch, A23 Dynamic Punch, B27 Flamethrower, A32 Dynamic Punch |
| `sableye-shadow-victreebel-default-0s` | A | 732 | 22 | 2 | 0 | B10 Leaf Blade, A10 Foul Play |
| `registeel-whiscash-default-2s` | B | 194 | 793 | 15 | 7 | B10 Mud Bomb, A14 Flash Cannon, B21 Mud Bomb, A29 Flash Cannon, B32 Mud Bomb, A41 Flash Cannon, B42 Mud Bomb |
| `froslass-altaria-default-1s` | A | 666 | 124 | 7 | 3 | A12 Avalanche, B14 Sky Attack, A25 Avalanche |
| `charjabug-annihilape-default-1s` | B | 404 | 216 | 10 | 5 | B11 Rage Fist, A12 Discharge, B20 Rage Fist, A21 Discharge, B30 Rage Fist |
| `lickitung-clodsire-default-1s` | B | 372 | 1146 | 16 | 13 | A13 Body Slam, B16 Earthquake, A26 Body Slam, B31 Earthquake, A37 Body Slam, B46 Earthquake |
| `mandibuzz-dewgong-default-1s` | B | 260 | 756 | 16 | 12 | A12 Shadow Ball, B16 Icy Wind, A23 Shadow Ball, B27 Icy Wind, A34 Shadow Ball, B38 Drill Run |

## Known baseline issue

The `shadow-quagsire-galarian-corsola-default-0s` baseline can still produce
the losing triple Aqua Tail line in a single sampled run. This document records
that behavior as pre-rebuild evidence; it is not fixed here because Phase 0 and
Phase 1 are registry and evidence work only.

Future fixes must identify the responsible principle or canonical mechanics
defect instead of patching the matchup directly.
