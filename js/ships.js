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

  vary() { return U.rand(0.9, 1.1); },

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
      dmg: Math.max(1, Math.round(DATA.sizes[size].weaponDmg * m.dmg * rar.mult * this.vary())),
      cd: m.cd, acc: m.acc,
    };
  },

  // A new ship card. opts: { rarity, owner, kindBias, bias }
  make(type, opts = {}) {
    const t = DATA.shipTypes[type], rarity = opts.rarity || this.rollRarity(opts.bias || 0);
    const rar = DATA.shipRarities[rarity], mult = rar.mult;
    const slots = Math.min(3, t.slots + (rar.extraSlot ? 1 : 0));
    const ship = {
      id: 's' + (G.nextShipId++), type, size: t.size, rarity, owner: opts.owner || 'player',
      name: opts.name || (t.monster || t.structure ? t.name : U.pick(DATA.shipNames)),
      shield: Math.round(t.shield * mult * this.vary()),
      hull: Math.max(1, Math.round(t.hull * mult * this.vary())),
      speed: Math.max(1, Math.round(t.speed * (1 + (mult - 1) * 0.5) * this.vary())),
      maneuver: Math.min(60, Math.round(t.maneuver * (1 + (mult - 1) * 0.5))),
      upkeep: Math.round(t.upkeep * (1 + (mult - 1) * 0.8) * 100) / 100,
      weapons: [],
      built: G.cycle,
    };
    ship.hullNow = ship.hull;
    if (t.monster) for (let i = 0; i < slots; i++) ship.weapons.push(this.makeWeapon(t.size, rarity, null, i % 2 ? 'spit' : 'claws'));
    else for (let i = 0; i < slots; i++) ship.weapons.push(this.makeWeapon(t.size, rarity, opts.kindBias));
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
  fleet(id) { return G.fleets.find((f) => f.id === id); },
  fleetShips(f) { return f.ships.map((id) => G.ships[id]).filter(Boolean); },
  idleFleets() { return G.fleets.filter((f) => !f.mission && f.ships.length); },
  hasScout(f) { return this.fleetShips(f).some((s) => DATA.shipTypes[s.type].scout); },
  // A rough strength number for one ship / a group (shown on cards and fleets; also used by the AI).
  power(s) {
    const dmg = s.weapons.reduce((a, w) => a + w.dmg / (1 + w.cd * 0.6), 0);
    return Math.round((s.shield + s.hull) * 0.25 + dmg * 2 + s.speed);
  },
  groupPower(list) { return list.reduce((a, s) => a + this.power(s), 0); },
  upkeep() { return this.all().reduce((a, s) => a + s.upkeep, 0); },
  unlocked(size) { const req = DATA.sizes[size].req; return !req || Research.level(req) > 0; },

  // ---------- building (the gacha) ----------
  buildCost(size) {
    const yard = Math.max(0, ...Colonies.yards().map(({ p }) => p.colony.orbit.shipyard || 0));
    const disc = Math.max(0.6, 1 - 0.05 * (yard - 1));
    const out = {};
    for (const k in DATA.sizes[size].cost) out[k] = Math.ceil(DATA.sizes[size].cost[k] * disc);
    return out;
  },
  blocker(size) {
    if (!Colonies.yards().length) return 'No Orbital Shipyard';
    if (!this.unlocked(size)) return 'Requires ' + DATA.techs[DATA.sizes[size].req].name;
    if (!Colonies.canAfford(this.buildCost(size))) return 'Not enough resources';
    return null;
  },
  build(size) {
    if (this.blocker(size)) return null;
    Colonies.pay(this.buildCost(size));
    const types = Object.keys(DATA.shipTypes).filter((k) => DATA.shipTypes[k].size === size && !DATA.shipTypes[k].monster && !DATA.shipTypes[k].structure);
    const ship = this.make(U.pick(types));
    G.ships[ship.id] = ship;
    // straight into a fleet at home that has room, otherwise the hangar
    const f = G.fleets.find((x) => !x.mission && x.ships.length < DATA.fleetMax && !x.ships.some((id) => DATA.shipTypes[G.ships[id].type].scout) && x.ships.length);
    if (f) f.ships.push(ship.id);
    const rar = DATA.shipRarities[ship.rarity];
    Log.add(`${rar.name} ${DATA.shipTypes[ship.type].name} "${ship.name}" leaves the slipway${f ? ` and joins ${f.name}` : ''}.`, ship.rarity === 'normal' ? '' : ship.rarity === 'strong' ? 'good' : 'mythic');
    return ship;
  },

  arkCost() { return Object.assign({}, DATA.ark.cost); },
  buildArk() {
    if (!Colonies.yards().length || !Colonies.canAfford(this.arkCost())) return false;
    Colonies.pay(this.arkCost());
    G.arks++;
    Log.add('A Colony Ark is consecrated. Ten thousand sleepers wait in its holds.');
    return true;
  },

  forge(size) {
    if (!this.unlocked(size) || G.res.shards < DATA.forge.cost.shards) return null;
    G.res.shards -= DATA.forge.cost.shards;
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
    const names = ['Home Guard', 'Pathfinder', 'Wayseeker', 'Ash Lance', 'Grey Vigil', 'Bone Choir', 'Penance', 'Ember Host', 'Cold Hand', 'Last Light', 'Tithe', 'Requiem'];
    return names.find((n) => !used.has(n)) || 'Battlegroup ' + G.nextFleetId;
  },
  // Move a ship into a fleet (or the hangar with fleetId null). Fleets on a mission can't change.
  assign(shipId, fleetId) {
    const ship = G.ships[shipId], from = this.fleetOf(shipId);
    if (!ship || (from && from.mission)) return false;
    const to = fleetId == null ? null : this.fleet(fleetId);
    if (to && (to.mission || to.ships.length >= DATA.fleetMax)) return false;
    if (from) from.ships = from.ships.filter((id) => id !== shipId);
    if (to) to.ships.push(shipId);
    this.cleanup();
    return true;
  },
  cleanup() {
    for (const f of G.fleets) f.ships = f.ships.filter((id) => G.ships[id]);
    G.fleets = G.fleets.filter((f) => f.ships.length || f.keep);
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
    const cost = DATA.sizes[ship.size].cost;
    for (const k in cost) G.res[k] += Math.floor(cost[k] * DATA.scrapRefund);
    delete G.ships[shipId];
    this.cleanup();
    Log.add(`"${ship.name}" is broken up for parts. Its weapons go to the armory.`);
    return true;
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
  repair() {
    if (G.unpaid) return; // no maintenance, no repairs
    for (const s of this.all()) {
      const f = this.fleetOf(s.id);
      if (f && f.mission) continue;
      s.hullNow = Math.min(s.hull, s.hullNow + Math.ceil(s.hull * DATA.repairPerCycle));
    }
  },
};
