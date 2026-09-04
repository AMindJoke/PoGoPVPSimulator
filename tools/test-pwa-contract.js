const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const battleReliability = fs.readFileSync(path.join(root, "src", "reliability", "battle-reliability.js"), "utf8");

assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
assert.match(html, /<meta name="theme-color" content="#156f8f">/);
assert.match(html, /<link rel="apple-touch-icon" href="assets\/app-icon-180\.png">/);
for (const size of [16, 32, 48]) {
  assert.match(html, new RegExp(`<link rel="icon" href="assets/go-pvp-favicon-${size}\\.png" sizes="${size}x${size}" type="image/png">`));
  assert.ok(fs.existsSync(path.join(root, "assets", `go-pvp-favicon-${size}.png`)), `Missing ${size}px GO favicon.`);
}
assert.doesNotMatch(html, /rel="icon" href="assets\/app-icon\.svg"/, "The browser tab must not retain the old generic PvP icon.");
assert.match(html, /navigator\.serviceWorker\.register\("\.\/sw\.js\?v=20260904-v23"\)/);

assert.match(html, /\* \{ box-sizing: border-box; \}/,
  "The page must retain its global layout reset.");
assert.match(html, /body \{\s*margin: 0;/,
  "The page must retain its base body layout styles.");
assert.match(html, /\.pokemon-arena-bg \{\s*position: fixed;/,
  "The decorative arena must not occupy document flow and hide the app below the fold.");
assert.match(html, /#homeView, #simulatorView, #metaView, #analysisView, #teamBuilderView, #compendiumView \{ display: none; \}/,
  "The application view visibility contract must remain present.");
assert.match(html, /event\.fastImpactStatus === "denied"[\s\S]*Number\(event\.hpAfter/,
  "Denied pending Fast impacts must not render as duplicate KO markers.");
assert.doesNotMatch(html, /--accent: #2c8bedeg/,
  "Malformed dark-theme CSS must not replace the base application styles.");

const plannerVersion = battleReliability.match(/BATTLE_ENGINE_VERSION = "battle-planner-v(\d+)"/)?.[1];
assert.ok(plannerVersion, "The battle engine must expose a numeric planner version.");
assert.match(html, new RegExp(`src/battle/battle-intelligence\\.js\\?v=\\d+-planner-v${plannerVersion}`),
  "The page cache-buster must stay aligned with the current battle engine version.");
assert.match(html, new RegExp(`src/reliability/battle-reliability\\.js\\?v=\\d+-planner-v${plannerVersion}`),
  "The reliability cache-buster must stay aligned with the current battle engine version.");

assert.strictEqual(manifest.start_url, "./PogoPvp.html");
assert.strictEqual(manifest.display, "standalone");
assert.ok(manifest.icons.some(icon => icon.sizes === "192x192"));
assert.ok(manifest.icons.some(icon => icon.sizes === "512x512" && icon.purpose.includes("maskable")));
for (const icon of manifest.icons) {
  assert.ok(fs.existsSync(path.join(root, icon.src)), `Missing manifest icon: ${icon.src}`);
}

assert.match(serviceWorker, /request\.mode === "navigate"/);
assert.match(serviceWorker, /"\.\/assets\/go-pvp-favicon-32\.png"/, "The GO favicon must be available offline.");
assert.match(serviceWorker, /"\.\/assets\/paper-grain\.svg"/, "The light-theme paper grain must be available offline.");
assert.match(serviceWorker, /cache\.match\(request, \{ ignoreSearch: true \}\)/);
assert.match(serviceWorker, /cache\.match\("\.\/PogoPvp\.html"\)/);
assert.doesNotMatch(serviceWorker, /cache\.addAll\(/, "One optional asset must not abort the whole install.");

const coreBlock = serviceWorker.match(/const CORE_ASSETS = \[([\s\S]*?)\];/);
assert.ok(coreBlock, "The service worker must declare its offline shell.");
for (const [, asset] of coreBlock[1].matchAll(/"\.\/(.*?)"/g)) {
  if (!asset) continue;
  assert.ok(fs.existsSync(path.join(root, asset)), `Missing cached shell asset: ${asset}`);
}

console.log("PWA contract tests passed.");
