// Voyager — static game data. All content lives here so it can be tweaked without touching logic.

const DATA = {};

// Stockpiled resources. Infrastructure is not stockpiled: it is a capacity (see DATA.infra).
DATA.resources = {
  metal:    { name: 'Metal',         icon: '▣', color: '#a8a8b0', desc: 'Mined everywhere. Hulls, walls, everything.' },
  rare:     { name: 'Rare Minerals', icon: '◇', color: '#60c0a0', desc: 'Scarce crystals and heavy elements for advanced tech.' },
  polymers: { name: 'Polymers',      icon: '⬡', color: '#d08a50', desc: 'Refined from metal and rare minerals. Needed for advanced builds.' },
  compute:  { name: 'Compute',       icon: '☍', color: '#70c0c8', desc: 'Raw thinking power. Spent on research.' },
  shards:   { name: 'Void Shards',   icon: '◆', color: '#a35ad9', desc: 'Currency of the Void Signals.' },
};

// Infrastructure: power, life support, meals, habitation.
// Every colony and Habitat/Fusion building provides capacity; production buildings and ship crews use it.
// You cannot build past the cap. If usage ends up over the cap (a colony is lost), all production is rationed.
DATA.infra = { name: 'Infrastructure', icon: '⌂', colonyBase: 5, minEfficiency: 0.25 };

// Habitability 1–5: 1 Extremely Hazardous (Venus, Jupiter) … 5 Natural Life Support (old Earth).
// surface / orbit multiply the cost of building on that layer. Settling uses the surface rate
// (the orbit rate for planets without a surface).
DATA.habitability = {
  1: { name: 'Extremely Hazardous',  surface: 7.5, orbit: 2.5, color: '#c04030' },
  2: { name: 'Hazardous',            surface: 5,   orbit: 2,   color: '#c07030' },
  3: { name: 'Barren',               surface: 4,   orbit: 1,   color: '#c0a040' },
  4: { name: 'Habitable',            surface: 2.5, orbit: 1,   color: '#90b050' },
  5: { name: 'Natural Life Support', surface: 1,   orbit: 1,   color: '#50c070' },
};

