// Voyager — systems, planets, colonies (surface + orbit), infrastructure and per-Cycle production.
// A system is owned as a whole; every settled planet in it belongs to the system owner.
// A planet ref is the string "sysId:planetIdx".

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const Colonies = {
  ref(s, p) { return s.id + ':' + p.idx; },
  get(ref) { const [sid, pi] = String(ref).split(':').map(Number); const s = G.systems[sid]; return { s, p: s && s.planets[pi] }; },
  planetName(s, p) { return `${s.name} ${ROMAN[p.idx]}`; },

  slots(p, layer) { return p.slots[layer]; },
  slotsUsed(p, layer) { return Object.values(p.colony[layer]).filter((l) => l > 0).length; },
  level(p, key) { return p.colony ? (p.colony.surface[key] || 0) + (p.colony.orbit[key] || 0) : 0; },
  sysLevel(s, key) { return s.planets.reduce((a, p) => a + this.level(p, key), 0); },

  found(sysId, pIdx, owner, surface = {}, orbit = {}) {
    const s = G.systems[sysId];
    const p = s.planets[pIdx];
    p.colony = { founded: G.cycle, surface: Object.assign({}, surface), orbit: Object.assign({}, orbit) };
    if (s.owner !== owner) { s.owner = owner; s.garrison = 0; }
    s.garrison = this.maxGarrison(s);
    return p;
  },

  // Habitability cost multiplier for a layer of a planet.
  habMult(p, layer = 'surface') {
    const m = DATA.habitability[p.hab].cost;
    return layer === 'orbit' ? 1 + (m - 1) * DATA.habOrbitShare : m;
  },

  settleCost(p) {
    const n = this.playerPlanets().length;
    const out = {};
    for (const k in DATA.settleCost) out[k] = Math.ceil(DATA.settleCost[k] * Math.pow(DATA.settleGrowth, Math.max(0, n - 1)) * this.habMult(p, p.slots.surface ? 'surface' : 'orbit')); // no surface: an orbital station
    return out;
  },

  // Settle another planet in a system the player already holds.
  settle(sysId, pIdx) {
    const s = G.systems[sysId], p = s.planets[pIdx];
    if (s.owner !== 'player' || p.colony) return false;
    const cost = this.settleCost(p);
    if (!this.canAfford(cost)) return false;
    this.pay(cost);
    this.found(sysId, pIdx, 'player');
    Log.add(`Settlers land on ${this.planetName(s, p)}.`, 'good');
    return true;
  },

  maxGarrison(s) {
    const mod = s.owner === 'player' ? State.mods().bastion : 1 + G.cycle / 60;
    return Math.round((20 + this.sysLevel(s, 'bastion') * 25 + this.sysLevel(s, 'platform') * 15) * mod);
  },

  defenseAtk(s) {
    if (!s.owner) return 0;
    const mod = s.owner === 'player' ? State.mods().bastion : 1 + G.cycle / 80;
    return (this.sysLevel(s, 'bastion') * 6 + this.sysLevel(s, 'platform') * 10) * mod;
  },

  buildCost(p, layer, key) {
    const def = DATA.buildings[key];
    const lvl = p.colony[layer][key] || 0;
    const out = {};
    const hm = this.habMult(p, layer);
    for (const k in def.cost) out[k] = Math.ceil(def.cost[k] * Math.pow(def.costGrowth, lvl) * hm);
    return out;
  },

  canAfford(cost) { return Object.entries(cost).every(([k, v]) => G.res[k] >= v); },
  pay(cost) { for (const k in cost) G.res[k] -= cost[k]; },

  // Why a building can't be built right now, or null if it can.
  blocker(p, layer, key) {
    const def = DATA.buildings[key];
    if (!def.layers.includes(layer)) return 'Wrong layer';
    if (!(p.colony[layer][key] > 0) && this.slotsUsed(p, layer) >= this.slots(p, layer)) return `No free ${layer} slots`;
    if (def.infra > 0 && Economy.infraFree() < def.infra) return 'Not enough Infrastructure';
    if (!this.canAfford(this.buildCost(p, layer, key))) return 'Not enough resources';
    return null;
  },

  build(ref, layer, key) {
    const { s, p } = this.get(ref);
    if (!p || !p.colony || s.owner !== 'player' || this.blocker(p, layer, key)) return false;
    this.pay(this.buildCost(p, layer, key));
    p.colony[layer][key] = (p.colony[layer][key] || 0) + 1;
    if (key === 'bastion' || key === 'platform') s.garrison = this.maxGarrison(s);
    Log.add(`${DATA.buildings[key].name} (${DATA.layers[layer]}) raised to level ${p.colony[layer][key]} on ${this.planetName(s, p)}.`);
    return true;
  },

  // Capture: every colony in the system changes hands, buildings are damaged, the garrison is reset.
  capture(sysId, newOwner) {
    const s = G.systems[sysId];
    const old = s.owner;
    for (const p of s.planets) if (p.colony) for (const layer of ['surface', 'orbit']) {
      for (const k in p.colony[layer]) p.colony[layer][k] = Math.max(0, p.colony[layer][k] - 1);
    }
    s.owner = newOwner;
    s.garrison = Math.round(this.maxGarrison(s) * 0.3);
    return old;
  },

  playerSystems() { return G.systems.filter((s) => s.owner === 'player'); },
  playerPlanets() {
    const out = [];
    for (const s of this.playerSystems()) for (const p of s.planets) if (p.colony) out.push({ s, p });
    return out;
  },
  yards() { return this.playerPlanets().filter(({ p }) => (p.colony.orbit.shipyard || 0) > 0); },
};

