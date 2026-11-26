# Voyager — Concept

> Status: early concept. Sections are marked **Decided** (your call), **Proposed** (a suggestion to react to) or **Open** (still to decide).

## 1. Pitch

A grimdark, pixel-art 4X space game for the browser. You lead a desperate faction through a dying galaxy full of hostile aliens. You explore, expand, exploit and exterminate one turn at a time, while your empire also keeps grinding forward on its own between sessions. Rare leaders, ships and relics come from gacha-style "signals" pulled from the void.

## 2. Pillars

| | |
|---|---|
| **Decided** | Single player against AI empires |
| **Decided** | Turn-based, mixed with incremental/idle and gacha systems |
| **Decided** | All four X's: explore, expand, exploit, exterminate |
| **Decided** | Mostly menu-driven UI, plus a star system map |
| **Decided** | Plain HTML, JavaScript and CSS, with images for graphics |
| **Decided** | Grimdark tone, with aliens |
| **Decided** | Pixel art inspired by *Graveyard Keeper* and *Quasimorph* |

## 3. Core loop

**Proposed.** How turn-based, idle and gacha can fit together:

1. **Turn (a "Cycle").** You give orders: build, research, move fleets, colonise, negotiate, fight. Then you end the turn and the AI empires act.
2. **Idle layer.** Every Cycle, the empire's resources build up. Optional **auto-cycle** mode ends turns on a timer while you watch. When you come back after closing the game, it can simulate the missed Cycles up to a cap and show a report ("While you were gone…").
3. **Incremental layer.** Production grows on multipliers: upgrades, research and leaders stack. Later tiers unlock new resources and systems. A **prestige/reset** loop (see §8) lets you restart the galaxy with permanent bonuses.
4. **Gacha layer.** You pull from **Void Signals** using an in-game currency earned by playing, never real money. Pulls give leaders, ship blueprints and relics, which feed back into the 4X game.

## 4. The four X's

**Proposed.**

- **Explore.** Scout ships reveal systems, anomalies, derelicts and alien ruins. Text events have choices, some of them risky or horrifying.
- **Expand.** Colonise planets and build outposts. Each colony has a menu screen with buildings, population and unrest.
- **Exploit.** Resources and production chains, research, and colony upgrades. This is where the incremental growth happens.
- **Exterminate.** Fleets, ship designs from blueprints, and turn-resolved battles shown as a battle report with simple pixel-art visuals. Planets can be invaded, purged or razed.

## 4a. Systems and planets

**Star classes** (decided: based on the Morgan–Keenan stellar classification). The effects are proposed:

| Class | Star | Planets | Planet temperatures lean | Infrastructure (starlight) | Habitability |
|---|---|---|---|---|---|
| O | Blue giant | 1–3 | strongly hot | ×1.6 | −1 (radiation) |
| B | Blue-white | 2–4 | hot | ×1.4 | −1 |
| A | White | 2–5 | hot | ×1.25 | — |
| F | Yellow-white | 2–5 | hot/temperate | ×1.1 | — |
| G | Yellow dwarf (like the Sun) | 2–5 | temperate | ×1.0 | — |
| K | Orange dwarf | 2–5 | cool/temperate | ×0.9 | — |
| M | Red dwarf (most common) | 1–4 | strongly frozen | ×0.75 | — |

The home system is always a G star.

Rare special stars (proposed): a **Red Hypergiant** (luminosity class 0, about 1,400 solar radii), with 1–3 scorched planets, Infrastructure ×2 and habitability −2. It never appears at random. One is placed among the charted systems at the start, for show.

**Start** (decided): the game begins with about 10 systems already charted, the ones nearest to home.

**Maps** (decided: a star map plus a solar system map). The **Star Map** shows the galaxy: systems, hyperlanes and fleets. The **Solar System** map shows one system: the star in its class colour, planets on their orbits with their habitability, colony markers and orbital stations, and fleets at the jump point. The Solar System map draws sizes to scale: real radius ratios between stars and planets, from a 109-Earth-radii Sun down to Mars-sized dwarfs. Only the edge of the star fits on screen. Distances are compressed. Planets are numbered outward from the star. Hot worlds orbit closest and frozen ones farthest out.


**Decided:** each star system has several planets (1–5 depending on the star), and each planet has two building layers, **surface** and **orbit**.

**Proposed** (as built in the POC):
- A system is owned as a whole. The first colony in a system needs a Colony Ark. Further planets in a system you hold can be settled for Metal and Polymers, with the cost rising as you grow.
- Each layer has a number of **slots**. A slot holds one kind of building, and levels are unlimited.
- **Planet classes** (decided): every planet is defined by three factors.
  - **Size:** Giant (gas only), Large, Average, Dwarf. Size sets the slots: Giant 0 surface / 5 orbit, Large 5/4, Average 4/3, Dwarf 2/2. Dwarfs are one habitability step worse.
  - **Composition:** Gas, Ice/Water, Silicate (earth-like). Gas ×2 Polymers, Ice/Water ×1.3 Infrastructure, Silicate ×1.5 Metal and ×1.2 Rare Minerals.
  - **Temperature:** Frozen, Temperate (Silicate and Ice/Water only), Hot. Frozen ×1.5 Compute (free cooling), Temperate ×1.2 Infrastructure, Hot ×1.5 Rare Minerals.
  - That gives eight classes: Cold/Hot Gas Giant (habitability 1), Ice World (2–3), Ocean World (3–4), Steam World (1–2), Frozen Rock (2–3), Terran World (4–5, rare), Scorched Rock (1–2).