// Stars use the Morgan–Keenan stellar classification (main sequence O B A F G K M).
// weight: how common (real galaxies are ~75% M dwarfs; flattened here for play).
// planets: [min, max] planets in the system. temps: bias on planet temperature rolls.
// solar: Infrastructure multiplier for every planet in the system (power from starlight).
// habMod: added to planet habitability (hard radiation around hot giants).
// radius: in solar radii (typical main-sequence values), used to draw the solar system map to scale.
DATA.starClasses = {
  O: { name: 'O-type Blue Giant',        color: '#9bb0ff', size: 3, radius: 10, weight: 1, planets: [1, 3], temps: { hot: 3, temperate: 0.4, frozen: 0.5 }, solar: 1.6,  habMod: -1, desc: 'Searing, short-lived and drowned in radiation. Hot worlds; little can live here.' },
  B: { name: 'B-type Blue-White Star',   color: '#aabfff', size: 3, radius: 5, weight: 2, planets: [2, 4], temps: { hot: 2.5, temperate: 0.6, frozen: 0.6 }, solar: 1.4,  habMod: -1, desc: 'Violent and luminous. Its planets are scoured by ultraviolet light.' },
  A: { name: 'A-type White Star',        color: '#cad7ff', size: 2, radius: 1.8, weight: 3, planets: [2, 5], temps: { hot: 1.8, temperate: 1, frozen: 0.8 },   solar: 1.25, habMod: 0,  desc: 'Bright and fast-burning. Strong starlight for power.' },
  F: { name: 'F-type Yellow-White Star', color: '#f8f7ff', size: 2, radius: 1.3, weight: 4, planets: [2, 5], temps: { hot: 1.3, temperate: 1.3, frozen: 0.9 }, solar: 1.1,  habMod: 0,  desc: 'A little hotter than the old Sun. Good odds for temperate worlds.' },
  G: { name: 'G-type Yellow Dwarf',      color: '#fff4c8', size: 2, radius: 1.0, weight: 5, planets: [2, 5], temps: { hot: 1, temperate: 2, frozen: 1 },       solar: 1.0,  habMod: 0,  desc: 'Like the Sun the Covenant fled. The best chance of a living world.' },
  K: { name: 'K-type Orange Dwarf',      color: '#ffd2a1', size: 1, radius: 0.75, weight: 6, planets: [2, 5], temps: { hot: 0.8, temperate: 1.3, frozen: 1.4 }, solar: 0.9,  habMod: 0,  desc: 'Calm and long-lived. Cooler worlds, steady light.' },
  // Not main sequence: a luminosity class 0 red hypergiant (like VY Canis Majoris). Never rolled randomly;
  // the galaxy places one near the start for show.
  H: { name: 'Red Hypergiant', color: '#ff5a32', size: 4, radius: 1400, weight: 0, planets: [1, 3], temps: { hot: 3, temperate: 0.2, frozen: 1 }, solar: 2.0, habMod: -2, desc: 'A dying star wider than the orbit of Jupiter, shedding its own skin into the dark. Its light is overwhelming; nothing living belongs here.' },
  // Stellar remnants: rare special systems. kind picks how they are drawn. mult: extra planet bonuses.
  // shards: Void Shards per Cycle while you hold the system.
  D: { kind: 'dwarf',    name: 'White Dwarf',       color: '#e8f0ff', size: 1, radius: 0.012, weight: 0.8, planets: [1, 3], temps: { hot: 0.3, temperate: 0.2, frozen: 3 }, solar: 0.4, habMod: -1, mult: { rare: 1.5 }, shards: 0, desc: 'The cooling corpse of a star, no bigger than a world. Its old planets are scorched cinders rich in heavy elements.' },
  N: { kind: 'pulsar',   name: 'Pulsar',            color: '#a0e0ff', size: 1, radius: 0.00002, weight: 0.5, planets: [1, 2], temps: { hot: 0.2, temperate: 0.1, frozen: 3 }, solar: 0.3, habMod: -2, mult: { compute: 2 }, shards: 1, desc: 'A spinning neutron star sweeping beams of hard radiation across its system, faster than a heartbeat. Its ticking is perfect; cogitators sync to it.' },
  X: { kind: 'blackhole',name: 'Black Hole',        color: '#ff9a40', size: 1, radius: 0.00004, weight: 0.3, planets: [1, 2], temps: { hot: 0.2, temperate: 0.1, frozen: 3 }, solar: 0.2, habMod: -2, mult: { compute: 2.5 }, shards: 3, desc: 'A wound in space ringed by burning gas. Time runs slow near the edge. The Void Signals are loudest here.' },
  M: { name: 'M-type Red Dwarf',         color: '#ff9a60', size: 1, radius: 0.35, weight: 8, planets: [1, 4], temps: { hot: 0.8, temperate: 0.5, frozen: 2.2 }, solar: 0.75, habMod: 0,  desc: 'The most common star. Dim, flaring and cold. Most of its worlds are frozen.' },
};

// Planets are classified by three factors: composition, size and temperature.
//   size: giant (gas only), large, average, dwarf
//   composition: gas, ice/water, silicate (earth-like)
//   temperature: frozen, temperate (silicate and ice/water only), hot
// slots = how many different buildings fit on each layer (levels are unlimited).
// An Extremely Hazardous (habitability 1) planet has no buildable surface.
// radius: range in Earth radii, used to draw the solar system map to scale
// (giants: Neptune-sized to bloated hot Jupiters; large: super-Earths; dwarf: Mars-sized and smaller).
DATA.planetSizes = {
  giant:   { name: 'Giant',   slots: { surface: 0, orbit: 5 }, sprite: 32, radius: [3.9, 12] },
  large:   { name: 'Large',   slots: { surface: 5, orbit: 4 }, sprite: 30, radius: [1.4, 2.2] },
  average: { name: 'Average', slots: { surface: 4, orbit: 3 }, sprite: 24, radius: [0.8, 1.25] },
  dwarf:   { name: 'Dwarf',   slots: { surface: 2, orbit: 2 }, sprite: 16, radius: [0.3, 0.6], habMod: -1 },
};
DATA.solarRadiusInEarths = 109;

