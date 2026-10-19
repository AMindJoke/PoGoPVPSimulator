# Home Updates

Home shows the latest three entries from `data/site-updates.js`, with the same content on desktop and mobile. Entries with the same date keep their file order. Keep older entries in the file; only three are displayed.

For each release with a meaningful user-facing change:

1. Add one entry at the top with a unique ID, the actual publication date (`YYYY-MM-DD`), a short category and title, and one or two short sentences in `changes`.
2. Say what someone will notice. For Battle changes, explain the changed decision or give a real matchup example. For ranking changes, say which rankings or matchups were recalculated.
3. Group related commits from the same release. Tests, internal cleanup and cache-version bumps do not need their own announcement. Do not turn raw commit messages into news automatically.
4. Avoid engine version numbers, cache jargon, claims of optimal play, marketing language, and match outcomes that depend on unspecified settings. Follow the site's English UI.
5. Run `npm run test:site-updates` and the Home/PWA contract checks. Bump the data script's URL in HTML and the service worker when changing the content; bump the offline cache and its HTML registration together for publication.

The renderer uses text nodes, not HTML in update content. Missing or invalid entries are skipped; an empty feed stays hidden. News does not create popups, badges on navigation or unread notifications.
