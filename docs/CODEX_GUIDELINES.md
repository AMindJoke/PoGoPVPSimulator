# Codex Guidelines

These rules guide future Codex work on PoGoPVPSimulator.

## Read the Docs First

Before major changes, read the relevant files in `/docs`.

For battle logic, read:

- `PROJECT_VISION.md`
- `BATTLE_PHILOSOPHY.md`
- `ROADMAP.md`

For workflow and change style, read this file.

## Preserve Existing Layouts

Preserve the desktop layout unless the user explicitly requests desktop changes.

Mobile changes should be made inside media queries unless the user explicitly asks for shared layout changes.

Do not let mobile fixes accidentally change the desktop experience.

## Keep Changes Incremental

Prefer small, focused changes.

Avoid large rewrites when a local fix is enough. The simulator is evolving quickly, so clear incremental commits are safer and easier to review.

## Do Not Rewrite Working Logic Unnecessarily

Do not replace working battle logic only because a cleaner abstraction is possible.

When logic needs to change, preserve existing behavior where it is still correct and explain the specific behavior being changed.

## Protect App Surface

Unless requested, do not change:

- `PogoPvp.html` UI structure.
- Battle logic.
- GitHub Actions.
- Vercel config.
- Data import scripts.
- Generated gamemaster data.

## Explain What Changed

Always summarize what changed in plain language.

For battle logic changes, explain:

- What behavior changed.
- Why it changed.
- What scenario it affects.
- Any remaining uncertainty.

For UI changes, explain:

- Which surface changed.
- Whether desktop, mobile, or both were affected.
- Any responsive behavior that was adjusted.

## Test and Verify

Use focused verification that matches the change.

Examples:

- For documentation changes, verify files exist and only docs changed.
- For UI changes, check desktop and mobile layout where possible.
- For battle logic changes, inspect affected matchups and explain expected differences.
- For data changes, verify imports and generated files.

## Commit Style

Prefer small incremental commits with descriptive messages.

Do not mix documentation, UI, logic, and data changes in one commit unless the user explicitly asks for a combined change.
