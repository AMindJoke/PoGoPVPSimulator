const assert = require("node:assert/strict");
const Meta = require("../src/team-builder/team-builder-meta.js");

assert.equal(Meta.DEFAULT_PROVIDER_ID, "great-league-current");
assert.deepEqual(Meta.SHIELD_SCENARIOS, ["0-0", "1-1", "2-2"]);
assert.equal(Meta.normalizeShieldScenario("2-2"), "2-2");
assert.equal(Meta.normalizeShieldScenario("1-0"), "1-1", "Unsupported shield states must fall back safely.");

async function run() {
  let requests = 0;
  const registry = Meta.createRegistry({
    fetcher: async url => {
      requests += 1;
      assert.equal(url, "data/great-league-meta.json");
      return { ok: true, json: async () => ({ league: "great", cpCap: 1500, description: "Test meta", pokemon: ["azumarill", "dunsparce", "azumarill"] }) };
    }
  });
  assert.equal(registry.list("great").length, 1);
  assert.equal(registry.list("ultra").length, 0, "Providers must remain league-scoped.");
  const definition = await registry.load(Meta.DEFAULT_PROVIDER_ID);
  assert.deepEqual(definition.pokemonIds, ["azumarill", "dunsparce"], "Provider normalization must preserve order and remove duplicates.");
  assert.equal(definition.cpCap, 1500);
  assert.equal(await registry.load(Meta.DEFAULT_PROVIDER_ID), definition, "Loaded definitions must be cached.");
  assert.equal(requests, 1);
  await assert.rejects(() => registry.load("unknown"), /TEAM_META_PROVIDER_UNKNOWN/);
  console.log("Team Builder meta provider tests passed.");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
