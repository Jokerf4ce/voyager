# Voyager

A grimdark pixel-art 4X space game for the browser. It is turn-based, with incremental/idle and gacha systems, and runs on plain HTML, JavaScript and CSS.

See [docs/concept.md](docs/concept.md) for the design.

## Play

**Play online:** https://voyager.playle.io/ (GitHub Pages, updated automatically on every push to `main`).

Or open `index.html` locally in a browser. No server or build step is needed. Saves are kept in the browser's localStorage.

- **End Cycle** (or Space/Enter) advances one turn. Everything that happens is recorded in the **Chronicle** menu.
- **Star Map:** an endless galaxy under a pan/zoom camera (drag, scroll or pinch; ⌂ for home; a minimap in the corner). Hover a system for a summary card; click it to select it, and its planets and missions appear in the panel beside the map. Double-click (or *Open solar system*) opens the **Solar System** screen with its star and planets. From there, launch a **survey probe** to explore or send a **colony expedition** to a planet you choose (*Send colonists* in its planet list; both cost a flat fee), or send a fleet to **attack**.
- **Fleets:** global, up to 5 ship cards each, plus a hangar and an armory. Click a ship, then a free slot to move it; refit weapons in its panel.
- **Shipyard:** pick a hull size (Small, Medium, Large) and the rest is rolled: type, rarity (Normal → Omega), stats and weapons. Stats come from a normal distribution, so every ship is different.
- **Battles:** turn-based card battles. Pick a weapon, then a target; or use Auto, Resolve instantly or Retreat.
- **Tutorial:** a 12-step guided tour on the first game in a browser (skippable; Settings → *Replay tutorial*).
- The side menu collapses on its own 10 seconds after the cursor leaves it; ☰ opens it again.
- **Tester mode:** Settings → *Open tester mode*, or add `#tester` to the address. A separate save with extra colonies, random buildings, ships of every rarity and full stores, for testing. The real save is not touched.
- While the game is closed, the empire keeps producing at 50% efficiency (1 Cycle per 60 s, max 120 Cycles).

## Proof of concept (v0.1)

- Endless procedural galaxy, generated in chunks as you explore, with hyperlanes and fog of war; only home is charted at the start; a Red Hypergiant waits 2–3 jumps away
- Each system has a star class (O B A F G K M), or rarely a white dwarf, pulsar or black hole, and 1–5 planets
- Buildings managed in one empire-wide list: build where you choose or let Auto pick the best colony; demolish one (✕) to free its slot and salvage 25 % of what it cost
- Planets are classified by size, composition and temperature; each has a surface and an orbit layer with their own building slots, and a habitability of 1–5 that changes building costs
- Explore with scouts; exploration events with grim choices
- Expand with colony expeditions into new systems, then settle more planets in systems you hold
- Resources: Metals, Rare Minerals and Organics (gathered); Electronics and Chemicals (refined); Power, Compute and Infrastructure (capacities); Research
- Research made by Research Labs, including endlessly repeatable "Doctrine" techs for the incremental layer
- Ship cards in 3 sizes (rock-paper-scissors) and 9 types, rolled at 5 rarities; global fleets of up to 5; missions instead of map movement
- Two AI alien empires (The Chorus, Iron Remnant) that expand, build and attack, plus neutral Lurker monsters
- Turn-based card battles: shields and hull, physical vs energy weapons, speed order, evasion, cooldowns; alien raids to defend against; Weapon Forge (Rare Minerals + Electronics)
- Offline progress, save export/import
- Generative soundtrack synthesised in the browser: six tracks in a playlist (mute with ♪, tracks and volume in Settings)
- Ship sprites in a 3/4 view, rendered from small 3D models (`tools/shipart/render.py`): three designs per ship type as grey templates, painted on the fly in each faction's colours (`DATA.shipPalettes`); pick your own fleet colours in Settings
- The Assistant, the ship's computer voice ("Welcome back, Commander."): mp3 lines in `assets/voice/`, listed with their triggers in `js/voicelines.js`
- Placeholder pixel art generated in code (planets, portraits, ships), to be replaced with real sprites

## Versions

The build version is shown in the bottom-right corner of the game. It is set in `js/version.js`, and every change is listed in [CHANGELOG.md](CHANGELOG.md).

Combat rules and numbers: [docs/combat.md](docs/combat.md).

## Code layout

```
index.html        page shell, loads the scripts in order
js/version.js     build version shown in the corner
css/style.css     UI styling
js/data.js        all game content: buildings, ship types, rarities, weapons, techs, events, factions
js/util.js        helpers (random, formatting, pathfinding)
js/planets.js     planet classes: size × composition × temperature
js/state.js       game state G, empire modifiers, save/load, offline progress
js/galaxy.js      galaxy generation and starting positions
js/economy.js     colonies, buildings, per-Cycle production
js/research.js    research
js/ships.js       ship cards: build gacha, weapons, fleets, hangar, armory, forge
js/missions.js    fleet attacks, survey probes, colony expeditions and incoming raids
js/explore.js     exploration, fog of war, events
js/battle.js      turn-based card battles
js/ai.js          alien empire AI: garrisons, expansion, raids
js/tester.js      tester mode (separate save slot)
js/sprites.js     pixel art: procedural planets, stars, building icons; ship sprite paths
js/shipsprites.js ship sprite templates (generated by tools/shipart/render.py)
tools/shipart/    render.py: generates the grey ship templates (assets/ships/, js/shipsprites.js) from small 3D models
js/music.js       music engine and playlist (Web Audio)
js/tracks.js      the soundtrack's tracks
js/voice.js       ship's computer voice engine
js/voicelines.js  voice lines and their triggers
js/map.js         star map canvas (galaxy)
js/sysmap.js      solar system map canvas (one system)
js/ui.js          screens and modals
js/tutorial.js    first-play guided tour (its steps are DATA.tutorial in data.js)
js/ui-ships.js    ship cards, Shipyard, Fleets and Battle screens
js/main.js        turn loop, input, boot
```
