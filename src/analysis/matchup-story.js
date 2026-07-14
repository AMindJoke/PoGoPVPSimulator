"use strict";

(function exposeMatchupStory(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakMatchupStory = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMatchupStoryApi() {
  const LIMITS = Object.freeze({
    keyThreats: 2,
    winConditions: 3,
    commonMistakes: 3,
    difficultyReasons: 3,
    tags: 4
  });

  const EDGE_TEMPLATES = Object.freeze({
    hpEdge: {
      label: "HP position",
      text: name => `${name} comes out with more HP.`
    },
    energyEdge: {
      label: "Energy race",
      text: name => `${name} leaves with the better energy position.`
    },
    readyEdge: {
      label: "Charged-move race",
      text: name => `${name} reaches the next charged move first.`
    },
    closingCostEdge: {
      label: "Closing sequence",
      text: name => `${name} has the safer closing sequence.`
    },
    farmPressureEdge: {
      label: "Farm pressure",
      text: name => `${name} creates more fast-move pressure after landing charged damage.`
    },
    outpacePressureEdge: {
      label: "Outpace pressure",
      text: name => `${name} wins the charged-move race.`
    }
  });

  function buildMatchupStory(input = {}) {
    const perspective = input.perspective === "B" ? "B" : "A";
    const pokemon = normalizePokemon(input.pokemon);
    const scenarios = Array.isArray(input.scenarios) ? input.scenarios.filter(Boolean) : [];
    const scenario = selectScenario(scenarios, input.selectedShieldState);
    const source = normalizeSource(scenario && scenario.source || input.source);
    const confidence = normalizeConfidence(input.confidence || confidenceFromSource(source, scenario));
    const flags = normalizeFlags(input.flags);
    const winnerSide = scenarioWinnerSide(scenario);
    const outcome = outcomeForPerspective(winnerSide, perspective);
    const closeness = normalizeCloseness(scenario && scenario.closeness, scenario && scenario.score);
    const shieldState = scenario && scenario.shieldState || input.selectedShieldState || "1-1";
    const evidence = dominantEvidence(scenario, perspective, pokemon);
    const swing = normalizeSwing(scenario && scenario.swing);
    const shieldDependent = flags.has("shield-dependent");
    const baitDependent = !!(swing && swing.lineType === "bait");
    const debuffSensitive = !!(swing && swing.lineType === "debuff-sensitive");

    const why = buildWhy({
      confidence,
      outcome,
      perspective,
      pokemon,
      evidence,
      swing,
      shieldDependent
    });
    const keyThreats = buildKeyThreats({ input, scenario, outcome, perspective, pokemon, evidence, confidence });
    const winConditions = buildWinConditions({ swing, perspective, shieldDependent, baitDependent, debuffSensitive, confidence });
    const commonMistakes = buildCommonMistakes({ swing, perspective, shieldDependent, baitDependent, debuffSensitive, confidence, pokemon });
    const tags = buildTags({ swing, shieldDependent, baitDependent, debuffSensitive, evidence });
    const difficulty = buildDifficulty({ closeness, swing, shieldDependent, baitDependent, debuffSensitive, confidence });

    return {
      schemaVersion: 1,
      summary: {
        outcome,
        winnerSide,
        shieldState,
        closeness,
        source,
        score: finiteNumber(scenario && scenario.score)
      },
      headline: `${outcome} in ${shieldState} shields`,
      why,
      keyThreats: keyThreats.slice(0, LIMITS.keyThreats),
      winConditions: winConditions.slice(0, LIMITS.winConditions),
      commonMistakes: commonMistakes.slice(0, LIMITS.commonMistakes),
      difficulty: {
        ...difficulty,
        reasons: difficulty.reasons.slice(0, LIMITS.difficultyReasons)
      },
      tags: tags.slice(0, LIMITS.tags),
      confidence
    };
  }

  function normalizePokemon(pokemon) {
    return {
      a: pokemon && pokemon.a || { id: "pokemon-a", name: "Pokemon A" },
      b: pokemon && pokemon.b || { id: "pokemon-b", name: "Pokemon B" }
    };
  }

  function selectScenario(scenarios, shieldState) {
    if (!scenarios.length) return null;
    return scenarios.find(item => item.shieldState === shieldState)
      || scenarios.find(item => item.shieldState === "1-1")
      || scenarios[0];
  }

  function normalizeSource(source) {
    const value = String(source || "").toLowerCase();
    if (value.includes("missing")) return "Unavailable";
    if (value.includes("live")) return "Live Analysis";
    if (value.includes("precomputed") || value.includes("cache")) return "Precomputed";
    return source || "Live Analysis";
  }

  function confidenceFromSource(source, scenario) {
    if (!scenario || source === "Unavailable" || !Number.isFinite(Number(scenario.score))) return "low";
    return source === "Precomputed" ? "high" : "medium";
  }

  function normalizeConfidence(confidence) {
    return ["high", "medium", "low"].includes(confidence) ? confidence : "medium";
  }

  function normalizeFlags(flags) {
    return new Set((Array.isArray(flags) ? flags : []).map(flag => typeof flag === "string" ? flag : flag && flag.id).filter(Boolean));
  }

  function scenarioWinnerSide(scenario) {
    if (!scenario) return "draw";
    if (["A", "B", "draw"].includes(scenario.winnerSide)) return scenario.winnerSide;
    const score = Number(scenario.score);
    return score > 500 ? "A" : score < 500 ? "B" : "draw";
  }

  function outcomeForPerspective(winnerSide, perspective) {
    if (winnerSide === "draw") return "Neutral";
    return winnerSide === perspective ? "Win" : "Loss";
  }

  function normalizeCloseness(closeness, score) {
    const value = String(closeness || "").toLowerCase();
    if (value === "close") return "Close";
    if (value === "moderate" || value === "favored") return "Moderate";
    if (value === "decisive" || value === "dominant") return "Decisive";
    const gap = Math.abs(Number(score || 500) - 500);
    if (gap <= 35) return "Close";
    if (gap <= 150) return "Moderate";
    return "Decisive";
  }

  function dominantEvidence(scenario, perspective, pokemon) {
    const details = scenario && scenario.result && (scenario.result.details || scenario.result);
    if (!details) return null;
    const direction = perspective === "A" ? 1 : -1;
    const candidates = Object.keys(EDGE_TEMPLATES).map(key => {
      const raw = finiteNumber(details[key]);
      if (raw === null) return null;
      return { key, raw, perspectiveValue: raw * direction, magnitude: Math.abs(raw) };
    }).filter(item => item && item.magnitude >= 8);
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.magnitude - a.magnitude || a.key.localeCompare(b.key));
    const best = candidates[0];
    const favoredSide = best.raw > 0 ? "A" : "B";
    const favoredPokemon = favoredSide === "A" ? pokemon.a : pokemon.b;
    return {
      ...best,
      favoredSide,
      favoredName: favoredPokemon.name,
      label: EDGE_TEMPLATES[best.key].label,
      text: EDGE_TEMPLATES[best.key].text(favoredPokemon.name),
      evidenceKeys: [best.key]
    };
  }

  function normalizeSwing(swing) {
    if (!swing || !["A", "B"].includes(swing.side)) return null;
    const fastMoveCount = Number(swing.fastMoveCount || swing.fastMoves || 0);
    const fastMoveName = swing.fastMoveName || swing.fastMove || null;
    if (!fastMoveCount || !fastMoveName) return null;
    return {
      ...swing,
      fastMoveCount,
      fastMoveName,
      totalTurnCost: Number(swing.totalTurnCost || swing.turnCost || swing.timingCost || 0),
      lineType: swing.lineType || "mixed",
      reproducible: swing.visible !== false
    };
  }

  function buildWhy(context) {
    const { confidence, evidence, shieldDependent, swing, outcome, perspective, pokemon } = context;
    if (confidence === "low" && !evidence && !swing) {
      return {
        title: "Why?",
        text: "Detailed tactical analysis is not available for this configuration.",
        evidenceKeys: []
      };
    }
    if (evidence) {
      return { title: "Why?", text: evidence.text, evidenceKeys: evidence.evidenceKeys };
    }
    if (shieldDependent) {
      return {
        title: "Why?",
        text: "The winner changes depending on how the shields are used.",
        evidenceKeys: ["shield-state-winners"]
      };
    }
    if (swing) {
      const name = swing.side === "A" ? pokemon.a.name : pokemon.b.name;
      return {
        title: "Why?",
        text: swingWhyText(name, swing),
        evidenceKeys: ["alternate-line"]
      };
    }
    const subject = outcome === "Win"
      ? (perspective === "A" ? pokemon.a.name : pokemon.b.name)
      : (perspective === "A" ? pokemon.b.name : pokemon.a.name);
    return {
      title: "Why?",
      text: `${subject} wins the standard play.`,
      evidenceKeys: ["standard-result"]
    };
  }

  function swingWhyText(name, swing) {
    const lead = extraFastMovePhrase(swing, false);
    if (swing.lineType === "bait") return `${name} can turn this around with ${lead} and a successful bait.`;
    if (swing.lineType === "debuff-sensitive") return `${name} can turn this around with ${lead} by managing the self-debuff carefully.`;
    if (swing.lineType === "straight") return `${lead[0].toUpperCase()}${lead.slice(1)} is enough for ${name}; baiting isn't required.`;
    return `${lead[0].toUpperCase()}${lead.slice(1)} gives ${name} a way to turn this around.`;
  }

  function buildKeyThreats({ input, scenario, outcome, perspective, pokemon, evidence, confidence }) {
    if (confidence === "low") return [];
    const supplied = []
      .concat(Array.isArray(input.keyThreats) ? input.keyThreats : [])
      .concat(Array.isArray(scenario && scenario.keyThreats) ? scenario.keyThreats : [])
      .filter(threat => threat && threat.label && threat.confidence !== "low")
      .map((threat, index) => ({
        label: threat.label,
        moveId: threat.moveId || null,
        moveName: threat.moveName || null,
        side: threat.side || null,
        reason: threat.reason || "This is the main threat in the selected shield scenario.",
        priority: Number(threat.priority || 100 - index)
      }));
    if (!supplied.length && outcome === "Loss" && evidence && evidence.key === "readyEdge") {
      const opponentSide = perspective === "A" ? "B" : "A";
      const opponent = opponentSide === "A" ? pokemon.a : pokemon.b;
      supplied.push({
        label: "Charged-move race",
        moveId: null,
        moveName: null,
        side: opponentSide,
        reason: `${opponent.name} reaches the next charged move first.`,
        priority: 80
      });
    }
    return supplied.sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label));
  }

  function buildWinConditions({ swing, perspective, shieldDependent, baitDependent, debuffSensitive, confidence }) {
    const items = [];
    if (swing && swing.side === perspective && swing.reproducible) {
      const previewAction = {
        type: "preview",
        ref: {
          side: swing.side,
          fastMoveCount: swing.fastMoveCount,
          fastMoveName: swing.fastMoveName,
          totalTurnCost: swing.totalTurnCost,
          lineType: swing.lineType
        }
      };
      items.push({
        label: `Gain ${extraFastMovePhrase(swing, false)}.`,
        type: "timing",
        side: swing.side,
        reproducible: true,
        alternateLineId: `${swing.side}:${swing.lineType}:${swing.fastMoveCount}`,
        priority: 100,
        action: previewAction
      });
      if (baitDependent) {
        items.push({
          label: "Land the bait before committing to the stronger move.",
          type: "bait",
          side: swing.side,
          reproducible: true,
          alternateLineId: `${swing.side}:bait:${swing.fastMoveCount}`,
          priority: 85,
          action: previewAction
        });
      }
      if (debuffSensitive) {
        items.push({
          label: "Hold the self-debuffing move until the safer sequence is set.",
          type: "debuff",
          side: swing.side,
          reproducible: true,
          alternateLineId: `${swing.side}:debuff-sensitive:${swing.fastMoveCount}`,
          priority: 82,
          action: previewAction
        });
      }
    }
    if (shieldDependent && confidence !== "low") {
      items.push({
        label: "Adjust the plan to the shield count.",
        type: "shield",
        side: perspective,
        reproducible: false,
        alternateLineId: null,
        priority: 55,
        action: null
      });
    }
    return uniqueByLabel(items).sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label));
  }

  function buildCommonMistakes({ swing, perspective, shieldDependent, baitDependent, debuffSensitive, confidence, pokemon }) {
    if (confidence === "low") return [];
    const items = [];
    if (swing && swing.side === perspective) {
      items.push({
        label: `Throwing before gaining ${extraFastMovePhrase(swing, false)}.`,
        reason: "That extra fast-move lead is required to flip the result.",
        confidence: "high",
        evidenceKeys: ["alternate-line", "timing-cost"],
        priority: 100
      });
    } else if (swing) {
      const opponent = swing.side === "A" ? pokemon.a.name : pokemon.b.name;
      items.push({
        label: `Ignoring ${opponent}'s stored-energy lead.`,
        reason: `${swingEnergyLeadText(swing, true)} is enough for ${opponent} to flip the result.`,
        confidence: "high",
        evidenceKeys: ["alternate-line", "timing-cost"],
        priority: 100
      });
    }
    if (baitDependent) {
      items.push({
        label: "Committing before creating shield pressure.",
        reason: "This route only works if the bait draws a shield.",
        confidence: "medium",
        evidenceKeys: ["bait-line"],
        priority: 85
      });
    }
    if (debuffSensitive) {
      items.push({
        label: "Using the self-debuffing move too early.",
        reason: "Throwing it early leaves you too exposed later.",
        confidence: "medium",
        evidenceKeys: ["debuff-sensitive-line"],
        priority: 82
      });
    }
    if (shieldDependent) {
      items.push({
        label: "Using the same plan at every shield count.",
        reason: "The winner changes as the shield count changes.",
        confidence: "high",
        evidenceKeys: ["shield-state-winners"],
        priority: 60
      });
    }
    return uniqueByLabel(items).sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label));
  }

  function buildTags({ swing, shieldDependent, baitDependent, debuffSensitive, evidence }) {
    const tags = [];
    if (baitDependent) tags.push("bait-dependent");
    if (swing) tags.push("timing-sensitive");
    if (shieldDependent) tags.push("shield-dependent");
    if (debuffSensitive) tags.push("self-debuff-risk");
    if (evidence && evidence.key === "energyEdge") tags.push("energy-sensitive");
    if (!tags.length) tags.push("straightforward");
    return [...new Set(tags)];
  }

  function buildDifficulty({ closeness, swing, shieldDependent, baitDependent, debuffSensitive, confidence }) {
    if (confidence === "low") return {
      level: "Unknown",
      score: null,
      reasons: ["Insufficient reliable tactical data."],
      text: "There isn't enough reliable data to judge this matchup."
    };
    let score = 15;
    const reasons = [];
    if (closeness === "Close") {
      score += 20;
      reasons.push("Small margins");
    }
    if (shieldDependent) {
      score += 25;
      reasons.push("Shield-state dependent");
    }
    if (swing) {
      score += 20;
      reasons.push("Timing-sensitive alternate line");
    }
    if (baitDependent) {
      score += 15;
      reasons.push("Bait-dependent");
    }
    if (debuffSensitive) {
      score += 15;
      reasons.push("Self-debuff management");
    }
    score = Math.min(100, score);
    return {
      level: score >= 60 ? "High" : score >= 30 ? "Medium" : "Low",
      score,
      reasons: reasons.length ? reasons : ["Limited alternate lines"],
      text: difficultyText(score, { closeness, swing, shieldDependent, baitDependent, debuffSensitive })
    };
  }

  function difficultyText(score, context) {
    const factors = [];
    if (context.swing) factors.push("timing");
    if (context.shieldDependent) factors.push("shield use");
    if (context.baitDependent) factors.push("bait calls");
    if (context.debuffSensitive) factors.push("self-debuff management");
    if (context.closeness === "Close") factors.push("small margins");
    const uniqueFactors = [...new Set(factors)];
    if (score < 30 || !uniqueFactors.length) return "The plan is straightforward and leaves little room for variation.";
    const focus = naturalList(uniqueFactors.slice(0, 3));
    return score >= 60
      ? `This matchup is unforgiving and depends heavily on ${focus}.`
      : `This matchup is manageable, but ${focus} still matter${uniqueFactors.length === 1 ? "s" : ""}.`;
  }

  function extraFastMovePhrase(swing, capitalize = false) {
    const count = Math.max(1, Number(swing && swing.fastMoveCount || 1));
    const move = swing && swing.fastMoveName || "fast move";
    const phrase = count === 1 ? `one extra ${move}` : `${count} extra uses of ${move}`;
    return capitalize ? `${phrase[0].toUpperCase()}${phrase.slice(1)}` : phrase;
  }

  function swingEnergyLeadText(swing, capitalize = false) {
    const count = Math.max(1, Number(swing && swing.fastMoveCount || 1));
    const move = swing && swing.fastMoveName || "fast move";
    const energy = finiteNumber(swing && swing.energy);
    const equivalent = count === 1 ? `one ${move}` : `${count} uses of ${move}`;
    const phrase = energy === null
      ? `an energy lead worth ${equivalent}`
      : `an ${energy}-energy lead (${equivalent})`;
    return capitalize ? `${phrase[0].toUpperCase()}${phrase.slice(1)}` : phrase;
  }

  function naturalList(items) {
    if (items.length <= 1) return items[0] || "clean execution";
    if (items.length === 2) return `${items[0]} and ${items[1]}`;
    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
  }

  function uniqueByLabel(items) {
    const seen = new Set();
    return items.filter(item => {
      if (!item || !item.label || seen.has(item.label)) return false;
      seen.add(item.label);
      return true;
    });
  }

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  return {
    MATCHUP_STORY_LIMITS: LIMITS,
    buildMatchupStory
  };
});
