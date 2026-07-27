# PvPoke parity: approved project adaptations

Reference PvPoke revision: `5e1e3d971369a47aaf3e7247f50710d80205d570`.

`PVPOKE_PARITY` follows PvPoke's strategic branch order. The following differences are limited to mechanics/state representation and do not authorize a different strategic heuristic.

| Adaptation | Reason | Principles | Test | Enabled in `PVPOKE_PARITY` |
|---|---|---|---|---|
| Apply guaranteed stat effects through the simulator's canonical target model (`self`, `opponent`, or both sides) | Explicit user decision: preserve the already verified project handling for self and opponent buff/debuff effects | EFFECT-031, CHANCE-032, TIE-036 | `test-battle-intelligence`, parity fixtures tagged `effects` | Yes |
| Resolve already registered Fast impacts, simultaneous faints, and CMP through Unified Turn Resolution | The simulator has a canonical event model; PvPoke represents the same facts through cooldown mutation and timeline actions | SURVIVAL-005, TACTICAL-006, TACTICAL-009, TIMING-015, TIMING-019, TIMING-020 | `test-timing-compatibility`, `test-principle-trace` | Yes |
| Re-plan after exactly one Fast Move when the PvPoke timing branch returns no Charged action | Keeps the PvPoke decision (`return`, therefore Fast) while making the runtime lifecycle explicit | TIMING-011 through TIMING-021 | `test-timing-compatibility`, first-decision parity corpus | Yes |
| Generic protection capability instead of a species-name check | The simulator models protection/form mechanics by capability so new equivalent forms do not require species patches | SPECIAL-010 | protection-form fixture | Yes |

Not approved for `PVPOKE_PARITY`:

- deeper minimax or selective deep search;
- probabilistic bait prediction in deterministic Matrix battles;
- scalar tactical/continuation bonuses;
- promoting a guaranteed-effect move outside PvPoke's route simulation and post-processing order;
- matchup-, species-, move-, IV-, or winner-specific patches;
- preserving a previous PoGoPVPSimulator winner when PvPoke selects another line.
