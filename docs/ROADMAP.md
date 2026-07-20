# Roadmap

This roadmap tracks the long-term path from 1v1 simulator to Pokemon GO PvP training platform.

## Mobile UI

- [ ] Keep the two Pokemon panels usable on small screens.
- [ ] Preserve the desktop layout unless mobile work is explicitly requested.
- [ ] Make battle setup fast and readable on phones.
- [ ] Keep important matchup controls visible without clutter.
- [ ] Test long Pokemon names, forms, and move names on narrow screens.

## 1v1 Simulator

- [x] Load PvPoke gamemaster data.
- [x] Use PvPoke-style default movesets locally.
- [x] Support fast moves, charged moves, shields, HP, energy, and timeline.
- [x] Add compact desktop battle setup.
- [x] Add manual controls for targeted testing.
- [ ] Continue tuning charged move timing and overfarm behavior.
- [ ] Add clearer explanations for AI decisions.
- [ ] Add validation cases against known PvPoke matchups.

## Battle Engine Reliability

- [x] Add optional structured decision tracing.
- [x] Formalize planner versioning and stale-result provenance.
- [x] Add the first external battle regression corpus and runner.
- [x] Add a conservative contradiction scanner.
- [x] Add shield/no-shield counterfactual traces and terminal move-access snapshots.
- [x] Use decisive shield counterfactuals in Smart logic and expose critical decisions in Matchup Inspector.
- [ ] Add shield counterfactual traces.
- [ ] Add terminal charged-move access snapshots.
- [ ] Expand reviewed golden matchups without Pokemon-specific engine patches.
- [ ] Build a deeper oracle for selected difficult cases.
- [x] Add the first concept-centered Golden Matchup Corpus.
- [x] Add planner benchmark and tactical coverage reports.
- [x] Add previous-run comparison and regression/fix reporting.
- [ ] Promote mature Planner QA metrics into CI quality gates.

## 3v3 Battle AI

- [x] Add the reusable Scenario and connected Battle Segment foundation.
- [x] Add the first Lock State continuation flow.
- [ ] Represent full teams of three Pokemon.
- [ ] Track active Pokemon, bench Pokemon, and fainted Pokemon.
- [ ] Implement switch timer.
- [ ] Track revealed and hidden information.
- [ ] Model alignment advantage and disadvantage.
- [ ] Support safe swaps, pivots, closers, and sacrifice swaps.
- [ ] Build Shield AI, Switch AI, Charged Move AI, Overfarm AI, Catch AI, and Endgame AI.

## Decision Engine

- [ ] Identify the current win condition.
- [ ] Estimate the opponent's win condition.
- [ ] Evaluate shield value.
- [ ] Evaluate switch value.
- [ ] Evaluate energy value across future matchups.
- [ ] Estimate likely team archetypes such as ABB, ABA, Balanced, and RPS.
- [ ] Update probabilities for hidden Pokemon as new information appears.
- [ ] Compare actions by expected win probability instead of immediate damage only.
- [ ] Include player skill assumptions: beginner, intermediate, expert, professional.

## Battle Review Engine

- [x] Add a shared Tactical Pattern Library and structured pattern evidence.
- [x] Connect high-confidence tactical findings to Battle Review and Matchup Story.
- [x] Add the first structured Win Condition Engine categories.
- [x] Explain supported player win conditions from deterministic tactical evidence.
- [ ] Explain the opponent's likely win condition.
- [ ] Identify turning points.
- [ ] Rate shield quality.
- [ ] Rate switch quality.
- [ ] Review energy management.
- [ ] Review alignment decisions.
- [ ] Show alternative lines with higher expected win probability.
- [ ] Explain decisions in plain language.

## Docs

- [x] Add project vision.
- [x] Add roadmap.
- [x] Add battle philosophy.
- [x] Add Codex working guidelines.
- [ ] Add PvP mechanics reference.
- [ ] Add team archetype reference.
- [ ] Add resource management reference.
- [ ] Add win condition reference.
- [x] Add Win Condition Engine architecture and consumer rules.
- [ ] Add opponent prediction reference.

## Testing

- [x] Add baseline matchup regression cases.
- [ ] Compare simulator output with PvPoke for selected scenarios.
- [ ] Add replay validation for known battle lines.
- [ ] Compare AI decisions against expert decisions.
- [ ] Tune weights using repeatable scenarios.
- [ ] Add visual checks for desktop and mobile layout changes.
