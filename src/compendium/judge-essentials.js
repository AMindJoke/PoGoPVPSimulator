(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakJudgeEssentials = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "pvp-simulator.judge-essentials.v1";
  const CURRICULUM = Object.freeze([
    Object.freeze({ id: "turns", order: 1, title: "Turns & Battle Timing", summary: "How Pokémon GO PvP time is structured.", targetType: "mechanics", targetId: "battle-turns" }),
    Object.freeze({ id: "fast-attack-duration", order: 2, title: "Fast Attack Duration", summary: "Understand multi-turn Fast Attacks and action windows.", targetType: "mechanics", targetId: "fast-move-duration" }),
    Object.freeze({ id: "energy", order: 3, title: "Energy & Charged Attacks", summary: "Learn when energy is gained, capped, and spent.", targetType: "mechanics", targetId: "energy-generation" }),
    Object.freeze({ id: "cap", order: 4, title: "Charged Attack Priority (CAP)", summary: "Resolve simultaneous Charged Attacks using current Attack.", targetType: "mechanics", targetId: "charged-move-priority" }),
    Object.freeze({ id: "shields", order: 5, title: "Shield Scenarios", summary: "Read the Protect Shield configurations used in matchup review.", targetType: "glossary", targetId: "shield-scenario" }),
    Object.freeze({ id: "switching", order: 6, title: "Switching & Catches", summary: "Recognize the competitive term for redirecting an incoming Charged Attack.", targetType: "glossary", targetId: "catch" }),
    Object.freeze({ id: "stat-changes", order: 7, title: "Stat Changes", summary: "Track bounded Attack and Defense stages.", targetType: "mechanics", targetId: "stat-stages" }),
    Object.freeze({ id: "battle-end", order: 8, title: "Simultaneous Fast Attack Impacts", summary: "Review how simultaneous Fast Attack impacts can produce simultaneous knockouts.", targetType: "mechanics", targetId: "fast-move-impact" }),
    Object.freeze({ id: "intervention", order: 9, title: "Errors & Judge Intervention", summary: "Start a technical review with the right evidence and process.", targetType: "rulings", targetId: "technical-review-request" })
  ]);

  function normalizeProgress(value) {
    const completed = Array.isArray(value?.completed) ? value.completed.filter(id => CURRICULUM.some(step => step.id === id)) : [];
    const lastOpened = CURRICULUM.some(step => step.id === value?.lastOpened) ? value.lastOpened : null;
    return Object.freeze({ completed: Object.freeze([...new Set(completed)]), lastOpened });
  }

  function readProgress(storage) {
    try { return normalizeProgress(JSON.parse(storage?.getItem(STORAGE_KEY) || "null")); }
    catch (_) { return normalizeProgress(null); }
  }

  function writeProgress(storage, value) {
    const progress = normalizeProgress(value);
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (_) {}
    return progress;
  }

  function markOpened(progress, stepId) {
    return normalizeProgress({ ...progress, lastOpened: stepId });
  }

  function markCompleted(progress, stepId) {
    return normalizeProgress({ ...progress, completed: [...(progress?.completed || []), stepId], lastOpened: stepId });
  }

  function isCompleted(progress, stepId) { return (progress?.completed || []).includes(stepId); }
  function nextStep(progress) { return CURRICULUM.find(step => !isCompleted(progress, step.id)) || null; }
  function resumeStep(progress) {
    const opened = CURRICULUM.find(step => step.id === progress?.lastOpened);
    return opened && !isCompleted(progress, opened.id) ? opened : nextStep(progress);
  }
  function previousStep(stepId) { const index = CURRICULUM.findIndex(step => step.id === stepId); return index > 0 ? CURRICULUM[index - 1] : null; }
  function followingStep(stepId) { const index = CURRICULUM.findIndex(step => step.id === stepId); return index >= 0 && index < CURRICULUM.length - 1 ? CURRICULUM[index + 1] : null; }
  function curriculumIsValid(datasets = {}) { return CURRICULUM.every(step => (datasets[step.targetType] || []).some(entry => entry.id === step.targetId)); }

  return Object.freeze({ STORAGE_KEY, CURRICULUM, normalizeProgress, readProgress, writeProgress, markOpened, markCompleted, isCompleted, nextStep, resumeStep, previousStep, followingStep, curriculumIsValid });
});
