// Voyager — fleets: creation, shipbuilding, orders and movement.

const Fleets = {
  create(owner, sysId, ships, name) {
    const f = { id: G.nextFleetId++, owner, sys: sysId, ships: Object.assign({}, ships), path: [], name: name || 'Fleet ' + G.nextFleetId };
    G.fleets.push(f);
    return f;
  },

  get(id) { return G.fleets.find((f) => f.id === id); },
  at(sysId, owner) { return G.fleets.filter((f) => f.sys === sysId && (!owner || f.owner === owner) && this.size(f) > 0); },
  size(f) { return Object.values(f.ships).reduce((a, b) => a + b, 0); },
  has(f, type) { return (f.ships[type] || 0) > 0; },
  isCombat(f) { return Object.entries(f.ships).some(([t, n]) => n > 0 && DATA.ships[t].atk > 0); },

  stats(f) {
    const m = f.owner === 'player' ? State.mods() : { atk: 1 + G.cycle / 80, hp: 1 + G.cycle / 80 };
    let atk = 0, hp = 0;
    for (const [t, n] of Object.entries(f.ships)) { atk += DATA.ships[t].atk * n; hp += DATA.ships[t].hp * n; }
    return { atk: atk * m.atk, hp: hp * m.hp };
  },

  killOneShip(fleetId) {
    const f = this.get(fleetId);
    if (!f) return;
    const types = Object.keys(f.ships).filter((t) => f.ships[t] > 0);
    if (!types.length) return;
    f.ships[U.pick(types)]--;
    this.cleanup();
  },

  cleanup() {
    G.fleets = G.fleets.filter((f) => this.size(f) > 0);
    for (const f of G.fleets) for (const t in f.ships) if (f.ships[t] <= 0) delete f.ships[t];
  },

  // --- shipbuilding ---
  unlocked(type) {
    const req = DATA.ships[type].req;
    if (DATA.ships[type].monster) return false;
    if (!req) return true;
    if (req.tech) return Research.level(req.tech) > 0;
    if (req.blueprint) return !!G.collection[req.blueprint];
    return false;
  },

  shipCost(type, sysId) {
    const yard = G.systems[sysId].colony.buildings.shipyard;
    const disc = Math.max(0.6, 1 - 0.05 * (yard - 1));
    const out = {};
    for (const k in DATA.ships[type].cost) out[k] = Math.ceil(DATA.ships[type].cost[k] * disc);
    return out;
  },

  build(type, sysId) {
    const s = G.systems[sysId];
    if (!s.colony || s.owner !== 'player' || s.colony.buildings.shipyard < 1 || !this.unlocked(type)) return false;
    const cost = this.shipCost(type, sysId);
    if (!Colonies.canAfford(cost)) return false;
    Colonies.pay(cost);
    if (type === 'scout' || type === 'ark') {
      this.create('player', sysId, { [type]: 1 }, type === 'scout' ? 'Scout ' + G.nextFleetId : 'Ark ' + G.nextFleetId);
    } else {
      let f = this.at(sysId, 'player').find((x) => x.path.length === 0 && this.isCombat(x));
      if (!f) f = this.create('player', sysId, {}, 'Battlegroup ' + G.nextFleetId);
      f.ships[type] = (f.ships[type] || 0) + 1;
    }
    Log.add(`A ${DATA.ships[type].name} is launched from ${s.name}.`);
    return true;
  },

  // --- orders ---
  order(fleetId, destId) {
    const f = this.get(fleetId);
    if (!f || f.owner !== 'player') return false;
    // Players may only route through systems they know about.
    const p = U.path(f.sys, destId, (id) => G.systems[id].explored || Explore.isSeen(id));
    if (!p) return false;
    f.path = p;
    return true;
  },

  split(fleetId, type) {
    const f = this.get(fleetId);
    if (!f || !f.ships[type] || this.size(f) < 2) return;
    f.ships[type]--;
    this.create(f.owner, f.sys, { [type]: 1 }, DATA.ships[type].name + ' ' + G.nextFleetId);
    this.cleanup();
  },

  mergeAt(sysId) {
    const fs = this.at(sysId, 'player').filter((f) => f.path.length === 0 && !this.has(f, 'scout') && !this.has(f, 'ark'));
    if (fs.length < 2) return;
    const main = fs[0];
    for (const f of fs.slice(1)) { for (const [t, n] of Object.entries(f.ships)) main.ships[t] = (main.ships[t] || 0) + n; f.ships = {}; }
    this.cleanup();
  },

  colonize(fleetId) {
    const f = this.get(fleetId);
    if (!f || !this.has(f, 'ark')) return false;
    const s = G.systems[f.sys];
    if (s.owner || s.colony) return false;
    if (G.fleets.some((x) => x.sys === s.id && x.owner !== 'player' && this.size(x) > 0)) return false;
    f.ships.ark--;
    this.cleanup();
    Colonies.found(s.id, 'player');
    s.explored = true;
    Explore.reveal(s.id);
    Log.add(`A colony is founded on ${s.name}. The colonists bury their dead first, then start building.`, 'good');
    return true;
  },

  // One hop per Cycle along each fleet's path.
  moveAll() {
    for (const f of G.fleets) {
      if (!f.path.length) continue;
      f.sys = f.path.shift();
      if (f.owner === 'player') Explore.arrive(f);
    }
  },
};
