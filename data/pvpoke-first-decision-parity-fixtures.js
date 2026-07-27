"use strict";

const PVPOKE_REVISION = "5e1e3d971369a47aaf3e7247f50710d80205d570";

function move(id, energyCost, damage, extra = {}) {
  return { id, name: id, energyCost, damage, ...extra };
}

function baseState(index, overrides = {}) {
  return {
    currentTurn: 5,
    sides: {
      A: {
        id: `actor-${index}`,
        hp: 120,
        maxHp: 120,
        energy: 40,
        shields: 0,
        attack: 120,
        defense: 120,
        readyTurn: 5,
        fastMove: move("FAST_A", 0, 4, { turns: 2, energyGain: 8 }),
        chargedMoves: [move("CHEAP", 35, 50), move("NUKE", 55, 90)],
        baiting: "off",
        shieldMode: "smart",
        mechanicState: {}
      },
      B: {
        id: `opponent-${index}`,
        hp: 140,
        maxHp: 140,
        energy: 0,
        shields: 0,
        attack: 100,
        defense: 120,
        readyTurn: 7,
        fastMove: move("FAST_B", 0, 6, { turns: 3, energyGain: 8 }),
        chargedMoves: [move("REPLY", 35, 60)],
        baiting: "off",
        shieldMode: "smart",
        mechanicState: {}
      }
    },
    pendingEvents: [],
    cmpState: { readySides: [] },
    ...overrides
  };
}

function mergeState(index, sideA = {}, sideB = {}, root = {}) {
  const state = baseState(index);
  state.sides.A = { ...state.sides.A, ...sideA };
  state.sides.B = { ...state.sides.B, ...sideB };
  return { ...state, ...root };
}

