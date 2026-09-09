(function (root) {
  "use strict";

  const storageKey = "go-pvp-active-season-v1";
  let requested = "";
  try {
    requested = new URLSearchParams(root.location && root.location.search || "").get("season") || root.localStorage.getItem(storageKey) || "";
  } catch (_) {}
  const next = root.BATTLE_NEXT_SEASON;
  const preview = next?.enabled && requested === next.id && next.generatedAssets;
  const files = ["data/great-league-rankings.js", "data/great-league-ranking-details.js"];
  if (preview) files.push(...Object.values(next.generatedAssets));
  document.write(files.map(file => `<script src="${file}"><\/script>`).join(""));
})(typeof window !== "undefined" ? window : globalThis);
