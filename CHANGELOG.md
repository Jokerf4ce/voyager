# Changelog

Versions: MINOR for new features, PATCH for fixes and tweaks. The version shown in the game's bottom-right corner comes from `js/version.js`.

## 0.24.0 — 2026-11-26
**Old saves start a new game** (save format v12).
- **No fixed ship stats.** Every stat (shield, hull, speed, evasion) and every weapon's damage is rolled from a normal distribution around the type's average (spread 15 %, 20 % for evasion), so every ship is different, Normal ones included. Rarity shifts the average up, and rarities overlap: a lucky Normal can beat an unlucky Strong.
- Each card shows **Q**, how well the ship rolled compared with an average ship of its type and rarity (100 = average). Maintenance scales with it.
- **Colony Ark removed.** A **colony expedition** settles a charted, unclaimed system for a flat fee (60 Metals, 25 Electronics, 15 Chemicals); half is refunded if the target was taken before it arrives.
- **Scouts no longer explore.** A **survey probe** charts a system for a flat fee (20 Metals, 5 Electronics). Scouts remain as a fast Small combat ship.
- You start with one fleet: Home Guard (a Scout, two Fighters and a Heavy Fighter).
- New ships get a name no other ship of yours carries.
- `docs/combat.md` updated.

## 0.23.1 — 2026-11-26
- New `docs/combat.md`: the combat mechanics in full (sizes, types, rarities, weapons, turn order, hit and damage formulas, defenses, rewards, enemies, maintenance).

## 0.23.0 — 2026-11-26
New fleet and combat system. **Old saves start a new game** (save format v11).
- **Ship cards.** Ships come in three sizes that beat each other like rock-paper-scissors (Small > Large > Medium > Small), with three types each: Scout, Fighter, Heavy Fighter · Corvette, Frigate, Gunboat · Destroyer, Battleship, Carrier. Stats: shield, hull, speed (turn order), maneuverability (evasion), 1–3 weapon slots, maintenance.
- **Building is a gacha.** Choose a size at the Shipyard and pay; type, rarity, stats and weapons are rolled: Normal 76.9 %, Strong 20 %, Epic 2 %, Legendary 1 %, Omega 0.1 %. Medium and Large hulls are unlocked by research (Medium Hulls, Capital Hulls).
- **Weapons**: physical (strong vs hull, weak vs shields) or energy (the reverse), with damage, accuracy and recharge times. Swap them on the Fleets screen; spare weapons wait in the armory (from scrapped ships, wrecks after victories, and the new Weapon Forge for 15 Shards).
- **Global fleets.** The Fleets screen shows every fleet (up to 5 ships), the hangar and the armory. Fleets no longer move on the map: from a system on the Star Map you send them to **explore** (needs a Scout) or **attack**; the Colony Ark is built at the Shipyard and sent to settle. Missions take Cycles by distance.
- **Turn-based card battles.** Your cards face the enemy's; each round every ship acts once, fastest first: pick a weapon, then a target (with a damage and hit-chance preview). Auto, Resolve instantly and Retreat are always there. Losses are permanent; hull damage is repaired at home.
- **Alien raids** show up as threats with a countdown. When one arrives you pick a fleet to defend; Bastions and Defense Platforms fight as a Planetary Defenses card (the capital always has one). Monster lairs and alien worlds are guarded by ship cards.
- **Maintenance**: each ship costs Metals (plus half as much Chemicals) per Cycle.
- **Removed**: the Void Signals gacha, leaders, relics, blueprints and the Archive screen.
- The admin test game now also has fleets of every rarity, spare weapons, Arks and an incoming raid.

