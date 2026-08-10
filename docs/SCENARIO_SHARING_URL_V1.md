# Scenario Review URL format v1

The share flow transports a canonical Scenario Review document entirely through a client-side URL, without an account, backend or server-side scenario storage.

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

Before compression, the transport layer replaces identical copies of the semantic timeline with validated internal references. Decode restores independent timeline arrays before canonical validation, so the Scenario schema and runtime behavior remain unchanged. Earlier unpacked `v1.g` and `v1.r` links remain supported.

## Copy Share Link

`Copy Share Link` serializes the current canonical Manual Mode state at click time, builds the versioned URL and writes it with the Clipboard API. A dependency-free `execCommand("copy")` path remains available when clipboard permissions or APIs are unavailable.

Desktop renders the command compactly beside the existing Scenario controls. Mobile reuses the same element and handler inside the bottom sheet's Scenario tab. Successful copies show a brief `Link copied` acknowledgement and announce it through an ARIA live region.

## Robustness corpus

The automated URL corpus covers short, long, dense and active-DRE scenarios. Current deterministic budgets are:

- short scenario: at most 15,000 token characters;
- 250-event timeline: at most 20,000;
- 1,000-event stress timeline: at most 60,000;
- 82-event DRE scenario with pending Fast damage: at most 15,000.

The suite also verifies legacy-v1 decoding, truncated gzip rejection, decompression limits and exact semantic round trips. These are transport budgets rather than guarantees imposed on user scenarios; the hard safety limits remain authoritative.
