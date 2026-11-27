# Changelog

Versions: MINOR for new features, PATCH for fixes and tweaks. The version shown in the game's bottom-right corner comes from `js/version.js`.

## 0.54.0 — 2026-11-27
- **Sound effects**, synthesised in the browser like the music (new `js/sfx.js`, no audio files).
  - End Cycle: a heavy power-plant lever. The ratchet clatters faster as the arm swings down, it slams into its stop with a deep thud and ringing steel, and a 50 Hz mains hum surges as the circuit closes.
  - Clicking a star on the Star Map: a short digital chirp, with a slight random pitch so repeated clicks don't sound identical.
  - Settings: a new "Sound effects" row with On/Off and a volume slider (releasing the slider plays a sample).
  - Each sound is rendered once into a buffer and then replayed, so it costs almost nothing and doesn't crackle on phones.

## 0.53.0 — 2026-11-27
- **Ship maintenance is much more expensive, and it scales with how good the ship is.**
  - Formula: type maintenance × 3, × the rarity multiplier^1.5, × (roll quality)², × a personal random factor (about ±12 %).
  - Averages in Metals per Cycle (plus half as much Chemicals): Normal Fighter 0.9 (Omega 2.9), Normal Frigate 3.0 (Omega 9.8), Normal Battleship 7.8 (Omega 25).
  - The weakest and best rolls of the same ship differ by about ×2.
  - Tuned in `DATA.upkeep`.
- Existing ships get their maintenance re-rolled once with the new formula.
- The ship panel shows maintenance in Metals and Chemicals.
- Tutorial updated: the Hangar step mentions maintenance.

## 0.52.5 — 2026-11-27
- Audio: music and the Assistant now ask the browser for large audio buffers (`latencyHint: 'playback'`). Audio starts a fraction of a second later, but phones get more slack, which should stop the crunchy, crackling sound there.

## 0.52.4 — 2026-11-27
- Battle: the target arrow carries the size multiplier on a small tag: **×1.5 ★** in green when the attacker's size beats the target's, **×0.7 ▽** in red when it's the other way round, a grey ×1 otherwise.

## 0.52.3 — 2026-11-27
- **Hangar screen fixed on phones and small tablets.** It no longer runs wider than the screen.
  - Each fleet's five lanes fit the width as a grid, and the hangar is a tight grid.
  - On phones the cards are compact: size, picture, short name, shield and hull bars.
  - Sort and Auto-scrap buttons wrap, and tapping a ship scrolls to its panel below.
  - Desktop is unchanged.

## 0.52.2 — 2026-11-27
- **Battle screen fixed on phones and small tablets.** The two rows of ships no longer collapse on top of each other and the Auto / Resolve / Retreat buttons.
  - Cards are compact on phones: size badge, picture, shield and hull bars. The prompt names the acting ship and its target.
  - The swap arrows are smaller, and the turn order is one strip you can swipe.
  - The battle log and rules sit below.
  - Desktop is unchanged.

## 0.52.1 — 2026-11-27
- Phones: the resource bar stacks into a compact grid (about 4 per row) under the buttons instead of one long row you had to scroll sideways, so everything is visible at once.

## 0.52.0 — 2026-11-27
- **Assistant: two new triggers wired up**, for the new lines `construction` ("Construction completed!") and `new_colony` ("New colony established, congratulations!").
  - **construction** plays when a building is finished or upgraded: once per Cycle however many finish, and not for work that finished while the game was closed.
  - **colony** plays when a colony expedition founds a colony or you settle a planet.
- **The `return`, `combat`, `construction` and `colony` triggers now speak only about one time in three** (a new per-trigger `chance` setting, 0.33), so the Assistant doesn't nag.

## 0.51.1 — 2026-11-27
- New voice lines (version bumped by hand).

## 0.51.0 — 2026-11-27
- **Construction takes time.** Every build or upgrade is paid up front and takes **3 Cycles**.
  - Meanwhile the construction site draws **3 Power and 3 Infrastructure**, and the building can't be upgraded again or demolished. An upgrade keeps working at its old level until it is done.
  - Sites show in the colony (with a progress bar and the Cycles left), on the Buildings screen and in a new **Construction** panel on the Overview.
  - They finish while you are away and are lost if the system falls.
  - Tuned in `DATA.construction`.
