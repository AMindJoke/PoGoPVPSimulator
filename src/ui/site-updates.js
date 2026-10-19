(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PvPeakSiteUpdates = api;
  if (root?.document) api.render(root.document, root.BATTLE_SITE_UPDATES);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function latestUpdates(updates) {
    const seen = new Set();
    return (Array.isArray(updates) ? updates : []).filter(entry => {
      if (!entry?.id || seen.has(entry.id) || typeof entry.title !== "string" || !entry.title.trim()
        || typeof entry.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)
        || !Array.isArray(entry.changes) || !entry.changes.length
        || !entry.changes.every(change => typeof change === "string" && change.trim())) return false;
      const date = new Date(`${entry.date}T00:00:00Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== entry.date) return false;
      seen.add(entry.id);
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  }

  function render(doc, updates) {
    const section = doc.getElementById("homeNews");
    const list = doc.getElementById("homeNewsList");
    if (!section || !list) return 0;
    const entries = latestUpdates(updates);
    const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    const node = (tag, className, text) => {
      const element = doc.createElement(tag);
      element.className = className;
      if (text) element.textContent = text;
      return element;
    };
    list.replaceChildren(...entries.map(entry => {
      const row = node("li", "home-news-entry");
      const article = node("article", "home-news-item");
      const meta = node("div", "home-news-meta");
      const date = node("time", "home-news-date", dateFormat.format(new Date(`${entry.date}T00:00:00Z`)));
      date.dateTime = entry.date;
      meta.append(date);
      if (entry.category) meta.append(node("span", "home-news-category", entry.category));
      const content = node("div", "home-news-content");
      const changes = node("ul", "home-news-changes");
      changes.append(...entry.changes.map(change => node("li", "", change)));
      content.append(node("h3", "home-news-title", entry.title), changes);
      article.append(meta, content);
      row.append(article);
      return row;
    }));
    section.hidden = entries.length === 0;
    return entries.length;
  }

  return Object.freeze({ latestUpdates, render });
});
