# Timing Compatibility Harness

`tools/timing-compatibility-harness.js` compares complete conceptual state
transitions from two independent timing representations:

- the simulator's pending-event Turn Resolution Engine;
- a cooldown-based reference derived from the documented PvPoke battle loop.

The comparison is deliberately below decision policy. It records action request,
Fast start, Fast impact, energy gain, HP, energy, pending events, Charged
registration/resolution fields, and CMP ordering. A winner match cannot make a
fixture pass when an intermediate transition differs.

## Frozen fixtures

The executable suite covers 1v1, 1v2, 1v3, 2v3, 2v4, 3v4, 3v5, 4v5 and the
exact-multiple 4v2 geometry. It separately checks simultaneous Charged
readiness, CMP win/loss, a pending lethal Fast, Charged readiness before a Fast
impact, Fast impact before same-boundary Charged registration, simultaneous
faint, one-turn lag, and DRE pending state.

The reference is conceptual rather than imported PvPoke code. Its purpose is to
freeze the reverse-engineered 500 ms cooldown semantics without sharing the
event queue implementation under test.

## Divergence classes

Every future mismatch must be assigned before mechanics change:

- **A** — canonical mechanics bug in PoGoPVPSimulator;
- **B** — different but valid simulator convention;
- **C** — PvPoke heuristic or policy difference;
- **D** — intentional project improvement;
- **E** — unresolved.

The harness initially reports an unexpected transition mismatch as `E`. A
fixture may be changed only after its classification and evidence are recorded.
Policy differences must not be repaired in this mechanical layer.

Run:

```powershell
npm run test:timing-compatibility
```
