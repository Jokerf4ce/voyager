// Voyager — trading posts (v0.76). Some newly charted systems hold one on a planet: a Black Market, an Exchange Hub or an
// Independent Station. Each offers 1–3 services: ships for Crypto Shards, material exchange (always at a loss) and
// officers for Crypto Shards. Trade is remote (no fleet needed) while the system is not held by the xenos.
// Posts live in G.trade; their stock is restocked every DATA.trade.restock Cycles.

const Trade = {
  // A newly charted system may get a post (Explore.reveal).
  maybeSpawn(s, force = false) {
    const T = DATA.trade;
    if (!G.trade) G.trade = [];
    if (s.id === G.homeId || (s.owner && s.owner !== 'player') || !s.planets.length || this.at(s.id)) return null;
    if (!force && Math.random() >= T.chance) return null;
    const kind = U.pick(Object.keys(T.kinds));
    const used = new Set(G.trade.map((t) => t.name));
    let name;
    for (let i = 0; i < 20; i++) { name = U.pick(T.names); if (!used.has(name)) break; }
    // 1–3 services; each kind leans towards its own speciality, which it always offers
    const n = 1 + (Math.random() < 0.55 ? 1 : 0) + (Math.random() < 0.3 ? 1 : 0);
    const others = U.shuffle(Object.keys(T.services).filter((k) => k !== T.kinds[kind].special));
    const services = [T.kinds[kind].special, ...others].slice(0, n);
    const post = { id: G.nextTradeId = (G.nextTradeId || 1), sys: s.id, planet: U.pick(s.planets).idx, kind, name, services, next: 0 };
    G.nextTradeId++;
    G.trade.push(post);
    this.restock(post);
    Log.add(`⚖ ${s.name} hides a trading post: ${this.title(post)}, on ${Colonies.planetName(s, s.planets[post.planet])}. It offers ${services.map((k) => T.services[k].name.toLowerCase()).join(', ')}. Open Trade to deal with it.`, 'good');
    return post;
  },

  title(post) { return `${DATA.trade.kinds[post.kind].name} – ${post.name}`; },
  at(sysId) { return (G.trade || []).find((t) => t.sys === sysId) || null; },
  // A post can be dealt with while its system is not held by the xenos.
  open(post) { const s = G.systems[post.sys]; return !s.owner || s.owner === 'player'; },

  // New stock: ships, exchange rates and an officer, per the post's services.
  restock(post) {
    const T = DATA.trade, K = T.kinds[post.kind];
    post.next = G.cycle + T.restock;
    if (post.services.includes('ships')) {
      const types = Object.keys(DATA.shipTypes).filter((k) => !DATA.shipTypes[k].monster && !DATA.shipTypes[k].structure);
      post.ships = Array.from({ length: U.randInt(T.shipCount[0], T.shipCount[1]) }, () => {
        const sh = Ships.make(U.pick(types), { bias: K.shipBias });
        sh.price = this.shipPrice(sh, K.priceMult);
        return sh;
      });
    } else post.ships = [];
    if (post.services.includes('exchange')) {
      const mats = T.materials;
      post.rates = Array.from({ length: T.rateCount }, () => {
        const [from, to] = U.shuffle([...mats]).slice(0, 2);
        const loss = K.loss[0] + Math.random() * (K.loss[1] - K.loss[0]);
        const give = T.lot;
        const get = Math.max(1, Math.floor(give * T.value[from] / T.value[to] * (1 - loss)));
        return { from, to, give, get, loss: Math.round(loss * 100) };
      });
    } else post.rates = [];
    if (post.services.includes('officers')) {
      const o = Officers.generate(1).o1;
      const names = new Set(Object.values(DATA.officers).map((x) => x.name));
      for (let i = 0; i < 10 && names.has(o.name); i++) Object.assign(o, Officers.generate(1).o1);
      post.officer = { def: o, price: Math.round((T.officerPrice[0] + Math.random() * (T.officerPrice[1] - T.officerPrice[0])) * K.priceMult * 100) / 100 };
    } else post.officer = null;
  },

  shipPrice(sh, mult = 1) {
    const T = DATA.trade;
    return Math.round(T.shipPrice[sh.rarity] * T.sizePrice[sh.size] * mult * (0.9 + Math.random() * 0.2) * 100) / 100;
  },

  // Once per Cycle: posts whose time has come restock.
  tick() { for (const p of G.trade || []) if (G.cycle >= p.next) this.restock(p); },

  buyShipBlocker(post, i) {
    const sh = post.ships[i];
    if (!sh) return 'Sold';
    if (!this.open(post)) return 'Closed';
    if (G.res.crypto < sh.price - 1e-9) return 'Not enough Crypto Shards';
    if (Ships.hangarFree() <= 0 && !Ships.roomyFleet()) return 'Hangar full';
    return null;
  },
  buyShip(postId, i) {
    const post = (G.trade || []).find((t) => t.id === postId);
    if (!post || this.buyShipBlocker(post, i)) return null;
    const sh = post.ships.splice(i, 1)[0];
    G.res.crypto -= sh.price;
    delete sh.price;
    G.ships[sh.id] = sh; // its id was drawn when the post stocked it
    const f = Ships.roomyFleet();
    if (f) f.ships.push(sh.id);
    Log.add(`⚖ Bought ${DATA.shipRarities[sh.rarity].name} ${DATA.shipTypes[sh.type].name} "${sh.name}" at ${this.title(post)}${f ? `; it joins ${f.name}` : ''}.`, sh.rarity === 'normal' ? '' : 'good');
    return sh;
  },

  exchangeBlocker(post, i, times = 1) {
    const r = post.rates[i];
    if (!r) return 'No offer';
    if (!this.open(post)) return 'Closed';
    if ((G.res[r.from] || 0) < r.give * times) return `Not enough ${DATA.resources[r.from].name}`;
    return null;
  },
  exchange(postId, i, times = 1) {
    const post = (G.trade || []).find((t) => t.id === postId);
    if (!post || this.exchangeBlocker(post, i, times)) return false;
    const r = post.rates[i];
    G.res[r.from] -= r.give * times;
    G.res[r.to] += r.get * times;
    Log.add(`⚖ Traded ${r.give * times} ${DATA.resources[r.from].name} for ${r.get * times} ${DATA.resources[r.to].name} at ${this.title(post)}.`);
    return true;
  },

  officerBlocker(post) {
    if (!post.officer) return 'Nobody for hire';
    if (!this.open(post)) return 'Closed';
    if (G.res.crypto < post.officer.price - 1e-9) return 'Not enough Crypto Shards';
    return null;
  },
  hireOfficer(postId) {
    const post = (G.trade || []).find((t) => t.id === postId);
    if (!post || this.officerBlocker(post)) return null;
    const { def, price } = post.officer;
    G.res.crypto -= price;
    if (!G.officerDefs) G.officerDefs = JSON.parse(JSON.stringify(DATA.officerPresets)); // old saves: make the roster editable
    let n = Object.keys(G.officerDefs).length + 1, key;
    do key = 'o' + n++; while (G.officerDefs[key]);
    G.officerDefs[key] = def;
    G.officers[key] = true;
    post.officer = null;
    Log.add(`⚖ ${def.rank} ${def.name}, ${def.title}, signs on at ${this.title(post)}. Assign them to a fleet in the Hangar.`, 'good');
    return key;
  },
};
