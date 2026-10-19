# PvPoke parity: approved project adaptations

Reference PvPoke revision: `5e1e3d971369a47aaf3e7247f50710d80205d570`.

The canonical planner follows PvPoke's strategic branch order with the documented project adaptations below. Strategy changes are tested against the pinned reference and the production engine.

| Adaptation | Reason | Principles | Test | Enabled in `PVPOKE_PARITY` |
|---|---|---|---|---|
| Apply guaranteed stat effects through the simulator's canonical target model (`self`, `opponent`, or both sides) | Explicit user decision: preserve the already verified project handling for self and opponent buff/debuff effects | EFFECT-031, CHANCE-032, TIE-036 | `test-battle-intelligence`, parity fixtures tagged `effects` | Yes |
| Resolve already registered Fast impacts, simultaneous faints, and CMP through Unified Turn Resolution | The simulator has a canonical event model; PvPoke represents the same facts through cooldown mutation and timeline actions | SURVIVAL-005, TACTICAL-006, TACTICAL-009, TIMING-015, TIMING-019, TIMING-020 | `test-timing-compatibility`, `test-principle-trace` | Yes |
| Re-plan after exactly one Fast Move when the PvPoke timing branch returns no Charged action | Keeps the PvPoke decision (`return`, therefore Fast) while making the runtime lifecycle explicit | TIMING-011 through TIMING-021 | `test-timing-compatibility`, first-decision parity corpus | Yes |
| Generic protection capability instead of a species-name check | The simulator models protection/form mechanics by capability so new equivalent forms do not require species patches | SPECIAL-010 | protection-form fixture | Yes |
| Verify reordered effect-bearing Charged openers using two canonical continuations | The 2026-10-15 strategy review found that immediate-damage overrides could discard winning move orders; user requested improvements beyond the reference heuristics | MOVE-040 | `tools/test-strategic-move-order.js`, `tools/audit-strategic-move-order.js` | Yes, when the runtime continuation callback is available |
| Compare matching plausible opponent response scenarios | At most one other legal root Charged reply, plus shield/no-shield only for Smart Shield. Prefer configured-policy outcome; among already projected wins permit strict response-wise dominance. Losing/drawing ties never change solely for an off-policy advantage | MOVE-040, TIMING-011 | `tools/test-strategic-response-selection.js`, `tools/test-strategic-timing-responses.js` | Yes, with runtime callback; at most 12 rollouts per actor per round and no recursive strategic search |
| Verify guaranteed self-buff timing around long Fast Moves | Compare the current action, throw now or one additional Fast, and an already legal one-turn wait. Initially limited to affordable beneficial guaranteed self-buffs with Fast duration at least 3; no form transitions, tactical/availability/farm overrides, overflow or pending lethal Fast | TIMING-011, TIMING-021 | `tools/test-strategic-timing-responses.js`, `tools/audit-strategic-move-order.js` | Yes, when the runtime continuation callback is available |
| Preserve configured Smart Shield decisions in strategic forecasts | Independent shield and strategy recursion guards let a canonical strategic forecast use the normal Smart Shield decision. Shield leaf forecasts remain non-recursive; frozen root actions, options and timing callbacks preserve CMP and pending impacts | SHIELD-043 | `tools/test-strategy-shield-policy-parity.js`, `tools/test-configured-policy-line.js` | Yes; at most 16 shield leaf rollouts per strategic continuation, reserved in pairs; exhaustion makes the strategic forecast incomplete |

Response scenarios are not a full minimax tree: the alternate Charged reply is sampled at the root, while shield/no-shield applies to the actor's first future Charged Move. Their cross-product and subsequent opponent timing deviations are not searched. Future strategic refinement remains disabled in forecasts; exact execution parity requires the same subsequent action policy. Smart Shield refinement is now active in canonical strategic forecasts, but not recursively inside shield leaf forecasts. See `reports/strategy-shield-policy-20261018.md`.

Not approved for `PVPOKE_PARITY`:

- unbounded minimax or recursive strategic continuation search;
- probabilistic bait prediction in deterministic Matrix battles;
- scalar tactical/continuation bonuses;
- promoting a guaranteed-effect move outside PvPoke's route simulation and post-processing order;
- matchup-, species-, move-, IV-, or winner-specific patches;
- preserving a previous PoGoPVPSimulator winner when PvPoke selects another line.
