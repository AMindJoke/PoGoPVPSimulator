# Decision Model Rulebook

## Status

Interactive design phase. No battle behavior in this rulebook is implemented
until the corresponding policy question is resolved.

Protected baseline:

- branch: `perf-debug-work`
- commit: `5ccf6a0a74f18bd1b970389450f3c2257785c83a`
- safety branch: `hybrid-before-decision-model-rebuild`
- uncommitted `PogoPvp.html` experiment: excluded from the protected baseline
  because it does not solve the rank-1 Shadow Quagsire versus Galarian Corsola
  case.

## Existing constraints

The following are not open policy questions:

- Unified Turn Resolution owns legality, registration, resolution, damage,
  energy, CMP, pending impacts, fainting, and terminal state.
- Battle Intelligence selects an intent but cannot claim that the intent
  resolved.
- Timing evaluation may select `THROW_NOW` or `WAIT_ONE_FAST`; it may not
  replace one Charged Move with another.
- Move selection owns Charged Move identity.
- A route is evidence and is recalculated after resolution; it is not a stale
  multi-action instruction queue.
- Certified outcome order is `WIN > DRAW > LOSS`.
- Incomplete continuations are provisional and cannot be compared as certified
  terminal outcomes.
- Guaranteed self buffs, guaranteed opponent debuffs, self-Attack debuffs,
  self-Defense debuffs, accumulated stages, stage clamping, and projected-stage
  damage must be preserved.

Frozen regression families before mechanics changes:

- `tools/test-hybrid-battle-intelligence.js`
- `tools/test-battle-intelligence.js`
- `tools/test-turn-resolution-engine.js`
- `tools/test-scenario-model.js`
- `tools/test-battle-review.js`
- `tools/test-matchup-planner.js`
- `tools/test-matchup-planner-adapter.js`
- `tools/run-battle-regressions.js`
- `data/golden-corpus/great-league.json`
- `data/battle-regressions/iv-sensitivity.json`

## Pending policy questions

### DM-01 — Deterministic bait and shield policy

State:

- Side A: 100 HP, 60 energy, 0 shields.
- Side A Fast Move: 2 turns, 8 energy, 3 damage.
- Side A Charged Move `BAIT`: 35 energy, 35 damage, no stat effect.
- Side A Charged Move `NUKE`: 55 energy, 90 damage, no stat effect.
- Side B: 100 HP, 0 energy, 1 shield.
- No pending Fast impact, no CMP, and both sides may act at the current action
  boundary.

Legal actions:

- Side A: `FAST`, `BAIT`, or `NUKE`.
- If a Charged Move is registered, Side B: `SHIELD` or `NO_SHIELD`.

Possible rules:

- A. Default Matrix play assumes a credible bait is shielded whenever A has
  built to `NUKE`.
- B. Side B always chooses the outcome-best response after seeing the actual
  move; deterministic baiting therefore receives no hidden-information value.
- C. A compact deterministic `wouldShield` policy chooses the default response;
  if `SHIELD` and `NO_SHIELD` can change the outcome, both continuations are
  retained for selective comparison.

Consequences:

- A rewards bait construction but can overstate bait wins.
- B is adversarial and reproducible but makes ordinary baiting unrealistically
  weak.
- C preserves a fast PvPoke-style baseline while exposing materially ambiguous
  shield responses instead of hiding them.

Recommended rule:

- C.

Proposed owner:

- Shield Policy, followed by Ambiguity Detector.

Proposed fixtures:

- `decision-model-dm-01-shielded-bait`
- `decision-model-dm-01-unshielded-bait`

Affected functions:

- `selectBattleIntelligenceAction`
- shield counterfactual generation
- selective continuation root generation

User answer:

- `DM-01: A`, `DM-01: B`, `DM-01: C`, or a custom rule.

### DM-02 — Non-guaranteed stat effects

State:

- Side A: 70 HP, 45 energy, 0 shields.
- Side A Charged Move `EFFECT`: 40 energy, 40 damage, 30% chance to reduce the
  opponent's Attack by one stage.
- Side A Charged Move `DIRECT`: 45 energy, 45 damage, no stat effect.
- Side B: 80 HP, 40 energy, 0 shields.
- Neither move is immediately lethal; the Attack drop changes whether A
  survives B's next Charged Move.