DATA.compositions = {
  gas:      { name: 'Gas',       sizes: ['giant'],                     temps: ['frozen', 'hot'],              mult: { polymers: 2.0 } },
  water:    { name: 'Ice/Water', sizes: ['large', 'average', 'dwarf'], temps: ['frozen', 'temperate', 'hot'], mult: { infra: 1.3 } },
  silicate: { name: 'Silicate',  sizes: ['large', 'average', 'dwarf'], temps: ['frozen', 'temperate', 'hot'], mult: { metal: 1.5, rare: 1.2 } },
};

DATA.temperatures = {
  frozen:    { name: 'Frozen',    mult: { compute: 1.5 } }, // free cooling for cogitators
  temperate: { name: 'Temperate', mult: { infra: 1.2 } },
  hot:       { name: 'Hot',       mult: { rare: 1.5 } },    // volcanism brings heavy elements up
};

// Planet classes: one per composition + temperature. hab = habitability roll [min, max] before size.
// weight = how often it appears.
DATA.planetClasses = {
  gas_frozen:         { name: 'Cold Gas Giant', hab: [1, 1], weight: 3, palette: ['#141a28', '#28384e', '#4a6478', '#90b0c0'] },
  gas_hot:            { name: 'Hot Gas Giant',  hab: [1, 1], weight: 2, palette: ['#2a1410', '#5a2a1a', '#a0502a', '#e0a060'] },
  water_frozen:       { name: 'Ice World',      hab: [2, 3], weight: 5, palette: ['#1a2430', '#3a5060', '#6a8a98', '#c8dce4'] },
  water_temperate:    { name: 'Ocean World',    hab: [3, 4], weight: 3, palette: ['#0a1420', '#14304a', '#2a5a78', '#70a0b8'] },
  water_hot:          { name: 'Steam World',    hab: [1, 2], weight: 2, palette: ['#1a1a20', '#3a3a48', '#70707e', '#b0b0b8'] },
  silicate_frozen:    { name: 'Frozen Rock',    hab: [2, 3], weight: 5, palette: ['#18181c', '#34343c', '#5e5e68', '#a0a0a8'] },
  silicate_temperate: { name: 'Terran World',   hab: [4, 5], weight: 2, palette: ['#0e1a0e', '#24401e', '#4a6a2a', '#8a9a50'] },
  silicate_hot:       { name: 'Scorched Rock',  hab: [1, 2], weight: 4, palette: ['#200a06', '#5a1a0a', '#a0400a', '#f0a040'] },
};

DATA.layers = { surface: 'Surface', orbit: 'Orbit' };

// Buildings. layers: where they can be built (a building allowed in both layers is built separately in each).
// Cost grows by costGrowth^level. infra: capacity used per level (negative = provided).
// Light production chain: Mine → Metal, Drill → Rare Minerals, Refinery turns Metal + Rare into Polymers.
DATA.buildings = {
  mine:     { name: 'Deep Mine',        layers: ['surface'], desc: '+3 Metal',                                cost: { metal: 30 },               costGrowth: 1.55, infra: 1 },
  drill:    { name: 'Core Drill',       layers: ['surface'], desc: '+1.5 Rare Minerals',                      cost: { metal: 45 },               costGrowth: 1.6,  infra: 1 },
  refinery: { name: 'Polymer Refinery', layers: ['surface'], desc: 'Turns 2 Metal + 0.5 Rare into 2 Polymers', cost: { metal: 50, rare: 10 },    costGrowth: 1.6,  infra: 1 },
  dome:     { name: 'Hab Dome',         layers: ['surface'], desc: '+5 Infrastructure (meals, air, bunks)',   cost: { metal: 30, polymers: 10 }, costGrowth: 1.5,  infra: -5 },
  bastion:  { name: 'Bastion',          layers: ['surface'], desc: '+25 garrison, fires on attackers',         cost: { metal: 50, rare: 5 },      costGrowth: 1.6,  infra: 0 },
  fusion:   { name: 'Fusion Core',      layers: ['surface', 'orbit'], desc: '+5 Infrastructure, +10% planet output', cost: { metal: 60, rare: 20 }, costGrowth: 1.7, infra: -5 },
  cogitator:{ name: 'Cogitator Array',  layers: ['surface', 'orbit'], desc: '+2 Compute',                      cost: { metal: 40, polymers: 15 }, costGrowth: 1.65, infra: 1 },
  ring:     { name: 'Habitat Ring',     layers: ['orbit'],   desc: '+6 Infrastructure',                        cost: { metal: 35, polymers: 15 }, costGrowth: 1.5,  infra: -6 },
  skimmer:  { name: 'Gas Skimmer',      layers: ['orbit'],   desc: '+1.5 Polymers, no inputs (Gas Giant ×2)',  cost: { metal: 55, rare: 10 },     costGrowth: 1.6,  infra: 1 },
  shipyard: { name: 'Orbital Shipyard', layers: ['orbit'],   desc: 'Builds ships. Each level after 1 makes ships 5% cheaper', cost: { metal: 60, polymers: 10 }, costGrowth: 1.8, infra: 1 },
  platform: { name: 'Defense Platform', layers: ['orbit'],   desc: '+15 garrison, heavy fire on attackers',   cost: { metal: 60, polymers: 10, rare: 10 }, costGrowth: 1.6, infra: 0 },
};

