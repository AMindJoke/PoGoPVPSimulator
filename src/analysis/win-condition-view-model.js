"use strict";

(function exposeWinConditionViewModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakWinConditionViewModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createWinConditionViewModelApi() {
  const IMPORTANCE = Object.freeze({ critical: 3, major: 2, supporting: 1, minor: 0 });
  const CONFIDENCE = Object.freeze({ high: 3, medium: 2, low: 1 });
  const CATEGORY_PRIORITY = Object.freeze({
    "opponent-hp": 6,
    "starting-hp": 6,
    "extra-fast-move": 5,
    "guaranteed-defense-buff": 4,
    "guaranteed-attack-debuff": 4,
    "delayed-self-debuff": 3,
    energy: 2
  });

  function buildWinConditionViewModels(input = {}) {
    const summaryConditions = Array.isArray(input.winConditionSummary?.conditions)
      ? input.winConditionSummary.conditions
      : [];
    const views = summaryConditions.map(condition => fromCondition(condition, input)).filter(Boolean);
    const swingView = fromSwing(input.swing, input);
    if (swingView) views.push(swingView);
    const hpSwingView = fromHpSwing(input.hpSwing, input);
    if (hpSwingView) views.push(hpSwingView);
    return deduplicate(views).sort(compareViews);
  }

  function fromCondition(condition, input) {
    if (!condition || condition.visibility === "developer-only") return null;
    const confidence = normalizeLevel(condition.confidence, "medium");
    const importance = normalizeLevel(condition.importance, "supporting");
    if (CONFIDENCE[confidence] < CONFIDENCE.medium || IMPORTANCE[importance] < IMPORTANCE.supporting) return null;
    const category = String(condition.category || "");
    const explicitHp = exactHpValue(condition);
    if ((category === "opponent-hp" || category === "starting-hp") && explicitHp === null) return null;
    const evidence = firstEvidence(condition);
    const side = normalizeSide(condition.side);
    const pokemonName = sideName(input, side, evidence.pokemonName);
    const moveName = evidence.moveName || condition.moveName || condition.moveId || "the move";
    const moment = exactMoment(condition, input.events);
    const copy = conditionCopy({ category, condition, evidence, pokemonName, moveName, explicitHp });
    if (!copy) return null;
    return {
      id: String(condition.id || `${category}:${side || "none"}:${condition.moveId || "none"}`),
      category,
      title: copy.title,
      text: copy.text,
      importance,
      importanceScore: IMPORTANCE[importance] || 0,
      confidence,
      confidenceScore: CONFIDENCE[confidence] || 0,
      side,
      pokemonId: condition.pokemonId || null,
      moveId: condition.moveId || null,
      value: explicitHp,
      unit: explicitHp === null ? null : "hp",
      iconKey: iconForCategory(category),
      tone: toneForCategory(category),
      actionReference: null,
      timelineReference: moment,
      matrixEligible: false,
      evidenceKeys: evidenceKeys(condition),
      relatedLineIds: stableStrings(condition.relatedLineIds),
      source: { kind: "win-condition-engine", id: condition.id || null }
    };
  }

  function fromSwing(swing, input) {
    if (!swing || swing.visible === false || !["A", "B"].includes(swing.side)) return null;
    const count = Number(swing.fastMoveCount || swing.fastMoves || 0);
    const moveName = swing.fastMoveName || swing.fastMove;
    if (!Number.isInteger(count) || count < 1 || !moveName) return null;
    const pokemonName = sideName(input, swing.side);
    const lineType = swing.lineType || "mixed";
    const energy = Number.isFinite(Number(swing.energy)) ? Number(swing.energy) : null;
    const energyText = energy === null ? "" : ` (+${energy} starting energy)`;
    return {
      id: `swing:${swing.side}:${moveName}:${count}:${lineType}`,
      category: "extra-fast-move",
      title: "Extra Fast Move",
      text: count === 1
        ? `One extra ${moveName}${energyText} flips the matchup for ${pokemonName}.`
        : `${count} extra uses of ${moveName}${energyText} flip the matchup for ${pokemonName}.`,
      importance: "critical",
      importanceScore: IMPORTANCE.critical,
      confidence: normalizeLevel(swing.confidence, "high"),
      confidenceScore: CONFIDENCE[normalizeLevel(swing.confidence, "high")],
      side: swing.side,
      pokemonId: null,
      moveId: swing.fastMoveId || null,
      value: count,
      unit: "fast-move",
      energy,
      iconKey: "timing",
      tone: "timing",
      actionReference: swing.reproducible === false ? null : {
        type: "preview",
        ref: {
          side: swing.side,
          fastMoveCount: count,
          fastMoveName: moveName,
          lineType
        }
      },
      timelineReference: null,
      matrixEligible: true,
      evidenceKeys: ["alternate-line", "timing-cost"],
      relatedLineIds: stableStrings(swing.relatedLineIds),
      source: { kind: "flip-analysis", id: swing.id || null }
    };
  }

  function fromHpSwing(hpSwing, input) {
    if (!hpSwing || hpSwing.visible === false || !["A", "B"].includes(hpSwing.side) || !["A", "B"].includes(hpSwing.opponentSide)) return null;
    const reduction = Number(hpSwing.hpReduction);
    const startingHp = Number(hpSwing.opponentStartingHp);
    if (!Number.isInteger(reduction) || reduction < 1 || !Number.isInteger(startingHp) || startingHp < 1) return null;
    const pokemonName = hpSwing.pokemon || sideName(input, hpSwing.side);
    const opponentName = hpSwing.opponentPokemon || sideName(input, hpSwing.opponentSide);
    return {
      id: `hp-swing:${hpSwing.side}:${hpSwing.opponentSide}:${startingHp}`,
      category: "opponent-hp",
      title: "HP Swing",
      text: `${pokemonName} flips if ${opponentName} starts at ${startingHp} HP or lower (-${reduction} HP).`,
      importance: "critical",
      importanceScore: IMPORTANCE.critical,
      confidence: "high",
      confidenceScore: CONFIDENCE.high,
      side: hpSwing.side,
      pokemonId: hpSwing.pokemonId || null,
      moveId: null,
      value: reduction,
      unit: "hp",
      iconKey: "hp",
      tone: "tactical",
      actionReference: {
        type: "preview-hp",
        ref: {
          side: hpSwing.opponentSide,
          startingHp,
          hpReduction: reduction
        }
      },
      timelineReference: null,
      matrixEligible: false,
      evidenceKeys: ["exact-starting-hp-simulation"],
      relatedLineIds: [],
      source: { kind: "hp-threshold-analysis", id: hpSwing.id || null }
    };
  }

  function conditionCopy(context) {
    const { category, condition, pokemonName, moveName, explicitHp } = context;
    if (category === "extra-fast-move") {
      const count = Number(context.evidence.fastMoveCount || condition.value || 0);
      if (!count) return null;
      const fast = context.evidence.fastMoveName || moveName;
      return {
        title: "Extra Fast Move",
        text: count === 1
          ? `One extra ${fast} flips the matchup for ${pokemonName}.`
          : `${count} extra uses of ${fast} flip the matchup for ${pokemonName}.`
      };
    }
    if (category === "guaranteed-defense-buff") return {
      title: "Defense Boost",
      text: `${moveName}'s Defense boost preserves ${pokemonName}'s stronger continuation.`
    };
    if (category === "guaranteed-attack-debuff") return {
      title: "Attack Debuff",
      text: `${moveName}'s Attack drop reduces the opponent's return pressure.`
    };
    if (category === "delayed-self-debuff") return {
      title: "Delay The Debuff",
      text: `Save ${moveName} for the closing sequence so ${pokemonName} avoids weakening the earlier line.`
    };
    if ((category === "opponent-hp" || category === "starting-hp") && explicitHp !== null) return {
      title: "HP Threshold",
      text: `Reduce the opponent's starting HP by exactly ${explicitHp} HP to unlock the detected line.`
    };
    if (category === "energy") return { title: "Energy Lead", text: condition.summary || condition.explanation };
    if (!condition.summary && !condition.explanation) return null;
    return { title: "Win Condition", text: condition.summary || condition.explanation };
  }

  function exactHpValue(condition) {
    if (condition.unit !== "hp") return null;
    const value = Number(condition.value);
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  function exactMoment(condition, events) {
    const moments = Array.isArray(condition.decisiveMoments) ? condition.decisiveMoments : [];
    const moment = moments.find(item => item?.turn !== null && item?.turn !== "" && Number.isFinite(Number(item.turn)));
    if (!moment) return null;
    const turn = Number(moment.turn);
    const side = normalizeSide(moment.side || condition.side);
    const moveId = moment.moveId || condition.moveId || null;
    const event = (Array.isArray(events) ? events : []).find(candidate =>
      Number(candidate.turn) === turn &&
      (!side || candidate.side === side) &&
      (!moveId || candidate.moveId === moveId)
    );
    return { turn, eventIndex: Number.isInteger(event?.index) ? event.index : null, side, moveId, label: moment.label || condition.summary || "Decisive moment" };
  }

  function selectSwingPoint(input = {}) {
    const conditions = Array.isArray(input.conditions) ? input.conditions : [];
    const eligible = conditions.filter(Boolean);
    eligible.sort((a, b) =>
      b.importanceScore - a.importanceScore ||
      b.confidenceScore - a.confidenceScore ||
      nullableTurn(a.timelineReference) - nullableTurn(b.timelineReference) ||
      a.id.localeCompare(b.id)
    );
    const condition = eligible.find(item => item.category === "extra-fast-move" && item.importance === "critical" && item.confidence === "high")
      || eligible.find(item => item.importance === "critical" && item.confidence === "high")
      || eligible.find(item => item.confidence === "high")
      || eligible[0];
    if (condition) return {
      id: `swing-point:${condition.id}`,
      title: condition.title,
      text: condition.text,
      turn: Number.isFinite(condition.timelineReference?.turn) ? condition.timelineReference.turn : null,
      eventIndex: Number.isInteger(condition.timelineReference?.eventIndex) ? condition.timelineReference.eventIndex : null,
      side: condition.timelineReference?.side || condition.side,
      relatedConditionId: condition.id,
      actionReference: condition.actionReference,
      source: "win-condition"
    };
    return null;
  }

  function deduplicate(views) {
    const byKey = new Map();
    for (const view of views) {
      const key = semanticKey(view);
      const current = byKey.get(key);
      if (!current || compareViews(view, current) < 0) byKey.set(key, view);
    }
    return [...byKey.values()];
  }

  function semanticKey(view) {
    if (view.category === "extra-fast-move") return `${view.category}:${view.side}:${view.value}:${String(view.text).match(/extra ([^ ]+)/i)?.[1] || view.moveId || "move"}`;
    if (view.relatedLineIds.length) return `lines:${view.relatedLineIds.join("|")}`;
    return `${view.category}:${view.side || "none"}:${view.moveId || "none"}:${view.value ?? "none"}`;
  }

  function compareViews(a, b) {
    return b.importanceScore - a.importanceScore ||
      b.confidenceScore - a.confidenceScore ||
      (CATEGORY_PRIORITY[b.category] || 0) - (CATEGORY_PRIORITY[a.category] || 0) ||
      nullableTurn(a.timelineReference) - nullableTurn(b.timelineReference) ||
      a.id.localeCompare(b.id);
  }

  function firstEvidence(condition) {
    const item = Array.isArray(condition.supportingEvidence) ? condition.supportingEvidence[0] : null;
    return item?.evidence || item || {};
  }

  function evidenceKeys(condition) {
    return [condition.id, ...(condition.supportingPatterns || []).map(item => item.patternId)].filter(Boolean);
  }

  function normalizeLevel(value, fallback) {
    const level = typeof value === "string" ? value : value?.level;
    return Object.prototype.hasOwnProperty.call(IMPORTANCE, level) || Object.prototype.hasOwnProperty.call(CONFIDENCE, level) ? level : fallback;
  }

  function normalizeSide(side) { return side === "A" || side === "B" ? side : null; }
  function sideName(input, side, fallback) {
    const pokemon = input.pokemon || {};
    return fallback || (side === "A" ? pokemon.a?.name || input.combatants?.A?.name : pokemon.b?.name || input.combatants?.B?.name) || `Pokemon ${side || ""}`.trim();
  }
  function stableStrings(values) { return [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String))].sort(); }
  function nullableTurn(reference) { return Number.isFinite(reference?.turn) ? reference.turn : Number.MAX_SAFE_INTEGER; }
  function iconForCategory(category) {
    if (category === "extra-fast-move") return "timing";
    if (category.includes("defense")) return "shield";
    if (category.includes("attack")) return "debuff";
    if (category.includes("hp")) return "hp";
    return "plan";
  }
  function toneForCategory(category) {
    if (category === "extra-fast-move") return "timing";
    if (category.includes("buff")) return "positive";
    if (category.includes("debuff")) return "tactical";
    return "neutral";
  }

  return { buildWinConditionViewModels, selectSwingPoint };
});
