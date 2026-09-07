/* Cramorant's debut data is kept as a small overlay so older bundled Game
 * Master snapshots remain reproducible while the new mechanic is audited. */
(function applyCramorantData() {
  const gameMaster = window.BATTLE_GAMEMASTER;
  if (!gameMaster) return;

  const moves = [
    {
      moveId: "DIVE", name: "Dive", abbreviation: "Dve", type: "water",
      power: 50, energy: 40, energyGain: 0, cooldown: 500, archetype: "Spam/Bait", turns: 1
    },
    {
      moveId: "GULP_MISSILE_ARROKUDA", name: "Gulp Missile (Arrokuda)", type: "water",
      power: 15, energy: 0, energyGain: 0, cooldown: 500, buffs: [0, -1],
      buffTarget: "opponent", buffApplyChance: "1", archetype: "Debuff", turns: 1,
      damageMethod: "percentMaxHP", tags: ["instant", "ignoresFaint", "unlisted", "uneditable"]
    },
    {
      moveId: "GULP_MISSILE_PIKACHU", name: "Gulp Missile (Pikachu)", type: "water",
      power: 15, energy: 0, energyGain: 0, cooldown: 500, buffs: [-2, 0],
      buffTarget: "opponent", buffApplyChance: "1", archetype: "Debuff", turns: 1,
      damageMethod: "percentMaxHP", tags: ["instant", "ignoresFaint", "uneditable"]
    }
  ];
  const base = {
    dex: 845, speciesName: "Cramorant", speciesId: "cramorant", originalFormId: "cramorant",
    baseStats: { atk: 173, def: 163, hp: 172 }, types: ["flying", "water"],
    fastMoves: ["PECK", "WATER_GUN"], chargedMoves: ["FLY", "HYDRO_PUMP", "SURF", "DIVE"],
    extraChargedMoves: ["GULP_MISSILE_ARROKUDA", "GULP_MISSILE_PIKACHU"],
    defaultIVs: { cp500: [9, 4, 8, 11], cp1500: [26, 5, 15, 13], cp2500: [50, 15, 15, 15] },
    searchPriority: 4, buddyDistance: 3, thirdMoveCost: 50000, released: true,
    formChange: {
      type: "set", trigger: "charged_move", moveIDs: ["DIVE", "SURF"],
      alternativeFormId: "variable", resetOnSwitch: true
    }
  };
  const forms = [
    {
      ...base, speciesName: "Cramorant (Gulping)", speciesId: "cramorant_gulping",
      extraChargedMoves: ["GULP_MISSILE_ARROKUDA"], released: false,
      formChange: { type: "set", trigger: "charged_move", moveId: "GULP_MISSILE_ARROKUDA", alternativeFormId: "cramorant", resetOnSwitch: true }
    },
    {
      ...base, speciesName: "Cramorant (Gorging)", speciesId: "cramorant_gorging",
      extraChargedMoves: ["GULP_MISSILE_PIKACHU"], released: false,
      formChange: { type: "set", trigger: "charged_move", moveId: "GULP_MISSILE_PIKACHU", alternativeFormId: "cramorant", resetOnSwitch: true }
    }
  ];
  const index = new Map((gameMaster.moves || []).map(move => [move.moveId, move]));
  moves.forEach(move => index.set(move.moveId, move));
  gameMaster.moves = [...index.values()];
  const pokemonIndex = new Map((gameMaster.pokemon || []).map(pokemon => [pokemon.speciesId, pokemon]));
  [base, ...forms].forEach(pokemon => pokemonIndex.set(pokemon.speciesId, pokemon));
  gameMaster.pokemon = [...pokemonIndex.values()];
  gameMaster.cramorantMechanicsVersion = "pvpoke-2026-08-21";
})();
