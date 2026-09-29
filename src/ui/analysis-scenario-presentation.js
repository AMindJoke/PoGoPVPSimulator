(() => {
  const body = document.body;
  const helper = document.querySelector(".scenario-setup-helper");
  const setup = document.querySelector(".setup");
  if (!body || !helper || !setup) return;

  function syncScenarioEntry() {
    let panel = document.getElementById("scenarioReviewEntry");
    if (body.dataset.view !== "scenario-review") {
      panel?.remove();
      helper.hidden = false;
      return;
    }

    if (body.classList.contains("battle-setup-ready")) {
      panel?.remove();
      helper.hidden = false;
      return;
    }

    if (!panel) {
      panel = document.createElement("section");
      panel.id = "scenarioReviewEntry";
      panel.className = "scenario-review-entry";
      panel.setAttribute("role", "status");
      panel.innerHTML = '<span class="scenario-review-entry-kicker">Scenario Review</span><strong>Choose a Pokemon pair</strong><p>Select one Pokemon on each side. The workspace opens when both are set; actions are added only when you record them.</p>';
      helper.after(panel);
    }
    helper.hidden = true;
  }

  const observer = new MutationObserver(syncScenarioEntry);
  observer.observe(body, { attributes: true, attributeFilter: ["class", "data-view"] });
  syncScenarioEntry();
})();
