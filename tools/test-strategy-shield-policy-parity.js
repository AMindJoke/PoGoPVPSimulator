"use strict";

const assert = require("node:assert/strict");
const G = require("./build-great-league-meta-database");
const R = require("./run-battle-regressions");

function instrument(source) {
  return source + `
    const shieldPolicyOriginalPrepare = prepareAutomaticBattleAction;
    const shieldPolicyOriginalCompare = compareCanonicalStrategyContinuations;
    const shieldPolicyOriginalRun = runAutomaticBattleToEnd;
    const shieldPolicyOriginalCounterfactual = buildShieldCounterfactual;
    const shieldPolicyOriginalShieldContinuation = simulateShieldDecisionContinuation;
    const shieldPolicyOriginalCharge = useCharge;
    const shieldPolicyOriginalMessage = self.onmessage;
    const shieldPolicyOriginalPost = self.postMessage;
    function shieldPolicySnapshot() {
      return JSON.stringify({ left, right, log, timeline, initialTimelineState, battleTurns,
        manualPendingFastEvents, suppressRender, chargedContinuationOpening,
        strategyDepth: chargedContinuationDepth,
        shieldDepth: typeof shieldContinuationDepth === "number" ? shieldContinuationDepth : 0 });
    }
    function shieldPolicyLedger() {
      return JSON.parse(JSON.stringify({
        state: { A: traceCombatantState(left), B: traceCombatantState(right) },
        events: timeline.map(event => ({
          side: event.trainer, kind: event.kind, moveId: event.moveId || event.move?.id,
          start: event.start, duration: event.duration, damage: event.damage, shielded: event.shielded,
          hpBefore: event.hpBefore, hpAfter: event.hpAfter,
          energyBefore: event.energyBefore, energyAfter: event.energyAfter
        }))
      }));
    }
    compareCanonicalStrategyContinuations = function(...args) {
      if (globalThis.__shieldPolicyAudit?.forced) return null;
      return shieldPolicyOriginalCompare(...args);
    };
    buildShieldCounterfactual = function(attacker, defender, move, ...args) {
      const audit = globalThis.__shieldPolicyAudit;
      if (audit) audit.shieldSearches.push({
        forecast: !!audit.capturingForecast, strategyDepth: chargedContinuationDepth,
        shieldDepth: typeof shieldContinuationDepth === "number" ? shieldContinuationDepth : 0,
        side: attacker.trainer, moveId: move.id, turn: Number(battleTurns[attacker.trainer] || 0),
        prefix: activeAutoTurnContext?.resolvedShieldChoices?.length || 0
      });
      return shieldPolicyOriginalCounterfactual(attacker, defender, move, ...args);
    };
    simulateShieldDecisionContinuation = function(attacker, defender, move, shielded) {
      const audit = globalThis.__shieldPolicyAudit;
      if (!audit) return shieldPolicyOriginalShieldContinuation(attacker, defender, move, shielded);
      const opening = activeAutoTurnContext?.shieldContinuationSnapshot;
      const before = shieldPolicySnapshot();
      const contextBefore = activeAutoTurnContext;
      const previous = audit.activeShieldForecast;
      const record = {
        ordinary: chargedContinuationDepth === 0, turn: opening?.currentTurn,
        side: attacker.trainer, moveId: move.id, shielded,
        expectedActions: Object.fromEntries(Object.entries(opening?.actions || {})
          .map(([side, action]) => [side, strategyActionDescriptor(action)])),
        expectedWrites: JSON.parse(JSON.stringify(opening?.planStates || {})),
        preparedActions: {}, callbackWrites: {}
      };
      audit.shieldForecasts.push(record);
      audit.activeShieldForecast = record;
      try {
        const result = shieldPolicyOriginalShieldContinuation(attacker, defender, move, shielded);
        record.complete = result?.complete === true;
        return result;
      } finally {
        record.restored = before === shieldPolicySnapshot() && activeAutoTurnContext === contextBefore;
        audit.activeShieldForecast = previous;
      }
    };
    function shieldPolicyObservedPlan(attacker, plan) {
      const record = globalThis.__shieldPolicyAudit?.activeShieldForecast;
      if (!record || !plan?.action || Number(battleTurns[attacker.trainer] || 0) !== record.turn) return plan;
      record.preparedActions[attacker.trainer] = strategyActionDescriptor(plan.action);
      const callback = plan.beforeExecute;
      return { ...plan, beforeExecute() {
        if (typeof callback === "function") callback.call(plan);
        const fields = record.expectedWrites[attacker.trainer];
        if (fields) record.callbackWrites[attacker.trainer] = Object.fromEntries(Object.keys(fields)
          .map(field => [field, attacker[field]]));
      } };
    }
    useCharge = function(attacker, defender, moveIndex, options = {}) {
      const audit = globalThis.__shieldPolicyAudit;
      const sampled = audit?.target?.response?.shieldResponse;
      if (audit?.forced && chargedContinuationDepth === 0 && !audit.sampledResponseApplied
        && typeof sampled === "boolean" && attacker.trainer === audit.target.side
        && defender.shieldMode === "smart" && defender.shields > 0) {
        audit.sampledResponseApplied = true;
        options = { ...options, shielded: sampled };
      }
      return shieldPolicyOriginalCharge(attacker, defender, moveIndex, options);
    };
    runAutomaticBattleToEnd = function(...args) {
      const steps = shieldPolicyOriginalRun(...args);
      const audit = globalThis.__shieldPolicyAudit;
      if (audit?.capturingForecast && chargedContinuationDepth === 1) audit.forecastLedger = shieldPolicyLedger();
      if (audit?.forced && chargedContinuationDepth === 0 && !audit.liveLedger) audit.liveLedger = shieldPolicyLedger();
      return steps;
    };
    prepareAutomaticBattleAction = function(attacker, defender) {
      const audit = globalThis.__shieldPolicyAudit;
      const target = audit?.target;
      if (chargedContinuationDepth !== 0 || !target || audit.forced || attacker.trainer !== target.side
        || Number(battleTurns[attacker.trainer] || 0) !== target.turn) {
        return shieldPolicyObservedPlan(attacker, shieldPolicyOriginalPrepare(attacker, defender));
      }
      const legal = legalBattleActions(attacker, target.turn);
      const action = legal.find(item => strategyActionDescriptor(item).type === target.type
        && (!target.moveId || item.moveId === target.moveId));
      if (!action) throw new Error("Shield-policy regression fixture must force a legal opening.");
      const before = shieldPolicySnapshot();
      const contextBefore = activeAutoTurnContext;
      audit.capturingForecast = true;
      audit.forecast = simulateCanonicalActionContinuation(attacker, action, target.response || { id: "policy" });
      audit.capturingForecast = false;
      audit.restored = before === shieldPolicySnapshot() && activeAutoTurnContext === contextBefore;
      audit.forced = true;
      audit.opening = { side: attacker.trainer, turn: target.turn, action: strategyActionDescriptor(action) };
      return { attacker, defender, action, options: { source: "diagnostic-plan", deferCooldownReset: true } };
    };
    self.postMessage = function(message) {
      if (message.result) message.result.shieldPolicyAudit = globalThis.__shieldPolicyAudit;
      return shieldPolicyOriginalPost.call(self, message);
    };
    self.onmessage = function(event) {
      globalThis.__shieldPolicyAudit = { target: event.data.shieldPolicyTarget || null, forced: false,
        shieldSearches: [], shieldForecasts: [] };
      try { return shieldPolicyOriginalMessage.call(self, event); }
      finally { globalThis.__shieldPolicyAudit = null; }
    };
  `;
}

