// Voyager — static game data. All content lives here so it can be tweaked without touching logic.

const DATA = {};

DATA.resources = {
  ore:      { name: 'Ore',      icon: '⛏', color: '#b0703c' },
  energy:   { name: 'Energy',   icon: '⚡', color: '#d9c45a' },
  research: { name: 'Research', icon: '☍', color: '#5aa3a8' },
  shards:   { name: 'Void Shards', icon: '◆', color: '#a35ad9' },
};

DATA.planetTypes = {
  ash:    { name: 'Ash World',    mult: { ore: 1.5 },     palette: ['#2a1e1a', '#4a3328', '#7a5240', '#a07050'] },
  iron:   { name: 'Iron Desert',  mult: { ore: 2.0 },     palette: ['#2a1410', '#5a2a1a', '#8a4428', '#b86a3a'] },
  ice:    { name: 'Frozen Tomb',  mult: { research: 1.5 },palette: ['#1a2430', '#3a5060', '#6a8a98', '#b8d0d8'] },
  toxic:  { name: 'Toxic Mire',   mult: { energy: 1.5 },  palette: ['#141f10', '#2a4018', '#4a6a20', '#8aa040'] },
  gas:    { name: 'Gas Giant',    mult: { energy: 2.0 },  palette: ['#1f1428', '#3e2848', '#6a4a70', '#a080a0'] },
  hollow: { name: 'Hollow World', mult: { research: 2.0 },palette: ['#101010', '#262222', '#4a3e3a', '#8a7a68'] },
};

// Buildings: cost grows by costGrowth^level.
DATA.buildings = {
  mine:     { name: 'Deep Mine',      desc: '+3 Ore per level',        cost: { ore: 30, energy: 10 }, costGrowth: 1.6 },
  reactor:  { name: 'Reactor Shrine', desc: '+3 Energy per level',     cost: { ore: 35, energy: 0 },  costGrowth: 1.6 },
  archive:  { name: 'Ossuary Archive',desc: '+2 Research per level',   cost: { ore: 40, energy: 20 }, costGrowth: 1.65 },
  shipyard: { name: 'Shipyard',       desc: 'Builds ships. Higher levels discount ships 5%/lvl', cost: { ore: 60, energy: 30 }, costGrowth: 1.8 },
  bastion:  { name: 'Bastion',        desc: '+25 garrison, fires on attackers', cost: { ore: 50, energy: 20 }, costGrowth: 1.6 },
};

// Ship types. upkeep is energy per Cycle.
DATA.ships = {
  scout:    { name: 'Scout',        atk: 0,  hp: 5,   cost: { ore: 15, energy: 5 },   upkeep: 0.2, role: 'Explores unknown systems' },
  ark:      { name: 'Colony Ark',   atk: 0,  hp: 20,  cost: { ore: 70, energy: 40 },  upkeep: 0.5, role: 'Founds a colony, consumed on use' },
  corvette: { name: 'Corvette',     atk: 3,  hp: 10,  cost: { ore: 20, energy: 10 },  upkeep: 0.4, role: 'Cheap line ship' },
  frigate:  { name: 'Frigate',      atk: 8,  hp: 25,  cost: { ore: 45, energy: 25 },  upkeep: 0.8, role: 'Solid warship', req: { tech: 'frigates' } },
  lancer:   { name: 'Void Lancer',  atk: 16, hp: 18,  cost: { ore: 60, energy: 45 },  upkeep: 1.2, role: 'Glass cannon', req: { blueprint: 'bp_lancer' } },
  dread:    { name: 'Dreadnought',  atk: 32, hp: 110, cost: { ore: 160, energy: 90 }, upkeep: 3,   role: 'Cathedral of war', req: { blueprint: 'bp_dread' } },
  lurker:   { name: 'Lurker',       atk: 4,  hp: 16,  cost: {}, upkeep: 0, role: 'Something from the dark', monster: true },
};

