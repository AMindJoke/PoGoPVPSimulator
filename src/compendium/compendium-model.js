(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakJudgeCompendium = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SCHEMA_VERSION = 1;
  const CONTENT_TYPES = Object.freeze(["mechanics", "rulings", "glossary"]);
  const CATEGORIES = Object.freeze([
    Object.freeze({ id: "quick-reference", label: "Quick Reference", summary: "Essential battle and tournament facts at a glance.", status: "foundation" }),
    Object.freeze({ id: "moves", label: "Moves", summary: "Look up canonical Fast and Charged Move data.", status: "phase-2" }),
    Object.freeze({ id: "mechanics", label: "Mechanics", summary: "Learn how Pokémon GO PvP timing and actions work.", status: "phase-5" }),
    Object.freeze({ id: "rulings", label: "Rulings", summary: "Find sourced guidance for tournament situations.", status: "content-pending" }),
    Object.freeze({ id: "glossary", label: "Glossary", summary: "Decode common competitive and judge terminology.", status: "content-pending" })
  ]);

  function isStableId(value) {
    return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
  }

  function stringArray(value) {
    return Array.isArray(value) && value.every(item => typeof item === "string");
  }

  function validTimelineDiagram(diagram) {
    if (!diagram || typeof diagram !== "object") return false;
    const turnCount = Number(diagram.turnCount);
    if (!Number.isInteger(turnCount) || turnCount < 1 || turnCount > 24) return false;
    if (!Array.isArray(diagram.rows) || !diagram.rows.length) return false;
    return diagram.rows.every(row => row
      && typeof row.label === "string"
      && row.label.trim()
      && Array.isArray(row.segments)
      && row.segments.every(segment => {
        const start = Number(segment?.start);
        const duration = Number(segment?.duration);
        return segment
          && Number.isInteger(start)
          && Number.isInteger(duration)
          && start >= 1
          && duration >= 1
          && start + duration - 1 <= turnCount
          && (!segment.label || typeof segment.label === "string")
          && (!segment.tone || ["fast", "impact", "charged", "neutral"].includes(segment.tone));
      }));
  }

  function validContentSections(value) {
    return Array.isArray(value) && value.every(section => section
      && isStableId(section.id)
      && typeof section.heading === "string"
      && stringArray(section.body)
      && (!section.kind || ["text", "key-point", "example", "steps", "timeline"].includes(section.kind))
      && (section.kind !== "timeline" || validTimelineDiagram(section.diagram)));
  }

  function entryErrors(type, entry) {
    const errors = [];
    if (!entry || typeof entry !== "object") return ["ENTRY_OBJECT_REQUIRED"];
    if (!isStableId(entry.id)) errors.push("ENTRY_ID_INVALID");
    if (!stringArray(entry.keywords)) errors.push("ENTRY_KEYWORDS_INVALID");
    if (type === "glossary") {
      if (typeof entry.term !== "string" || !entry.term.trim()) errors.push("GLOSSARY_TERM_REQUIRED");
      if (typeof entry.definition !== "string" || !entry.definition.trim()) errors.push("GLOSSARY_DEFINITION_REQUIRED");
      if (entry.related != null && !stringArray(entry.related)) errors.push("GLOSSARY_RELATED_INVALID");
      return errors;
    }
    ["title", "summary", "category"].forEach(field => {
      if (typeof entry[field] !== "string" || !entry[field].trim()) errors.push(`${type.toUpperCase()}_${field.toUpperCase()}_REQUIRED`);
    });
    if (!validContentSections(entry.content)) errors.push(`${type.toUpperCase()}_CONTENT_INVALID`);
    if (entry.lastUpdated != null && !/^\d{4}-\d{2}-\d{2}$/.test(entry.lastUpdated)) errors.push(`${type.toUpperCase()}_LAST_UPDATED_INVALID`);
    if (type === "mechanics" && entry.related != null && !stringArray(entry.related)) errors.push("MECHANICS_RELATED_INVALID");
    if (type === "rulings") {
      if (typeof entry.source !== "string") errors.push("RULING_SOURCE_REQUIRED");
      if (!['official', 'compendium', 'mixed'].includes(entry.sourceType)) errors.push("RULING_SOURCE_TYPE_INVALID");
      if (entry.relatedMechanics != null && !stringArray(entry.relatedMechanics)) errors.push("RULING_RELATED_MECHANICS_INVALID");
    }
    return errors;
  }

  function validateDataset(type, dataset) {
    const errors = [];
    if (!CONTENT_TYPES.includes(type)) errors.push("CONTENT_TYPE_UNSUPPORTED");
    if (!dataset || typeof dataset !== "object") return Object.freeze({ valid: false, errors: Object.freeze(["DATASET_OBJECT_REQUIRED"]) });
    if (dataset.schemaVersion !== SCHEMA_VERSION) errors.push("SCHEMA_VERSION_UNSUPPORTED");
    if (dataset.contentType !== type) errors.push("CONTENT_TYPE_MISMATCH");
    if (!Array.isArray(dataset.items)) errors.push("DATASET_ITEMS_REQUIRED");
    const ids = new Set();
    (dataset.items || []).forEach((entry, index) => {
      entryErrors(type, entry).forEach(error => errors.push(`${index}:${error}`));
      if (entry?.id && ids.has(entry.id)) errors.push(`${index}:ENTRY_ID_DUPLICATE`);
      if (entry?.id) ids.add(entry.id);
    });
    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  }

  function normalizeDatasets(input = {}) {
    const result = {};
    CONTENT_TYPES.forEach(type => {
      const dataset = input[type] || { schemaVersion: SCHEMA_VERSION, contentType: type, items: [] };
      const validation = validateDataset(type, dataset);
      if (!validation.valid) {
        const error = new Error(`COMPENDIUM_${type.toUpperCase()}_INVALID`);
        error.details = validation.errors;
        throw error;
      }
      result[type] = Object.freeze(dataset.items.map(entry => Object.freeze({
        ...entry,
        content: entry.content ? Object.freeze(entry.content.map(section => Object.freeze({
          ...section,
          body: Object.freeze([...section.body]),
          diagram: section.diagram ? Object.freeze({
            ...section.diagram,
            rows: Object.freeze(section.diagram.rows.map(row => Object.freeze({
              ...row,
              segments: Object.freeze(row.segments.map(segment => Object.freeze({ ...segment })))
            })))
          }) : undefined
        }))) : undefined
      })));
    });
    return Object.freeze(result);
  }

  function searchableEntry(type, entry) {
    const title = type === "glossary" ? entry.term : entry.title;
    const summary = type === "glossary" ? entry.definition : entry.summary;
    const sectionText = (entry.content || []).flatMap(section => [section.heading, ...(section.body || [])]);
    const expanded = type === "glossary" ? entry.expanded || "" : "";
    const text = normalizeSearchText([title, expanded, summary, ...(entry.keywords || []), ...sectionText].join(" "));
    return Object.freeze({
      id: entry.id,
      type,
      title,
      summary,
      keywords: Object.freeze([...(entry.keywords || [])]),
      relatedItems: Object.freeze([...(entry.related || entry.relatedMechanics || [])]),
      text,
      item: entry
    });
  }

  function buildSearchIndex(datasets = {}, additionalEntries = []) {
    const entries = [];
    CONTENT_TYPES.forEach(type => (datasets[type] || []).forEach(entry => entries.push(searchableEntry(type, entry))));
    (additionalEntries || []).forEach(entry => {
      if (entry?.id && entry?.type && entry?.title) entries.push(Object.freeze({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        summary: entry.summary || "",
        keywords: Object.freeze([...(entry.keywords || [])]),
        relatedItems: Object.freeze([...(entry.relatedItems || [])]),
        text: normalizeSearchText([entry.title, entry.summary, ...(entry.keywords || [])].join(" ")),
        item: entry.item || entry
      }));
    });
    return Object.freeze(entries.sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id)));
  }

  function normalizeSearchText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9+.-]+/g, " ").trim();
  }

  function searchScore(entry, normalized, terms) {
    const title = normalizeSearchText(entry.title);
    const keywords = (entry.keywords || []).map(normalizeSearchText);
    const type = normalizeSearchText(entry.type);
    if (title === normalized) return 0;
    if (title.startsWith(normalized)) return 10;
    if (title.includes(normalized)) return 20;
    if (keywords.includes(normalized)) return 30;
    if (keywords.some(keyword => keyword.startsWith(normalized))) return 35;
    if (terms.every(term => title.includes(term))) return 40;
    if (type === normalized || type.replace(/-/g, " ") === normalized) return 50;
    return 60 + Math.min(20, terms.reduce((score, term) => score + Math.max(0, entry.text.indexOf(term)), 0) / 1000);
  }

  function search(index, query, limit = 12) {
    const normalized = normalizeSearchText(query);
    if (!normalized) return Object.freeze([]);
    const terms = normalized.split(/\s+/).filter(Boolean);
    return Object.freeze((index || []).map(entry => {
      if (!terms.every(term => entry.text.includes(term))) return null;
      const score = searchScore(entry, normalized, terms);
      return { entry, score };
    }).filter(Boolean).sort((a, b) => a.score - b.score || a.entry.title.localeCompare(b.entry.title) || a.entry.id.localeCompare(b.entry.id)).slice(0, limit).map(result => result.entry));
  }

  function articleView(type, entry) {
    if (entryErrors(type, entry).length) return null;
    const glossary = type === "glossary";
    return Object.freeze({
      id: entry.id,
      type,
      title: glossary ? entry.term : entry.title,
      eyebrow: glossary ? (entry.expanded || "Glossary") : entry.category,
      summary: glossary ? entry.definition : entry.summary,
      sections: Object.freeze(glossary ? [] : [...entry.content]),
      related: Object.freeze([...(entry.related || entry.relatedMechanics || [])]),
      source: type === "rulings" ? entry.source : "",
      sourceType: type === "rulings" ? entry.sourceType : "",
      lastUpdated: entry.lastUpdated || ""
    });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    CONTENT_TYPES,
    CATEGORIES,
    isStableId,
    validTimelineDiagram,
    entryErrors,
    validateDataset,
    normalizeDatasets,
    buildSearchIndex,
    normalizeSearchText,
    searchScore,
    search,
    articleView
  });
});