const Economy = {
  // --- Infrastructure (capacity) ---
  planetInfraCap(p) {
    const t = DATA.planetTypes[p.type].mult;
    let cap = DATA.infra.colonyBase;
    for (const layer of ['surface', 'orbit']) for (const [k, lvl] of Object.entries(p.colony[layer])) {
      const d = DATA.buildings[k];
      if (d && d.infra < 0) cap += -d.infra * lvl;
    }
    return cap * (t.infra || 1) * State.mods().infra;
  },

  planetInfraUsed(p) {
    let used = 0;
    for (const layer of ['surface', 'orbit']) for (const [k, lvl] of Object.entries(p.colony[layer])) {
      const d = DATA.buildings[k];
      if (d && d.infra > 0) used += d.infra * lvl;
    }
    return used;
  },

  infra() {
    let cap = 0, buildings = 0, ships = 0;
    for (const { p } of Colonies.playerPlanets()) { cap += this.planetInfraCap(p); buildings += this.planetInfraUsed(p); }
    for (const f of G.fleets) if (f.owner === 'player') {
      for (const [t, n] of Object.entries(f.ships)) ships += DATA.ships[t].infra * n;
    }
    const used = buildings + ships;
    const eff = used <= cap ? 1 : Math.max(DATA.infra.minEfficiency, cap / used);
    return { cap, used, buildings, ships, eff };
  },

  infraFree() { const i = this.infra(); return i.cap - i.used; },

  // --- Production ---
  // Output of one planet. eff = rationing factor. Refinery inputs are reported separately.
  planetYield(p, eff = 1) {
    const m = State.mods();
    const L = (k) => Colonies.level(p, k);
    const t = DATA.planetTypes[p.type].mult;
    const k = m.all * (1 + 0.1 * L('fusion')) * eff;
    return {
      metal: (2 + L('mine') * 3) * (t.metal || 1) * m.metal * k,
      rare: (L('drill') * 1.5) * (t.rare || 1) * m.rare * k,
      compute: (1 + L('cogitator') * 2) * (t.compute || 1) * m.compute * k,
      polymers: (L('refinery') * 2 + L('skimmer') * 1.5) * (t.polymers || 1) * m.polymers * k, // if refineries are fed
      refMetal: L('refinery') * 2 * eff, // refinery inputs; bonuses raise output, not inputs
      refRare: L('refinery') * 0.5 * eff,
      refOut: L('refinery') * 2 * (t.polymers || 1) * m.polymers * k,
    };
  },

  income() {
    const inf = this.infra();
    const m = State.mods();
    const out = { metal: 0, rare: 0, compute: 0, polymersMax: 0, refOut: 0, refMetal: 0, refRare: 0, shards: Math.floor(m.shardIncome), infra: inf };
    for (const { p } of Colonies.playerPlanets()) {
      const y = this.planetYield(p, inf.eff);
      out.metal += y.metal; out.rare += y.rare; out.compute += y.compute;
      out.polymersMax += y.polymers; out.refOut += y.refOut; out.refMetal += y.refMetal; out.refRare += y.refRare;
    }
    return out;
  },

  // Net change per Cycle as shown in the UI (assumes refineries have their inputs).
  net() {
    const i = this.income();
    return { metal: i.metal - i.refMetal, rare: i.rare - i.refRare, polymers: i.polymersMax, compute: i.compute, shards: i.shards, infra: i.infra };
  },

  tick() {
    const inc = this.income();
    G.res.metal += inc.metal;
    G.res.rare += inc.rare;
    G.res.compute += inc.compute;
    G.res.shards += inc.shards;
    if (G.cycle % 5 === 0) G.res.shards += 1;
    // Skimmers always produce; refineries run as far as the stockpile allows.
    G.res.polymers += inc.polymersMax - inc.refOut;
    if (inc.refOut > 0) {
      const ratio = Math.min(1, inc.refMetal ? G.res.metal / inc.refMetal : 1, inc.refRare ? G.res.rare / inc.refRare : 1);
      G.res.polymers += inc.refOut * ratio;
      G.res.metal -= inc.refMetal * ratio;
      G.res.rare -= inc.refRare * ratio;
      if (ratio < 1 && G.cycle % 5 === 0) Log.add('Refineries stall: not enough Metal or Rare Minerals to feed them.', 'bad');
    }
    if (inc.infra.eff < 1 && G.cycle % 3 === 0) {
      Log.add(`Rationing! Infrastructure ${Math.round(inc.infra.used)}/${Math.round(inc.infra.cap)}. Production is down to ${Math.round(inc.infra.eff * 100)}%. Build Hab Domes, Habitat Rings or Fusion Cores, or scrap ships.`, 'bad');
    }
    for (const s of G.systems) if (s.owner) s.garrison = Math.min(Colonies.maxGarrison(s), (s.garrison || 0) + 5);
  },
};
