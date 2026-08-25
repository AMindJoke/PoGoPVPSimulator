"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "PogoPvp.html"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
const serviceWorker = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const mark = fs.readFileSync(path.join(root, "assets", "go-pvp-mark.png"));
const pngDimensions = file => {
  const png = fs.readFileSync(path.join(root, "assets", file));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${file} must remain a PNG.`);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
};

assert.match(html, /<title>GO PvP Simulator<\/title>/);
assert.match(html, /apple-mobile-web-app-title" content="GO PvP Simulator"/);
assert.match(html, /class="app-go-lockup" aria-label="GO"[^>]*>[\s\S]{0,260}class="app-brand-mark"[^>]+src="assets\/go-pvp-mark\.png"[^>]+alt=""[^>]+aria-hidden="true"/);
assert.match(html, /class="app-franchise" aria-hidden="true">O<\/span><\/span><span class="app-wordmark">PvP <small>Simulator<\/small>/);
assert.match(html, /\.app-go-lockup\s*\{[\s\S]{0,150}gap: 2px;/);
assert.match(html, /\.app-brand-mark\s*\{[\s\S]{0,180}width: 32px;[\s\S]{0,100}height: 32px;/);
assert.match(html, /\.app-brand-mark\s*\{[\s\S]{0,260}border-radius: 50%;[\s\S]{0,90}background: rgba\(255, 255, 255, \.94\);/, "The dark mark must use a deliberate circular contrast surface, never a rectangular image background.");
assert.match(html, /@media \(max-width: 900px\)[\s\S]{0,900}\.app-brand-mark \{ width: 30px; height: 30px; flex-basis: 30px; \}/);
assert.doesNotMatch(html, /class="app-franchise">(?:Pokémon|GO)<\/span>/);
assert.match(index, /<title>GO PvP Simulator<\/title>/);
assert.equal(manifest.name, "GO PvP Simulator");
assert.equal(manifest.short_name, "GO PvP Simulator");
assert.match(serviceWorker, /"\.\/assets\/go-pvp-mark\.png"/, "The brand mark must remain available in the offline application shell.");
for (const size of [16, 32, 48]) {
  assert.deepEqual(pngDimensions(`go-pvp-favicon-${size}.png`), [size, size], `The ${size}px favicon must have exact dimensions.`);
}
for (const size of [180, 192, 512]) {
  assert.deepEqual(pngDimensions(`app-icon-${size}.png`), [size, size], `The ${size}px app icon must have exact dimensions.`);
}
assert.deepEqual([...mark.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], "Brand mark must remain a PNG.");
assert.equal(mark.readUInt32BE(16), 512, "Brand mark width must support high-DPI rendering.");
assert.equal(mark.readUInt32BE(20), 512, "Brand mark height must preserve its square aspect ratio.");
assert.equal(mark[25], 6, "Brand mark must use an RGBA PNG color type.");

console.log("GO PvP Simulator branding tests passed.");
