const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const html = read("PogoPvp.html");
const trainer = read("src/training/fast-count-trainer.js");
const styles = read("src/training/fast-count-trainer.css");
const serviceWorker = read("sw.js");
const specimen = read("FastCount-UI-Foundation.html");

assert.match(html, /src\/training\/fast-count-engine\.js/);
assert.match(html, /src\/training\/fast-count-trainer\.js/);
assert.match(html, /src\/training\/fast-count-trainer\.css/);
assert.match(html, /id="fastCountTrainerView"/);
assert.match(html, /data-view-target="fast-count-trainer"/);
assert.match(html, /renderFastCountTrainer/);
assert.match(html, /supportedAppViews\s*=\s*new Set\([^\n]*"fast-count-trainer"/);

for (const mode of ["learn", "guided", "memory", "mixed", "meta", "shortcut"]) {
  assert.match(trainer, new RegExp(`id:\\s*"${mode}"`), `missing ${mode} mode`);
}
for (const difficulty of ["beginner", "intermediate", "advanced"]) {
  assert.match(trainer, new RegExp(`id:\\s*"${difficulty}"`), `missing ${difficulty} difficulty`);
}
assert.match(trainer, /SESSION_LENGTH\s*=\s*10/);
assert.match(trainer, /go-judge-hub-fast-count-trainer-v1/);
assert.match(trainer, /data-fast-count-answer/);
assert.match(trainer, /Number\(event\.key\)\s*-\s*1/);
assert.match(trainer, /data-fast-count-pokemon-search/);
assert.match(trainer, /role="combobox"/);
assert.match(trainer, /role="listbox"/);
assert.match(trainer, /ArrowDown/);
assert.match(trainer, /data-fast-count-open-mode/);
assert.match(trainer, /fast-count-mode-trigger-copy[^>]*><small>Mode:<\/small>/,
  "The compact mode selector must explain that its current value changes the practice mode.");
assert.match(trainer, /fast-count-mode-sheet/);
assert.match(trainer, /role="dialog" aria-modal="true"/);
assert.match(trainer, /data-fast-count-open-details/);
assert.match(trainer, /fast-count-details-sheet/);
assert.match(trainer, /event\.key === "Escape"/);
assert.match(trainer, /event\.key === "Tab"/);
assert.match(trainer, /button:not\(\[disabled\]\), input:not\(\[disabled\]\), select:not\(\[disabled\]\), summary/);
assert.match(trainer, /fast-count-feedback-result/);
assert.match(trainer, /fast-count-equation/);
assert.match(trainer, /fast-count-move-kind/);
assert.match(trainer, /--fast-move-color:/);
assert.match(trainer, /state\.difficulty !== "advanced"/);
assert.match(trainer, /state\.difficulty === "beginner"/);
assert.match(trainer, /state\.mode === "learn" \|\| state\.sessionDone/);

for (const width of [900, 760, 430, 350]) {
  assert.match(styles, new RegExp(`max-width:\\s*${width}px`), `missing ${width}px responsive rule`);
}
assert.match(styles, /prefers-reduced-motion:\s*reduce/);
assert.match(styles, /grid-template-columns:\s*minmax\(470px, 1\.7fr\) minmax\(245px, \.72fr\)/);
assert.match(styles, /\.fast-count-mode-bar\s*\{\s*display:\s*none/);
assert.match(styles, /\.fast-count-workspace > \.fast-count-side\s*\{\s*display:\s*none/);
assert.match(styles, /max-height:\s*min\(88dvh, 760px\)/);
assert.match(styles, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
for (const token of ["space-1", "space-6", "radius-sm", "radius-lg", "control-sm", "control-md", "control-lg", "font-xs", "font-title", "border-width", "surface-raised", "success-soft", "focus-ring", "shadow-md"]) {
  assert.match(styles, new RegExp(`--ui-${token}:`), `missing UI foundation token: ${token}`);
}
for (const primitive of ["ui-button--primary", "ui-button--secondary", "ui-button--ghost", "ui-button--danger", "ui-surface--card", "ui-surface--emphasis", "ui-feedback--success", "ui-answer", "ui-bank-cells", "ui-move-row"]) {
  assert.match(specimen, new RegExp(primitive), `specimen is missing ${primitive}`);
}
assert.match(specimen, /src\/training\/fast-count-trainer\.css/);
assert.match(html, /fast-count-trainer\.css\?v=20260915-readability-v1/);
assert.match(html, /fast-count-trainer\.js\?v=20260915-readability-v1/);
assert.doesNotMatch(html, /FastCount-UI-Foundation\.html/, "The specimen must remain direct-URL only.");
assert.doesNotMatch(serviceWorker, /FastCount-UI-Foundation\.html/, "The specimen must not enter the production offline shell.");
for (const source of [...specimen.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(Boolean)) new Function(source);
assert.doesNotMatch(styles, /font-size:\s*(?:7|8|9|11|13|15|17|19|23|25|27|29|34)px/, "Typography must use the foundation scale.");
assert.doesNotMatch(styles, /gap:\s*(?:5|6|7|9|10|11|13|14|17|19)px/, "Spacing must use the foundation scale.");
assert.doesNotMatch(styles, /min-height:\s*(?:38|39|42|44|46|49|50|58|61|62|70)px/, "Controls must use the foundation size system.");

for (const asset of [
  "src/training/fast-count-engine.js",
  "src/training/fast-count-trainer.js",
  "src/training/fast-count-trainer.css"
]) {
  assert.ok(serviceWorker.includes(asset), `service worker is missing ${asset}`);
}

const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .filter(Boolean);
for (const source of inlineScripts) new Function(source);

console.log("Fast Count Trainer UI contract tests passed.");
