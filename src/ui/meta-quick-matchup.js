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

  function combatantHtml(combatant) {
    const moves = [combatant.fast, ...combatant.charged].filter(Boolean);
    return `<div class="meta-quick-pokemon"><img src="${escapeHtml(imageUrl(combatant.p))}" alt=""><strong>${escapeHtml(combatant.p.name)}</strong>
      <small>${combatant.cp} CP · ${combatant.ivAtk}/${combatant.ivDef}/${combatant.ivHp}</small>
      <div class="meta-quick-moves">${moves.map((move, index) => metaMovePill(move, index === 0 ? "fast" : "charged")).join("")}</div></div>`;
  }

  function timelineHtml(result) {
    const timeline = model.timelineModel(result.timelineTrace);
    const names = { A: selection.config.left.p.name, B: selection.config.right.p.name };
    const lanes = ["A", "B"].map(side => `<div class="meta-quick-lane"><strong>${escapeHtml(names[side])}</strong><div class="meta-quick-track">${timeline.rows.filter(event => event.trainer === side).map(event => {
      const rawKind = String(event.kind || "fast").toLowerCase();
      const kind = rawKind === "charge" ? "charged" : rawKind;
      const symbol = kind === "charged" ? "●" : kind === "shield" ? "◇" : kind === "ko" ? "×" : "";
      const label = `${event.moveName || kind} · turn ${event.start} · ${Math.round(event.damage || 0)} damage`;
      return `<span class="meta-quick-event ${kind === "charged" ? "charged" : kind === "shield" ? "shield" : kind === "ko" ? "ko" : "fast"}" style="left:${event.start / timeline.turns * 100}%;width:${Math.max(.8, event.duration / timeline.turns * 100)}%" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${symbol}</span>`;
    }).join("")}</div></div>`).join("");
    const detail = result.details || {};
    const hpA = Math.round(Number(detail.aHp ?? detail.hpRatioA ?? 0) * selection.config.left.maxHp);
    const hpB = Math.round(Number(detail.bHp ?? detail.hpRatioB ?? 0) * selection.config.right.maxHp);
    return `<section class="meta-quick-timeline" aria-label="Matchup timeline"><div class="meta-quick-section-head"><h3>Timeline</h3><span>${timeline.turns} turns · ${timeline.seconds}s</span></div>
      ${lanes}<div class="meta-quick-axis"><span>0s</span><span>${timeline.seconds / 2}s</span><span>${timeline.seconds}s</span></div>
      <p class="meta-quick-legend"><i class="fast"></i>Fast <i class="charged"></i>Charged <i class="shield"></i>Shield</p>
      <p class="meta-quick-hp">Remaining HP <strong>${hpA} / ${selection.config.left.maxHp}</strong><span>vs</span><strong>${hpB} / ${selection.config.right.maxHp}</strong></p></section>`;
  }

  function render() {
    if (!selection || !state) return;
    const focusedCell = panel.contains(document.activeElement) ? document.activeElement.dataset.quickShields : null;
    const focusedAction = panel.contains(document.activeElement) ? document.activeElement.dataset.quickAction : null;
    const result = state.cells[selectedShields];
    const [aShields, bShields] = selectedShields.split("-");
    const outcome = result ? result.score > 500 ? `${selection.config.left.p.name} wins` : result.score < 500 ? `${selection.config.right.p.name} wins` : "Draw" : "Calculating matchup…";
    panel.setAttribute("aria-busy", String(state.status === "loading"));
    panel.innerHTML = `<header class="meta-quick-head"><div><small>LIVE PREVIEW</small><h2>Quick Matchup</h2></div><button type="button" data-quick-action="close" aria-label="${wide.matches ? "Back to Top 50 snapshot" : "Close quick matchup"}">${wide.matches ? "← Top 50" : "×"}</button></header>
      <div class="meta-quick-pair">${combatantHtml(selection.config.left)}<span class="meta-quick-vs">VS</span>${combatantHtml(selection.config.right)}</div>
      <div class="meta-quick-result" role="status"><div><strong>${escapeHtml(outcome)}</strong><small>${aShields}–${bShields} shields · Full HP · 0 energy</small></div>${result ? `<b class="${result.score > 500 ? "win" : result.score < 500 ? "loss" : "draw"}">${Math.round(result.score)}</b>` : ""}</div>
      ${state.status === "error" ? `<p class="meta-quick-error" role="alert">The preview could not be completed. <button data-quick-action="retry" type="button">Retry</button></p>` : ""}
      ${result ? timelineHtml(result) : `<div class="meta-quick-loading">${state.status === "error" ? "Select an available shield scenario or retry." : "Preparing the timeline…"}</div>`}
      <section class="meta-quick-matrix" aria-label="Shield matchup matrix"><div class="meta-quick-section-head"><h3>Shield matrix</h3><span>${Object.keys(state.cells).length}/9 ready</span></div>
      <p>${escapeHtml(selection.config.left.p.name)} rows · ${escapeHtml(selection.config.right.p.name)} columns</p>
      <table><caption class="sr-only">Scores from ${escapeHtml(selection.config.left.p.name)}'s perspective</caption><thead><tr><th scope="col">Shields</th>${[0,1,2].map(shields => `<th scope="col">${shields}</th>`).join("")}</tr></thead><tbody>${[0,1,2].map(a => `<tr><th scope="row">${a}</th>${[0,1,2].map(b => {
        const key = `${a}-${b}`, cell = state.cells[key];
        const score = cell ? Math.round(cell.score) : "…";
        return `<td><button type="button" class="${cell ? cell.score > 500 ? "win" : cell.score < 500 ? "loss" : "draw" : "pending"}" data-quick-shields="${key}" aria-pressed="${key === selectedShields}" aria-label="${a} shields versus ${b} shields, ${cell ? `score ${score}` : "calculating"}">${cell ? cell.score > 500 ? "▲ " : cell.score < 500 ? "▼ " : "= " : ""}${score}</button></td>`;
      }).join("")}</tr>`).join("")}</tbody></table></section>
      <footer><button type="button" class="meta-quick-battle" data-quick-action="battle">Open in Battle ↗</button><span>Uses the moves and IVs shown above.</span></footer>`;
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
    const config = createMetaBattleConfig(a, b);
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
