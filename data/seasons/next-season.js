(function (root) {
  "use strict";

  // Canonical Twilight Trails draft. It remains disabled until all pending values
  // are supplied and season-derived rankings are generated.
  const sourceUrl = "https://pokemongo.com/news/go-battle-league-twilight-trails";
  const confirmed = (values, note) => Object.freeze({ ...values, status: "confirmed", note: note || "Official Twilight Trails announcement", sourceUrl });
  const add = (fast = [], charged = []) => Object.freeze({ fast: Object.freeze({ add: Object.freeze(fast) }), charged: Object.freeze({ add: Object.freeze(charged) }), status: "confirmed", sourceUrl });
  root.BATTLE_NEXT_SEASON = Object.freeze({
    id: "twilight-trails",
    label: "Twilight Trails",
    dataVersion: "twilight-trails-draft-1",
    rankingVersion: "pending",
    enabled: false,
    sourceUrl,
    moveOverrides: Object.freeze({
      AIR_CUTTER: confirmed({ power: 60 }),
      BULLDOZE: confirmed({ power: 80, buffApplyChance: 1, buffs: [0, -1], buffTarget: "opponent" }),
      BODY_SLAM: confirmed({ power: 65 }),
      SAND_TOMB: confirmed({ power: 55 }),
      BRINE: confirmed({ power: 100 }),
      BUBBLE_BEAM: confirmed({ power: 50 }),
      MIRROR_COAT: confirmed({ power: 75 }),
      CHARGE_BEAM: confirmed({ power: 6 }),
      IRON_HEAD: confirmed({ power: 85 }),
      DRAINING_KISS: confirmed({ power: 80, buffApplyChance: 1, buffs: [0, 1], buffTarget: "self" }),
      POISON_FANG: confirmed({ power: 50 }),
      LUNGE: confirmed({ power: 70 }),
      BITE: confirmed({ power: 2 }),
      INFESTATION: confirmed({ power: 10 }),
      TAKE_DOWN: confirmed({ power: 14 }),
      SCRATCH: confirmed({ power: 3 }),
      MOONBLAST: confirmed({ power: 90 }),
      SHADOW_BALL: confirmed({ power: 90 }),
      PSYCHO_BOOST: confirmed({ power: 85 }),
      RAGE_FIST: confirmed({ power: 55 }),
      DOUBLE_IRON_BASH: confirmed({ power: 70 }),
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
    pendingValues: Object.freeze([
      "AIR_CUTTER.energy", "AIR_CUTTER.buffApplyChance", "BULLDOZE.energy", "BODY_SLAM.energy", "SAND_TOMB.energy",
      "BRINE.energy", "BUBBLE_BEAM.energy", "MIRROR_COAT.energy", "HIGH_HORSEPOWER.energy", "BLAZE_KICK.energy",
      "BITE.energyGain", "TAKE_DOWN.energyGain", "SCRATCH.energyGain", "MOONBLAST.energy", "DARK_PULSE.energy",
      "RAGE_FIST.energy", "MAGNET_BOMB.energy", "SHADOW_FORCE.energy"
    ]),
    generated: null
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