- No pending impact and no CMP at the current boundary.

Legal actions:

- `FAST`, `EFFECT`, or `DIRECT`.

Possible rules:

- A. Deterministic Matrix ignores non-guaranteed effects; Scenario Review may
  inspect forced proc and no-proc branches.
- B. The planner uses expected value from explicit proc/no-proc branches.
- C. The planner is risk-sensitive: it may use the effect line only if both the
  proc and no-proc continuations are not worse than `DIRECT`.

Consequences:

- A is fast and PvPoke-compatible but can undervalue legitimate effect moves.
- B models average performance but can prefer a line that loses most individual
  deterministic simulations.
- C is robust but can systematically undervalue high-upside effects.

Recommended rule:

- A for ordinary deterministic Matrix results, with explicit proc/no-proc
  sensitivity in Scenario Review. Probability-aware ranking can later be a
  separate policy rather than silently changing deterministic results.

Proposed owner:

- Effect Policy.

Proposed fixtures:

- `decision-model-dm-02-no-proc-matrix`
- `decision-model-dm-02-forced-proc-review`

Affected functions:

- guaranteed stat-effect projection
- Scenario Review technical-event continuation
- outcome vector explanation

User answer:

- `DM-02: A`, `DM-02: B`, `DM-02: C`, or a custom rule.

### DM-03 — Ordering two certified wins

State:

- Two root actions have been evaluated from the same canonical state with the
  same opponent policy and both continuations are complete.
- Route A: certified win on turn 15; final state is 1 HP, 0 shields, 0
  actionable energy.
- Route B: certified win on turn 18; final state is 20 HP, 0 shields, 35
  actionable energy.
- No switch or team context is active.

Legal root actions:

- `THROW_NOW`, producing Route A.
- `WAIT_ONE_FAST`, producing Route B.

Possible rules:

- A. Prefer fastest certified win: Route A.
- B. Prefer remaining battle resources before speed: Route B.
- C. Prefer robustness first, then resources, then speed; if both routes are
  equally robust, Route B.

Consequences:

- A is closest to shortest-KO planning.
- B preserves more usable position but can extend battles unnecessarily.
- C makes fragile breakpoint-dependent wins rank below stable wins, at the cost
  of a more detailed robustness contract.

Recommended rule:

- C, ordered within the same outcome class as: robustness, remaining shields,
  HP, actionable energy, then completion turn. Stranded energy is explanatory
  only.

Proposed owner:

- Outcome Comparator.

Proposed fixture:

- `decision-model-dm-03-certified-win-order`

Affected functions:

- `compareOutcomeVectors` in compact and selective planners
- comparability report generation

User answer:

- `DM-03: A`, `DM-03: B`, `DM-03: C`, or a custom ordering.

### DM-04 — Selective-search budget expires before comparability

State:

- Root action `CHARGED_NOW` and root action `FAST_THEN_CHARGED` start from the
  same canonical state.
- The compact planner selects `CHARGED_NOW`.
- Selective search reaches a terminal result for `CHARGED_NOW`.
- The same budget expires for `FAST_THEN_CHARGED` before its decisive Charged
  breakpoint.
- The two roots therefore do not have comparable horizons.

Legal output policies:

- A. Select the terminally evaluated root even though the alternative is
  provisional.
- B. Fall back to the compact deterministic choice, mark the decision
  provisional, and expose the incomplete comparability report.
- C. Return no Matrix result until a larger budget resolves both roots.

Consequences:

- A is fast but violates equal continuation treatment.
- B remains responsive and honest about evidence quality.
- C maximizes local certainty but can freeze or leave holes in the Matrix.

Recommended rule:

- B for Matrix and live Battle. Scenario Review may continue with a deeper
  budget, but it must not retroactively mislabel the earlier provisional result
  as proven.

Proposed owner:

- Selective Search budget controller, followed by Battle Intelligence fallback.

Proposed fixture:

- `decision-model-dm-04-incomparable-timeout`

Affected functions:

- selective continuation evaluation
- incomplete-horizon fallback
- Matrix result metadata

User answer:

- `DM-04: A`, `DM-04: B`, `DM-04: C`, or a custom rule.

## Resolved rules

No interactive policy rule has been resolved yet.