// Settling another planet in a system you already hold (no Ark needed). Grows with planets owned.
DATA.settleCost = { metal: 60, polymers: 20 };
DATA.settleGrowth = 1.2;

// Ship types. infra = crew life support capacity used while the ship exists.
DATA.ships = {
  scout:    { name: 'Scout',        atk: 0,  hp: 5,   cost: { metal: 15 },                                infra: 0.5, role: 'Explores unknown systems' },
  ark:      { name: 'Colony Ark',   atk: 0,  hp: 20,  cost: { metal: 60, polymers: 25 },                  infra: 2,   role: 'Founds a colony, consumed on use' },
  corvette: { name: 'Corvette',     atk: 3,  hp: 10,  cost: { metal: 25 },                                infra: 1,   role: 'Cheap line ship' },
  frigate:  { name: 'Frigate',      atk: 8,  hp: 25,  cost: { metal: 50, polymers: 15 },                  infra: 2,   role: 'Solid warship', req: { tech: 'frigates' } },
  lancer:   { name: 'Void Lancer',  atk: 16, hp: 18,  cost: { metal: 50, rare: 20, polymers: 15 },        infra: 2,   role: 'Glass cannon', req: { blueprint: 'bp_lancer' } },
  dread:    { name: 'Dreadnought',  atk: 32, hp: 110, cost: { metal: 160, rare: 50, polymers: 60 },       infra: 6,   role: 'Cathedral of war', req: { blueprint: 'bp_dread' } },
  lurker:   { name: 'Lurker',       atk: 4,  hp: 16,  cost: {}, infra: 0, role: 'Something from the dark', monster: true },
};

// Research, paid in Compute. repeat:true techs can be researched forever with growing cost (incremental layer).
DATA.techs = {
  deepcore:   { name: 'Deep Core Extraction', cost: 30,  mods: { metal: 0.25 },     desc: '+25% Metal' },
  frigates:   { name: 'Frigate Hulls',        cost: 40,  mods: {},                  desc: 'Unlocks Frigates' },
  cracking:   { name: 'Catalytic Cracking',   cost: 45,  mods: { polymers: 0.3 },   desc: '+30% Polymers' },
  rationing:  { name: 'Ration Protocols',     cost: 50,  mods: { infra: 0.2 },      desc: '+20% Infrastructure' },
  voidlisten: { name: 'Void Listening',       cost: 60,  mods: { shardIncome: 1 },  desc: '+1 Void Shard per Cycle' },
  prospect:   { name: 'Deep Prospecting',     cost: 65,  mods: { rare: 0.3 },       desc: '+30% Rare Minerals' },
  ossuary:    { name: 'Ossuary Indexing',     cost: 70,  mods: { compute: 0.3 },    desc: '+30% Compute' },
  bastionwalls:{name: 'Martyr Walls',         cost: 75,  mods: { bastion: 0.5 },    desc: '+50% garrison strength' },
  plasmaweave:{ name: 'Plasma Weave',         cost: 80,  mods: { atk: 0.2 },        desc: '+20% ship attack' },
  bonehulls:  { name: 'Bone-grown Hulls',     cost: 90,  mods: { hp: 0.25 },        desc: '+25% ship hull' },
  forge:      { name: 'Forge Doctrine',       cost: 50,  mods: { metal: 0.1 },      desc: '+10% Metal per level', repeat: true, growth: 1.45 },
  arcology:   { name: 'Arcology Doctrine',    cost: 60,  mods: { infra: 0.08 },     desc: '+8% Infrastructure per level', repeat: true, growth: 1.5 },
  cogitator:  { name: 'Cogitator Doctrine',   cost: 60,  mods: { compute: 0.1 },    desc: '+10% Compute per level', repeat: true, growth: 1.5 },
};

