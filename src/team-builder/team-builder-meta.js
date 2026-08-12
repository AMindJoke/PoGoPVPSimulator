(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakTeamBuilderMeta = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_PROVIDER_ID = "great-league-current";
  const SHIELD_SCENARIOS = Object.freeze(["0-0", "1-1", "2-2"]);
  const PROVIDERS = Object.freeze({
    [DEFAULT_PROVIDER_ID]: Object.freeze({
      id: DEFAULT_PROVIDER_ID,
      name: "Current Great League Meta",
      description: "Curated competitive Great League field.",
      league: "great",
      cpCap: 1500,
      sourceUrl: "data/great-league-meta.json",
      shieldScenarios: SHIELD_SCENARIOS
    })
  });

  function normalizeShieldScenario(value) {
    return SHIELD_SCENARIOS.includes(value) ? value : "1-1";
  }

  function normalizeDefinition(payload, provider) {
    if (!payload || payload.league !== provider.league || !Array.isArray(payload.pokemon)) {
      throw new Error("TEAM_META_INVALID");
    }
    return Object.freeze({
      providerId: provider.id,
      league: provider.league,
      cpCap: Number(payload.cpCap || provider.cpCap),
      description: provider.description,
      pokemonIds: Object.freeze([...new Set(payload.pokemon.filter(Boolean).map(String))]),
      shieldScenarios: provider.shieldScenarios
    });
  }

  function createRegistry(options = {}) {
    const fetcher = options.fetcher || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    const cache = new Map();
    return Object.freeze({
      list(league) {
        return Object.values(PROVIDERS).filter(provider => !league || provider.league === league);
      },
      get(providerId) {
        return PROVIDERS[providerId] || null;
      },
      async load(providerId) {
        const provider = PROVIDERS[providerId];
        if (!provider) throw new Error("TEAM_META_PROVIDER_UNKNOWN");
        if (cache.has(providerId)) return cache.get(providerId);
        if (!fetcher) throw new Error("TEAM_META_FETCH_UNAVAILABLE");
        const response = await fetcher(provider.sourceUrl);
        if (!response?.ok) throw new Error("TEAM_META_LOAD_FAILED");
        const definition = normalizeDefinition(await response.json(), provider);
        cache.set(providerId, definition);
        return definition;
      },
      clear() { cache.clear(); }
    });
  }

  return Object.freeze({
    DEFAULT_PROVIDER_ID,
    SHIELD_SCENARIOS,
    PROVIDERS,
    normalizeShieldScenario,
    normalizeDefinition,
    createRegistry
  });
});
