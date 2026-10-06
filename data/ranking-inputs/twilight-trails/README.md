# Twilight Trails ranking inputs

`weights-ranked-core.json` and `expert-candidate-prior.json` are the versioned
inputs used for the current Great League meta ranking. The 43-opponent pool is
defined separately in `data/great-league-meta.json`.

Run `node tools/refresh-current-meta.js --check` to check the published ranking and key matchups against
the current Game Master, movesets, opponent pool and mirrored data files.
`node tools/refresh-current-meta.js --prepare` regenerates the ranking, analysis and key matchups under
`reports/meta-refresh-*` without replacing published assets. After reviewing the
result, `node tools/refresh-current-meta.js --publish --prepared=reports/meta-refresh-EXAMPLE` validates that prepared release and updates the canonical
and season JSON/JS files, plus the offline cache version. Review the Git diff
before committing or pushing.

The refresh aborts if any top-50 matchup is absent from the current-signature
cache or if fewer than 40 Pokemon remain in the previous top 50. Cache files
themselves are local build inputs; the published details contain the validated
key matchup scores.

Generation uses an isolated cache under `reports` and fills every candidate's
1–1 matchups against the newly ranked top 50. The native offline worker is
checked against the canonical VM worker by `tools/test-meta-worker-parity.js`.
Rankings save exact Rank 1 IVs, selective baiting, always-shield policy and zero
starting energy; Quick Matchup and Open in Battle retain those conditions.
