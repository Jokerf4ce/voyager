// Voyager — static game data. All content lives here so it can be tweaked without touching logic.

const DATA = {};

// Stockpiled resources.
//   gathered: Metals, Rare Minerals, Organics (from planets; see DATA.planetClasses yields)
//   refined:  Electronics (Metals + Rare Minerals), Chemicals (Organics + Rare Minerals). Only spent on building.
//   Research points (made by Research Labs) and Crypto Shards (made by Finance Districts; for trade later).
// decimals: how many decimals the amount is shown with (Crypto Shards come in tiny amounts).
DATA.resources = {
  metal:     { name: 'Metals',        icon: '▣', color: '#a8a8b0', kind: 'gathered', desc: 'Mined from rocky worlds. Hulls, walls, everything.' },
  rare:      { name: 'Rare Minerals', icon: '◇', color: '#60c0a0', kind: 'gathered', desc: 'Heavy elements from hot worlds, dwarfs and dead stars.' },
  organics:  { name: 'Organics',      icon: '❦', color: '#9ab050', kind: 'gathered', desc: 'Biomass, hydrocarbons and frozen volatiles from living worlds, ice and gas giants.' },
  electronics: { name: 'Electronics', icon: '⍯', color: '#d08a50', kind: 'refined',  desc: 'Circuits and components made from Metals and Rare Minerals. Advanced construction.' },
  chemicals: { name: 'Chemicals',     icon: '⚗', color: '#d0c060', kind: 'refined',  desc: 'Converted from Organics and Rare Minerals. Fuel, explosives, reagents.' },
  crypto:    { name: 'Crypto Shards', icon: '◈', color: '#e080d0', kind: 'currency', decimals: 2, desc: 'An interstellar crypto currency, mined by Finance Districts. Scarce by design: it will be used for trade.' },
  research:  { name: 'Research',      icon: '✎', color: '#70c0c8', kind: 'points',   desc: 'Made by Research Labs. Spent on technology.' },
};

// Capacities: not stockpiled. Buildings provide them and buildings/ships use them.
// You cannot build past a cap. If usage ends up over a cap (a colony is lost), all production is rationed.
//   Power:          used by almost every building.
//   Infrastructure: life support, meals and bunks for colony workers and ship crews.
//   Compute:        needed by Research Labs, Defense Platforms and advanced warships.
DATA.capacities = {
  power:   { name: 'Power',          icon: 'ϟ', color: '#e0d070', base: 2, desc: 'Electricity from reactors and starlight. Every building draws it.' },
  infra:   { name: 'Infrastructure', icon: '⌂', color: '#d8c070', base: 5, desc: 'Life support, meals and bunks for workers and ship crews.' },
  compute: { name: 'Compute',        icon: '☍', color: '#70c0c8', base: 0, desc: 'Cogitator capacity for labs, defense grids and advanced warships.' },
};
DATA.minEfficiency = 0.25;

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
// solar: Power multiplier for every planet in the system (starlight for solar arrays).
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
  // Stellar remnants: rare special systems. kind picks how they are drawn. mult: extra planet bonuses
  // (all remnants are rich in Rare Minerals).
  D: { kind: 'dwarf',    name: 'White Dwarf',       color: '#e8f0ff', size: 1, radius: 0.012, weight: 0.8, planets: [1, 3], temps: { hot: 0.3, temperate: 0.2, frozen: 3 }, solar: 0.4, habMod: -1, mult: { rare: 1.5 }, desc: 'The cooling corpse of a star, no bigger than a world. Its old planets are scorched cinders rich in heavy elements.' },
  N: { kind: 'pulsar',   name: 'Pulsar',            color: '#a0e0ff', size: 1, radius: 0.00002, weight: 0.5, planets: [1, 2], temps: { hot: 0.2, temperate: 0.1, frozen: 3 }, solar: 0.3, habMod: -2, mult: { rare: 1.5, compute: 2 }, desc: 'A spinning neutron star sweeping beams of hard radiation across its system, faster than a heartbeat. Its ticking is perfect; cogitators sync to it.' },
  X: { kind: 'blackhole',name: 'Black Hole',        color: '#ff9a40', size: 1, radius: 0.00004, weight: 0.3, planets: [1, 2], temps: { hot: 0.2, temperate: 0.1, frozen: 3 }, solar: 0.2, habMod: -2, mult: { rare: 1.5, compute: 2.5 }, desc: 'A wound in space ringed by burning gas. Time runs slow near the edge. The Void Signals are loudest here.' },
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
// yield: multiplies gathered resources. rareBonus: dwarfs' exposed cores add to the Rare Minerals rating.
DATA.planetSizes = {
  giant:   { name: 'Giant',   slots: { surface: 0, orbit: 5 }, sprite: 32, radius: [3.9, 12], yield: 1.5 },
  large:   { name: 'Large',   slots: { surface: 5, orbit: 4 }, sprite: 30, radius: [1.4, 2.2], yield: 1.5 },
  average: { name: 'Average', slots: { surface: 4, orbit: 3 }, sprite: 24, radius: [0.8, 1.25], yield: 1 },
  dwarf:   { name: 'Dwarf',   slots: { surface: 2, orbit: 2 }, sprite: 16, radius: [0.3, 0.6], habMod: -1, rareBonus: 1, yield: 0.6 },
};
DATA.solarRadiusInEarths = 109;

