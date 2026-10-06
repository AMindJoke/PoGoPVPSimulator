const CACHE_PREFIX = "pogo-pvp-simulator";
const CACHE_VERSION = "2026-10-06-v144-team-workspace";
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
  "./data/seasons/season-generated-loader.js?v=20261006-v124",
  "./data/seasons/next-season.js",
  "./data/seasons/season-catalog.js",
  "./src/season/season-context.js",
  "./data/compendium/mechanics.json",
  "./data/compendium/rulings.json",
  "./data/compendium/glossary.json",
  "./data/great-league-meta.json",
  "./src/performance/perf-debug.js",
  "./src/iv-optimization.js",
  "./src/reliability/battle-reliability.js",
  "./src/tactical/tactical-patterns.js",
  "./src/analysis/tactical-insights.js",
  "./src/analysis/win-condition-engine.js",
  "./src/analysis/win-condition-view-model.js",
  "./src/analysis/matchup-story.js",
  "./src/analysis/battle-review.js",
  "./src/analysis/battle-alternatives.js?v=20261006-v131",
  "./src/analysis/battle-sensitivity.js?v=20261005-v117",
  "./src/analysis/cmp-dependency.js?v=20261006-v131",
  "./src/ui/cmp-dependency.js?v=20261006-v131",
  "./src/ui/cmp-dependency.css?v=20261006-v132",
  "./src/ui/battle-alternatives.js?v=20261005-v117",
  "./src/ui/battle-alternatives.css?v=20261005-v117",
  "./src/analysis/iv-impact.js",
  "./src/analysis/ranking-details.js?v=20261006-v123",
  "./src/analysis/meta-quick-matchup.js?v=20261001-v73",
  "./src/ui/meta-quick-matchup.js?v=20261006-v124",
  "./src/ui/meta-quick-matchup.css?v=20261006-v123",
  "./src/analysis/pokemon-analysis-view-model.js",
  "./src/ui/pokemon-analysis.js",
  "./src/team-builder/team-builder-state.js",
  "./src/team-builder/team-builder-library.js?v=20261001-v74-v2",
  "./src/ui/team-library.js?v=20261001-v76",
  "./src/ui/team-library.css?v=20261001-v74-v3",
  "./src/team-builder/team-builder-meta.js",
  "./src/team-builder/team-builder-analysis.js?v=20261002-v107",
  "./src/team-builder/team-builder-matrix.css",
  "./src/team-builder/team-builder-presentation.css",
  "./src/meta-mobile.css",
  "./src/meta-desktop-presentation.css",
  "./src/ui/meta-desktop-presentation.js?v=20260930-v66",
  "./src/ui/analysis-scenario-presentation.css",
  "./src/ui/analysis-scenario-presentation.js",
  "./src/ui/home-presentation.css",
  "./src/ui/usability-refinements.css",
  "./src/ui/meta-theme-trial.css?v=20261006-v123",
  "./src/compendium/compendium-presentation.css",
  "./assets/team-builder-status-icons/win-hard.svg",
  "./assets/team-builder-status-icons/win-soft.svg",
  "./assets/team-builder-status-icons/loss-hard.svg",
  "./assets/team-builder-status-icons/loss-soft.svg",
  "./src/team-builder/team-builder-share.js?v=20261001-v74",
  "./src/team-builder/team-builder-battle-link.js?v=20261005-v117",
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
  "./src/battle/manual-battle-timing.js?v=20261006-v125",
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
  "./src/training/fast-count-trainer.js?v=20261001-v76-v2",
  "./src/training/fast-count-practice.js?v=20261001-v76",
  "./src/team-builder/team-builder-opponent.js?v=20261001-v92",
  "./src/team-builder/team-matchup-share.js?v=20261001-v92",
  "./src/team-builder/team-farm-battle-link.js?v=20261001-v94",
  "./src/team-builder/team-farm-presentation.js?v=20261001-v92",
  "./src/team-builder/team-builder-roles.js?v=20261005-v117",
  "./src/team-builder/team-opponent-context.js?v=20261006-v131",
  "./src/team-builder/team-role-analysis.js?v=20261006-v131",
  "./src/ui/team-roles.js?v=20261006-v144",
  "./src/ui/team-workspace.js?v=20261006-v144",
  "./src/ui/team-workspace.css?v=20261006-v144",
  "./src/ui/team-roles.css?v=20261006-v131",
  "./src/ui/team-opponent.js?v=20261006-v144",
  "./src/ui/team-opponent.css?v=20261005-v119",
  "./src/ui/pokemon-favorites.js?v=20261001-v76",
  "./src/ui/pokemon-favorites.css?v=20261001-v76",
  "./src/training/fast-count-trainer.css?v=20261001-v76",
  "./src/battle/manual-snapshots.js",
  "./src/battle/matchup-planner.js",
  "./src/battle/matchup-planner-adapter.js",
  "./src/battle/battle-principles.js",
  "./src/battle/battle-intelligence.js"
];

// Warm only the current data after the shell. Reuse browser HTTP cache for
// downloads already started by the page, while preserving first-visit offline use.
const RANKING_ASSETS = [
  "./data/great-league-rankings.js?v=20261006-v124-rankings",
  "./data/great-league-ranking-details.js?v=20261006-v124-rankings",
  "./data/great-league-role-rankings.json?v=20260930-role-v1"
];

async function cacheVersionedCoreAssets(cache) {
  const shell = await cache.match(new URL("./PogoPvp.html", self.location.href));
  if (!shell) return;
  const html = await shell.text();
  const corePaths = new Set(CORE_ASSETS.map(asset => new URL(asset, self.location.href).pathname));
  // Alias only the exact versions advertised by this release's cached HTML.
  for (const match of html.matchAll(/(?:src|href)="([^"]+\?v=[^"]+)"/g)) {
    const url = new URL(match[1], self.location.href);
    if (url.origin !== self.location.origin || !corePaths.has(url.pathname)) continue;
    const canonical = new URL(url.pathname, self.location.href);
    const response = await cache.match(canonical);
    if (response) await cache.put(new Request(url), response);
  }
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(CORE_ASSETS.map(async asset => {
      const request = new Request(new URL(asset, self.location.href), { cache: "reload" });
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response);
    }));
    await cacheVersionedCoreAssets(cache);
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
    // A different explicit version must never receive an older cached dataset.
    const cached = await cache.match(request, { ignoreSearch: !new URL(request.url).searchParams.has("v") });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await cache.match("./PogoPvp.html");
      if (shell) return shell;
    }
    throw error;
  }
}

async function versionedAssetFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response?.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const versionedAsset = request.mode !== "navigate"
    && url.searchParams.get("v")
    && /\.(?:js|css|json|png|svg|webp|woff2?)$/i.test(url.pathname);
  const forceNetwork = request.cache === "reload" || request.cache === "no-store" || request.cache === "no-cache";
  event.respondWith(versionedAsset && !forceNetwork ? versionedAssetFirst(request) : networkFirst(request));
});
