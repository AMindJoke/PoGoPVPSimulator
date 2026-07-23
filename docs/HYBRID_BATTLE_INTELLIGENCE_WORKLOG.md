# Hybrid Battle Intelligence Work Log

## 2026-07-23 — Frozen baseline and architecture

- Hypothesis: locally weighted decisions and terminal cloned rollouts are both
  the strategic reliability problem and the Matrix bottleneck.
- Evidence:
  - production candidate ordering compares priority class before continuation;
  - continuation depth is one explicit action followed by up to 1,000 local-AI
    steps;
  - opponent responses are not adversarial;
  - ordinary timing, PCSV, shield, and effect comparisons each deep-clone global
    combatants and timeline;
  - Golden baseline is 22/30 in 15,798 ms;
  - reliability baseline is 5/7 in 2,496 ms;
  - the Quagsire/Corsola locked fixture currently diverges at the third Aqua
    Tail (`T34` actual versus `T30` expected).
- Files changed:
  - `docs/HYBRID_BATTLE_INTELLIGENCE_AUDIT.md`
  - `docs/HYBRID_BATTLE_INTELLIGENCE_WORKLOG.md`
- Tests run:
  - Golden Planner benchmark through the bundled Node runtime;
  - reliability regression suite through the bundled Node runtime;
  - focused matchup-planner fixture.
- Result: hypothesis supported; the focused fixture is already red before new
  behavior.
- Decision: keep the audit and frozen measurements. Implement a new compact,
  mechanics-callback-driven baseline before changing weights or matchup
  expectations.

## 2026-07-23 — Compact planner and selective-search boundary

- Hypothesis: a Fast-first tactical gate plus a bounded offensive route planner
  can remove most cloned continuations without losing the validated complex
  cases.
- Evidence:
  - the compact module passes the 20-principle catalog and unit coverage for
    bait policy, actionable energy, timing, CMP, farming, effects, cache
    identity, and search budgets;
  - treating all effect/timing states as decisive initially reduced the Golden
    corpus to 10/30, so that approach was rejected;
  - escalating every root and changing rollout policy improved speed but
    reduced quality, so hybrid selection is disabled inside cloned legacy
    continuations;
  - applying a search rule as a candidate preference changed decisions before
    search, so search eligibility is now deliberately score-neutral;
  - allowing a 4 ms budget to evaluate only one of two ambiguous candidates
    produced incomparable evidence; the retained design evaluates the complete
    small ambiguity set at equal treatment;
  - “opponent reaches a Charged Move” was too broad a forced-throw gate;
    canonical damage now distinguishes lethal from survivable access;
  - cooldown alignment without a pending Fast event created false timing
    windows; optimal timing now requires a real pending opponent Fast impact.
- Files changed:
  - `src/battle/hybrid-battle-intelligence.js`
  - `src/battle/battle-intelligence.js`
  - `PogoPvp.html`
  - `tools/build-great-league-meta-database.js`
  - `tools/test-hybrid-battle-intelligence.js`
  - `tools/test-matchup-planner-fixture.js`
  - `src/reliability/battle-reliability.js`
  - `package.json`
- Tests run:
  - hybrid and Battle Intelligence unit suites;
  - repeated frozen Golden Planner benchmark;
  - reliability regression suite;
  - focused Quagsire/Corsola response fixture.
- Result:
  - Golden corpus: 24/30 in 12,748 ms versus 22/30 in 15,798 ms;
  - reliability corpus: 6/7 in 1,252 ms versus 5/7 in 2,496 ms;
  - the fixed Quagsire `8/17/30/37/44` Aqua Tail line wins against
    `21/34` Night Shade, but loses to the legal `21/31/44` response with
    Corsola retaining 23 HP;
  - adaptive replanning instead uses `8/17/34/37/44` and wins with 19 HP.
- Decision: keep the compact planner, lethal-only pressure gate, pending-event
  timing semantics, score-neutral ambiguity escalation, and equal-treatment
  continuation set. Keep the Quagsire counterexample as a regression and do not
  describe the fixed line as proven.
