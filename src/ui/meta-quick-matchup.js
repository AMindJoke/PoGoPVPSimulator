(() => {
  const ranking = document.getElementById("metaRanking");
  if (!ranking) return;
  const model = window.PvPeakMetaQuickMatchupModel;
  const wide = matchMedia("(min-width: 1100px)");
  let workerSource = null, selection = null, state = null, selectedShields = "1-1", trigger = null;
  const runner = model.createRunner(() => {
    workerSource ||= buildMatrixComputeWorkerSource();
    const url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
    try { return new Worker(url); } finally { URL.revokeObjectURL(url); }
  });
  const panel = document.createElement("aside");
  panel.className = "meta-quick-panel";
  panel.setAttribute("aria-label", "Quick matchup");
  panel.hidden = true;
  const dialog = document.createElement("dialog");
  dialog.className = "meta-quick-dialog";
  dialog.setAttribute("aria-label", "Quick matchup");
  document.body.appendChild(dialog);

  function attach() {
    if (!selection) return;
    if (wide.matches) {
      if (dialog.open) dialog.close();
      if (panel.parentNode !== ranking) ranking.appendChild(panel);
      panel.style.gridRow = `1 / span ${Math.max(1, ranking.querySelectorAll(":scope > .meta-entry").length)}`;
    } else {
      if (panel.parentNode !== dialog) dialog.appendChild(panel);
      if (!dialog.open) dialog.showModal();
    }
    ranking.classList.toggle("meta-quick-open", wide.matches);
  }

  function close(restoreFocus = true) {
    runner.cancel();
    selection = null;
    state = null;
    panel.hidden = true;
    ranking.classList.remove("meta-quick-open");
    if (dialog.open) dialog.close();
    if (restoreFocus) (trigger?.isConnected ? trigger : document.getElementById("metaSearch"))?.focus({ preventScroll: true });
  }

  function combatantHtml(combatant, result, side) {
    const moves = [combatant.fast, ...combatant.charged];
    const hpRatio = result ? Math.max(0, Math.min(1, Number(result.details?.[`${side}Hp`]) || 0)) : null;
    const hp = hpRatio === null ? null : Math.round(hpRatio * combatant.maxHp);
    const energy = result ? Math.max(0, Math.min(100, Number(result.details?.[`${side}Energy`]) || 0)) : null;
    const hpLabel = `${combatant.p.name}: ${hp === null ? "calculating final HP" : `${hp} / ${combatant.maxHp} final HP`}`;
    // Reuse Battle's orbs without its interactive attributes: this is a static summary.
    const orbs = combatant.charged.map((move, index) => energyMoveOrb(move, energy || 0, "quick", index)
      .replace(/ data-prefix="quick" data-move-index="\d+"/, ` role="img" aria-label="${escapeHtml(`${move.name}: ${energy === null ? "calculating energy" : `${energy} energy / ${move.energyCost} required`}`)}"`));
    return `<div class="meta-quick-pokemon"><div class="meta-quick-identity"><img src="${escapeHtml(imageUrl(combatant.p))}" alt=""><strong>${escapeHtml(combatant.p.name)}</strong></div>
      <div class="meta-quick-moves">${[0,1,2].map(index => moves[index] ? metaMovePill(moves[index], index === 0 ? "fast" : "charged") : '<span aria-hidden="true"></span>').join("")}</div>
      <div class="meta-quick-hp${hp === null ? " pending" : ""}" role="meter" aria-label="${escapeHtml(hpLabel)}" aria-valuemin="0" aria-valuemax="${combatant.maxHp}" ${hp === null ? "" : `aria-valuenow="${hp}"`} title="${escapeHtml(hpLabel)}"><span style="width:${(hpRatio || 0) * 100}%;background:${hpRatio > .45 ? "var(--good)" : hpRatio > .2 ? "var(--warn)" : "var(--danger)"}"></span></div>
      <div class="meta-quick-energy">${orbs[0] || ""}<strong title="Final energy"><span class="sr-only">Final energy: </span>${energy === null ? "…" : energy}</strong>${orbs.slice(1).join("")}</div></div>`;
  }

  function timelineHtml(result) {
    const timeline = model.compactTimelineModel(result.timelineTrace, chargeWindowTurns, chargePauseTurns);
    const combatants = { A: selection.config.left, B: selection.config.right };
    const percent = turn => turn / timeline.visualTurns * 100;
    const lanes = ["A", "B"].map(side => {
      const combatant = combatants[side];
      const events = timeline.rows.filter(event => event.trainer === side).map(event => {
        const move = [combatant.fast, ...combatant.charged].find(move => move?.id === event.moveId) || moveMap.get(event.moveId);
        const color = typeColors[move?.type] || "#66788c";
        const shield = event.kind === "shield" || event.kind === "form-protect";
        const label = `${shield ? event.kind === "form-protect" ? "Disguise" : "Shield" : event.moveName || "Move"} · Turn ${event.start}`;
        const icon = shield ? event.kind === "form-protect" ? disguiseSvg() : shieldSvg() : "";
        const trail = event.kind === "charge" ? `<span class="meta-quick-charge-trail" style="left:${percent(event.visualStart)}%;width:${percent(event.visualTurn - event.visualStart)}%;--event-color:${color}" aria-hidden="true"></span>` : "";
        return `${trail}<span class="meta-quick-event ${shield ? "shield" : event.kind}" role="img" style="left:${percent(event.visualTurn)}%;--event-color:${color};--event-icon:url('${metaTypeIconDataUri(move?.type || "normal", color)}')" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${icon}</span>`;
      }).join("");
      const hp = Math.round(Number(result.details?.[side === "A" ? "aHp" : "bHp"] || 0) * combatant.maxHp);
      return `<div class="meta-quick-lane" aria-label="${escapeHtml(combatant.p.name)} actions"><div class="meta-quick-track">${events}${hp === 0 ? `<span class="meta-quick-ko" role="img" aria-label="${escapeHtml(combatant.p.name)} KO" title="KO" style="left:${percent(timeline.visualTurns - 1)}%">×</span>` : ""}</div></div>`;
    }).join("");
    const labels = ["A", "B"].map(side => `<div class="meta-quick-lane-label" title="${escapeHtml(combatants[side].p.name)}"><img src="${escapeHtml(imageUrl(combatants[side].p))}" alt="${escapeHtml(combatants[side].p.name)}"></div>`).join("");
    return `<section class="meta-quick-timeline" aria-label="Matchup timeline">
      <div class="meta-quick-timeline-grid"><div class="meta-quick-lane-labels"><span>Turn</span>${labels}</div><div class="meta-quick-timeline-scroll" tabindex="0" aria-label="Battle timeline; scroll horizontally for longer matchups"><div class="meta-quick-timeline-content" style="--quick-timeline-width:${timeline.minWidth}px"><div class="meta-quick-ruler">${timeline.ticks.map(tick => `<span style="left:${percent(tick.visualTurn)}%">${tick.turn}</span>`).join("")}</div>${lanes}</div></div></div>
      </section>`;
  }

  function render() {
    if (!selection || !state) return;
    const focusedCell = panel.contains(document.activeElement) ? document.activeElement.dataset.quickShields : null;
    const focusedAction = panel.contains(document.activeElement) ? document.activeElement.dataset.quickAction : null;
    const result = state.cells[selectedShields];
    const [aShields, bShields] = selectedShields.split("-");
    const outcome = result ? result.score > 500 ? `${selection.config.left.p.name} wins` : result.score < 500 ? `${selection.config.right.p.name} wins` : "Draw" : "Calculating matchup…";
    panel.setAttribute("aria-busy", String(state.status === "loading"));
    panel.innerHTML = `<header class="meta-quick-head"><h2>Quick Matchup</h2><button type="button" data-quick-action="close" aria-label="${wide.matches ? "Back to Top 50 snapshot" : "Close quick matchup"}" title="${wide.matches ? "Back to Top 50 snapshot" : "Close"}">×</button></header>
      <div class="meta-quick-pair">${combatantHtml(selection.config.left, result, "a")}<span class="meta-quick-vs">VS</span>${combatantHtml(selection.config.right, result, "b")}</div>
      <div class="sr-only" role="status">${escapeHtml(outcome)} · ${aShields}–${bShields} shields${result ? ` · Score ${Math.round(result.score)}` : ""}</div>
      ${state.status === "error" ? `<p class="meta-quick-error" role="alert">The preview could not be completed. <button data-quick-action="retry" type="button">Retry</button></p>` : ""}
      ${result ? timelineHtml(result) : `<div class="meta-quick-loading">${state.status === "error" ? "Select an available shield scenario or retry." : "Preparing the timeline…"}</div>`}
      <section class="meta-quick-matrix" aria-label="Shield matchup matrix">
      <table><caption class="sr-only">Scores from ${escapeHtml(selection.config.left.p.name)}'s perspective. ${escapeHtml(selection.config.left.p.name)} rows; ${escapeHtml(selection.config.right.p.name)} columns.</caption><thead><tr><th scope="col" title="Shields"><span class="sr-only">Shields</span></th>${[0,1,2].map(shields => `<th scope="col">${shieldCountLabel(shields)}</th>`).join("")}</tr></thead><tbody>${[0,1,2].map(a => `<tr><th scope="row">${shieldCountLabel(a)}</th>${[0,1,2].map(b => {
        const key = `${a}-${b}`, cell = state.cells[key];
        const score = cell ? Math.round(cell.score) : "…";
        const heat = cell ? matrixHeat(cell.score) : null;
        return `<td><button type="button" class="${cell ? "ready" : "pending"}" ${heat ? `style="--edge-color:${heat.color};--edge-opacity:${heat.opacity}"` : ""} data-quick-shields="${key}" aria-pressed="${key === selectedShields}" aria-label="${a} shields versus ${b} shields, ${cell ? `score ${score}` : "calculating"}"><span class="matrix-value">${heat ? `<span class="matrix-symbol direction-${heat.direction} intensity-${heat.intensity}">${heat.symbol}</span>` : ""}${score}</span></button></td>`;
      }).join("")}</tr>`).join("")}</tbody></table></section>
      <footer><button type="button" class="meta-quick-battle" data-quick-action="battle">Open in Battle ↗</button></footer>`;
    attach();
    if (focusedCell) panel.querySelector(`[data-quick-shields="${focusedCell}"]`)?.focus({ preventScroll: true });
    else if (focusedAction) panel.querySelector(`[data-quick-action="${focusedAction}"]`)?.focus({ preventScroll: true });
  }

  function run() {
    const key = `${battleEngineVersion}|${activeSeasonData.id}|${matrixCombatantSignature(selection.config.left)}>${matrixCombatantSignature(selection.config.right)}`;
    runner.start(selection.config, key, update => { state = update; render(); });
  }

  function open(sourceId, opponentId, sourceButton) {
    const a = findPokemon(sourceId), b = findPokemon(opponentId);
    if (!a || !b) return;
    const config = createMetaRankingBattleConfig(a, b);
    [config.left, config.right].forEach(combatant => {
      const moves = metaRankingMoves(metaRankingDatasetEntry(combatant.p.id), combatant.p);
      combatant.fast = cloneMatrixMove(moves.fast);
      combatant.charged = moves.charged.map(cloneMatrixMove);
    });
    selection = { sourceId, opponentId, config };
    selectedShields = "1-1";
    trigger = sourceButton || document.activeElement;
    panel.hidden = false;
    run();
    panel.querySelector("[data-quick-action='close']")?.focus({ preventScroll: true });
  }

  panel.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || !selection) return;
    if (button.dataset.quickShields) {
      selectedShields = button.dataset.quickShields;
      runner.prioritize(selectedShields);
      render();
    } else if (button.dataset.quickAction === "close") close();
    else if (button.dataset.quickAction === "retry") run();
    else if (button.dataset.quickAction === "battle") {
      const options = { config: selection.config, aShields: Number(selectedShields[0]), bShields: Number(selectedShields[2]) };
      const { sourceId, opponentId } = selection;
      close(false);
      loadMetaMatchup(sourceId, opponentId, options);
    }
  });
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && selection && wide.matches) { event.preventDefault(); close(); }
  });
  new MutationObserver(attach).observe(ranking, { childList: true });
  new MutationObserver(() => { if (document.body.dataset.view !== "meta") close(false); }).observe(document.body, { attributes: true, attributeFilter: ["data-view"] });
  wide.addEventListener("change", () => { if (selection) render(); });
  window.PvPeakMetaQuickMatchup = Object.freeze({ open, close });
})();