- **Producers and consumers in the hover cards.**
  - Each resource's card lists what produces it per colony and what consumes it: refining inputs, fleet maintenance, the research project.
  - Each capacity's card lists what each colony provides and what uses it, by building type plus construction sites.
- Tutorial updated: the Buildings step explains the construction time, and the resources step mentions the new lists.

## 0.50.0 — 2026-11-27
- **Battle: hit effects.** A hit on shields flares a cyan energy shell around the card; a hit on the hull throws an orange burst of pixel sparks (and the card shakes). A shot that breaks through shows both.
- **Battle: damage numbers.** They float up like MISS: shield damage in blue, hull damage in orange (e.g. −2 −5), readable for about 2 seconds.
- The old hit flash (which tinted the whole card) is now just the shake, so the new colours read cleanly.

## 0.49.0 — 2026-11-27
- **Three new designs for every ship type** (six per type now). New ships roll one of the six; existing ships keep theirs. Like the others, they are grey templates painted in each faction's colours.
  - **Scout:** ring-wing probe, outrigger skiff, lantern drone (a cut gem with a glowing eye).
  - **Fighter:** crescent wing, canard dart, tri-engine skimmer.
  - **Heavy Fighter:** armoured brick gunship, trident, carapace beetle.
  - **Corvette:** stepped ziggurat, sensor catamaran, tusker.
  - **Frigate:** container hauler, radiator-sail frigate, warp-ring frigate.
  - **Gunboat:** twin rails, turtle shell, missile barge.
  - **Destroyer:** outrigger trident, nacelle stiletto, monolith (a black slab with a glowing seam).
  - **Battleship:** corner-tower fortress, broadside hammer, ring-cannon.
  - **Carrier:** flat-top with an island, saucer mothership, drone tree.

## 0.48.1 — 2026-11-27
- New icons: Metals ⬡, Crypto Shards ♃, Power ⏻, Infrastructure ⇄, Compute ⋇ (everywhere they appear, including building effects and costs).
- Top bar: Research now comes after the capacities (after Compute), behind its own divider.

## 0.48.0 — 2026-11-27
- **No more random events when a system is charted.** Systems no longer hide anomalies (and the "Strange signals here" hint is gone). The event texts and dialog stay in the code, unused.
- **Auto scrap in the Hangar.** Filter by rarity (up to Normal, Strong, Epic or Legendary; Omega is never scrapped), hull size, roll quality (below 90 / 100 / 110) and where (hangar only, or also fleets at home).
  - The panel shows how many ships match and what you get back; **Scrap N ships** asks for confirmation, then breaks them all up with one Chronicle line. Weapons go to the armory.
  - **⟳ Auto** (off by default) scraps new ships that match as they leave the slipway; the shipyard reveal says so.
  - The filter is saved with the game.
- Tutorial updated: the Hangar step mentions Auto scrap.

## 0.47.0 — 2026-11-27
- **New resource: Crypto Shards ◈**, an interstellar crypto currency that will be used for trade. It comes in tiny amounts, so it is shown with two decimals: in the top bar, its hover card, the Overview, colony yields and offline progress.
- **New building: Finance District** (surface). +0.05 Crypto Shards per level per Cycle.
  - Costs 80 Metals, 30 Electronics and 15 Rare Minerals.
  - Uses 2 Power, 2 Infrastructure and 1 Compute.
  - Has its own pixel icon; listed under *Research, finance, ships & defense*.
- **Shipyards no longer make ships cheaper** (it broke the economy). Hull prices are fixed; shipyard levels only add hangar space.
- Tutorial updated: the resources step introduces Crypto Shards.
- **New save format:** old saves start a new game.

## 0.46.1 — 2026-11-27
- Battle: Omega ships no longer pulse on the board (a steady red glow instead), so the active ship stands out. They still pulse in the hangar and shipyard.

