// Voyager — galaxy generation: an endless galaxy made in chunks as it is explored; hyperlanes; starting positions.

const Galaxy = {
  makeName(used) {
    const N = DATA.names;
    for (let i = 0; i < 50; i++) {
      const n = U.pick(N.pre) + U.pick(N.mid) + U.pick(N.post) + U.pick(N.suffix);
      if (!used.has(n)) { used.add(n); return n; }
    }
    return 'System ' + used.size;
  },

  segmentsCross(a, b, c, d) {
    if (a === c || a === d || b === c || b === d) return false;
    const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  },

  makePlanets(star) {
    const [lo, hi] = DATA.starClasses[star].planets;
    const n = U.randInt(lo, hi);
    const out = [];
    for (let i = 0; i < n; i++) out.push(Planets.random(i, star));
    return this.orderPlanets(out);
  },

  // Hot worlds orbit closest to the star, frozen ones farthest out; numbering follows the orbits.
  orderPlanets(planets) {
    const rank = { hot: 0, temperate: 1, frozen: 2 };
    planets.sort((a, b) => rank[a.temp] - rank[b.temp] || (a.comp === 'gas') - (b.comp === 'gas'));
    planets.forEach((p, i) => { p.idx = i; });
    return planets;
  },

  // Best planet in a system for a first colony: most surface slots, never a gas giant if avoidable.
  bestPlanet(s) {
    const score = (p) => p.slots.surface + p.slots.orbit + p.hab;
    return s.planets.slice().sort((a, b) => score(b) - score(a))[0].idx;
  },

  // ---------- an endless galaxy, generated in chunks as it is explored ----------
  // World units: 1 unit = 1 map pixel at zoom 1. G.galaxy.chunks marks generated chunks ("cx,cy").
  chunkOf(x, y) { const C = DATA.galaxy.chunk; return [Math.floor(x / C), Math.floor(y / C)]; },
  homeXY() { const h = G.systems[G.homeId]; return h ? h : { x: 0, y: 0 }; },
  // Danger grows with distance from home (0 at home, about 1 at the alien homes).
  danger(x, y) { const h = this.homeXY(); return Math.hypot(x - h.x, y - h.y) / DATA.galaxy.alienDistance[0]; },

  newSystem(x, y) {
    const starWeights = Object.fromEntries(Object.entries(DATA.starClasses).map(([k, c]) => [k, c.weight]));
    const star = Planets.weighted(starWeights);
    if (!G.galaxy.names) G.galaxy.names = [];
    const used = new Set(G.galaxy.names);
    const s = {
      id: G.systems.length, name: this.makeName(used), x: Math.round(x), y: Math.round(y), star,
      planets: this.makePlanets(star), lanes: [], owner: null, garrison: 0, explored: false,
    };
    G.galaxy.names.push(s.name);
    G.systems.push(s);
    return s;
  },

  link(a, b) { if (a !== b && !a.lanes.includes(b.id)) { a.lanes.push(b.id); b.lanes.push(a.id); } },
  crossesAny(a, b) {
    const near = G.systems.filter((s) => Math.hypot(s.x - a.x, s.y - a.y) < 260);
    for (const c of near) for (const n of c.lanes) {
      if (n < c.id) continue;
      if (this.segmentsCross(a, b, c, G.systems[n])) return true;
    }
    return false;
  },

  // Generate one chunk: a few systems, spaced apart, each linked to the nearest older system (so the galaxy
  // always stays connected) and to a neighbour or two more; lairs and events scaled by distance from home.
  ensureChunk(cx, cy) {
    const key = cx + ',' + cy;
    if (G.galaxy.chunks[key]) return [];
    G.galaxy.chunks[key] = true;
    const g = DATA.galaxy, C = g.chunk, made = [];
    const n = U.randInt(g.perChunk[0], g.perChunk[1]);
    for (let tries = 0; made.length < n && tries < 60; tries++) {
      const x = (cx + U.rand(0.08, 0.92)) * C, y = (cy + U.rand(0.08, 0.92)) * C;
      if (G.systems.some((s) => Math.hypot(s.x - x, s.y - y) < g.minDist)) continue;
      const older = G.systems.slice();
      const s = this.newSystem(x, y);
      made.push(s);
      if (older.length) {
        const byDist = older.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
        this.link(s, byDist[0]);
        for (const t of byDist.slice(1, 4)) {
          if (Math.hypot(t.x - x, t.y - y) < g.extraLane && Math.random() < 0.45 && !this.crossesAny(s, t)) this.link(s, t);
        }
      }
      this.populate(s);
    }
    return made;
  },

  // Monster lairs, more and nastier the farther out. (Charting a system no longer triggers events: v0.48.)
  populate(s) {
    const d = this.danger(s.x, s.y), g = DATA.galaxy;
    if (G.homeId == null || d < g.lairFrom) return;
    if (Math.random() > Math.min(g.lairMax, g.lairChance * (d - g.lairFrom + 0.3))) return;
    const n = Math.min(DATA.fleetMax, U.randInt(2, 3) + Math.floor(d * 1.5));
    const ships = [];
    for (let k = 0; k < n; k++) {
      const r = Math.random() * (0.8 + d * 0.6);
      ships.push(Ships.make(r > 1.4 ? 'leviathan' : r > 0.8 ? 'maw' : 'lurker', { owner: 'monster', rarity: Ships.rollRarity(d * 0.8) }));
    }
    s.guard = { owner: 'monster', name: d > 1.2 ? 'Lurker Brood' : 'Lurkers', ships };
  },

  // Make sure the space around every charted (or Covenant) system exists, so its neighbours can be found.
  grow() {
    if (!G.galaxy) return;
    const R = DATA.galaxy.growRadius;
    const seeds = G.systems.filter((s) => s.explored || s.owner === 'player');
    for (const s of seeds) {
      const [cx, cy] = this.chunkOf(s.x, s.y);
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) this.ensureChunk(cx + dx, cy + dy);
    }
  },

  // Chunks along a straight line, so two far-apart places are joined by generated space.
  corridor(x0, y0, x1, y1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (DATA.galaxy.chunk * 0.5));
    for (let i = 0; i <= steps; i++) {
      const [cx, cy] = this.chunkOf(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
      this.ensureChunk(cx, cy);
    }
  },

  generate() {
    G.systems = [];
    G.galaxy = { chunks: {}, names: [] };
    const R = DATA.galaxy.growRadius;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) this.ensureChunk(dx, dy);
    return G.systems;
  },

  // Place the player and the AI empires as far apart as possible, then scatter monsters.
  placeStarts() {
    const S = G.systems;
    const nearest = (x, y, ok = () => true) => S.filter(ok).reduce((b, s) => (Math.hypot(s.x - x, s.y - y) < Math.hypot(b.x - x, b.y - y) ? s : b));
    const home = nearest(0, 0);

    // The home system always has a decent rocky world and at least three planets.
    // The home star is a yellow dwarf like the lost Sun, with a large Terran capital.
    home.star = 'G';
    home.planets = this.makePlanets('G');
    while (home.planets.length < 3) home.planets.push(Planets.random(home.planets.length, 'G'));
    const capital = Planets.make(0, 'silicate', 'large', 'temperate', 5, 'G');
    home.planets[0] = capital;
    this.orderPlanets(home.planets);
    home.name = 'Covenant Ark-Home';
    G.galaxy.names.push(home.name);
    G.homeId = home.id;
    G.homePlanet = capital.idx;
    Colonies.found(home.id, capital.idx, 'player', { mine: 2, harvester: 1, refinery: 1, dome: 1, fusion: 3 }, { shipyard: 1, lab: 1, cogitator: 1, chemplant: 1 });
    capital.colony.capital = true;

    // One system next door always holds a rich Rare deposit: a Scorched Rock with a stable crust (DATA.deposits).
    const next = U.shuffle(home.lanes.map((id) => S[id]).filter((s) => !s.owner));
    const depSys = next[0] || nearest(home.x, home.y, (s) => s.id !== home.id);
    if (depSys) {
      const rock = Planets.make(depSys.planets.length, 'silicate', 'average', 'hot', 3, depSys.star);
      rock.deposit = 'rare';
      if (depSys.planets.length >= 5) depSys.planets[U.randInt(0, depSys.planets.length - 1)] = rock; else depSys.planets.push(rock);
      this.orderPlanets(depSys.planets);
      G.depositSys = depSys.id;
    }

    // The alien empires lie far out in two different directions, joined to home by generated space.
    const g = DATA.galaxy, a0 = Math.random() * Math.PI * 2;
    const homes = [];
    for (const [i, id] of AI.ids.entries()) {
      const ang = i === 0 ? a0 : a0 + U.rand(0.65, 1.35) * Math.PI;   // the two empires in clearly different directions
      const dist = U.rand(g.alienDistance[0], g.alienDistance[1]);
      const tx = home.x + Math.cos(ang) * dist, ty = home.y + Math.sin(ang) * dist;
      this.corridor(home.x, home.y, tx, ty);
      const [cx, cy] = this.chunkOf(tx, ty);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) this.ensureChunk(cx + dx, cy + dy);
      const h = nearest(tx, ty, (s) => s.id !== home.id && !homes.includes(s));
      h.guard = null;
      for (const n of h.lanes) { G.systems[n].guard = null; }
      Colonies.found(h.id, this.bestPlanet(h), id, { bastion: 1 });
      G.ai[id].homeId = h.id;
      AI.setGuard(h, id, 4);
      homes.push(h);
    }

    // Starting fleet: two small ships (a Scout and a Fighter), a medium Frigate and a large Destroyer. The Destroyer is an Epic card.
    const give = (type, fleet, rarity = 'normal') => { const sh = Ships.make(type, { rarity }); sh.starter = true; G.ships[sh.id] = sh; fleet.ships.push(sh.id); }; // starter: left out of raid strength early (AI.playerStrength)
    const guard = Ships.newFleet('Home Guard');
    guard.officer = 'kroll'; // the Home Guard starts under the Iron Matron (DATA.officers)
    give('scout', guard); give('fighter', guard); give('frigate', guard); give('destroyer', guard, 'epic');

    // Space near home is safe: no lairs next door.
    const dH = U.distances(home.id);
    for (const s of S) {
      if (dH[s.id] != null && dH[s.id] <= 1) s.guard = null;
    }
    home.explored = true;

    // A red hypergiant close to home, for show: two or three jumps out, not an alien home.
    const pick = U.shuffle(S.filter((s) => (dH[s.id] === 2 || dH[s.id] === 3) && !s.owner));
    const hyper = pick[0];
    if (hyper) { hyper.star = 'H'; hyper.planets = this.makePlanets('H'); }
    this.grow();
  },
};
