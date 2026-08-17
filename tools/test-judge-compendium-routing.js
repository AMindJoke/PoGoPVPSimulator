const assert = require("assert");
const Routing = require("../src/compendium/compendium-routing.js");

assert.deepEqual(
  Routing.readLocation({ href: "https://example.test/PogoPvp.html?compendium=moves&item=incinerate" }),
  { category: "moves", item: "incinerate" }
);
assert.deepEqual(
  Routing.readLocation({ search: "?debugBattle=1&compendium=glossary&item=dre", pathname: "/PogoPvp.html" }),
  { category: "glossary", item: "dre" }
);
assert.deepEqual(
  Routing.readLocation({ search: "?compendium=quick-reference&item=ignored", pathname: "/" }),
  { category: "quick-reference", item: null },
  "Category-only destinations must ignore an item parameter."
);
assert.equal(Routing.readLocation({ search: "?compendium=unknown", pathname: "/" }), null);
assert.equal(Routing.readLocation({ search: "?compendium=moves&item=../bad", pathname: "/" })?.item, null);
assert.equal(Routing.readLocation({ search: "?debugBattle=1", pathname: "/" }), null);

const built = new URL(Routing.buildUrl(
  "https://example.test/PogoPvp.html?debugBattle=1&tbBattle=payload#team=old",
  { category: "rulings", item: "general-lag-review" }
));
assert.equal(built.searchParams.get("compendium"), "rulings");
assert.equal(built.searchParams.get("item"), "general-lag-review");
assert.equal(built.searchParams.get("debugBattle"), "1", "Unrelated query parameters must survive.");
assert.equal(built.searchParams.has("tbBattle"), false, "Conflicting direct-battle routes must be removed.");
assert.equal(built.hash, "", "Conflicting shared-workspace hashes must be removed.");

const cleared = new URL(Routing.locationWithoutCompendium(built));
assert.equal(cleared.searchParams.has("compendium"), false);
assert.equal(cleared.searchParams.has("item"), false);
assert.equal(cleared.searchParams.get("debugBattle"), "1");

assert.throws(() => Routing.buildUrl("https://example.test/", { category: "invalid" }), /COMPENDIUM_ROUTE_INVALID/);
console.log("Judge Compendium routing tests passed.");
