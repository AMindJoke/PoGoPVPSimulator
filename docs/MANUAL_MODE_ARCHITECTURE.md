# Manual Mode architecture

## Scope and baseline

Manual Mode is a canonical timeline editor. It replaces planner intent from a
selected decision point, but it must never replace battle mechanics.

- Audit date: 2026-07-28
- Audited branch: `main`
- Initial HEAD: `725c0794031f5008d044a558f5ee9da466490a9d`
- Planner migration at audit: 100% Principle Engine, 0% hybrid fallback
- Desktop layout owner: `PogoPvp.html`

Target data flow:

```text
Canonical battle state
  -> manual intent
  -> canonical action validation
  -> canonical event queue
  -> Unified Turn Resolution
  -> canonical timeline
  -> renderer
```

The original automatic timeline is immutable. Every edit creates or updates a
manual branch by restoring a validated snapshot, resolving a manual intent and
rebuilding all downstream derived events.

## Existing controls inventory

| Existing surface | Location | Current authority | Classification | Migration decision |
| --- | --- | --- | --- | --- |
| `p1UseFast`, `p2UseFast` | Matchup / Manual controls | Calls `useFast` directly | Mechanically authoritative, unsafe entry point | Reuse visual affordance only; route through `ManualAction` validation |
| `p1UseCharge1/2`, `p2UseCharge1/2` | Matchup / Manual controls | Calls `useManualCharge`, then `useCharge` | Mechanically authoritative, incomplete legality | Reuse buttons and move styling; replace handler |
| Manual shield modal | `manualDecisionModal` | Supplies `options.shielded` to `useCharge` | UI-only decision with mechanics downstream | Reuse modal styling; replace with canonical shield decision state |
| Random effect modal | `askManualBuffDecision` | Supplies `forceBuffs` | UI-only deterministic override | Keep only as an explicit deterministic/review policy |
| Starting shields | Trainer cards | Mutates setup values before battle | Setup-only | Preserve; not a live Manual Mode action |
| Starting energy / Fast steppers | Trainer cards | Mutates setup values before battle | Setup-only with provenance badges | Preserve; not a live Manual Mode action |
| Reset manual battle | Toolbar | Recreates combatants at turn 0 | Reusable | Keep as reset/start entry point |
| Timeline click / hover preview | Battle timeline | Reads event snapshots | Reusable renderer and branch-point selector | Add stable event IDs and explicit before/after boundaries |
| Automatic timeline replay | Battle timeline | Presentation-only animation | UI-only | Reuse rendering; replace timer-only replay with an explicit view cursor |
| Scenario Review lag/Timing Anomaly controls | Scenario Review | Re-simulates with technical injection | Mechanically authoritative but separate state wrapper | Adapt reconstruction commands into Manual Mode branches |
| Scenario Review Original / With issue | Scenario Review | Stores two captured runtime states | Reusable concept, limited branch model | Migrate to the common branch registry |
| Matrix preview branches | Matchup matrix | Re-simulates configured initial advantages | Separate simulation preview | Keep outside Manual Mode; allow future import as a branch point |
| Automatic planner | `automaticBattleStep` | Selects actions and invokes mechanics | Authoritative intent producer | Pause per controlled side; retain for AUTO sides and resume |

## Current timeline ownership

The live `timeline` array in `PogoPvp.html` is the current presentation and
inspection source. `recordTimeline` appends Fast, Charged, shield and technical
events. Each event stores a post-event `state` snapshot, while
`initialTimelineState` stores the battle-start snapshot.

The timeline is already data-driven for rendering, but it is not yet a complete
event-sourced battle log:

- event IDs are not universally stable;
- snapshots are post-event only and are not state-hash validated;
- downstream events can be retained independently of their causal prefix;
- replay has a presentation cursor but no separate edit cursor;
- visible timeline positions do not encode an editable decision phase;
- shield decisions are resolved before a canonical pause event is exposed.

Manual Mode must therefore add an immutable event envelope and decision-point
contract without manually maintaining a second UI timeline.

## Existing mechanics and reusable seams

### Reusable

- `src/battle/turn-resolution-engine.js`
  - canonical state normalization;
  - legal Fast/Charged action discovery;
  - intent normalization and CMP ordering;
  - pending Fast event creation, scheduling and resolution;
  - simultaneous Fast resolution;
  - terminal outcome and state validation.
- `turnEngineState`, `legalBattleActions`, `orderedBattleActors` in
  `PogoPvp.html`.
- `battleSnapshot`, `initialTimelineState` and timeline event snapshots.
- damage, energy, buff/debuff, form/protection and shield mechanics currently
  invoked by `useFast` and `useCharge`.
