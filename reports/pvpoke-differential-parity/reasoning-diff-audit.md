# PvPoke Differential Reasoning Audit

- Mismatches analyzed: 93
- Reference: actual pinned PvPoke runtime.
- Scope: first strategic decision only.

## Difference types

- 39 x Same DP area, different route ordering/tie-break/post-processing.
- 20 x Same action family, different charged-move ordering criteria.
- 18 x PvPoke builds/farms/waits; simulator spends energy immediately.
- 16 x PvPoke throws now; simulator delays/builds/farms.

## Path pairs

- 38 x PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE
- 10 x PVPOKE_UNKNOWN_BRANCH vs SIM_COMPACT_DP_ROUTE
- 8 x PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_COMPACT_DP_ROUTE
- 7 x PVPOKE_DP_ORDERED_SEQUENCE vs SIM_IMMEDIATE_DAMAGE_ORDERING
- 5 x PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_LONG_MATCH_BEST_CYCLE
- 4 x PVPOKE_UNKNOWN_BRANCH vs SIM_IMMEDIATE_LETHAL
- 3 x PVPOKE_DP_KO_OR_FARM_DOWN vs SIM_COMPACT_DP_ROUTE
- 3 x PVPOKE_DP_KO_OR_FARM_DOWN vs SIM_IMMEDIATE_DAMAGE_ORDERING
- 3 x PVPOKE_DP_ORDERED_SEQUENCE vs SIM_FORCED_THROW_BEFORE_FAST_FAINT
- 3 x PVPOKE_SELF_DEBUFF_STACK_OR_WAIT vs SIM_SELF_DEBUFF_POLICY
- 2 x PVPOKE_FORCED_THROW_TURNS_TO_LIVE vs SIM_FORCED_THROW_BEFORE_FAST_FAINT
- 2 x PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_FORCED_THROW_BEFORE_FAST_FAINT
- 2 x PVPOKE_UNKNOWN_BRANCH vs SIM_FORCED_THROW_BEFORE_FAST_FAINT
- 1 x PVPOKE_DP_KO_OR_FARM_DOWN vs SIM_SELF_DEBUFF_POLICY
- 1 x PVPOKE_DP_ORDERED_SEQUENCE vs SIM_BUILD_TO_REPRESENTED_NUKE
- 1 x PVPOKE_UNKNOWN_BRANCH vs SIM_BUILD_TO_REPRESENTED_NUKE

## By classification

- MOVE_ID_DIFFERENCE: 59
- PVPOKE_ACTION_DIFFERENCE: 34

## Rows

