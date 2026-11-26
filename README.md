# Voyager

A grimdark pixel-art 4X space game for the browser. It is turn-based, with incremental/idle and gacha systems, and runs on plain HTML, JavaScript and CSS.

See [docs/concept.md](docs/concept.md) for the design.

## Play

Open `index.html` in a browser. No server or build step is needed. Saves are kept in the browser's localStorage.

- **End Cycle** (or Space/Enter) advances one turn. **Auto** advances Cycles on a timer.
- **Star Map:** click a system to inspect it, double-click to open its **Solar System** map. Select one of your fleets, then click a system to send it there.
- While the game is closed, the empire keeps producing at 50% efficiency (1 Cycle per 60 s, max 120 Cycles).

## Proof of concept (v0.1)

- Procedural galaxy of 22 systems with hyperlanes and fog of war; each system has a star class (O B A F G K M) and 1–5 planets
- Planets are classified by size, composition and temperature; each has a surface and an orbit layer with their own building slots, and a habitability of 1–5 that changes building costs
- Explore with scouts; exploration events with grim choices
- Expand with Colony Arks into new systems, then settle more planets in systems you hold
- Resources: Metal, Rare Minerals, Polymers (refined), Compute (research) and Infrastructure (capacity cap)
- Research paid in Compute, including endlessly repeatable "Doctrine" techs for the incremental layer
- Ships, fleets, auto-resolved battles, sieges and capturing colonies
- Two AI alien empires (The Chorus, Iron Remnant) that expand, build and attack, plus neutral Lurker monsters
- Void Signals gacha: shards earned in play, rarities, pity, rank-ups, cursed relics, ship blueprints
- Auto-cycle, offline progress, save export/import
- Placeholder pixel art generated in code (planets, portraits, ships), to be replaced with real sprites

## Code layout

```
index.html        page shell, loads the scripts in order
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
js/map.js         star map canvas (galaxy)
js/sysmap.js      solar system map canvas (one system)
js/ui.js          screens and modals
js/main.js        turn loop, auto-cycle, input, boot
```
