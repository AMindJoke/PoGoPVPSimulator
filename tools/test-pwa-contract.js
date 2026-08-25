const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");

assert.match(html, /<link rel="manifest" href="manifest\.webmanifest">/);
assert.match(html, /<meta name="theme-color" content="#156f8f">/);
assert.match(html, /<link rel="apple-touch-icon" href="assets\/app-icon-180\.png">/);
for (const size of [16, 32, 48]) {
  assert.match(html, new RegExp(`<link rel="icon" href="assets/go-pvp-favicon-${size}\\.png" sizes="${size}x${size}" type="image/png">`));
  assert.ok(fs.existsSync(path.join(root, "assets", `go-pvp-favicon-${size}.png`)), `Missing ${size}px GO favicon.`);
}
assert.doesNotMatch(html, /rel="icon" href="assets\/app-icon\.svg"/, "The browser tab must not retain the old generic PvP icon.");
assert.match(html, /navigator\.serviceWorker\.register\("\.\/sw\.js"\)/);

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
