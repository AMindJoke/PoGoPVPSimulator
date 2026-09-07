"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const Season = require("../src/season/season-context.js");
const Promotion = require("../src/season/season-promotion.js");

const ROOT = path.resolve(__dirname, "..");

function readWindow(relative, name, globals = {}) {
  const context = { window: {}, console, ...globals };
  Object.entries(globals).forEach(([key, value]) => { context.window[key] = value; });
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, relative), "utf8"), context, { filename: relative });
  return context.window[name] || context[name];
}

function parseArgs(argv) {
  const args = { mode: "validate", corrections: null, confirmUnchanged: false, allowProvisional: false, requireGenerated: false };
  argv.forEach(arg => {
    if (arg.startsWith("--mode=")) args.mode = arg.slice(7);
    if (arg.startsWith("--corrections=")) args.corrections = path.resolve(ROOT, arg.slice(14));
    if (arg === "--confirm-unchanged") args.confirmUnchanged = true;
    if (arg === "--allow-provisional") args.allowProvisional = true;
    if (arg === "--require-generated") args.requireGenerated = true;
  });
  return args;
}

function loadInputs() {
  const preview = readWindow("data/seasons/next-season.js", "BATTLE_NEXT_SEASON");
  return {
    gameMaster: readWindow("battle-data.js", "BATTLE_GAMEMASTER"),
    catalog: readWindow("data/seasons/season-catalog.js", "BATTLE_SEASON_CATALOG", { BATTLE_NEXT_SEASON: preview }),
    preview
  };
}

function run(options = {}) {
  const inputs = loadInputs();
  const corrections = options.corrections && fs.existsSync(options.corrections)
    ? JSON.parse(fs.readFileSync(options.corrections, "utf8"))
    : {};
  const preview = Promotion.applyConfirmedCorrections(inputs.preview, corrections, {
    confirmUnchanged: options.confirmUnchanged
  });
  const validation = Promotion.validateFinalPreview(preview, inputs.gameMaster, {
    requireConfirmed: !options.allowProvisional,
    requireGenerated: options.requireGenerated
  });
  const promotedCatalog = Promotion.buildPromotedCatalog(inputs.catalog, preview);
  const plan = Promotion.buildPromotionPlan(preview);
  return {
    mode: options.mode,
    season: preview?.id || null,
    currentBefore: inputs.catalog?.current?.id || null,
    nextBefore: inputs.catalog?.next?.id || null,
    simulatedCurrentAfter: promotedCatalog.current.id,
    simulatedNextAfter: promotedCatalog.next,
    errors: validation.errors,
    warnings: validation.warnings,
    plan,
    writesPerformed: false
  };
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  const report = run(options);
  console.log(JSON.stringify(report, null, 2));
  if (report.errors.length && options.mode !== "simulate") process.exitCode = 1;
}

module.exports = { parseArgs, loadInputs, run };
