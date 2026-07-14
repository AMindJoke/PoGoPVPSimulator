# Charged Move Planner

## Purpose

The charged-move planner chooses the line that produces the best projected battle result. It does not assume that the move with the highest immediate damage or lowest energy cost is always correct.

## Bounded Continuation Search

The existing local heuristics remain the default path. A continuation comparison is activated only when:

- the Pokemon has at least one charged move ready;
- at least two meaningful candidates can be compared;
- one candidate has a guaranteed stat effect that can still change a stat stage.

Candidates include ready moves and a guaranteed-effect move that is exactly one fast move away. There are at most two charged candidates because a combatant has two charged slots.

For each candidate, the planner:

1. clones the complete battle state;
2. throws the move, or waits one fast move when needed;
3. applies damage, shields, and guaranteed effects with the normal battle engine;
4. continues the battle to a KO with the normal AI;
5. scores the final state with the existing matchup score;
6. restores the untouched live state.

Nested continuation searches are disabled during a projected branch. This makes the search one charged-decision ply deep and prevents exponential branching in live battles, matrix cells, and offline ranking generation.

## Preserved State

Projected branches preserve HP, energy, shields, attack and defense stages, current fast-move timing, current turn, battle policy, baiting and shield settings, charged moves already taken, and Shadow attack/defense modifiers.

## Result Ordering

Candidate lines are compared in this order:

1. win over draw over loss;
2. side-oriented matchup score;
3. remaining HP ratio;
4. remaining energy;
5. remaining shields and fewer shields spent;
6. shorter continuation;
7. lower energy cost and stable move-name ordering.

## Guaranteed And Chance Effects

Effects with a 100% activation rate are applied deterministically. This includes self-buffs, opponent debuffs, self-debuffs, and multi-stage effects.

Chance-based effects keep the existing policy and are not treated as guaranteed by the planner. Expected-value and probabilistic branch simulation remain future work.

## Diagnostics

The matrix worker accepts `debugChargedDecisions: true`. Debug results then include `chargedDecisionDiagnostics`, with immediate damage, energy cost, effect summary, projected result, final resources, and the selected move. The production UI does not request or display these diagnostics.

## Regression Tests

Run:

```powershell
npm run test:charged-planner
```

The test uses the live matrix worker and canonical gamemaster data. Add future matchup regressions to `tools/test-charged-move-planner.js` by overriding only the tested legal moveset. Never add Pokemon-name checks to the planner.

## Offline Data Impact

Planner changes invalidate browser matrix/meta caches and the offline matchup cache. The engine versions must be bumped before generating new data. Existing ranking JSON remains readable, but it represents the older decision engine until regenerated.

After targeted validation, regenerate the complete Great League ranking and matchup files with:

```powershell
npm run generate:great-league-full
```

The versioned cache will ignore results produced by an older planner.