// Factions. 'player' is you; others are AI. 'monster' are neutral horrors guarding systems.
DATA.factions = {
  player:  { name: 'The Last Covenant', color: '#d8c8a0', short: 'You' },
  chorus:  { name: 'The Chorus',        color: '#7fbf3f', short: 'Chorus', desc: 'A hive that sings across the void. It wants you to join the song.' },
  remnant: { name: 'Iron Remnant',      color: '#d06030', short: 'Remnant', desc: 'Ancient war-machines still following orders from a dead empire.' },
  monster: { name: 'Lurkers',           color: '#8a2a3a', short: 'Lurkers' },
};

// Void Signal gacha pool. kind: leader | relic | blueprint | cache.
// mods add to empire multipliers; rank-ups multiply the bonus by (1 + 0.5 * (rank - 1)).
DATA.rarities = {
  common: { name: 'Common', color: '#9a9080', rate: 0.70 },
  rare:   { name: 'Rare',   color: '#4a8ad0', rate: 0.25 },
  mythic: { name: 'Mythic', color: '#d0a020', rate: 0.05 },
};
DATA.pity = { mythic: 40 };
DATA.pullCost = 10;

DATA.gachaPool = [
  // Common
  { id: 'l_vell',   kind: 'leader', rarity: 'common', name: 'Quartermaster Vell', mods: { metal: 0.1 },  desc: '+10% Metal. Counts every bolt twice.' },
  { id: 'l_moro',   kind: 'leader', rarity: 'common', name: 'Tech-Adept Moro',    mods: { compute: 0.1 }, desc: '+10% Compute. Half of him is cogitator now.' },
  { id: 'r_icon',   kind: 'relic',  rarity: 'common', name: 'Rusted Icon',        mods: { infra: 0.08 },  desc: '+8% Infrastructure. The saint\'s face is worn away.' },
  { id: 'r_compass',kind: 'relic',  rarity: 'common', name: 'Bone Compass',       mods: { exploreShards: 1 }, desc: '+1 Shard per system explored.' },
  { id: 'c_salvage',kind: 'cache',  rarity: 'common', name: 'Salvage Cache',      gives: { metal: 60, polymers: 20 }, desc: '+60 Metal, +20 Polymers, once.' },
  { id: 'c_data',   kind: 'cache',  rarity: 'common', name: 'Corrupted Datacore', gives: { compute: 40 }, desc: '+40 Compute, once.' },
  // Rare
  { id: 'l_kesh',   kind: 'leader', rarity: 'rare', name: 'Admiral Kesh',        mods: { atk: 0.15 }, desc: '+15% ship attack. Never asks how many died.' },
  { id: 'l_sallow', kind: 'leader', rarity: 'rare', name: 'Governor Sallow',     mods: { all: 0.1 },  desc: '+10% all production. Rules by quota.' },
  { id: 'r_weep',   kind: 'relic',  rarity: 'rare', name: 'Weeping Reliquary',   mods: { compute: 0.25, infra: -0.05 }, cursed: true, desc: '+25% Compute, −5% Infrastructure. It weeps oil.' },
  { id: 'bp_lancer',kind: 'blueprint', rarity: 'rare', name: 'Blueprint: Void Lancer', unlock: 'lancer', desc: 'Unlocks the Void Lancer.' },
  // Mythic
  { id: 'l_saint',  kind: 'leader', rarity: 'mythic', name: 'The Hollow Saint',  mods: { all: 0.25, hp: 0.2 }, desc: '+25% all production, +20% hull. No one has seen its face.' },
  { id: 'bp_dread', kind: 'blueprint', rarity: 'mythic', name: 'Blueprint: Dreadnought', unlock: 'dread', desc: 'Unlocks the Dreadnought.' },
  { id: 'r_heart',  kind: 'relic', rarity: 'mythic', name: 'Heart of the Abyss', mods: { rare: 0.3, shardIncome: 2, aiAggro: 0.25 }, cursed: true, desc: '+30% Rare Minerals, +2 Shards/Cycle. The aliens can hear it beating.' },
];

