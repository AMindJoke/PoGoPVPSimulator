(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakFastMoveTiming = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function gcd(a, b) {
    let left = Math.abs(Math.round(a));
    let right = Math.abs(Math.round(b));
    while (right) [left, right] = [right, left % right];
    return left || 1;
  }

  function lcm(a, b) {
    return Math.abs(Math.round(a * b)) / gcd(a, b);
  }

  function normalizeFastMove(move) {
    const turns = Math.max(1, Math.round(Number(move?.turns || 0)));
    return Object.freeze({
      id: String(move?.id || move?.sourceId || ""),
      name: String(move?.name || "Fast Move"),
      type: String(move?.type || "normal"),
      turns,
      power: Math.max(0, Number(move?.power || 0)),
      energyGain: Math.max(0, Number(move?.energyGain || 0))
    });
  }

  function row(move, turnCount) {
    const events = [];
    let energy = 0;
    for (let start = 1; start <= turnCount; start += move.turns) {
      const impact = Math.min(turnCount, start + move.turns - 1);
      energy += move.energyGain;
      events.push(Object.freeze({ start, impact, duration: impact - start + 1, energyAfter: energy }));
    }
    return Object.freeze({ move, events: Object.freeze(events) });
  }

  function build(moveAInput, moveBInput, options = {}) {
    const moveA = normalizeFastMove(moveAInput);
    const moveB = normalizeFastMove(moveBInput);
    const requested = Math.round(Number(options.turnCount || 12));
    const turnCount = Math.max(6, Math.min(24, requested));
    const alignment = lcm(moveA.turns, moveB.turns);
    const rowA = row(moveA, turnCount);
    const rowB = row(moveB, turnCount);
    const moveAReadyTurns = new Set(rowA.events.filter(event => event.duration === moveA.turns).map(event => event.impact));
    const oneTurnBeforeMoveB = new Set(rowB.events.map(event => Math.max(event.start, event.impact - 1)));
    const candidateWindows = [...moveAReadyTurns].filter(turn => oneTurnBeforeMoveB.has(turn));
    return Object.freeze({
      turnCount,
      alignment,
      rows: Object.freeze([rowA, rowB]),
      candidateWindows: Object.freeze([...new Set(candidateWindows)]),
      insight: `${moveA.name} and ${moveB.name} realign every ${alignment} turn${alignment === 1 ? "" : "s"}.`
    });
  }

  return Object.freeze({ gcd, lcm, normalizeFastMove, build });
});