// Composition and temperature now only shape the capacities a planet is good for.
DATA.compositions = {
  gas:      { name: 'Gas',       sizes: ['giant'],                     temps: ['frozen', 'hot'],              mult: {} },
  water:    { name: 'Ice/Water', sizes: ['large', 'average', 'dwarf'], temps: ['frozen', 'temperate', 'hot'], mult: { infra: 1.3 } },
  silicate: { name: 'Silicate',  sizes: ['large', 'average', 'dwarf'], temps: ['frozen', 'temperate', 'hot'], mult: {} },
};

DATA.temperatures = {
  frozen:    { name: 'Frozen',    mult: { compute: 1.5 } }, // free cooling for cogitators
  temperate: { name: 'Temperate', mult: { infra: 1.2 } },
  hot:       { name: 'Hot',       mult: { power: 1.3 } },   // geothermal and strong starlight
};

// Planet classes: one per composition + temperature. hab = habitability roll [min, max] before size.
// weight = how often it appears. yields = rating 0–3 for each gathered resource
// (a colony gathers rating × size yield per Cycle, each gathering building level adds 2 × that).
DATA.planetClasses = {
  gas_frozen:         { name: 'Cold Gas Giant', hab: [1, 1], weight: 3, yields: { metal: 0, rare: 0, organics: 2 }, palette: ['#141a28', '#28384e', '#4a6478', '#90b0c0'] },
  gas_hot:            { name: 'Hot Gas Giant',  hab: [1, 1], weight: 2, yields: { metal: 0, rare: 1, organics: 1 }, palette: ['#2a1410', '#5a2a1a', '#a0502a', '#e0a060'] },
  water_frozen:       { name: 'Ice World',      hab: [2, 3], weight: 5, yields: { metal: 0, rare: 1, organics: 2 }, palette: ['#1a2430', '#3a5060', '#6a8a98', '#c8dce4'] },
  water_temperate:    { name: 'Ocean World',    hab: [3, 4], weight: 3, yields: { metal: 1, rare: 0, organics: 3 }, palette: ['#0a1420', '#14304a', '#2a5a78', '#70a0b8'] },
  water_hot:          { name: 'Steam World',    hab: [1, 2], weight: 2, yields: { metal: 0, rare: 2, organics: 1 }, palette: ['#1a1a20', '#3a3a48', '#70707e', '#b0b0b8'] },
  silicate_frozen:    { name: 'Frozen Rock',    hab: [2, 3], weight: 5, yields: { metal: 3, rare: 1, organics: 0 }, palette: ['#18181c', '#34343c', '#5e5e68', '#a0a0a8'] },
  silicate_temperate: { name: 'Terran World',   hab: [4, 5], weight: 2, yields: { metal: 2, rare: 1, organics: 3 }, palette: ['#0e1a0e', '#24401e', '#4a6a2a', '#8a9a50'] },
  silicate_hot:       { name: 'Scorched Rock',  hab: [1, 2], weight: 4, yields: { metal: 2, rare: 3, organics: 0 }, palette: ['#200a06', '#5a1a0a', '#a0400a', '#f0a040'] },
};

DATA.layers = { surface: 'Surface', orbit: 'Orbit' };

