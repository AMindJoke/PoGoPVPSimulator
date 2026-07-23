# Hybrid Battle Intelligence Performance

## Profile

The benchmark command is:

```powershell
npm run planner:benchmark:hybrid
```

It runs the 30-case Great League Golden corpus, writes JSON and Markdown below
`reports/hybrid-battle-intelligence/`, and reports route, continuation, cache,
and latency counters.

The frozen before measurement used `battle-planner-v17`. The final profiled run
used `battle-planner-v18` with `PERF_DEBUG` disabled.

| Measurement | Before | After | Change |
| --- | ---: | ---: | ---: |
| Matchups | 30 | 30 | same |
| Passed | 22 | 25 | +3 |
| Failed | 8 | 5 | -3 |
| Wall time | 15,798 ms | 15,193 ms | -3.8% |
| Tactical concepts covered | 16/16 | 16/16 | same |

Wall-clock results varied across repeated current runs from approximately
11.0-15.2 seconds on the bundled runtime. The table uses the final conservative
cold profile rather than the fastest observation.

## Final counters

| Counter | Value |
| --- | ---: |
| Candidate routes evaluated | 509 |
| Compact planner nodes | 1,228 |
| Compact planner calls | 244 |
| Incomplete compact plans | 227 |
| High-impact ambiguity selections | 224 |
| Continuation searches triggered | 217 |
| Continuation candidates evaluated | 33,342 |
| Hybrid cache hits / misses | 17 / 227 |
| Battle Intelligence cache hits / misses | 932 / 4,937 |

The frozen v17 traces recorded 207 continuation searches and 32,908 evaluated
candidates. v18 does not reduce the absolute ambiguous-search count in this
corpus; it adds compact evaluation before the response-sensitive cases and
removes cloned search from ordinary Fast-only and tactical-gate decisions. This
is an honest remaining optimization target.

## Decision latency

| Layer | Samples | Average | Median | p95 | Worst |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hybrid selector | 1,378 | 0.583 ms | <1 ms | 4 ms | 7 ms |
| Battle Intelligence, including cloned rollouts | 24,643 | 0.699 ms | <1 ms | 1 ms | 227 ms |

The bundled timer has millisecond granularity in the worker VM, so zero-valued
median samples mean "below one measurable millisecond," not zero work. The
227-ms worst decision is an ambiguous cloned continuation, not compact route
planning.

## Bottlenecks and ownership

- Matrix and offline matchups execute in the worker; their hybrid route and
  continuation cost does not block the interactive main thread.
- Interactive Battle and Scenario Review still execute their individual
  decisions on the main thread. Compact selection is below the long-task
  threshold, but a worst-case cloned continuation can exceed it.
- Most compact plans hit the FAST wall-clock limit before exhausting their state
  cap. They remain useful bounded comparisons, but the low 7% route-cache hit
  rate shows limited cross-state convergence.
- Deep cloning remains concentrated in the 217 high-impact continuation
  searches. Replacing those clones with immutable transitions is the next
  performance step; broadening cache identity or suppressing comparisons solely
  to improve hit rate would be unsafe.
