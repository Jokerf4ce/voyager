# Voyager — notes for Claude

- **Bump the version with every change.** Update `VERSION` in `js/version.js` (MINOR for features, PATCH for fixes/tweaks, today's date) and add an entry at the top of `CHANGELOG.md`. The number is shown in the bottom-right corner of the game.
- Plain HTML/JS/CSS, no build step; `index.html` loads the scripts in order. All game content lives in `js/data.js`.
- When the save format changes, bump `version` in `js/state.js` and `saveKey` in `js/data.js` so old saves start a new game instead of breaking.
- Design decisions are recorded in `docs/concept.md` (marked Decided / Proposed / Open).
- The game is published with GitHub Pages from `main` (https://voyager.playle.io/); every push deploys. Keep all paths relative.
- Balance changes: check them with the playtest bot, `python3 tools/playtest/playtest.py` (see `tools/playtest/README.md`), before and after.