function buildActionFixtures() {
  const fixtures = [];
  const addFamily = (family, count, build) => {
    for (let index = 0; index < count; index++) {
      fixtures.push({
        id: `${family}-${String(index + 1).padStart(2, "0")}`,
        family,
        pvpokeRevision: PVPOKE_REVISION,
        ...build(index)
      });
    }
  };

  addFamily("availability-none", 10, index => ({
    state: mergeState(index, { chargedMoves: [], energy: index }),
    expected: { type: "fast_move", principleId: "AVAIL-001_NO_ACTIVE_CHARGED_MOVE" },
    source: "ActionLogic:15-18",
    categories: ["availability"]
  }));
  addFamily("availability-energy", 10, index => ({
    state: mergeState(index, { energy: 5 + index }),
    expected: { type: "fast_move", principleId: "AVAIL-002_CHEAPEST_CHARGED_NOT_AFFORDABLE" },
    source: "ActionLogic:20-23",
    categories: ["availability", "energy"]
  }));
  addFamily("explicit-farm", 10, index => ({
    state: mergeState(index, { energy: 40, mechanicState: { farmEnergy: true } }),
    context: { farmEnergy: true },
    expected: { type: "fast_move", principleId: "POLICY-003_EXPLICIT_FARM_ENERGY_MODE" },
    source: "ActionLogic:20-23",
    categories: ["farm", "policy"]
  }));
  addFamily("immediate-lethal", 10, index => ({
    state: mergeState(index, { energy: 40 }, { hp: 25 + index, maxHp: 35 }),
    expected: { type: "charged_move", moveId: "CHEAP", principleId: "TACTICAL-008_IMMEDIATE_UNSHIELDED_CHARGED_LETHAL" },
    source: "ActionLogic:211-230",
    categories: ["immediate-lethal", "shields-down"]
  }));
  addFamily("protection-break", 10, index => ({
    state: mergeState(index, { energy: 40 }, {
      hp: 130 + index,
      mechanicState: { chargedProtection: { active: true, capability: "charged-damage-protection" } }
    }),
    expected: { type: "charged_move", moveId: "CHEAP", principleId: "SPECIAL-010_PROTECTION_FORM_MECHANIC_BREAKER" },
    source: "ActionLogic:236-247",
    categories: ["protection"]
  }));
  addFamily("timing-wait", 10, index => ({
    state: mergeState(index, { energy: 40, readyTurn: 5 }, { readyTurn: 9 + (index % 2) }),
    expected: { type: "fast_move", principleId: "TIMING-021_SAFE_TIMING_WAIT_MEANS_ONE_FAST_THEN_REPLAN", intent: "WAIT_ONE_FAST" },
    source: "ActionLogic:255-359",
    categories: ["timing", "different-fast-durations"]
  }));
  addFamily("long-build", 10, index => ({
    state: mergeState(index, {
      energy: 35,
      chargedMoves: [move("CHEAP", 35, 20), move("NUKE", 55, 100)]
    }, { hp: 500 + index * 5, maxHp: 550 }),
    context: { chargedTimingOptimization: false },
    expected: { type: "fast_move", principleId: "LONG-023_LONG_MATCHUP_STARTS_FROM_BEST_CHARGED_CYCLE" },
    source: "ActionLogic:365-412",
    categories: ["long-match", "energy"]
  }));
  addFamily("long-throw", 10, index => ({
    state: mergeState(index, {
      energy: 60,
      chargedMoves: [move("CHEAP", 35, 20), move("NUKE", 55, 100)]
    }, { hp: 500 + index * 5, maxHp: 550 }),
    context: { chargedTimingOptimization: false },
    expected: { type: "charged_move", moveId: "NUKE", principleId: "LONG-023_LONG_MATCHUP_STARTS_FROM_BEST_CHARGED_CYCLE" },
    source: "ActionLogic:365-412",
    categories: ["long-match", "shields-down"]
  }));
  addFamily("long-bait", 10, index => ({
    state: mergeState(index, {
      energy: 60,
      baiting: "always",
      chargedMoves: [move("CHEAP", 35, 30), move("NUKE", 55, 100)]
    }, { hp: 500 + index * 5, maxHp: 550, shields: 1 }),
    context: { chargedTimingOptimization: false, wouldShield: true },
    expected: { type: "charged_move", moveId: "CHEAP", principleId: "BAIT-024_LONG_MATCHUP_MAY_PREFER_CREDIBLE_BAIT" },
    source: "ActionLogic:381-385",
    categories: ["long-match", "bait", "shields-up"]
  }));
  addFamily("long-self-debuff", 10, index => ({
    state: mergeState(index, {
      energy: 60,
      chargedMoves: [
        move("STABLE", 45, 60),
        move("DEBUFF_NUKE", 55, 100, { buffApplyChance: 1, buffs: [-1, 0], buffTarget: "self" })
      ]
    }, { hp: 500 + index * 5, maxHp: 550 }),
    context: { chargedTimingOptimization: false },
    expected: { type: "charged_move", moveId: "STABLE", principleId: "MOVE-025_LONG_MATCHUP_MAY_PREFER_NON_DEBUFFING_MOVE" },
    source: "ActionLogic:387-393",
    categories: ["long-match", "self-debuff"]
  }));
  addFamily("compact-two-cheap", 10, index => ({
    state: mergeState(index, {
      energy: 70,
      chargedMoves: [move("CHEAP", 35, 55), move("NUKE", 60, 90)]
    }, { hp: 100 + index, maxHp: 120 }),
    context: { chargedTimingOptimization: false },
    expected: { type: "charged_move", moveId: "CHEAP", principleId: "ROUTE-007_TWO_COPIES_OUTRANK_ONE_NUKE" },
    source: "ActionLogic:414-801",
    categories: ["compact", "route", "shields-down"]
  }));
  addFamily("compact-farm-down", 10, index => ({
    state: mergeState(index, {
      energy: 35,
      fastMove: move("FAST_A", 0, 10, { turns: 2, energyGain: 8 }),
      chargedMoves: [move("WEAK", 35, 5)]
    }, { hp: 18 + (index % 3), maxHp: 25 }),
    context: { chargedTimingOptimization: false },
    expected: { type: "fast_move", principleId: "FARM-033_FARM_DOWN_ROUTE_CANDIDATE" },
    source: "ActionLogic:488-507",
    categories: ["compact", "farm-down"]
  }));
  addFamily("guaranteed-defense-effect-no-promotion", 10, index => ({
    state: mergeState(index, {
      energy: 40,
      chargedMoves: [
        move("BUFF", 40, 20 + (index % 3), { buffApplyChance: 1, buffs: [0, 1], buffTarget: "self" }),
        move("DIRECT", 40, 45)
      ]
    }, { hp: 100, maxHp: 100 }),
    context: { chargedTimingOptimization: false },
    expected: { type: "charged_move", moveId: "DIRECT", principleId: "MOVE-040_PREFER_USEFUL_IMMEDIATE_DAMAGE_WITHOUT_BAIT_CONSTRAINTS" },
    source: "ActionLogic:866-878; canonical effect-target handling must not add a post-processing promotion",
    categories: ["move-ordering", "guaranteed-effect"]
  }));
  addFamily("guaranteed-attack-effect-route", 10, index => ({
    state: mergeState(index, {
      energy: 40,
      chargedMoves: [
        move("BUFF", 40, 46 + (index % 3), { buffApplyChance: 1, buffs: [1, 0], buffTarget: "self" }),
        move("DIRECT", 40, 45)
      ]
    }, { hp: 100, maxHp: 100 }),
    context: { chargedTimingOptimization: false },
    expected: { type: "charged_move", moveId: "BUFF", principleId: "EFFECT-031_APPLY_GUARANTEED_ATTACK_DEFENSE_EFFECTS" },
    source: "ActionLogic:463-538",
    categories: ["effects", "guaranteed-effect"]
  }));
  addFamily("cmp-forced-two-cheap", 10, index => {
    const pending = {
      id: `pending-${index}`,
      type: "fast-impact",
      sourceSide: "B",
      targetSide: "A",
      moveId: "FAST_B",
      startTurn: 4,
      resolveTurn: 5,
      damage: 120,
      status: "pending",
      source: "parity-fixture"
    };
    return {
      state: mergeState(index, {
        energy: 70,
        attack: 130,
        chargedMoves: [move("CHEAP", 35, 50), move("NUKE", 55, 80)]
      }, { attack: 100 }, { pendingEvents: [pending], cmpState: { readySides: ["A", "B"] } }),
      expected: { type: "charged_move", moveId: "CHEAP", principleId: "TACTICAL-006_FORCED_THROW_BEFORE_FAST_FAINT" },
      source: "ActionLogic:142-200 plus canonical pending-impact adaptation",
      categories: ["forced-throw", "cmp-win", "pending-fast"]
    };
  });
  return fixtures;
}