## 0.22.0 — 2026-11-26
- Three new dark, unsettling music tracks (Settings → Playlist):
  - **The Hollow Choir**: B Locrian. A drone grinding against a ghost a semitone above, a choir in semitone clusters, wind through empty decks, a wail sliding down, distant metal.
  - **Signal from Below**: F Phrygian. Geiger crackle and radio sweeps, a music-box motif played slightly out of tune with notes that go missing, strings a tritone apart, a heartbeat that skips.
  - **Groaning Hull**: C# Phrygian dominant. Bending metal groans, struck-metal stress hits, brass in grinding minor seconds, a thin whistle that never settles, and a collapse section with rising wind.
- New music instruments: `noise` (wind/static sweeps), `glide` (sliding moans), `metal` (struck metal), `crackle` (static ticks).

## 0.21.1 — 2026-11-26
- The star map is wider and less tall (480×210 instead of 400×250, same area), so the full-width map and its hint fit on a 1920×1080 screen without scrolling. On very short windows it is capped to the window height. New galaxies space their systems for the new shape; existing saves keep their layout, slightly squeezed vertically.

## 0.21.0 — 2026-11-26
- **Star Map screen reworked**: the star map fills the full width. Hovering a system shows a summary card (star, owner and garrison, planets with habitability and colony marks, fleets, strange signals). Clicking selects it; its **Solar System** map and the full system panel (planets, settling, fleets) now sit below the star map instead of the Chronicle, which is hidden on this screen. Double-click scrolls down to it. Esc clears the fleet, planet or system selection. The old Star Map / Solar System tabs are gone.
- The hover card is mouse-only; on touch screens a tap simply selects the system.
- **Side menu** collapses on its own 10 seconds after the cursor leaves it (☰ opens it again).

## 0.20.0 — 2026-11-26
- **Building icons**: a 12×12 pixel icon for each of the 15 buildings (in `js/sprites.js`, `Sprites.building`), shown on the Buildings screen, in each colony's build lists, in the Overview building summary and as chips on the Colonies screen.
- **Buildings screen condensed**: one line per building (icon, name, total level, a one-line description, Auto button with its cost). Hover Auto to see where it will build; click a row for the colony list and "Build at".
- **Colonies screen** now lists every colony in every system on one page, home system first. Each colony is a compact row (planet, habitability, output, slots and its buildings as icons with levels); click it to open its build panel. Unsettled planets of a held system sit under a fold. Jump buttons at the top scroll to a system, and "Open" on the Buildings screen opens that exact colony.

## 0.19.0 — 2026-11-26
- A new game now starts with only the home system charted and only the capital settled; neighbouring systems show as "?". The Red Hypergiant is still placed close to home (among the 10 nearest systems), waiting to be found.
- **Admin test game**: a separate save slot for testing, opened from Settings or with `#admin` at the end of the address. It generates the capital plus 3 extra colonies (two at home, one in a neighbouring system) with random buildings at levels 1–4, the 10 nearest systems charted, capacity buildings raised so nothing is rationed, and 1,500 of every resource (500 Shards). The top bar shows "ADMIN TEST". Your real save is never touched; "Back to the real game" returns to it, and "Regenerate the test game" rolls a new one.

## 0.18.1 — 2026-11-26
- Assistant: lines sharing a trigger (e.g. `return`) are now picked purely at random. Before, the no-repeat rule made two lines strictly alternate; it now applies only to `random` announcements (`noRepeat` option).
- The Test button plays any voice line at random.
- New lines: "Hey, are you still here?" and "Commander, Make sure you stay hydrated".

## 0.18.0 — 2026-11-26
- New **Buildings** screen: every building type in one empire-wide list, grouped (Gathering, Refining, Power/habitation/compute, Research/ships/defense), with total levels and the number of colonies.
- **Auto** builds or upgrades where it produces the most for its cost (best planet rating for gatherers, starlight for solar, planet bonuses for capacities; ties prefer upgrading an existing building). The button shows where it will build and the cost.
- **Choose colony** lists every colony with that building and every spot it can go, with cost, output and a ★ on the Auto pick.
- Overview has a Buildings panel: click a building to see which colonies it is on.
- Building costs are now flat: base cost × the colony's habitability multiplier, no increase per level.
- Mobile: the top bar fits phone screens (buttons on one row, resources in a scrollable row); panels no longer overflow narrow screens.

