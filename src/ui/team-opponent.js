(function (root) {
  "use strict";
  root.PvPeakTeamOpponentUI = { create(options) {
    const $ = id => document.getElementById(id), escape = options.escapeHtml;
    const section = $("teamOpponentPanel");
    let mobileSlot = 0;
    function sprite(member, attr) { return member ? `<img ${attr} alt="${escape(member.name)}">` : ""; }
    function cell(member, ownSlot, opponentSlot, result, includeName = false) {
      if (!member) return '<span class="opponent-empty-cell" aria-label="Empty team slot">—</span>';
      const label = result ? options.resultLabel(result) : "Not calculated";
      const name = `${member.name} versus ${options.opponent().team[opponentSlot].name}: ${label}${result ? `. Rating ${result.score}. Open Battle` : ""}`;
      return `<button type="button" class="opponent-matchup${includeName ? " is-mobile" : ""}" data-opponent-battle="${ownSlot}" data-opponent-slot="${opponentSlot}" aria-label="${escape(name)}" title="${escape(name)}"${result ? "" : " disabled"}>${includeName ? `${sprite(member, `data-own-result-sprite="${ownSlot}"`)}<strong>${escape(member.name)}</strong>` : ""}${result ? options.resultMarkup(result) : '<span class="opponent-empty-cell">—</span>'}${includeName ? `<small>${escape(label)}</small>` : ""}</button>`;
    }
    function rowLabel(row) {
      if (!row.ready) return "Pending";
      return `${row.wins} ${row.wins === 1 ? "win" : "wins"}${row.draws ? ` · ${row.draws} ${row.draws === 1 ? "draw" : "draws"}` : ""}`;
    }
    function render() {
      const own = options.own(), opponent = options.opponent(), plan = options.plan(), cache = options.cache;
      const roster = $("teamOpponentRoster");
      roster.innerHTML = opponent.team.map(options.renderSlot).join("");
      opponent.team.forEach((member, index) => { if (member) options.setSprite(roster.querySelector(`[data-team-sprite="${index}"]`), member); });
      $("teamOpponentCount").textContent = `${opponent.team.filter(Boolean).length} of 6 selected`;
      $("teamOpponentSave").disabled = !opponent.team.some(Boolean);
      $("teamOpponentClear").disabled = !opponent.team.some(Boolean);
      options.rosterPresentation();
      renderResults();
    }
    function renderResults() {
      const own = options.own(), opponent = options.opponent(), plan = options.plan(), cache = options.cache;
      const rows = root.PvPeakTeamOpponent.rows(plan, cache);
      const prepared = plan.filter(job => cache.has(job.key)).length;
      const active = options.isActive();
      $("teamOpponentAnalyze").disabled = !plan.length || active;
      $("teamOpponentAnalyze").textContent = prepared === plan.length && plan.length ? "Recheck matchups" : "Analyze matchups";
      $("teamOpponentCancel").hidden = !active;
      $("teamOpponentStatus").textContent = !plan.length ? "Add Pokémon to both teams to compare matchups." : active ? `Preparing ${prepared} / ${plan.length} matchups…` : `${prepared} / ${plan.length} matchups ready${options.failed() ? ` · ${options.failed()} failed. Retry the remaining matchups.` : ""}`;
      ["A", "B"].forEach(side => { $("teamOpponentShields" + side).value = opponent.shields?.[side] ?? "1"; });
      $("teamOpponentResults").hidden = !rows.length;
      const table = $("teamOpponentTable");
      table.innerHTML = `<thead><tr><th scope="col">Opponent / Your team</th>${own.team.map((member, index) => `<th scope="col">${sprite(member, `data-own-sprite="${index}"`)}<span>${escape(member?.name || `Slot ${index + 1}`)}</span></th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr><th scope="row">${sprite(row.member, `data-opponent-sprite="${row.slot}"`)}<span>${escape(row.member.name)}</span><small class="${row.ready && !row.wins ? "is-threat" : ""}">${rowLabel(row)}</small>${row.best != null ? `<small>Best: ${escape(own.team[row.best].name)}</small>` : ""}</th>${own.team.map((member, index) => `<td>${cell(member, index, row.slot, row.cells[index])}</td>`).join("")}</tr>`).join("")}</tbody>`;
      own.team.forEach((member, index) => { if (member) options.setSprite(table.querySelector(`[data-own-sprite="${index}"]`), member); });
      rows.forEach(row => options.setSprite(table.querySelector(`[data-opponent-sprite="${row.slot}"]`), row.member));
      mobileSlot = Math.max(0, Math.min(rows.length - 1, mobileSlot));
      const current = rows[mobileSlot];
      const mobile = $("teamOpponentMobile");
      mobile.innerHTML = current ? `<div class="opponent-mobile-head"><button type="button" class="secondary" data-opponent-page="-1" aria-label="Previous opponent"${mobileSlot === 0 ? " disabled" : ""}>‹</button><div>${sprite(current.member, 'data-mobile-opponent-sprite')}<strong>${escape(current.member.name)}</strong><small>${rowLabel(current)} · ${mobileSlot + 1}/${rows.length}</small></div><button type="button" class="secondary" data-opponent-page="1" aria-label="Next opponent"${mobileSlot === rows.length - 1 ? " disabled" : ""}>›</button></div><div class="opponent-mobile-grid">${own.team.map((member, index) => cell(member, index, current.slot, current.cells[index], true)).join("")}</div>${current.best != null ? `<p>Best answer: <strong>${escape(own.team[current.best].name)}</strong></p>` : ""}` : "";
      if (current) options.setSprite(mobile.querySelector("[data-mobile-opponent-sprite]"), current.member);
      own.team.forEach((member, index) => { const img = mobile.querySelector(`[data-own-result-sprite="${index}"]`); if (img && member) options.setSprite(img, member); });
    }
    $("teamOpponentRoster").onclick = event => {
      const button = event.target.closest("button"); if (!button) return;
      if (button.dataset.teamAdd != null || button.dataset.teamReplace != null) options.pick(Number(button.dataset.teamAdd ?? button.dataset.teamReplace), button);
      else if (button.dataset.teamEdit != null) options.edit(Number(button.dataset.teamEdit), button);
      else if (button.dataset.teamRemove != null) options.remove(Number(button.dataset.teamRemove));
    };
    $("teamOpponentResults").onclick = event => {
      const button = event.target.closest("button"); if (!button) return;
      if (button.dataset.opponentBattle != null) options.battle(Number(button.dataset.opponentBattle), Number(button.dataset.opponentSlot));
      else if (button.dataset.opponentPage) { mobileSlot += Number(button.dataset.opponentPage); renderResults(); }
    };
    $("teamOpponentAnalyze").onclick = options.analyze;
    $("teamOpponentCancel").onclick = options.cancel;
    $("teamOpponentLoad").onclick = options.load;
    $("teamOpponentSave").onclick = options.save;
    $("teamOpponentClear").onclick = options.clear;
    ["A", "B"].forEach(side => { $("teamOpponentShields" + side).onchange = event => options.shields(side, event.target.value); });
    return { render, renderResults, open() { section.open = true; render(); } };
  } };
})(globalThis);
