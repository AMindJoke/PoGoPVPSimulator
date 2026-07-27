# PERF_DEBUG

`PERF_DEBUG` is the permanent developer-only profiler for the simulator. It observes execution only: it must never select an action, change a policy, alter a search limit, skip a simulation, or affect a battle result.

## Enable it

Production is disabled by default. Use one of these developer-only methods and reload:

```text
?perfDebug=1
```

```js
localStorage.setItem("PERF_DEBUG", "1");
location.reload();
```

Disable the persistent flag with:

```js
localStorage.removeItem("PERF_DEBUG");
location.reload();
```

When disabled, the exported API is a frozen no-op object. It creates no dashboard, observers, history, timers, or console output. Existing guarded call sites only pay a boolean/null check.

## Architecture

- `src/performance/perf-debug.js` owns runs, spans, counters, gauges, cache statistics, history, warnings, and the dashboard.
- The interactive page creates separate runs for startup, Battle, Matrix, Swing, Scenario Review, and standalone worker jobs.
- The matrix worker owns its own collector. Its report is merged into the parent main-thread run using the request ID.
- Concurrent matrix cells use explicit run IDs, so their metrics cannot leak into an interactive Battle run.
- History keeps the latest 20 completed runs in developer local storage. Matching run names expose previous/current values and percentage change.
- `PerformanceObserver` records long tasks and GC events only when the browser exposes those entry types.

## Collected metrics

### Pipeline timings

`input.processing`, `battle.startup`, `battle.state`, `combatants.create`, `battleIntelligence.init`, `battleIntelligence.selection`, `planner.init`, `planner.search`, `planner.candidateGeneration`, `planner.evaluation`, `planner.transition`, `candidate.generation`, `candidate.evaluation`, `continuation.search`, `simulation.total`, `timeline.generation`, `swing.generation`, `matrix.generation`, `dom.update`, `render`, and `total`.

### Planner diagnostics

`planner.nodes`, `planner.maxDepth`, `planner.completedDepth`, candidates generated, candidate-generation calls, evaluations, transitions, and transposition hit/miss rate.

### State and transport

State clone count, deep clone count, structured-clone count, serialization/deserialization time, temporary allocation estimate, worker startup, execution, queue, idle, communication, and round-trip time.

### Browser diagnostics

Peak JS heap is reported when `performance.memory` is available. Long-task count/max duration and GC count/time depend on browser support and may be absent rather than zero.

## Dashboard

The compact fixed panel appears only while `PERF_DEBUG` is enabled. It shows the latest run, suspicious values, expanded chronological spans, top ten operations, and regression deltas. A positive timing delta is slower; a negative timing delta is faster.

Current warning thresholds are diagnostic, not pass/fail requirements:

- planner nodes above 3,000;
- planner depth above 12;
- cache hit rate below 50% after at least four lookups;
- more than 10 JSON-style deep clones;
- worker queue above 20 ms;
- main-thread long task at or above 50 ms.

Expected values vary by matchup. Compare the same matchup, IVs, moves, shields, policies, and browser before interpreting a delta.

## Performance audit

### Main thread

The main thread owns input handling, the interactive Battle presentation, timeline construction, DOM rendering, Scenario Review state application, and worker communication. Shield Matrix cells and offline Meta cells run in the compute worker. HP Swing probing is deliberately chunked with event-loop yields because each step updates a clickable exact threshold.

The dashboard flags long tasks so further work can identify whether an interactive continuation or a render path should move behind an asynchronous boundary. This change does not move gameplay logic or alter scheduling semantics.

### Duplicate work removed

1. Matrix signatures previously recalculated derived stats and serialized the same configuration during repeated renders. They are now memoized by all setup inputs that can affect the current configuration.
2. Matrix combatants were recreated for every worker cell. The immutable battle configuration is now built once per setup identity.
3. The full worker source was rebuilt whenever the worker restarted. It is now cached for the page lifetime.
4. The full matchup configuration was structured-cloned to the worker for every cell. It is now transferred once per signature; subsequent jobs send only shields and analysis options. The worker retains at most 12 configurations.

These changes reuse immutable input data only. Every cell still creates its own mutable combatants, executes the same engine, uses the same planner limits, and produces the same output.

### Cache inventory