const runtime = R.createRuntime();
const source = G.extractLiveWorkerSource();
const worker = G.createWorkerAdapter(instrument(source), { dreStandard: true, strict: true });
let sequence = 0;
function simulate(a, b, shields, mode, target, options = {}) {
  const config = G.createBattleConfig(runtime.pokemonMap.get(a), runtime.pokemonMap.get(b),
    G.DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
  config.left.shieldMode = config.right.shieldMode = mode;
  return worker.simulate({ id: ++sequence, key: [a, b, shields, mode].join("/"), config,
    aShields: shields, bShields: shields, trace: true, debugTimeline: true,
    includeSwing: false, shieldPolicyTarget: target, ...options });
}

let comparisons = 0;
let forecastShieldSearches = 0;
let cmpPrefixes = 0;
let ordinaryShieldForecasts = 0;
let replayedTimingWrites = 0;
const timingCallbackTypes = {};
function verifyShieldForecasts(audit, label) {
  for (const forecast of audit.shieldForecasts) {
    assert.equal(forecast.complete, true,
      `${label}: each shield forecast must finish with the exact prepared root actions.`);
    assert.equal(forecast.restored, true, `${label}: a shield forecast must restore state, context and search depth.`);
    assert.deepEqual(forecast.preparedActions, forecast.expectedActions,
      `${label}: shield replay must preserve both prepared actions, including an ordinary live root.`);
    if (forecast.ordinary) ordinaryShieldForecasts++;
    for (const [side, observed] of Object.entries(forecast.callbackWrites)) {
      assert.deepEqual(observed, forecast.expectedWrites[side],
        `${label}: the replay must execute the original timing callback state writes for ${side}.`);
      replayedTimingWrites += Object.keys(observed).length;
      const type = forecast.preparedActions[side]?.type;
      if (Object.keys(observed).length) timingCallbackTypes[type] = (timingCallbackTypes[type] || 0) + 1;
    }
  }
}
function verify(result, label) {
  const audit = result.shieldPolicyAudit;
  assert.equal(audit.forced, true, `${label}: reach the requested legal opening.`);
  assert.equal(audit.forecast?.complete, true, `${label}: the forecast must execute a complete battle.`);
  assert.equal(audit.restored, true, `${label}: forecast must restore the live state and active-round context.`);
  assert.deepEqual(audit.forecastLedger, audit.liveLedger,
    `${label}: a canonical forecast and an actual forced opening must use the same shield policy and mechanics.`);
  const side = audit.target.side;
  const opponentSide = side === "A" ? "B" : "A";
  const outcome = result.details.outcome === side ? 2 : result.details.outcome === "draw" ? 1 : 0;
  assert.deepEqual([
    audit.forecast.outcome, audit.forecast.remainingHp, audit.forecast.remainingEnergy,
    audit.forecast.remainingShields, audit.forecast.opponentRemainingHp
  ], [outcome, audit.liveLedger.state[side].hp, audit.liveLedger.state[side].energy,
    audit.liveLedger.state[side].shields, audit.liveLedger.state[opponentSide].hp],
  `${label}: the returned forecast summary must match its replay ledger.`);
  assert(audit.shieldSearches.every(search => search.shieldDepth === 0),
    `${label}: shield forecasts must never recursively refine shield choices.`);
  verifyShieldForecasts(audit, label);
  const searches = audit.shieldSearches.filter(search => search.forecast);
  forecastShieldSearches += searches.length;
  cmpPrefixes += searches.filter(search => search.prefix > 0).length;
  comparisons++;
  return audit;
}

const fixtures = [
  ["cradily", "corsola_galarian", 2, { side: "A", turn: 15, type: "charged_move", moveId: "GRASS_KNOT" }],
  ["skeledirge", "clodsire", 1, { side: "A", turn: 15, type: "fast_move" }],
  ["skeledirge", "clodsire", 1, { side: "A", turn: 15, type: "charged_move", moveId: "TORCH_SONG" }],
  ["talonflame", "quagsire_shadow", 1, { side: "A", turn: 20, type: "charged_move", moveId: "FLY" }],
  ["talonflame", "quagsire_shadow", 1, { side: "A", turn: 20, type: "charged_move", moveId: "BRAVE_BIRD" }]
];
for (const [a, b, shields, target] of fixtures) {
  for (const mode of a === "talonflame" ? ["smart"] : ["smart", "always", "no-first"]) {
    const label = [a, b, shields, mode, target.type].join("/");
    const result = simulate(a, b, shields, mode, target);
    const audit = verify(result, label);
    if (a === "talonflame") {
      const charge = audit.liveLedger.events.find(event => event.side === target.side
        && event.kind === "charge" && event.start === target.turn);
      assert.equal(charge?.moveId, target.moveId, `${label}: replay the requested Fly or Brave Bird opening.`);
      const rootForecasts = audit.shieldForecasts.filter(forecast => forecast.ordinary
        && forecast.side === target.side && forecast.turn === target.turn && forecast.moveId === target.moveId);
      assert.deepEqual([...new Set(rootForecasts.map(forecast => forecast.shielded))].sort(), [false, true],
        `${label}: the ordinary root must produce both completed shield/no-shield forecasts for that exact attack.`);
    }
    if (mode === "smart") assert(audit.shieldSearches.some(search => search.forecast),
      `${label}: strategic forecasts must actually exercise Smart Shield refinement.`);
    else assert(!audit.shieldSearches.some(search => search.forecast),
      `${label}: configured deterministic shields must not trigger adaptive searches.`);
    if (a === "cradily" && mode !== "smart") {
      assert.equal(result.details.outcome, "B", `${label}: preserve configured shield policy outcomes.`);
      assert.equal(audit.liveLedger.state.B.hp, mode === "always" ? 40 : 6);
      assert.equal(audit.liveLedger.state.A.energy, mode === "always" ? 54 : 42);
    }
    for (const options of [{ counterfactuals: true }, { includeSwing: true }, {}]) {
      const repeated = simulate(a, b, shields, mode, target, options);
      const observed = verify(repeated, `${label}/observed`);
      assert.deepEqual(observed.liveLedger, audit.liveLedger,
        `${label}: diagnostics, swing calculations and reused workers must preserve the battle.`);
    }
  }
}

for (const shieldResponse of [true, false]) {
  const target = { side: "A", turn: 15, type: "charged_move", moveId: "GRASS_KNOT",
    response: { id: shieldResponse ? "shield" : "no-shield", shieldResponse } };
  const result = simulate("cradily", "corsola_galarian", 2, "smart", target);
  const label = `sampled shield=${shieldResponse}`;
  const audit = verify(result, label);
  assert.equal(audit.forecast.shieldResponseApplied, true, `${label}: the sampled response must be consumed.`);
  assert.equal(audit.sampledResponseApplied, true, `${label}: actual replay must apply the same response.`);
  const charge = audit.forecastLedger.events.find(event => event.side === "A" && event.kind === "charge" && event.start === target.turn);
  assert(charge, `${label}: identify the sampled root attack.`);
  assert.equal(charge.shielded, shieldResponse, `${label}: Smart refinement must not override a sampled shield choice.`);
  assert(!audit.shieldSearches.some(search => search.forecast && search.side === "A"
    && search.turn === target.turn && search.moveId === target.moveId),
  `${label}: a sampled response must bypass adaptive shield refinement at that attack.`);
}

assert(forecastShieldSearches > 0, "Exercise Smart refinement inside strategy forecasts.");
assert(cmpPrefixes > 0, "Exercise the prior resolved shield choice while forecasting the second CMP attack.");
const config = G.createBattleConfig(runtime.pokemonMap.get("cradily"), runtime.pokemonMap.get("corsola_galarian"),
  G.DEFAULT_PROFILE, runtime.moveMap, runtime.standardMovesets, runtime.pokemonMap);
config.left.shieldMode = config.right.shieldMode = "smart";
const plain = G.createWorkerAdapter(source, { dreStandard: true, strict: true }).simulate({
  id: ++sequence, key: "plain-after-forecast", config, aShields: 2, bShields: 2,
  trace: true, debugTimeline: true, includeSwing: false
});
const afterForecasts = simulate("cradily", "corsola_galarian", 2, "smart", null);
const inTestRealm = value => JSON.parse(JSON.stringify(value));
assert.equal(afterForecasts.shieldPolicyAudit.forced, false, "The replay intervention must not leak into a later worker request.");
assert.deepEqual(inTestRealm(afterForecasts.decisionTrace.finalState), inTestRealm(plain.decisionTrace.finalState),
  "Previous forecasts must not leak search depth, battle state or shield settings into a later battle.");
assert.deepEqual(inTestRealm(afterForecasts.timelineTrace), inTestRealm(plain.timelineTrace),
  "Observing shield forecasts must preserve the normal battle after repeated worker reuse.");
verifyShieldForecasts(afterForecasts.shieldPolicyAudit, "unforced ordinary battle");
assert(ordinaryShieldForecasts > 0, "Exercise completed shield forecasts from ordinary live roots.");
assert(replayedTimingWrites > 0, "Exercise actual serialized Fast or wait timing callback writes during shield replay.");
assert(timingCallbackTypes.fast_move > 0, "Exercise a real prepared Fast timing callback in a Charged shield snapshot.");
console.log(`Strategy shield policy parity passed: ${comparisons} forecasts/replays, ${forecastShieldSearches} forecast shield searches, ${cmpPrefixes} CMP prefixes, ${ordinaryShieldForecasts} ordinary forecasts, ${replayedTimingWrites} timing writes (${JSON.stringify(timingCallbackTypes)}).`);
