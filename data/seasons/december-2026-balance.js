(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  if (root) root.BATTLE_DECEMBER_2026_BALANCE = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // LAIC announcement photographed by the user. Energy changes were supplied
  // by the user on November 21. The official season name is still unavailable.
  const confirmed = values => Object.freeze({
    ...values,
    status: "confirmed",
    note: "LAIC announcement photos and energy values supplied by the user on 2026-11-21."
  });
  const add = (fast = [], charged = []) => Object.freeze({
    fast: Object.freeze({ add: Object.freeze(fast) }),
    charged: Object.freeze({ add: Object.freeze(charged) }),
    status: "confirmed"
  });
  const cradilyMoveset = Object.freeze({ fast: "ACID", charged: Object.freeze(["ROCK_TOMB", "GRASS_KNOT"]) });

  return Object.freeze({
    id: "december-2026",
    label: "December 2026",
    dataVersion: "december-2026-laic-1",
    effectiveDate: "2026-12-01",
    enabled: true,
    rankingVersion: "great-league-december-2026-laic-v52-6",
    generatedAssets: Object.freeze({
      rankings: "data/seasons/december-2026/great-league-rankings.js",
      rankingDetails: "data/seasons/december-2026/great-league-ranking-details.js",
      defaultMovesets: "data/seasons/december-2026/default-movesets.js"
    }),
    generatedGlobals: Object.freeze({
      rankings: "DECEMBER_2026_RANKINGS",
      rankingDetails: "DECEMBER_2026_RANKING_DETAILS",
      defaultMovesets: "DECEMBER_2026_DEFAULT_MOVESETS"
    }),
    source: Object.freeze({
      kind: "user-provided-announcement",
      event: "LAIC",
      receivedDate: "2026-11-21",
      seasonNameStatus: "pending",
      energyValues: "user-provided"
    }),
    moveOverrides: Object.freeze({
      ROCK_THROW: confirmed({ energyGain: 4 }),
      PSYSTRIKE: confirmed({ energy: 50 }),
      ROCK_SLIDE: confirmed({ power: 70, energy: 40 }),
      MUD_BOMB: confirmed({ power: 75, energy: 50 }),
      SANDSEAR_STORM: confirmed({ power: 70 }),
      WILDBOLT_STORM: confirmed({ power: 70 }),
      BLEAKWIND_STORM: confirmed({ power: 70 }),
      HEAT_WAVE: confirmed({ power: 85 }),
      BRUTAL_SWING: confirmed({ power: 60 }),
      DIG: confirmed({ energy: 45 }),
      TRIPLE_AXEL: confirmed({ energy: 40 }),
      CROSS_CHOP: confirmed({ power: 60 }),
      SYNCHRONOISE: confirmed({ power: 65, energy: 40 })
    }),
    pokemonMoveOverrides: Object.freeze({
      eelektrik: add(["VOLT_SWITCH"], ["LUNGE", "AQUA_TAIL"]),
      eelektross: add([], ["LUNGE", "PSYCHIC_FANGS"]),
      flaaffy: add(["THUNDER_SHOCK"]),
      flaaffy_shadow: add(["THUNDER_SHOCK"]),
      boltund: add(["VOLT_SWITCH"], ["DIG", "PSYCHIC_FANGS"]),
      electabuzz: add(["KARATE_CHOP"], ["WILD_CHARGE", "CROSS_CHOP"]),
      electabuzz_shadow: add(["KARATE_CHOP"], ["WILD_CHARGE", "CROSS_CHOP"]),
      golem_alolan: add([], ["BRICK_BREAK", "ROCK_SLIDE"]),
      golem_alolan_shadow: add([], ["BRICK_BREAK", "ROCK_SLIDE"]),
      beartic: add([], ["BRICK_BREAK"]),
      garganacl: add([], ["DYNAMIC_PUNCH"]),
      sudowoodo: add(["LOW_KICK"]),
      sudowoodo_shadow: add(["LOW_KICK"]),
      carracosta: add(["LOW_KICK"], ["ROCK_SLIDE"]),
      carracosta_shadow: add(["LOW_KICK"], ["ROCK_SLIDE"]),
      staraptor: add([], ["BLAZE_KICK"]),
      staraptor_shadow: add([], ["BLAZE_KICK"]),
      drampa: add([], ["HEAT_WAVE"]),
      clefable: add([], ["MYSTICAL_FIRE"]),
      clefable_mega: add([], ["MYSTICAL_FIRE"]),
      graveler_alolan: add([], ["EARTH_POWER", "ROCK_SLIDE"]),
      graveler_alolan_shadow: add([], ["EARTH_POWER", "ROCK_SLIDE"]),
      regice: add([], ["ICE_BEAM"]),
      regice_shadow: add([], ["ICE_BEAM"]),
      starmie: add([], ["TRIPLE_AXEL"]),
      starmie_shadow: add([], ["TRIPLE_AXEL"]),
      starmie_mega: add([], ["TRIPLE_AXEL"]),
      flamigo: add([], ["TRIPLE_AXEL"]),
      litleo: add([], ["SWIFT"]),
      pyroar: add([], ["SWIFT"]),
      tyrunt: add([], ["PSYCHIC_FANGS"]),
      tyrunt_shadow: add([], ["PSYCHIC_FANGS"]),
      regirock: add([], ["METEOR_BEAM"]),
      regirock_shadow: add([], ["METEOR_BEAM"]),
      armaldo: add([], ["ROCK_SLIDE"]),
      armaldo_shadow: add([], ["ROCK_SLIDE"]),
      hariyama: add([], ["CHILLING_WATER"]),
      hariyama_shadow: add([], ["CHILLING_WATER"]),
      abomasnow: add([], ["CHILLING_WATER"]),
      abomasnow_shadow: add([], ["CHILLING_WATER"]),
      abomasnow_mega: add([], ["CHILLING_WATER"]),
      avalugg: add([], ["CHILLING_WATER"]),
      palossand: add([], ["CHILLING_WATER"]),
      palossand_shadow: add([], ["CHILLING_WATER"]),
      omastar: add([], ["SCALD"]),
      omastar_shadow: add([], ["SCALD"]),
      wartortle: add(["WATERFALL"]),
      wartortle_shadow: add(["WATERFALL"])
    }),
    defaultMovesets: Object.freeze({
      clefable: Object.freeze({ fast: "FAIRY_WIND", charged: Object.freeze(["MOONBLAST", "MYSTICAL_FIRE"]) }),
      cradily: cradilyMoveset,
      cradily_b: cradilyMoveset,
      eelektross: Object.freeze({ fast: "VOLT_SWITCH", charged: Object.freeze(["LUNGE", "PSYCHIC_FANGS"]) }),
      houndstone: Object.freeze({ fast: "BITE", charged: Object.freeze(["SHADOW_BALL", "PSYCHIC_FANGS"]) }),
      morpeko_full_belly: Object.freeze({ fast: "THUNDER_SHOCK", charged: Object.freeze(["AURA_WHEEL_ELECTRIC", "PSYCHIC_FANGS"]) }),
      pidgeot: Object.freeze({ fast: "WING_ATTACK", charged: Object.freeze(["BRAVE_BIRD", "FEATHER_DANCE"]) }),
      starmie: Object.freeze({ fast: "PSYWAVE", charged: Object.freeze(["SURF", "TRIPLE_AXEL"]) })
    }),
    pendingValues: Object.freeze([])
  });
});