// Exploration events. effect(G, ctx) mutates the game and returns a log line.
DATA.events = {
  derelict: {
    title: 'Derelict Hulk',
    text: 'A dead warship drifts here. Its crew are fused into the walls, and some of them are still breathing.',
    choices: [
      { label: 'Strip it for salvage', effect: (G, c) => {
        G.res.metal += 50;
        if (Math.random() < 0.3) { Fleets.killOneShip(c.fleetId); return 'Salvage recovered (+50 Metal). Something followed the boarding party back. A ship is lost.'; }
        return 'Salvage recovered (+50 Metal). The breathing stopped when the reactor was cut.';
      } },
      { label: 'Leave it to the dark', effect: () => 'You leave the hulk behind. The breathing is in the comm logs now.' },
    ],
  },
  signal: {
    title: 'A Voice in the Static',
    text: 'On every channel, a voice repeats the names of your crew, including some who have not been born yet.',
    choices: [
      { label: 'Listen', effect: (G) => {
        G.res.shards += 8;
        if (Math.random() < 0.35) { G.res.compute = Math.max(0, G.res.compute - 30); return 'You listen (+8 Shards). Three archivists clawed out their eyes. −30 Compute.'; }
        return 'You listen (+8 Shards). It knows you now.';
      } },
      { label: 'Burn the receiver', effect: () => 'The receiver is burned. The voice keeps speaking on a frequency you no longer have.' },
    ],
  },
  ruins: {
    title: 'Ruins Older Than Stars',
    text: 'Cyclopean structures cover the planet. The geometry hurts to look at.',
    choices: [
      { label: 'Excavate', effect: (G) => { G.res.compute += 30; G.res.rare += 20; return 'Excavation complete (+30 Compute, +20 Rare Minerals). The dig team will not say what they saw.'; } },
      { label: 'Seal it away', effect: (G) => { G.res.shards += 3; return 'The ruins are sealed under ferrocrete (+3 Shards). Sometimes the seal is warm.'; } },
    ],
  },
  survivors: {
    title: 'Survivors',
    text: 'A crippled transport carries the last survivors of a fallen colony. They beg for rescue.',
    choices: [
      { label: 'Take them in', effect: (G) => { G.res.polymers = Math.max(0, G.res.polymers - 20); G.res.shards += 4; return 'The survivors are taken aboard (−20 Polymers for bunks and rations, +4 Shards). Their prayers seem to reach something.'; } },
      { label: 'Strip their vessel', effect: (G) => { G.res.metal += 50; G.res.polymers += 15; return 'Their vessel is stripped (+50 Metal, +15 Polymers). The transport goes dark. Nobody speaks of it.'; } },
    ],
  },
  cache: {
    title: 'Hidden Cache',
    text: 'A sealed vault, marked with the sigil of an empire that no longer exists.',
    choices: [
      { label: 'Crack it open', effect: (G) => { G.res.rare += 25; G.res.polymers += 20; return 'The vault is cracked open (+25 Rare Minerals, +20 Polymers).'; } },
    ],
  },
};

DATA.names = {
  pre:  ['Mor', 'Thal', 'Vex', 'Ossu', 'Kar', 'Nihl', 'Gol', 'Sep', 'Ul', 'Drath', 'Ash', 'Cren', 'Hesk', 'Iro', 'Lith', 'Myr', 'Pyr', 'Skel', 'Tor', 'Varn', 'Zeth', 'Grav', 'Bel', 'Quor'],
  mid:  ['', '', 'a', 'o', 'u', 'e', 'i'],
  post: ['mund', 'gora', 'thas', 'rax', 'cyr', 'veil', 'nox', 'grim', 'dun', 'sorrow', 'kesh', 'mor', 'ath', 'ius', 'ul'],
  suffix: ['', '', '', ' Prime', ' IV', ' VII', ' Secundus', "'s Grave", ' Reach', ' Hollow'],
};

DATA.config = {
  systemCount: 22,
  startExplored: 10, // systems already charted at the start, nearest to home
  monsterSystems: 6,
  autoCycleMs: 3000,
  offlineSecondsPerCycle: 60,
  offlineMaxCycles: 120,
  offlineEfficiency: 0.5,
  saveKey: 'voyager_save_v8',
};
