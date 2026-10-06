# GO PvP Simulator

Browser-based Pokémon GO PvP battle simulator and manual scenario review workspace.

## Open locally

Open `PogoPvp.html` in a browser.

## Publish with GitHub Pages

This folder includes `index.html`, so GitHub Pages can open the simulator from the repository homepage.

Required files:

- `index.html`
- `PogoPvp.html`
- `battle-data.js`

Optional/local files such as `.exe`, `.zip`, and old test files are not needed for the web version.

## Battle reference checks

Before changing battle mechanics or publishing a simulator update, run:

```powershell
node tools/check-battle-reference-cases.js
```

The command fails if any check fails and writes `reports/battle-reference-checks/latest.json`, including full output for diagnosis. It covers controlled live-worker mirrors, unequal Attack CMP, Fast attacks from one to five turns, energy limits, shields/debuffs, pending impacts, switches after Charged Attacks, special forms, diagnostic isolation, navigation parity, and counter alignment across equal-shield scenarios. A separate group checks selected strategic decisions against legal alternatives.

These checks establish named mechanics and selected cases. They do not establish globally optimal play, cover every matchup, or model real device/network latency. Controlled action sequences deliberately separate mechanics from the planner's strategic choices.

Battle and Suggested Trio role matchups show a compact CMP badge only when a priority-only replay changes the outcome. The check keeps the same IVs and starting resources, verifies the same preceding timeline and paired Charged Attacks, and tries at most four CMP turns. It does not replace the canonical result or certify that other IV builds have no breakpoints. Tap the badge for the decisive turn, effective Attack values and alternate outcome.

## Team Builder analysis

Your roster starts expanded. Choose **Against a team** or **Against the Meta** in the connected tabs below it; only the selected analysis is displayed, with its controls and results preserved when switching.

Against an opposing roster, one setup groups the opponent builds, comparison shields/energy, switch reaction and optional manual trio. **Analyze** prepares comparison matchups and role checks in sequence, then replaces setup with an **Edit setup** recap and the results. Changed rosters or conditions hide previous results until **Update analysis**. Comparison shields/energy apply to baseline matchups and farm; role checks retain their explicit scenario conditions.

**Which three?** presents compact role suggestions. Select **Use trio**, then **Matchups** to inspect Lead/Switch/Closer results; tapping a cell opens the real result and its Battle link. Switch distinguishes a new counter with reaction delay from an opponent staying with one Fast move of energy. CMP and tested alternatives remain available when they affect the outcome.

**Farm** prepares routes when first opened for a ready trio, then lets you choose a losing Pokémon and its opponent, then inspect the two teammates' real farm routes. Advanced plans, replies, conditions, ordered opposing counters and the full roster matrix remain expandable. Manual trio choices show comparison matchups without assigning suggested roles. These are individual simulations under explicit conditions, not a full 3v3 game or a prediction of opposing picks.

The setup coordinator is checked with `node tools/test-team-setup-flow.js` (sequential completion, warm reuse, changed-input cancellation and failed/incomplete results).

## Data

The simulator uses a gamemaster stored in `battle-data.js`.


```powershell
.\tools\Import-DefaultMovesets.ps1
```

This writes `default-movesets.js`, a lightweight local `speciesId -> moveset` map.

## Offline Great League data

Generate the offline Great League ranking and matchup dataset with:

```powershell
npm run generate:great-league-ranking
```

The default build uses Rank 1 and default IV profiles for the 0-0, 1-1, and 2-2 shield states. To generate every configured shield state, run:

```powershell
npm run generate:great-league-ranking:full
```
