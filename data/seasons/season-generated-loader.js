(function (root) {
  "use strict";

  const storageKey = "go-pvp-active-season-v1";
  let requested = "";
  try {
    requested = new URLSearchParams(root.location && root.location.search || "").get("season") || root.localStorage.getItem(storageKey) || "";
  } catch (_) {}
  const next = root.BATTLE_NEXT_SEASON;
  const preview = next?.enabled && requested === next.id && next.generatedAssets;
  const currentAssetVersion = "20260930-v64-rankings";
  const files = ["data/great-league-rankings.js", "data/great-league-ranking-details.js"];
  if (preview) files.push(...Object.values(next.generatedAssets));
  // Preview battle rules must be resolved before the app initializes.
  if (preview) {
    document.write(files.map(file => `<script src="${file}?v=${currentAssetVersion}"><\/script>`).join(""));
    return;
  }

  let pending = null;
  let failure = null;
  const loaded = new Set();
  function loadScript(file) {
    if (loaded.has(file)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error("Ranking data timed out. Use Refresh to retry."));
      }, 15000);
      script.src = `${file}?v=${currentAssetVersion}`;
      script.async = true;
      script.onload = () => { clearTimeout(timeout); loaded.add(file); resolve(); };
      script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error("Ranking data could not be loaded. Use Refresh to retry.")); };
      document.head.appendChild(script);
    });
  }
  root.PvPeakSeasonGeneratedLoader = Object.freeze({
    load(options = {}) {
      if (pending) return pending;
      if (failure && !options.retry) return Promise.reject(failure);
      failure = null;
      pending = Promise.allSettled(files.map(loadScript)).then(results => {
        const failed = results.find(result => result.status === "rejected");
        if (failed) throw failed.reason;
        if (!root.GREAT_LEAGUE_RANKINGS?.entries || !root.GREAT_LEAGUE_RANKING_DETAILS?.entries) {
          throw new Error("Invalid ranking data.");
        }
        return { rankings: root.GREAT_LEAGUE_RANKINGS, rankingDetails: root.GREAT_LEAGUE_RANKING_DETAILS };
      }).catch(error => { failure = error; throw error; }).finally(() => { pending = null; });
      return pending;
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
