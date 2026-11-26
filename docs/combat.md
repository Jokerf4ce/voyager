# Voyager — Combat Mechanics

How ships, fleets and battles work, as built in v0.26. All numbers come from `js/data.js`; the battle rules are in `js/battle.js`. The design decisions behind them are in `docs/concept.md`, section 4c.

---

## 1. Ships

Every ship is a **card**. It has a size, a type, a rarity, stats and 1–3 weapons. There are no fixed stats: each ship rolls its own (see 1.4), so no two ships are alike, not even two Normal ones.

### 1.1 Sizes: rock, paper, scissors

| Size | Beats | Loses to | Base weapon damage | Build cost | Unlocked by |
|---|---|---|---|---|---|
| **S** Small | Large | Medium | 5 | 30 Metals, 6 Electronics | — |
| **M** Medium | Small | Large | 10 | 70 Metals, 20 Electronics, 10 Chemicals | *Medium Hulls* |
| **L** Large | Medium | Small | 18 | 160 Metals, 40 Rare Minerals, 50 Electronics, 30 Chemicals | *Capital Hulls* |

When one ship attacks another:

- If the attacker's size **beats** the target's, it does **×1.5** damage (★ in the UI).
- If the target's size beats the attacker's, the attacker does **×0.7** damage (▽ in the UI).
- Otherwise (same size) damage is ×1.

### 1.2 Types (average stats of a Normal ship)

| Type | Size | Shield | Hull | Speed | Evasion | Slots | Maintenance |
|---|---|---|---|---|---|---|---|
| Scout | S | 8 | 10 | 9 | 30 % | 1 | 0.2 |
| Fighter | S | 10 | 14 | 8 | 25 % | 1 | 0.3 |
| Heavy Fighter | S | 14 | 20 | 6 | 18 % | 2 | 0.5 |
| Corvette | M | 25 | 30 | 6 | 12 % | 2 | 0.8 |
| Frigate | M | 35 | 40 | 5 | 8 % | 2 | 1.0 |
| Gunboat | M | 25 | 45 | 4 | 6 % | 3 | 1.2 |
| Destroyer | L | 60 | 70 | 4 | 4 % | 3 | 2.0 |
| Battleship | L | 80 | 110 | 2 | 2 % | 3 | 2.6 |
| Carrier | L | 70 | 90 | 3 | 3 % | 2 | 2.2 |

- **Shield** and **hull** are the two life-point pools; shield is used up first.
- **Speed** decides the turn order.
- **Evasion** (maneuverability) is the chance an incoming shot misses.
- **Slots** is how many weapons the ship carries.
- **Maintenance** is paid every Cycle (see 6.3).

These are the **averages** (means) that a Normal ship's rolls are centred on; a single ship usually lands within ±15 % of them (see 1.4). Weapon slots are fixed per type.

Types have no special abilities yet.

### 1.3 Rarity

Every build rolls a rarity:

| Rarity | Chance | Shifts the average by | Extra weapon slot |
|---|---|---|---|
| Normal | 76.9 % | ×1.0 | — |
| Strong | 20 % | ×1.2 | — |
| Epic | 2 % | ×1.45 | +1 |
| Legendary | 1 % | ×1.75 | +1 |
| Omega | 0.1 % | ×2.2 | +1 |

The extra slot can't take a ship past 3 slots.

### 1.4 How a ship's stats are rolled

Every stat is drawn from a **normal distribution** (a bell curve):

- **The mean** is the type's average (1.2) shifted up by rarity (`m` = the rarity multiplier).
- **The standard deviation** (the spread) is a share of that mean.
- **The cap:** rolls are limited to ±3 standard deviations.

| Stat | Mean | Spread (standard deviation) | Limits |
|---|---|---|---|
| Shield | average × m | 15 % of the mean | at least 0 |
| Hull | average × m | 15 % of the mean | at least 1 |
| Speed | average × (1 + (m − 1) × 0.5) | 15 % of the mean | at least 1 |
| Evasion | average × (1 + (m − 1) × 0.5) | 20 % of the mean | 0 – 60 % |

What a 15 % spread means in practice:
- About two ships in three land within ±15 % of the mean.
- About 19 in 20 land within ±30 %.
- None land beyond ±45 %.

**Example:** Normal Frigates average 35 shield and 40 hull. Out of 2,000 test rolls, shields ran from 19 to 51 and hulls from 22 to 58. 1,743 of them had a stat line no other one shared.

Rarities overlap. A lucky Normal can out-roll an unlucky Strong, but on average each rarity is clearly better than the one below.

