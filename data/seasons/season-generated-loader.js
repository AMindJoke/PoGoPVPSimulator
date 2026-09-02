(function (root) {
  "use strict";

  const storageKey = "go-pvp-active-season-v1";
  let requested = "";
  try {
    requested = new URLSearchParams(root.location && root.location.search || "").get("season") || root.localStorage.getItem(storageKey) || "";
  } catch (_) {}
  const preview = requested === "twilight-trails";
  const base = preview ? "data/seasons/twilight-trails/" : "data/";
  const files = ["great-league-rankings.js", "great-league-ranking-details.js"];
  if (preview) files.push("default-movesets.js");
  document.write(files.map(file => `<script src="${base}${file}"><\/script>`).join(""));
})(typeof window !== "undefined" ? window : globalThis);
