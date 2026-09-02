const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");
assert.match(html, /id="seasonBanner"[^>]*aria-live="polite"[^>]*hidden/, "The global preview banner must be dormant when no preview exists.");
assert.match(html, /function initSeasonControls\(\)[\s\S]*seasonContext\?\.previewAvailable[\s\S]*Return to Current Season[\s\S]*Go to Next Season/, "The global control must expose both season directions only when a preview is valid.");
assert.match(html, /document\.body\.dataset\.season = activeSeasonData\.status/, "Every major view must retain a subtle machine-readable active-season indicator.");
assert.match(html, /activeSeasonData\.status === "preview" \? activeSeasonData\.moveMetadata/, "Compendium preview metadata must never appear in Current Season.");
assert.match(html, /Preview value · Estimated/, "Estimated preview values need a text indicator that does not rely on color.");
assert.match(html, /seasonIdentity: activeSeasonData\.identity/g);
assert.doesNotMatch(html, /const gm = window\.BATTLE_GAMEMASTER;/, "The application runtime must consume the resolved season dataset.");
console.log("Season UI contract tests passed.");
