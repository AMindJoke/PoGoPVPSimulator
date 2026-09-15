# Fast Count UI Foundation

Fast Count is the pilot implementation for a future GO Judge Hub design system. The foundation is intentionally scoped to `.fast-count-trainer-view` and `.fast-count-foundation-specimen`; it does not alter other product areas.

## Audit

| Classification | Before | Decision |
| --- | --- | --- |
| REUSE | Existing blue, green, red and gold hierarchy; large numeric answers; card-led composition; bottom sheets on mobile | Preserve the approved identity and interaction hierarchy. |
| CONSOLIDATE | Roughly 20 font sizes, 15 control heights, 10 radii, many 5/7/9/11/13px gaps and paddings | Map visual values to a small set of typography, spacing, control, radius and icon roles. |
| REMOVE | Component-specific shadows, pale one-off feedback fills, repeated low-percentage `color-mix` values, near-duplicate font weights | Replace with shared surface, semantic color, shadow and weight tokens. |
| EXCEPTION | Pokémon artwork dimensions, 64px answer targets, 56px feedback icon, 28px energy cells, responsive breakpoints and sheet viewport limits | Retain because they describe content or layout constraints rather than reusable control geometry. |

## Scales

- Spacing: `4 / 8 / 12 / 16 / 24 / 32px`
- Desktop typography: `12 / 14 / 16 / 18 / 22 / 30 / 36px`, with tight `1.2` and body `1.5` line heights
- Compact typography up to 760px: `10 / 12 / 14 / 16 / 20 / 28 / 32px`
- Weights: `400 / 600 / 700 / 800`
- Controls: `32 / 40 / 48px` for SM, MD and LG
- Radius: `6 / 10 / 14px` for SM, MD and LG; round only for circular or status elements
- Icons: `16 / 20 / 24px` for SM, MD and LG
- Borders: 1px standard, 2px strong for answer affordances
- Shadows: one small card shadow and one modal/dropdown shadow

## Components

Buttons share one base with primary, secondary, ghost and danger variants and SM/MD/LG sizes. Inputs and selects use the MD control. Flat, card and emphasis surfaces share the same border and radius family. Progress, feedback, answers, bank cells and move rows use the same semantic and focus tokens.

Type-driven components set only `--move-color`. Move chips use the saturated type color, a strong edge and explicit `Fast` / `Charged` labels; supporting surfaces derive normal and soft roles from the same source.

## Color

Semantic colors expose strong foregrounds and explicit soft surfaces for accent, success, danger and warning states. Light and dark themes use different surface values but retain the same hierarchy. Arbitrary component-level alpha mixes were consolidated into the type roles and shared shadow/focus tokens.

## Living specimen

Open `FastCount-UI-Foundation.html` directly. It uses `src/training/fast-count-trainer.css`, the same tokens and component selectors as the trainer. It is intentionally absent from navigation, the homepage and the service-worker shell.

## Remaining exceptions

- `68 / 62 / 54px`: responsive Pokémon artwork, whose visual mass must shrink independently from controls.
- `64px`: answer buttons, retained as the approved prominent answer target.
- `56px`: success/error result icon, a feedback symbol rather than a control.
- `28px`: dense energy-bank cells needed to show a full move-energy cycle.
- `1 / 2px` mobile rail gaps: prevent horizontal overflow at 320–430px.
- `350 / 430 / 760 / 900px`: existing content-driven breakpoints.
- `380 / 540 / 720 / 760px` and viewport units: dropdown and sheet containment limits.
- Zero values, circles, full heights and motion/reduced-motion values remain technical CSS values.