// Buildings. layers: where they can be built (a building allowed in both layers is built separately in each).
// Cost is flat: the base cost × the colony's habitability multiplier (surface or orbit). cap: capacity per level,
// positive = uses, negative = provides. gathers: which gathered resource the building extracts.
DATA.buildings = {
  // gathering
  mine:      { name: 'Planetary mining rig',        layers: ['surface'], gathers: 'metal',    desc: 'Mines Metals (+2 × planet rating)',        cost: { metal: 30 },                          cap: { power: 1, infra: 1 } },
  drill:     { name: 'Core Drill',                  layers: ['surface'], gathers: 'rare',     desc: 'Drills Rare Minerals (+2 × planet rating)', cost: { metal: 45 },                          cap: { power: 1, infra: 1 } },
  harvester: { name: 'Bio-Harvester',               layers: ['surface'], gathers: 'organics', desc: 'Harvests Organics (+2 × planet rating)',    cost: { metal: 35 },                          cap: { power: 1, infra: 1 } },
  skimmer:   { name: 'Atmosphere Skimmer',          layers: ['orbit'], gathers: 'organics', also: 'rare', desc: 'Skims Organics and Rare Minerals from the atmosphere below', cost: { metal: 50 }, cap: { power: 1, infra: 1 } },
  // refining
  refinery:  { name: 'Fabrication Center',          layers: ['surface', 'orbit'], desc: 'Turns 2 Metals + 0.5 Rare into 2 Electronics',    cost: { metal: 50, rare: 10 },             cap: { power: 2, infra: 1 }, refines: { out: 'electronics', in: { metal: 2, rare: 0.5 }, amount: 2 } },
  chemplant: { name: 'Chemical Plant',              layers: ['surface', 'orbit'], desc: 'Turns 2 Organics + 0.5 Rare into 2 Chemicals', cost: { metal: 45, rare: 10 },             cap: { power: 2, infra: 1 }, refines: { out: 'chemicals', in: { organics: 2, rare: 0.5 }, amount: 2 } },
  // capacities
  fusion:    { name: 'Power Plant',      layers: ['surface', 'orbit'], desc: '+6 Power',                     cost: { metal: 60, rare: 15, chemicals: 10 }, cap: { power: -6 } },
  solar:     { name: 'Solar Array',      layers: ['orbit'],   desc: '+4 Power × the star\'s light',              cost: { metal: 40, electronics: 10 },          cap: { power: -4 }, solar: true },
  dome:      { name: 'Habitat',          layers: ['surface'], desc: '+5 Infrastructure (meals, air, bunks)',     cost: { metal: 30, electronics: 10 },          cap: { infra: -5, power: 1 } },
  ring:      { name: 'Habitat Ring',     layers: ['orbit'],   desc: '+6 Infrastructure',                         cost: { metal: 35, electronics: 15 },          cap: { infra: -6, power: 1 } },
  cogitator: { name: 'Datacenter',       layers: ['surface', 'orbit'], desc: '+4 Compute',                   cost: { metal: 40, electronics: 15, rare: 10 }, cap: { compute: -4, power: 2 } },
  // research, ships, defense
  lab:       { name: 'Research Lab',     layers: ['surface', 'orbit'], desc: '+2 Research',                  cost: { metal: 40, electronics: 10, chemicals: 5 }, cap: { power: 1, infra: 1, compute: 2 } },
  shipyard:  { name: 'Orbital Shipyard', layers: ['orbit'],   desc: 'Builds ships. Holds 10 ships in its hangar, +2 for every level after 1', cost: { metal: 60, electronics: 10 }, cap: { power: 2, infra: 1 } },
  finance:   { name: 'Finance District', layers: ['surface'], desc: '+0.05 Crypto Shards', crypto: 0.05,   cost: { metal: 80, electronics: 30, rare: 15 }, cap: { power: 2, infra: 2, compute: 1 } },
  bastion:   { name: 'Bastion',          layers: ['surface'], desc: '+25 garrison, fires on attackers',          cost: { metal: 50, chemicals: 10 },         cap: { power: 1 } },
  platform:  { name: 'Defense Platform', layers: ['orbit'],   desc: '+15 garrison, heavy fire on attackers',     cost: { metal: 60, electronics: 10, chemicals: 10 }, cap: { power: 2, compute: 1 } },
};

// Settling another planet in a system you already hold (no expedition needed). Grows with planets owned.
DATA.settleCost = { metal: 60, electronics: 20, chemicals: 10 };
DATA.settleGrowth = 1.2;

// ---------------------------------------------------------------------------------------------
// Ships are cards: every build rolls a type (within the size you chose), a rarity, stats and weapons.
// Sizes beat each other like rock-paper-scissors: Small beats Large, Large beats Medium, Medium beats Small.
DATA.sizes = {
  S: { name: 'Small',  beats: 'L', req: null,      cost: { metal: 30, electronics: 6 },                          weaponDmg: 5 },
  M: { name: 'Medium', beats: 'S', req: null,      cost: { metal: 70, electronics: 20, chemicals: 10 },          weaponDmg: 10 },
  L: { name: 'Large',  beats: 'M', req: null,      cost: { metal: 160, rare: 40, electronics: 50, chemicals: 30 }, weaponDmg: 18 },
};
DATA.sizeAdvantage = 1.5;    // damage multiplier against the size you beat
DATA.sizeDisadvantage = 0.7; // ... and against the size that beats you
// Battles are fought in lanes: each ship shoots the ship opposite, else the nearest one by this order of
// lane offsets (right, left, two right, two left, …). Shots at a ship that isn't opposite hit less often.
DATA.targetOrder = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
DATA.offLaneHit = 0.5;       // hit chance multiplier when the target is not in the opposite lane
// Big guns can't track small ships: hit chance multiplier when a Large ship fires at a Small one.
DATA.largeVsSmallHit = 0.6;