function buildShieldFixtures() {
  return Array.from({ length: 10 }, (_, index) => {
    const shield = index % 2 === 0;
    const damage = shield ? 97 : 20;
    return {
      id: `would-shield-${String(index + 1).padStart(2, "0")}`,
      family: "would-shield",
      pvpokeRevision: PVPOKE_REVISION,
      source: "ActionLogic:1116-1200",
      categories: ["shield", shield ? "shield" : "no-shield"],
      input: {
        policy: "smart",
        plannerMode: "PVPOKE_PARITY",
        state: { shields: 1, hp: 100, maxHp: 100 },
        threat: { damage, energyCost: 40 },
        parityThreat: {
          attacker: {
            energy: 60,
            baiting: "off",
            fastMove: move("FAST", 0, 1, { turns: 2, energyGain: 10 })
          },
          defender: { hp: 100, maxHp: 100, shields: 1 },
          move: { id: "THREAT", energyCost: 40, damage, selfAttackDebuffing: false },
          fastDamage: 1,
          fastDamageAfterMoveEffect: 1,
          attackerChargedMoves: [{ id: "THREAT", energyCost: 40, damage }]
        }
      },
      expected: { shield, principleId: "SHIELD-043_CURRENT_AND_FUTURE_RESOURCE_VALUE" }
    };
  });
}

module.exports = {
  PVPOKE_REVISION,
  buildActionFixtures,
  buildShieldFixtures
};
