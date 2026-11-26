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
2. **Idle layer.** Every Cycle, the empire's resources build up. There is no auto-cycle mode (removed v0.38): Cycles only advance when you end them. When you come back after closing the game, it can simulate the missed Cycles up to a cap and show a report ("While you were gone…").
3. **Incremental layer.** Production grows on multipliers: upgrades, research and leaders stack. Later tiers unlock new resources and systems. A **prestige/reset** loop (see §8) lets you restart the galaxy with permanent bonuses.
4. **Gacha layer.** You pull from **Void Signals** using an in-game currency earned by playing, never real money. Pulls give leaders, ship blueprints and relics, which feed back into the 4X game.

## 4. The four X's

**Proposed.**

- **Explore.** Survey probes reveal systems, their stars, planets and guards. (Until v0.48, charting a system could trigger a text event with choices; those discovery events were removed. The event texts and dialog remain in the code, unused.)
- **Expand.** Colonise planets and build outposts. Each colony has a menu screen with buildings, population and unrest.
- **Exploit.** Resources and production chains, research, and colony upgrades. This is where the incremental growth happens.
- **Exterminate.** Fleets of ship cards and turn-based card battles (see 4c). Planets can be invaded, purged or razed.

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

Rare special systems (decided to add, effects proposed). These are stellar remnants, about one per galaxy:

| Star | Planets | Infrastructure | Habitability | Bonus |
|---|---|---|---|---|
| White Dwarf (Earth-sized dead star) | 1–3, mostly frozen | ×0.4 | −1 | Rare Minerals ×1.5 |
| Pulsar (spinning neutron star with radiation beams) | 1–2 | ×0.3 | −2 | Compute ×2 |
| Black Hole (with accretion disc) | 1–2 | ×0.2 | −2 | Compute ×2.5 |

Rare special stars (proposed): a **Red Hypergiant** (luminosity class 0, about 1,400 solar radii), with 1–3 scorched planets, Infrastructure ×2 and habitability −2. It never appears at random. One is placed 2–3 jumps from home at the start, for show (to be found by exploring).

**Start** (decided, changed in v0.19): the game begins with only the home system charted and only the capital settled. Neighbours show as "?".

**Tester mode** (decided; called the admin test game before v0.30.1): a separate save slot (`voyager_save_v13_tester`) generated with 3 extra colonies holding random buildings, 10 systems charted, fleets of every rarity and full stores, for testing. Opened from Settings or `#tester` (the old `#admin` still works); it never touches the real save.

**Maps** (decided: a star map plus a solar system map). The **Star Map** shows the galaxy: systems, hyperlanes, guards (pips), your missions (gold) and incoming raids (red). The **Solar System** map shows one system: the star in its class colour, planets on their orbits with their habitability, colony markers and orbital stations, and any hostile guard at the jump point. The Solar System map draws sizes to scale, using real radius ratios between stars and planets, from a 109-Earth-radii Sun down to Mars-sized dwarfs. Only the edge of a big star fits on screen. Two exceptions keep things visible: small worlds are drawn at least 8 px across, and pulsars and black holes are enlarged. Distances are compressed. Planets are numbered outward from the star. Hot worlds orbit closest and frozen ones farthest out.

**Endless galaxy** (decided, v0.34): the galaxy is generated in square chunks (`DATA.galaxy.chunk` world units, 4–6 systems each). Whenever a system is charted or owned, every chunk around it (`growRadius`) is generated, so the map grows in every direction as you explore and there is no edge. Each new system is linked to its nearest older one, so everything stays connected; extra lanes are added where they don't cross. Monster lairs get more common with distance from home. The two alien homes start 520–680 units away in different directions, with a corridor of chunks generated to each.

**Star Map camera** (decided, v0.34): the Star Map is a pan/zoom view of the world (drag, wheel, pinch; buttons for zoom, home and the selected system; a minimap). The pixel art is drawn into a low-resolution buffer and scaled up (3 screen px per art pixel, 2 on phones), keeping the chunky look; names and markers are drawn on top at full resolution for readability, without overlapping.

**Map screens** (decided, v0.37; replaces the v0.21 layout with both maps on one page): **Star Map** and **Solar System** are two separate screens in the menu. Each fills the screen height, with the selected system's panel (missions, planets, settle) on the right. Hovering a system on the Star Map shows a summary card. Double-clicking a charted system, or *Open solar system* in its panel, opens the Solar System screen, and *✦ Star Map* goes back. On phones the panel moves below the map and the page scrolls.


**Decided:** each star system has several planets (1–5 depending on the star), and each planet has two building layers, **surface** and **orbit**.

