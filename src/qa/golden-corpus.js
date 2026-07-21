"use strict";

const GOLDEN_CORPUS_SCHEMA_VERSION = 1;

const TACTICAL_CATEGORIES = Object.freeze({
  "guaranteed-defense-buff": "Guaranteed Defense Buff",
  "guaranteed-attack-debuff": "Guaranteed Attack Debuff",
  "self-debuff-sequencing": "Self Debuff Sequencing",
  "straight-play": "Straight Play",
  "bait-required": "Bait Required",
  "shield-dependent": "Shield Dependent",
  "extra-fast-move-flip": "Extra Fast Move Flip",
  "cmp-sensitive": "CMP Sensitive",
  "overfarm-opportunity": "Overfarm Opportunity",
  "energy-management": "Energy Management",
  "closing-move": "Closing Move",
  "cheap-move-vs-nuke": "Cheap Move vs Nuke",
  "projected-charged-sequence": "Projected Charged Sequence",
  "charged-timing": "Charged Timing",
  "safe-sacrifice": "Safe Sacrifice",
  "fast-move-pressure": "Fast Move Pressure"
});

function loadGoldenCorpusObject(input) {
  const corpus = typeof input === "string" ? JSON.parse(input) : input;
  const errors = validateGoldenCorpus(corpus);
  if (errors.length) throw new Error(`Invalid Golden Corpus:\n${errors.join("\n")}`);
  return corpus;
}

function validateGoldenCorpus(corpus) {
  const errors = [];
  if (!corpus || typeof corpus !== "object") return ["Corpus must be an object."];
  if (corpus.schemaVersion !== GOLDEN_CORPUS_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${GOLDEN_CORPUS_SCHEMA_VERSION}.`);
  }
  if (!Array.isArray(corpus.cases)) return [...errors, "cases must be an array."];
  const ids = new Set();
  corpus.cases.forEach((testCase, index) => {
    const prefix = `cases[${index}]`;
    if (!testCase || typeof testCase !== "object") {
      errors.push(`${prefix} must be an object.`);
      return;
    }
    if (!testCase.id) errors.push(`${prefix}.id is required.`);
    else if (ids.has(testCase.id)) errors.push(`${prefix}.id duplicates ${testCase.id}.`);
    else ids.add(testCase.id);
    if (!testCase.description) errors.push(`${prefix}.description is required.`);
    if (!TACTICAL_CATEGORIES[testCase.tacticalCategory]) {
      errors.push(`${prefix}.tacticalCategory is not registered: ${testCase.tacticalCategory || "missing"}.`);
    }
    if (!testCase.pokemonA?.id || !testCase.pokemonB?.id) errors.push(`${prefix} requires pokemonA.id and pokemonB.id.`);
    if (!testCase.expectations || typeof testCase.expectations !== "object") errors.push(`${prefix}.expectations is required.`);
    if (!testCase.expectedPlannerBehavior) errors.push(`${prefix}.expectedPlannerBehavior is required.`);
    if (!testCase.expectedImportantDecision) errors.push(`${prefix}.expectedImportantDecision is required.`);
    if (!testCase.confidence || !["high", "medium", "low"].includes(testCase.confidence)) {
      errors.push(`${prefix}.confidence must be high, medium, or low.`);
    }
  });
  return errors;
}

function tacticalCategoryLabel(category) {
  return TACTICAL_CATEGORIES[category] || category;
}

function aggregateTacticalCoverage(cases, options = {}) {
  const categoryIds = options.categoryIds || Object.keys(TACTICAL_CATEGORIES);
  const byCategory = Object.fromEntries(categoryIds.map(id => [id, {
    id,
    label: tacticalCategoryLabel(id),
    total: 0,
    passed: 0,
    failed: 0,
    passRate: null,
    caseIds: [],
    failedCaseIds: []
  }]));
  for (const item of cases || []) {
    const id = item.tacticalCategory;
    if (!byCategory[id]) {
      byCategory[id] = { id, label: tacticalCategoryLabel(id), total: 0, passed: 0, failed: 0, passRate: null, caseIds: [], failedCaseIds: [] };
    }
    const row = byCategory[id];
    row.total++;
    row.caseIds.push(item.id);
    if (item.passed) row.passed++;
    else {
      row.failed++;
      row.failedCaseIds.push(item.id);
    }
  }
  for (const row of Object.values(byCategory)) {
    row.passRate = row.total ? percent(row.passed / row.total) : null;
  }
  const rows = Object.values(byCategory);
  return {
    catalogSize: rows.length,
    conceptsCovered: rows.filter(row => row.total > 0).length,
    conceptsWithFullCoverage: rows.filter(row => row.total > 0 && row.failed === 0).length,
    conceptsMissingCoverage: rows.filter(row => row.total === 0).map(row => row.id),
    conceptsWithKnownWeaknesses: rows.filter(row => row.failed > 0).map(row => row.id),
    byCategory
  };
}

function percent(value) {
  return Number((Number(value || 0) * 100).toFixed(1));
}

module.exports = {
  GOLDEN_CORPUS_SCHEMA_VERSION,
  TACTICAL_CATEGORIES,
  loadGoldenCorpusObject,
  validateGoldenCorpus,
  tacticalCategoryLabel,
  aggregateTacticalCoverage
};