## 0.46.0 — 2026-11-27
- **Battle: Planetary Defenses can move** (and be pushed aside) like any ship, by drag and drop or with ◀ ▶.
- **Battle: no holes in a row.** Ships can only move within their row, so the lanes stay packed. Wrecks keep their place, and rows that had gaps are closed up.
- **Battle: wrecks stay visible.** Destroyed ships remain on the board, clearer than before and stamped **✕ DESTROYED**.
- **Battle: move preview.** While you drag a ship over a lane (or pick one with ◀ ▶), the ships that would make room slide aside, opening a gap where it will land; the dragged card fades.
- **Battle: MISS (and + RESTORED) stay up for about 2 seconds** and no longer vanish when the screen updates (`DATA.battleFxMs`).

## 0.45.0 — 2026-11-27
- **All hull sizes from the start.** The *Medium Hulls* and *Capital Hulls* research is gone. Medium and Large ships (and weapons at the forge) can be built right away.
- **Limited hangar space.** Each Orbital Shipyard holds 10 ships that are in no fleet, plus 2 for every level above 1; all shipyards add up.
  - When the hangar is full, a new ship can only be built if a fleet at home has room, and ships can't be moved out of fleets into it.
  - The hangar shows used / free space.
- **Fleets screen renamed Hangar.**
- **Sort the hangar** by newest, hull, rarity, power, type or name.
- **Drag and drop.** Drag a ship onto a fleet slot to put it in that lane (the others move along; within a fleet this reorders), or into the hangar to take it out of its fleet. Clicking still works, for touch screens.
- Tutorial updated: the research and shipyard steps no longer mention hull research, and the fleets step became *Hangar and fleets* (drag and drop, hangar space, sorting).

## 0.44.0 — 2026-11-26
- **Colony expeditions go to a planet you choose.**
  - In a charted, unclaimed, unguarded system, every planet in the system panel (Star Map and Solar System screens) has a **Send colonists** button. The colony is founded on that planet when the expedition arrives; before, it went to the "best" planet.
  - The Settle section points you to the planet list, and the targeted planet shows when the colonists arrive.
  - One expedition per system at a time; the rest of the system is settled from the new colony as before.
- Tutorial updated: the expand step explains choosing the planet.

## 0.43.0 — 2026-11-26
- **Void Shards removed.** The resource is gone from the top bar, the Overview and the save, along with every source:
  - survey bonus, battle victories, captured worlds, destroyed empires;
  - pulsars and black holes;
  - the +1 every 5 Cycles;
  - the *Void Listening* technology;
  - offline progress.
- **Weapon Forge** now costs **25 Rare Minerals + 15 Electronics** (was 15 Shards).
- Events that gave Shards now give something else: *A Voice in the Static → Listen* gives +25 Research (unless the archivists go blind); *Survivors → Take them in* gives +15 Research; *Seal it away* gives nothing.
- **New save format:** old saves start a new game.

## 0.42.0 — 2026-11-26
- **First-time greeting.** A new game (first visit, new galaxy, Begin anew) is greeted with "Wake up, Commander, all systems operational." (`wake_up`, new trigger `first`) instead of "Welcome back". Until `assets/voice/wake_up.mp3` exists, only the transmission text shows.
- **Battle: the fleet-power bar is at the top of the board.**
- **Battle: moving pushes ships aside.** A ship moved to another lane is inserted there and the ships in between slide one lane towards the gap it left, like reordering a list. Before, it traded places with the ship in that lane. Planetary Defenses can't be pushed. The confirm button says how many ships make room.
- **Battle: misses show.** A missed shot flashes **MISS** over the target, which sidesteps.
- **Battle: new action Restore (⟲).** Instead of firing, a ship regains 25 % of its max shields and 10 % of its max hull (`DATA.restore`); the button shows how much. Enemies and Auto use it when a badly hurt ship has no good shot (about once per battle).
- Tutorial updated: the battle step explains moving and Restore.

## 0.41.0 — 2026-11-26
- **The tutorial opens with every new game:** a fresh browser, *Abandon and start a new galaxy* in Settings, or *Begin anew* after a loss. Tester mode never starts it.
- **The battle screen fits the 95 % screen height.**
  - The battle log and the rules (folded away) moved into a column beside the board. The two rows of ships share the rest of the height.
  - On shorter screens the ship cards get more compact: smaller pictures, and the weapon list and type line hidden. The acting ship's weapons are always in the controls.
  - Checked at 1920×1080 and 1366×768 with no scrolling.
