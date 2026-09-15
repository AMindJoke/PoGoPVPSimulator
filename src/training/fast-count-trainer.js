(function (root, factory) {
  const api = factory(root?.PvPeakFastCountEngine);
  if (typeof module === "object" && module.exports) module.exports = factory(require("./fast-count-engine"));
  if (root) root.PvPeakFastCountTrainer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (engine) {
  "use strict";

  const STORAGE_KEY = "go-judge-hub-fast-count-trainer-v1";
  const SESSION_LENGTH = 10;
  const MODES = Object.freeze([
    Object.freeze({ id: "learn", label: "Learn", short: "Learn", icon: "◆", description: "Understand the basics" }),
    Object.freeze({ id: "guided", label: "Guided", short: "Guided", icon: "◉", description: "Count with help" }),
    Object.freeze({ id: "memory", label: "Memory", short: "Memory", icon: "●", description: "Hide the bank" }),
    Object.freeze({ id: "mixed", label: "Mixed Moves", short: "Mixed", icon: "↝", description: "Practice random sequences" }),
    Object.freeze({ id: "meta", label: "Meta Trainer", short: "Meta", icon: "▥", description: "Train with real meta Pokémon" }),
    Object.freeze({ id: "shortcut", label: "Build the Shortcut", short: "Build", icon: "✦", description: "Find Base, Threshold and Gain" })
  ]);
  const DIFFICULTIES = Object.freeze([
    Object.freeze({ id: "beginner", label: "Beginner" }),
    Object.freeze({ id: "intermediate", label: "Intermediate" }),
    Object.freeze({ id: "advanced", label: "Advanced" })
  ]);
  const TYPE_COLORS = Object.freeze({
    normal: "#8a8f96", fire: "#d95f22", water: "#2f78d6", electric: "#b88700",
    grass: "#3b9140", ice: "#238fa8", fighting: "#b83a32", poison: "#8748ad",
    ground: "#9a672f", flying: "#5b7fc0", psychic: "#ca447a", bug: "#718f25",
    rock: "#806c45", ghost: "#5b5194", dragon: "#535bc9", dark: "#49413d",
    steel: "#627c89", fairy: "#ca589f"
  });

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function title(value) {
    return String(value || "").replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase());
  }

  function normalizeMove(move) {
    if (!move?.moveId) return null;
    return Object.freeze({
      id: String(move.moveId),
      name: String(move.name || title(move.moveId)),
      type: String(move.type || "normal").toLowerCase(),
      energyGain: Math.max(0, Number(move.energyGain || 0)),
      energyCost: Math.max(0, Number(move.energy || 0))
    });
  }

  function createCatalog({ gameMaster, defaultMovesets = {}, rankings = null, rankingLimit = 150 } = {}) {
    if (!gameMaster?.moves || !gameMaster?.pokemon) throw new Error("FAST_COUNT_DATA_UNAVAILABLE");
    const moveMap = new Map(gameMaster.moves.map(normalizeMove).filter(Boolean).map(move => [move.id, move]));
    const pokemonMap = new Map(gameMaster.pokemon
      .filter(pokemon => pokemon?.speciesId && pokemon?.speciesName && pokemon.released !== false)
      .map(pokemon => [pokemon.speciesId, pokemon]));
    const rankEntries = Array.isArray(rankings?.entries)
      ? rankings.entries
        .filter(entry => entry?.id && (!entry.profile || entry.profile === "rank1"))
        .sort((a, b) => Number(a.rank || 99999) - Number(b.rank || 99999))
      : [];
    const rankedIds = [];
    const rankById = new Map();
    rankEntries.forEach(entry => {
      if (rankById.has(entry.id)) return;
      rankById.set(entry.id, Number(entry.rank || rankById.size + 1));
      if (rankedIds.length < Math.max(1, Number(rankingLimit) || 150)) rankedIds.push(entry.id);
    });
    const sourceIds = rankedIds.length ? rankedIds : Object.keys(defaultMovesets);
    const builds = sourceIds.map(id => {
      const pokemon = pokemonMap.get(id);
      const moveset = defaultMovesets[id];
      if (!pokemon || !moveset?.fast || !Array.isArray(moveset.charged)) return null;
      if (!pokemon.fastMoves?.includes(moveset.fast)) return null;
      const fastMove = moveMap.get(moveset.fast);
      const chargedMoves = [...new Set(moveset.charged)]
        .filter(moveId => pokemon.chargedMoves?.includes(moveId) || pokemon.extraChargedMoves?.includes(moveId))
        .map(moveId => moveMap.get(moveId))
        .filter(move => move && move.energyCost > 0);
      if (!fastMove || fastMove.energyGain <= 0 || !chargedMoves.length) return null;
      const rank = rankById.get(id) || 9999;
      return Object.freeze({
        id,
        name: String(pokemon.speciesName),
        dex: Number(pokemon.dex || 0),
        types: Object.freeze((pokemon.types || []).filter(type => type && type !== "none")),
        rank,
        weight: Math.max(1, (Math.max(1, Number(rankingLimit) || 150) + 1) - Math.min(rank, Number(rankingLimit) || 150)),
        fastMove,
        chargedMoves: Object.freeze(chargedMoves)
      });
    }).filter(Boolean);
    return Object.freeze({
      builds: Object.freeze(builds),
      byId: new Map(builds.map(build => [build.id, build])),
      moveMap
    });
  }

  function weightedPick(builds, random = Math.random, excludedId = null) {
    const choices = (Array.isArray(builds) ? builds : []).filter(build => build && (build.id !== excludedId || builds.length === 1));
    if (!choices.length) return null;
    const total = choices.reduce((sum, build) => sum + Math.max(1, Number(build.weight || 1)), 0);
    let cursor = Math.max(0, Math.min(0.999999, Number(random()) || 0)) * total;
    for (const build of choices) {
      cursor -= Math.max(1, Number(build.weight || 1));
      if (cursor < 0) return build;
    }
    return choices[choices.length - 1];
  }

  function readStats(storage) {
    try {
      const saved = JSON.parse(storage?.getItem?.(STORAGE_KEY) || "null");
      return {
        completed: Math.max(0, Number(saved?.completed || 0)),
        correct: Math.max(0, Number(saved?.correct || 0)),
        bestStreak: Math.max(0, Number(saved?.bestStreak || 0)),
        railVisible: saved?.railVisible !== false
      };
    } catch (_) {
      return { completed: 0, correct: 0, bestStreak: 0, railVisible: true };
    }
  }

  function createTrainer(options = {}) {
    if (!engine) throw new Error("FAST_COUNT_ENGINE_UNAVAILABLE");
    const catalog = options.catalog || createCatalog(options);
    const random = options.random || Math.random;
    const storage = options.storage || (typeof localStorage !== "undefined" ? localStorage : null);
    const imageUrl = typeof options.imageUrl === "function" ? options.imageUrl : () => "";
    const fallbackImageUrl = typeof options.fallbackImageUrl === "function" ? options.fallbackImageUrl : () => "";
    const stats = readStats(storage);
    const firstBuild = catalog.builds[0];
    const state = {
      mode: "guided",
      difficulty: "beginner",
      selectedId: firstBuild?.id || null,
      activeBuild: firstBuild || null,
      bank: 0,
      previousMove: null,
      exercise: null,
      choices: [],
      answer: null,
      answered: false,
      correct: false,
      showMemoryBank: false,
      sessionDone: false,
      sessionCompleted: 0,
      sessionCorrect: 0,
      streak: 0,
      sessionBestStreak: 0,
      history: [],
      stats,
      pokemonPickerOpen: false,
      pokemonQuery: firstBuild?.name || "",
      pokemonActiveIndex: 0,
      modeSheetOpen: false,
      detailsOpen: false,
      mounted: false
    };
    let container = null;

    function persistStats() {
      try { storage?.setItem?.(STORAGE_KEY, JSON.stringify(state.stats)); } catch (_) {}
    }

    function selectedBuild() {
      return catalog.byId.get(state.selectedId) || catalog.builds[0] || null;
    }

    function pickMove(build) {
      const moves = build?.chargedMoves || [];
      if (!moves.length) return null;
      if (moves.length === 1) return moves[0];
      const index = Math.min(moves.length - 1, Math.floor(Math.max(0, Math.min(.999999, Number(random()) || 0)) * moves.length));
      return moves[index];
    }

    function prepareExercise() {
      state.answer = null;
      state.answered = false;
      state.correct = false;
      state.showMemoryBank = false;
      if (state.mode === "meta") {
        if (!state.activeBuild || state.sessionCompleted % 2 === 0) {
          const next = weightedPick(catalog.builds, random, state.activeBuild?.id);
          if (next?.id !== state.activeBuild?.id) {
            state.activeBuild = next;
            state.bank = 0;
            state.previousMove = null;
          }
        }
      } else {
        const next = selectedBuild();
        if (next?.id !== state.activeBuild?.id) {
          state.bank = 0;
          state.previousMove = null;
        }
        state.activeBuild = next;
      }
      const build = state.activeBuild;
      const chargedMove = pickMove(build);
      if (!build || !chargedMove) {
        state.exercise = null;
        return;
      }
      if (state.mode === "shortcut") {
        const shortcut = engine.deriveShortcut({ fastEnergy: build.fastMove.energyGain, chargedCost: chargedMove.energyCost });
        state.exercise = Object.freeze({ kind: "shortcut", build, chargedMove, shortcut });
        state.choices = [];
        return;
      }
      state.exercise = engine.createExercise({
        fastEnergy: build.fastMove.energyGain,
        chargedCost: chargedMove.energyCost,
        currentEnergy: state.bank,
        fastMove: build.fastMove,
        chargedMove,
        previousMove: state.previousMove
      });
      state.choices = engine.generateAnswerChoices({ correct: state.exercise.answer, random });
    }

    function resetSession() {
      state.bank = 0;
      state.previousMove = null;
      state.sessionDone = false;
      state.sessionCompleted = 0;
      state.sessionCorrect = 0;
      state.streak = 0;
      state.sessionBestStreak = 0;
      state.history = [];
      state.activeBuild = state.mode === "meta" ? null : selectedBuild();
      if (state.mode !== "learn") prepareExercise();
      else state.exercise = null;
      render();
    }

    function recordAnswer(correct, answerLabel, truthLabel) {
      state.answered = true;
      state.correct = correct;
      state.sessionCompleted += 1;
      state.stats.completed += 1;
      if (correct) {
        state.sessionCorrect += 1;
        state.stats.correct += 1;
        state.streak += 1;
      } else state.streak = 0;
      state.sessionBestStreak = Math.max(state.sessionBestStreak, state.streak);
      state.stats.bestStreak = Math.max(state.stats.bestStreak, state.streak);
      const exercise = state.exercise;
      state.history.unshift({
        name: exercise.build?.name || state.activeBuild?.name || "Exercise",
        move: exercise.chargedMove?.name || "Shortcut",
        answer: answerLabel,
        truth: truthLabel,
        correct
      });
      state.history = state.history.slice(0, 5);
      persistStats();
    }

    function answerCount(value) {
      if (state.answered || !state.exercise || state.exercise.kind === "shortcut") return;
      const answer = Number(value);
      recordAnswer(answer === state.exercise.answer, answer, state.exercise.answer);
      state.answer = answer;
      state.bank = state.exercise.energyAfter;
      state.previousMove = state.exercise.chargedMove;
      render("next");
    }

    function answerShortcut(form) {
      if (state.answered || state.exercise?.kind !== "shortcut") return;
      const values = {
        base: Number(form.elements.base.value),
        threshold: Number(form.elements.threshold.value),
        gain: Number(form.elements.gain.value)
      };
      const truth = state.exercise.shortcut;
      const correct = values.base === truth.base && values.threshold === truth.threshold && values.gain === truth.gain;
      state.answer = values;
      recordAnswer(correct, `${values.base}/${values.threshold}/${values.gain}`, `${truth.base}/${truth.threshold}/${truth.gain}`);
      render("next");
    }

    function nextExercise() {
      if (!state.answered) return;
      if (state.sessionCompleted >= SESSION_LENGTH) {
        state.sessionDone = true;
        render("summary");
        return;
      }
      prepareExercise();
      render("challenge");
    }

    function setMode(mode) {
      if (!MODES.some(entry => entry.id === mode)) return;
      state.mode = mode;
      state.pokemonPickerOpen = false;
      state.modeSheetOpen = false;
      state.detailsOpen = false;
      resetSession();
    }

    function setPokemon(id) {
      if (!catalog.byId.has(id)) return;
      state.selectedId = id;
      state.activeBuild = catalog.byId.get(id);
      state.pokemonPickerOpen = false;
      state.pokemonQuery = state.activeBuild.name;
      state.pokemonActiveIndex = 0;
      state.detailsOpen = false;
      resetSession();
    }

    function toggleRail() {
      state.stats.railVisible = !state.stats.railVisible;
      persistStats();
      render();
    }

    function moveChip(move, kind, showEnergy = true) {
      const color = TYPE_COLORS[move?.type] || TYPE_COLORS.normal;
      const value = kind === "fast" ? `+${move.energyGain}` : `${move.energyCost}`;
      return `<span class="fast-count-move-chip fast-count-move-${kind}" style="--move-color:${color}"><span>${escapeHtml(move.name)}</span>${showEnergy ? `<strong>${value}<small> energy</small></strong>` : ""}</span>`;
    }

    function typeBadges(build) {
      return build.types.map(type => `<span style="--type-color:${TYPE_COLORS[type] || TYPE_COLORS.normal}">${escapeHtml(title(type))}</span>`).join("");
    }

    function matchingPokemon() {
      const query = String(state.pokemonQuery || "").trim().toLocaleLowerCase();
      return catalog.builds
        .filter(build => !query || build.name.toLocaleLowerCase().includes(query) || build.id.toLocaleLowerCase().includes(query))
        .slice(0, 10);
    }

    function pokemonPickerResults() {
      const matches = matchingPokemon();
      if (!matches.length) return `<p class="fast-count-picker-empty">No current meta Pokémon found.</p>`;
      return matches.map((entry, index) => {
        const sprite = imageUrl(entry);
        const fallback = fallbackImageUrl(entry);
        const charged = entry.chargedMoves.map(move => move.name).join(" / ");
        return `<button id="fastCountPokemonOption${index}" type="button" role="option" data-fast-count-pokemon-option="${escapeHtml(entry.id)}" aria-selected="${entry.id === state.selectedId}" class="${index === state.pokemonActiveIndex ? "is-active" : ""}">
          <img src="${escapeHtml(sprite)}" data-fast-count-sprite data-fallback="${escapeHtml(fallback)}" alt="">
          <span><strong>${entry.rank < 9999 ? `#${entry.rank} · ` : ""}${escapeHtml(entry.name)}</strong><small>${escapeHtml(entry.fastMove.name)} · ${escapeHtml(charged)}</small></span>
        </button>`;
      }).join("");
    }

    function pokemonPicker() {
      const activeId = state.pokemonPickerOpen && matchingPokemon().length ? `fastCountPokemonOption${state.pokemonActiveIndex}` : "";
      return `<div class="fast-count-picker">
        <label for="fastCountPokemonSearch">Choose Pokémon</label>
        <div class="fast-count-picker-control">
          <input id="fastCountPokemonSearch" type="search" autocomplete="off" value="${escapeHtml(state.pokemonQuery)}" placeholder="Search Pokémon" role="combobox" aria-autocomplete="list" aria-expanded="${state.pokemonPickerOpen}" aria-controls="fastCountPokemonSuggestions"${activeId ? ` aria-activedescendant="${activeId}"` : ""} data-fast-count-pokemon-search>
          <div id="fastCountPokemonSuggestions" class="fast-count-picker-options" role="listbox"${state.pokemonPickerOpen ? "" : " hidden"}>${state.pokemonPickerOpen ? pokemonPickerResults() : ""}</div>
        </div>
      </div>`;
    }

    function pokemonContext(build) {
      if (!build) return `<section class="fast-count-context"><p>No eligible current-season builds were found.</p></section>`;
      const sprite = imageUrl(build);
      const fallback = fallbackImageUrl(build);
      const showEnergy = state.mode !== "meta" || state.difficulty !== "advanced";
      return `<section class="fast-count-context" aria-label="Current Pokémon and moveset">
        <div class="fast-count-pokemon-head">
          <img src="${escapeHtml(sprite)}" data-fast-count-sprite data-fallback="${escapeHtml(fallback)}" alt="${escapeHtml(build.name)}">
          <div><span class="fast-count-rank">Great League${build.rank < 9999 ? ` · #${build.rank}` : ""}</span><h2>${escapeHtml(build.name)}</h2>${moveChip(build.fastMove, "fast", showEnergy)}</div>
        </div>
        <div class="fast-count-moves" aria-label="Charged moves">${build.chargedMoves.map(move => moveChip(move, "charged", showEnergy)).join("")}</div>
      </section>`;
    }

    function modeBar() {
      return `<div class="fast-count-mode-bar" role="tablist" aria-label="Training mode">${MODES.map(mode => `<button class="ui-button ui-button--ghost ui-button--md" type="button" role="tab" data-fast-count-mode="${mode.id}" aria-selected="${state.mode === mode.id}" title="${escapeHtml(mode.description)}"><span>${escapeHtml(mode.short)}</span></button>`).join("")}</div>`;
    }

    function modeSheet() {
      if (!state.modeSheetOpen) return "";
      return `<div class="fast-count-sheet-layer" data-fast-count-close-mode>
        <section class="fast-count-sheet fast-count-mode-sheet" role="dialog" aria-modal="true" aria-labelledby="fastCountModeTitle" data-fast-count-sheet tabindex="-1">
          <header><span class="fast-count-sheet-handle" aria-hidden="true"></span><h2 id="fastCountModeTitle">Practice mode</h2><button class="ui-button ui-button--ghost ui-button--md" type="button" aria-label="Close mode selector" data-fast-count-close-mode>×</button></header>
          <div class="fast-count-mode-list">${MODES.map(mode => `<button type="button" data-fast-count-mode="${mode.id}" aria-pressed="${state.mode === mode.id}" class="ui-button ui-button--secondary ui-button--lg ${state.mode === mode.id ? "is-selected" : ""}"><span class="fast-count-mode-icon" aria-hidden="true">${mode.icon}</span><span><strong>${escapeHtml(mode.label)}</strong><small>${escapeHtml(mode.description)}</small></span><i aria-hidden="true"></i></button>`).join("")}</div>
          <div class="fast-count-method-key" aria-label="Fast Count method"><h3>How it works</h3><p><strong>Base</strong><span>count from zero</span></p><p><strong>Threshold</strong><span>bank needed to save one Fast</span></p><p><strong>Gain</strong><span>carry added after a normal cycle</span></p></div>
        </section>
      </div>`;
    }

    function sessionHeader() {
      const progress = state.mode === "learn" ? 0 : Math.min(100, (state.sessionCompleted / SESSION_LENGTH) * 100);
      const activeMode = MODES.find(mode => mode.id === state.mode) || MODES[1];
      return `<div class="fast-count-head">
        <div class="fast-count-title"><span class="fast-count-eyebrow">Training tools</span><h1>Fast Count</h1></div>
        <button class="ui-button ui-button--secondary ui-button--md fast-count-mode-trigger" type="button" data-fast-count-open-mode aria-haspopup="dialog" aria-expanded="${state.modeSheetOpen}"><span class="fast-count-mode-trigger-icon" aria-hidden="true">${activeMode.icon}</span><span class="fast-count-mode-trigger-copy"><small>Mode:</small> ${escapeHtml(activeMode.label)}</span><i aria-hidden="true">⌄</i></button>
        <div class="fast-count-session-status"${state.mode === "learn" ? " hidden" : ""}><span><strong>${Math.min(SESSION_LENGTH, state.sessionCompleted + (state.answered ? 0 : 1))}</strong> / ${SESSION_LENGTH}</span><div role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${state.sessionCompleted}"><i style="width:${progress}%"></i></div><span class="fast-count-streak" aria-label="Current streak">🔥 ${state.streak}</span></div>
      </div>${modeBar()}`;
    }

    function guidanceVisibility() {
      if (state.mode === "memory") return { bank: false, values: true };
      if (state.mode !== "meta") return { bank: true, values: true };
      return {
        bank: state.difficulty === "beginner",
        values: state.difficulty !== "advanced"
      };
    }

    function energyRail(build, bank, force = false) {
      const visible = force || (state.stats.railVisible && guidanceVisibility().bank);
      if (!visible || !build?.fastMove?.energyGain) return "";
      const gain = build.fastMove.energyGain;
      const active = ((Number(bank || 0) % gain) + gain) % gain;
      const cells = Array.from({ length: gain }, (_, value) => `<span class="${value === active ? "is-active" : ""}"${value === active ? ' aria-current="true"' : ""}>${value}</span>`).join("");
      return `<section class="fast-count-rail" aria-label="Energy bank: ${active} of ${gain - 1}"><div><strong>Bank: <b>${active}</b></strong><span>energy carried into the next throw</span></div><div class="fast-count-rail-track" style="--rail-count:${gain}">${cells}</div></section>`;
    }

    function feedbackPanel(exercise) {
      if (!state.answered || !exercise) return "";
      if (exercise.kind === "shortcut") {
        const shortcut = exercise.shortcut;
        return `<section class="fast-count-feedback ${state.correct ? "is-correct" : "is-incorrect"}" tabindex="-1" data-fast-count-feedback aria-live="polite">
          <strong>${state.correct ? "Correct. You built the shortcut." : "Almost. Rebuild it from the energy steps."}</strong>
          <div class="fast-count-derivation"><span><small>Base</small>${shortcut.base}</span><span><small>Threshold</small>${shortcut.threshold}</span><span><small>Gain</small>${shortcut.gain}</span></div>
          <p>${shortcut.base - 1} × ${shortcut.fastEnergy} = ${(shortcut.base - 1) * shortcut.fastEnergy} is below ${shortcut.chargedCost}; ${shortcut.base} × ${shortcut.fastEnergy} = ${shortcut.base * shortcut.fastEnergy} reaches it.</p>
        </section>`;
      }
      const equation = exercise.capWaste
        ? `${exercise.energyBefore} + ${exercise.energyGained} − ${exercise.capWaste} − ${exercise.chargedCost} = ${exercise.energyAfter}`
        : `${exercise.energyBefore} + ${exercise.energyGained} − ${exercise.chargedCost} = ${exercise.energyAfter}`;
      return `<section class="fast-count-feedback ${state.correct ? "is-correct" : "is-incorrect"}" tabindex="-1" data-fast-count-feedback aria-live="polite">
        <div class="fast-count-feedback-result"><span aria-hidden="true">${state.correct ? "✓" : "×"}</span><div><strong>${exercise.fastCount} Fast</strong><p>${state.correct ? "Correct!" : `Your answer: ${state.answer}`}</p></div></div>
        <div class="fast-count-math"><p><span>Previous bank</span><strong>${exercise.energyBefore}</strong></p><p><span>${exercise.fastCount} × ${escapeHtml(exercise.fastMove.name)}</span><strong class="is-positive">+${exercise.energyGained}</strong></p><p><span>Energy reached</span><strong>${exercise.energyAtThrow}</strong></p><p><span>${escapeHtml(exercise.chargedMove.name)} cost</span><strong class="is-negative">−${exercise.chargedCost}</strong></p><p><span>New bank</span><strong>${exercise.energyAfter}</strong></p></div>
        <p class="fast-count-equation">${equation}</p>
        ${exercise.capWaste ? `<p>${exercise.capWaste} energy is lost at the 100-energy cap.</p>` : ""}
        ${state.mode === "memory" && !state.showMemoryBank ? `<button class="ui-button ui-button--secondary ui-button--md" type="button" data-fast-count-show-bank>Show bank on the rail</button>` : ""}
      </section>`;
    }

    function countChallenge(exercise) {
      if (!exercise) return `<section class="fast-count-challenge"><p>Trainer data is unavailable.</p></section>`;
      const visibility = guidanceVisibility();
      const previous = exercise.previousMove
        ? `<div class="fast-count-throw is-previous" style="--move-color:${TYPE_COLORS[exercise.previousMove.type] || TYPE_COLORS.normal}"><span>Just thrown</span><strong>${escapeHtml(exercise.previousMove.name)}</strong></div>`
        : `<div class="fast-count-throw is-previous"><span>Just thrown</span><strong>Start of sequence</strong></div>`;
      if (state.answered) return `<section class="fast-count-challenge is-feedback ${state.correct ? "is-correct" : "is-incorrect"}" aria-label="Answer feedback">${feedbackPanel(exercise)}<button class="ui-button ui-button--primary ui-button--lg fast-count-next" type="button" data-fast-count-next>${state.sessionCompleted >= SESSION_LENGTH ? "View session" : "Next"}<span aria-hidden="true">→</span></button></section>`;
      return `<section class="fast-count-challenge" aria-labelledby="fastCountQuestion">
        <div class="fast-count-throw-context">${previous}<div class="fast-count-throw is-next" style="--move-color:${TYPE_COLORS[exercise.chargedMove.type] || TYPE_COLORS.normal}"><span>Next</span><strong>${escapeHtml(exercise.chargedMove.name)}</strong>${visibility.values ? `<small>${exercise.chargedCost} energy</small>` : ""}</div></div>
        <h2 id="fastCountQuestion"><span>How many</span><strong>${escapeHtml(exercise.fastMove.name)}?</strong></h2>
        ${visibility.values ? `<p class="fast-count-clue">Each Fast Attack generates <strong>${exercise.fastEnergy}</strong> energy${visibility.bank ? ` · Bank: <strong>${exercise.energyBefore}</strong>` : ""}</p>` : `<p class="fast-count-clue">Keep both the move values and current bank in memory.</p>`}
        <div class="fast-count-answers" role="group" aria-label="Fast count choices">${state.choices.map((choice, index) => `<button type="button" data-fast-count-answer="${choice}"${state.answered ? " disabled" : ""} class="${state.answered && choice === exercise.answer ? "is-answer" : ""}${state.answered && choice === state.answer && !state.correct ? " is-wrong" : ""}"><span>${choice}</span><small>Key ${index + 1}</small></button>`).join("")}</div>
      </section>`;
    }

    function shortcutChallenge(exercise) {
      if (!exercise) return "";
      const { shortcut, chargedMove, build } = exercise;
      return `<section class="fast-count-challenge fast-count-shortcut-challenge" aria-labelledby="fastCountQuestion">
        <div class="fast-count-challenge-top"><span class="fast-count-previous">Universal method</span><span class="fast-count-mode-note">No memorized count required</span></div>
        <h2 id="fastCountQuestion">Build the shortcut</h2>
        <p class="fast-count-shortcut-given"><strong>Fast energy: ${shortcut.fastEnergy}</strong><span>${escapeHtml(chargedMove.name)} costs <strong>${shortcut.chargedCost}</strong></span></p>
        <form class="fast-count-shortcut-form" data-fast-count-shortcut-form>
          <label><span>Base</span><small>From zero</small><input name="base" inputmode="numeric" type="number" min="0" max="100" required${state.answered ? ` value="${escapeHtml(state.answer?.base)}" disabled` : ""}></label>
          <label><span>Threshold</span><small>Bank needed</small><input name="threshold" inputmode="numeric" type="number" min="0" max="100" required${state.answered ? ` value="${escapeHtml(state.answer?.threshold)}" disabled` : ""}></label>
          <label><span>Gain</span><small>Carry added</small><input name="gain" inputmode="numeric" type="number" min="0" max="100" required${state.answered ? ` value="${escapeHtml(state.answer?.gain)}" disabled` : ""}></label>
          ${state.answered ? "" : `<button class="ui-button ui-button--primary ui-button--lg" type="submit">Check shortcut</button>`}
        </form>
        ${feedbackPanel(exercise)}
        ${state.answered ? `<button class="ui-button ui-button--primary ui-button--lg fast-count-next" type="button" data-fast-count-next>${state.sessionCompleted >= SESSION_LENGTH ? "View session" : "Next shortcut"}<span aria-hidden="true">→</span></button>` : ""}
      </section>`;
    }

    function learnPanel(build) {
      if (!build) return "";
      return `<section class="fast-count-learn" aria-labelledby="fastCountLearnTitle">
        <div class="fast-count-learn-intro"><span>Fast energy = <strong>${build.fastMove.energyGain}</strong></span><h2 id="fastCountLearnTitle">Build every count from three numbers</h2><p>You throw as soon as the Charged Move is ready. The remaining energy becomes the bank for the next cycle.</p></div>
        <div class="fast-count-learn-grid">${build.chargedMoves.map(move => {
          const shortcut = engine.deriveShortcut({ fastEnergy: build.fastMove.energyGain, chargedCost: move.energyCost });
          const below = (shortcut.base - 1) * shortcut.fastEnergy;
          const enough = shortcut.base * shortcut.fastEnergy;
          return `<article style="--move-color:${TYPE_COLORS[move.type] || TYPE_COLORS.normal}"><header><span>${escapeHtml(move.name)}</span><strong>${move.energyCost}<small> energy</small></strong></header><p>${below} is not enough. ${enough} is enough.</p><div class="fast-count-derivation"><span><small>Base</small>${shortcut.base}</span><span><small>Threshold</small>${shortcut.threshold}</span><span><small>Gain</small>${shortcut.gain}</span></div><p class="fast-count-rule">${shortcut.shorterCyclePossible ? `At ${shortcut.threshold} bank, use ${shortcut.shorterCount} instead of ${shortcut.base} Fast Attacks.` : "The cost divides exactly: the normal cycle does not become shorter."}</p></article>`;
        }).join("")}</div>
        <button class="ui-button ui-button--primary ui-button--lg" type="button" data-fast-count-start-guided>Practice this Pokémon <span aria-hidden="true">→</span></button>
      </section>`;
    }

    function historyPanel() {
      const accuracy = state.stats.completed ? Math.round((state.stats.correct / state.stats.completed) * 100) : 0;
      return `<aside class="fast-count-side" aria-label="Session stats and history">
        <div class="fast-count-stats"><span><small>Streak</small><strong>${state.streak}</strong></span><span><small>Best</small><strong>${state.stats.bestStreak}</strong></span><span><small>Accuracy</small><strong>${accuracy}%</strong></span></div>
        <section class="fast-count-history"><h2>Recent counts</h2>${state.history.length ? state.history.map(item => `<div class="${item.correct ? "is-correct" : "is-incorrect"}"><span aria-hidden="true">${item.correct ? "✓" : "×"}</span><p><strong>${escapeHtml(item.move)}</strong><small>${escapeHtml(item.name)}</small></p><b>${escapeHtml(item.answer)}${item.correct ? "" : ` → ${escapeHtml(item.truth)}`}</b></div>`).join("") : `<p class="fast-count-empty">Your last five answers will appear here.</p>`}</section>
        <details class="fast-count-how"><summary>How the method works</summary><div><p><strong>Base</strong> is the count from zero.</p><p><strong>Threshold</strong> is the bank needed to use one fewer Fast.</p><p><strong>Gain</strong> is the bank added by a normal Base cycle.</p><p>The shortcut assumes an immediate throw. Deliberate overfarm uses the full energy calculation.</p></div></details>
      </aside>`;
    }

    function detailsPanel(build) {
      if (!state.detailsOpen) return "";
      const railToggle = state.mode === "learn" || state.sessionDone ? "" : `<button class="ui-button ui-button--secondary ui-button--md fast-count-rail-toggle" type="button" data-fast-count-rail-toggle aria-pressed="${state.stats.railVisible}">${state.stats.railVisible ? "Hide" : "Show"} Energy Rail</button>`;
      return `<div class="fast-count-sheet-layer" data-fast-count-close-details>
        <section class="fast-count-sheet fast-count-details-sheet" role="dialog" aria-modal="true" aria-labelledby="fastCountDetailsTitle" data-fast-count-sheet tabindex="-1">
          <header><span class="fast-count-sheet-handle" aria-hidden="true"></span><h2 id="fastCountDetailsTitle">Details & settings</h2><button class="ui-button ui-button--ghost ui-button--md" type="button" aria-label="Close details" data-fast-count-close-details>×</button></header>
          <div class="fast-count-details-controls">${difficultyControl()}${railToggle}${state.mode === "meta" ? `<button class="ui-button ui-button--secondary ui-button--md fast-count-change" type="button" data-fast-count-new-meta>New meta Pokémon</button>` : pokemonPicker()}</div>
          ${historyPanel()}
        </section>
      </div>`;
    }

    function summaryPanel() {
      const accuracy = state.sessionCompleted ? Math.round((state.sessionCorrect / state.sessionCompleted) * 100) : 0;
      return `<section class="fast-count-summary" tabindex="-1" data-fast-count-summary><span>Session complete</span><h2>${state.sessionCorrect} / ${state.sessionCompleted} correct</h2><div><strong>${accuracy}%<small>accuracy</small></strong><strong>${state.sessionBestStreak}<small>best streak</small></strong></div><div class="fast-count-summary-actions"><button class="ui-button ui-button--primary ui-button--md" type="button" data-fast-count-again>Practice again</button><button class="ui-button ui-button--secondary ui-button--md" type="button" data-fast-count-summary-mode>Change mode</button><button class="ui-button ui-button--secondary ui-button--md" type="button" data-fast-count-summary-pokemon>${state.mode === "meta" ? "New meta Pokémon" : "New Pokémon"}</button></div></section>`;
    }

    function difficultyControl() {
      if (state.mode !== "meta") return "";
      return `<label class="fast-count-difficulty"><span>Difficulty</span><select data-fast-count-difficulty>${DIFFICULTIES.map(item => `<option value="${item.id}"${item.id === state.difficulty ? " selected" : ""}>${item.label}</option>`).join("")}</select></label>`;
    }

    function render(focusTarget = null) {
      if (!container) return;
      const build = state.activeBuild || selectedBuild();
      const railBank = state.answered && state.exercise?.kind !== "shortcut" ? state.exercise.energyAfter : state.exercise?.energyBefore ?? state.bank;
      const main = state.mode === "learn"
        ? learnPanel(build)
        : state.sessionDone
          ? summaryPanel()
          : state.exercise?.kind === "shortcut" ? shortcutChallenge(state.exercise) : countChallenge(state.exercise);
      container.innerHTML = `<div class="fast-count-shell">${sessionHeader()}<div class="fast-count-workspace"><main class="fast-count-main">${pokemonContext(build)}${main}${state.mode !== "learn" && !state.sessionDone && !state.answered ? energyRail(build, railBank, state.mode === "memory" && state.showMemoryBank) : ""}<button class="ui-button ui-button--ghost ui-button--md fast-count-details-trigger" type="button" data-fast-count-open-details aria-haspopup="dialog" aria-expanded="${state.detailsOpen}">ⓘ Details & settings <span aria-hidden="true">›</span></button></main>${historyPanel()}</div>${modeSheet()}${detailsPanel(build)}</div>`;
      bind();
      if (focusTarget === "next") container.querySelector("[data-fast-count-next]")?.focus({ preventScroll: true });
      if (focusTarget === "challenge") container.querySelector("[data-fast-count-answer]")?.focus({ preventScroll: true });
      if (focusTarget === "summary") container.querySelector("[data-fast-count-summary]")?.focus({ preventScroll: true });
      if (focusTarget === "sheet") container.querySelector("[data-fast-count-sheet]")?.focus({ preventScroll: true });
      bindSpriteFallbacks(container);
    }

    function bindSpriteFallbacks(scope) {
      scope?.querySelectorAll("[data-fast-count-sprite]").forEach(img => img.addEventListener("error", event => {
        const img = event.currentTarget;
        const fallback = img.dataset.fallback;
        if (fallback && img.src !== fallback) {
          img.dataset.fallback = "";
          img.src = fallback;
        } else img.hidden = true;
      }));
    }

    function refreshPokemonPicker() {
      const input = container.querySelector("[data-fast-count-pokemon-search]");
      const list = container.querySelector("#fastCountPokemonSuggestions");
      if (!input || !list) return;
      const matches = matchingPokemon();
      state.pokemonActiveIndex = Math.max(0, Math.min(state.pokemonActiveIndex, Math.max(0, matches.length - 1)));
      input.setAttribute("aria-expanded", String(state.pokemonPickerOpen));
      if (state.pokemonPickerOpen && matches.length) input.setAttribute("aria-activedescendant", `fastCountPokemonOption${state.pokemonActiveIndex}`);
      else input.removeAttribute("aria-activedescendant");
      list.hidden = !state.pokemonPickerOpen;
      list.innerHTML = state.pokemonPickerOpen ? pokemonPickerResults() : "";
      bindPickerOptions();
      bindSpriteFallbacks(list);
    }

    function bindPickerOptions() {
      container.querySelectorAll("[data-fast-count-pokemon-option]").forEach(button => button.addEventListener("click", () => setPokemon(button.dataset.fastCountPokemonOption)));
    }

    function bind() {
      container.querySelectorAll("[data-fast-count-mode]").forEach(button => button.addEventListener("click", () => setMode(button.dataset.fastCountMode)));
      container.querySelectorAll("[data-fast-count-answer]").forEach(button => button.addEventListener("click", () => answerCount(button.dataset.fastCountAnswer)));
      container.querySelector("[data-fast-count-next]")?.addEventListener("click", nextExercise);
      container.querySelector("[data-fast-count-open-mode]")?.addEventListener("click", () => { state.modeSheetOpen = true; render("sheet"); });
      container.querySelectorAll("[data-fast-count-close-mode]").forEach(element => element.addEventListener("click", event => { if (event.currentTarget === event.target || event.currentTarget.matches("button")) { state.modeSheetOpen = false; render(); } }));
      container.querySelector("[data-fast-count-open-details]")?.addEventListener("click", () => { state.detailsOpen = true; render("sheet"); });
      container.querySelectorAll("[data-fast-count-close-details]").forEach(element => element.addEventListener("click", event => { if (event.currentTarget === event.target || event.currentTarget.matches("button")) { state.detailsOpen = false; render(); } }));
      container.querySelector("[data-fast-count-shortcut-form]")?.addEventListener("submit", event => { event.preventDefault(); answerShortcut(event.currentTarget); });
      const pokemonSearch = container.querySelector("[data-fast-count-pokemon-search]");
      pokemonSearch?.addEventListener("focus", () => {
        state.pokemonPickerOpen = true;
        state.pokemonActiveIndex = 0;
        refreshPokemonPicker();
      });
      pokemonSearch?.addEventListener("input", event => {
        state.pokemonQuery = event.target.value;
        state.pokemonPickerOpen = true;
        state.pokemonActiveIndex = 0;
        refreshPokemonPicker();
      });
      pokemonSearch?.addEventListener("keydown", event => {
        const matches = matchingPokemon();
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const direction = event.key === "ArrowDown" ? 1 : -1;
          state.pokemonActiveIndex = Math.max(0, Math.min(Math.max(0, matches.length - 1), state.pokemonActiveIndex + direction));
          state.pokemonPickerOpen = true;
          refreshPokemonPicker();
        } else if (event.key === "Enter" && state.pokemonPickerOpen && matches[state.pokemonActiveIndex]) {
          event.preventDefault();
          setPokemon(matches[state.pokemonActiveIndex].id);
        } else if (event.key === "Escape") {
          state.pokemonPickerOpen = false;
          refreshPokemonPicker();
        }
      });
      bindPickerOptions();
      container.querySelector("[data-fast-count-new-meta]")?.addEventListener("click", () => {
        state.activeBuild = weightedPick(catalog.builds, random, state.activeBuild?.id);
        state.bank = 0;
        state.previousMove = null;
        state.detailsOpen = false;
        if (state.mode !== "learn") prepareExercise();
        render("challenge");
      });
      container.querySelector("[data-fast-count-rail-toggle]")?.addEventListener("click", toggleRail);
      container.querySelector("[data-fast-count-show-bank]")?.addEventListener("click", () => { state.showMemoryBank = true; render(); });
      container.querySelector("[data-fast-count-start-guided]")?.addEventListener("click", () => setMode("guided"));
      container.querySelector("[data-fast-count-difficulty]")?.addEventListener("change", event => { state.difficulty = event.target.value; resetSession(); });
      container.querySelector("[data-fast-count-again]")?.addEventListener("click", resetSession);
      container.querySelector("[data-fast-count-summary-mode]")?.addEventListener("click", () => { setMode("guided"); container.querySelector("[data-fast-count-mode]")?.focus(); });
      container.querySelector("[data-fast-count-summary-pokemon]")?.addEventListener("click", () => {
        if (state.mode === "meta") {
          state.activeBuild = weightedPick(catalog.builds, random, state.activeBuild?.id);
          resetSession();
        } else {
          state.pokemonPickerOpen = true;
          state.sessionDone = false;
          render();
          container.querySelector("[data-fast-count-pokemon-search]")?.focus();
        }
      });
    }

    function handleKeydown(event) {
      if (event.key === "Tab" && (state.modeSheetOpen || state.detailsOpen)) {
        const sheet = container?.querySelector("[data-fast-count-sheet]");
        const focusable = [...(sheet?.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), summary") || [])].filter(element => element.offsetParent !== null);
        if (focusable.length) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }
      if (event.key === "Escape" && (state.modeSheetOpen || state.detailsOpen)) {
        event.preventDefault();
        state.modeSheetOpen = false;
        state.detailsOpen = false;
        render();
        return;
      }
      if (!state.mounted || state.answered || state.exercise?.kind === "shortcut") return;
      if (/input|select|textarea/i.test(event.target?.tagName || "")) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < state.choices.length) {
        event.preventDefault();
        answerCount(state.choices[index]);
      }
    }

    function mount(target) {
      container = typeof target === "string" ? document.querySelector(target) : target;
      if (!container) throw new Error("FAST_COUNT_MOUNT_NOT_FOUND");
      state.mounted = true;
      if (state.mode !== "learn" && !state.exercise) prepareExercise();
      document.addEventListener("keydown", handleKeydown);
      render();
      return controller;
    }

    function destroy() {
      document.removeEventListener("keydown", handleKeydown);
      state.mounted = false;
      if (container) container.innerHTML = "";
      container = null;
    }

    const controller = Object.freeze({ mount, destroy, render, resetSession, setMode, setPokemon, getState: () => ({ ...state }), catalog });
    return controller;
  }

  return Object.freeze({
    STORAGE_KEY,
    SESSION_LENGTH,
    MODES,
    DIFFICULTIES,
    TYPE_COLORS,
    createCatalog,
    weightedPick,
    createTrainer
  });
});
