(function (root) {
  "use strict";

  // Canonical Twilight Trails draft. It remains disabled until season-derived
  // rankings are generated. Estimated fields are explicitly marked below.
  const sourceUrl = "https://pokemongo.com/news/go-battle-league-twilight-trails";
  const confirmed = (values, note) => Object.freeze({ ...values, status: "confirmed", note: note || "Official Twilight Trails announcement", sourceUrl });
  const estimated = (values, fields) => Object.freeze({
    ...values,
    status: "estimated",
    note: `Provisional pre-release value supplied for ${fields}; replace after the live Game Master update.`,
    sourceUrl
  });
  const add = (fast = [], charged = []) => Object.freeze({ fast: Object.freeze({ add: Object.freeze(fast) }), charged: Object.freeze({ add: Object.freeze(charged) }), status: "confirmed", sourceUrl });
  root.BATTLE_NEXT_SEASON = Object.freeze({
    id: "twilight-trails",
    label: "Twilight Trails",
    dataVersion: "twilight-trails-draft-2",
    rankingVersion: "pending",
    enabled: false,
    sourceUrl,
    moveOverrides: Object.freeze({
      AIR_CUTTER: estimated({ power: 60, energy: 40, buffApplyChance: 0.1 }, "energy cost and boost chance"),
      BULLDOZE: estimated({ power: 80, energy: 50, buffApplyChance: 1, buffs: [0, -1], buffTarget: "opponent" }, "energy cost"),
      BODY_SLAM: estimated({ power: 65, energy: 40 }, "energy cost"),
      SAND_TOMB: estimated({ power: 55, energy: 45 }, "energy cost"),
      BRINE: estimated({ power: 100, energy: 60 }, "energy cost"),
      BUBBLE_BEAM: estimated({ power: 50, energy: 45 }, "energy cost"),
      MIRROR_COAT: estimated({ power: 75, energy: 45 }, "energy cost"),
      HIGH_HORSEPOWER: estimated({ energy: 55 }, "energy cost"),
      CHARGE_BEAM: confirmed({ power: 6 }),
      IRON_HEAD: confirmed({ power: 85 }),
      DRAINING_KISS: confirmed({ power: 80, buffApplyChance: 1, buffs: [0, 1], buffTarget: "self" }),
      POISON_FANG: confirmed({ power: 50 }),
      LUNGE: confirmed({ power: 70 }),
      BLAZE_KICK: estimated({ energy: 35 }, "energy cost"),
      BITE: estimated({ power: 2, energyGain: 4 }, "energy generation"),
      INFESTATION: confirmed({ power: 10 }),
      TAKE_DOWN: estimated({ power: 14, energyGain: 9 }, "energy generation"),
      SCRATCH: estimated({ power: 3, energyGain: 4 }, "energy generation"),
      MOONBLAST: estimated({ power: 90, energy: 50 }, "energy cost"),
      SHADOW_BALL: confirmed({ power: 90 }),
      DARK_PULSE: estimated({ energy: 45 }, "energy cost"),
      PSYCHO_BOOST: confirmed({ power: 85 }),
      RAGE_FIST: estimated({ power: 55, energy: 40 }, "energy cost"),
      MAGNET_BOMB: estimated({ energy: 40 }, "energy cost"),
      DOUBLE_IRON_BASH: confirmed({ power: 70 }),
      SHADOW_FORCE: estimated({ energy: 80 }, "energy cost"),
      LOW_KICK: confirmed({ power: 6 })
    }),
    pokemonMoveOverrides: Object.freeze({
      volbeat: add(["INFESTATION"], ["LUNGE"]),
      illumise: add(["INFESTATION"], ["SHADOW_BALL"]),
      arbok: add([], ["BRUTAL_SWING", "WRAP"]), arbok_shadow: add([], ["BRUTAL_SWING", "WRAP"]),
      aerodactyl: add([], ["BRUTAL_SWING"]), aerodactyl_shadow: add([], ["BRUTAL_SWING"]), aerodactyl_mega: add([], ["BRUTAL_SWING"]),
      muk_alolan: add([], ["BRUTAL_SWING", "ICE_PUNCH"]), muk_alolan_shadow: add([], ["BRUTAL_SWING", "ICE_PUNCH"]),
      greninja: add([], ["BRUTAL_SWING"]), greninja_shadow: add([], ["BRUTAL_SWING"]),
      ariados: add([], ["FOUL_PLAY"]),
      darkrai: add(["SUCKER_PUNCH"], ["FOUL_PLAY"]), darkrai_shadow: add(["SUCKER_PUNCH"], ["FOUL_PLAY"]),
      grafaiai: add(["SCRATCH"], ["FOUL_PLAY"]),
      victreebel: add(["SUCKER_PUNCH"]), victreebel_shadow: add(["SUCKER_PUNCH"]), victreebel_mega: add(["SUCKER_PUNCH"]),
      audino: add(["CHARGE_BEAM"]), audino_mega: add(["CHARGE_BEAM"]),
      raichu: add([], ["VOLT_TACKLE"]), raichu_alolan: add([], ["VOLT_TACKLE"]),
      grimmsnarl: add([], ["DRAINING_KISS"]),
      aggron: add([], ["BRICK_BREAK"]), aggron_shadow: add([], ["BRICK_BREAK"]), aggron_mega: add([], ["BRICK_BREAK"]),
      zeraora: add([], ["DYNAMIC_PUNCH"]), deoxys_defense: add(["LOW_KICK"]), kingambit: add(["LOW_KICK"]),
      gallade: add([], ["SACRED_SWORD"]), gallade_shadow: add([], ["SACRED_SWORD"]), gallade_mega: add([], ["SACRED_SWORD"]),
      houndoom: add(["INCINERATE"], ["TRAILBLAZE"]), houndoom_shadow: add(["INCINERATE"], ["TRAILBLAZE"]), houndoom_mega: add(["INCINERATE"], ["TRAILBLAZE"]),
      mismagius: add([], ["MYSTICAL_FIRE"]), mismagius_shadow: add([], ["MYSTICAL_FIRE"]),
      crobat: add(["GUST"]), crobat_shadow: add(["GUST"]), flamigo: add(["PECK"]),
      chandelure: add(["ASTONISH"]), chandelure_shadow: add(["ASTONISH"]),
      cofagrigus: add([], ["ENERGY_BALL"]), cofagrigus_shadow: add([], ["ENERGY_BALL"]),
      skarmory: add([], ["DRILL_RUN"]), skarmory_shadow: add([], ["DRILL_RUN"]), skarmory_mega: add([], ["DRILL_RUN"]),
      bombirdier: add([], ["DRILL_RUN"]), lugia: add([], ["EARTH_POWER"]), lugia_shadow: add([], ["EARTH_POWER"]),
      miltank: add([], ["HIGH_HORSEPOWER"]), nidoking: add([], ["AVALANCHE"]), nidoking_shadow: add([], ["AVALANCHE"]),
      ursaluna: add(["SCRATCH"]), ursaluna_shadow: add(["SCRATCH"]), zoroark_hisuian: add([], ["SWIFT"]),
      toxtricity_low_key: add([], ["SWIFT"]), toxtricity_amped: add([], ["SWIFT"]),
      snorlax: add(["PSYWAVE"]), snorlax_shadow: add(["PSYWAVE"])
    }),
    pendingValues: Object.freeze([]),
    generatedAssets: Object.freeze({
      rankings: "data/seasons/twilight-trails/great-league-rankings.js",
      rankingDetails: "data/seasons/twilight-trails/great-league-ranking-details.js",
      defaultMovesets: "data/seasons/twilight-trails/default-movesets.js"
    }),
    generated: root.TWILIGHT_TRAILS_RANKINGS && root.TWILIGHT_TRAILS_RANKING_DETAILS
      ? Object.freeze({
          rankings: root.TWILIGHT_TRAILS_RANKINGS,
          rankingDetails: root.TWILIGHT_TRAILS_RANKING_DETAILS,
          defaultMovesets: root.TWILIGHT_TRAILS_DEFAULT_MOVESETS || {}
        })
      : null
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
