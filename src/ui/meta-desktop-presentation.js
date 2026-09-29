(() => {
  const ranking = document.getElementById("metaRanking");
  if (!ranking) return;

  const byId = id => document.getElementById(id);
  const desktop = () => matchMedia("(min-width: 1100px)").matches;

  function scrollToEntry(id) {
    let entry = ranking.querySelector(`:scope > .meta-entry[data-meta-entry="${CSS.escape(id)}"]`);
    for (let i = 0; !entry && i < 50; i++) {
      const next = ranking.querySelector("[data-meta-load-more] button");
      if (!next) break;
      next.click();
      entry = ranking.querySelector(`:scope > .meta-entry[data-meta-entry="${CSS.escape(id)}"]`);
    }
    const row = entry?.querySelector("[data-meta-expand]");
    if (!row) return;
    row.scrollIntoView({ block: "start", behavior: "smooth" });
    if (row.getAttribute("aria-expanded") !== "true") row.click();
  }

  function makeOverviewSection(title, rows, kind, denominator) {
    const section = document.createElement("section");
    section.className = "meta-lab-overview-section";
    const heading = document.createElement("h3");
    heading.textContent = title;
    section.appendChild(heading);
    const list = document.createElement("div");
    list.className = "meta-lab-overview-list";

    rows.forEach(([name, total, id]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "meta-lab-overview-row";
      if (kind === "type") button.dataset.metaOverviewType = name.toLowerCase();
      if (kind === "move") button.dataset.metaOverviewMove = name;
      if (kind === "entry") button.dataset.metaOverviewEntry = id;
      button.title = kind === "entry" ? `Open ${name} matchups` : `Filter by ${name}`;
      if (kind === "entry") {
        const result = title.startsWith("Key wins") ? "wins" : "losses";
        button.setAttribute("aria-label", `${name} appears among the key ${result} of ${total} Top 50 Pokemon. Open matchups.`);
      }
      const label = document.createElement("span");
      label.className = "meta-lab-overview-name";
      label.textContent = name;
      const count = document.createElement("span");
      count.className = "meta-lab-overview-count";
      count.textContent = kind === "entry" ? `${total} / 50` : String(total);
      button.append(label, count);
      if (kind !== "entry") {
        const track = document.createElement("span");
        track.className = "meta-lab-overview-track";
        const fill = document.createElement("span");
        fill.style.width = `${Math.min(100, Math.round(total / denominator * 100))}%`;
        if (kind === "type") fill.style.setProperty("--overview-color", typeColors[name.toLowerCase()] || "#76bac1");
        track.appendChild(fill);
        button.appendChild(track);
      }
      list.appendChild(button);
    });
    section.appendChild(list);
    return section;
  }

  function topFiveTallies(entries, details, key) {
    const tallies = new Map();
    entries.forEach(entry => {
      const rows = details.entries?.[entry.dataset.metaEntry]?.[key] || [];
      rows.slice(0, 5).forEach(item => {
        if (!item.id) return;
        const previous = tallies.get(item.id) || { name: item.name || item.id, count: 0 };
        previous.count++;
        tallies.set(item.id, previous);
      });
    });
    return [...tallies].sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
      .slice(0, 4).map(([id, item]) => [item.name, item.count, id]);
  }

  function ensureOverview() {
    if (document.body.dataset.view !== "meta" || !desktop()) return;
    const allEntries = [...ranking.querySelectorAll(":scope > .meta-entry")];
    const entries = allEntries.slice(0, 50);
    let overview = ranking.querySelector(":scope > .meta-lab-overview");
    if (!entries.length) {
      overview?.remove();
      return;
    }
    if (!overview) {
      overview = document.createElement("aside");
      overview.className = "meta-lab-overview";
      overview.setAttribute("aria-label", "Top 50 snapshot");
      overview.addEventListener("click", event => {
        const button = event.target.closest("button");
        if (!button) return;
        if (button.dataset.metaOverviewType) {
          const select = byId("metaTypeFilter");
          select.value = button.dataset.metaOverviewType;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (button.dataset.metaOverviewMove) {
          const input = byId("metaMoveFilter");
          input.value = button.dataset.metaOverviewMove;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        } else if (button.dataset.metaOverviewEntry) {
          scrollToEntry(button.dataset.metaOverviewEntry);
        }
      });
      ranking.appendChild(overview);
    }
    overview.style.gridRow = `1 / span ${Math.max(1, allEntries.length)}`;

    const role = byId("metaRankingRole")?.value || "overall";
    const filtered = Boolean(byId("metaSearch")?.value || byId("metaTypeFilter")?.value || byId("metaMoveFilter")?.value);
    const signature = [role, filtered, ...entries.map(entry => entry.dataset.metaEntry)].join("|");
    if (overview.dataset.signature === signature) return;
    overview.dataset.signature = signature;

    const count = (values, limit) => [...values.reduce((map, value) => {
      if (value) map.set(value, (map.get(value) || 0) + 1);
      return map;
    }, new Map())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
    const types = count(entries.flatMap(entry => [...entry.querySelectorAll(".meta-mon .type-badge")].map(badge => badge.textContent.trim())), 5);
    const moves = count(entries.map(entry => entry.querySelector(".meta-move-pill.fast span")?.textContent.trim()), 5);
    const head = document.createElement("header");
    head.className = "meta-lab-overview-head";
    const title = document.createElement("strong");
    title.textContent = filtered ? "Filtered snapshot" : "Top 50 snapshot";
    const summary = document.createElement("span");
    summary.textContent = `${entries.length} shown · ${role === "overall" ? "Overall" : role[0].toUpperCase() + role.slice(1)}`;
    head.append(title, summary);

    const grid = document.createElement("div");
    grid.className = "meta-lab-overview-grid";
    const typeSection = makeOverviewSection("Types", types, "type", entries.length);
    typeSection.title = "Dual-type Pokemon count under both types.";
    grid.append(typeSection, makeOverviewSection("Fast Moves", moves, "move", entries.length));
    const children = [head, grid];

    const rankingData = window.GREAT_LEAGUE_RANKINGS;
    const details = window.GREAT_LEAGUE_RANKING_DETAILS;
    const metadata = rankingData?.metadata;
    const currentDetails = details?.sourceRankingGeneratedAt === metadata?.generatedAt
      && details?.sourceMovesetHash === metadata?.movesetHash
      && details?.sourceGameMasterHash === metadata?.gameMasterHash
      && details?.sourceMatrixVersion === metadata?.matrixVersion;
    if (role === "overall" && !filtered && entries.length === 50 && currentDetails) {
      const threats = document.createElement("div");
      threats.className = "meta-lab-overview-threats";
      threats.title = "Number of Top 50 Pokemon listing each opponent among their five key wins or losses.";
      threats.append(
        makeOverviewSection("Key wins · Top 50", topFiveTallies(entries, details, "wins"), "entry", entries.length),
        makeOverviewSection("Key losses · Top 50", topFiveTallies(entries, details, "losses"), "entry", entries.length)
      );
      children.push(threats);
    }
    overview.replaceChildren(...children);
  }

  function decorateMetaRows() {
    if (document.body.dataset.view !== "meta") return;
    const colors = Object.entries(typeColors);
    document.querySelectorAll(".meta-entry").forEach(entry => {
      const name = entry.querySelector(".meta-mon strong");
      if (name) {
        const lineHeight = parseFloat(getComputedStyle(name).lineHeight);
        const lines = Math.min(3, Math.max(1, Math.round(name.getBoundingClientRect().height / lineHeight)));
        entry.dataset.labNameLines = String(lines);
      }
      entry.querySelectorAll(".meta-move-pill:not([data-meta-icon-ready])").forEach(pill => {
        const color = pill.style.getPropertyValue("--move-type").trim().toLowerCase();
        const match = colors.find(([, value]) => value.toLowerCase() === color);
        if (match) {
          pill.style.setProperty("--move-icon", `url("${metaTypeIconDataUri(match[0], color)}")`);
        }
        pill.dataset.metaIconReady = "true";
      });
    });
  }

  let scoreHelpPinned = false;
  const scoreHelpText = "Higher is better within this ranking. This score summarizes simulated results against weighted meta opponents; it is not a single matchup rating.";

  function scoreTooltip() {
    let tooltip = byId("metaLabScoreTooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.id = "metaLabScoreTooltip";
      tooltip.className = "meta-lab-score-tooltip";
      tooltip.setAttribute("role", "tooltip");
      tooltip.textContent = scoreHelpText;
      tooltip.hidden = true;
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }

  function showScoreHelp(score) {
    const tooltip = scoreTooltip();
    tooltip.hidden = false;
    score.setAttribute("aria-expanded", "true");
    document.querySelectorAll(".meta-score[data-meta-score-help]").forEach(other => {
      if (other !== score) other.setAttribute("aria-expanded", "false");
    });
    const rect = score.getBoundingClientRect();
    const width = tooltip.getBoundingClientRect().width;
    const height = tooltip.getBoundingClientRect().height;
    tooltip.style.left = `${Math.max(12, Math.min(rect.right - width, innerWidth - width - 12))}px`;
    tooltip.style.top = `${rect.bottom + height + 8 <= innerHeight ? rect.bottom + 7 : rect.top - height - 7}px`;
  }

  function ensureScoreHelp() {
    if (document.body.dataset.view !== "meta") {
      const tooltip = byId("metaLabScoreTooltip");
      if (tooltip) tooltip.hidden = true;
      return;
    }
    scoreTooltip();
    document.querySelectorAll(".meta-entry .meta-score:not([data-meta-score-help])").forEach(score => {
      score.dataset.metaScoreHelp = "true";
      score.tabIndex = 0;
      score.setAttribute("role", "button");
      score.setAttribute("aria-label", `Ranking score ${score.querySelector("strong")?.textContent.trim() || ""}. Show explanation.`);
      score.setAttribute("aria-expanded", "false");
      score.setAttribute("aria-describedby", "metaLabScoreTooltip");
      score.removeAttribute("title");
    });
  }

  document.addEventListener("pointerover", event => {
    const score = event.target.closest?.(".meta-score[data-meta-score-help]");
    if (score && document.body.dataset.view === "meta" && !scoreHelpPinned) showScoreHelp(score);
  });
  document.addEventListener("pointerout", event => {
    const score = event.target.closest?.(".meta-score[data-meta-score-help]");
    if (score && !score.contains(event.relatedTarget) && !scoreHelpPinned) {
      const tooltip = byId("metaLabScoreTooltip");
      if (tooltip) tooltip.hidden = true;
      score.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("focusin", event => {
    const score = event.target.closest?.(".meta-score[data-meta-score-help]");
    if (score) showScoreHelp(score);
  });
  document.addEventListener("focusout", event => {
    if (event.target.matches?.(".meta-score[data-meta-score-help]")) {
      const tooltip = byId("metaLabScoreTooltip");
      if (tooltip) tooltip.hidden = true;
      event.target.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("click", event => {
    const score = event.target.closest?.(".meta-score[data-meta-score-help]");
    if (!score) {
      if (scoreHelpPinned) {
        scoreHelpPinned = false;
        const tooltip = byId("metaLabScoreTooltip");
        if (tooltip) tooltip.hidden = true;
      }
      return;
    }
    event.stopPropagation();
    scoreHelpPinned = true;
    showScoreHelp(score);
  }, true);
  document.addEventListener("keydown", event => {
    const score = event.target.closest?.(".meta-score[data-meta-score-help]");
    if (score && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
      scoreHelpPinned = true;
      showScoreHelp(score);
    } else if (event.key === "Escape") {
      scoreHelpPinned = false;
      const tooltip = byId("metaLabScoreTooltip");
      if (tooltip) tooltip.hidden = true;
      document.querySelectorAll(".meta-score[aria-expanded='true']").forEach(node => node.setAttribute("aria-expanded", "false"));
    }
  }, true);
  window.addEventListener("scroll", () => {
    const tooltip = byId("metaLabScoreTooltip");
    if (tooltip) tooltip.hidden = true;
    scoreHelpPinned = false;
  }, { passive: true });

  function syncStickyChrome() {
    if (document.body.dataset.view !== "meta" || !desktop()) {
      document.body.style.removeProperty("--meta-lab-header-height");
      document.body.style.removeProperty("--meta-lab-toolbar-height");
      return;
    }
    const header = document.querySelector("body > header");
    const toolbar = document.querySelector(".meta-panel-head");
    if (header) document.body.style.setProperty("--meta-lab-header-height", `${header.getBoundingClientRect().height}px`);
    if (toolbar) document.body.style.setProperty("--meta-lab-toolbar-height", `${toolbar.getBoundingClientRect().height}px`);
  }

  function refresh() {
    decorateMetaRows();
    ensureScoreHelp();
    ensureOverview();
    syncStickyChrome();
  }

  document.addEventListener("click", event => {
    if (!desktop()) return;
    const row = event.target.closest("[data-meta-expand]");
    if (!row) return;
    ranking.querySelectorAll(":scope > .meta-entry.expanded").forEach(entry => {
      if (entry.contains(row)) return;
      entry.classList.remove("expanded");
      entry.querySelector("[data-meta-expand]")?.setAttribute("aria-expanded", "false");
    });
  }, true);

  const observer = new MutationObserver(() => requestAnimationFrame(refresh));
  observer.observe(ranking, { childList: true, characterData: true, subtree: true });
  observer.observe(document.body, { attributes: true, attributeFilter: ["data-view"] });
  window.addEventListener("resize", refresh, { passive: true });
  refresh();
})();