- `src/scenario/technical-review-model.js` for identifying lag and Timing Anomaly opportunities (legacy DRE remains read-only compatibility)
  opportunities.
- current timeline renderer, move tokens, tooltips, zoom and selected-event
  highlighting.
- `automaticBattleStep` as the AUTO-side intent producer.

### Obsolete after migration

- direct button handlers that call `useFast` or `useManualCharge`;
- `recordManualIntelligenceDecision` as the only record of a manual action;
- the binary, modal-only shield flow;
- Scenario Review's binary branch storage once common branches are available;
- timer state as the replay cursor.

### Unsafe or duplicate

- `useFast` applies damage and energy before the pending-event lifecycle is
  fully represented in Unified Turn Resolution;
- `useTimingWait` advances `battleTurns` directly and produces no canonical
  WAIT event;
- `useCharge` combines validation, shield policy, damage, effects, timeline
  recording and terminal finalization in one function;
- technical lag temporarily restores HP after `apply`, then queues a pending
  impact;
- technical Timing Anomaly resolves the canonical pending Fast event and copies HP/energy from the resolver result back into the live combatant;
- technical branch capture clones the entire mutable UI runtime;
- automatic and manual entry points share low-level functions but do not share
  one intent contract.

These paths are migration risks, not permission to create a second engine.
Manual Mode will call a canonical resolver adapter; mechanics extraction from
the monolith can then happen behind that adapter without changing the UI
contract.

## Direct HP and energy mutations

The audit found the following runtime mutation categories in `PogoPvp.html`:

1. Setup/reset assignment of starting energy.
2. Scenario setup assignment of initial HP.
3. Core `apply` damage and energy mutation.
4. Technical lag/Timing Anomaly temporary HP restoration and resolver copy-back.
5. Starting HP/energy advantage construction for matrix/preview simulations.
6. Form transition energy reset.
7. Same-turn registered Fast resolution after a Charged KO.

The canonical `turn-resolution-engine.js` also mutates cloned canonical state
while resolving Fast impacts; this is valid engine-owned mutation.

Manual Mode must not add any direct mutation site. Review overrides must be
explicit reconstruction events resolved by the canonical adapter. Existing
runtime mutation sites will be reduced as Unified Turn Resolution is expanded.

## Manual Mode model boundaries

DOM-independent modules will own:

- Manual Mode state and status transitions;
- `ManualAction` creation and normalization;
- legal action validation and reason codes;
- decision-point construction;
- immutable branches and branch snapshots;
- reversible commands and undo/redo;
- import/export schema and validation;
- trace envelopes and state hashes.

`PogoPvp.html` will own only:

- translating the current live battle into the canonical adapter;
- invoking canonical resolution;
- rendering model state;
- user input wiring;
- worker dispatch.

No model may store DOM nodes, callbacks or live combatant references.

## Stable implementation sequence

1. Add and test the DOM-independent state model.
2. Add and test `ManualAction`, decision-point and legality contracts.
3. Introduce a canonical live-battle adapter around Unified Turn Resolution.
4. Route existing Fast controls through manual intents.
5. Route Charged and shield decisions through explicit decision phases.
6. Add immutable branches and deterministic prefix restoration.
7. Add downstream rebuild, undo and redo.
8. Add per-side AUTO/MANUAL control and planner pause semantics.
9. Integrate lag and Timing Anomaly as traced reconstruction commands.
10. Add import/export and worker parity.
11. Upgrade the existing timeline renderer and replay controls.
12. Complete real-matchup, desktop/mobile and performance validation.

Each stable step receives focused tests, core battle tests, a separate commit
and a push to `main`.

## Test baseline

The baseline ran every `tools/test-*.js` file plus
`tools/run-battle-regressions.js` with Node `v24.18.0`.

- 36 of 38 commands passed.
- `test-battle-reliability.js` failed because it requires the full battle
  regression suite to be green.
- `run-battle-regressions.js` reported 9 passing and 2 pre-existing failures:
  - `raikou-pachirisu-self-debuff-1s`: missing
    `AVOID_EARLY_SELF_DEBUFF` and `delay-self-debuff`;
  - `shadow-quagsire-galarian-corsola-default-0s`: expected
    `MUD_BOMB -> AQUA_TAIL -> AQUA_TAIL`, actual
    `AQUA_TAIL -> MUD_BOMB -> AQUA_TAIL`.

Manual Mode phases must not increase this known-red baseline. Focused Manual
Mode suites must be green before each phase is committed.

## Phase 0 exit state

Phase 0 changes documentation only. Planner migration remains 100% before and
after; hybrid fallback remains exactly 0%.
