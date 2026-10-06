"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const groups = [
  ["Live worker: mirrors, CMP, Fast timing, energy, shields", ["test-battle-reference-mechanics"]],
  ["Turn resolution and pending impacts", ["test-turn-resolution-engine", "test-pending-fast-mechanics", "test-dre-timing-guards"]],
  ["Switches, post-Charged zero-turn window and persistence", ["test-manual-switching", "test-post-charged-switch-timing", "test-manual-battle-timing"]],
  ["Simultaneous KO and special forms", ["test-matrix-simultaneous-draw", "test-special-form-mechanics"]],
  ["Diagnostic isolation", ["test-continuation-isolation"]],
  ["Same matchup across Team Builder, Quick and Battle", ["test-counter-alignment-shields", "test-team-role-readability", "test-navigation-matchup-parity"]],
  ["Selected strategic decisions and legal alternatives", ["test-automatic-battle-quality"]]
];

const summary = { generatedAt: new Date().toISOString(), passed: true, checks: [] };
for (const [group, scripts] of groups) {
  for (const script of scripts) {
    const start = performance.now();
    const run = spawnSync(process.execPath, [path.join(__dirname, `${script}.js`)], {
      cwd: root, encoding: "utf8", timeout: 180000, maxBuffer: 8 * 1024 * 1024,
      windowsHide: true
    });
    const passed = run.status === 0 && !run.error;
    summary.passed &&= passed;
    summary.checks.push({ group, script, passed, durationMs: Math.round(performance.now() - start),
      output: `${run.stdout || ""}${run.stderr || ""}`, error: run.error?.message || null });
    console.log(`${passed ? "PASS" : "FAIL"} ${group} / ${script}`);
    if (!passed) console.error(summary.checks.at(-1).output, run.error?.message || "");
  }
}
const reportRoot = path.join(root, "reports", "battle-reference-checks");
fs.mkdirSync(reportRoot, { recursive: true });
fs.writeFileSync(path.join(reportRoot, "latest.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(`${summary.checks.filter(check => check.passed).length}/${summary.checks.length} checks passed. Report: reports/battle-reference-checks/latest.json`);
console.log("These checks cover named mechanics and selected decisions, not every possible strategy or live-game latency.");
if (!summary.passed) process.exitCode = 1;