**Quality (Q):**
- Each card shows **Q**, the ship's rolls compared with the average of its type and rarity.
- It is the mean of (rolled stat ÷ expected mean) over shield, hull, speed and evasion.
- 100 is average, above 110 is shown green, below 90 red.

**Maintenance** follows quality: `average maintenance × (1 + (m − 1) × 0.8) × Q / 100`. A well-rolled ship costs a little more to keep flying, and an Omega costs about twice a Normal of the same type.

**Weapons:** one per slot, rolled at the ship's rarity (see 2.2).

---

## 2. Weapons

### 2.1 Damage types

| Type | vs Shield | vs Hull | Icon |
|---|---|---|---|
| **Physical** | ×0.5 | ×1.5 | ▲ |
| **Energy** | ×1.5 | ×0.5 | ◆ |

Energy weapons strip shields; physical weapons break hulls. A mixed loadout handles both.

### 2.2 Models

| Model | Type | Damage factor | Recharge (cd) | Accuracy | Roll weight |
|---|---|---|---|---|---|
| Autocannon | Physical | 1.0 | 0 | 95 % | 4 |
| Mass Driver | Physical | 1.6 | 1 | 85 % | 3 |
| Railgun | Physical | 2.4 | 2 | 80 % | 2 |
| Torpedo Rack | Physical | 3.4 | 3 | 70 % | 1 |
| Pulse Laser | Energy | 1.0 | 0 | 100 % | 4 |
| Ion Lance | Energy | 1.6 | 1 | 90 % | 3 |
| Plasma Projector | Energy | 2.4 | 2 | 80 % | 2 |
| Particle Beam | Energy | 3.4 | 3 | 75 % | 1 |

Only monsters and Planetary Defenses carry these:

| Model | Type | Damage factor | Recharge | Accuracy | Carried by |
|---|---|---|---|---|---|
| Rending Claws | Physical | 1.3 | 0 | 90 % | monsters |
| Acid Spit | Energy | 1.8 | 1 | 85 % | monsters |
| Bastion Battery | Physical | 1.4 | 0 | 90 % | Planetary Defenses |
| Orbital Lance | Energy | 1.4 | 0 | 95 % | Planetary Defenses |

How a weapon's damage is set when it is rolled:

```
mean damage = size base damage (5 / 10 / 18) × damage factor × rarity multiplier
damage      = a normal-distribution roll around that mean, spread 15 %, rounded, at least 1
```

- **The model** is picked by roll weight, so heavy weapons are rarer.
- **Recharge:** after firing, a weapon with recharge *cd* sits out *cd* of its ship's turns. A cd of 0 fires every turn.
- **Size:** a weapon belongs to a size and only fits ships of that size.

### 2.3 Getting and swapping weapons

