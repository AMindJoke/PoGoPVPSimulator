const CACHE_PREFIX = "pogo-pvp-simulator";
const CACHE_VERSION = "2026-09-30-v63-background-rankings";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./PogoPvp.html",
  "./manifest.webmanifest",
  "./assets/go-pvp-mark.png",
  "./assets/go-pvp-favicon-16.png",
  "./assets/go-pvp-favicon-32.png",
  "./assets/go-pvp-favicon-48.png",
  "./assets/paper-grain.svg",
  "./assets/app-icon-180.png",
  "./assets/app-icon-192.png",
  "./assets/app-icon-512.png",
  "./battle-data.js",
  "./cramorant-data.js",
  "./default-movesets.js",
  "./data/seasons/season-generated-loader.js",
  "./data/seasons/next-season.js",
  "./data/seasons/season-catalog.js",
  "./src/season/season-context.js",
  "./data/compendium/mechanics.json",
  "./data/compendium/rulings.json",
  "./data/compendium/glossary.json",
  "./src/performance/perf-debug.js",
  "./src/iv-optimization.js",
  "./src/reliability/battle-reliability.js",
  "./src/tactical/tactical-patterns.js",
  "./src/analysis/tactical-insights.js",
  "./src/analysis/win-condition-engine.js",
  "./src/analysis/win-condition-view-model.js",
  "./src/analysis/matchup-story.js",
  "./src/analysis/battle-review.js",
  "./src/analysis/iv-impact.js",
  "./src/analysis/ranking-details.js",
  "./src/analysis/pokemon-analysis-view-model.js",
  "./src/ui/pokemon-analysis.js",
  "./src/team-builder/team-builder-state.js",
  "./src/team-builder/team-builder-meta.js",
  "./src/team-builder/team-builder-analysis.js",
  "./src/team-builder/team-builder-matrix.css",
  "./src/team-builder/team-builder-presentation.css",
  "./src/meta-mobile.css",
  "./src/meta-desktop-presentation.css",
  "./src/ui/meta-desktop-presentation.js",
  "./src/ui/analysis-scenario-presentation.css",
  "./src/ui/analysis-scenario-presentation.js",
  "./src/ui/home-presentation.css",
  "./src/ui/usability-refinements.css",
  "./src/compendium/compendium-presentation.css",
  "./assets/team-builder-status-icons/win-hard.svg",
  "./assets/team-builder-status-icons/win-soft.svg",
  "./assets/team-builder-status-icons/loss-hard.svg",
  "./assets/team-builder-status-icons/loss-soft.svg",
  "./src/team-builder/team-builder-share.js",
  "./src/team-builder/team-builder-battle-link.js",
  "./src/compendium/compendium-model.js",
  "./src/compendium/move-reference.js",
  "./src/compendium/quick-reference.js",
  "./src/compendium/pokemon-reference.js",
  "./src/compendium/fast-move-timing.js",
  "./src/compendium/judge-essentials.js",
  "./src/compendium/compendium-routing.js",
  "./src/scenario/scenario-model.js",
  "./src/scenario/manual-battle-state.js",
  "./src/scenario/technical-review-model.js",
  "./src/battle/charged-move-collection.js",
  "./src/battle/pokemon-form.js",
  "./src/battle/turn-resolution-engine.js",
  "./src/battle/manual-battle-timing.js",
  "./src/battle/manual-switching.js",
  "./src/battle/manual-mode.js",
  "./src/battle/manual-action.js",
  "./src/battle/manual-runtime.js",
  "./src/battle/manual-hybrid.js",
  "./src/battle/manual-timeline.js",
  "./src/battle/manual-branches.js",
  "./src/battle/scenario-comparison.js",
  "./src/battle/manual-scenario-io.js",
  "./src/battle/manual-scenario-share.js",
  "./src/battle/manual-scenario-library.js",
  "./src/battle/energy-trainer.js",
  "./src/training/fast-count-engine.js",
  "./src/training/fast-count-trainer.js",
  "./src/training/fast-count-trainer.css",
  "./src/battle/manual-snapshots.js",
  "./src/battle/matchup-planner.js",
  "./src/battle/matchup-planner-adapter.js",
  "./src/battle/battle-principles.js",
  "./src/battle/battle-intelligence.js"
];

// Warm only the current data after the shell. Reuse browser HTTP cache for
// downloads already started by the page, while preserving first-visit offline use.
const RANKING_ASSETS = [
  "./data/great-league-rankings.js?v=20260916-v45-score-v5-meta2",
  "./data/great-league-ranking-details.js?v=20260916-v45-score-v5-meta2",
  "./data/great-league-role-rankings.json"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_ASSETS.map(async asset => {
      const request = new Request(new URL(asset, self.location.href), { cache: "reload" });
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response);
    }));
    for (const asset of RANKING_ASSETS) {
      try {
        const request = new Request(new URL(asset, self.location.href), { cache: "force-cache" });
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response);
      } catch (_) { /* A failed warmup must not prevent the shell from installing. */ }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(`${CACHE_PREFIX}-`) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await cache.match("./PogoPvp.html");
      if (shell) return shell;
    }
    throw error;
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});
