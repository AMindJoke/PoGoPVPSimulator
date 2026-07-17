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
        <p>${escapeHtml(model.summary.statement)}</p>
        ${loadout ? `<div class="analysis-hero-loadout" aria-label="Recommended moveset">${loadout}</div>` : ""}
      </div>
      <aside class="analysis-rating-panel">
        <span class="analysis-eyebrow">PvPeak Rating</span>
        <div class="analysis-rating-value"><strong>${escapeHtml(rating)}</strong><span>/ 1000</span></div>
        <div class="analysis-rating-track"><i style="width:${Math.max(0, Math.min(100, Number(rating) / 10 || 0))}%"></i></div>
        <dl><div><dt>Overall rank</dt><dd>#${escapeHtml(identity.rank)}</dd></div><div><dt>League</dt><dd>${escapeHtml(identity.league)}</dd></div></dl>
        <button type="button" class="analysis-primary-action" data-analysis-use-pokemon="${escapeHtml(model.id)}">Use in Battle</button>
      </aside>
    </section>`;
  }

  function PokemonSnapshot(model) {
    if (!model.availability.summary) return "";
    const symbols = ["R", "C", "S", "E"];
    return `<section class="analysis-snapshot" aria-labelledby="analysisSnapshotTitle"><header><span aria-hidden="true">&#10022;</span><h3 id="analysisSnapshotTitle">Competitive Snapshot</h3></header><div>${model.summary.facts.map((fact, index) => `<article><b>${symbols[index] || "I"}</b><span><small>${escapeHtml(fact.label)}</small><strong>${escapeHtml(fact.value)}</strong></span></article>`).join("")}</div></section>`;
  }

  function PokemonIdentitySection(model) {
    const identity = model.competitiveIdentity;
    const categories = identity.categories.map(category => `<div><span>${escapeHtml(category.label)}</span><strong>${escapeHtml(category.score)}</strong></div>`).join("");
    const traits = identity.traits.map(trait => `<span>${escapeHtml(trait)}</span>`).join("");
    return Section({
      id: "analysisIdentity",
      title: "Why Use It",
      eyebrow: "Competitive identity",
      className: "analysis-identity-card",
      content: `<strong class="analysis-lead-copy">${escapeHtml(identity.role)}</strong><p>${escapeHtml(identity.statement)}</p>${categories ? `<div class="analysis-role-scores" aria-label="Role scores">${categories}</div>` : ""}${traits ? `<div class="analysis-trait-list">${traits}</div>` : ""}`
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
    if (score >= 700) return "Strong win";
    if (score >= 550) return "Favored";
    if (score > 500) return "Close win";
    if (score <= 300) return "Severe loss";
    if (score <= 450) return "Unfavored";
    return "Close loss";
  }

  function matchupRows(items, kind, sourceId) {
    if (!items.length) return `<p class="analysis-empty-state">No reliable ${kind === "win" ? "winning" : "losing"} matchup details are available.</p>`;
    return items.map(item => `<article class="analysis-matchup-row">
      <img src="${escapeHtml(item.image)}" data-fallback="${escapeHtml(item.fallbackImage)}" alt="">
      <div class="analysis-matchup-copy"><div><strong>${escapeHtml(item.name)}</strong><small>#${escapeHtml(item.rank)} meta</small></div><span>${typeChips(item.types)}</span><em>${escapeHtml((item.moves || []).join(" / "))}</em></div>
      <div class="analysis-matchup-result"><small>${escapeHtml(matchupDescriptor(Number(item.score)))}</small><b class="${escapeHtml(kind)}">${escapeHtml(item.score)}</b><button type="button" data-analysis-matchup="${escapeHtml(item.id)}" data-analysis-source="${escapeHtml(sourceId)}" aria-label="Open battle against ${escapeHtml(item.name)}">Battle</button></div>
    </article>`).join("");
  }

  function PokemonMatchupsSection(model) {
    if (!model.availability.matchups) return "";
    return Section({
      id: "analysisMatchups",
      title: "Meta Matchups",
      eyebrow: `${model.keyMatchups.shieldState} modeled results`,
      className: "analysis-wide-card",
      content: `<div class="analysis-matchup-columns"><section><header><span class="win" aria-hidden="true">&#8593;</span><strong>Key wins</strong></header>${matchupRows(model.keyMatchups.wins, "win", model.id)}</section><section><header><span class="loss" aria-hidden="true">&#8595;</span><strong>Key losses</strong></header>${matchupRows(model.keyMatchups.losses, "loss", model.id)}</section></div><p class="analysis-source-note">Source: ${escapeHtml(model.provenance.matchups)}. Scores are not live usage statistics.</p>`
    });
  }

  function PokemonIVProfileDetail(profile) {
    if (!profile) return `<p class="analysis-empty-state">No IV profile is available for this Pokemon.</p>`;
    const insights = (profile.insights || []).map(item => `<li>${escapeHtml(item)}</li>`).join("");
    return `<div class="analysis-iv-detail-head"><span>Rank #${escapeHtml(profile.rank)}</span><div><strong>${escapeHtml(profile.label)}</strong><small>${escapeHtml(profile.ivs)}</small></div></div><dl class="analysis-iv-stats"><div><dt>Level</dt><dd>${escapeHtml(profile.level)}</dd></div><div><dt>CP</dt><dd>${escapeHtml(profile.cp)}</dd></div><div><dt>Attack</dt><dd>${escapeHtml(profile.attack)}</dd></div><div><dt>Defense</dt><dd>${escapeHtml(profile.defense)}</dd></div><div><dt>HP</dt><dd>${escapeHtml(profile.hp)}</dd></div></dl><p>${escapeHtml(profile.purpose || "Great League IV profile")}</p>${insights ? `<ul class="analysis-iv-insights">${insights}</ul>` : ""}`;
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
      content: `<div class="analysis-iv-layout"><div class="analysis-iv-profiles" role="tablist" aria-label="IV profiles">${profiles.map(profile => `<button type="button" role="tab" aria-selected="${profile === selected}" class="${profile === selected ? "active" : ""}" data-analysis-iv-profile="${escapeHtml(profile.id)}"><strong>${escapeHtml(profile.label)}</strong><span>${escapeHtml(profile.ivs)}</span>${profile.hasPracticalImpact ? `<small>Detected impact</small>` : ""}</button>`).join("")}</div><div class="analysis-iv-canvas" data-analysis-iv-output>${PokemonIVProfileDetail(selected)}</div></div><p class="analysis-source-note">Source: ${escapeHtml(model.provenance.ivAnalysis)}.</p>`
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
    return `${PokemonHeroCard(model)}<div class="analysis-dossier-grid">${PokemonSnapshot(model)}${PokemonIdentitySection(model)}${PokemonMovesSection(model)}${PokemonMatchupsSection(model)}${PokemonBuildSection(model)}${PokemonPlaybookSection(model)}${PokemonTechnicalSection(model)}</div>`;
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
