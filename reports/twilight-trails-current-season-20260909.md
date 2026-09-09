# Twilight Trails is the current season

Canonical battle-data.js, default movesets, rankings and ranking details now use
the confirmed Twilight Trails dataset and the finalized global-weight ranking.
The catalog identifies Twilight Trails as current; the old season is no longer
selectable. Old query parameters and saved season choices resolve to current.
The retained next-season descriptor is disabled, so no preview banner is shown.

The browser was checked locally: Battle and Meta load, the finalized scores are
shown without a preview banner, and no console errors were recorded.

## Preparing a future preview

Update data/seasons/next-season.js with the future season's ID, label, versions,
move overrides and Pokemon availability. Set enabled to true only when ready.
Point generatedAssets at its generated scripts and generatedGlobals at the
window globals exported by those scripts. The loader reads this configuration;
it no longer hard-codes Twilight Trails. The catalog hydrates the generated
preview after those scripts load. Current assets remain available for fallback.

After confirming and finalizing that season, tools/promote-season-assets.js
validates assets; --apply promotes them to the canonical data paths. Update the
current catalog descriptor, disable the preview and bump the service-worker
version in the same release. Engine and browser integration tests should pass
before publishing.

Tests cover canonical confirmed move values, complete current rankings, old
URLs/preferences, disabled previews and a future preview with a different ID.
