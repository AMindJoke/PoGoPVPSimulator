# Scenario Review URL format v1

Phase 2 adds a transport format for opening a canonical Scenario Review document from a URL. It does not add the share-button UI; that belongs to the next phase.

## URL structure

Shared scenarios use the fragment so the encoded battle state is not sent to the web server:

```text
https://example.test/PogoPvp.html#scenario=v1.g.<base64url>
```

The token has three dot-separated fields:

- `v1`: transport version;
- `g`: gzip-compressed UTF-8 JSON, or `r` for the uncompressed fallback;
- URL-safe Base64 without padding.

The JSON is the same canonical document produced by `manual-scenario-io.js`. Decode is followed by the normal strict schema, engine-version, Pokémon, move and branch validation before any state is restored.

## Startup and recovery

When `#scenario=` is present, startup decodes and validates the document, restores the unified Manual Mode state and opens Scenario Review directly. A malformed, unsupported, oversized or incompatible token shows a controlled recovery panel. `Start a new scenario` removes the fragment and opens a clean Scenario Review setup.

Temporary UI state is not encoded. Native `CompressionStream` and `DecompressionStream` are used when available; encoding falls back to raw UTF-8 JSON when compression is unavailable. Both the token and decompressed output have hard size limits, enforced while streaming.