**Proposed** (as built in the POC):
- A system is owned as a whole. The first colony in a system needs a colony expedition (a flat fee since v0.24; a Colony Ark ship before), sent to a planet you choose (since v0.44; before, it took the best planet). Further planets in a system you hold can be settled for Metal and Electronics, with the cost rising as you grow.
- Each layer has a number of **slots**. A slot holds one kind of building, and levels are unlimited.
- **Planet classes** (decided): every planet is defined by three factors.
  - **Size:** Giant (gas only), Large, Average, Dwarf. Size sets the slots: Giant 0 surface / 5 orbit, Large 5/4, Average 4/3, Dwarf 2/2. Dwarfs are one habitability step worse.
  - **Composition:** Gas, Ice/Water, Silicate (earth-like). Gas ×2 Electronics, Ice/Water ×1.3 Infrastructure, Silicate ×1.5 Metal and ×1.2 Rare Minerals.
  - **Temperature:** Frozen, Temperate (Silicate and Ice/Water only), Hot. Frozen ×1.5 Compute (free cooling), Temperate ×1.2 Infrastructure, Hot ×1.5 Rare Minerals.
  - That gives eight classes: Cold/Hot Gas Giant (habitability 1), Ice World (2–3), Ocean World (3–4), Steam World (1–2), Frozen Rock (2–3), Terran World (4–5, rare), Scorched Rock (1–2).
- **Extremely Hazardous planets (habitability 1) have no buildable surface** (decided). Only orbit can be built.
- The capital is a Large Terran World with Natural Life Support (decided).
- **Surface only:** Deep Mine, Core Drill, Electronics Foundry, Hab Dome, Bastion.
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

## 4a-2. Managing buildings

