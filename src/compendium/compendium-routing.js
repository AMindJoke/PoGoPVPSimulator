(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakCompendiumRouting = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CATEGORY_PARAM = "compendium";
  const ITEM_PARAM = "item";
  const CATEGORIES = Object.freeze(["home", "quick-reference", "moves", "pokemon", "timing-visualizer", "mechanics", "rulings", "glossary"]);
  const ITEM_CATEGORIES = Object.freeze(["moves", "pokemon", "mechanics", "rulings", "glossary"]);
  const ITEM_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function parseUrl(locationLike) {
    const href = typeof locationLike === "string" ? locationLike : locationLike?.href;
    if (href) return new URL(href, "https://local.invalid/");
    return new URL(`${locationLike?.pathname || "/"}${locationLike?.search || ""}${locationLike?.hash || ""}`, "https://local.invalid/");
  }

  function normalizeRoute(route) {
    const category = String(route?.category || "").trim().toLowerCase();
    if (!CATEGORIES.includes(category)) return null;
    const rawItem = String(route?.item || "").trim().toLowerCase();
    const item = ITEM_CATEGORIES.includes(category) && ITEM_PATTERN.test(rawItem) ? rawItem : null;
    return Object.freeze({ category, item });
  }

  function readLocation(locationLike) {
    const url = parseUrl(locationLike);
    if (!url.searchParams.has(CATEGORY_PARAM)) return null;
    return normalizeRoute({
      category: url.searchParams.get(CATEGORY_PARAM),
      item: url.searchParams.get(ITEM_PARAM)
    });
  }

  function buildUrl(locationLike, route) {
    const normalized = normalizeRoute(route);
    if (!normalized) throw new Error("COMPENDIUM_ROUTE_INVALID");
    const url = parseUrl(locationLike);
    url.searchParams.set(CATEGORY_PARAM, normalized.category);
    if (normalized.item) url.searchParams.set(ITEM_PARAM, normalized.item);
    else url.searchParams.delete(ITEM_PARAM);
    // These routes open different first-class workspaces and cannot safely be
    // combined with a Compendium destination.
    url.searchParams.delete("tbBattle");
    url.hash = "";
    return url.toString();
  }

  function locationWithoutCompendium(locationLike) {
    const url = parseUrl(locationLike);
    url.searchParams.delete(CATEGORY_PARAM);
    url.searchParams.delete(ITEM_PARAM);
    return url.toString();
  }

  return Object.freeze({
    CATEGORY_PARAM,
    ITEM_PARAM,
    CATEGORIES,
    ITEM_CATEGORIES,
    normalizeRoute,
    readLocation,
    buildUrl,
    locationWithoutCompendium
  });
});
