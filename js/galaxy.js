// Voyager — galaxy generation: systems, hyperlanes, starting positions.

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

  generate() {
    const count = DATA.config.systemCount;
    const pts = [];
    const asp = StarMap.H / StarMap.W; // keep systems evenly spaced on the wide map
    let tries = 0;
    while (pts.length < count && tries < 5000) {
      tries++;
      const p = { x: U.rand(0.05, 0.95), y: U.rand(0.08, 0.92) };
      if (pts.every((q) => Math.hypot(p.x - q.x, (p.y - q.y) * asp) > 0.1)) pts.push(p);
    }
    const used = new Set();
    const starWeights = Object.fromEntries(Object.entries(DATA.starClasses).map(([k, c]) => [k, c.weight]));
    const systems = pts.map((p, i) => {
      const star = Planets.weighted(starWeights);
      return {
        id: i, name: this.makeName(used), x: p.x, y: p.y, star,
        planets: this.makePlanets(star), lanes: [], owner: null, garrison: 0,
        explored: false, anomaly: null,
      };
    });

    // Lanes: minimum spanning tree (always connected) plus some extra non-crossing links.
    const edges = [];
    const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * StarMap.H / StarMap.W);
    const inTree = new Set([0]);
    while (inTree.size < systems.length) {
      let best = null;
      for (const i of inTree) for (const s of systems) {
        if (inTree.has(s.id)) continue;
        const d = dist(systems[i], s);
        if (!best || d < best.d) best = { a: i, b: s.id, d };
      }
      edges.push([best.a, best.b]);
      inTree.add(best.b);
    }
    const crosses = (a, b) => edges.some(([c, d]) => this.segmentsCross(systems[a], systems[b], systems[c], systems[d]));
    for (const s of systems) {
      const near = systems.filter((t) => t.id !== s.id).sort((a, b) => dist(s, a) - dist(s, b)).slice(0, 3);
      for (const t of near) {
        if (edges.some(([a, b]) => (a === s.id && b === t.id) || (a === t.id && b === s.id))) continue;
        if (Math.random() < 0.45 && dist(s, t) < 0.28 && !crosses(s.id, t.id)) edges.push([s.id, t.id]);
      }
    }
    for (const [a, b] of edges) { systems[a].lanes.push(b); systems[b].lanes.push(a); }
    return systems;
  },

  // Place the player and the AI empires as far apart as possible, then scatter monsters.
  placeStarts() {
    const S = G.systems;
    const home = S.reduce((best, s) => (s.x + s.y * 0.5 < best.x + best.y * 0.5 ? s : best), S[0]);
    const dP = U.distances(home.id);
    const chorus = S.reduce((b, s) => (dP[s.id] > dP[b.id] ? s : b), S[0]);
    const dC = U.distances(chorus.id);
    const remnant = S.filter((s) => s !== home && s !== chorus)
      .reduce((b, s) => (Math.min(dP[s.id], dC[s.id]) > Math.min(dP[b.id], dC[b.id]) ? s : b));

    // The home system always has a decent rocky world and at least three planets.
    // The home star is a yellow dwarf like the lost Sun, with a large Terran capital.
    home.star = 'G';
    home.planets = this.makePlanets('G');
    while (home.planets.length < 3) home.planets.push(Planets.random(home.planets.length, 'G'));
    const capital = Planets.make(0, 'silicate', 'large', 'temperate', 5, 'G');
    home.planets[0] = capital;
    this.orderPlanets(home.planets);
    home.name = 'Covenant Ark-Home';
    G.homeId = home.id;
    G.homePlanet = capital.idx;
    Colonies.found(home.id, capital.idx, 'player', { mine: 1, harvester: 1, refinery: 1, dome: 1, fusion: 2 }, { shipyard: 1, lab: 1, cogitator: 1, chemplant: 1 });
    capital.colony.capital = true;
    Colonies.found(chorus.id, this.bestPlanet(chorus), 'chorus', { bastion: 1 });
    Colonies.found(remnant.id, this.bestPlanet(remnant), 'remnant', { bastion: 1 });
    G.ai.chorus.homeId = chorus.id;
    G.ai.remnant.homeId = remnant.id;

    // Starting fleets: two scouts and a small guard of fighters, all Normal cards.
    const give = (type, fleet) => { const sh = Ships.make(type, { rarity: 'normal' }); G.ships[sh.id] = sh; fleet.ships.push(sh.id); };
    give('scout', Ships.newFleet('Pathfinder'));
    give('scout', Ships.newFleet('Wayseeker'));
    const guard = Ships.newFleet('Home Guard');
    give('fighter', guard); give('fighter', guard); give('heavy', guard);
    G.arks = 1;
    AI.setGuard(chorus, 'chorus', 4);
    AI.setGuard(remnant, 'remnant', 4);

    // Monsters guard random systems away from the homes.
    const homes = [home.id, chorus.id, remnant.id];
    const near = new Set(homes.flatMap((h) => [h, ...S[h].lanes]));
    const candidates = U.shuffle(S.filter((s) => !near.has(s.id)));
    candidates.slice(0, DATA.config.monsterSystems).forEach((s, i) => {
      // lairs farther down the list are nastier: more ships, bigger monsters
      const n = Math.min(DATA.fleetMax, U.randInt(2, 3) + Math.floor(i / 2));
      const ships = [];
      for (let k = 0; k < n; k++) {
        const r = Math.random() * (1 + i * 0.25);
        ships.push(Ships.make(r > 1.4 ? 'leviathan' : r > 0.8 ? 'maw' : 'lurker', { owner: 'monster', rarity: Ships.rollRarity(i * 0.3) }));
      }
      s.guard = { owner: 'monster', name: i > 3 ? 'Lurker Brood' : 'Lurkers', ships };
    });

    // Some systems hold exploration events.
    const evKeys = Object.keys(DATA.events);
    for (const s of S) if (!homes.includes(s.id) && Math.random() < 0.5) s.anomaly = U.pick(evKeys);

    // Systems already charted at the start (by default only home; its neighbours show as '?').
    const dH = U.distances(home.id);
    const byDist = S.slice().sort((a, b) => dH[a.id] - dH[b.id]);
    for (const s of byDist.slice(0, DATA.config.startExplored)) s.explored = true;

    // A red hypergiant close to home, for show: not home, not next door, not an alien home.
    const nearby = byDist.slice(0, DATA.config.hypergiantWithin);
    const pick = nearby.filter((s) => !homes.includes(s.id) && dH[s.id] >= 2 && !s.owner);
    const hyper = pick[pick.length - 1] || nearby.find((s) => s.id !== home.id && !s.owner);
    if (hyper) {
      hyper.star = 'H';
      hyper.planets = this.makePlanets('H');
      hyper.anomaly = null;
    }
  },
};