- **Game over screen.**
  - When the last colony falls, the game shows *The Covenant Ends* with the stats of the run and a **Begin anew** button.
  - *Look at the ruins* lets you browse; a ☠ *Fallen* menu entry leads back, and End Cycle stays locked.
  - The screen survives a reload.
- **Hover cards on the top bar.** Pointing at (or tapping) a resource or capacity shows a card with its icon, name, kind and description, plus the stock and change per Cycle, or used / available with a bar for capacities. This replaces the plain browser tooltip.
- Tutorial updated: the resources step mentions the hover cards.

## 0.40.0 — 2026-11-26
- **Grace period before raids.** The xenos leave you alone until you have founded 3 colonies besides your capital. The Overview's *Threats & Missions* panel shows your progress (for example 1/3). When the grace period ends, the Chronicle and the Assistant warn you.
- **Raids are rarer.** Half the chance per Cycle (2.5 % × aggression) and a 12-Cycle wait for each empire after it launches a raid. In tests that is about one raid every 50 Cycles instead of every 20. Tuned in `DATA.raids`.
- Tutorial updated: the Fleets step explains the grace period.

## 0.39.0 — 2026-11-26
- **End Cycle is locked during combat.** The button is greyed out while a battle waits for your choice or is being fought (Space / Enter takes you to the battle).
- **No Continue button after a battle.**
  - The result stays on the battle screen. Ending the Cycle or opening another screen puts the battle away.
  - If more battles are queued, the next one starts on its own a few seconds after the result.
- **Electronics icon is now ⍯.**
- **Building descriptions in icons.** On the Buildings screen and in each colony's panel, effects are built from the game data, for example `+2 ▣ × planet rating`, `2 ▣ + 0.5 ◇ → 2 ⍯`, `+6 ϟ`. Hovering a colony's building shows the full text. Shipyards, Bastions and Defense Platforms keep a short text.
- Tutorial updated: the battle step explains that End Cycle is locked during a fight.

## 0.38.0 — 2026-11-26
- **Auto-cycle removed.** The ▶ AUTO button and the auto-cycle speed setting are gone; Cycles only advance when you press *End Cycle* (or Space / Enter). Offline progress while the game is closed is unchanged. Battle *Auto* and building *Auto* stay.
- **The log strip at the bottom of every screen is gone.** Events are listed only in the **Chronicle** menu, which gives every screen more room.
- Tutorial updated: the Cycles step no longer mentions Auto and explains that time only moves when you end the Cycle; the last step points to the Chronicle in the menu.

## 0.37.1 — 2026-11-26
- Removed three test screenshots that were committed by mistake.

## 0.37.0 — 2026-11-26
- **Star Map and Solar System are now separate screens.** The new **◉ Solar System** menu entry shows the selected system's star and planets, much larger.
  - **Star Map:** the map fills the screen, with the system panel (missions, planets) beside it.
  - **Getting there:** double-click a charted system on the Star Map or press **Open solar system** in its panel; **✦ Star Map** goes back.
  - **Phones:** the panel sits below the map and the old map tabs are gone.
- **The game uses at most 95 % of the screen height.** The bottom 5 % stays empty; the version label, tutorial panel and Assistant subtitles move up with it.
- The tutorial's Star Map step mentions the new screen.

## 0.36.0 — 2026-11-26
- **Tutorial.** The first game in a browser opens a 12-step guided tour. It covers the goal, resources and capacities, Cycles and Auto, the Star Map, surveys and colony expeditions, colonies, buildings (going wide, demolishing), research, the shipyard and rarities, fleets and raids, and battles.
- Each step opens the screen it talks about and outlines the element with a pulsing gold border. The game stays playable underneath, so you can try things as you go.
- **Skip tutorial** ends it at any time; **Settings → Replay tutorial** shows it again. It is remembered per browser, not per save, and tester mode never starts it.
- The steps live in `DATA.tutorial`, and the costs in the text come from the live data.

## 0.35.1 — 2026-11-26
- The game moved to https://voyager.playle.io/ (new GitHub Pages custom domain); README and notes updated.

