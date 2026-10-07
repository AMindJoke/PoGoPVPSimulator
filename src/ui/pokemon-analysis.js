(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.PvPeakPokemonAnalysis = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function Section({ id, title, eyebrow, className = "", action = "", content }) {
    return `<section id="${escapeHtml(id)}" class="analysis-card ${escapeHtml(className)}">
      <header class="analysis-card-head">
        <div><span>${escapeHtml(eyebrow)}</span><h3>${escapeHtml(title)}</h3></div>${action}
      </header>
      <div class="analysis-card-body">${content}</div>
    </section>`;
  }

  function typeChips(types) {
    return (types || []).map(type => `<span class="analysis-type-chip" style="--type-color:${escapeHtml(type.color)};--type-text:${escapeHtml(type.textColor || "#fff")}">${escapeHtml(type.label)}</span>`).join("");
  }

  function moveChip(move, compact = false) {
    return `<span class="analysis-move-chip ${compact ? "compact" : ""}" style="--move-color:${escapeHtml(move.color)}"><small>${escapeHtml(move.kind)}</small><strong>${escapeHtml(move.name)}</strong><span>${escapeHtml(move.type)}</span></span>`;
  }

  function PokemonHeroCard(model) {
    const identity = model.identity;
    const loadout = model.recommendedMoves.primary.map(move => moveChip(move, true)).join("");
    const secondColor = identity.types[1]?.color || identity.types[0]?.color || "#66788c";
    const rating = identity.rating == null ? "-" : identity.rating;
    return `<section class="analysis-dossier-hero ${identity.types.length > 1 ? "dual-type" : "single-type"}" style="--hero-type-a:${escapeHtml(identity.types[0]?.color || "#66788c")};--hero-type-b:${escapeHtml(secondColor)}">
      <div class="analysis-hero-sprite-wrap"><img class="analysis-hero-sprite ${identity.shadow ? "shadow-pokemon" : ""}" src="${escapeHtml(identity.image)}" data-fallback="${escapeHtml(identity.fallbackImage)}" alt="${escapeHtml(identity.name)}"></div>
      <div class="analysis-hero-main">
        <span class="analysis-eyebrow">${escapeHtml(identity.league)} dossier</span>
        <div class="analysis-hero-title"><h2>${escapeHtml(identity.name)}</h2><span class="analysis-rank-badge">#${escapeHtml(identity.rank)}</span></div>
        <div class="analysis-hero-types">${typeChips(identity.types)}</div>
        <strong class="analysis-hero-role">${escapeHtml(identity.role)}</strong>
        ${loadout ? `<div class="analysis-hero-loadout" aria-label="Recommended moveset">${loadout}</div>` : ""}
        ${identity.movesetScoreStale ? `<p class="ranking-moveset-warning">Score reflects the previous moveset. Updated moves are shown above; key matchups are hidden until recalculated.</p>` : ""}
      </div>
      <aside class="analysis-rating-panel">
        <span class="analysis-eyebrow">Meta ranking score</span>
        <div class="analysis-rating-value"><strong>${escapeHtml(rating)}</strong><span>/ 1000</span></div>
        <div class="analysis-rating-track"><i style="width:${Math.max(0, Math.min(100, Number(rating) / 10 || 0))}%"></i></div>
        <p class="analysis-score-caption">Ranking index · not a win probability</p>
        <button type="button" class="analysis-primary-action" data-analysis-use-pokemon="${escapeHtml(model.id)}">Use in Battle</button>
      </aside>
    </section>`;
  }

  function PokemonSnapshot(model) {
    if (!model.availability.summary) return "";
    return `<section class="analysis-snapshot" aria-labelledby="analysisSnapshotTitle"><header><h3 id="analysisSnapshotTitle">At a glance</h3></header><div>${model.summary.facts.filter(fact => fact.label !== "Best role").map(fact => `<article><span><small>${escapeHtml(fact.label)}</small><strong>${escapeHtml(fact.value)}</strong></span></article>`).join("")}</div></section>`;
  }

  function PokemonIdentitySection(model) {
    const identity = model.competitiveIdentity;
    const categories = identity.categories.map(category => `<div><span>${escapeHtml(category.label)}</span><strong>${escapeHtml(category.score)}</strong></div>`).join("");
    return Section({
      id: "analysisIdentity",
      title: "Role comparison",
      eyebrow: "Ranking scenarios",
      className: "analysis-identity-card",
      content: `${categories ? `<div class="analysis-role-scores" aria-label="Role scores">${categories}</div>` : `<p>No role scores available.</p>`}<p>Scenario scores compare roles; they do not guarantee a safe switch or sweep.</p>`
    });
  }

  function PokemonMovesSection(model) {
    if (!model.availability.moves) return "";
    const rows = model.recommendedMoves.primary.map(move => `<li>${moveChip(move)}<b>Recommended</b></li>`).join("");
    const alternatives = model.recommendedMoves.alternatives.map(move => moveChip(move, true)).join("");
    return Section({
      id: "analysisMoves",
      title: "Recommended Loadout",
      eyebrow: "Moves",
      className: "analysis-loadout-card",
      content: `<ul class="analysis-loadout-list">${rows}</ul>${alternatives ? `<details class="analysis-disclosure"><summary aria-expanded="false"><span>Other available moves</span><b>${model.recommendedMoves.alternatives.length}</b></summary><div class="analysis-alternative-moves">${alternatives}</div></details>` : ""}`
    });
  }

  function matchupDescriptor(score) {
    if (score === 500) return "Even";
    if (score >= 700) return "Strong win";
    if (score >= 550) return "Favored";
    if (score > 500) return "Close win";
    if (score <= 300) return "Severe loss";
    if (score <= 450) return "Unfavored";
    return "Close loss";
  }

  function matchupRows(items, kind, sourceId, identity) {
    if (!items.length) return `<p class="analysis-empty-state">No reliable ${kind === "win" ? "winning" : "losing"} matchup details are available.</p>`;
    return items.map(item => `<article class="analysis-matchup-row analysis-duel-card ${kind}">
      <button type="button" class="analysis-matchup-open" data-analysis-matchup="${escapeHtml(item.id)}" data-analysis-source="${escapeHtml(sourceId)}" aria-label="Open battle against ${escapeHtml(item.name)}">
      <span class="analysis-matchup-duel"><span class="analysis-duel-mon analysis-duel-own"><img src="${escapeHtml(identity.image)}" data-fallback="${escapeHtml(identity.fallbackImage)}" alt=""><span>${escapeHtml(identity.name)}</span></span><span class="analysis-duel-vs">vs</span><span class="analysis-duel-mon analysis-duel-opponent"><img src="${escapeHtml(item.image)}" data-fallback="${escapeHtml(item.fallbackImage)}" alt=""><strong>${escapeHtml(item.name)}</strong></span></span>
      <span class="analysis-matchup-result"><b class="${escapeHtml(kind)}">${escapeHtml(matchupDescriptor(Number(item.score)))}</b><small>Rating ${escapeHtml(item.score)}</small></span>
      <span class="analysis-opponent-moves">${(item.moveDetails?.length ? item.moveDetails : (item.moves || []).map(name => ({ name }))).map(move => `<span class="meta-move-pill ${move.kind || "charged"}" style="--move-type:${escapeHtml(move.color || "#66788c")};--move-icon:url('${escapeHtml(move.icon || "")}')"><span>${escapeHtml(move.name)}</span></span>`).join("")}</span>
      </button>
    </article>`).join("");
  }

  function PokemonMatchupsSection(model) {
    if (!model.availability.matchups) return "";
    return Section({
      id: "analysisMatchups",
      title: "Meta Matchups",
      eyebrow: `${model.keyMatchups.shieldState} snapshot`,
      className: "analysis-wide-card",
      content: `<p class="analysis-score-caption">Battle rating: 500 is even · above 500 favors this Pokémon. Open Battle to run the current simulator.</p><div class="analysis-matchup-columns"><section><header><span class="win" aria-hidden="true">&#8593;</span><strong>Key wins</strong></header>${matchupRows(model.keyMatchups.wins, "win", model.id, model.identity)}</section><section><header><span class="loss" aria-hidden="true">&#8595;</span><strong>Key losses</strong></header>${matchupRows(model.keyMatchups.losses, "loss", model.id, model.identity)}</section></div><p class="analysis-source-note">Source: ${escapeHtml(model.provenance.matchups)}.</p>`
    });
  }

  function PokemonIVProfileDetail(profile) {
    if (!profile) return `<p class="analysis-empty-state">No IV profile is available for this Pokemon.</p>`;
    const insightItems = profile.insights || [];
    const renderInsights = items => items.map(item => `<li>${escapeHtml(item)}</li>`).join("");
    const insights = renderInsights(insightItems.slice(0, 3));
    const extraInsights = insightItems.length > 3 ? `<details class="analysis-disclosure"><summary>More sampled changes (${insightItems.length - 3})</summary><ul class="analysis-iv-insights">${renderInsights(insightItems.slice(3))}</ul></details>` : "";
    const deltas = (profile.deltas || []).map(item => `<div><dt>${escapeHtml(item.label.replace(" vs Balanced", ""))}</dt><dd class="${escapeHtml(item.tone || "")}">${escapeHtml(item.value)}</dd></div>`).join("");
    const groups = [];
    (profile.effects || []).forEach(effect => {
      let group = groups.find(item => item.opponent === effect.opponent);
      if (!group) { group = { opponent: effect.opponent, image: effect.image, fallbackImage: effect.fallbackImage, effects: [] }; groups.push(group); }
      group.effects.push(effect);
    });
    const renderEffects = items => items.map(group => `<article class="analysis-build-effect"><div class="analysis-build-opponent"><img src="${escapeHtml(group.image || "")}" data-fallback="${escapeHtml(group.fallbackImage || "")}" alt=""><strong>${escapeHtml(group.opponent)}</strong></div><div class="analysis-build-changes">${group.effects.map(effect => `<div class="analysis-build-change ${escapeHtml(effect.tone)}"><span class="analysis-build-kind${effect.kind === "damage" || effect.kind === "bulk" ? " analysis-build-bp analysis-build-bp-" + effect.kind : ""}" aria-hidden="true">${({ damage: "BP", cmp: "⇄", bulk: "BP", survival: "♥" })[effect.kind] || "•"}</span><div><strong>${escapeHtml(effect.label)} <b>${escapeHtml(effect.before)} → ${escapeHtml(effect.after)}</b></strong><small>${escapeHtml(effect.move || "")}</small></div></div>`).join("")}</div></article>`).join("");
    const effects = Array.isArray(profile.effects) ? (groups.length ? `<h4>Changes vs Balanced <small>· ${escapeHtml(profile.sampleSize)} opponents checked</small></h4><div class="analysis-build-effects">${renderEffects(groups.slice(0, 3))}</div>${groups.length > 3 ? `<details class="analysis-disclosure"><summary>More opponents (${groups.length - 3})</summary><div class="analysis-build-effects">${renderEffects(groups.slice(3))}</div></details>` : ""}` : `<p class="analysis-build-empty">${profile.id === "balanced" ? "Reference build · maximum overall stat product." : `No damage, CMP or survival change found across ${escapeHtml(profile.sampleSize)} sampled opponents.`}</p>`) : `${insights ? `<ul class="analysis-iv-insights">${insights}</ul>` : ""}${extraInsights}`;
    return `<div class="analysis-iv-detail-head"><div><strong>${escapeHtml(profile.label)}</strong><small>IVs ${escapeHtml(profile.ivs)} · CP ${escapeHtml(profile.cp)}</small></div><span>Stat product rank #${escapeHtml(profile.rank)}</span></div>${deltas ? `<h4>Compared with Balanced</h4><dl class="analysis-iv-stats analysis-iv-deltas">${deltas}</dl>` : ""}${effects}<details class="analysis-disclosure"><summary>Stats & build purpose</summary><dl class="analysis-iv-stats"><div><dt>Level</dt><dd>${escapeHtml(profile.level)}</dd></div><div><dt>Attack</dt><dd>${escapeHtml(profile.attack)}</dd></div><div><dt>Defense</dt><dd>${escapeHtml(profile.defense)}</dd></div><div><dt>HP</dt><dd>${escapeHtml(profile.hp)}</dd></div></dl><p>${escapeHtml(profile.purpose || "Great League IV profile")}</p></details><button type="button" data-analysis-use-build="${escapeHtml(profile.id)}">Try this build in Battle</button>`;
  }

  function PokemonBuildSection(model) {
    if (!model.availability.ivAnalysis) return "";
    const profiles = model.ivAnalysis.profiles;
    const selected = profiles.find(profile => profile.id === model.ivAnalysis.recommendedProfileId) || profiles[0];
    return Section({
      id: "analysisBuild",
      title: "IV & Build",
      eyebrow: "How to build it",
      className: "analysis-wide-card",
      content: `<div class="analysis-iv-layout"><div class="analysis-iv-profiles" role="tablist" aria-label="IV profiles">${profiles.map(profile => `<button type="button" role="tab" aria-selected="${profile === selected}" class="${profile === selected ? "active" : ""}" data-analysis-iv-profile="${escapeHtml(profile.id)}"><strong>${escapeHtml(profile.label)}</strong><span>${escapeHtml(profile.ivs)}</span><small>${profile.id === "balanced" ? "Reference build" : profile.hasPracticalImpact ? "Sampled thresholds differ" : "No sampled change"}</small></button>`).join("")}</div><div class="analysis-iv-canvas" data-analysis-iv-output>${PokemonIVProfileDetail(selected)}</div></div><p class="analysis-source-note">Damage and CMP checks against sampled opponents, not verified outcome flips. Survival compares raw damage at full HP, without shields or abilities. Source: ${escapeHtml(model.provenance.ivAnalysis)}.</p>`
    });
  }

  function PokemonPlaybookSection(model) {
    if (!model.availability.playGuidance) return "";
    const items = model.playGuidance.items.map((item, index) => `<article class="analysis-play-item ${escapeHtml(item.tone || "")}"><span>${index + 1}</span><div><small>${escapeHtml(item.label)}</small><strong>${escapeHtml(item.text)}</strong></div></article>`).join("");
    return Section({
      id: "analysisPlaybook",
      title: "Playbook",
      eyebrow: "How to play it",
      className: "analysis-wide-card",
      content: `<div class="analysis-play-grid">${items}</div><p class="analysis-source-note">Guidance is derived from modeled role ratings and move mechanics, not live usage data.</p>`
    });
  }

  function thresholdRows(items, kind) {
    return items.map(item => `<div class="analysis-threshold-row ${escapeHtml(kind)}"><span><strong>${escapeHtml(item.opponent)}</strong><small>${escapeHtml(item.move)}</small></span><b>${escapeHtml(item.label)}</b></div>`).join("");
  }

  function PokemonTechnicalSection(model) {
    if (!model.availability.technicalAnalysis) return "";
    const breakpoints = thresholdRows(model.advancedAnalysis.breakpoints, "breakpoint");
    const bulkpoints = thresholdRows(model.advancedAnalysis.bulkpoints, "bulkpoint");
    return `<details class="analysis-technical analysis-wide-card"><summary aria-expanded="false"><span><small>Advanced analysis</small><strong>Technical thresholds</strong></span><b aria-hidden="true">+</b></summary><div class="analysis-technical-body">${breakpoints ? `<section><h4>Detected breakpoints</h4><p>Fast-move damage thresholds found in sampled key matchups.</p>${breakpoints}</section>` : ""}${bulkpoints ? `<section><h4>Detected bulkpoints</h4><p>Defense thresholds found in sampled key matchups.</p>${bulkpoints}</section>` : ""}</div></details>`;
  }

  function PokemonAnalysisPage(model) {
    const preview = (items, label, kind) => `<section class="analysis-preview-${kind}"><h3><span class="analysis-outcome-symbol" aria-hidden="true">${kind === "win" ? "✓" : "×"}</span>${label}</h3><div class="analysis-preview-picks">${items.map(item => `<button type="button" data-analysis-matchup="${escapeHtml(item.id)}" data-analysis-source="${escapeHtml(model.id)}" aria-label="Open battle against ${escapeHtml(item.name)}"><img src="${escapeHtml(item.image)}" data-fallback="${escapeHtml(item.fallbackImage)}" alt=""><span><strong>${escapeHtml(item.name)}</strong></span><span class="analysis-preview-outcome" aria-label="${kind === "win" ? "Winning snapshot" : "Losing snapshot"}">${kind === "win" ? "✓" : "×"}</span></button>`).join("")}</div></section>`;
    return `${PokemonHeroCard(model)}<div class="analysis-workspace"><div class="analysis-page-tabs" role="tablist" aria-label="Pokémon analysis">${["overview", "matchups", "build"].map((id, index) => `<button type="button" role="tab" id="analysisTab-${id}" aria-controls="analysisPanel-${id}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-analysis-panel="${id}">${["Overview", "Matchups", "Build"][index]}</button>`).join("")}</div><div id="analysisPanel-overview" role="tabpanel" aria-labelledby="analysisTab-overview" class="analysis-dossier-grid">${PokemonSnapshot(model)}${model.availability.matchups ? `<div class="analysis-preview">${preview(model.keyMatchups.wins, "Key wins", "win")}${preview(model.keyMatchups.losses, "Key losses", "loss")}</div>` : `<p class="analysis-empty-state">No current matchup snapshot available. Use Battle to test this Pokémon.</p>`}${PokemonIdentitySection(model)}<details class="analysis-guidance"><summary>General play advice</summary>${PokemonPlaybookSection(model)}</details></div><div id="analysisPanel-matchups" role="tabpanel" aria-labelledby="analysisTab-matchups" class="analysis-dossier-grid" hidden>${PokemonMatchupsSection(model) || `<p class="analysis-empty-state">No current matchup snapshot available.</p>`}</div><div id="analysisPanel-build" role="tabpanel" aria-labelledby="analysisTab-build" class="analysis-dossier-grid" hidden>${PokemonBuildSection(model)}<details class="analysis-guidance"><summary>Other available moves</summary><div class="analysis-alternative-moves">${model.recommendedMoves.alternatives.map(move => moveChip(move, true)).join("") || "No alternative moves available."}</div></details>${PokemonTechnicalSection(model)}</div></div>`;
  }

  return {
    PokemonAnalysisPage,
    PokemonHeroCard,
    PokemonSnapshot,
    PokemonIdentitySection,
    PokemonMovesSection,
    PokemonMatchupsSection,
    PokemonIVProfileDetail,
    PokemonBuildSection,
    PokemonPlaybookSection,
    PokemonTechnicalSection
  };
});
