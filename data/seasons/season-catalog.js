(function (root) {
  "use strict";

  // This descriptor points at the canonical files already loaded by PogoPvp.html.
  // A preview is exposed only after data/seasons/next-season.js supplies a complete,
  // enabled descriptor; no announced value is guessed here.
  root.BATTLE_SEASON_CATALOG = Object.freeze({
    schemaVersion: 1,
    current: Object.freeze({
      id: "twilight-trails",
      label: "Twilight Trails",
      dataVersion: "twilight-trails-confirmed-1",
      rankingVersion: "great-league-twilight-trails-confirmed-v43-global-1"
    }),
    next: root.BATTLE_NEXT_SEASON?.enabled ? Object.freeze({
      ...root.BATTLE_NEXT_SEASON,
      generated: root.BATTLE_NEXT_SEASON.generated || (root.BATTLE_NEXT_SEASON.generatedGlobals ? {
        rankings: root[root.BATTLE_NEXT_SEASON.generatedGlobals.rankings],
        rankingDetails: root[root.BATTLE_NEXT_SEASON.generatedGlobals.rankingDetails],
        defaultMovesets: root[root.BATTLE_NEXT_SEASON.generatedGlobals.defaultMovesets]
      } : null)
    }) : null
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
