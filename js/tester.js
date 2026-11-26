// Voyager — tester mode: a separate save slot with a ready-made empire for testing.
// Open it from Settings or by adding #tester to the address. The real save is never touched.

const Tester = {
  extraColonies: 3,
  explored: 10,

  // A fresh galaxy, then: more systems charted, three extra colonies with random buildings, and full stores.
  newTestGame() {
    State.newGame();
    const home = G.systems[G.homeId];
    const dH = U.distances(home.id);
    const aiHomes = Object.values(G.ai).map((a) => a.homeId);

    // Chart the nearest systems.
    const byDist = G.systems.slice().sort((a, b) => dH[a.id] - dH[b.id]);
    for (const s of byDist.slice(0, this.explored)) if (!s.explored) { s.explored = true; if (s.id !== G.homeId) G.stats.explored++; }
    Galaxy.grow();

    // Candidate planets: other worlds at home first, then free worlds in charted neighbouring systems.
    const free = (s) => s.planets.filter((p) => !p.colony && (p.slots.surface || p.slots.orbit));
    const picks = U.shuffle(free(home)).slice(0, 2);
    const out = picks.map((p) => ({ s: home, p }));
    for (const s of byDist) {
      if (out.length >= this.extraColonies) break;
      if (s.id === home.id || !s.explored || s.owner || aiHomes.includes(s.id) || Missions.guard(s)) continue;
      const ps = free(s);
      if (ps.length) out.push({ s, p: ps[Math.floor(Math.random() * ps.length)] });
    }

    for (const { s, p } of out) {
      s.anomaly = null;
      Colonies.found(s.id, p.idx, 'player', this.randomLayer(p, 'surface'), this.randomLayer(p, 'orbit'));
      p.colony.founded = 1;
    }
    this.fixCaps();

    for (const k in G.res) G.res[k] = 1500;

    // Ships of every size and rarity: two fleets and a full hangar, plus spare weapons and Arks.
    const add = (type, rarity, fleet) => { const sh = Ships.make(type, { rarity }); G.ships[sh.id] = sh; if (fleet) fleet.ships.push(sh.id); return sh; };
    const strike = Ships.newFleet('Ash Lance');
    add('destroyer', 'legendary', strike); add('frigate', 'epic', strike); add('corvette', 'strong', strike); add('heavy', 'strong', strike); add('fighter', 'normal', strike);
    const wolves = Ships.newFleet('Grey Vigil');
    add('battleship', 'omega', wolves); add('gunboat', 'normal', wolves); add('scout', 'strong', wolves);
    for (const [t, r] of [['carrier', 'strong'], ['frigate', 'normal'], ['fighter', 'epic'], ['scout', 'normal'], ['heavy', 'normal'], ['gunboat', 'strong']]) add(t, r, null);
    for (const z of ['S', 'M', 'L', 'S', 'M']) G.armory.push(Ships.makeWeapon(z, Ships.rollRarity(2)));
    // an alien raid already on its way, to try a defense battle
    const target = AI.pickTarget('chorus');
    if (target) G.threats.push({ id: 't' + (G.nextThreatId++), owner: 'chorus', name: 'Chorus Raid', target: target.s.id, eta: 2, total: 2, ships: AI.team('chorus', 3) });
    G.tester = true;
    G.log = [];
    Log.add('Tester mode: ' + out.length + ' extra colonies with random buildings.');
  },

  // Random buildings at random levels (1–4) for one layer of a planet, filling its slots.
  randomLayer(p, layer) {
    const out = {};
    const n = p.slots[layer] || 0;
    const fits = Object.keys(DATA.buildings).filter((k) => {
      const d = DATA.buildings[k];
      if (!d.layers.includes(layer)) return false;
      if (d.gathers && !(Economy.rating(p, d.gathers) > 0 || (d.also && Economy.rating(p, d.also) > 0))) return false;
      return true;
    });
    for (let i = 0; i < n && fits.length; i++) {
      const k = fits.splice(Math.floor(Math.random() * fits.length), 1)[0];
      out[k] = 1 + Math.floor(Math.random() * 4);
    }
    return out;
  },

  // Raise capacity buildings until nothing is over its cap, so the test game starts without rationing.
  fixCaps() {
    const providers = { power: ['fusion', 'solar'], infra: ['dome', 'ring'], compute: ['cogitator'] };
    for (let guard = 0; guard < 200; guard++) {
      const c = Economy.caps();
      const short = Object.keys(providers).find((k) => c[k].used > c[k].cap);
      if (!short) return;
      let done = false;
      for (const { p } of U.shuffle(Colonies.playerPlanets().slice())) {
        for (const layer of ['surface', 'orbit']) {
          for (const key of providers[short]) {
            if (!DATA.buildings[key].layers.includes(layer)) continue;
            if (p.colony[layer][key] > 0) { p.colony[layer][key]++; done = true; }
            else if (Colonies.slotsUsed(p, layer) < Colonies.slots(p, layer)) { p.colony[layer][key] = 1; done = true; }
            if (done) break;
          }
          if (done) break;
        }
        if (done) break;
      }
      if (!done) { // no free slot anywhere: grow the capital's power plant
        const cap = G.systems[G.homeId].planets[G.homePlanet].colony;
        const key = { power: 'fusion', infra: 'dome', compute: 'cogitator' }[short];
        const layer = cap.surface[key] ? 'surface' : 'orbit';
        cap[layer][key] = (cap[layer][key] || 0) + 1;
      }
    }
  },
};
