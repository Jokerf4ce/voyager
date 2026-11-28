// Voyager — game state, empire modifiers, save/load and offline progress.

let G = null;

const State = {
  newGame() {
    G = {
      version: 15,
      cycle: 1,
      officers: Object.fromEntries(Object.keys(DATA.officers).map((k) => [k, true])), // officers you command
      difficulty: null,   // chosen right after the galaxy is made (State.setDifficulty); null = not picked yet
      res: { metal: 120, rare: 20, organics: 40, electronics: 30, chemicals: 35, research: 0, crypto: 0 },
      systems: [],
      ships: {},          // every Covenant ship card, by id (js/ships.js)
      fleets: [],         // [{ id, name, ships: [shipId], mission }]
      armory: [],         // spare weapons
      surveys: [],        // survey probes on their way: [{ target, eta, total }]
      expeditions: [],    // colony expeditions on their way: [{ target, eta, total }]
      threats: [],        // alien raids on their way
      battle: null,       // the battle being fought (js/battle.js)
      battleQueue: [],
      nextFleetId: 1, nextShipId: 1, nextWeaponId: 1, nextThreatId: 1,
      homeId: 0,
      techs: {},
      researching: 'scanning',
      researchProgress: 0,
      ai: {
        chorus: { ore: 40, homeId: null, alive: true, aggro: 1.0 },
        remnant: { ore: 40, homeId: null, alive: true, aggro: 0.8 },
      },
      log: [],
      history: [],        // per-Cycle economy snapshots for the Statistics screen (Economy.record)
      pendingEvents: [],
      reports: [],
      lastSeen: Date.now(),
      over: null,
      stats: { explored: 0, battlesWon: 0, battlesLost: 0, coloniesTaken: 0 },
    };
    Galaxy.generate();
    Galaxy.placeStarts();
    Log.add('The Covenant fleet arrives at the edge of the Shroud. The homeworld is ash behind it, and the void ahead is full of things that hunger.', 'story');
    Log.add('Send your probes into the dark. Find worlds. Survive.', 'story');
    Log.add('Open the Star Map, pick a "?" system and send a survey probe to chart it.', 'story');
  },

  // Difficulty of this game (DATA.difficulty); saves from before difficulties existed are Learning.
  diff() { return DATA.difficulty[G && G.difficulty] || DATA.difficulty.learning; },
  // A price after the difficulty's cost multiplier (rounded up). what: a price the difficulty may exempt ('colonize').
  cost(c, what) { const d = this.diff(), m = what && (d.exempt || []).includes(what) ? 1 : d.costMult, out = {}; for (const k in c) out[k] = m === 1 ? c[k] : Math.ceil(c[k] * m); return out; },
  // Later achievements can only be unlocked on difficulties that allow them.
  achievementsAllowed() { return !!this.diff().achievements; },
  // Sets the difficulty of a freshly generated game and applies its starting conditions.
  setDifficulty(id) {
    const d = DATA.difficulty[id];
    if (!d || d.locked) return false;
    G.difficulty = id;
    for (const k of Object.keys(G.ai)) G.ai[k].ore = d.ai.startOre;
    Log.add(`Difficulty: ${d.name}.${id === 'commander' ? ' The xenos already know where you are.' : ''}`, id === 'commander' ? 'bad' : 'story');
    return true;
  },
  // A difficulty's text with its live numbers filled in.
  diffText(id, s) {
    const d = DATA.difficulty[id];
    return s.replace('{grace}', d.raids.graceColonies).replace('{from}', d.raids.fromCycle || 1).replace('{mult}', d.costMult);
  },

  // Sum of every bonus source (research).
  mods() {
    const m = { metal: 1, rare: 1, organics: 1, electronics: 1, chemicals: 1, research: 1, power: 1, infra: 1, compute: 1, atk: 1, hp: 1, bastion: 1, all: 1, aiAggro: 0, upkeep: 1, repair: 1, acc: 1 };
    const add = (mods, scale) => { for (const k in mods) m[k] = (m[k] || 0) + mods[k] * scale; };
    for (const [id, lvl] of Object.entries(G.techs)) if (lvl > 0 && DATA.techs[id]) add(DATA.techs[id].mods, lvl);
    return m;
  },

  // Save slots: 'main' is the real game; 'tester' is a generated test game (js/tester.js) kept separately.
  slot: 'main',
  key() { return DATA.config.saveKey + (this.slot === 'tester' ? '_tester' : ''); },

  save() {
    if (!G || (typeof Tutorial !== 'undefined' && Tutorial.sandboxed)) return; // the tutorial's practice battle is never saved
    G.lastSeen = Date.now();
    try { localStorage.setItem(this.key(), JSON.stringify(G)); } catch (e) { /* storage unavailable */ }
  },

  load() {
    let raw = null;
    try { raw = localStorage.getItem(this.key()); } catch (e) { return false; }
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      if (!data || data.version !== 15) return false;
      // technologies that no longer exist (e.g. the old hull techs, removed in v0.45) are dropped
      if (!data.officers) { // saves from before v0.66: every officer joins, and the Admiral takes the first fleet
        data.officers = Object.fromEntries(Object.keys(DATA.officers).map((k) => [k, true]));
        const first = (data.fleets || []).find((f) => !f.mission);
        if (first) first.officer = 'kroll';
      }
      for (const f of data.fleets || []) if (f.officer && !DATA.officers[f.officer]) f.officer = null;
      if (!data.history) data.history = [];
      let dropped = 0;
      if (data.techs) for (const id in data.techs) if (!DATA.techs[id]) { delete data.techs[id]; dropped++; }
      if (data.techs) for (const id in data.techs) data.techs[id] = Math.min(DATA.techMax, data.techs[id] | 0);
      if (dropped) { data.techs = {}; data.researching = 'scanning'; data.researchProgress = 0; } // a save from before v0.61: start the new tree clean
      if (dropped && data.log) data.log.unshift({ c: data.cycle, t: 'The Archives were reordered (v0.61): earlier research is lost, and the new, smaller projects start from nothing.', cls: 'story' });
      if (data.ships) for (const sh of Object.values(data.ships)) if (sh.upkeepRoll == null && DATA.shipTypes[sh.type]) sh.upkeep = Ships.rollUpkeep(sh); // v0.53 maintenance
      if (data.researching && !DATA.techs[data.researching]) { data.researching = 'scanning'; data.researchProgress = 0; }
      G = data;
      return true;
    } catch (e) { return false; }
  },

  wipe() {
    try { localStorage.removeItem(this.key()); } catch (e) { /* ignore */ }
  },

  exportSave() { return btoa(unescape(encodeURIComponent(JSON.stringify(G)))); },
  importSave(str) {
    const data = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    if (!data || data.version !== 15) throw new Error('Not a Voyager save');
    G = data;
  },

  // Idle layer: while the game was closed, the empire keeps producing at reduced efficiency.
  // AI and fleets are frozen, so nothing bad happens offline.
  applyOffline() {
    const secs = (Date.now() - (G.lastSeen || Date.now())) / 1000;
    const cycles = Math.min(DATA.config.offlineMaxCycles, Math.floor(secs / DATA.config.offlineSecondsPerCycle));
    if (cycles < 1 || G.over) return null;
    const inc = Economy.net();
    const eff = DATA.config.offlineEfficiency;
    const gained = {
      metal: Math.max(0, inc.metal) * cycles * eff,
      rare: Math.max(0, inc.rare) * cycles * eff,
      organics: Math.max(0, inc.organics) * cycles * eff,
      electronics: inc.electronics * cycles * eff,
      chemicals: inc.chemicals * cycles * eff,
      research: inc.research * cycles * eff,
      crypto: inc.crypto * cycles * eff,
    };
    for (const k in gained) G.res[k] += gained[k];
    const completed = Research.tick();
    for (let i = 0; i < Math.min(cycles, DATA.construction.cycles); i++) Colonies.tickBuild(true); // construction finishes while you are away (quietly)
    const mins = Math.floor(secs / 60);
    Log.add(`While you were away (${mins} min), the Covenant endured: ` + Object.entries(gained).map(([k, v]) => `+${U.amount(k, v)} ${DATA.resources[k].name}`).join(', ') + '.', 'good');
    return { mins, cycles, gained, completed };
  },
};

const Log = {
  add(text, cls = '') {
    G.log.unshift({ c: G.cycle, t: text, cls });
    if (G.log.length > 200) G.log.length = 200;
  },
};
