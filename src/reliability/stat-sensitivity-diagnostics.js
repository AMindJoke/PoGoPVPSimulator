"use strict";

(function exposeStatSensitivityDiagnostics(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakStatSensitivityDiagnostics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createStatSensitivityDiagnosticsApi() {
  function compare(before = {}, after = {}) {
    const reasonCodes = [];
    if (number(after.outgoingFastDamage) !== number(before.outgoingFastDamage)) {
      reasonCodes.push("STAT_FAST_DAMAGE_BREAKPOINT");
    }
    if (number(after.incomingFastDamage) !== number(before.incomingFastDamage)) {
      reasonCodes.push("STAT_FAST_DAMAGE_BULKPOINT");
    }
    if (number(after.survivalFastCount) > number(before.survivalFastCount)) {
      reasonCodes.push("STAT_SURVIVES_EXTRA_FAST");
    }
    if (number(after.chargedMovesReachable) > number(before.chargedMovesReachable)) {
      reasonCodes.push("STAT_REACHES_EXTRA_CHARGED");
    }
    if (cmpWinner(after) !== cmpWinner(before)) {
      reasonCodes.push("STAT_CMP_CHANGED");
    }
    if (after.winner != null && before.winner != null && after.winner !== before.winner) {
      reasonCodes.push("STAT_TERMINAL_LINE_FLIPPED");
    }
    return Object.freeze({ reasonCodes: Object.freeze(reasonCodes) });
  }

  function cmpWinner(state) {
    if (state.cmp != null) return String(state.cmp);
    const attack = number(state.attack);
    const opponentAttack = number(state.opponentAttack);
    if (Math.abs(attack - opponentAttack) < 0.0001) return "tie";
    return attack > opponentAttack ? "self" : "opponent";
  }

  function number(value) {
    const result = Number(value);
    return Number.isFinite(result) ? result : 0;
  }

  return Object.freeze({ compare, cmpWinner });
});
