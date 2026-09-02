# Season Preview Workflow

The simulator resolves every season-sensitive input through `PvPeakSeasonContext`. Current Season continues to reference the canonical `battle-data.js`, `default-movesets.js`, and Great League ranking globals without cloning or modifying them. A preview is an isolated descriptor in `data/seasons/next-season.js`; it is unavailable unless its move overrides and generated ranking outputs pass validation.

## Creating a preview

1. Replace the `null` value in `data/seasons/next-season.js` with one descriptor containing a stable `id`, display `label`, `dataVersion`, `rankingVersion`, and `enabled: true`.
2. Put changed moves in its single `moveOverrides` object. Every entry names one canonical move ID, contains only the changed numeric fields, and carries `status: "estimated"` or `status: "confirmed"`. An estimated entry also requires a short provenance `note`.
3. Supply season-derived `generated.rankings` and `generated.rankingDetails`. Do not point these fields at Current Season output after move values diverge.
4. Run `npm run test:season-context`, the generated-data validation, and representative Current Season regressions before enabling the descriptor.

The application deliberately refuses to expose an enabled preview whose generated outputs are missing. This prevents the Simulator from using preview move data while Team Builder silently uses Current Season rankings.

## Updating an estimated value

Edit that field once in `moveOverrides`, retain or update its provenance, regenerate only the preview outputs, then rerun season validation and regressions. Do not edit the Compendium, Simulator, Team Builder, or caches separately; they consume the resolved dataset.

## Cache and share identity

Season-dependent cache keys contain `seasonId:dataVersion:engineVersion`. Team Builder jobs and in-memory matchup matrices therefore cannot cross seasons. Exported Scenario Review documents contain `dataset.seasonId` and `dataset.dataVersion`; older documents without this field remain importable with a compatibility warning.

## Promoting Next to Current

1. Replace every incorrect estimate with the official value and mark all entries confirmed.
2. Regenerate and validate every season-derived output.
3. Materialize the resolved preview data into the canonical Current Season sources. The promoted season must not remain an override layer.
4. Update the `current` descriptor in `data/seasons/season-catalog.js` to the promoted season ID and new data/ranking versions.
5. Set `BATTLE_NEXT_SEASON` back to `null`. This removes the selector/banner automatically.
6. Bump the service-worker cache version and clear or migrate the stored season preference.
7. Run the complete suite, Current Season battle regressions, build checks, and responsive smoke tests.

## Starting the following preview

Create a fresh descriptor and overrides against the newly canonical Current Season. Never stack the previous preview overrides underneath the new preview.

## Multi-tab behavior

An explicit `?season=<id>` URL wins for that tab. Without an explicit URL, the saved preference is used. A change is persisted for subsequent navigation/reloads; already-open tabs are not force-reloaded or synchronized.
