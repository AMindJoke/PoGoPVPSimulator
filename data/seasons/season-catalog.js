(function (root) {
  "use strict";

  // This descriptor points at the canonical files already loaded by PogoPvp.html.
  // A preview is exposed only after data/seasons/next-season.js supplies a complete,
  // enabled descriptor; no announced value is guessed here.
  const next = root.BATTLE_DECEMBER_2026_BALANCE?.enabled
    ? root.BATTLE_DECEMBER_2026_BALANCE : root.BATTLE_NEXT_SEASON;
  root.BATTLE_SEASON_CATALOG = Object.freeze({
    schemaVersion: 1,
    current: Object.freeze({
      id: "twilight-trails",
      label: "Twilight Trails",
      dataVersion: "twilight-trails-confirmed-1",
      rankingVersion: "great-league-twilight-trails-confirmed-v52-score-v5-206"
    }),
    next: next?.enabled ? Object.freeze({
      ...next,
      generated: next.generated || (next.generatedGlobals
        && root[next.generatedGlobals.rankings] && root[next.generatedGlobals.rankingDetails] ? {
        rankings: root[next.generatedGlobals.rankings],
        rankingDetails: root[next.generatedGlobals.rankingDetails],
        defaultMovesets: root[next.generatedGlobals.defaultMovesets]
      } : null)
    }) : null
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
