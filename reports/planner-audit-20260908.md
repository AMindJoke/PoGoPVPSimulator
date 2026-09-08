# Planner audit - 2026-09-08

## Completed pass

The corrected worker completed 360 scenarios and 9,096 legal alternative
continuations. The sample covers 324 selected matchups/shield states, the 30-case
golden corpus, and six rank-1 Melmetal/Corsola and Furret/Shadow Talonflame cases.
Both sides use Smart shields in this audit; the golden corpus retains its other
starting conditions. This is a targeted sample, not a full ranking regeneration.

At every decision with an affordable Charged Attack, the audit compares other
legal attacks and one Fast followed by automatic replanning. It also compares
one/two Fast attacks followed by the original Charged Attack (up to four for
one-turn Fast attacks against five-turn attacks), and alternative shield calls.
The opponent continues using the current planner. These are unilateral best
responses to that planner, not a proof of optimal play against every response.

Each intervention must preserve the exact decision prefix. The instrumented
baseline is checked against the unmodified worker. Independent tests additionally
verify 125 no-op interventions and nine full timeline parity checks.
One continuation became illegal and was excluded, not counted as a finding.

## Fixed defects

1. Shield and Charged continuations shared the live pending Fast impact list.
   Simulating an alternative could consume or change an impact in the parent
   battle. All three continuation functions now copy and restore that list.
   Before the fix, merely enabling shield diagnostics with Always shields could
   change the winner of Furret/Shadow Talonflame and Melmetal/Galarian Corsola
   at two shields. Diagnostics are now observational in the tested cases.
2. A projected Fast-plus-Charged close could be considered lethal despite an
   opposing shield. That exception now requires zero opposing shields.
3. The shield-related timing exception could force additional Fast attacks even
   at equal durations or without a timing opportunity. It now requires a shorter
   own Fast attack and an open timing window.
4. The reliability version was v40 while the planner script used v42. Engine and
   script versions are now v43; service-worker cache and registration are v29.
   Tests check their consistency instead of expecting an obsolete literal date.

## Comparison

The original run stopped at case 335 on an illegal follow-up; its 334 completed
cases remain a valid comparison set. The runner now records and excludes that
kind of rejected continuation.

| Same 334 scenarios | Before | Corrected |
| --- | ---: | ---: |
| Legal alternatives evaluated | 10,079 | 8,037 |
| Alternatives improving win/draw/loss | 568 | 189 |
| Scenarios with such an alternative | 115 | 74 |

Counts of alternatives are not counts of independent bugs: several changes can
improve the same battle, and different policies generate different decision
points. Across the complete corrected set, 205 alternatives improve the outcome
in 83 scenarios. These remain candidates for subsequent investigation.

The two orientation differences are normal/Shadow Talonflame at one/two shields.
Their Attack values are exactly equal (121.42395666), so deterministic CMP tie
ordering is relevant; these are not evidence of a cache mismatch by themselves.

## Verification

- General battle regression suite: 12/12 passed.
- Continuation isolation: 16 cases, both orientations, repeated worker use,
  diagnostics on/off and matrix swing analysis on/off; identical final states
  and action/damage ledgers.
- DRE timing guards, Charged planner, Battle Intelligence, principle trace and
  complete-migration tests passed.
- Matchup fixture, flip continuations, pending-Fast mechanics, special forms,
  manual runtime/Charged controls, and targeted Furret/Talonflame,
  Feraligatr/Cradily, Tinkaton/Dusclops, Lickilicky/Froslass, Raikou/Pachirisu and
  IV sensitivity tests passed during this pass.
- PWA and manual UI contracts passed. No live-browser deployment verification
  or full ranking regeneration was performed.

The Melmetal/Corsola test retains the winning result and three-action opening.
It no longer freezes the fourth Charged Attack at T30, which depended on the
previously shared pending-impact state. This is not a claim that the automatic
line now reproduces the entire manually optimized line.

## Saved evidence and next pass

Local detailed results: `reports/planner-alternatives-20260908-corrected/summary.json`.
Each finding also has its own JSON with starting configuration, intervention,
decision evidence, and both timelines. The original and isolation-only runs are
preserved in adjacent directories; only the corrected run is complete.

Run a fresh audit with `node tools/audit-planner-alternatives.js --output=reports/planner-alternatives-next`.
For a smaller investigation add `--match=furret--talonflame_shadow`.
Unchanged runs support `--resume` with a strict source/data/config fingerprint.
The completed corrected report used the same behavior before the metadata-only
v43 bump; its verified resume option is `--source-engine-version=battle-planner-v40`.

Priorities for a next pass: Smart shield allocation, repeated waits after the
opponent already has a Charged Attack, and the remaining Furret/Shadow Talonflame
two-shield alternatives. Validate these against full opponent responses before
changing general policy. Do not hard-code species-specific winning lines.