**Decided:** buildings are managed in one empire-wide list, not colony by colony, because a big empire gets cumbersome otherwise.
- **Colonies provide the slots:** each planet layer has its slots. A slot holds one building type, which is levelled up.
- **Building screen:** each building type shows its total level and its colonies. You build either at a colony you pick, or with **Auto**, which picks the spot with the best output per cost.
- **Overview:** lists the building types you own. Clicking one shows which colonies it is on.
- **Costs** (decided v0.33): base cost × the colony layer's habitability multiplier × a **level multiplier**. Up to level 5 each level costs 15 % of the base more (1×, 1.15×, 1.3×, 1.45×, 1.6×); from level 6 every level doubles (3.2×, 6.4×, 12.8×, …). This rewards expanding wide (more colonies) over building tall. Tuned in `DATA.levelCost`.
- **Demolishing** (decided v0.35): any building can be torn down, all levels at once. It frees the slot and returns 25 % of everything invested in it (the price of every level, at the colony's habitability), rounded down (`DATA.demolishRefund`). Power plants and habitats may be demolished even if that leaves a capacity short; the confirm dialog warns how far production would drop.

**Balance (v0.33):** flat costs let the economy run away (in bot tests, buildings reached level 27 and 266 Metals per Cycle by Cycle 150). With the level curve the same bot stays around level 3–6 and 90 Metals per Cycle, and grows by founding colonies instead.

## 4b. Resources

**Decided:** three gathered resources, two refined goods and three capacities, plus Research and Crypto Shards (v0.47, an interstellar currency for trade, deliberately scarce). (Void Shards were removed in v0.43.)
- Gathered: Metals, Rare Minerals, Organics.
- Refined: Electronics and Chemicals. These are only spent on building.
- Capacities: Power, Compute and Infrastructure.
- Research is its own points, made by Research Labs. Compute only limits advanced buildings and ships.

| Resource | Type | Source | Used for |
|---|---|---|---|
| **Metals** | gathered | Deep Mines on rocky worlds | almost everything; Electronics input |
| **Rare Minerals** | gathered | Core Drills, Atmosphere Skimmers; hot worlds, dwarfs, stellar remnants | advanced buildings and ships; Electronics and Chemical input |
| **Organics** | gathered | Bio-Harvesters on living and icy worlds; Atmosphere Skimmers on gas giants | Chemical input; feeding survivors |
| **Electronics** | refined | Electronics Foundry: 2 Metals + 0.5 Rare → 2 | advanced buildings, habitats, warships, surveys, settling |
| **Chemicals** | refined | Chemical Plant: 2 Organics + 0.5 Rare → 2 | reactors, labs, defenses, warships, settling |
| **Research** | points | Research Labs (+2 each), capital +1 | technology |
| **Crypto Shards** ◈ | currency (v0.47) | Finance Districts: +0.05 per level per Cycle; shown with two decimals | trade (planned) |
| **Power** ϟ | capacity | colony base 2 × starlight, Fusion Reactors (+6), Solar Arrays in orbit (+4 × starlight); hot worlds ×1.3 | almost every building |
| **Infrastructure** ⌂ | capacity | colony base 5, Hab Domes (+5), Habitat Rings (+6); ice/water ×1.3, temperate ×1.2 | workers in production buildings and labs; ship crews |
| **Compute** ☍ | capacity | Cogitator Arrays (+4); frozen ×1.5, pulsar ×2, black hole ×2.5 | Research Labs, Defense Platforms, Frigates and bigger warships |

**Planet yields** (decided). Each planet class rates the three gathered resources from 0 to 3:

| Planet class | Metals | Rare | Organics |
|---|---|---|---|
| Terran World | 2 | 1 | 3 |
| Ocean World | 1 | 0 | 3 |
| Ice World | 0 | 1 | 2 |
| Steam World | 0 | 2 | 1 |
| Frozen Rock | 3 | 1 | 0 |
| Scorched Rock | 2 | 3 | 0 |
| Cold Gas Giant | 0 | 0 | 2 (methane, ammonia) |
| Hot Gas Giant | 0 | 1 | 1 (hydrocarbons) |

A colony gathers rating × size per turn, and each gathering building level adds 2 × that. Size multiplies yields: giant and large ×1.5, average ×1, dwarf ×0.6. Dwarfs get +1 Rare (exposed cores). White dwarfs, pulsars and black holes give ×1.5 Rare Minerals. A building can't be built where its resource is rated 0.

**Capacity rules:**
- You cannot build a building or ship that would push any capacity past its cap.
- If usage ends up over a cap (for example after losing a colony), all production is rationed to the worst cap ÷ usage, down to a minimum of 25%.

The capital starts with the whole chain running: Mine, Bio-Harvester, Electronics Foundry, Hab Dome, Fusion Reactor ×2, Shipyard, Research Lab, Cogitator and Chemical Plant.

## 4c. Fleets and combat

**Decided (v0.23).** The full rules and numbers are in `docs/combat.md`.
- **Fleets are global**, like the colonies: one screen, **Hangar** (called Fleets before v0.45), lists every fleet, the hangar (ships in no fleet; limited space: 10 per Orbital Shipyard, +2 per level above 1) and the armory (spare weapons). Ships are moved by drag and drop, and the hangar can be sorted by newest, hull, rarity, power, type or name. A fleet holds up to **five ships**, the size of one side in battle.
- **No map positions.** Fleets are sent to **attack** (monster lairs and alien systems) from a system on the Star Map. A mission takes as many Cycles as hyperlane hops from the nearest Covenant system; the fleet then returns. Fleets out on a mission can't be changed.
- **Exploring and settling cost a flat fee** (changed in v0.24; before, they needed a Scout in the fleet and a Colony Ark): a **survey probe** charts a system, a **colony expedition** settles one. Both travel like a fleet.
- **Ship sizes** beat each other like rock-paper-scissors: **Small beats Large, Large beats Medium, Medium beats Small** (×1.5 damage; ×0.7 the other way). Also, big guns can't track small ships: Large ships hit Small ones at ×0.6 (v0.30).
  - Small: Scout, Fighter, Heavy Fighter. Medium: Corvette, Frigate, Gunboat. Large: Destroyer, Battleship, Carrier.
  - The types differ only in their average stats so far; type-specific abilities are open.
- **Ship stats:** shield (first life points), hull (second life points), speed (turn order), maneuverability (evasion chance), weapon slots (1–3) and maintenance (upkeep per Cycle).
- **Weapons** are rolled with the ship and can be swapped. **Physical** weapons do ×1.5 to hull and ×0.5 to shields; **energy** weapons the reverse. Heavier models hit harder but need turns to recharge (cooldown) and are less accurate.
- **Building is a gacha:** you choose and pay for a size; the type, rarity, stats and weapons are rolled.
- **No fixed stats** (v0.24): every stat (and weapon damage) is drawn from a **normal distribution** around the type's average, so every ship differs, Normal ones included. Rarity shifts the average up: **Normal 76.9 % (×1), Strong 20 % (×1.2), Epic 2 % (×1.45, +1 slot), Legendary 1 % (×1.75, +1 slot), Omega 0.1 % (×2.2, +1 slot).**
- **Battles** are turn-based, like a card game or a Pokémon battle: both sides' cards face each other in **lanes** (fleet order); every round each ship acts once, fastest first, firing one ready weapon. **Targeting is automatic** (v0.26): the ship opposite, else right, left, two right, two left; shots across lanes have half the hit chance. Instead of firing, a ship can **swap formation** with any ship on its side (v0.29; any lane since v0.31), by drag and drop or arrows and a confirm button. You pick the weapon (or the swap) for your ships, or switch on **Auto**; **Resolve instantly** and **Retreat** are always available. A battle ends when one side is destroyed (or after 25 rounds).
- **Losses are permanent.** Damage to hull carries over and is repaired at home (20 % of max hull per Cycle, only while maintenance is paid). Shields recharge after every battle.
- **The Void Signals gacha is removed** (no leaders, relics or blueprints). Random weapons come from the **Weapon Forge** (paid in Shards until v0.43, now in Rare Minerals and Electronics).

**Decided for now, easy to change:**
- Maintenance is paid each Cycle in Metals, plus half as much in Chemicals.
- All hull sizes are available from the start (v0.45; before, research unlocked Medium and Large hulls).
- Weapons come from scrapping ships (which also refunds 30 % of a hull's cost), from wrecks after a victory (30 % chance per destroyed alien ship) and from the Weapon Forge (25 Rare Minerals + 15 Electronics, rarity rolled like a ship's).
- Alien raids (decided v0.40: only after a grace period of 3 colonies founded besides the capital, and rarer, see `docs/combat.md`) appear as threats with a countdown. When one arrives you choose a fleet to defend; the system's Bastions and Defense Platforms fight as one **Planetary Defenses** card (the capital always has one). If the defense loses, the system falls.
- Monster lairs and alien worlds are guarded by ship cards. The Chorus leans on energy weapons, the Iron Remnant on physical ones. Alien ships get better rarities and bigger hulls as the Cycles pass.

**Open:** abilities per ship type (for example Carriers launching fighters, Scouts spotting), boarding or capturing ships, fleet formations.

## 5. Setting and tone

**Open, with suggestions.** These are placeholders to react to.

- **Grimdark:** scarcity, attrition, impossible choices, no clean victories. Population is a resource you spend.
- **The player faction:** for example the last human fleet, or a fanatical splinter state, cut off from a fallen homeworld.
- **Aliens:** several AI empires, each with its own look and behaviour. For example a hive swarm, an ancient machine remnant, a parasitic cult, or something unknowable in the dark between stars.
- **Void Signals:** the gacha pulls come from listening to transmissions from the deep void. Most pulls are useful. Some are cursed and come with a cost. That makes the gacha part of the setting.

## 6. Gacha

**Changed in v0.23:** the Void Signals gacha (leaders, relics, blueprints) was removed. The gacha is now the ship build itself (see 4c) and the Weapon Forge. The original proposal, kept for reference:

- **Pool:** leaders (admirals, governors, scientists), ship blueprints, relics (empire-wide passive bonuses).
- **Rarity tiers** with a pity counter, so a guaranteed rare after X pulls.
- **Duplicates** upgrade the existing item's rank.
- **Currency:** earned from exploring, winning battles, Cycle milestones and achievements.
- **Single-player only:** no real-money purchases.

## 7. UI and screens

**Decided:** mostly menus, plus a star system map.

**Tutorial** (decided, v0.36): the first game in a browser opens a guided tour of 12 steps (`DATA.tutorial`). A panel in a corner explains one thing at a time, opens the screen it talks about and outlines the element with a pulsing gold border. The game stays playable underneath. It can be skipped, and Settings → *Replay tutorial* shows it again. Since v0.41 it opens with every new real game (a fresh browser, *Abandon and start a new galaxy*, or *Begin anew* after a loss); tester mode never starts it.

**Game over** (decided, v0.41): when the last colony falls, a full **game over screen** replaces the game. It shows the stats of the run and offers *Begin anew* (a new galaxy, with the tutorial). *Look at the ruins* lets you browse the other screens; a ☠ *Fallen* entry in the menu leads back, and End Cycle stays locked.

**Top-bar hover cards** (decided, v0.41): pointing at (or tapping) a resource or capacity opens a card with its icon, name, kind, description, stock and change per Cycle (capacities: used / available with a bar).

**Chronicle** (decided, v0.38): the event log appears only on its own *Chronicle* screen, not as a strip at the bottom of every screen.

**Tutorial upkeep** (decided, v0.38): whenever a game system changes, update the tutorial (`DATA.tutorial`) in the same change.

**Screen height** (decided, v0.37): the whole game uses at most **95 % of the screen height** (`body` is 95vh). Anything pinned to the bottom (version label, tutorial panel, Assistant subtitles) sits above the unused 5 %. New screens must fit within that.

**Proposed layout:** a top bar with resources and the Cycle counter, a left menu for screens, the main content in the centre, and a "End Cycle" button that is always visible.

**Proposed screens:**
- Empire overview / dashboard
- Star system map (systems, lanes, fleets, fog of war)
- Colony screen
- Research
- Fleets and shipyard
- Diplomacy
- Battle (shown when a battle is waiting)
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

**Ship sprites** (decided v0.27): a 3/4 view like a model kit seen from above, made from small low-poly models in `tools/shipart/render.py` and rendered to pixel art (flat shading, 1 px panel lines, dark outline, rim light, dithered engine glow). All ships share one scale (50 px per model unit), so a Battleship is about twice a Fighter. One view only (nose toward the viewer, lower left), everywhere. **Colourless templates** (v0.28): each type is a single grey sprite whose grey levels name a material and shade (hull, metal, accent, glass, glow, halo, void, outline); the game paints it on the fly from `DATA.shipPalettes`: one base colour per material, shades derived in `js/sprites.js`. Palettes: the Covenant bone/rust/cyan, the Chorus pale green chitin/toxic green/amber, the Iron Remnant iron grey/blood orange/red, monsters flesh/bone/sinew/yellow eyes. The player can choose their own fleet colours in Settings. **Designs** (v0.32): every ship type has three designs (`<type>`, `<type>_2`, `<type>_3`); a ship rolls one when it is built and keeps it. They are spacecraft first: engine clusters, radiator fins, sensor dishes, habitat rings, spinal guns. Regenerate with `python3 tools/shipart/render.py` after changing a model.

## 9b. Audio

**Decided:** add music; inspired by Halo's choral scores ("One Final Effort").

**In the POC:** original generative music synthesised with the Web Audio API in `js/music.js`, so there are no audio files. A choir chants in D minor over a drone, in plainchant phrases generated as random walks, so it never repeats exactly. Slow strings and war drums come in during "rise" sections, and swell whenever a battle happens. Players can mute it with the ♪ button and set the volume in Settings.

**Tracks** (decided: multiple tracks). Each track is a small composition in `js/tracks.js`, played by the engine in `js/music.js`. They play as a playlist: in order, on shuffle, or one track on repeat.

| Track | Mood | Key / tempo |
|---|---|---|
| Cathedral of Ash | monk choir over a drone; strings and war drums rise and fall | D minor, 54 bpm |
| Cold Drift | exploring: slow pads, distant bells, a faint choir | E Dorian, 46 bpm |
| Iron Tide | war: drum ostinato, low brass, pulsing strings, choir | C harmonic minor, 72 bpm |
| The Hollow Choir | dread: grinding drone, semitone choir, wind, distant metal | B Locrian, 40 bpm |
| Signal from Below | crackling dead channel, out-of-tune music-box motif, skipping heartbeat | F Phrygian, 58 bpm |
| Groaning Hull | hull under strain: metal groans and hits, brass in minor seconds, a thin whistle | C# Phrygian dominant, 50 bpm |

Recorded audio files can be added as tracks alongside the generated ones.

**Open:** sound effects (buttons, battles, gacha pulls); picking tracks by situation (for example Iron Tide during wars).

**Ship's computer voice** (decided: a lightly distorted, glitching British female computer voice, recorded as mp3 files). Lines and their triggers are data in `js/voicelines.js`. Each line's audio is `assets/voice/<line id>.mp3`. The robotic effect is baked into each file (text-to-speech.online "Sonia - GB", then echo and a −3 % pitch-shifted double track in Audacity). The engine (`js/voice.js`) plays the file as recorded, with no extra processing, and shows each line on screen as a glitching "SHIP AI" transmission. In Settings the section is called "Assistant". A line without a file yet is shown as text only. The `combat` trigger (start of every battle) shows its lines as a red alert transmission (`style: 'danger'`, decided v0.25).
- **Triggers so far:**
  - `start`: the first click after loading.
  - `return`: back after more than 5 minutes away.
  - `test`: the Test button in Settings.
  - `random`: ship announcements every 5–30 minutes, never the same line twice in a row, and never within a minute of another line.
- **Ideas for later triggers:** battle won or lost, colony founded or lost, a mythic Void Signal, an alien warhost spotted.

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
4. ~~Combat depth~~ Decided in v0.23: turn-based card battles with tactical choices (4c).
5. Prestige/reset loop, or one endless campaign?
6. How strong should idle/offline progress be compared with active play?
7. ~~Is the gacha a core system?~~ Decided in v0.23: it is the shipbuilding itself (4c).
