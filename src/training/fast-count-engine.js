(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakFastCountEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULT_MAX_ENERGY = 100;

  function positiveInteger(value, name) {
    const number = Number(value);
    if (!Number.isInteger(number) || number <= 0) throw new RangeError(`${name} must be a positive integer.`);
    return number;
  }

  function energyValue(value, maxEnergy, name = "currentEnergy") {
    const number = Number(value ?? 0);
    if (!Number.isFinite(number) || number < 0 || number > maxEnergy) {
      throw new RangeError(`${name} must be between 0 and ${maxEnergy}.`);
    }
    return number;
  }

  function normalizeInputs({ fastEnergy, chargedCost, currentEnergy = 0, maxEnergy = DEFAULT_MAX_ENERGY } = {}) {
    const maximum = positiveInteger(maxEnergy, "maxEnergy");
    const gain = positiveInteger(fastEnergy, "fastEnergy");
    const cost = positiveInteger(chargedCost, "chargedCost");
    if (cost > maximum) throw new RangeError("chargedCost cannot exceed maxEnergy.");
    return Object.freeze({
      fastEnergy: gain,
      chargedCost: cost,
      currentEnergy: energyValue(currentEnergy, maximum),
      maxEnergy: maximum
    });
  }

  function getFastCount(input) {
    const values = normalizeInputs(input);
    if (values.currentEnergy >= values.chargedCost) return 0;
    return Math.ceil((values.chargedCost - values.currentEnergy) / values.fastEnergy);
  }

  function resolveThrow(input) {
    const values = normalizeInputs(input);
    const fastCount = getFastCount(values);
    const energyBefore = values.currentEnergy;
    const energyGained = fastCount * values.fastEnergy;
    const uncappedEnergy = energyBefore + energyGained;
    const energyAtThrow = Math.min(values.maxEnergy, uncappedEnergy);
    if (energyAtThrow < values.chargedCost) throw new RangeError("The Charged Move cannot be reached before the energy cap.");
    const energyAfter = energyAtThrow - values.chargedCost;
    return Object.freeze({
      ...values,
      fastCount,
      energyBefore,
      energyGained,
      uncappedEnergy,
      energyAtThrow,
      capWaste: Math.max(0, uncappedEnergy - values.maxEnergy),
      energyAfter
    });
  }

  function deriveShortcut(input) {
    const values = normalizeInputs({ ...input, currentEnergy: 0 });
    const base = Math.ceil(values.chargedCost / values.fastEnergy);
    const threshold = values.chargedCost - ((base - 1) * values.fastEnergy);
    const gain = (base * values.fastEnergy) - values.chargedCost;
    return Object.freeze({
      fastEnergy: values.fastEnergy,
      chargedCost: values.chargedCost,
      base,
      threshold,
      gain,
      shorterCount: Math.max(0, base - 1),
      shorterCyclePossible: threshold < values.fastEnergy
    });
  }

  function resolveShortcutCycle({ fastEnergy, chargedCost, bank = 0 } = {}) {
    const shortcut = deriveShortcut({ fastEnergy, chargedCost });
    const currentBank = energyValue(bank, Math.max(0, shortcut.fastEnergy - 1), "bank");
    const useShorterCycle = shortcut.shorterCyclePossible && currentBank >= shortcut.threshold;
    return Object.freeze({
      ...shortcut,
      bankBefore: currentBank,
      fastCount: useShorterCycle ? shortcut.base - 1 : shortcut.base,
      bankAfter: useShorterCycle ? currentBank - shortcut.threshold : currentBank + shortcut.gain,
      useShorterCycle
    });
  }

  function resolveSequence({ fastEnergy, chargedCosts, startingEnergy = 0, maxEnergy = DEFAULT_MAX_ENERGY } = {}) {
    if (!Array.isArray(chargedCosts) || !chargedCosts.length) throw new RangeError("chargedCosts must contain at least one cost.");
    let energy = energyValue(startingEnergy, positiveInteger(maxEnergy, "maxEnergy"));
    const throws = chargedCosts.map((chargedCost, index) => {
      const result = resolveThrow({ fastEnergy, chargedCost, currentEnergy: energy, maxEnergy });
      energy = result.energyAfter;
      return Object.freeze({ ...result, index });
    });
    return Object.freeze({ fastEnergy: Number(fastEnergy), startingEnergy: Number(startingEnergy), endingEnergy: energy, throws: Object.freeze(throws) });
  }

  function createExercise({ fastEnergy, chargedCost, currentEnergy = 0, fastMove = null, chargedMove = null, previousMove = null, maxEnergy = DEFAULT_MAX_ENERGY } = {}) {
    const truth = resolveThrow({ fastEnergy, chargedCost, currentEnergy, maxEnergy });
    return Object.freeze({
      ...truth,
      fastMove,
      chargedMove,
      previousMove,
      answer: truth.fastCount
    });
  }

  function generateAnswerChoices({ correct, count = 4, random = Math.random } = {}) {
    const answer = Math.max(0, Math.round(Number(correct) || 0));
    const size = Math.max(2, Math.round(Number(count) || 4));
    const choices = new Set([answer]);
    const offsets = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
    for (const offset of offsets) {
      if (choices.size >= size) break;
      const candidate = answer + offset;
      if (candidate >= 0) choices.add(candidate);
    }
    while (choices.size < size) choices.add(choices.size + answer + 1);
    const output = [...choices];
    for (let index = output.length - 1; index > 0; index -= 1) {
      const roll = Math.max(0, Math.min(0.999999, Number(random()) || 0));
      const swap = Math.floor(roll * (index + 1));
      [output[index], output[swap]] = [output[swap], output[index]];
    }
    return Object.freeze(output);
  }

  return Object.freeze({
    DEFAULT_MAX_ENERGY,
    getFastCount,
    resolveThrow,
    deriveShortcut,
    resolveShortcutCycle,
    resolveSequence,
    createExercise,
    generateAnswerChoices
  });
});
