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
    return DATA.habitability[p.hab][layer];
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
    if (def.gathers && !(Economy.rating(p, def.gathers) > 0 || (def.also && Economy.rating(p, def.also) > 0))) return `Nothing to gather here`;
    const short = Economy.capShortfall(def.cap);
    if (short) return `Not enough ${DATA.capacities[short].name}`;
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
  // --- Gathered resources ---
  // Rating 0–3 of a planet for a gathered resource (dwarfs get +1 Rare Minerals).
  rating(p, res) {
    const r = Planets.cls(p).yields[res] || 0;
    return r + (res === 'rare' ? (DATA.planetSizes[p.size].rareBonus || 0) : 0);
  },

  // --- Capacities (Power, Infrastructure, Compute) ---
  // What a planet provides and uses: { power: { give, use }, ... }
  planetCaps(p) {
    const m = State.mods(), t = Planets.mult(p);
    const out = {};
    for (const k in DATA.capacities) out[k] = { give: DATA.capacities[k].base, use: 0 };
    out.power.give *= DATA.starClasses[p.star || 'G'].solar; // a colony's own power is partly solar
    for (const layer of ['surface', 'orbit']) for (const [key, lvl] of Object.entries(p.colony[layer])) {
      const d = DATA.buildings[key];
      if (!d || !lvl) continue;
      for (const [k, v] of Object.entries(d.cap || {})) {
        if (v < 0) out[k].give += -v * lvl * (d.solar ? DATA.starClasses[p.star || 'G'].solar : 1);
        else out[k].use += v * lvl;
      }
    }
    for (const k in out) out[k].give *= (t[k] || 1) * (m[k] || 1);
    return out;
  },

  shipCaps(type) { return DATA.ships[type].cap || {}; },

  // Empire-wide capacities. eff = rationing factor when any capacity is over its cap.
  caps() {
    const out = {};
    for (const k in DATA.capacities) out[k] = { cap: 0, used: 0, buildings: 0, ships: 0 };
    for (const { p } of Colonies.playerPlanets()) {
      const c = this.planetCaps(p);
      for (const k in c) { out[k].cap += c[k].give; out[k].buildings += c[k].use; }
    }
    for (const f of G.fleets) if (f.owner === 'player') {
      for (const [t, n] of Object.entries(f.ships)) for (const [k, v] of Object.entries(this.shipCaps(t))) out[k].ships += v * n;
    }
    let eff = 1;
    for (const k in out) {
      out[k].used = out[k].buildings + out[k].ships;
      out[k].free = out[k].cap - out[k].used;
      if (out[k].used > out[k].cap) eff = Math.min(eff, out[k].cap / out[k].used);
    }
    out.eff = Math.max(DATA.minEfficiency, eff);
    return out;
  },

  // First capacity that a new need would push over its cap, or null.
  capShortfall(need = {}) {
    const c = this.caps();
    for (const [k, v] of Object.entries(need)) if (v > 0 && c[k].free < v - 1e-9) return k;
    return null;
  },

  // --- Production ---
  // Output of one planet per Cycle. eff = rationing factor. Refinery inputs are reported in `inputs`.
  planetYield(p, eff = 1) {
    const m = State.mods(), st = DATA.starClasses[p.star || 'G'];
    const L = (k) => Colonies.level(p, k);
    const size = DATA.planetSizes[p.size].yield;
    const k = m.all * eff;
    const out = { metal: 0, rare: 0, organics: 0, polymers: 0, chemicals: 0, research: 0, inputs: { metal: 0, rare: 0, organics: 0 } };
    // gathered: base colony output plus 2 × rating per gathering building level
    for (const res of ['metal', 'rare', 'organics']) {
      let lv = 0;
      for (const [key, d] of Object.entries(DATA.buildings)) if (d.gathers === res || d.also === res) lv += L(key);
      out[res] = this.rating(p, res) * size * (1 + 2 * lv) * (m[res] || 1) * ((st.mult || {})[res] || 1) * k;
    }
    // refined: fixed inputs, bonuses raise output only
    for (const [key, d] of Object.entries(DATA.buildings)) {
      if (!d.refines || !L(key)) continue;
      out[d.refines.out] += d.refines.amount * L(key) * (m[d.refines.out] || 1) * k;
      for (const [r, v] of Object.entries(d.refines.in)) out.inputs[r] += v * L(key) * eff;
    }
    out.research = (L('lab') * 2 + (p.colony.capital ? 1 : 0)) * m.research * k;
    return out;
  },

  income() {
    const caps = this.caps();
    const m = State.mods();
    const starShards = Colonies.playerSystems().reduce((a, s) => a + (DATA.starClasses[s.star].shards || 0), 0);
    const out = { metal: 0, rare: 0, organics: 0, polymers: 0, chemicals: 0, research: 0, inputs: { metal: 0, rare: 0, organics: 0 },
      shards: Math.floor(m.shardIncome) + starShards, caps };
    for (const { p } of Colonies.playerPlanets()) {
      const y = this.planetYield(p, caps.eff);
      for (const k of ['metal', 'rare', 'organics', 'polymers', 'chemicals', 'research']) out[k] += y[k];
      for (const k in y.inputs) out.inputs[k] += y.inputs[k];
    }
    return out;
  },

  // Net change per Cycle as shown in the UI (assumes refineries get their inputs).
  net() {
    const i = this.income();
    return { metal: i.metal - i.inputs.metal, rare: i.rare - i.inputs.rare, organics: i.organics - i.inputs.organics,
      polymers: i.polymers, chemicals: i.chemicals, research: i.research, shards: i.shards, caps: i.caps };
  },

  tick() {
    const inc = this.income();
    for (const k of ['metal', 'rare', 'organics', 'research']) G.res[k] += inc[k];
    G.res.shards += inc.shards;
    if (G.cycle % 5 === 0) G.res.shards += 1;
    // Refineries and chemical plants run as far as the stockpile allows.
    const need = inc.inputs;
    const ratio = Math.min(1, ...Object.entries(need).filter(([, v]) => v > 0).map(([k, v]) => G.res[k] / v));
    if (inc.polymers + inc.chemicals > 0) {
      G.res.polymers += inc.polymers * ratio;
      G.res.chemicals += inc.chemicals * ratio;
      for (const [k, v] of Object.entries(need)) G.res[k] -= v * ratio;
      if (ratio < 1 && G.cycle % 5 === 0) Log.add('Refineries stall: not enough Metals, Organics or Rare Minerals to feed them.', 'bad');
    }
    const c = inc.caps;
    if (c.eff < 1 && G.cycle % 3 === 0) {
      const over = Object.keys(DATA.capacities).filter((k) => c[k].used > c[k].cap).map((k) => `${DATA.capacities[k].name} ${Math.round(c[k].used)}/${Math.round(c[k].cap)}`).join(', ');
      Log.add(`Rationing! Over capacity: ${over}. Production is down to ${Math.round(c.eff * 100)}%.`, 'bad');
    }
    for (const s of G.systems) if (s.owner) s.garrison = Math.min(Colonies.maxGarrison(s), (s.garrison || 0) + 5);
  },
};