// There are no fixed stats: every ship rolls each stat from a normal distribution. The numbers below are the
// averages (means) of a Normal-rarity ship; DATA.statSpread sets how far a roll usually lands from it.
// shield and hull are life points (shield first); speed sets turn order; maneuver is the chance to evade (%);
// slots = weapon slots (1–3, fixed per type); upkeep = average Metals per Cycle (plus half that in Chemicals).
DATA.shipTypes = {
  scout:      { name: 'Scout',         size: 'S', shield: 8,  hull: 10,  speed: 9, maneuver: 30, slots: 1, upkeep: 0.2, desc: 'Fast and fragile: acts first, dodges often.' },
  fighter:    { name: 'Fighter',       size: 'S', shield: 10, hull: 14,  speed: 8, maneuver: 25, slots: 1, upkeep: 0.3, desc: 'Cheap, quick, hard to hit.' },
  heavy:      { name: 'Heavy Fighter', size: 'S', shield: 14, hull: 20,  speed: 6, maneuver: 18, slots: 2, upkeep: 0.5, desc: 'A fighter with a second gun and more armour.' },
  corvette:   { name: 'Corvette',      size: 'M', shield: 25, hull: 30,  speed: 6, maneuver: 12, slots: 2, upkeep: 0.8, desc: 'Fast for a line ship.' },
  frigate:    { name: 'Frigate',       size: 'M', shield: 35, hull: 40,  speed: 5, maneuver: 8,  slots: 2, upkeep: 1.0, desc: 'Solid all-round warship.' },
  gunboat:    { name: 'Gunboat',       size: 'M', shield: 25, hull: 45,  speed: 4, maneuver: 6,  slots: 3, upkeep: 1.2, desc: 'Slow, but carries three guns.' },
  destroyer:  { name: 'Destroyer',     size: 'L', shield: 60, hull: 70,  speed: 4, maneuver: 4,  slots: 3, upkeep: 2.0, desc: 'The quickest of the capital ships.' },
  battleship: { name: 'Battleship',    size: 'L', shield: 80, hull: 110, speed: 2, maneuver: 2,  slots: 3, upkeep: 2.6, desc: 'A cathedral of war. Slow to turn, slower to die.' },
  carrier:    { name: 'Carrier',       size: 'L', shield: 70, hull: 90,  speed: 3, maneuver: 3,  slots: 2, upkeep: 2.2, desc: 'A mothership; its hangars are still dark.' },
  // monsters: never built, only met
  lurker:     { name: 'Lurker',        size: 'S', shield: 0,  hull: 26,  speed: 7, maneuver: 22, slots: 1, upkeep: 0, monster: true, desc: 'Something from the dark.' },
  maw:        { name: 'Maw',           size: 'M', shield: 0,  hull: 70,  speed: 4, maneuver: 8,  slots: 2, upkeep: 0, monster: true, desc: 'All teeth, no eyes.' },
  leviathan:  { name: 'Leviathan',     size: 'L', shield: 20, hull: 160, speed: 2, maneuver: 1,  slots: 3, upkeep: 0, monster: true, desc: 'It has been asleep between the stars for a very long time.' },
  // a colony's Bastions and Defense Platforms fight as one card
  defense:    { name: 'Planetary Defenses', size: 'M', shield: 20, hull: 30, speed: 3, maneuver: 0, slots: 2, upkeep: 0, structure: true, desc: 'Bastions and Defense Platforms of the system.' },
};

// Spread of the normal distribution: standard deviation as a share of the mean (15 % = about two in three ships
// land within ±15 % of the average, almost all within ±45 %).
DATA.statSpread = { shield: 0.15, hull: 0.15, speed: 0.15, maneuver: 0.2, dmg: 0.15 };

// Rarity of a ship (and of a forged weapon). mult shifts the mean of every stat roll and of weapon damage.
DATA.shipRarities = {
  normal:    { name: 'Normal',    rate: 0.769, mult: 1.0,  color: '#a3a3a3' },
  strong:    { name: 'Strong',    rate: 0.20,  mult: 1.2,  color: '#4059ac' },
  epic:      { name: 'Epic',      rate: 0.02,  mult: 1.45, color: '#a060d0', extraSlot: true },
  legendary: { name: 'Legendary', rate: 0.01,  mult: 1.75, color: '#db8432', extraSlot: true },
  omega:     { name: 'Omega',     rate: 0.001, mult: 2.2,  color: '#440b11', extraSlot: true },
};

