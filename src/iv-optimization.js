"use strict";

(function exposeIvOptimization(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakIvOptimization = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createIvOptimizationApi() {
  const PROFILE_NAMES = Object.freeze(["balanced", "attack", "defense"]);

  function buildEligibleIvCandidates(evaluateSpread) {
    if (typeof evaluateSpread !== "function") return [];
    const candidates = [];
    for (let ivAtk = 0; ivAtk <= 15; ivAtk++) {
      for (let ivDef = 0; ivDef <= 15; ivDef++) {
        for (let ivHp = 0; ivHp <= 15; ivHp++) {
          const stats = evaluateSpread(ivAtk, ivDef, ivHp);
          const candidate = stats ? { ...stats, key: `${ivAtk}/${ivDef}/${ivHp}`, ivAtk, ivDef, ivHp } : null;
          if (isValidCandidate(candidate)) candidates.push(candidate);
        }
      }
    }
    return candidates;
  }

  function buildIvOptimizationProfiles(candidates) {
    const valid = (Array.isArray(candidates) ? candidates : []).filter(isValidCandidate);
    if (!valid.length) return { rankedCandidates: [], profiles: emptyProfiles() };

    const rankedCandidates = valid.slice().sort(compareBalanced).map((candidate, index, rows) => ({
      ...candidate,
      statProductRank: index + 1,
      rankPercent: rows.length > 1 ? 1 - index / (rows.length - 1) : 1
    }));

    return {
      rankedCandidates,
      profiles: {
        balanced: profileResult("balanced", rankedCandidates[0]),
        attack: profileResult("attack", rankedCandidates.slice().sort(compareAttack)[0]),
        defense: profileResult("defense", rankedCandidates.slice().sort(compareDefense)[0])
      }
    };
  }

  function compareBalanced(a, b) {
    return compareDescending(a.statProduct, b.statProduct) ||
      compareDescending(a.defense, b.defense) ||
      compareDescending(a.hp, b.hp) ||
      compareDescending(a.attack, b.attack) ||
      compareAscending(a.level, b.level) ||
      compareStableIvs(a, b);
  }

  function compareAttack(a, b) {
    return compareDescending(a.attack, b.attack) ||
      compareDescending(a.statProduct, b.statProduct) ||
      compareDescending(a.defense, b.defense) ||
      compareDescending(a.hp, b.hp) ||
      compareAscending(a.level, b.level) ||
      compareStableIvs(a, b);
  }

  function compareDefense(a, b) {
    return compareDescending(a.defense, b.defense) ||
      compareDescending(a.statProduct, b.statProduct) ||
      compareDescending(a.hp, b.hp) ||
      compareDescending(a.attack, b.attack) ||
      compareAscending(a.level, b.level) ||
      compareStableIvs(a, b);
  }

  function compareStableIvs(a, b) {
    return compareAscending(a.ivAtk, b.ivAtk) ||
      compareAscending(a.ivDef, b.ivDef) ||
      compareAscending(a.ivHp, b.ivHp) ||
      String(a.key || "").localeCompare(String(b.key || ""));
  }

  function profileResult(profile, candidate) {
    if (!candidate || !PROFILE_NAMES.includes(profile)) return null;
    return {
      profile,
      key: candidate.key,
      attackIv: candidate.ivAtk,
      defenseIv: candidate.ivDef,
      staminaIv: candidate.ivHp,
      level: candidate.level,
      cp: candidate.cp,
      attack: candidate.attack,
      defense: candidate.defense,
      stamina: candidate.hp,
      statProduct: candidate.statProduct,
      statProductRank: candidate.statProductRank,
      rankPercent: candidate.rankPercent,
      bestBuddy: Number(candidate.level) > 50
    };
  }

  function isValidCandidate(candidate) {
    return candidate && [
      candidate.ivAtk,
      candidate.ivDef,
      candidate.ivHp,
      candidate.level,
      candidate.cp,
      candidate.attack,
      candidate.defense,
      candidate.hp,
      candidate.statProduct
    ].every(value => Number.isFinite(Number(value)));
  }

  function compareDescending(a, b) {
    return Number(b) - Number(a);
  }

  function compareAscending(a, b) {
    return Number(a) - Number(b);
  }

  function emptyProfiles() {
    return { balanced: null, attack: null, defense: null };
  }

  function resolveIvOptimizationProfile(currentProfile, action = {}) {
    if (action.type === "manual-edit") return "custom";
    if (action.type === "select" && PROFILE_NAMES.includes(action.profile)) return action.profile;
    return PROFILE_NAMES.includes(currentProfile) ? currentProfile : "custom";
  }

  return {
    PROFILE_NAMES,
    buildEligibleIvCandidates,
    buildIvOptimizationProfiles,
    resolveIvOptimizationProfile,
    compareBalanced,
    compareAttack,
    compareDefense
  };
});
