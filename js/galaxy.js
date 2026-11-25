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

  generate() {
    const count = DATA.config.systemCount;
    const pts = [];
    let tries = 0;
    while (pts.length < count && tries < 5000) {
      tries++;
      const p = { x: U.rand(0.05, 0.95), y: U.rand(0.08, 0.92) };
      if (pts.every((q) => Math.hypot(p.x - q.x, (p.y - q.y) * 0.62) > 0.1)) pts.push(p);
    }
    const used = new Set();
    const types = Object.keys(DATA.planetTypes);
    const systems = pts.map((p, i) => ({
      id: i, name: this.makeName(used), x: p.x, y: p.y,
      type: U.pick(types), lanes: [], owner: null, colony: null,
      explored: false, anomaly: null, star: U.pick(['#f0e0b0', '#f0a070', '#b0c8f0', '#f07050']),
    }));

    // Lanes: minimum spanning tree (always connected) plus some extra non-crossing links.
    const edges = [];
    const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 0.62);
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

    Colonies.found(home.id, 'player', { mine: 1, drill: 1, cogitator: 1, habitat: 1, shipyard: 1, bastion: 1 });
    home.name = 'Covenant Ark-Home';
    G.homeId = home.id;
    Colonies.found(chorus.id, 'chorus', { bastion: 1 });
    Colonies.found(remnant.id, 'remnant', { bastion: 1 });
    G.ai.chorus.homeId = chorus.id;
    G.ai.remnant.homeId = remnant.id;

    Fleets.create('player', home.id, { scout: 1 }, 'Pathfinder');
    Fleets.create('player', home.id, { scout: 1 }, 'Wayseeker');
    Fleets.create('player', home.id, { corvette: 3 }, 'Home Guard');
    Fleets.create('chorus', chorus.id, { corvette: 4 }, 'Chorus Swarm');
    Fleets.create('remnant', remnant.id, { corvette: 3, frigate: 1 }, 'Remnant Cohort');

    // Monsters guard random systems away from the homes.
    const homes = [home.id, chorus.id, remnant.id];
    const near = new Set(homes.flatMap((h) => [h, ...S[h].lanes]));
    const candidates = U.shuffle(S.filter((s) => !near.has(s.id)));
    candidates.slice(0, DATA.config.monsterSystems).forEach((s, i) => {
      Fleets.create('monster', s.id, { lurker: U.randInt(2, 4) + Math.floor(i / 2) }, 'Lurkers');
    });

    // Some systems hold exploration events.
    const evKeys = Object.keys(DATA.events);
    for (const s of S) if (!homes.includes(s.id) && Math.random() < 0.5) s.anomaly = U.pick(evKeys);

    Explore.reveal(home.id);
  },
};
