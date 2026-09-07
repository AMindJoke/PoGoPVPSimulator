# Twilight Trails promotion preparation

Preparation was performed from `fdd4aa0` (`Make strict DRE the canonical timing mode`) after a fast-forward pull from `origin/main`.

## Scope and current state

- `data/seasons/season-catalog.js` is the canonical season switch. Its `current` entry still points at `current-2026-06-28`; its `next` entry is the Twilight Trails preview descriptor.
- `data/seasons/next-season.js` contains the preview-only move and learnset overlays. It is not canonical Game Master data.
- `src/season/season-context.js` validates descriptors, applies preview overlays in memory, selects query/local-storage seasons, and includes season/data/engine identity in cache keys.
- `data/seasons/season-generated-loader.js` routes preview ranking, details, and moveset assets without changing the permanent loader architecture.
- `sw.js` and the page registration query currently cache both canonical and preview assets. A promotion must bump both cache identifiers so installed PWAs do not retain old ranking files.
- The current preview assets remain draft artifacts. No official values were changed, no promotion was performed, and no final ranking was regenerated in this preparation pass.

The permanent architecture already supports Mega identities, an N-sized charged-move collection, third charged moves, season-aware generation/caches, and future previews. The Twilight Trails descriptor, provisional overlay, banner/toggle, and preview assets are the temporary instance to remove at promotion time.

## Safeguards added

`src/season/season-context.js` now supports strict validation of preview move overlays (`requireConfirmed: true`). `src/season/season-promotion.js` provides deterministic, side-effect-free operations to:

1. apply only supplied official corrections;
2. mark supplied values confirmed and optionally confirm all unchanged provisional values;
3. resolve the preview Game Master and validate canonical data, move IDs, learnsets, pending values, and generated-asset requirements;
4. build the promoted catalog (`current = Twilight Trails`, `next = null`) and a canonical-path plan.

`tools/season-promotion.js` is the command-line dry-run entry point. It never writes files, so preparation and simulation cannot accidentally promote a preview. `--mode=validate` fails while any estimated value remains; `--mode=simulate --allow-provisional` demonstrates the catalog transition without requiring official values.

## Official update workflow

When the official Twilight Trails data is published, create a small corrections JSON containing only values that changed. For example:

```json
{
  "moves": {
    "MOVE_ID": { "power":  X, "energy": Y, "duration": Z }
  },
  "confirmUnchanged": true
}
```

Then run the following in order:

```text
node tools/season-promotion.js --mode=validate --corrections=PATH --confirm-unchanged --require-generated
npm run generate:twilight-trails
npm run merge:twilight-trails
npm run details:twilight-trails
node tools/season-promotion.js --mode=validate --corrections=PATH --confirm-unchanged --require-generated
```

The first validation must reject unresolved estimated/unknown/null values. Generation must use the strict-DRE canonical path, with Twilight overlays applied only for the preview run. After generation, validate ranking metadata, move IDs, learnsets, row counts, and cache identities; run the provisional-versus-final differential audit and inspect any material rank or matchup deltas. Only after those checks pass should the promotion commit copy the validated Twilight assets into the canonical root, set `current` to Twilight Trails, set `next` to `null`, remove the preview-only descriptor/assets/banner/toggle, bump the service-worker/page cache version, and push the release.

The season context already handles stale local preferences: an invalid old season selection is replaced by Current, while the promoted Twilight ID remains valid as the new Current. The promotion commit should still clear any preview-only preference key if one is introduced later.

## Verification performed now

All preparation tests passed with the bundled Node runtime:

- season context and UI contracts;
- Twilight Trails draft data and runtime integration;
- season generation and generated-data loader;
- promotion preparation (strict rejection, confirmed correction flow, catalog simulation, stale-preference behavior, no-write guarantee, and future-preview readiness).

No battle-mechanics changes were mixed into this preparation work.
