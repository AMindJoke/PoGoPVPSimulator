# Planner Quality Assurance

Planner QA turns a reported matchup problem into a permanent, concept-centered
regression. It measures whether the planner understands tactical mechanics rather
than whether it memorizes individual Pokemon.

## Golden Corpus

The curated Great League corpus lives at:

`data/golden-corpus/great-league.json`

It is not a ranking or a matchup cache. Every entry has one primary
`tacticalCategory`, a complete reproducible setup, observable expectations, an
important decision, notes, and editorial confidence.

The initial category catalog includes stat effects, self-debuff sequencing,
straight and bait lines, shields, extra-fast flips, CMP, overfarm, energy,
closing moves, cheap move versus nuke decisions, safe-sacrifice controls, and
fast-move pressure.

## Adding A Matchup

1. Reproduce the reported behavior with Battle Review and a decision trace.
2. Identify the existing tactical category that best describes the issue.
3. Add one corpus entry with the smallest complete battle setup.
4. Assert observable behavior: winner, selected move or shield, reason code, or tactical pattern.
5. State the expected planner behavior and most important decision in plain English.
6. Run the benchmark before changing the planner.
7. Implement a generic mechanics-based fix, never a species-specific exception.
8. Run the benchmark again and inspect category-level changes.

Add a new tactical category only when no existing concept accurately describes
the behavior. A known failure should remain red in the corpus until the planner
actually satisfies its trusted expectation.

## Benchmark

Run:

```powershell
npm run planner:benchmark
```

The command executes the corpus through the live worker with tracing enabled,
builds Tactical Pattern Library findings, and writes:

- `reports/planner-benchmark/summary.json`
- `reports/planner-benchmark/summary.md`
- one diagnostic JSON file per failed case

Reports are local build artifacts and are ignored by Git. By default, an existing
`summary.json` is loaded before replacement and used as the previous result.

To compare with a specific report:

```powershell
node tools/run-planner-benchmark.js --compare=path/to/summary.json
```

The benchmark is informational during this phase. Use `--strict` to return a
non-zero exit code when any Golden Corpus case fails.

## Reading The Report

The overall pass rate is useful, but tactical coverage is the primary signal.
The report shows:

- concepts covered versus the category catalog;
- pass/fail counts per tactical concept;
- concepts with full coverage;
- concepts with known planner weaknesses;
- average confidence of emitted tactical findings;
- new failures and fixed regressions compared with the previous run.

A category with one passing case is covered, but not mature. Coverage depth should
grow through mechanically distinct examples, A/B orientation checks, Shadow
variants, shield states, and negative controls.

## Quality Gates

Future CI may gate on:

- Golden Corpus pass rate;
- zero new high-confidence failures;
- critical tactical category regressions;
- contradiction count;
- average finding confidence;
- minimum coverage depth per mature category.

These gates are documented but not enforced yet. The corpus currently includes
known planner weaknesses, which is intentional.

## Long-Term Workflow

```text
Wrong matchup reported
  -> Battle Review
  -> Decision Trace
  -> Tactical Pattern inspection
  -> Golden Corpus entry
  -> Generic planner fix
  -> Planner benchmark
  -> Review category deltas
  -> Merge
```

Future Deep Oracle comparison, random sampling, anomaly scanning, and automatic
corpus proposals should feed this pipeline rather than replace it.