// Weapons: physical hits hull hard and bounces off shields; energy strips shields but barely scratches hull.
DATA.damageTypes = {
  physical: { name: 'Physical', icon: '▲', shield: 0.5, hull: 1.5, color: '#d09050' },
  energy:   { name: 'Energy',   icon: '◆', shield: 1.5, hull: 0.5, color: '#60b0e0' },
};
// dmg multiplies the size's base weapon damage; cd = turns to recharge after firing; acc = hit chance before evasion.
DATA.weaponModels = {
  autocannon: { name: 'Autocannon',       kind: 'physical', dmg: 1.0, cd: 0, acc: 95, weight: 4 },
  massdriver: { name: 'Mass Driver',      kind: 'physical', dmg: 1.6, cd: 1, acc: 85, weight: 3 },
  railgun:    { name: 'Railgun',          kind: 'physical', dmg: 2.4, cd: 2, acc: 80, weight: 2 },
  torpedo:    { name: 'Torpedo Rack',     kind: 'physical', dmg: 3.4, cd: 3, acc: 70, weight: 1 },
  pulse:      { name: 'Pulse Laser',      kind: 'energy',   dmg: 1.0, cd: 0, acc: 100, weight: 4 },
  ion:        { name: 'Ion Lance',        kind: 'energy',   dmg: 1.6, cd: 1, acc: 90, weight: 3 },
  plasma:     { name: 'Plasma Projector', kind: 'energy',   dmg: 2.4, cd: 2, acc: 80, weight: 2 },
  particle:   { name: 'Particle Beam',    kind: 'energy',   dmg: 3.4, cd: 3, acc: 75, weight: 1 },
  // monster and structure weapons
  claws:      { name: 'Rending Claws',    kind: 'physical', dmg: 1.3, cd: 0, acc: 90, weight: 0 },
  spit:       { name: 'Acid Spit',        kind: 'energy',   dmg: 1.8, cd: 1, acc: 85, weight: 0 },
  battery:    { name: 'Bastion Battery',  kind: 'physical', dmg: 1.4, cd: 0, acc: 90, weight: 0 },
  lance:      { name: 'Orbital Lance',    kind: 'energy',   dmg: 1.4, cd: 0, acc: 95, weight: 0 },
};

// Exploring and settling cost a flat fee instead of a ship. Both take one Cycle per hyperlane hop to arrive.
DATA.survey = { name: 'Survey probe', cost: { metal: 20, electronics: 5 }, desc: 'Charts an uncharted system next to known space.' };
DATA.colonize = { name: 'Colony expedition', cost: { metal: 60, electronics: 25, chemicals: 15 }, desc: 'Founds a colony on a planet you choose in a charted, unclaimed, unguarded system.' };
DATA.forge = { cost: { rare: 25, electronics: 15 }, desc: 'Forge a random weapon of the chosen size. Its rarity is rolled like a ship\'s.' };
// Raids on the Covenant (js/ai.js). No raids until the player has founded graceColonies colonies besides the
// capital; after that each living empire rolls chance × its aggression every Cycle, at most one raid underway
// per empire, and waits cooldown Cycles after launching one.
DATA.raids = { graceColonies: 3, chance: 0.025, cooldown: 12 };
DATA.battleFxMs = 2000;                    // how long MISS / RESTORED float over a card
DATA.restore = { shield: 0.25, hull: 0.1 }; // battle action Restore: part of max shields / hull regained
// Hangar: ships in no fleet wait at an Orbital Shipyard. Each shipyard holds `base` ships at level 1, plus
// `perLevel` for every level above 1; all shipyards add up.
DATA.hangar = { base: 10, perLevel: 2 };
DATA.fleetMax = 5;           // ships per fleet (and per side in battle)
DATA.repairPerCycle = 0.2;   // fraction of max hull repaired per Cycle for fleets at home
DATA.demolishRefund = 0.25;  // part of everything invested in a building (all levels) returned when it is demolished
DATA.scrapRefund = 0.3;      // part of the build cost returned when a ship is scrapped

// Ship colours. Ship sprites are grey templates (js/shipsprites.js) painted with these on the fly.
// Each entry is one base colour per material; the shades are derived from it (js/sprites.js). An entry can also be
// a full list of shades, dark to light (hull 7, metal 6, accent 5, glass 6, glow 2, halo 2, void 1, outline 1).
//   hull: main plating · metal: guns, engines, keel · accent: trim and stripes · glass: canopies and windows
//   glow: engine exhausts · halo: the glow around them
DATA.shipPalettes = {
  player:  { hull: '#d2c6aa', metal: '#5e5850', accent: '#c0592e', glass: '#5aa0b0', glow: '#ffb050', halo: '#ff7a30' },
  chorus:  { hull: '#a8b89c', metal: '#3e4a36', accent: '#6ca832', glass: '#c0a830', glow: '#a0ff60', halo: '#90e050' },
  remnant: { hull: '#a0a0a4', metal: '#3a3a42', accent: '#d05030', glass: '#d03020', glow: '#ff6030', halo: '#ff5020' },
  monster: { hull: '#b84850', metal: '#b4a688', accent: '#7a4070', glass: '#f0e040', glow: '#f0e040', halo: '#d0c030' },
};

