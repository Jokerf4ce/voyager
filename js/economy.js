// Voyager — systems, planets, colonies (surface + orbit), infrastructure and per-Cycle production.
// A system is owned as a whole; every settled planet in it belongs to the system owner.
// A planet ref is the string "sysId:planetIdx".

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const Colonies = {
  ref(s, p) { return s.id + ':' + p.idx; },
  get(ref) { const [sid, pi] = String(ref).split(':').map(Number); const s = G.systems[sid]; return { s, p: s && s.planets[pi] }; },
  planetName(s, p) { return `${s.name} ${ROMAN[p.idx]}`; },

  slots(p, layer) { return p.slots[layer]; },
  // A slot is taken by a standing building or by one under construction.
  slotsUsed(p, layer) {
    const keys = new Set(Object.keys(p.colony[layer]).filter((k) => p.colony[layer][k] > 0));
    for (const c of p.colony.build || []) if (c.layer === layer) keys.add(c.key);
    return keys.size;
  },
  // ---- construction: every build or upgrade takes DATA.construction.cycles; meanwhile the site draws DATA.construction.cap ----
  constructing(p, layer, key) { return (p.colony && p.colony.build || []).find((c) => c.layer === layer && c.key === key) || null; },
  // Count down every construction site; finished ones raise the building's level.
  tickBuild(silent) {
    let done = 0;
    for (const { s, p } of this.playerPlanets()) {
      if (!p.colony.build || !p.colony.build.length) continue;
      for (const c of p.colony.build.slice()) {
        if (--c.eta > 0) continue;
        p.colony.build.splice(p.colony.build.indexOf(c), 1);
        p.colony[c.layer][c.key] = (p.colony[c.layer][c.key] || 0) + 1;
        if (c.key === 'bastion' || c.key === 'platform') s.garrison = this.maxGarrison(s);
        Log.add(`${DATA.buildings[c.key].name} (${DATA.layers[c.layer]}) ${p.colony[c.layer][c.key] > 1 ? `upgraded to level ${p.colony[c.layer][c.key]}` : 'completed'} on ${this.planetName(s, p)}.`, 'good');
        done++;
      }
    }
    for (const s of this.playerSystems()) for (const c of (s.projectBuild || []).slice()) {
      if (--c.eta > 0) continue;
      s.projectBuild.splice(s.projectBuild.indexOf(c), 1);
      (s.projects = s.projects || {})[c.key] = 1;
      Log.add(`${DATA.systemProjects[c.key].name} completed around ${s.name}: +${U.fmt1(this.projectPower(s, c.key))} Power for the empire.`, 'good');
      done++;
    }
    if (done && !silent && typeof Voice !== 'undefined') Voice.trigger('construction'); // once per Cycle, however many finished
    return done;
  },
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
    for (const k in DATA.settleCost) out[k] = Math.ceil(DATA.settleCost[k] * State.diff().costMult * Math.pow(DATA.settleGrowth, Math.max(0, n - 1)) * this.habMult(p, p.slots.surface ? 'surface' : 'orbit')); // no surface: an orbital station
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
    if (typeof Voice !== 'undefined') Voice.trigger('colony');
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

  // Cost multiplier for building a level (1 = a new building): +15 % of base per level up to level 5,
  // then doubling every level (DATA.levelCost).
  levelMult(level) {
    const c = DATA.levelCost;
    if (level <= c.softCap) return 1 + c.perLevel * (level - 1);
    return (1 + c.perLevel * (c.softCap - 1)) * Math.pow(c.expBase, level - c.softCap);
  },
  // Price of the next level of a building: base price × habitability multiplier × level multiplier.
  buildCost(p, layer, key) {
    const def = DATA.buildings[key];
    const out = {};
    const next = (p.colony && p.colony[layer] && p.colony[layer][key] || 0) + 1;
    const m = this.habMult(p, layer) * this.levelMult(next) * State.diff().costMult;
    for (const k in def.cost) out[k] = Math.ceil(def.cost[k] * m);
    return out;
  },

  canAfford(cost) { return Object.entries(cost).every(([k, v]) => G.res[k] >= v); },
  pay(cost) { for (const k in cost) G.res[k] -= cost[k]; },

  // Why a building can't be built right now, or null if it can.
  blocker(p, layer, key) {
    const def = DATA.buildings[key];
    if (!def.layers.includes(layer)) return 'Wrong layer';
    if (this.constructing(p, layer, key)) return 'Under construction';
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
    const n = DATA.construction.cycles, lvl = (p.colony[layer][key] || 0) + 1;
    (p.colony.build = p.colony.build || []).push({ layer, key, eta: n, total: n });
    if (typeof Sfx !== 'undefined') Sfx.play('construct');
    Log.add(`Construction begins: ${DATA.buildings[key].name} ${lvl > 1 ? `level ${lvl}` : ''} (${DATA.layers[layer]}) on ${this.planetName(s, p)}, ready in ${n} Cycles.`);
    return true;
  },

  // ---- demolishing ----
  // Everything paid for a building so far: the price of each level from 1 up to its current level.
  invested(p, layer, key) {
    const def = DATA.buildings[key], lvl = (p.colony && p.colony[layer][key]) || 0, h = this.habMult(p, layer) * State.diff().costMult, out = {};
    for (let i = 1; i <= lvl; i++) for (const k in def.cost) out[k] = (out[k] || 0) + Math.ceil(def.cost[k] * h * this.levelMult(i));
    return out;
  },
  // What demolishing gives back: DATA.demolishRefund of everything invested, rounded down.
  demolishRefund(p, layer, key) {
    const out = {}, inv = this.invested(p, layer, key);
    for (const k in inv) { const v = Math.floor(inv[k] * DATA.demolishRefund); if (v > 0) out[k] = v; }
    return out;
  },
  // What the empire would look like without this building: capacities it would leave short, and the
  // production rate afterwards (power plants and habitats can be torn down, at the price of rationing).
  demolishEffect(p, layer, key) {
    const before = Economy.caps(), lvl = p.colony[layer][key];
    p.colony[layer][key] = 0;
    const after = Economy.caps();
    p.colony[layer][key] = lvl;
    const short = Object.keys(DATA.capacities).filter((k) => after[k].used > after[k].cap + 1e-9 && after[k].free < before[k].free - 1e-9);
    return { short, eff: after.eff, effBefore: before.eff };
  },
  demolish(ref, layer, key) {
    const { s, p } = this.get(ref);
    if (!p || !p.colony || s.owner !== 'player' || !(p.colony[layer][key] > 0) || this.constructing(p, layer, key)) return false;
    const refund = this.demolishRefund(p, layer, key), lvl = p.colony[layer][key];
    for (const k in refund) G.res[k] = (G.res[k] || 0) + refund[k];
    delete p.colony[layer][key];
    if (key === 'bastion' || key === 'platform') s.garrison = Math.min(s.garrison, this.maxGarrison(s));
    Log.add(`${DATA.buildings[key].name} Lv ${lvl} (${DATA.layers[layer]}) demolished on ${this.planetName(s, p)}. Salvaged ${Object.entries(refund).map(([k, v]) => `${v} ${DATA.resources[k].name}`).join(', ') || 'nothing'}.`);
    return true;
  },

  // ---- empire-wide building list ----
  // Group a building type for the Buildings screen.
  group(key) {
    const d = DATA.buildings[key];
    if (d.gathers) return 'Gathering';
    if (d.refines) return 'Refining';
    if (Object.values(d.cap || {}).some((v) => v < 0)) return 'Power, habitation & compute';
    return 'Research, finance, ships & defense';
  },

  // How much one more level would produce at this colony layer (relative; used to pick the best spot).
  placementValue(p, layer, key) {
    const d = DATA.buildings[key], m = Planets.mult(p), st = DATA.starClasses[p.star || 'G'];
    if (d.gathers) {
      const size = DATA.planetSizes[p.size].yield;
      let v = 0;
      for (const res of [d.gathers, d.also].filter(Boolean)) v += Economy.rating(p, res) * size * ((st.mult || {})[res] || 1);
      return v;
    }
    const gives = Object.entries(d.cap || {}).find(([, v]) => v < 0);
    if (gives) return (m[gives[0]] || 1) * (d.solar ? st.solar : 1);
    return 1;
  },

  // Every colony layer where this building could get one more level, with cost and what stops it.
  placements(key) {
    const def = DATA.buildings[key], out = [];
    for (const { s, p } of this.playerPlanets()) for (const layer of def.layers) {
      if (!this.slots(p, layer)) continue;
      const lvl = p.colony[layer][key] || 0;
      if (!lvl && this.slotsUsed(p, layer) >= this.slots(p, layer)) continue; // no free slot
      if (def.gathers && !(Economy.rating(p, def.gathers) > 0 || (def.also && Economy.rating(p, def.also) > 0))) continue;
      const cost = this.buildCost(p, layer, key);
      const value = this.placementValue(p, layer, key);
      const price = Object.values(cost).reduce((a, b) => a + b, 0);
      out.push({ s, p, layer, lvl, cost, value, score: value / Math.max(1, price), ref: this.ref(s, p), why: this.blocker(p, layer, key) });
    }
    return out.sort((a, b) => b.score - a.score || b.lvl - a.lvl);
  },

  // Auto: the best output per cost among the spots that can be built right now
  // (ties prefer upgrading an existing building, which keeps free slots for other types).
  best(key) {
    const all = this.placements(key);
    return all.find((x) => !x.why) || all[0] || null;
  },

  buildAuto(key) {
    const b = this.best(key);
    if (!b || b.why) return false;
    return this.build(b.ref, b.layer, key);
  },

  // Where a building type stands: total levels and the colonies it is on.
  holdings(key) {
    const list = [];
    for (const { s, p } of this.playerPlanets()) for (const layer of ['surface', 'orbit']) {
      const lvl = p.colony[layer][key] || 0;
      if (lvl) list.push({ s, p, layer, lvl, ref: this.ref(s, p) });
    }
    return { levels: list.reduce((a, x) => a + x.lvl, 0), list };
  },

  // Capture: every colony in the system changes hands, buildings are damaged, the garrison is reset.
  capture(sysId, newOwner) {
    const s = G.systems[sysId];
    const old = s.owner;
    for (const p of s.planets) if (p.colony) {
      for (const layer of ['surface', 'orbit']) for (const k in p.colony[layer]) p.colony[layer][k] = Math.max(0, p.colony[layer][k] - 1);
      p.colony.build = []; // construction sites are lost with the system
    }
    s.projectBuild = []; // half-built system projects are lost; finished ones go dark until the system is retaken
    s.owner = newOwner;
    s.garrison = Math.round(this.maxGarrison(s) * 0.3);
    return old;
  },

  playerSystems() { return G.systems.filter((s) => s.owner === 'player'); },

  // ---- system projects (DATA.systemProjects): one per system, built at star-system level ----
  projectPower(s, key) { const d = DATA.systemProjects[key]; return (d.power || 0) * DATA.starClasses[s.star].solar * (State.mods().power || 1); },
  projectCost(key) { return State.cost(DATA.systemProjects[key].cost); },
  projectSlotsUsed(s) { return Object.values(s.projects || {}).filter(Boolean).length + (s.projectBuild || []).length; },
  projectBlocker(s, key) {
    if (s.owner !== 'player') return 'Not your system';
    if ((s.projects || {})[key]) return 'Already built';
    if ((s.projectBuild || []).some((c) => c.key === key)) return 'Under construction';
    if (this.projectSlotsUsed(s) >= DATA.systemSlots) return 'No free project slot';
    const short = Economy.capShortfall(DATA.construction.cap);
    if (short) return `Needs ${DATA.construction.cap[short]} free ${DATA.capacities[short].name}`;
    if (!this.canAfford(this.projectCost(key))) return 'Not enough resources';
    return null;
  },
  buildProject(sysId, key) {
    const s = G.systems[sysId];
    if (!s || this.projectBlocker(s, key)) return false;
    this.pay(this.projectCost(key));
    const n = DATA.systemProjects[key].cycles;
    (s.projectBuild = s.projectBuild || []).push({ key, eta: n, total: n });
    if (typeof Sfx !== 'undefined') Sfx.play('construct', { rate: 0.8 });
    Log.add(`Construction begins: ${DATA.systemProjects[key].name} around ${s.name}, ready in ${n} Cycles.`);
    return true;
  },
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
    // construction sites draw their own capacity until they are done
    for (const c of p.colony.build || []) for (const [k, v] of Object.entries(DATA.construction.cap)) { out[k].use += v; out[k].building = (out[k].building || 0) + v; }
    return out;
  },


  // Empire-wide capacities. eff = rationing factor when any capacity is over its cap.
  caps() {
    const out = {};
    for (const k in DATA.capacities) out[k] = { cap: 0, used: 0, buildings: 0, ships: 0 };
    for (const { p } of Colonies.playerPlanets()) {
      const c = this.planetCaps(p);
      for (const k in c) { out[k].cap += c[k].give; out[k].buildings += c[k].use; }
    }
    // system projects give Power; their construction sites draw like any other
    for (const s of Colonies.playerSystems()) {
      for (const key in s.projects || {}) if (s.projects[key]) out.power.cap += Colonies.projectPower(s, key);
      for (const c of s.projectBuild || []) for (const [k, v] of Object.entries(DATA.construction.cap)) out[k].buildings += v;
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

  // Who makes and who uses a resource ('res:metal') or a capacity ('cap:power'), per Cycle, for the hover cards.
  // Resources: producers and refining inputs per colony, fleet maintenance, the research project.
  // Capacities: what each colony provides, and what uses it by building type (plus construction sites).
  breakdown(key) {
    const [kind, k] = key.split(':'), plus = [], minus = [];
    if (kind === 'res') {
      const eff = this.caps().eff;
      for (const { s, p } of Colonies.playerPlanets()) {
        const y = this.planetYield(p, eff), name = Colonies.planetName(s, p);
        if (y[k] > 0.004) plus.push([name, y[k]]);
        if (y.inputs[k] > 0.004) minus.push([`${name} · refining`, y.inputs[k]]);
      }
      const up = Ships.upkeep();
      if (k === 'metal' && up) minus.push(['Fleet maintenance', up]);
      if (k === 'chemicals' && up) minus.push(['Fleet maintenance', up / 2]);
      if (k === 'research' && G.researching && DATA.techs[G.researching]) {
        const left = Research.cost(G.researching) - G.researchProgress;
        minus.push([`Project: ${DATA.techs[G.researching].name}`, Math.min(left, this.net().research + G.res.research)]);
      }
    } else if (kind === 'cap') {
      const byType = {};
      for (const { s, p } of Colonies.playerPlanets()) {
        plus.push([Colonies.planetName(s, p), this.planetCaps(p)[k].give]);
        for (const layer of ['surface', 'orbit']) for (const [b, lvl] of Object.entries(p.colony[layer])) {
          const v = (DATA.buildings[b].cap || {})[k];
          if (v > 0 && lvl) byType[DATA.buildings[b].name] = (byType[DATA.buildings[b].name] || 0) + v * lvl;
        }
        for (const c of p.colony.build || []) if (DATA.construction.cap[k]) byType['Construction sites'] = (byType['Construction sites'] || 0) + DATA.construction.cap[k];
      }
      for (const s of Colonies.playerSystems()) {
        for (const key in s.projects || {}) if (s.projects[key] && k === 'power') plus.push([`${DATA.systemProjects[key].name} · ${s.name}`, Colonies.projectPower(s, key)]);
        for (const c of s.projectBuild || []) if (DATA.construction.cap[k]) byType['Construction sites'] = (byType['Construction sites'] || 0) + DATA.construction.cap[k];
      }
      for (const [n, v] of Object.entries(byType)) minus.push([n, v]);
    }
    const sort = (a) => a.filter(([, v]) => v > 0.004).sort((a, b) => b[1] - a[1]);
    return { plus: sort(plus), minus: sort(minus) };
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
    const out = { metal: 0, rare: 0, organics: 0, electronics: 0, chemicals: 0, research: 0, crypto: 0, inputs: { metal: 0, rare: 0, organics: 0 } };
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
    // Finance Districts mine Crypto Shards (tiny amounts by design)
    for (const [key, d] of Object.entries(DATA.buildings)) if (d.crypto) out.crypto += d.crypto * L(key) * k;
    return out;
  },

  income() {
    const caps = this.caps();
    const m = State.mods();
    const out = { metal: 0, rare: 0, organics: 0, electronics: 0, chemicals: 0, research: 0, crypto: 0, inputs: { metal: 0, rare: 0, organics: 0 }, caps };
    for (const { p } of Colonies.playerPlanets()) {
      const y = this.planetYield(p, caps.eff);
      for (const k of ['metal', 'rare', 'organics', 'electronics', 'chemicals', 'research', 'crypto']) out[k] += y[k];
      for (const k in y.inputs) out.inputs[k] += y.inputs[k];
    }
    return out;
  },

  // Net change per Cycle as shown in the UI (assumes refineries get their inputs).
  net() {
    const i = this.income();
    const up = Ships.upkeep();
    return { metal: i.metal - i.inputs.metal - up, rare: i.rare - i.inputs.rare, organics: i.organics - i.inputs.organics,
      electronics: i.electronics, chemicals: i.chemicals - up * 0.5, research: i.research, crypto: i.crypto, caps: i.caps, upkeep: up };
  },

  tick() {
    Colonies.tickBuild();
    const inc = this.income();
    for (const k of ['metal', 'rare', 'organics', 'research', 'crypto']) G.res[k] += inc[k];
    // Refineries and chemical plants run as far as the stockpile allows.
    const need = inc.inputs;
    const ratio = Math.min(1, ...Object.entries(need).filter(([, v]) => v > 0).map(([k, v]) => G.res[k] / v));
    if (inc.electronics + inc.chemicals > 0) {
      G.res.electronics += inc.electronics * ratio;
      G.res.chemicals += inc.chemicals * ratio;
      for (const [k, v] of Object.entries(need)) G.res[k] -= v * ratio;
      if (ratio < 1 && G.cycle % 5 === 0) Log.add('Refineries stall: not enough Metals, Organics or Rare Minerals to feed them.', 'bad');
    }
    const c = inc.caps;
    if (c.eff < 1 && G.cycle % 3 === 0) {
      const over = Object.keys(DATA.capacities).filter((k) => c[k].used > c[k].cap).map((k) => `${DATA.capacities[k].name} ${Math.round(c[k].used)}/${Math.round(c[k].cap)}`).join(', ');
      Log.add(`Rationing! Over capacity: ${over}. Production is down to ${Math.round(c.eff * 100)}%.`, 'bad');
    }
    // Ship maintenance: Metals, plus half as much Chemicals.
    const up = Ships.upkeep();
    if (up > 0) {
      const short = G.res.metal < up || G.res.chemicals < up * 0.5;
      G.res.metal = Math.max(0, G.res.metal - up);
      G.res.chemicals = Math.max(0, G.res.chemicals - up * 0.5);
      if (short && G.cycle % 5 === 0) Log.add('The fleet\'s maintenance cannot be fully paid. Crews go hungry; nothing gets repaired.', 'bad');
      G.unpaid = short;
    } else G.unpaid = false;
  },
};
