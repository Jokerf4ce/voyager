# Voyager

A grimdark pixel-art 4X space game for the browser. It is turn-based, with incremental/idle and gacha systems, and runs on plain HTML, JavaScript and CSS.

See [docs/concept.md](docs/concept.md) for the design.

## Play

**Play online:** https://jokerf4ce.github.io/voyager/ (GitHub Pages, updated automatically on every push to `main`).

Or open `index.html` locally in a browser. No server or build step is needed. Saves are kept in the browser's localStorage.

- **End Cycle** (or Space/Enter) advances one turn. **Auto** advances Cycles on a timer.
- **Star Map:** click a system to inspect it, double-click to open its **Solar System** map. Select one of your fleets, then click a system to send it there.
- While the game is closed, the empire keeps producing at 50% efficiency (1 Cycle per 60 s, max 120 Cycles).

## Proof of concept (v0.1)

- Procedural galaxy of 22 systems with hyperlanes and fog of war; the 10 nearest are charted at the start, including one Red Hypergiant
- Each system has a star class (O B A F G K M), or rarely a white dwarf, pulsar or black hole, and 1–5 planets
- Planets are classified by size, composition and temperature; each has a surface and an orbit layer with their own building slots, and a habitability of 1–5 that changes building costs
- Explore with scouts; exploration events with grim choices
- Expand with Colony Arks into new systems, then settle more planets in systems you hold
- Resources: Metals, Rare Minerals and Organics (gathered); Electronics and Chemicals (refined); Power, Compute and Infrastructure (capacities); Research
- Research made by Research Labs, including endlessly repeatable "Doctrine" techs for the incremental layer
- Ships, fleets, auto-resolved battles, sieges and capturing colonies
- Two AI alien empires (The Chorus, Iron Remnant) that expand, build and attack, plus neutral Lurker monsters
- Void Signals gacha: shards earned in play, rarities, pity, rank-ups, cursed relics, ship blueprints
- Auto-cycle, offline progress, save export/import
- Generative soundtrack synthesised in the browser: three tracks in a playlist (mute with ♪, tracks and volume in Settings)
- Ship's computer voice ("Welcome back, Commander."): mp3 lines in `assets/voice/`, listed with their triggers in `js/voicelines.js`
- Placeholder pixel art generated in code (planets, portraits, ships), to be replaced with real sprites

## Versions

The build version is shown in the bottom-right corner of the game. It is set in `js/version.js`, and every change is listed in [CHANGELOG.md](CHANGELOG.md).

## Code layout

```
index.html        page shell, loads the scripts in order
js/version.js     build version shown in the corner
css/style.css     UI styling
js/data.js        all game content: buildings, ships, techs, gacha pool, events, factions
js/util.js        helpers (random, formatting, pathfinding)
js/planets.js     planet classes: size × composition × temperature
js/state.js       game state G, empire modifiers, save/load, offline progress
js/galaxy.js      galaxy generation and starting positions
js/economy.js     colonies, buildings, per-Cycle production
js/research.js    research
js/fleets.js      fleets, shipbuilding, orders, movement
js/explore.js     exploration, fog of war, events
js/combat.js      battles and sieges
js/ai.js          alien empire AI
js/gacha.js       Void Signals
js/sprites.js     procedural placeholder pixel art
js/music.js       music engine and playlist (Web Audio)
js/tracks.js      the soundtrack's tracks
js/voice.js       ship's computer voice engine
js/voicelines.js  voice lines and their triggers
js/map.js         star map canvas (galaxy)
js/sysmap.js      solar system map canvas (one system)
js/ui.js          screens and modals
js/main.js        turn loop, auto-cycle, input, boot
```