| Cache | Lifetime | Invalidation identity | Instrumentation |
| --- | --- | --- | --- |
| Battle Intelligence fast path | module lifetime, bounded internally | canonical strategic state, policy, legal actions | hit/miss, size |
| Planner transposition table | planner/runtime owned | canonical state hash, side, depth, perspective | hit/miss, size |
| Shield Matrix memory cache | page lifetime, bounded to 900 | engine version, full matrix signature, shields | hit/miss, size |
| IndexedDB Matrix cache | persistent | same versioned matrix key | worker queue/communication; hydration path |
| Matrix signature | one current setup | Pokemon, moves, IV inputs, level/CP, energy and policies | hit/miss, serialization |
| Matrix battle config | one current setup | same setup identity | hit/miss, state clones |
| Worker config cache | worker lifetime, 12 signatures | complete matrix signature | transport reduction |
| IV/rank and form catalogs | page lifetime | Pokemon/form and IV inputs | existing ownership retained |

### State-copy audit

The planner uses lightweight snapshots that share immutable Pokemon/move/form metadata and copy mutable combatant fields. Matrix cells still deep-clone their mutable starting combatants for isolation. Scenario Review uses `structuredClone` when available. `PERF_DEBUG` counts these paths and estimates serialized bytes; it does not replace copies with unsafe shared state.

### Lazy and DOM audit

Matrix Swing enrichment remains a second phase after the nine base cells. Matchup inspector, Battle Review, and timeline presentation retain their existing lazy/display rules. Timeline and matrix DOM work is measured separately so repeated full renders can be identified without changing the UI in this task.

## Reading bottlenecks

- High `planner.search` with high nodes and a healthy cache means genuine search dominates.
- High planner time with low nodes usually points to expensive candidate evaluation, hashing, or continuation setup.
- Low transposition hit rate suggests unstable/incomplete state identity or little state convergence; never broaden keys merely to improve the percentage.
- High worker queue with low execution means the worker is saturated or messages are too frequent.
- High communication/serialization means payload size is the likely target.
- High `timeline.generation` or `dom.update` with low simulation time means rendering, not AI, is blocking the page.
- Deep-clone spikes indicate temporary object pressure and likely GC churn.
- A long-task warning identifies main-thread unresponsiveness even if total wall time is acceptable.

## Regression workflow

1. Enable `PERF_DEBUG`.
2. Reload once to initialize the worker.
3. Run the exact same matchup twice; treat the first as cold and the second as warm.
4. Record Battle and Matrix reports separately.
5. Change one implementation detail.
6. Repeat with the same setup and compare the dashboard regression section.
7. Run `npm run test:perf-debug` and the strategic regression suites before accepting the optimization.

The collector test verifies disabled behavior, measured spans, cache aggregation, worker-report merging, and rolling comparisons.

## Validation report

The deterministic 30-case Planner benchmark was executed in parallel against commit `139d48f` and this implementation, with `PERF_DEBUG` disabled:

| Measurement | Before | After | Change |
| --- | ---: | ---: | ---: |
| Planner corpus wall time | 19,498 ms | 19,330 ms | -0.9% |
| Golden cases passed | 22 | 22 | identical |
| Golden cases failed | 8 | 8 | identical |
| Tactical concepts covered | 16/16 | 16/16 | identical |

The small timing change is within normal run-to-run variance; its purpose is to demonstrate that disabled instrumentation adds no measurable regression. Browser-specific startup, paint, memory, and GC numbers must be collected in the target browser with the dashboard because fabricating them from the Node benchmark would be misleading.

For a full 9-cell base matrix plus 9 Swing enrichments, the main payload optimization changes full configuration transfers from up to 18 to 1 per signature, a 94.4% reduction. Runtime cell messages still contain all cell-specific shields and policy inputs. Configuration construction and signature derivation similarly change from repeated render/request work to one cold build plus cache lookups.

Baseline comparison also confirmed that the known Golden, flip-continuation, and charged-planner failures reproduce unchanged on commit `139d48f`; no new strategic failure was introduced by this task.

## Current limitations

- Browser memory and GC metrics are implementation-specific and unavailable in some browsers, especially Safari.
- Temporary allocations are estimates based on known clone/serialization paths, not a heap snapshot.
- Long-task attribution identifies the active run but not a JavaScript stack.
- Existing Golden Corpus baseline currently has two unrelated strategic failures (`raikou-pachirisu-self-debuff-1s` reason-code expectation and `dedenne-shadow-sableye-smart-shields-2s` winner expectation). Performance work must not silently rewrite those fixtures.
