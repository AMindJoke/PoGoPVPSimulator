# Pokemon GO PvP Simulator

Browser-based Pokemon GO PvP simulator inspired by PvPoke.

## Open locally

Open `PogoPvp.html` in a browser.

## Publish with GitHub Pages

This folder includes `index.html`, so GitHub Pages can open the simulator from the repository homepage.

Required files:

- `index.html`
- `PogoPvp.html`
- `gamemaster-data.js`

Optional/local files such as `.exe`, `.zip`, and old test files are not needed for the web version.

## Data

The simulator uses a gamemaster stored in `gamemaster-data.js`.


```powershell
.\tools\Import-PvPokeMovesets.ps1
```

This writes `pvpoke-default-movesets.js`, a lightweight local `speciesId -> moveset` map.