## 0.35.0 — 2026-11-26
- **Demolish buildings.** A red ✕ next to *Upgrade* on a colony, and next to each colony in a building's list on the Buildings screen, tears the building down. That covers all levels and frees the slot.
- **Refund:** you get back **25 % of everything invested**, which is the price of every level paid at that colony, rounded down. The confirm dialog shows the refund and the total invested.
- **Shortage warning:** demolishing a Power Plant, Solar Array, Habitat or Datacenter is allowed even if it leaves a capacity short (useful for swapping buildings in a full layer). The dialog warns which capacity runs short and how far production drops.
- Garrisons shrink to the new maximum when a Bastion or Defense Platform goes.

## 0.34.1 — 2026-11-26
- **Phones: Star Map / Solar System tabs are back.** On screens up to 820 px wide, two tabs at the top of the map screen switch between the star map and the selected system's solar system; the system panel (missions, planets) stays below both. Double-tapping a charted system opens its Solar System tab. The tab is greyed out for uncharted systems. Desktop is unchanged.
- On phones the star map is shorter (about 60 % of the screen), so the page can still be scrolled past it, and the hint text talks about taps instead of hovering.

## 0.34.0 — 2026-11-26
- **The galaxy has no edge.** It is generated in chunks as you explore: every system you chart or own grows the map around it, so you can expand in any direction. All systems stay connected by hyperlanes.
- **The Star Map is a camera.** Drag to pan, scroll or pinch to zoom, and use the buttons for zoom, home (⌂) and the selected system (◎). A **minimap** in the corner shows everything charted and your view; click it to jump there. The map remembers where you were looking.
- **Readable names.** The map is still pixel art, but system names, `?` markers and raid warnings are drawn on top at full resolution in a larger font with a dark outline. Labels never overlap: your systems, alien systems and the selected one get priority. Zoomed far out, only owned and selected systems are named, and planets are hidden.
- Endless starfield with seamless dithered nebulae and a little parallax.
- Monster lairs grow more common the farther from home. The two alien empires start 520–680 units away in different directions, each reachable by hyperlane.
- Tuned in `DATA.galaxy`.
- **New save format:** old saves start a new game.

## 0.33.0 — 2026-11-26
- **Building costs rise with level.** Each level costs 15 % of the base price more up to level 5 (1×, 1.15×, 1.3×, 1.45×, 1.6×); from level 6 every level doubles (3.2×, 6.4×, 12.8×, …), on top of the colony's habitability multiplier. Expanding wide is now the way to grow; very tall buildings get very expensive.
- Prices show their level multiplier (×1.45); it turns red past level 5. **Auto** already compares output per cost, so it now spreads buildings across colonies by itself.
- Tuned in `DATA.levelCost` (`perLevel`, `softCap`, `expBase`).
- In bot tests over 150 Cycles, buildings now top out around level 6 instead of 27, and income grows with the number of colonies instead of running away.

## 0.32.0 — 2026-11-26
- **Two more designs for every ship type** (three each). A new ship rolls one of its type's designs and keeps it, so fleets look varied:
  - Scout: sensor picket with a dish and antenna ring · needle probe with solar panels
  - Fighter: four wings in an X · forward-swept interceptor with twin tails
  - Heavy Fighter: torpedo bomber · twin-boom gunship
  - Corvette: arrowhead with a dorsal fin · hammerhead
  - Frigate: spinal frigate with a habitat ring and reactor · twin-hulled frigate
  - Gunboat: spinal cannon with capacitor coils · weapons block with radiator wings
  - Destroyer: dagger with dorsal and ventral fins · lance with missile wings
  - Battleship: cathedral with spires and buttresses · wedge dreadnought
  - Carrier: twin-hull carrier · hive carrier lined with launch bays
- Like all ship art they are grey templates (`assets/ships/<type>_2.png`, `_3.png`) coloured in the game, so every design works in every faction's colours and in your own fleet colours.
- Ships from older saves keep the first design.

