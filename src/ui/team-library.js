(function (root) {
  "use strict";
  root.PvPeakTeamLibraryUI = { create(options) {
    const $ = id => document.getElementById(id), api = root.PvPeakTeamLibrary;
    const dialog = $("teamLibraryDialog"), list = $("teamLibraryList"), status = $("teamLibraryStatus");
    let store, library, removed = null;
    const escape = options.escapeHtml;
    function focusTeam(id) {
      const row = [...list.querySelectorAll("[data-saved-team]")].find(element => element.dataset.savedTeam === id);
      (row?.querySelector("summary") || $("teamLibrarySearch")).focus();
    }
    function message(text, error = false) { status.textContent = text; status.classList.toggle("is-error", error); }
    function safely(action) {
      try { action(); } catch (error) { message(error.message || "Could not open browser storage.", true); }
    }
    function render() {
      const query = $("teamLibrarySearch").value.trim().toLowerCase();
      const teams = library.teams.filter(team => `${team.name} ${team.state.team.filter(Boolean).map(member => member.name).join(" ")}`.toLowerCase().includes(query));
      list.innerHTML = teams.length ? teams.map(team => `<article class="saved-team" data-saved-team="${escape(team.id)}"><div class="saved-team-main"><div class="saved-team-copy"><strong>${escape(team.name)}</strong><div class="saved-team-sprites">${team.state.team.map((member, index) => member ? `<img data-library-sprite="${index}" alt="${escape(member.name)}" title="${escape(member.name)}">` : '<span class="saved-team-empty" aria-hidden="true">·</span>').join("")}</div><small>${team.state.team.filter(Boolean).length}/6 · Great League · ${escape(team.state.analysisConfig.shields)} shields</small></div><button type="button" class="secondary" data-library-load>Load<span class="sr-only"> ${escape(team.name)}</span></button></div><details><summary>Manage<span class="sr-only"> ${escape(team.name)}</span></summary><form class="saved-team-rename"><label><span class="sr-only">Rename ${escape(team.name)}</span><input value="${escape(team.name)}" maxlength="64" required></label><button class="secondary" type="submit">Rename</button></form><div class="saved-team-tools"><button type="button" class="secondary" data-library-duplicate>Duplicate</button><button type="button" class="secondary" data-library-export>Export</button><button type="button" class="secondary saved-team-delete" data-library-remove>Delete</button></div></details></article>`).join("") : `<p class="team-library-empty">${query ? "No matching teams." : "Save your first team. Incomplete drafts are welcome too."}</p>`;
      teams.forEach(team => {
        const row = [...list.querySelectorAll("[data-saved-team]")].find(element => element.dataset.savedTeam === team.id);
        team.state.team.forEach((member, index) => { if (member) options.setSprite(row.querySelector(`[data-library-sprite="${index}"]`), member); });
        row.querySelector("[data-library-load]").onclick = () => safely(() => { options.load(api.snapshot(team)); dialog.close(); options.feedback(`Loaded ${team.name}.`); });
        row.querySelector("form").onsubmit = event => { event.preventDefault(); safely(() => { library = store.rename(team.id, row.querySelector("input").value); render(); focusTeam(team.id); message("Team renamed."); }); };
        row.querySelector("[data-library-duplicate]").onclick = () => safely(() => { library = store.add(`${team.name.slice(0, 57)} copy`, team); render(); focusTeam(library.teams[0].id); message("Team duplicated."); });
        row.querySelector("[data-library-export]").onclick = () => download({ schemaVersion: 1, teams: [team] }, team.name);
        row.querySelector("[data-library-remove]").onclick = () => safely(() => { library = store.remove(team.id); removed = team; $("teamLibraryUndo").hidden = false; render(); $("teamLibraryUndo").focus(); message(`Deleted ${team.name}.`); });
      });
      $("teamLibraryExport").disabled = library.teams.length === 0;
    }
    function download(value, fileName) {
      const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = `${fileName.replace(/[^a-z0-9_-]/gi, "_").slice(0, 64) || "team"}.json`;
      link.hidden = true; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    $("teamBuilderLibrary").onclick = () => {
      dialog.showModal(); message("");
      library = null; list.innerHTML = "";
      $("teamLibrarySave").disabled = true;
      $("teamLibraryImport").disabled = true;
      $("teamLibraryExport").disabled = true;
      safely(() => {
        store ||= api.createStore(window.localStorage); library = store.read(); render();
        $("teamLibrarySave").disabled = !options.snapshot().state.team.some(Boolean);
        $("teamLibraryImport").disabled = false;
      });
    };
    $("teamLibraryClose").onclick = () => dialog.close();
    dialog.addEventListener("close", () => $("teamBuilderLibrary").focus({ preventScroll: true }));
    $("teamLibrarySaveForm").onsubmit = event => {
      event.preventDefault(); safely(() => { const value = options.snapshot(); options.validate(value); library = store.add($("teamLibraryName").value, value); render(); message(`Saved ${library.teams[0].name}.`); $("teamLibraryName").value = ""; });
    };
    $("teamLibrarySearch").oninput = () => { if (library) render(); };
    $("teamLibraryUndo").onclick = () => safely(() => { library = store.merge({ schemaVersion: 1, teams: [removed] }); removed = null; $("teamLibraryUndo").hidden = true; render(); focusTeam(library.teams.at(-1)?.id); message("Team restored."); });
    $("teamLibraryExport").onclick = () => safely(() => download(JSON.parse(store.export()), "saved-teams"));
    $("teamLibraryImport").onclick = () => $("teamLibraryFile").click();
    $("teamLibraryFile").onchange = async event => {
      const file = event.target.files[0]; event.target.value = "";
      if (!file) return;
      try {
        if (file.size > api.MAX_BYTES) throw new Error("Choose a team JSON file smaller than 1 MB.");
        const imported = api.parse(await file.text()); imported.teams.forEach(options.validate);
        library = store.merge(imported); render(); message("Import complete. Existing teams were kept.");
      } catch (error) { message(error.message, true); }
    };
  } };
})(globalThis);
