# Houndoom Coverage Comparison

Generated on 2026-10-20 with battle-planner-v50. Run:

```text
node tools/compare-houndoom-coverage.js
```

5,088 fresh simulations: Houndoom and Shadow Houndoom, Incinerate/Foul Play
with either Flamethrower or Trailblaze, default and Rank 1 IVs, Always and
Smart shields, zero starting energy, 0-0/1-1/2-2 shields. The field is the
union of the published top 100 and the configured meta (106 distinct IDs).
Opponent builds and movesets are held fixed between coverage alternatives.

## Result

No unconditional upgrade. Keep the existing default, Flamethrower.
Trailblaze is a valid alternative, particularly with shields available.

For Shadow Houndoom with default IVs and Always shields, wins across the
106 opponents change from 38/57/64 to 33/56/65 in 0-0/1-1/2-2.
With Rank 1 IVs they change from 36/48/61 to 31/49/68.

Examples with default Shadow Houndoom: Trailblaze flips Empoleon in 1-1
under both shield policies, but loses previously winning Feraligatr 1-1
and 2-2 and Florges 2-2. These are simulated lines, not guaranteed outcomes
against every player response or IV spread.

The JSON contains per-profile results and all outcome flips. Scores are
unweighted diagnostic means, not new rankings. The published field is a
fixed sample, includes alternate build IDs, and is not tournament usage.
This comparison does not regenerate or relabel the published v49 rankings.