// Grim names for new ships.
DATA.shipNames = ['Penitent', 'Ashborn', 'Last Rite', 'Mercy\'s End', 'Grave Hymn', 'Hollow Vow', 'Cinder Saint', 'Bitter Psalm', 'Iron Requiem', 'Pale Lantern',
  'Ossuary', 'Widowmaker', 'Remembrance', 'Silent Choir', 'Black Candle', 'Martyr', 'Dirge', 'Shroudwalker', 'Vigil', 'Absolution', 'Emberfall', 'Thornvow',
  'Lament', 'Sorrowblade', 'Grim Tithe', 'Final Oath', 'Cold Sermon', 'Kneeler', 'Starveling', 'Heretic\'s Debt', 'Reliquary', 'Gravewake', 'Nightwarden', 'Salt and Ash'];

// Research, paid in Research points. repeat:true techs can be researched forever with growing cost (incremental layer).
DATA.techs = {
  deepcore:   { name: 'Deep Core Extraction', cost: 30,  mods: { metal: 0.25 },     desc: '+25% Metals' },
  biovats:    { name: 'Bio-Vat Cultures',     cost: 40,  mods: { organics: 0.25 },  desc: '+25% Organics' },
  microfab:   { name: 'Microfabrication',     cost: 45,  mods: { electronics: 0.3 }, desc: '+30% Electronics from the same inputs' },
  catalysis:  { name: 'Reagent Catalysis',    cost: 45,  mods: { chemicals: 0.3 },  desc: '+30% Chemicals from the same inputs' },
  rationing:  { name: 'Ration Protocols',     cost: 50,  mods: { infra: 0.2 },      desc: '+20% Infrastructure' },
  gridreactors:{name: 'Reactor Litanies',     cost: 50,  mods: { power: 0.2 },      desc: '+20% Power' },
  prospect:   { name: 'Deep Prospecting',     cost: 65,  mods: { rare: 0.3 },       desc: '+30% Rare Minerals' },
  coldlogic:  { name: 'Cold Logic Engines',   cost: 65,  mods: { compute: 0.25 },   desc: '+25% Compute' },
  ossuary:    { name: 'Ossuary Indexing',     cost: 70,  mods: { research: 0.3 },   desc: '+30% Research' },
  bastionwalls:{name: 'Martyr Walls',         cost: 75,  mods: { bastion: 0.5 },    desc: '+50% Planetary Defenses strength' },
  plasmaweave:{ name: 'Plasma Weave',         cost: 80,  mods: { atk: 0.2 },        desc: '+20% weapon damage' },
  bonehulls:  { name: 'Bone-grown Hulls',     cost: 90,  mods: { hp: 0.25 },        desc: '+25% ship shields and hull' },
  forge:      { name: 'Forge Doctrine',       cost: 50,  mods: { metal: 0.1 },      desc: '+10% Metals per level', repeat: true, growth: 1.45 },
  harvest:    { name: 'Harvest Doctrine',     cost: 50,  mods: { organics: 0.1 },   desc: '+10% Organics per level', repeat: true, growth: 1.45 },
  arcology:   { name: 'Arcology Doctrine',    cost: 60,  mods: { infra: 0.08 },     desc: '+8% Infrastructure per level', repeat: true, growth: 1.5 },
  archives:   { name: 'Archive Doctrine',     cost: 60,  mods: { research: 0.1 },   desc: '+10% Research per level', repeat: true, growth: 1.5 },
};

// Factions. 'player' is you; others are AI. 'monster' are neutral horrors guarding systems.
DATA.factions = {
  player:  { name: 'The Last Covenant', color: '#d8c8a0', short: 'You' },
  chorus:  { name: 'The Chorus',        color: '#7fbf3f', short: 'Chorus', desc: 'A hive that sings across the void. It wants you to join the song.' },
  remnant: { name: 'Iron Remnant',      color: '#d06030', short: 'Remnant', desc: 'Ancient war-machines still following orders from a dead empire.' },
  monster: { name: 'Lurkers',           color: '#8a2a3a', short: 'Lurkers' },
};

