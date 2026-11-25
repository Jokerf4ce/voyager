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
