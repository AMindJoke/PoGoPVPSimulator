(function (root) {
  "use strict";

  // This descriptor points at the canonical files already loaded by PogoPvp.html.
  // A preview is exposed only after data/seasons/next-season.js supplies a complete,
  // enabled descriptor; no announced value is guessed here.
  root.BATTLE_SEASON_CATALOG = Object.freeze({
    schemaVersion: 1,
    current: Object.freeze({
      id: "current-2026-06-28",
      label: "Current Season",
      dataVersion: "gamemaster-2026-06-28",
      rankingVersion: "great-league-battle-planner-v33"
    }),
    next: root.BATTLE_NEXT_SEASON || null
  });
})(typeof globalThis !== "undefined" ? globalThis : this);
