"use strict";

const fs = require("fs");
const path = require("path");
const { summarizeDataset } = require("../src/analysis/offline-analysis");

const ROOT = path.resolve(__dirname, "..");
const inputArg = process.argv.find(arg => arg.startsWith("--input="));
const outputArg = process.argv.find(arg => arg.startsWith("--output="));
const inputPath = inputArg ? inputArg.split("=").slice(1).join("=") : "data/great-league-rankings.json";
const outputPath = outputArg ? outputArg.split("=").slice(1).join("=") : "data/analysis/great-league-analysis.json";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const file = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return fs.statSync(file).size;
}

const dataset = readJson(inputPath);
const summary = summarizeDataset(dataset, {
  league: "great",
  format: "open",
  shieldState: "1-1"
});
const size = writeJson(outputPath, summary);
console.log(`Wrote ${outputPath} (${size.toLocaleString()} bytes).`);
console.log(`Analyzed ${summary.count.toLocaleString()} ranking entries.`);
