"use strict";

const fs = require("fs");
const path = require("path");
const {
  BATTLE_PRINCIPLES,
  PRINCIPLE_REGISTRY_VERSION,
  PRINCIPLE_PRIORITY_GROUPS,
  validateBattlePrincipleRegistry
} = require("../src/battle/battle-principles");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "docs", "BATTLE_PRINCIPLE_REGISTRY.md");

function priorityName(value) {
  return Object.entries(PRINCIPLE_PRIORITY_GROUPS).find(([, priority]) => priority === value)?.[0] || String(value);
}

function list(values) {
  return values.map(value => `\`${value}\``).join(", ");
}

function render() {
  const validation = validateBattlePrincipleRegistry();
  const lines = [
    "# Battle Principle Registry",
    "",
    `Registry version: \`${PRINCIPLE_REGISTRY_VERSION}\``,
    "",
    "This file is generated from `src/battle/battle-principles.js`. Do not edit it without updating the code registry.",
    "",
    "## Validation",
    "",
    `- valid: \`${validation.valid}\``,
    `- principle count: \`${validation.count}\``,
    `- errors: ${validation.errors.length ? validation.errors.map(error => `\`${error}\``).join(", ") : "`none`"}`,
    "",
    "## Priority Groups",
    "",
    ...Object.entries(PRINCIPLE_PRIORITY_GROUPS).map(([name, value]) => `- \`${value}\` ${name}`),
    "",
    "## Principles",
    ""
  ];

  for (const item of BATTLE_PRINCIPLES) {
    lines.push(
      `### ${item.id} - ${item.name}`,
      "",
      `- category: \`${item.category}\``,
      `- ownerLayer: \`${item.ownerLayer}\``,
      `- priority: \`${priorityName(item.priority)}\``,
      `- status: \`${item.status}\``,
      `- condition: ${item.condition}`,
      `- output: \`${item.output}\``,
      `- allowedOutputs: ${list(item.allowedOutputs)}`,
      `- reasonCodes: ${list(item.reasonCodes)}`,
      `- inputs: ${list(item.inputs)}`,
      `- forbiddenSideEffects: ${list(item.forbiddenSideEffects)}`,
      `- tests: ${list(item.tests)}`,
      "",
      item.description,
      ""
    );
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  fs.writeFileSync(OUTPUT, render(), "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
}

if (require.main === module) main();

module.exports = { render, main, OUTPUT };
