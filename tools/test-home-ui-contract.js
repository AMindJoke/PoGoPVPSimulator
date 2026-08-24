const assert = require("assert");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");

function includes(fragment, message) {
  assert.ok(html.includes(fragment), message || `Missing Home contract: ${fragment}`);
}

includes('<body class="clarity-ui" data-view="home">', "Home must be the static default before application initialization.");
includes('id="homeTab"');
includes('data-view-target="home"');
includes('id="homeView"');
includes('body[data-view="home"] #homeView');
includes('id="homePrimaryTitle"');
includes('What do you want to do?');
assert.ok(!html.includes('id="homeHeroTitle"'), "The Home must lead directly with its tools instead of a large promotional hero.");
includes('data-home-target="scenario-review"');
includes('data-home-target="compendium"');
includes('data-home-target="simulator"');
includes('data-home-target="team-builder"');
includes('data-home-target="meta"');
includes('data-home-target="analysis"');
includes('home-tool-grid-primary');
includes('home-tool-grid-secondary');
includes('home-quick-start');
includes('Not affiliated with Niantic, The Pokémon Company or Play! Pokémon.');

includes('const supportedAppViews = new Set(["home"');
includes('function readAppViewFromLocation(locationLike = window.location)');
includes('function appViewUrl(view, locationLike = window.location)');
includes('function navigateAppView(view, options = {})');
includes('url.searchParams.delete("compendium")');
includes('else if (!loadCompendiumFromLocation()) setAppView(readAppViewFromLocation() || "home")');
includes('event.state?.appView || readAppViewFromLocation() || "home"');
includes('button.onclick = () => navigateAppView(button.dataset.homeTarget)');
includes('button.setAttribute("aria-current", "page")');

includes('.home-tool-card:focus-visible');
includes('@media (max-width: 900px)');
includes('overflow-x: auto;', "Mobile navigation must remain discoverable without overflowing the page.");
includes('.home-tool-grid-primary,\n      .home-tool-grid-secondary { grid-template-columns: 1fr;');
includes('var(--panel)');
includes('var(--ink)');
includes('var(--line)');

const homeTargets = [...html.matchAll(/data-home-target="([^"]+)"/g)].map(match => match[1]);
assert.deepStrictEqual(
  new Set(homeTargets),
  new Set(["scenario-review", "compendium", "simulator", "team-builder", "meta", "analysis"]),
  "Home actions must expose all six first-class tools."
);

for (const id of ["simulatorTab", "scenarioReviewTab", "teamBuilderTab", "metaTab", "analysisTab", "compendiumTab"]) {
  includes(`id="${id}"`, `Existing navigation destination ${id} must remain available.`);
}

console.log("Home UI contract tests passed.");
