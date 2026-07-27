"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const PINNED_PVPOKE_REVISION = "5e1e3d971369a47aaf3e7247f50710d80205d570";
const REQUIRED_MODULES = Object.freeze([
  "src/js/battle/DamageCalculator.js",
  "src/js/battle/timeline/TimelineAction.js",
  "src/js/battle/actions/ActionLogic.js"
]);

function createPvPokeReference(options = {}) {
  const repoPath = path.resolve(options.repoPath || path.join(__dirname, "..", "vendor", "pvpoke"));
  const revision = options.revision || PINNED_PVPOKE_REVISION;
  validateReferenceDirectory(repoPath, revision);

  const loadedModules = [];
  const context = createReferenceContext();
  for (const relativePath of REQUIRED_MODULES) {
    const absolutePath = path.join(repoPath, relativePath);
    const source = fs.readFileSync(absolutePath, "utf8");
    const expose = exposeStatement(relativePath);
    vm.runInContext(
      `${source}\n;${expose}`,
      context,
      { filename: absolutePath }
    );
    loadedModules.push(relativePath);
  }

  if (!context.ActionLogic || typeof context.ActionLogic.decideAction !== "function") {
    throw new Error("Pinned PvPoke ActionLogic did not expose decideAction().");
  }

  return Object.freeze({
    repoPath,
    revision,
    loadedModules,
    evaluateFirstAction(input = {}) {
      const translated = input.state?.pvpokeState || input.state || {};
      const side = input.side || "A";
      const actor = side === "B" ? translated.pokemon?.[1] : translated.pokemon?.[0];
      const opponent = side === "B" ? translated.pokemon?.[0] : translated.pokemon?.[1];
      if (!actor || !opponent) throw new Error(`PvPoke translated state is missing side ${side}.`);

      const battle = createBattleFacade(translated);
      const rawAction = context.ActionLogic.decideAction(battle, actor, opponent);
      return normalizePvPokeAction(rawAction, actor, battle, revision);
    },
    wouldShield(input = {}) {
      const translated = input.state?.pvpokeState || input.state || {};
      const attacker = input.attacker || translated.pokemon?.[0];
      const defender = input.defender || translated.pokemon?.[1];
      const move = input.move;
      if (!attacker || !defender || !move) throw new Error("wouldShield requires attacker, defender and move.");
      const battle = createBattleFacade(translated);
      const raw = context.ActionLogic.wouldShield(battle, attacker, defender, move);
      return {
        actionType: raw?.value ? "shield" : "no_shield",
        shield: raw?.value === true,
        moveId: move.moveId || move.id || null,
        wait: false,
        sourceBranch: null,
      reason: "actual PvPoke ActionLogic.wouldShield()",
      rawAction: raw,
      decisionLog: battle.getDecisionLog(),
      referenceRevision: revision
      };
    }
  });
}

function validateReferenceDirectory(repoPath, revision) {
  const marker = path.join(repoPath, ".pinned-revision");
  if (!fs.existsSync(marker)) {
    throw new Error(`PvPoke reference is not set up. Run npm run setup:pvpoke-reference. Missing ${marker}`);
  }
  const found = fs.readFileSync(marker, "utf8").trim();
  if (found !== revision) {
    throw new Error(`Invalid PvPoke reference revision: expected ${revision}, found ${found || "<empty>"}.`);
  }
  for (const relativePath of REQUIRED_MODULES) {
    const absolutePath = path.join(repoPath, relativePath);
    if (!fs.existsSync(absolutePath)) throw new Error(`Pinned PvPoke module missing: ${relativePath}`);
  }
}

function createReferenceContext() {
  const sandbox = {
    console,
    Math,
    DecisionOption: class DecisionOption {
      constructor(name, weight) {
        this.name = name;
        this.weight = weight;
      }
    }
  };
  sandbox.globalThis = sandbox;
  return vm.createContext(sandbox);
}

function exposeStatement(relativePath) {
  if (relativePath.endsWith("DamageCalculator.js")) {
    return "globalThis.DamageCalculator = DamageCalculator; globalThis.DamageMultiplier = DamageMultiplier;";
  }
  if (relativePath.endsWith("TimelineAction.js")) return "globalThis.TimelineAction = TimelineAction;";
  if (relativePath.endsWith("ActionLogic.js")) return "globalThis.ActionLogic = ActionLogic; globalThis.BattleState = BattleState;";
  return "";
}

function createBattleFacade(state) {
  const decisions = [];
  return {
    getTurns: () => Number(state.currentTurn || 0),
    getMode: () => state.mode || "simulate",
    getQueuedActions: () => Array.isArray(state.queuedActions) ? state.queuedActions : [],
    logDecision: (poke, message) => decisions.push({
      actor: poke?.speciesId || poke?.speciesName || poke?.index,
      message
    }),
    getDecisionLog: () => decisions
  };
}

function normalizePvPokeAction(rawAction, actor, battle, revision) {
  if (!rawAction) {
    return {
      actionType: "fast_move",
      moveId: actor?.fastMove?.moveId || actor?.fastMove?.id || null,
      shield: null,
      wait: false,
      sourceBranch: null,
      reason: lastDecisionReason(battle) || "PvPoke returned undefined, which means Fast Move / wait according to ActionLogic conventions.",
      rawAction: null,
      decisionLog: battle.getDecisionLog(),
      referenceRevision: revision
    };
  }
  if (rawAction.type === "charged") {
    const move = actor?.chargedMoves?.[rawAction.value] || null;
    return {
      actionType: "charged_move",
      moveId: move?.moveId || move?.id || null,
      shield: null,
      wait: false,
      sourceBranch: null,
      reason: lastDecisionReason(battle),
      rawAction,
      decisionLog: battle.getDecisionLog(),
      referenceRevision: revision
    };
  }
  return {
    actionType: rawAction.type || "wait",
    moveId: null,
    shield: null,
    wait: rawAction.type === "wait",
    sourceBranch: null,
    reason: lastDecisionReason(battle),
    rawAction,
    decisionLog: battle.getDecisionLog(),
    referenceRevision: revision
  };
}

function lastDecisionReason(battle) {
  const log = typeof battle.getDecisionLog === "function" ? battle.getDecisionLog() : [];
  return log.length ? log[log.length - 1].message : null;
}

module.exports = {
  PINNED_PVPOKE_REVISION,
  REQUIRED_MODULES,
  createPvPokeReference,
  validateReferenceDirectory
};