// Exploration events. effect(G, ctx) mutates the game and returns a log line.
DATA.events = {
  derelict: {
    title: 'Derelict Hulk',
    text: 'A dead warship drifts here. Its crew are fused into the walls, and some of them are still breathing.',
    choices: [
      { label: 'Strip it for salvage', effect: (G, c) => {
        G.res.metal += 50;
        if (Math.random() < 0.3) { G.res.metal -= 20; return 'Salvage recovered (+30 Metals net). Something followed the salvage crew back; the cargo bay had to be vented.'; }
        return 'Salvage recovered (+50 Metals). The breathing stopped when the reactor was cut.';
      } },
      { label: 'Leave it to the dark', effect: () => 'You leave the hulk behind. The breathing is in the comm logs now.' },
    ],
  },
  signal: {
    title: 'A Voice in the Static',
    text: 'On every channel, a voice repeats the names of your crew, including some who have not been born yet.',
    choices: [
      { label: 'Listen', effect: (G) => {
        if (Math.random() < 0.35) { G.res.research = Math.max(0, G.res.research - 30); return 'You listen. Three archivists clawed out their eyes. −30 Research.'; }
        G.res.research += 25;
        return 'You listen (+25 Research). It knows you now.';
      } },
      { label: 'Burn the receiver', effect: () => 'The receiver is burned. The voice keeps speaking on a frequency you no longer have.' },
    ],
  },
  ruins: {
    title: 'Ruins Older Than Stars',
    text: 'Cyclopean structures cover the planet. The geometry hurts to look at.',
    choices: [
      { label: 'Excavate', effect: (G) => { G.res.research += 30; G.res.rare += 20; return 'Excavation complete (+30 Research, +20 Rare Minerals). The dig team will not say what they saw.'; } },
      { label: 'Seal it away', effect: () => 'The ruins are sealed under ferrocrete. Sometimes the seal is warm.' },
    ],
  },
  survivors: {
    title: 'Survivors',
    text: 'A crippled transport carries the last survivors of a fallen colony. They beg for rescue.',
    choices: [
      { label: 'Take them in', effect: (G) => { G.res.organics = Math.max(0, G.res.organics - 25); G.res.research += 15; return 'The survivors are taken aboard (−25 Organics to feed them). Their archives come with them (+15 Research). Their prayers seem to reach something.'; } },
      { label: 'Strip their vessel', effect: (G) => { G.res.metal += 50; G.res.chemicals += 15; return 'Their vessel is stripped (+50 Metals, +15 Chemicals). The transport goes dark. Nobody speaks of it.'; } },
    ],
  },
  cache: {
    title: 'Hidden Cache',
    text: 'A sealed vault, marked with the sigil of an empire that no longer exists.',
    choices: [
      { label: 'Crack it open', effect: (G) => { G.res.rare += 25; G.res.electronics += 20; return 'The vault is cracked open (+25 Rare Minerals, +20 Electronics).'; } },
    ],
  },
};

DATA.names = {
  pre:  ['Mor', 'Thal', 'Vex', 'Ossu', 'Kar', 'Nihl', 'Gol', 'Sep', 'Ul', 'Drath', 'Ash', 'Cren', 'Hesk', 'Iro', 'Lith', 'Myr', 'Pyr', 'Skel', 'Tor', 'Varn', 'Zeth', 'Grav', 'Bel', 'Quor'],
  mid:  ['', '', 'a', 'o', 'u', 'e', 'i'],
  post: ['mund', 'gora', 'thas', 'rax', 'cyr', 'veil', 'nox', 'grim', 'dun', 'sorrow', 'kesh', 'mor', 'ath', 'ius', 'ul'],
  suffix: ['', '', '', ' Prime', ' IV', ' VII', ' Secundus', "'s Grave", ' Reach', ' Hollow'],
};

// Building costs rise with level, to reward expanding wide (more colonies) over building tall:
// up to softCap each level costs perLevel more of the base price; past it, each level multiplies by expBase.
//   level:  1     2      3     4      5     6     7      8
//   cost:   1×    1.15×  1.3×  1.45×  1.6×  3.2×  6.4×   12.8×   (× the colony's habitability multiplier)
DATA.levelCost = { perLevel: 0.15, softCap: 5, expBase: 2 };

// The galaxy has no edge: it is generated in square chunks as it is explored (js/galaxy.js).
DATA.galaxy = {
  chunk: 160,              // chunk size in world units (1 unit = 1 map pixel at zoom 1)
  perChunk: [4, 6],        // systems per chunk
  minDist: 44,             // minimum distance between systems
  extraLane: 95,           // extra hyperlanes only between systems closer than this
  growRadius: 1,           // chunks generated around every charted system (1 = the 3x3 around it)
  alienDistance: [520, 680], // how far out the two alien empires lie from home
  lairFrom: 0.3,           // monster lairs start at this danger (distance from home / alienDistance[0])
  lairChance: 0.22, lairMax: 0.4,
};

DATA.config = {
  offlineSecondsPerCycle: 60,
  offlineMaxCycles: 120,
  offlineEfficiency: 0.5,
  saveKey: 'voyager_save_v15',
};

