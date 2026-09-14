const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const html = read("PogoPvp.html");
const trainer = read("src/training/fast-count-trainer.js");
const styles = read("src/training/fast-count-trainer.css");
const serviceWorker = read("sw.js");

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
assert.match(trainer, /state\.difficulty !== "advanced"/);
assert.match(trainer, /state\.difficulty === "beginner"/);
assert.match(trainer, /state\.mode === "learn" \|\| state\.sessionDone/);

for (const width of [1050, 760, 430, 350]) {
  assert.match(styles, new RegExp(`max-width:\\s*${width}px`), `missing ${width}px responsive rule`);
}
assert.match(styles, /prefers-reduced-motion:\s*reduce/);
assert.match(styles, /grid-template-areas:\s*"center"\s*"context"\s*"side"/);
assert.match(styles, /\.fast-count-move-fast\s*\{\s*grid-column:\s*1 \/ -1/);

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
