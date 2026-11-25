// Voyager — colonies, buildings and per-Cycle production.

const Colonies = {
  found(sysId, owner, buildings = {}) {
    const s = G.systems[sysId];
    s.owner = owner;
    s.colony = {
      founded: G.cycle,
      buildings: Object.assign({ mine: 0, reactor: 0, archive: 0, shipyard: 0, bastion: 0 }, buildings),
      garrison: 0,
    };
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

  build(sysId, key) {
    const s = G.systems[sysId];
    if (!s.colony || s.owner !== 'player') return false;
    const cost = this.buildCost(s, key);
    if (!this.canAfford(cost)) return false;
    this.pay(cost);
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

  raze(sysId) {
    const s = G.systems[sysId];
    s.owner = null;
    s.colony = null;
  },

  playerColonies() { return G.systems.filter((s) => s.owner === 'player' && s.colony); },
};

const Economy = {
  colonyYield(s) {
    const m = State.mods();
    const b = s.colony.buildings;
    const t = DATA.planetTypes[s.type].mult;
    return {
      ore: (2 + b.mine * 3) * (t.ore || 1) * m.ore * m.all,
      energy: (2 + b.reactor * 3) * (t.energy || 1) * m.energy * m.all,
      research: (1 + b.archive * 2) * (t.research || 1) * m.research * m.all,
    };
  },

  income() {
    const m = State.mods();
    const out = { ore: 0, energy: 0, research: 0, shards: Math.floor(m.shardIncome), upkeep: 0 };
    for (const s of Colonies.playerColonies()) {
      const y = this.colonyYield(s);
      out.ore += y.ore; out.energy += y.energy; out.research += y.research;
    }
    for (const f of G.fleets) if (f.owner === 'player') {
      for (const [t, n] of Object.entries(f.ships)) out.upkeep += DATA.ships[t].upkeep * n;
    }
    return out;
  },

  tick() {
    const inc = this.income();
    G.res.ore += inc.ore;
    G.res.energy += inc.energy - inc.upkeep;
    G.res.research += inc.research;
    G.res.shards += inc.shards;
    if (G.cycle % 5 === 0) G.res.shards += 1;
    if (G.res.energy < 0) {
      G.res.energy = 0;
      const f = G.fleets.find((x) => x.owner === 'player' && Fleets.size(x) > 0);
      if (f) { Fleets.killOneShip(f.id); Log.add(`Energy starvation: life support fails aboard a ship in ${f.name}. The crew freezes in the dark.`, 'bad'); }
    }
    for (const s of G.systems) if (s.colony) {
      s.colony.garrison = Math.min(Colonies.maxGarrison(s), s.colony.garrison + 5);
    }
  },
};
