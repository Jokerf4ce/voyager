// Voyager — colonies, buildings, infrastructure and per-Cycle production.

const Colonies = {
  emptyBuildings() {
    const b = {};
    for (const k in DATA.buildings) b[k] = 0;
    return b;
  },

  found(sysId, owner, buildings = {}) {
    const s = G.systems[sysId];
    s.owner = owner;
    s.colony = { founded: G.cycle, buildings: Object.assign(this.emptyBuildings(), buildings), garrison: 0 };
    s.colony.garrison = this.maxGarrison(s);
    return s;
  },

  maxGarrison(s) {
    const b = s.colony.buildings.bastion;
    const mod = s.owner === 'player' ? State.mods().bastion : 1 + G.cycle / 60;
    return Math.round((20 + b * 25) * mod);
  },

  buildCost(s, key) {
    const def = DATA.buildings[key];
    const lvl = s.colony.buildings[key];
    const out = {};
    for (const k in def.cost) out[k] = Math.ceil(def.cost[k] * Math.pow(def.costGrowth, lvl));
    return out;
  },

  canAfford(cost) { return Object.entries(cost).every(([k, v]) => G.res[k] >= v); },
  pay(cost) { for (const k in cost) G.res[k] -= cost[k]; },

  // Why a building can't be built right now, or null if it can.
  blocker(s, key) {
    const need = DATA.buildings[key].infra;
    if (need > 0 && Economy.infraFree() < need) return 'Not enough Infrastructure';
    if (!this.canAfford(this.buildCost(s, key))) return 'Not enough resources';
    return null;
  },

  build(sysId, key) {
    const s = G.systems[sysId];
    if (!s.colony || s.owner !== 'player' || this.blocker(s, key)) return false;
    this.pay(this.buildCost(s, key));
    s.colony.buildings[key]++;
    if (key === 'bastion') s.colony.garrison = this.maxGarrison(s);
    Log.add(`${DATA.buildings[key].name} raised to level ${s.colony.buildings[key]} on ${s.name}.`);
    return true;
  },

  // Capture: buildings are damaged, the garrison is reset.
  capture(sysId, newOwner) {
    const s = G.systems[sysId];
    const old = s.owner;
    for (const k in s.colony.buildings) s.colony.buildings[k] = Math.max(0, s.colony.buildings[k] - 1);
    s.owner = newOwner;
    s.colony.garrison = Math.round(this.maxGarrison(s) * 0.3);
    return old;
  },

  playerColonies() { return G.systems.filter((s) => s.owner === 'player' && s.colony); },
};

const Economy = {
  // --- Infrastructure (capacity) ---
  colonyInfraCap(s) {
    const t = DATA.planetTypes[s.type].mult;
    let cap = DATA.infra.colonyBase;
    for (const [k, lvl] of Object.entries(s.colony.buildings)) {
      const d = DATA.buildings[k];
      if (d && d.infra < 0) cap += -d.infra * lvl;
    }
    return cap * (t.infra || 1) * State.mods().infra;
  },

  colonyInfraUsed(s) {
    let used = 0;
    for (const [k, lvl] of Object.entries(s.colony.buildings)) {
      const d = DATA.buildings[k];
      if (d && d.infra > 0) used += d.infra * lvl;
    }
    return used;
  },

  infra() {
    let cap = 0, buildings = 0, ships = 0;
    for (const s of Colonies.playerColonies()) { cap += this.colonyInfraCap(s); buildings += this.colonyInfraUsed(s); }
    for (const f of G.fleets) if (f.owner === 'player') {
      for (const [t, n] of Object.entries(f.ships)) ships += DATA.ships[t].infra * n;
    }
    const used = buildings + ships;
    const eff = used <= cap ? 1 : Math.max(DATA.infra.minEfficiency, cap / used);
    return { cap, used, buildings, ships, eff };
  },

  infraFree() { const i = this.infra(); return i.cap - i.used; },

  // --- Production ---
  // Raw output of one colony, before refinery inputs are taken. eff = rationing factor.
  colonyYield(s, eff = 1) {
    const m = State.mods();
    const b = s.colony.buildings;
    const t = DATA.planetTypes[s.type].mult;
    const k = m.all * (1 + 0.1 * b.fusion) * eff;
    return {
      metal: (2 + b.mine * 3) * (t.metal || 1) * m.metal * k,
      rare: (b.drill * 1.5) * (t.rare || 1) * m.rare * k,
      compute: (1 + b.cogitator * 2) * (t.compute || 1) * m.compute * k,
      polymers: (b.refinery * 2) * (t.polymers || 1) * m.polymers * k, // refinery output if fed
      refMetal: b.refinery * 2 * eff, // refinery inputs; bonuses raise output, not inputs
      refRare: b.refinery * 0.5 * eff,
    };
  },

  income() {
    const inf = this.infra();
    const m = State.mods();
    const out = { metal: 0, rare: 0, compute: 0, polymersMax: 0, refMetal: 0, refRare: 0, shards: Math.floor(m.shardIncome), infra: inf };
    for (const s of Colonies.playerColonies()) {
      const y = this.colonyYield(s, inf.eff);
      out.metal += y.metal; out.rare += y.rare; out.compute += y.compute;
      out.polymersMax += y.polymers; out.refMetal += y.refMetal; out.refRare += y.refRare;
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
    // Refining runs as far as the stockpile allows.
    if (inc.polymersMax > 0) {
      const ratio = Math.min(1, inc.refMetal ? G.res.metal / inc.refMetal : 1, inc.refRare ? G.res.rare / inc.refRare : 1);
      G.res.polymers += inc.polymersMax * ratio;
      G.res.metal -= inc.refMetal * ratio;
      G.res.rare -= inc.refRare * ratio;
      if (ratio < 1 && G.cycle % 5 === 0) Log.add('Refineries stall: not enough Metal or Rare Minerals to feed them.', 'bad');
    }
    if (inc.infra.eff < 1 && G.cycle % 3 === 0) {
      Log.add(`Rationing! Infrastructure ${Math.round(inc.infra.used)}/${Math.round(inc.infra.cap)}. Production is down to ${Math.round(inc.infra.eff * 100)}%. Build Habitat Rings or Fusion Cores, or scrap ships.`, 'bad');
    }
    for (const s of G.systems) if (s.colony) {
      s.colony.garrison = Math.min(Colonies.maxGarrison(s), s.colony.garrison + 5);
    }
  },
};