## 0.31.0 — 2026-11-26
Battle screen:
- **Fleet power** of each side, live (living ships, current shields and hull), with a bar comparing the two.
- **Target arrow**: an animated arrow floats between the rows from the acting ship to its target (gold on your turn, red on the enemy's).
- **Turn order** is now a bar pinned to the bottom of the screen, with the acting ship marked ▶ and ships that already acted dimmed.
- **Swap with any ship**, not just a neighbour: drag the acting ship onto another of your lanes, or use the little ◀ ▶ arrows on its card to pick a lane and press Confirm. The enemy and Auto also consider every lane.

## 0.30.1 — 2026-11-26
- The admin test game is now called **tester mode**: open it with `#tester` (the old `#admin` link still works and switches to `#tester`) or Settings → *Open tester mode*. The top bar shows "TESTER". The file is `js/tester.js`.
- The tester game now saves under its own new name, so an earlier admin test game is not picked up; a fresh one is generated.

## 0.30.0 — 2026-11-26
- **Big guns can't track small ships.** Weapons on Large ships have −40 % hit chance against Small ships (`DATA.largeVsSmallHit = 0.6`). Together with the size advantage, Small ships are now the answer to capital ships. Applies to every side, Leviathans included. The weapon buttons note "(small target)".
- `docs/combat.md` updated.

## 0.29.0 — 2026-11-26
- **Swap formation in battle.** Instead of firing, a ship can trade lanes with its neighbour on the left or right, or step into an empty lane. It uses the ship's turn. The buttons sit under the weapons and say who it would swap with.
- Enemies and Auto swap too, when it clearly improves the matchups for both ships (and never back and forth). Planetary Defenses stay put.
- `docs/combat.md` updated.

## 0.28.0 — 2026-11-26
- **Colourless ship sprites, coloured in the game.** Each ship type is now one grey template (13 images instead of 66). Every grey level stands for a material and a shade, and the game paints the sprites on the fly from `DATA.shipPalettes` in `js/data.js`: one base colour each for hull, metal, trim, glass, engines and engine glow, with the shades worked out automatically. Changing a faction's look is now a one-line edit.
- **Fleet colours** in Settings: pick your own hull, metal, trim, glass and engine colours with a live preview; every card repaints at once. Saved in this browser; Reset restores the Covenant's bone and rust.
- Only the front view is used now; the rear view is gone (your ships in battle use the same view as the cards).
- The templates are embedded in `js/shipsprites.js` (generated), so recolouring also works when the game is opened straight from disk.

## 0.27.0 — 2026-11-26
- **New ship graphics.** Every ship is now a detailed sprite in a 3/4 view (about 50 to 120 px), rendered from a small 3D model: Scout, Fighter, Heavy Fighter, Corvette, Frigate, Gunboat, Destroyer, Battleship, Carrier, the Planetary Defenses station, and the Lurker, Maw and Leviathan. All share one scale, so bigger hulls look bigger.
- **Faction colours**: the Covenant in bone and rust, the Chorus in pale green chitin with toxic green trim, the Iron Remnant in iron grey with blood orange; monsters in flesh, bone and sinew.
- **Facing**: cards show the front view; in battle your ships are seen from behind, flying up toward the enemy line, while enemies face you.
- The sprites are PNGs in `assets/ships/`, generated by `tools/shipart/render.py` (Python with numpy and Pillow). Cards have a taller picture area.

## 0.26.0 — 2026-11-26
- **Lanes and automatic targeting.** Each side stands in five lanes, set by fleet order. Every ship shoots the enemy directly opposite; if that lane is empty, the nearest one to its right, then left, then two right, two left, and so on. Shots at a ship that isn't directly opposite have **half the hit chance**.
- In battle you now only choose the **weapon**: the target is marked ◎, and each weapon button shows the expected damage and hit chance against it. The enemy (and Auto) picks the best weapon for its target.
- Fleets screen: slots are labelled Lane 1–5, and ◀ ▶ in a ship's panel moves it within its fleet.
- `docs/combat.md` updated (lanes, targeting, hit formula, formation tips).

## 0.25.0 — 2026-11-26
- New voice trigger **`combat`**: at the start of every battle (attacks and raid defenses) the Assistant says one of the combat lines at random ("Warning! Hostile forces inbound!", "Commander! Give them hell!" …).
- Combat lines are shown as a **red alert transmission** ("▲ AI Assistant · Alert", pulsing red border) instead of the normal blue. Any trigger or line can use this look with `style: 'danger'` in `js/voicelines.js`.

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