// ---------- Tutorial ----------
// Shown once, on the first game in a browser (Settings → Replay tutorial shows it again).
// screen: the screen to open; target: CSS selector of what to outline (all: true outlines every match);
// prepare: a named setup step in js/tutorial.js. {survey} and {colonize} become the live costs.
DATA.tutorial = [
  { screen: 'map', title: 'Wake up, Commander',
    text: 'The Ark has crossed the dark and found a new galaxy. The frozen faithful sleep in its holds, and all you hold is a single star system.<br><br>Out there are two xeno empires: <b style="color:#7fbf3f">The Chorus</b> and the <b style="color:#d06030">Iron Remnant</b>. Take every world they hold to win. Lose all of yours and the Covenant ends.<br><br>This short tour shows you around. You can skip it at any time.' },
  { target: '#top-res', title: 'Resources',
    text: 'Your stores, with the change per Cycle next to them. <b>Metals</b>, <b>Rare Minerals</b> and <b>Organics</b> are gathered; <b>Electronics</b> and <b>Chemicals</b> are refined from them. <b>Research</b> unlocks technology. <b>Crypto Shards</b> ◈, mined in tiny amounts by Finance Districts, are an interstellar currency for trade.<br><br>On the right are your capacities, shown as used / available: <b>Power</b>, <b>Infrastructure</b> and <b>Compute</b>. Every building uses some. If you use more than you have, all production is rationed.<br><br>Point at any of them (or tap it) for details.' },
  { target: '#btn-end', title: 'Cycles',
    text: 'Time moves in Cycles. <b>End Cycle</b> (or Space / Enter) advances one: colonies produce, missions travel, research progresses and the xenos make their moves.<br><br>Nothing happens until you end the Cycle, so take your time.' },
  { screen: 'map', target: '#mapcanvas', title: 'The Star Map',
    text: 'Your home system has bright brackets around it. Drag to look around; scroll or pinch to zoom. The buttons on the right zoom, jump home (⌂) and centre on the selected system; the minimap in the corner shows all you have charted.<br><br>A <b>?</b> is a system no one has charted. The galaxy has no edge: it grows as you explore.' },
  { screen: 'map', prepare: 'uncharted', target: '.mapscreen .side', title: 'Explore and expand',
    text: 'Click a system to select it. This panel shows what you can do there; double-click a charted system (or use <b>Open solar system</b>) to see its star and planets on the <b>Solar System</b> screen.<br><br>A <b>survey probe</b> ({survey}) charts an unknown system next to known space. A <b>colony expedition</b> ({colonize}) founds a colony on a planet you choose in a charted, unclaimed system: pick it in the panel\'s planet list (<b>Send colonists</b>). Systems with coloured flags next to them are guarded: send a fleet to clear them first.' },
  { screen: 'colonies', target: '#main .csys', title: 'Colonies',
    text: 'Every colony in every system you hold. Click a colony to open it. Unsettled planets in your own systems can be settled right here, with no travel needed.<br><br>Each planet has a <b>surface</b> and an <b>orbit</b> layer, each with its own building slots. The more habitable a planet, the cheaper it is to build there.' },
  { screen: 'buildings', target: '#main .brow', title: 'Buildings',
    text: 'Every building type in one list. <b>Auto</b> builds where it gives the most for the price; click a row to choose the colony yourself.<br><br>Each level costs more, and from level 6 the price doubles every level, so <b>go wide</b>: found new colonies instead of stacking towers. The red <b>✕</b> demolishes a building and gives back a quarter of what it cost.' },
  { screen: 'research', target: '#main .panel', title: 'Research',
    text: 'Research Labs produce Research. Spend it here on lasting advantages: richer yields, more Power, stronger ships and better defenses. Pick one project and it advances every Cycle. Doctrines can be researched again and again, each level costing more.' },
  { screen: 'shipyard', target: '#main .buildtile, #main .panel', title: 'Shipyard',
    text: 'You need an <b>Orbital Shipyard</b> in orbit around one of your planets. Then choose a hull: <b>Small</b>, <b>Medium</b> or <b>Large</b>, all available from the start. The exact type, stats and weapons are rolled, from Normal up to a one-in-a-thousand <b>Omega</b>.<br><br>Small beats Large, Large beats Medium, and Medium beats Small.' },
  { screen: 'fleets', target: '#main .panel', title: 'Hangar and fleets',
    text: 'Ships fight in fleets of up to five; drag a ship onto a fleet slot to set its lane, or into the hangar. The hangar holds the ships in no fleet: {hangar} per Orbital Shipyard, +2 per shipyard level, and you can sort it. From the Star Map you send a fleet to clear a guarded system or to strike a xeno world. Keep a fleet at home: when <b style="color:#ff5a4a">! RAID</b> appears on the map, something is coming for one of your colonies.<br><br>The xenos ignore you at first. Raids only begin once you have founded <b>{grace}</b> colonies besides your capital.' },
  { target: '.nav-btn[data-a="battle"]', nav: true, title: 'Battle',
    text: 'Battles are fought in turns, ship by ship, five lanes a side. Ships fire at the ship opposite them. If that lane is empty they fire at the next one, with a heavy penalty to hit. On a ship\'s turn you can fire, <b>move</b> it to another lane (the ships in between slide over) or <b>Restore</b> some of its shields and hull. <b>Auto</b> fights for you.<br><br>While a fight is on, <b>End Cycle</b> is locked. Once it is over, end the Cycle or open another screen to move on.' },
  { target: '.nav-btn[data-a="settings"]', nav: true, title: 'The void is listening',
    text: 'That is all you need to begin. Survey the systems around you, found a second colony and build up your empire. Everything that happens is written in the <b>Chronicle</b>, in the menu.<br><br>You can replay this tour in <b>Settings</b>. Good luck, Commander.' },
];