- **Extremely Hazardous planets (habitability 1) have no buildable surface** (decided). Only orbit can be built.
- The capital is a Large Terran World with Natural Life Support (decided).
- **Surface only:** Deep Mine, Core Drill, Polymer Refinery, Hab Dome, Bastion.
- **Orbit only:** Orbital Shipyard, Habitat Ring, Gas Skimmer, Defense Platform.
- **Both layers** (built separately in each): Fusion Core, Cogitator Array.
- System defense adds up every planet's Bastions and Defense Platforms.
- **Habitability 1–5** (decided). It multiplies building costs on each layer:

  | Habitability | Surface | Orbit |
  |---|---|---|
  | 1 Extremely Hazardous (Venus, Jupiter) | ×7.5 | ×2.5 |
  | 2 Hazardous | ×5 | ×2 |
  | 3 Barren | ×4 | ×1 |
  | 4 Habitable | ×2.5 | ×1 |
  | 5 Natural Life Support (Earth) | ×1 | ×1 |

  Settling uses the surface rate (the orbit rate for gas giants).

## 4b. Resources

**Decided:** Metal, Rare Minerals, Polymers, Compute and Infrastructure, plus Void Shards for the gacha. Energy is folded into Infrastructure. Compute replaces Research. Infrastructure is a capacity cap. Light production chains.

| Resource | Type | Source | Used for |
|---|---|---|---|
| **Metal** | stockpile | Deep Mines (Iron Desert ×2, Ash World ×1.5) | almost everything; refinery input |
| **Rare Minerals** | stockpile | Core Drills (Toxic Mire ×2) | advanced ships, Fusion Cores, Bastions; refinery input |
| **Polymers** | stockpile, refined | Polymer Refinery: 2 Metal + 0.5 Rare → 2 Polymers; Gas Skimmers in orbit (Gas Giant ×2) | Arks, Frigates and better, Habitat Rings, Cogitators, Shipyards |
| **Compute** | stockpile | Cogitator Arrays (Hollow World ×2) | research |
| **Infrastructure** | capacity | each settled planet (base 5), Hab Domes, Habitat Rings, Fusion Cores (Frozen Tomb ×1.5) | used by production buildings (1 per level) and ship crews |
| **Void Shards** | stockpile | exploration, battles, events, some techs and relics | Void Signals (gacha) |

**Infrastructure rules** (proposed and in the POC):
- You cannot build a building or ship whose crew or workers would push usage past capacity.
- If usage ends up over capacity (for example a colony with Habitat Rings is lost), all production is rationed to capacity ÷ usage, down to a minimum of 25%.

## 5. Setting and tone

**Open, with suggestions.** These are placeholders to react to.

- **Grimdark:** scarcity, attrition, impossible choices, no clean victories. Population is a resource you spend.
- **The player faction:** for example the last human fleet, or a fanatical splinter state, cut off from a fallen homeworld.
- **Aliens:** several AI empires, each with its own look and behaviour. For example a hive swarm, an ancient machine remnant, a parasitic cult, or something unknowable in the dark between stars.
- **Void Signals:** the gacha pulls come from listening to transmissions from the deep void. Most pulls are useful. Some are cursed and come with a cost. That makes the gacha part of the setting.

## 6. Gacha

**Proposed.**

- **Pool:** leaders (admirals, governors, scientists), ship blueprints, relics (empire-wide passive bonuses).
- **Rarity tiers** with a pity counter, so a guaranteed rare after X pulls.
- **Duplicates** upgrade the existing item's rank.
- **Currency:** earned from exploring, winning battles, Cycle milestones and achievements.
- **Single-player only:** no real-money purchases.

## 7. UI and screens

**Decided:** mostly menus, plus a star system map.

**Proposed layout:** a top bar with resources and the Cycle counter, a left menu for screens, the main content in the centre, and a "End Cycle" button that is always visible.

**Proposed screens:**
- Empire overview / dashboard
- Star system map (systems, lanes, fleets, fog of war)
- Colony screen
- Research
- Fleets and shipyard
- Diplomacy
- Void Signals (gacha)
- Event / report log
- Settings, save and load

## 8. Progression and prestige

**Open.**
- Does a run end in victory or defeat?
- After a run, does the galaxy reset with permanent "legacy" bonuses (prestige)?
- Or is it one long endless campaign?

## 9. Art direction

**Decided:** inspired by *Graveyard Keeper* (muted, detailed, moody pixel art with warm light in dark scenes) and *Quasimorph* (gritty, dark sci-fi horror with grime and harsh contrast).

**Proposed:**
- A limited, desaturated palette: deep blacks, rust, sickly greens, bone white, with sharp accent colours for danger and rarity.
- Low base resolution for art, for example 32×32 icons, 64×64 portraits and 16×16 UI glyphs, scaled up with `image-rendering: pixelated`.
- A pixel font for headings, and a readable font for body text.
- Emojis or simple placeholders until the art exists.

## 10. Technical

**Decided:** HTML, JavaScript and CSS, with image files for graphics.

**Proposed** (the same approach as Little Life):
- `index.html` plus `js/` (one file per system), `css/` and `assets/`.
- Game data (systems, buildings, techs, events, gacha pools) kept as data objects in JS files, so the game runs straight from the file without a server.
- Saves in `localStorage`, plus export/import of save files.
- Offline progress worked out from a saved timestamp.

## 11. Open questions

1. Who is the player faction, and what happened to the galaxy?
2. How many AI alien empires, and what are they?
3. Is the galaxy procedurally generated each run, or hand-made?
4. Combat depth: automatic battle reports only, or some tactical choices?
5. Prestige/reset loop, or one endless campaign?
6. How strong should idle/offline progress be compared with active play?
7. Is the gacha a core system or a side system?
