// Voyager — ships as cards: the build gacha, weapons, the hangar, the armory and global fleets.
//
// G.ships   { id: ship }          every ship the Covenant owns
// G.fleets  [{ id, name, ships: [shipId…], mission }]   up to DATA.fleetMax ships each; ships in no fleet sit in the hangar
// G.armory  [weapon]               spare weapons (from scrapped ships, wrecks and the forge)
// Enemy ships (monster lairs, alien garrisons and raids) are the same objects, stored with their owner.

const Ships = {
  // ---------- rolling ----------
  rollRarity(bias = 0) {
    // bias > 0 shifts the odds toward better rarities (used for alien ships late in the game)
    const list = Object.entries(DATA.shipRarities).reverse(); // omega first
    const r = Math.random();
    let acc = 0;
    for (const [k, d] of list) {
      acc += d.rate * (k === 'normal' ? 1 : 1 + bias);
      if (r < acc) return k;
    }
    return 'normal';
  },

  // One stat roll: a normal distribution around the mean, its spread a share of the mean (DATA.statSpread).
  roll(mean, key) { return mean > 0 ? U.gauss(mean, mean * DATA.statSpread[key]) : 0; },

  // A weapon for a ship of the given size. kindBias: 'physical' | 'energy' | null.
  makeWeapon(size, rarity = 'normal', kindBias = null, modelKey = null) {
    if (!modelKey) {
      const pool = Object.entries(DATA.weaponModels).filter(([, m]) => m.weight > 0 && (!kindBias || Math.random() < 0.25 || m.kind === kindBias));
      const total = pool.reduce((a, [, m]) => a + m.weight, 0);
      let r = Math.random() * total;
      modelKey = pool[pool.length - 1][0];
      for (const [k, m] of pool) { r -= m.weight; if (r <= 0) { modelKey = k; break; } }
    }
    const m = DATA.weaponModels[modelKey], rar = DATA.shipRarities[rarity];
    return {
      id: 'w' + (G.nextWeaponId++), model: modelKey, name: m.name, kind: m.kind, size, rarity,
      dmg: Math.max(1, Math.round(this.roll(DATA.sizes[size].weaponDmg * m.dmg * rar.mult, 'dmg'))),
      cd: m.cd, acc: m.acc,
    };
  },

  // A grim name no Covenant ship carries right now (numbered once all are taken).
  freshName() {
    const used = new Set(Object.values(G.ships || {}).map((s) => s.name));
    const free = DATA.shipNames.filter((n) => !used.has(n));
    if (free.length) return U.pick(free);
    let n = 2, base = U.pick(DATA.shipNames);
    while (used.has(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  },

  // A new ship card. opts: { rarity, owner, kindBias, bias }
  make(type, opts = {}) {
    const t = DATA.shipTypes[type], rarity = opts.rarity || this.rollRarity(opts.bias || 0);
    const rar = DATA.shipRarities[rarity], mult = rar.mult;
    const slots = Math.min(3, t.slots + (rar.extraSlot ? 1 : 0));
    // Every stat is rolled from a normal distribution around the type's average, shifted up by rarity.
    const mean = {
      shield: t.shield * mult, hull: t.hull * mult,
      speed: t.speed * (1 + (mult - 1) * 0.5), maneuver: t.maneuver * (1 + (mult - 1) * 0.5),
    };
    const r = {
      shield: Math.max(0, Math.round(this.roll(mean.shield, 'shield'))),
      hull: Math.max(1, Math.round(this.roll(mean.hull, 'hull'))),
      speed: Math.max(1, Math.round(this.roll(mean.speed, 'speed'))),
      maneuver: Math.max(0, Math.min(60, Math.round(this.roll(mean.maneuver, 'maneuver')))),
    };
    // quality: how this ship compares with the average of its type and rarity (100 = average)
    const parts = Object.keys(mean).filter((k) => mean[k] > 0).map((k) => r[k] / mean[k]);
    const quality = parts.reduce((a, b) => a + b, 0) / parts.length;
    const ship = {
      id: 's' + (G.nextShipId++), type, size: t.size, rarity, owner: opts.owner || 'player',
      name: opts.name || (t.monster || t.structure ? t.name : this.freshName()),
      shield: r.shield, hull: r.hull, speed: r.speed, maneuver: r.maneuver,
      quality: Math.round(quality * 100),
      upkeep: 0, // set below (rollUpkeep)
      weapons: [],
      variant: U.randInt(0, Sprites.shipVariants(type) - 1),   // which of the type's designs it looks like
      built: G.cycle,
      upkeepRoll: Math.max(0.7, Math.min(1.3, U.gauss(1, DATA.upkeep.spread))),   // its personal share of the randomness
    };
    ship.hullNow = ship.hull;
    if (t.monster) for (let i = 0; i < slots; i++) ship.weapons.push(this.makeWeapon(t.size, rarity, null, i % 2 ? 'spit' : 'claws'));
    else for (let i = 0; i < slots; i++) ship.weapons.push(this.makeWeapon(t.size, rarity, opts.kindBias));
    ship.upkeep = this.rollUpkeep(ship);
    return ship;
  },

  // Planetary Defenses card for a system (Bastions and Defense Platforms), or null if it has none.
  defenseCard(s) {
    let bastion = 0, platform = 0;
    for (const p of s.planets) if (p.colony) { bastion += p.colony.surface.bastion || 0; platform += p.colony.orbit.platform || 0; }
    // the Covenant's capital keeps the guns of the old Ark-fleet: it always counts one level of each
    if (s.owner === 'player' && s.planets.some((p) => p.colony && p.colony.capital)) { bastion++; platform++; }
    if (!bastion && !platform) return null;
    const m = s.owner === 'player' ? State.mods().bastion : 1 + G.cycle / 100;
    const d = this.make('defense', { rarity: 'normal', owner: s.owner, name: 'Defenses of ' + s.name });
    d.weapons = [];
    d.shield = Math.round((10 + 18 * platform) * m);
    d.hull = d.hullNow = Math.round((20 + 30 * bastion) * m);
    if (bastion) { const w = this.makeWeapon('M', 'normal', null, 'battery'); w.dmg = Math.round(w.dmg * (0.8 + 0.25 * bastion) * m); d.weapons.push(w); }
    if (platform) { const w = this.makeWeapon('M', 'normal', null, 'lance'); w.dmg = Math.round(w.dmg * (0.8 + 0.25 * platform) * m); d.weapons.push(w); }
    return d;
  },

  // ---------- reading ----------
  get(id) { return G.ships[id]; },
  all() { return Object.values(G.ships); },
  fleetOf(id) { return G.fleets.find((f) => f.ships.includes(id)) || null; },
  hangar() { return this.all().filter((s) => !this.fleetOf(s.id)); },
  // Hangar space: DATA.hangar per Orbital Shipyard (more with each level), summed over all your shipyards.
  hangarCap() { return Colonies.yards().reduce((a, { p }) => a + DATA.hangar.base + DATA.hangar.perLevel * (p.colony.orbit.shipyard - 1), 0); },
  hangarFree() { return this.hangarCap() - this.hangar().length; },
  fleet(id) { return G.fleets.find((f) => f.id === id); },
  fleetShips(f) { return f.ships.map((id) => G.ships[id]).filter(Boolean); },
  idleFleets() { return G.fleets.filter((f) => !f.mission && f.ships.length); },
  // A rough strength number for one ship / a group (shown on cards and fleets; also used by the AI).
  power(s) {
    const dmg = s.weapons.reduce((a, w) => a + w.dmg / (1 + w.cd * 0.6), 0);
    return Math.round((s.shield + s.hull) * 0.25 + dmg * 2 + s.speed);
  },
  groupPower(list) { return list.reduce((a, s) => a + this.power(s), 0); },
  // ---- officers (DATA.officers): one per fleet, stored as fleet.officer ----
  officers() { return Object.keys(DATA.officers).filter((k) => G.officers && G.officers[k]); },
  officerFleet(key) { return G.fleets.find((f) => f.officer === key) || null; },
  // Put an officer in charge of a fleet (taking it from another fleet if needed). Fleets on a mission can't change.
  assignOfficer(key, fleetId) {
    const f = this.fleet(+fleetId), from = this.officerFleet(key);
    if (!f || !G.officers[key] || f.mission || (from && from.mission)) return false;
    if (from) from.officer = null;
    f.officer = key;
    Log.add(`${DATA.officers[key].rank} ${DATA.officers[key].name} takes command of ${f.name}.`);
    return true;
  },
  unassignOfficer(fleetId) {
    const f = this.fleet(+fleetId);
    if (!f || f.mission || !f.officer) return false;
    f.officer = null;
    return true;
  },

  upkeep() { return this.all().reduce((a, s) => a + s.upkeep, 0) * Math.max(0, State.mods().upkeep); }, // research can lower it
  // Upkeep of one ship from its type, rarity, roll quality and personal random factor (DATA.upkeep).
  rollUpkeep(ship) {
    const t = DATA.shipTypes[ship.type], u = DATA.upkeep, mult = DATA.shipRarities[ship.rarity].mult;
    if (ship.upkeepRoll == null) ship.upkeepRoll = Math.max(0.7, Math.min(1.3, U.gauss(1, u.spread)));
    const v = t.upkeep * u.scale * Math.pow(mult, u.rarityExp) * Math.pow((ship.quality || 100) / 100, u.qualityExp) * ship.upkeepRoll;
    return Math.round(v * 100) / 100;
  },
  unlocked(size) { const req = DATA.sizes[size].req; return !req || Research.level(req) > 0; },

  // ---------- building (the gacha) ----------
  // A hull's price: DATA.sizes (shipyard levels don't make ships cheaper; they add hangar space).
  buildCost(size) { return State.cost(DATA.sizes[size].cost); },
  blocker(size) {
    if (!Colonies.yards().length) return 'No Orbital Shipyard';
    if (!this.unlocked(size)) return 'Requires ' + DATA.techs[DATA.sizes[size].req].name;
    if (!Colonies.canAfford(this.buildCost(size))) return 'Not enough resources';
    if (this.hangarFree() <= 0 && !this.roomyFleet()) return 'Hangar full';
    return null;
  },
  // A fleet at home that has ships and room for one more (new ships join it instead of the hangar).
  roomyFleet() { return G.fleets.find((x) => !x.mission && x.ships.length < DATA.fleetMax && x.ships.length) || null; },
  build(size) {
    if (this.blocker(size)) return null;
    Colonies.pay(this.buildCost(size));
    const types = Object.keys(DATA.shipTypes).filter((k) => DATA.shipTypes[k].size === size && !DATA.shipTypes[k].monster && !DATA.shipTypes[k].structure);
    const ship = this.make(U.pick(types));
    G.ships[ship.id] = ship;
    // straight into a fleet at home that has room, otherwise the hangar
    const f = this.roomyFleet();
    if (f) f.ships.push(ship.id);
    const rar = DATA.shipRarities[ship.rarity];
    Log.add(`${rar.name} ${DATA.shipTypes[ship.type].name} "${ship.name}" leaves the slipway${f ? ` and joins ${f.name}` : ''}.`, ship.rarity === 'normal' ? '' : ship.rarity === 'strong' ? 'good' : 'mythic');
    // Auto scrap: a new ship that matches the filter goes straight to the breakers
    const sf = this.scrapFilter();
    if (sf.auto && this.scrapMatches(ship, Object.assign({}, sf, { fleets: true }))) { this.scrapMany([ship.id]); ship.scrapped = true; }
    return ship;
  },

  forge(size) {
    if (!this.unlocked(size) || !Colonies.canAfford(State.cost(DATA.forge.cost))) return null;
    Colonies.pay(State.cost(DATA.forge.cost));
    const w = this.makeWeapon(size, this.rollRarity());
    G.armory.push(w);
    Log.add(`The forge spits out a ${DATA.shipRarities[w.rarity].name} ${w.name} (${DATA.sizes[size].name}).`, w.rarity === 'normal' ? '' : 'good');
    return w;
  },

  // ---------- fleets ----------
  newFleet(name) {
    const f = { id: G.nextFleetId++, name: name || this.fleetName(), ships: [], mission: null };
    G.fleets.push(f);
    return f;
  },
  fleetName() {
    const used = new Set(G.fleets.map((f) => f.name));
    const names = ['Home Guard', 'Ash Lance', 'Pathfinder', 'Grey Vigil', 'Bone Choir', 'Penance', 'Ember Host', 'Cold Hand', 'Last Light', 'Tithe', 'Requiem'];
    return names.find((n) => !used.has(n)) || 'Battlegroup ' + G.nextFleetId;
  },
  // Move a ship into a fleet (or the hangar with fleetId null). Fleets on a mission can't change.
  assign(shipId, fleetId) {
    const ship = G.ships[shipId], from = this.fleetOf(shipId);
    if (!ship || (from && from.mission)) return false;
    const to = fleetId == null ? null : this.fleet(fleetId);
    if (to && (to.mission || to.ships.length >= DATA.fleetMax)) return false;
    if (!to && from && this.hangarFree() <= 0) return false; // no room in the hangar
    if (from) from.ships = from.ships.filter((id) => id !== shipId);
    if (to) to.ships.push(shipId);
    this.cleanup();
    return true;
  },
  // Drag and drop: put a ship at a position in a fleet (its lane), pushing the others along; within its own
  // fleet this reorders. fleetId null = the hangar.
  place(shipId, fleetId, pos) {
    const from = this.fleetOf(shipId);
    if (fleetId == null) return from ? this.assign(shipId, null) : true; // already in the hangar
    const to = this.fleet(fleetId);
    if (!G.ships[shipId] || !to || to.mission || (from && from.mission)) return false;
    if (from !== to && to.ships.length >= DATA.fleetMax) return false;
    if (from) from.ships = from.ships.filter((id) => id !== shipId);
    to.ships.splice(Math.max(0, Math.min(pos, to.ships.length)), 0, shipId);
    this.cleanup();
    return true;
  },
  cleanup() {
    for (const f of G.fleets) f.ships = f.ships.filter((id) => G.ships[id]);
    G.fleets = G.fleets.filter((f) => f.ships.length || f.keep);
  },
  // Move a ship one place left (-1) or right (+1) in its fleet: its position is its lane in battle.
  shift(shipId, dir) {
    const f = this.fleetOf(shipId);
    if (!f || f.mission) return false;
    const i = f.ships.indexOf(shipId), j = i + dir;
    if (j < 0 || j >= f.ships.length) return false;
    [f.ships[i], f.ships[j]] = [f.ships[j], f.ships[i]];
    return true;
  },
  rename(fleetId, name) { const f = this.fleet(fleetId); if (f && name) f.name = name.slice(0, 24); },

  // ---------- weapons ----------
  // Swap a ship's weapon slot with a weapon from the armory (same size). armoryIdx -1 = just take it off.
  fit(shipId, slot, weaponId) {
    const ship = G.ships[shipId], f = this.fleetOf(shipId);
    if (!ship || (f && f.mission)) return false;
    const i = G.armory.findIndex((w) => w.id === weaponId);
    if (i < 0 || G.armory[i].size !== ship.size) return false;
    const [w] = G.armory.splice(i, 1);
    if (ship.weapons[slot]) G.armory.push(ship.weapons[slot]);
    ship.weapons[slot] = w;
    return true;
  },
  slotCount(ship) {
    const t = DATA.shipTypes[ship.type];
    return Math.min(3, t.slots + (DATA.shipRarities[ship.rarity].extraSlot ? 1 : 0));
  },

  // Scrap a ship: its weapons go to the armory and part of a build cost comes back.
  scrap(shipId) {
    const ship = G.ships[shipId], f = this.fleetOf(shipId);
    if (!ship || (f && f.mission)) return false;
    for (const w of ship.weapons) if (w) G.armory.push(w);
    const cost = this.buildCost(ship.size);
    for (const k in cost) G.res[k] += Math.floor(cost[k] * DATA.scrapRefund);
    delete G.ships[shipId];
    this.cleanup();
    Log.add(`"${ship.name}" is broken up for parts. Its weapons go to the armory.`);
    return true;
  },

  // ---------- auto scrap ----------
  // The filter (saved in G.scrapFilter): rarity = highest rarity to scrap (Omega never), sizes, quality = only
  // rolls below this (0 = any), fleets = also ships in fleets at home, auto = scrap new matching ships on build.
  scrapFilter() {
    if (!G.scrapFilter) G.scrapFilter = { rarity: 'normal', sizes: ['S', 'M', 'L'], quality: 0, fleets: false, auto: false };
    return G.scrapFilter;
  },
  scrapMatches(ship, f = this.scrapFilter()) {
    const order = Object.keys(DATA.shipRarities), fl = this.fleetOf(ship.id);
    if (ship.rarity === 'omega' || order.indexOf(ship.rarity) > order.indexOf(f.rarity)) return false;
    if (!f.sizes.includes(ship.size)) return false;
    if (f.quality && !(ship.quality < f.quality)) return false;
    if (fl && (!f.fleets || fl.mission)) return false;
    return true;
  },
  scrapList() { return this.all().filter((s) => this.scrapMatches(s)); },
  // What scrapping these ships would give back.
  scrapRefund(ships) {
    const out = {};
    for (const s of ships) for (const [k, v] of Object.entries(this.buildCost(s.size))) out[k] = (out[k] || 0) + Math.floor(v * DATA.scrapRefund);
    return out;
  },
  // Scrap many ships at once, with one line in the Chronicle.
  scrapMany(ids) {
    const ships = ids.map((id) => G.ships[id]).filter(Boolean), refund = this.scrapRefund(ships);
    let n = 0;
    for (const s of ships) {
      const f = this.fleetOf(s.id);
      if (f && f.mission) continue;
      for (const w of s.weapons) if (w) G.armory.push(w);
      delete G.ships[s.id];
      n++;
    }
    for (const k in refund) G.res[k] += refund[k];
    this.cleanup();
    if (n) Log.add(`${n} ship${n > 1 ? 's are' : ' is'} broken up for parts (+${Object.entries(refund).map(([k, v]) => `${v} ${DATA.resources[k].name}`).join(', ')}). Their weapons go to the armory.`);
    return n;
  },

  // An event or disaster takes one ship of a fleet. Returns true if a ship was lost.
  loseRandom(fleetId) {
    const f = this.fleet(fleetId);
    if (!f || !f.ships.length) return false;
    delete G.ships[U.pick(f.ships)];
    this.cleanup();
    return true;
  },

  // Fleets at home repair their hulls each Cycle.
  // ---- in maintenance (DATA.maintenance): fleet.maint = Cycles left ----
  inMaint(f) { return !!f && (f.maint || 0) > 0; },
  // Cycles of maintenance for a battle in which the fleet lost `lostFrac` of its total hull.
  maintCycles(lostFrac) {
    const M = DATA.maintenance;
    const n = M.base + Math.floor(Math.max(0, lostFrac) / M.per + 1e-9);
    return Math.max(M.base, Math.min(M.max, Math.min(M.max, n) + (M.diff[G.difficulty] || 0)));
  },
  // Once per Cycle, before new battles: every fleet in maintenance gets one Cycle closer to ready.
  tickMaint() { for (const f of G.fleets) if (f.maint > 0) f.maint--; },
  // Rested fleets first, then the strongest.
  byReadiness(fleets) { return [...fleets].sort((a, b) => (this.inMaint(a) - this.inMaint(b)) || this.groupPower(this.fleetShips(b)) - this.groupPower(this.fleetShips(a))); },

  repair() {
    if (G.unpaid) return; // no upkeep, no repairs
    for (const s of this.all()) {
      const f = this.fleetOf(s.id);
      if (f && f.mission) continue;
      s.hullNow = Math.min(s.hull, s.hullNow + Math.ceil(s.hull * DATA.repairPerCycle * State.mods().repair));
    }
  },
};
