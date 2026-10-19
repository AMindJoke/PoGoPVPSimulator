# v49 Pre-push Verification

This report records the checks completed before the authorized selective release. Experimental UI Lab changes, legacy aggregate datasets and temporary generation artifacts are excluded from that release.

## Data

- Engine: battle-planner-v49.
- Regenerated ranking: 1,541 legal candidates, 43 meta opponents, 397,578 cells; quality VALID, no failed simulations.
- Complete Top 50 key-matchup coverage for all 1,541 candidates. Top 50 membership overlap with previous release: 50/50.
- Reviewable generation bundle and previous-asset backups: reports/meta-refresh-zBLrFP (intentionally Git-ignored).
- Local current/season JSON and JS assets updated and verified against engine, Game Master hash, moveset hash, saved IV builds, scores and detail provenance.
- Release test passed, including 136 independent canonical VM replays of saved key wins/losses.
- Offline asset cache advanced to v196. Candidate searches reject stale engine/season rankings. The threat pool falls back to the curated meta when the ranking is stale.

## Browser Evidence

Source: browser-benchmark.json. Actual local Edge headless with real workers, DOM, localStorage and IndexedDB. Separate fresh contexts for desktop and mobile emulation; service workers blocked to avoid unrelated offline-version contamination. Mobile emulation runs on the PC, not a physical phone.

| Operation | Desktop | Mobile Emulation |
| --- | ---: | ---: |
| Resume 720-cell coverage after cancelling at 8 completed cells | 3,570 ms | 3,957 ms |
| Coverage after reload, localStorage result cache removed | 124 ms | 120 ms |
| 1,803 replacement jobs (600 candidates, three threats plus baseline) | 2,437 ms | 2,716 ms |
| Replacement after reload, localStorage result cache removed | 93 ms | 95 ms |

Both reload checks dispatched zero simulations and recovered every result from durable cache. Both cancellation checks rejected late worker responses, preserved eight completed cells and computed only the remaining 712. No failed cells or page errors. Eight distributed coverage scores per context matched the main-thread canonical Battle path exactly.

Separate Node native-worker benchmark: 512 exact-parity cells, 2,569 ms serial versus 1,013 ms using four workers and batches of four. This measures worker throughput, not a new speed improvement introduced in this guard change.

## Passed Checks

- npm run test:team-builder
- node tools/test-team-builder-candidates.js
- node tools/test-shared-matchup-cache.js
- node tools/test-pwa-contract.js
- node tools/test-battle-intelligence.js (includes charged ordering, response selection, timing, shield parity and configured-policy regressions)
- node tools/test-automatic-battle-quality.js (13 cases, 313 legal alternatives)
- node tools/test-current-meta-release.js
- node tools/refresh-current-meta.js --check
- node tools/test-team-builder-browser-v49.js (requires bundled Playwright and local Edge; sandbox launch failed, execution outside sandbox passed)
- node tools/test-pwa-release-upgrade.js (real service-worker migration from commit 135d9153/v190 to v196, desktop and mobile emulation)

## Service-worker Upgrade

Source: pwa-upgrade.json. Served the actual previous Git revision, let the browser install its service worker and HTTP cache, saved a team and three old-engine results, then switched the same origin to the new release without clearing browser storage. Both desktop and mobile emulation passed:

- Old v190 cache replaced by v196; loaded engine, rankings and details all identify v49.
- Saved team, IVs and build preserved. Three old numerical results remain stored but no current job reuses them.
- Offline reload restores current shell and ranking/details; offline worker simulation matches the main-thread canonical Battle score.
- No browser page errors.

The upgrade harness defaults to the pinned previous production commit; use --baseline=<ref> for a different baseline. Browser tests require the bundled Playwright runtime and local Edge. PWA static contract checks remain available without a browser.

Historical broad-golden and Skeledirge/Marowak timing expectation failures described in strategy-shield-policy-20261018.md remain outside this consolidation; they were not rewritten to conceal failures. The strategy is bounded forecasting, not exhaustive optimal play. Legacy aggregate datasets outside the current ranking/details bundle were not relabeled as v49.

## Selective Release Check

Exported the Git index into an isolated directory and reran release validation, Team Builder, Battle Intelligence, announced/released move data, season data, shared-cache and browser integration tests there. The exported copy keeps the baseline UI Lab and legacy aggregate datasets, so these checks do not depend on the excluded local changes. All 15 named battle-reference checks passed in this copy, including priority-only CMP replays and navigation between Team Builder, Quick Matchup and Battle.

This final check exposed a broken CMP diagnostic source anchor after v49 changed round preparation. Fixed the diagnostic-only injection point and versioned its script URL; canonical Battle results and timing remain unchanged, as checked by test-cmp-dependency.js. Updated isolated navigation/released-move test contexts to load their existing Mega dependencies. PWA upgrade coverage also exercises the updated offline CMP worker.

Excluded: experimental PogoPvp-ui-lab.html edits, legacy aggregate matchup/full-ranking/quality-report files, timestamp-only parity report changes, generation cache/chunks, local state checkpoints and shutdown helpers.

## Follow-up

Run release/PWA gates again if the engine or data changes. Inspect remaining local changes separately from this release. No outstanding generation or benchmark sessions remain after completion.