- **Scrapping a ship** moves all its weapons to the armory and refunds 30 % of its size's build cost.
- **Wrecks:** after a victory, each destroyed alien ship has a 30 % chance to leave one of its weapons. Monsters leave nothing.
- **Weapon Forge** (Shipyard): costs 15 Void Shards and rolls a random weapon of the chosen size. Its rarity is rolled like a ship's.
- **Refitting** (Fleets screen, in the ship's panel):
  - Swap any slot for an armory weapon of the same size; the old weapon goes back to the armory.
  - Ships on a mission can't be refitted.

---

## 3. Fleets, exploring and settling

- **Size:** a fleet holds up to **5 ships**, which is one side of a battle. Ships in no fleet wait in the **hangar**.
- **New ships:** a new build joins the first fleet at home that has room; otherwise it goes to the hangar.
- **No map positions:** fleets don't move on the map. They are sent to **attack** a charted monster lair or alien system from that system on the Star Map.

Exploring and settling need no ships; they cost a **flat fee**:

| Action | Target | Fee |
|---|---|---|
| **Survey probe** (explore) | an uncharted system next to known space | 20 Metals, 5 Electronics |
| **Colony expedition** (settle) | a charted, unclaimed, unguarded system | 60 Metals, 25 Electronics, 15 Chemicals |

If the target of a colony expedition has been taken or guarded by the time it arrives, the colonists turn back and half the fee is refunded.

**Travel time:**
- Everything takes one Cycle per hyperlane hop from your nearest system (at least 1), through known space only.
- An attacking fleet takes the same number of Cycles to come home after its battle.
- You can **recall** a fleet that is still on its way out.
- A fleet on a mission can't be changed.

---

## 4. Battles

### 4.1 When battles happen

- **Attack:** your fleet reaches its target and fights the system's guard:
  - **Monster lair:** the monsters.
  - **Alien world:** the alien garrison plus the system's Planetary Defenses.
- **Defense:** an alien raid reaches one of your systems.
  - **Choosing defenders:** you pick an idle fleet to defend, or no fleet. The system's Planetary Defenses always join.
  - **The capital:** it always has defenses (see 4.8).

While a battle is waiting, the Cycle can't advance; **End Cycle** takes you to the battle. Several battles in one Cycle queue up and are fought one after another.

### 4.2 Lanes and targets

Each side stands in a row of **lanes**, five wide, and lane *n* faces lane *n* on the other side.

- **Your lanes:** your fleet order on the Fleets screen. The first ship takes lane 1, and so on; move ships with ◀ ▶ in the ship's panel. Planetary Defenses take the next free lane.
- **Enemy lanes:** their ships take lanes in the order they are listed.

**Targeting is automatic.** A ship always shoots:

1. the enemy **directly opposite**;
2. if that lane is empty or destroyed, the one **one lane to its right**;
3. then **one to its left**;
4. then **two to the right**, then **two to the left**, and further out the same way.

"Right" and "left" are as seen on screen, for both sides.

**Shooting across lanes** (at anything that isn't directly opposite) **halves the hit chance** (×0.5, `DATA.offLaneHit`).

So formation matters: put the ships that can best take on each enemy across from it. A side with fewer ships leaves enemies with no one opposite them, and those enemies shoot across lanes at half the hit chance.

### 4.3 Turn order

1. Each **round**, every surviving ship acts once, **fastest first**. Ties are broken at random.
2. At the start of a ship's turn, each of its weapons recharges one step.
3. If no weapon is ready, the ship skips its turn ("recharges its weapons").
4. Otherwise it fires **one** ready weapon at its target (see 4.2):
   - **Your ships:** you pick the weapon. The target is marked ◎ on the board, and each weapon button shows the expected shield and hull damage, the hit chance and ★/▽ for size.
   - **Enemy ships, and yours on Auto:** the computer picks the weapon (see 4.7).

The battle ends when one side has no ships left. If 25 rounds pass without that:
- An **attack** ends in a **stalemate**: your ships withdraw.
- A **defense** counts as **held**: the raid withdraws.

### 4.4 Hitting

```
hit chance = weapon accuracy × (1 − target evasion) × lane factor, at least 5 %
lane factor = 1 if the target is directly opposite, 0.5 if not
```

Examples:
- A Railgun (80 %) against a Scout (30 % evasion) directly opposite hits 0.8 × 0.7 = **56 %** of the time.
- The same shot one lane over hits **28 %** of the time.

### 4.5 Damage

```
base = weapon damage × attacker's damage bonus × size multiplier × (0.9 – 1.1)
```

The base is then applied to the target's shield first, then its hull:

1. **Shield up:** the shield takes `base × type-vs-shield` (×0.5 physical, ×1.5 energy).
2. **Shield breaks:** if that is more than the shield has left, the shield drops to 0. The part of the base that wasn't needed to break it carries over to the hull at `× type-vs-hull`.
3. **No shield:** all damage goes to the hull at `base × type-vs-hull` (×1.5 physical, ×0.5 energy).
4. **Destroyed:** a ship is destroyed when its hull reaches 0.

**Example:** a 20-damage Railgun (physical) hits a ship with 6 shield left.
- Against the shield it counts as 20 × 0.5 = 10, so the 6 shield breaks.
- 6 of those 10 were needed, so 40 % of the base (8) carries over.
- The hull takes 8 × 1.5 = **12**.

**Research bonuses** apply to your ships only:
- *Plasma Weave*: +20 % weapon damage.
- *Bone-grown Hulls*: +25 % shield and hull.

### 4.6 Your controls

| Button | What it does |
|---|---|
| A weapon | fire it at the ship's target (your turn only) |
| **Auto** | the computer plays your side too, one step at a time; press again to take back control |
| **Resolve instantly** | plays the rest of the battle at once on Auto |
| **Retreat** | ends the battle now; in an attack your ships withdraw, in a defense the system falls |

### 4.7 How the computer picks a weapon

The target is fixed by the lanes (4.2). For every ready weapon, the computer scores:

```
(expected shield damage × 0.6 + expected hull damage) × hit chance
```

- The score is **×2.5** if the shot would destroy the target.
- It then gets a random ±10 %.
- The highest score fires.

In practice the computer picks the weapon type that suits the target (energy for shields, physical for hull) and prefers a weapon that would finish the target off.

### 4.8 Planetary Defenses

A system's Bastions (surface) and Defense Platforms (orbit) fight together as **one Medium card** with speed 3 and 0 % evasion.

| | Value |
|---|---|
| Shield | (10 + 18 × Platform levels) × strength |
| Hull | (20 + 30 × Bastion levels) × strength |
| Weapons | Bastion Battery (if any Bastions) and Orbital Lance (if any Platforms), damage ×(0.8 + 0.25 × levels) × strength |

- **Strength:** for you, 1 + the *Martyr Walls* research bonus (+50 %). For aliens, 1 + Cycle / 100.
- **Your capital:** it always counts one extra Bastion level and one extra Platform level, even with none built.

---

## 5. After a battle

**Your ships:**
- Destroyed ships are **gone for good**.
- Survivors keep their hull damage. Shields are full again for the next battle.
- At home, hulls repair **20 % of max hull per Cycle**, but only while maintenance is fully paid.

**A victory:**
- **Void Shards:** +3, plus +2 per enemy destroyed.
- **Salvage:** weapons may drop (see 2.3).
- **Attack on an alien world:** the system is **captured**:
  - Each building there loses one level.
  - +10 Shards.
- **Attack on a monster lair:** the system is cleared and can be settled.
- **Defense:** the system holds.

**A defeat or retreat:**
- **Attack:** survivors fly home. The guard keeps its damage, though alien garrisons repair 10 % per Cycle.
- **Defense:** the system **falls to the raiders**, and their survivors become its new garrison.

Every battle goes into the Battle Reports on the Overview.

Once an alien faction has no systems left, it is extinguished (+30 Shards). Destroying both factions wins the game; losing all your systems ends it.

---

## 6. The enemy

### 6.1 Monster lairs

Six systems away from the starting homes are lairs:
- **Ships:** 2–5 per lair. Lairs further down the generation list are bigger and roll better rarities.
- **Monsters don't move.** They only fight if you attack them.

| Monster | Size | Shield | Hull | Speed | Evasion | Slots |
|---|---|---|---|---|---|---|
| Lurker | S | 0 | 26 | 7 | 22 % | 1 |
| Maw | M | 0 | 70 | 4 | 8 % | 2 |
| Leviathan | L | 20 | 160 | 2 | 1 % | 3 |

Monsters have almost no shields, so physical weapons are the answer.

### 6.2 Alien empires

| Faction | Weapons lean | Aggression |
|---|---|---|
| The Chorus | Energy | 1.0 |
| Iron Remnant | Physical | 0.8 |

**Garrisons:**
- Every alien world has a garrison of ship cards: the home system up to 5 ships; other worlds 2, or 3 after Cycle 40.
- A full home garrison sometimes replaces its weakest ship.

**Ship quality over time:**
- **Hull size:** only Small at first. From Cycle 30 about 60 % Medium, and from Cycle 60 about 30 % Large.
- **Rarity:** odds improve with the Cycle; better rarities become up to 6× as likely by Cycle 175.

**Raids:**
- **When:** from Cycle 20, each faction has a 5 % × aggression chance per Cycle to launch a raid. A faction has at most one raid on its way at a time.
- **Size:** 2 ships, plus 1 for every 30 Cycles after Cycle 20, up to 5.
- **Warning:** the raid targets your system nearest to that faction and arrives in at least 2 Cycles. It shows on the Star Map (red !) and on the Overview.

### 6.3 Maintenance

Every ship costs its **maintenance** in Metals each Cycle, plus **half as much in Chemicals**. If you can't pay:
- Your stores bottom out at 0.
- No ship repairs until maintenance is paid again.

---

## 7. Quick tips

- **Size:** bring Medium ships against swarms of Small ones, Small ones against capital ships, and Large ones against Medium lines.
- **Damage type:**
  - Open with energy weapons on shielded targets, then finish with physical.
  - Against monsters, physical all the way.
  - The Chorus brings energy weapons, so thick hulls help; the Remnant brings physical, so shields help.
- **Weapon choice:**
  - Fast ships act first: a Scout or Fighter can finish off a wounded enemy before it fires.
  - Heavy weapons (Torpedo, Particle Beam) hit very hard but then sit out three turns.
- **Formation:**
  - Put each ship across from the enemy its size beats.
  - Fill all five lanes when you can, so no enemy gets a free target.
  - A short enemy line forces your outer ships to shoot across lanes at half the hit chance, so send a fleet about as wide as theirs.
- **Raids:** keep one fleet at home. A raid on an undefended system usually takes it.
