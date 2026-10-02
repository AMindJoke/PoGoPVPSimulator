"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");
const loader = fs.readFileSync(path.join(__dirname, "..", "data/seasons/season-generated-loader.js"), "utf8");
const metaDefinition = fs.readFileSync(path.join(__dirname, "..", "data/great-league-meta.json"), "utf8");
const TeamMeta = require('../src/team-builder/team-builder-meta');
const origin = "https://test.example";
const handlers = {};
const stores = new Map();
const calls = [];
let offline = false;
function key(input) { return new URL(input.url || input, `${origin}/`).href; }
const cacheApi = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const entries = stores.get(name);
    return {
      async put(request, response) { entries.set(key(request), response.clone()); },
      async match(request, options = {}) {
        const requested = key(request);
        if (entries.has(requested)) return entries.get(requested).clone();
        if (options.ignoreSearch) {
          const found = [...entries.keys()].find(url => url.split("?")[0] === requested.split("?")[0]);
          if (found) return entries.get(found).clone();
        }
      }
    };
  },
  async keys() { return [...stores.keys()]; },
  async delete(name) { return stores.delete(name); }
};
const context = {
  URL, Request, Response, caches: cacheApi,
  fetch: async request => {
    calls.push(key(request));
    if (offline) throw new Error("Offline");
    const pathname=new URL(key(request)).pathname;
    return new Response(pathname === "/PogoPvp.html" ? app : pathname === '/data/great-league-meta.json' ? metaDefinition : key(request));
  },
  self: {
    location: { origin, href: `${origin}/sw.js` },
    addEventListener: (type, handler) => { handlers[type] = handler; },
    skipWaiting: async () => {}, clients: { claim: async () => {} }
  }
};
vm.createContext(context);
vm.runInContext(source, context);
async function lifecycle(type) {
  let pending;
  handlers[type]({ waitUntil: promise => { pending = promise; } });
  await pending;
}
async function request(url, options = {}) {
  let pending;
  handlers.fetch({ request: { url: new URL(url, origin).href, method: "GET", mode: "cors", cache: "default", ...options }, respondWith: promise => { pending = promise; } });
  return pending;
}
(async () => {
  await cacheApi.open("pogo-pvp-simulator-old");
  await cacheApi.open("another-app-cache");
  await lifecycle("install");
  const rankVersion = loader.match(/currentAssetVersion = "([^"]+)"/)[1];
  const roleUrl = app.match(/metaRoleRankingDataUrl = "([^"]+)"/)[1];
  assert.ok(calls.includes(`${origin}/data/great-league-rankings.js?v=${rankVersion}`));
  assert.ok(calls.includes(`${origin}/${roleUrl}`), "App and offline cache must share the role version.");
  assert.ok(!calls.some(url => url.includes("/seasons/twilight-trails/")), "Do not download duplicate inactive data.");
  await lifecycle("activate");
  assert.ok(!stores.has("pogo-pvp-simulator-old"));
  assert.ok(stores.has("another-app-cache"));
  calls.length = 0;
  const css = app.match(/href="([^"]+\.css\?v=[^"]+)"/)[1];
  await request(`/${css}`);
  await request(`/data/great-league-rankings.js?v=${rankVersion}`);
  await request(`/${roleUrl}`);
  assert.equal(calls.length, 0, "A warm opening serves exact-version assets without the network.");
  await request(`/${roleUrl}`, { cache: "reload" });
  assert.equal(calls.length, 1, "Explicit Refresh must reach the network.");
  await request("/PogoPvp.html?view=meta", { mode: "navigate" });
  assert.equal(calls.length, 2, "Navigation checks for updates.");
  await request("/data/great-league-rankings.js?v=next-release");
  assert.equal(calls.length, 3, "A new version must be downloaded.");
  offline = true;
  const offlineMeta=TeamMeta.createRegistry({fetcher:url=>request('/'+url)});
  const field=await offlineMeta.load(TeamMeta.DEFAULT_PROVIDER_ID);
  assert.ok(field.pokemonIds.length>0,'The Team Builder field must load offline after installation, even before its first visit.');
  await request(`/${css}`);
  await request(`/data/great-league-rankings.js?v=${rankVersion}`);
  await request("/PogoPvp.html?view=analysis", { mode: "navigate" });
  await assert.rejects(request("/data/great-league-rankings.js?v=unknown-release"), /Offline/);
  await request("/src/season/season-context.js");
  const beforeExternal = calls.length;
  assert.equal(await request("https://external.example/resource.js?v=1"), undefined);
  assert.equal(calls.length, beforeExternal);
  console.log("Service worker tests passed: exact versions, zero-network warm assets, Refresh, updates, offline, scoped cleanup.");
})().catch(error => { console.error(error); process.exitCode = 1; });
