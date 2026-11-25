// Voyager — game state, empire modifiers, save/load and offline progress.

let G = null;

const State = {
  newGame() {
    G = {
      version: 1,
      cycle: 1,
      res: { ore: 120, energy: 60, research: 0, shards: 25 },
      systems: [],
      fleets: [],
      nextFleetId: 1,
      homeId: 0,
      techs: {},
      researching: 'deepcore',
      researchProgress: 0,
      collection: {},
      pity: 0,
      pulls: 0,
      ai: {
        chorus: { ore: 40, homeId: null, alive: true, aggro: 1.0 },
        remnant: { ore: 40, homeId: null, alive: true, aggro: 0.8 },
      },
      log: [],
      pendingEvents: [],
      reports: [],
      lastSeen: Date.now(),
      over: null,
      stats: { explored: 0, battlesWon: 0, battlesLost: 0, coloniesTaken: 0 },
    };
    G.systems = Galaxy.generate();
    Galaxy.placeStarts();
    Log.add('The Covenant fleet arrives at the edge of the Shroud. The homeworld is ash behind it, and the void ahead is full of things that hunger.', 'story');
    Log.add('Send your scouts into the dark. Find worlds. Survive.', 'story');
  },

  // Sum of every bonus source: techs, leaders and relics.
  mods() {
    const m = { ore: 1, energy: 1, research: 1, atk: 1, hp: 1, bastion: 1, all: 1, shardIncome: 0, exploreShards: 0, aiAggro: 0 };
    const add = (mods, scale) => { for (const k in mods) m[k] = (m[k] || 0) + mods[k] * scale; };
    for (const [id, lvl] of Object.entries(G.techs)) if (lvl > 0) add(DATA.techs[id].mods, lvl);
    for (const [id, c] of Object.entries(G.collection)) {
      const item = Gacha.item(id);
      if (item && item.mods) add(item.mods, 1 + 0.5 * (c.rank - 1));
    }
    return m;
  },

  save() {
    if (!G) return;
    G.lastSeen = Date.now();
    try { localStorage.setItem(DATA.config.saveKey, JSON.stringify(G)); } catch (e) { /* storage unavailable */ }
  },

  load() {
    let raw = null;
    try { raw = localStorage.getItem(DATA.config.saveKey); } catch (e) { return false; }
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      if (!data || data.version !== 1) return false;
      G = data;
      return true;
    } catch (e) { return false; }
  },

  wipe() {
    try { localStorage.removeItem(DATA.config.saveKey); } catch (e) { /* ignore */ }
  },

  exportSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(G)))); },
  importSave(str) {
    const data = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    if (!data || data.version !== 1) throw new Error('Not a Voyager save');
    G = data;
  },

  // Idle layer: while the game was closed, the empire keeps producing at reduced efficiency.
  // AI and fleets are frozen, so nothing bad happens offline.
  applyOffline() {
    const secs = (Date.now() - (G.lastSeen || Date.now())) / 1000;
    const cycles = Math.min(DATA.config.offlineMaxCycles, Math.floor(secs / DATA.config.offlineSecondsPerCycle));
    if (cycles < 1 || G.over) return null;
    const inc = Economy.income();
    const eff = DATA.config.offlineEfficiency;
    const gained = {
      ore: Math.max(0, inc.ore) * cycles * eff,
      energy: Math.max(0, inc.energy - inc.upkeep) * cycles * eff,
      research: inc.research * cycles * eff,
      shards: Math.floor((inc.shards * cycles + cycles / 10) * eff),
    };
    for (const k in gained) G.res[k] += gained[k];
    const completed = Research.tick();
    const mins = Math.floor(secs / 60);
    Log.add(`While you were away (${mins} min), the Covenant endured: +${U.fmt(gained.ore)} Ore, +${U.fmt(gained.energy)} Energy, +${U.fmt(gained.research)} Research, +${gained.shards} Shards.`, 'good');
    return { mins, cycles, gained, completed };
  },
};

const Log = {
  add(text, cls = '') {
    G.log.unshift({ c: G.cycle, t: text, cls });
    if (G.log.length > 200) G.log.length = 200;
  },
};