## 0.17.0 — 2026-11-26
- Star pictures: every star class has a pixel-art portrait in the same style as the planets (glowing disc with convection cells and a darker edge, sized by class; tiny white dwarf; pulsar with beams; black hole with its accretion disc; the hypergiant fills the frame).
- Shown in the system panel, on the Colonies screen and in exploration events.

## 0.16.0 — 2026-11-26
- New Assistant trigger `random`: a ship announcement at a random moment every 5–30 minutes while you play. It never repeats the same line twice in a row, waits while the tab is hidden, and keeps at least a minute from other lines.
- New announcements: "Attention! Colonel Gagarin, please report to Medbay!" and "Attention! Rear admiral Shepard, your keycard was found in engineering!"
- The Assistant now waits for the player's first click before any line (browsers block sound until then).

## 0.15.5 — 2026-11-26
- Assistant voice files now play exactly as recorded: removed the game's extra distortion, radio filter, stutters, dropouts and static (the robotic effect is in the mp3s).
- Caption for `slipspace.mp3`: "Slipspace rupture detected!"

## 0.15.4 — 2026-11-26
- The game is now served at https://voyager.weidmann.cloud/ (GitHub Pages custom domain); README and notes updated.

## 0.15.3 — 2026-11-26
- Fix: the voice could stay silent, for example when the game was opened straight from disk, where browsers block loading the file for the effects chain. Lines now fall back to plain playback (no live effects) when the effects path can't load them, and a failed file is retried after 30 seconds instead of never.
- The voice shares the music's audio channel when music is playing.
- Settings: "Computer voice" is now "Assistant"; Test plays `slipspace.mp3`; each voice file shows whether it plays with effects, plainly, or not at all.

## 0.15.2 — 2026-11-26
- First recorded voice line: `welcome_back.mp3` ("Welcome back, Commander.").
- `assets/voice/README.md` documents how the voice is made: text-to-speech.online with "Sonia - GB", then Audacity echo (0.3 s, decay 0.4) and a duplicated track pitched −3 %.

## 0.15.1 — 2026-11-26
- Voice: a missing voice file is only looked for once per session (less console noise). Reload after adding a file.

## 0.15.0 — 2026-11-26
- The ship's computer voice now plays mp3 files instead of the browser's built-in speech, so it works the same in every browser.
- Each line's file is `assets/voice/<line id>.mp3` (e.g. `welcome_back.mp3`). The game adds radio filtering, light distortion, stutters, dropouts and static live.
- Lines without a file yet are shown as on-screen transmissions only; Settings lists which files are missing.
- `assets/voice/README.md` lists the lines to record and how.

## 0.14.2 — 2026-11-26
- Fix: in browsers that block speech (Brave, Firefox with fingerprinting resistance), the voice played only noises. The game now detects this, keeps the static short, and shows the line as an on-screen transmission instead.
- Voice lines appear as glitching on-screen transmissions ("◆ SHIP AI") in every browser; Subtitles can be turned off in Settings.
- Settings explains when the browser has no usable voice.

## 0.14.1 — 2026-11-26
- Playable online through GitHub Pages: https://jokerf4ce.github.io/voyager/ (deploys on every push to `main`).
- Added `.nojekyll` so GitHub serves the files as they are.

## 0.14.0 — 2026-11-26
- Ship's computer voice: a British female voice says "Welcome back, Commander." when you start playing and when you return after more than 5 minutes away.
- Glitch effect: stuttered word fragments, small pitch slips, static, clicks and digital squelches, with the music ducked while she speaks.
- Reusable system: lines and triggers in `js/voicelines.js`; call `Voice.trigger('name')` from the game. Lines can also use recorded audio files, which get real distortion and stutter.
- Voice on/off, volume and a Test button in Settings.