| ID | Matchup | PvPoke | Simulator | Difference | Path pair |
| --- | --- | --- | --- | --- | --- |
| real-diff-018 | clodsire_vs_mantine | charged:EARTHQUAKE | charged:STONE_EDGE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-024 | guzzlord_vs_corsola_galarian | fast_move | charged:BRUTAL_SWING | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_LONG_MATCH_BEST_CYCLE |
| real-diff-050 | moltres_galarian_vs_sliggoo | fast_move | charged:FLY | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_SELF_DEBUFF_STACK_OR_WAIT vs SIM_SELF_DEBUFF_POLICY |
| real-diff-053 | mantine_vs_steelix_shadow | charged:TWISTER | charged:WATER_PULSE | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_COMPACT_DP_ROUTE |
| real-diff-060 | drapion_shadow_vs_kingdra_shadow | charged:AQUA_TAIL | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_UNKNOWN_BRANCH vs SIM_BUILD_TO_REPRESENTED_NUKE |
| real-diff-065 | aegislash_shield_vs_ninetales_alolan | charged:SHADOW_BALL | charged:GYRO_BALL | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-066 | bastiodon_vs_registeel | charged:STONE_EDGE | charged:FLAMETHROWER | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-070 | stunfisk_galarian_vs_jumpluff | fast_move | charged:ROCK_SLIDE | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_COMPACT_DP_ROUTE |
| real-diff-074 | dunsparce_vs_lapras_shadow | charged:DRILL_RUN | charged:ROCK_SLIDE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-083 | tinkaton_vs_lapras | charged:BULLDOZE | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_IMMEDIATE_DAMAGE_ORDERING |
| real-diff-094 | forretress_shadow_vs_corviknight_shadow | charged:SAND_TOMB | charged:ROCK_TOMB | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-095 | corsola_galarian_vs_umbreon | charged:NIGHT_SHADE | charged:POWER_GEM | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-116 | oinkologne_female_vs_corviknight | charged:BODY_SLAM | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_KO_OR_FARM_DOWN vs SIM_IMMEDIATE_DAMAGE_ORDERING |
| real-diff-129 | dusclops_shadow_vs_sableye_shadow | charged:ICE_PUNCH | charged:SHADOW_PUNCH | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-130 | moltres_galarian_vs_sliggoo | charged:FLY | charged:BRAVE_BIRD | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-150 | stunfisk_galarian_vs_jumpluff | charged:EARTHQUAKE | charged:ROCK_SLIDE | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_COMPACT_DP_ROUTE |
| real-diff-153 | stunfisk_vs_sealeo | charged:MUD_BOMB | charged:DISCHARGE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-154 | dunsparce_vs_lapras_shadow | charged:DRILL_RUN | charged:ROCK_SLIDE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-155 | malamar_shadow_vs_clefable | charged:FOUL_PLAY | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_KO_OR_FARM_DOWN vs SIM_SELF_DEBUFF_POLICY |
| real-diff-158 | pelipper_vs_stunfisk | fast_move | charged:WEATHER_BALL_WATER | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_COMPACT_DP_ROUTE |
| real-diff-159 | melmetal_vs_morpeko_full_belly | charged:DOUBLE_IRON_BASH | charged:DYNAMIC_PUNCH | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_FORCED_THROW_BEFORE_FAST_FAINT |
| real-diff-160 | morpeko_full_belly_vs_empoleon_shadow | charged:AURA_WHEEL_ELECTRIC | charged:PSYCHIC_FANGS | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-174 | forretress_shadow_vs_corviknight_shadow | charged:SAND_TOMB | charged:ROCK_TOMB | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-194 | talonflame_vs_empoleon | fast_move | charged:FLY | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_SELF_DEBUFF_STACK_OR_WAIT vs SIM_SELF_DEBUFF_POLICY |
| real-diff-206 | sableye_vs_quagsire | fast_move | charged:FOUL_PLAY | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_COMPACT_DP_ROUTE |
| real-diff-210 | moltres_galarian_vs_sliggoo | charged:FLY | charged:BRAVE_BIRD | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-213 | mantine_vs_steelix_shadow | charged:TWISTER | charged:WATER_PULSE | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_COMPACT_DP_ROUTE |
| real-diff-224 | swampert_vs_mandibuzz | charged:HYDRO_CANNON | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_IMMEDIATE_DAMAGE_ORDERING |
| real-diff-225 | aegislash_shield_vs_ninetales_alolan | charged:SHADOW_BALL | charged:GYRO_BALL | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_KO_OR_FARM_DOWN vs SIM_COMPACT_DP_ROUTE |
| real-diff-226 | bastiodon_vs_registeel | charged:STONE_EDGE | charged:FLAMETHROWER | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-230 | stunfisk_galarian_vs_jumpluff | fast_move | charged:ROCK_SLIDE | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_LONG_MATCH_BEST_CYCLE |
| real-diff-233 | stunfisk_vs_sealeo | charged:MUD_BOMB | charged:DISCHARGE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-234 | dunsparce_vs_lapras_shadow | charged:DRILL_RUN | charged:ROCK_SLIDE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-235 | malamar_shadow_vs_clefable | charged:FOUL_PLAY | charged:SUPER_POWER | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_FORCED_THROW_BEFORE_FAST_FAINT |
| real-diff-238 | pelipper_vs_stunfisk | fast_move | charged:WEATHER_BALL_WATER | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_COMPACT_DP_ROUTE |
| real-diff-240 | morpeko_full_belly_vs_empoleon_shadow | charged:PSYCHIC_FANGS | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_IMMEDIATE_DAMAGE_ORDERING |
| real-diff-246 | altaria_shadow_vs_dusclops_shadow | charged:SKY_ATTACK | charged:FLAMETHROWER | Same action family, different charged-move ordering criteria. | PVPOKE_FORCED_THROW_TURNS_TO_LIVE vs SIM_FORCED_THROW_BEFORE_FAST_FAINT |
| real-diff-248 | quagsire_shadow_vs_ninetales_alolan_shadow | charged:AQUA_TAIL | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_KO_OR_FARM_DOWN vs SIM_IMMEDIATE_DAMAGE_ORDERING |
| real-diff-251 | forretress_vs_altaria | charged:SAND_TOMB | charged:ROCK_TOMB | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-258 | clodsire_vs_mantine | charged:EARTHQUAKE | charged:STONE_EDGE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-264 | guzzlord_vs_corsola_galarian | fast_move | charged:BRUTAL_SWING | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_LONG_MATCH_BEST_CYCLE |
| real-diff-283 | dusclops_vs_swampert_shadow | charged:ICE_PUNCH | charged:SHADOW_PUNCH | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_IMMEDIATE_LETHAL |
| real-diff-293 | mantine_vs_steelix_shadow | charged:TWISTER | charged:WATER_PULSE | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_COMPACT_DP_ROUTE |
| real-diff-299 | charjabug_vs_fearow | charged:X_SCISSOR | charged:DISCHARGE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_KO_OR_FARM_DOWN vs SIM_COMPACT_DP_ROUTE |
| real-diff-305 | aegislash_shield_vs_ninetales_alolan | charged:SHADOW_BALL | charged:GYRO_BALL | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-306 | bastiodon_vs_registeel | charged:STONE_EDGE | charged:FLAMETHROWER | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-310 | stunfisk_galarian_vs_jumpluff | fast_move | charged:ROCK_SLIDE | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_COMPACT_DP_ROUTE |
| real-diff-314 | dunsparce_vs_lapras_shadow | charged:DRILL_RUN | charged:ROCK_SLIDE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-315 | malamar_shadow_vs_clefable | fast_move | charged:SUPER_POWER | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_FORCED_THROW_BEFORE_FAST_FAINT |
| real-diff-335 | corsola_galarian_vs_umbreon | charged:NIGHT_SHADE | charged:POWER_GEM | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-346 | furret_vs_dragonair_shadow | charged:SWIFT | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_KO_OR_FARM_DOWN vs SIM_COMPACT_DP_ROUTE |
| real-diff-356 | oinkologne_female_vs_corviknight | charged:BODY_SLAM | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_KO_OR_FARM_DOWN vs SIM_IMMEDIATE_DAMAGE_ORDERING |
| real-diff-367 | wigglytuff_vs_feraligatr | charged:ICY_WIND | charged:SWIFT | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_IMMEDIATE_LETHAL |
| real-diff-369 | dusclops_shadow_vs_sableye_shadow | charged:ICE_PUNCH | charged:SHADOW_PUNCH | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-374 | talonflame_shadow_vs_aegislash_shield | charged:FLY | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_BUILD_TO_REPRESENTED_NUKE |
| real-diff-388 | swampert_shadow_vs_tinkaton | charged:HYDRO_CANNON | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_IMMEDIATE_DAMAGE_ORDERING |
| real-diff-390 | stunfisk_galarian_vs_jumpluff | charged:EARTHQUAKE | charged:ROCK_SLIDE | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_COMPACT_DP_ROUTE |
| real-diff-394 | dunsparce_vs_lapras_shadow | charged:DRILL_RUN | charged:ROCK_SLIDE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-398 | pelipper_vs_stunfisk | fast_move | charged:WEATHER_BALL_WATER | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_COMPACT_DP_ROUTE |
| real-diff-399 | melmetal_vs_morpeko_full_belly | charged:DOUBLE_IRON_BASH | charged:DYNAMIC_PUNCH | Same action family, different charged-move ordering criteria. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_FORCED_THROW_BEFORE_FAST_FAINT |
| real-diff-407 | empoleon_shadow_vs_dewgong | charged:HYDRO_CANNON | charged:DRILL_PECK | Same action family, different charged-move ordering criteria. | PVPOKE_FORCED_THROW_TURNS_TO_LIVE vs SIM_FORCED_THROW_BEFORE_FAST_FAINT |
| real-diff-438 | sealeo_vs_medicham | charged:SURF | charged:BODY_SLAM | Same action family, different charged-move ordering criteria. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_FORCED_THROW_BEFORE_FAST_FAINT |
| real-diff-450 | moltres_galarian_vs_sliggoo | charged:FLY | charged:BRAVE_BIRD | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-453 | mantine_vs_steelix_shadow | charged:TWISTER | charged:WATER_PULSE | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_COMPACT_DP_ROUTE |
| real-diff-460 | drapion_shadow_vs_kingdra_shadow | charged:AQUA_TAIL | charged:CRUNCH | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_COMPACT_DP_ROUTE |
| real-diff-464 | swampert_vs_mandibuzz | charged:HYDRO_CANNON | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_IMMEDIATE_DAMAGE_ORDERING |
| real-diff-465 | aegislash_shield_vs_ninetales_alolan | charged:SHADOW_BALL | charged:GYRO_BALL | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-466 | bastiodon_vs_registeel | charged:STONE_EDGE | charged:FLAMETHROWER | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-470 | stunfisk_galarian_vs_jumpluff | fast_move | charged:ROCK_SLIDE | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_LONG_MATCH_BEST_CYCLE |
| real-diff-473 | stunfisk_vs_sealeo | charged:MUD_BOMB | charged:DISCHARGE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-478 | pelipper_vs_stunfisk | fast_move | charged:WEATHER_BALL_WATER | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_COMPACT_DP_ROUTE |
| real-diff-479 | melmetal_vs_morpeko_full_belly | charged:DOUBLE_IRON_BASH | charged:DYNAMIC_PUNCH | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-480 | morpeko_full_belly_vs_empoleon_shadow | charged:PSYCHIC_FANGS | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_IMMEDIATE_DAMAGE_ORDERING |
| real-diff-504 | guzzlord_vs_corsola_galarian | fast_move | charged:BRUTAL_SWING | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_LONG_MATCH_BEST_CYCLE |
| real-diff-523 | dusclops_vs_swampert_shadow | charged:ICE_PUNCH | charged:SHADOW_PUNCH | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_IMMEDIATE_LETHAL |
| real-diff-530 | moltres_galarian_vs_sliggoo | fast_move | charged:FLY | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_SELF_DEBUFF_STACK_OR_WAIT vs SIM_SELF_DEBUFF_POLICY |
| real-diff-533 | mantine_vs_steelix_shadow | charged:TWISTER | charged:WATER_PULSE | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_COMPACT_DP_ROUTE |
| real-diff-539 | charjabug_vs_fearow | charged:X_SCISSOR | charged:DISCHARGE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-540 | drapion_shadow_vs_kingdra_shadow | charged:AQUA_TAIL | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_UNKNOWN_BRANCH vs SIM_COMPACT_DP_ROUTE |
| real-diff-545 | aegislash_shield_vs_ninetales_alolan | charged:SHADOW_BALL | charged:GYRO_BALL | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-546 | bastiodon_vs_registeel | charged:STONE_EDGE | charged:FLAMETHROWER | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-550 | stunfisk_galarian_vs_jumpluff | fast_move | charged:ROCK_SLIDE | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_COMPACT_DP_ROUTE |
| real-diff-555 | malamar_shadow_vs_clefable | fast_move | charged:SUPER_POWER | PvPoke builds/farms/waits; simulator spends energy immediately. | PVPOKE_RETURN_UNDEFINED_FAST_OR_WAIT vs SIM_FORCED_THROW_BEFORE_FAST_FAINT |
| real-diff-563 | tinkaton_vs_lapras | charged:BULLDOZE | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_IMMEDIATE_DAMAGE_ORDERING |
| real-diff-574 | forretress_shadow_vs_corviknight_shadow | charged:SAND_TOMB | charged:ROCK_TOMB | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-607 | wigglytuff_vs_feraligatr | charged:ICY_WIND | charged:SWIFT | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_IMMEDIATE_LETHAL |
| real-diff-609 | dusclops_shadow_vs_sableye_shadow | charged:ICE_PUNCH | charged:SHADOW_PUNCH | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-617 | malamar_vs_altaria_shadow | charged:FOUL_PLAY | fast_move | PvPoke throws now; simulator delays/builds/farms. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-630 | stunfisk_galarian_vs_jumpluff | charged:EARTHQUAKE | charged:ROCK_SLIDE | Same action family, different charged-move ordering criteria. | PVPOKE_UNKNOWN_BRANCH vs SIM_COMPACT_DP_ROUTE |
| real-diff-633 | stunfisk_vs_sealeo | charged:MUD_BOMB | charged:DISCHARGE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-634 | dunsparce_vs_lapras_shadow | charged:DRILL_RUN | charged:ROCK_SLIDE | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
| real-diff-639 | melmetal_vs_morpeko_full_belly | charged:DOUBLE_IRON_BASH | charged:DYNAMIC_PUNCH | Same action family, different charged-move ordering criteria. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_FORCED_THROW_BEFORE_FAST_FAINT |
| real-diff-640 | morpeko_full_belly_vs_empoleon_shadow | charged:AURA_WHEEL_ELECTRIC | charged:PSYCHIC_FANGS | Same DP area, different route ordering/tie-break/post-processing. | PVPOKE_DP_ORDERED_SEQUENCE vs SIM_COMPACT_DP_ROUTE |
