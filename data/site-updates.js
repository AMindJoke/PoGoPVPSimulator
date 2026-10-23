(function (root, factory) {
  const updates = factory();
  if (typeof module === "object" && module.exports) module.exports = updates;
  if (root) root.BATTLE_SITE_UPDATES = updates;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // Newest releases first. Keep older entries; Home shows only the latest three.
  return [
    {
      id: "20261023-dragon-fairy-damage",
      date: "2026-10-23",
      category: "Battle & Meta",
      title: "Corrected Dragon damage against Fairy Pokemon",
      changes: [
        "Dragon attacks were dealing too much damage to Fairy Pokemon. For example, Rank 1 Altaria now deals 1 damage per Dragon Breath to Rank 1 Azumarill, instead of 2.",
        "The type chart has been checked, and Great League rankings and key matchups have been recalculated."
      ]
    },
    {
      id: "20261020-houndoom-variants",
      date: "2026-10-20",
      category: "Battle & Meta",
      title: "Two Houndoom movesets in the rankings",
      changes: [
        "Houndoom now starts with Trailblaze. You can also find its Flamethrower set in the rankings, for both regular and Shadow Houndoom.",
        "Great League rankings and key wins/losses have been recalculated with the latest battle changes."
      ]
    },
    {
      id: "20261020-shield-cycle",
      date: "2026-10-20",
      category: "Battle",
      title: "Better timing against Always shields",
      changes: [
        "Battle now checks whether throwing a lethal Charged Move sooner is better than building more energy against Always shields.",
        "This fixes a Quagsire Shadow alternative that lost to Houndoom Shadow by delaying Aqua Tail too long."
      ]
    },
    {
      id: "20261019-battle-rankings",
      date: "2026-10-19",
      category: "Battle & Meta",
      title: "Battle decisions and rankings updated",
      changes: [
        "Battle checks more Charged Move options before choosing when to throw or use a shield.",
        "The Great League rankings and key wins/losses have been recalculated with these changes."
      ]
    },
    {
      id: "20261014-smart-shields",
      date: "2026-10-14",
      category: "Battle",
      title: "Fewer wasted Charged Moves",
      changes: [
        "With Smart Shield, Pok\u00e9mon are less likely to keep using a weak move just to draw a shield.",
        "For example, Florges can go for Moonblast against Kingdra instead of repeatedly using Chilling Water."
      ]
    },
    {
      id: "20261014-mega-pokemon",
      date: "2026-10-14",
      category: "Mega Pok\u00e9mon",
      title: "Mega Pok\u00e9mon are now in Battle",
      changes: [
        "Choose Mega Pok\u00e9mon alongside regular Pok\u00e9mon in Great, Ultra or Master League.",
        "Mega Level uses the in-game icons, and all three Charged Moves are shown together on the energy bar."
      ]
    }
  ];
});
