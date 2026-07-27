# PvPoke principle parity audit

Audited against PvPoke revision `5e1e3d971369a47aaf3e7247f50710d80205d570` (master on 2026-07-27).

Primary source:

- `src/js/battle/actions/ActionLogic.js`
- `src/js/battle/Battle.js`
- `src/js/battle/DamageCalculator.js`

The source range is pinned to the revision above. “Adapted” means only a documented entry in `PVPOKE_PARITY_ADAPTATIONS.md`; it does not mean an inherited simulator heuristic.

| Principle | PvPoke source | PvPoke behavior | Project behavior | Status |
|---|---|---|---|---|
| AVAIL-001 | ActionLogic L15-L18 | Return no Charged action when no active Charged exists | Same early return to Fast | EXACT_PARITY |
| AVAIL-002 | ActionLogic L20-L23 | Return Fast below the cheapest active Charged cost | Same early return; project uses normalized `energyCost` | EXACT_PARITY |
| POLICY-003 | ActionLogic L20-L23 | `farmEnergy` forces Fast even when Charged is ready | Same early return | EXACT_PARITY |
| ROUTE-004 | ActionLogic L25-L36, L448-L459 | Readiness is ceil(missing energy / Fast gain) × Fast turns | Same formula, with queued canonical energy represented explicitly | INTENTIONAL_ADAPTATION |
| SURVIVAL-005 | ActionLogic L38-L137 | Bounded opponent-energy/HP/shield queue computes `turnsToLive` | PvPoke queue port uses canonical pending impacts as initial state | INTENTIONAL_ADAPTATION |
| TACTICAL-006 | ActionLogic L142-L200 | If another Fast cannot be survived, throw the highest available damage; two cheap copies may win the comparison | Same early-return branch and move ordering | EXACT_PARITY |
| ROUTE-007 | ActionLogic L173-L185 | In forced-throw branch, two available copies may outrank one nuke when actor wins CMP | Same local branch only; not a global DPE bonus | EXACT_PARITY |
| TACTICAL-008 | ActionLogic L211-L230 | With shields down, throw an affordable non-self-debuff lethal unless Fast already KOs; respect bait ordering | Same branch and ordering | EXACT_PARITY |
| TACTICAL-009 | ActionLogic L211-L230 plus Battle L467-L487 | Do not spend a Charged when an already registered Fast impact KOs | Canonical pending-event check | INTENTIONAL_ADAPTATION |
| SPECIAL-010 | ActionLogic L236-L247 | Break protect form with the fastest non-self-debuff Charged | Generic capability-equivalent branch | INTENTIONAL_ADAPTATION |
| TIMING-011 | ActionLogic L255-L359 | Return Fast when the current Charged timing is poor and every safety gate passes | Same branch before long-match/DP | EXACT_PARITY |
| TIMING-012 | ActionLogic L257-L269 | Base target 1 turn; selected duration pairs target 2 turns | Same duration table | EXACT_PARITY |
| TIMING-013 | ActionLogic L271-L273 | Disable for equal Fast durations | Same gate | EXACT_PARITY |
| TIMING-014 | ActionLogic L275-L278 | Disable when own longer duration is an exact multiple | Same gate | EXACT_PARITY |
| TIMING-015 | ActionLogic L284-L287 | Do not wait if the next opposing Fast is lethal | Same check using canonical damage/pending state | INTENTIONAL_ADAPTATION |
| TIMING-016 | ActionLogic L289-L303 | Include queued own Fast actions; do not exceed 100 energy | Same deterministic check | EXACT_PARITY |
| TIMING-017 | ActionLogic L305-L313 | Do not wait when planned Charged actions exceed the survival horizon; add CMP-loss turn | Same calculation | EXACT_PARITY |
| TIMING-018 | ActionLogic L317-L326 | Do not wait when an affordable unshielded Charged already KOs | Same gate | EXACT_PARITY |
| TIMING-019 | ActionLogic L329-L348 | Do not wait when the opponent reaches lethal Charged plus fitted Fast damage | Same calculation with normalized move fields | EXACT_PARITY |
| TIMING-020 | ActionLogic L350-L355 | Do not wait when fitted opposing Fast damage KOs | Same floor formula | EXACT_PARITY |
| TIMING-021 | ActionLogic L357-L359 | A safe timing wait is one Fast, then normal AI re-evaluation | Same explicit one-Fast lifecycle | INTENTIONAL_ADAPTATION |
| PERF-022 | ActionLogic L365-L376 | Detect a long matchup by opponent HP / best cycle damage and a threshold of 2 or 1.1 | Same shortcut and threshold | EXACT_PARITY |
| LONG-023 | ActionLogic L365-L412 | Start from `bestChargedMove`, then apply bait/non-debuff overrides | Same branch before compact DP | EXACT_PARITY |
| BAIT-024 | ActionLogic L381-L385 | In long matches, use cheap move only if baiting is enabled and `wouldShield(nuke)` | Same deterministic predicate | EXACT_PARITY |
| MOVE-025 | ActionLogic L387-L393 | Replace a self-debuff best move with a non-debuff move when the DPE ratio is below 2 | Same loop/order | EXACT_PARITY |
| ROUTE-026 | ActionLogic L395-L409, L960-L967 | Return Fast until the selected move is affordable | Same action result | EXACT_PARITY |
| EFFECT-027 | ActionLogic L400-L405, L638-L680, L734-L775, L937-L951 | Bank energy/insert stacked self-attack-debuff routes under PvPoke's exact limits | Same conditions and energy target | EXACT_PARITY |
| COMPACT-028 | ActionLogic L414-L801 | Bounded offensive BattleState queue finds fastest effective KO route | Same state shape and terminal handling | EXACT_PARITY |
| SEARCH-029 | ActionLogic L422-L435 | Abort compact search at 500 processed states | Same cap; unsupported result is explicit | EXACT_PARITY |
| COMPACT-030 | ActionLogic L488-L507, L598-L631, L693-L728 | Insert candidate states in ascending turn order | Same ordered insertion | EXACT_PARITY |
| EFFECT-031 | ActionLogic L463-L538 | Apply guaranteed attack or opponent-defense effects to the DP attack stage | Canonical target model also supports verified self/opponent defense/attack effects | INTENTIONAL_ADAPTATION |
| CHANCE-032 | ActionLogic L515-L540 | Compute structural chance fields but force `changeTTKChance = 0` in ordinary DP | Same deterministic no-proc branching | EXACT_PARITY |
| FARM-033 | ActionLogic L488-L507 | Insert a farm-down terminal from every meaningful DP state | Same ceil(Fast count), energy and turn calculation | EXACT_PARITY |
| SHIELD-034 | ActionLogic L542-L556, L683-L692 | Shielded Charged deals 1 and consumes one opponent shield in DP | Same route mutation | EXACT_PARITY |
| SEARCH-035 | ActionLogic L558-L632, L694-L729 | Reject dominated same-turn HP/energy/buff/shield states | Same comparisons and queue scope | EXACT_PARITY |
| TIE-036 | ActionLogic L563-L595 | For equivalent state, prefer fewer self-debuffs and more guaranteed self buffs | Same move-history tie-break | EXACT_PARITY |
| BAIT-037 | ActionLogic L839-L855 | Build to the represented expensive move before throwing the planned cheap move, with self-buff exception | Same branch after DP route selection | EXACT_PARITY |
| BAIT-038 | ActionLogic L857-L864 | If represented nuke would not be shielded and is sufficiently more efficient, use it instead of bait | Same `wouldShield` call and DPE ratio | EXACT_PARITY |
| BAIT-039 | ActionLogic L905-L912 | Do not bait with a self-debuff move when the stronger move is non-debuffing | Same post-processing override | EXACT_PARITY |
| MOVE-040 | ActionLogic L866-L878 | Without bait constraints, order route moves by immediate damage | Same post-processing sort | EXACT_PARITY |
| MOVE-041 | ActionLogic L880-L884, L890-L903, L914-L927 | With shields, permit cheaper efficient non-debuffing alternatives and PvPoke's close-energy bandaids | Same ordered overrides, explicitly classified as historical PvPoke bandaids | EXACT_PARITY |
| EFFECT-042 | ActionLogic L885-L903, L929-L951 | Avoid healthy nonlethal self-debuff nuke, defer through survivable Charged, and stack when safe | Same ordered gates | EXACT_PARITY |
| SHIELD-043 | ActionLogic L1116-L1200; Battle L1081-L1169 | `wouldShield`: current damage, future cycle damage, Fast DPT, future Charged pressure, self-attack-debuff nuke, always-bait override | Same deterministic value path; randomized weights are retained only as trace evidence | EXACT_PARITY |

## Execution priority

`PVPOKE_PARITY` preserves the source order:

1. availability and explicit farm;
2. readiness and survival;
3. forced throw;
4. immediate lethal;
5. protection breaker;
6. timing;
7. long-match shortcut;
8. compact DP including farm-down/effects/shields;
9. final route selection;
10. bait/move/effect post-processing;
11. build energy or throw;
12. re-plan after resolution.

## Unsupported and deliberately disabled behavior

- PvPoke's species-specific Melmetal/Cresselia bandaid (ActionLogic L477-L484) is classified `DISABLED`: the project acceptance criteria prohibit species-specific rules.
- PvPoke randomized action selection is outside deterministic `PVPOKE_PARITY`.
- Non-guaranteed effect DP branching is `DISABLED`, matching PvPoke's explicit `changeTTKChance = 0`.
- Any state missing damage/readiness inputs returns an explicit unsupported parity result; it is never delegated to a hybrid planner.