## 0.13.0 — 2026-11-26
- Music playlist: several tracks that play in order, on shuffle or on repeat, with a track list, Play buttons and Next track in Settings. Choices are remembered.
- The existing piece is now the track "Cathedral of Ash" (unchanged).
- New track "Cold Drift": slow pads, distant FM bells and a faint choir, for exploring.
- New track "Iron Tide": a driving drum ostinato, low brass, pulsing strings and a choir, for war.
- New instruments: bell and low brass.
- Recorded tracks are supported: add `{ id, name, src: 'assets/music/file.mp3' }` to `js/tracks.js`.

## 0.12.0 — 2026-11-26
- Music: an original generative soundtrack synthesised live in the browser. A monk choir chants over a low drone, with slow strings and war drums that swell during battles. Inspired by the mood of Halo's choral scores; no audio files.
- Music on/off button (♪) in the top bar, and a volume slider in Settings; both are remembered.
- Fix: the first click after loading no longer gets lost.
- Top bar fits on one row at 1400 px and wider.

## 0.11.1 — 2026-11-26
- Polymers renamed to Electronics (⌁). The Polymer Refinery is now the Electronics Foundry, and Catalytic Cracking is now Microfabrication.
- Old saves start a new game.

## 0.11.0 — 2026-11-26
- New resource system. Gathered: Metals, Rare Minerals, Organics. Refined: Polymers (Metals + Rare), Chemicals (Organics + Rare).
- Power, Compute and Infrastructure are capacities. Research is made by Research Labs.
- Each planet class has its own yields for the gathered resources, scaled by planet size; dwarfs and stellar remnants are rich in Rare Minerals.
- New buildings: Bio-Harvester, Atmosphere Skimmer, Chemical Plant, Solar Array, Research Lab. The Fusion Core is now a Fusion Reactor (Power).
- The capital starts with the whole production chain running.
- Old saves start a new game.

## 0.10.0 — 2026-11-26
- Version display in the bottom-right corner of the screen, and this changelog.

## 0.9.1 — 2026-11-26
- Fix: stars and planets on the maps could not be clicked in short or wide windows (letterboxed canvas).
- Map tabs stay on one line so the map no longer jumps when the selection changes.

## 0.9.0 — 2026-11-26
- Rare special systems: White Dwarfs, Pulsars and Black Holes, with their own art and bonuses.
- Small planets are drawn at least 8 px across on the solar system map.

## 0.8.0 — 2026-11-26
- The 10 systems nearest home are charted at the start.
- New Red Hypergiant star class, placed once near the start.
- Star surfaces get convection and starspot texture.

## 0.7.1 — 2026-11-26
- Solar system map drawn to scale: real radius ratios between stars and planets.

## 0.7.0 — 2026-11-26
- Solar system map: one system with its star, planets on orbits, colonies and fleets.
- Planets ordered hot to frozen outward from the star.

## 0.6.0 — 2026-11-26
- Star classes O, B, A, F, G, K, M with effects on planets, Infrastructure and habitability.

## 0.5.0 — 2026-11-26
- Planets classified by size, composition and temperature (eight classes).
- Extremely Hazardous planets have no buildable surface.
- The capital is a Large Terran World with Natural Life Support.

## 0.4.2 — 2026-11-26
- Habitability cost multipliers per layer (surface/orbit): 7.5/2.5, 5/2, 4/1, 2.5/1, 1/1.

## 0.4.1 — 2026-11-26
- Habitability levels renamed: Extremely Hazardous, Hazardous, Barren, Habitable, Natural Life Support.

## 0.4.0 — 2026-11-26
- Planet habitability 1–5 that changes building costs.

## 0.3.0 — 2026-11-26
- Several planets per system, each with a surface and an orbit building layer.

## 0.2.0 — 2026-11-25
- New resources: Metal, Rare Minerals, Polymers, Compute, Infrastructure (capacity).

## 0.1.0 — 2026-11-25
- First playable proof of concept.
