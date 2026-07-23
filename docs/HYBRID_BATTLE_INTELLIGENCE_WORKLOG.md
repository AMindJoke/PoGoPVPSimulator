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