// Research. repeat:true techs can be researched forever with growing cost (incremental layer).
DATA.techs = {
  deepcore:   { name: 'Deep Core Extraction', cost: 30,  mods: { ore: 0.25 },      desc: '+25% Ore' },
  reactorhymn:{ name: 'Reactor Litanies',     cost: 40,  mods: { energy: 0.25 },   desc: '+25% Energy' },
  frigates:   { name: 'Frigate Hulls',        cost: 45,  mods: {},                 desc: 'Unlocks Frigates' },
  voidlisten: { name: 'Void Listening',       cost: 60,  mods: { shardIncome: 1 }, desc: '+1 Void Shard per Cycle' },
  ossuary:    { name: 'Ossuary Indexing',     cost: 70,  mods: { research: 0.3 },  desc: '+30% Research' },
  plasmaweave:{ name: 'Plasma Weave',         cost: 80,  mods: { atk: 0.2 },       desc: '+20% ship attack' },
  bonehulls:  { name: 'Bone-grown Hulls',     cost: 90,  mods: { hp: 0.25 },       desc: '+25% ship hull' },
  bastionwalls:{name: 'Martyr Walls',         cost: 75,  mods: { bastion: 0.5 },   desc: '+50% garrison strength' },
  forge:      { name: 'Forge Doctrine',       cost: 50,  mods: { ore: 0.1 },       desc: '+10% Ore per level', repeat: true, growth: 1.45 },
  grid:       { name: 'Grid Doctrine',        cost: 50,  mods: { energy: 0.1 },    desc: '+10% Energy per level', repeat: true, growth: 1.45 },
  cogitator:  { name: 'Cogitator Doctrine',   cost: 60,  mods: { research: 0.1 },  desc: '+10% Research per level', repeat: true, growth: 1.5 },
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
  { id: 'l_vell',   kind: 'leader', rarity: 'common', name: 'Quartermaster Vell', mods: { ore: 0.1 },  desc: '+10% Ore. Counts every bolt twice.' },
  { id: 'l_moro',   kind: 'leader', rarity: 'common', name: 'Tech-Adept Moro',    mods: { research: 0.1 }, desc: '+10% Research. Half of him is cogitator now.' },
  { id: 'r_icon',   kind: 'relic',  rarity: 'common', name: 'Rusted Icon',        mods: { energy: 0.08 },  desc: '+8% Energy. The saint\'s face is worn away.' },
  { id: 'r_compass',kind: 'relic',  rarity: 'common', name: 'Bone Compass',       mods: { exploreShards: 1 }, desc: '+1 Shard per system explored.' },
  { id: 'c_salvage',kind: 'cache',  rarity: 'common', name: 'Salvage Cache',      gives: { ore: 60, energy: 30 }, desc: '+60 Ore, +30 Energy, once.' },
  { id: 'c_data',   kind: 'cache',  rarity: 'common', name: 'Corrupted Datacore', gives: { research: 40 }, desc: '+40 Research, once.' },
  // Rare
  { id: 'l_kesh',   kind: 'leader', rarity: 'rare', name: 'Admiral Kesh',        mods: { atk: 0.15 }, desc: '+15% ship attack. Never asks how many died.' },
  { id: 'l_sallow', kind: 'leader', rarity: 'rare', name: 'Governor Sallow',     mods: { all: 0.1 },  desc: '+10% all production. Rules by quota.' },
  { id: 'r_weep',   kind: 'relic',  rarity: 'rare', name: 'Weeping Reliquary',   mods: { research: 0.25, energy: -0.05 }, cursed: true, desc: '+25% Research, −5% Energy. It weeps oil.' },
  { id: 'bp_lancer',kind: 'blueprint', rarity: 'rare', name: 'Blueprint: Void Lancer', unlock: 'lancer', desc: 'Unlocks the Void Lancer.' },
  // Mythic
  { id: 'l_saint',  kind: 'leader', rarity: 'mythic', name: 'The Hollow Saint',  mods: { all: 0.25, hp: 0.2 }, desc: '+25% all production, +20% hull. No one has seen its face.' },
  { id: 'bp_dread', kind: 'blueprint', rarity: 'mythic', name: 'Blueprint: Dreadnought', unlock: 'dread', desc: 'Unlocks the Dreadnought.' },
  { id: 'r_heart',  kind: 'relic', rarity: 'mythic', name: 'Heart of the Abyss', mods: { ore: 0.3, shardIncome: 2, aiAggro: 0.25 }, cursed: true, desc: '+30% Ore, +2 Shards/Cycle. The aliens can hear it beating.' },
];

// Exploration events. effect(G, ctx) mutates the game and returns a log line.
DATA.events = {
  derelict: {
    title: 'Derelict Hulk',
    text: 'A dead warship drifts here. Its crew are fused into the walls, and some of them are still breathing.',
    choices: [
      { label: 'Strip it for salvage', effect: (G, c) => {
        G.res.ore += 50;
        if (Math.random() < 0.3) { Fleets.killOneShip(c.fleetId); return 'Salvage recovered (+50 Ore). Something followed the boarding party back. A ship is lost.'; }
        return 'Salvage recovered (+50 Ore). The breathing stopped when the reactor was cut.';
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
        if (Math.random() < 0.35) { G.res.research = Math.max(0, G.res.research - 30); return 'You listen (+8 Shards). Three archivists clawed out their eyes. −30 Research.'; }
        return 'You listen (+8 Shards). It knows you now.';
      } },
      { label: 'Burn the receiver', effect: () => 'The receiver is burned. The voice keeps speaking on a frequency you no longer have.' },
    ],
  },
  ruins: {
    title: 'Ruins Older Than Stars',
    text: 'Cyclopean structures cover the planet. The geometry hurts to look at.',
    choices: [
      { label: 'Excavate', effect: (G) => { G.res.research += 45; return 'Excavation complete (+45 Research). The dig team will not say what they saw.'; } },
      { label: 'Seal it away', effect: (G) => { G.res.shards += 3; return 'The ruins are sealed under ferrocrete (+3 Shards). Sometimes the seal is warm.'; } },
    ],
  },
  survivors: {
    title: 'Survivors',
    text: 'A crippled transport carries the last survivors of a fallen colony. They beg for rescue.',
    choices: [
      { label: 'Take them in', effect: (G) => { G.res.energy = Math.max(0, G.res.energy - 25); G.res.shards += 4; return 'The survivors are taken aboard (−25 Energy, +4 Shards). Their prayers seem to reach something.'; } },
      { label: 'Strip their vessel', effect: (G) => { G.res.ore += 70; return 'Their vessel is stripped (+70 Ore). The transport goes dark. Nobody speaks of it.'; } },
    ],
  },
  cache: {
    title: 'Hidden Cache',
    text: 'A sealed vault, marked with the sigil of an empire that no longer exists.',
    choices: [
      { label: 'Crack it open', effect: (G) => { G.res.ore += 30; G.res.energy += 30; return 'The vault is cracked open (+30 Ore, +30 Energy).'; } },
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
  monsterSystems: 6,
  autoCycleMs: 3000,
  offlineSecondsPerCycle: 60,
  offlineMaxCycles: 120,
  offlineEfficiency: 0.5,
  saveKey: 'voyager_save_v1',
};
