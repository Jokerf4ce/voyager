// Voyager — alien AI empires. They grow, spread, garrison their worlds with ship cards and send raids.
// Garrisons live on the system (s.guard); raids travel as threats (js/missions.js) and are fought as battles.

const AI = {
  ids: ['chorus', 'remnant'],
  weapons: { chorus: 'energy', remnant: 'physical' }, // each faction leans toward one damage type
  shipCost: { S: 14, M: 30, L: 65 },

  // Better rarities and bigger hulls as the game goes on.
  bias() { return Math.min(5, G.cycle / 35) + State.diff().ai.bias; },
  pickSize() {
    const c = G.cycle, r = Math.random();
    if (c > 60 && r < 0.3) return 'L';
    if (c > 30 && r < 0.6) return 'M';
    return 'S';
  },
  makeShip(id, size = this.pickSize()) {
    const types = Object.keys(DATA.shipTypes).filter((k) => DATA.shipTypes[k].size === size && !DATA.shipTypes[k].monster && !DATA.shipTypes[k].structure && k !== 'scout');
    const type = U.pick(types);
    return Ships.make(type, { owner: id, kindBias: this.weapons[id], bias: this.bias(), name: `${DATA.factions[id].short} ${DATA.shipTypes[type].name}` });
  },
  team(id, n) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.makeShip(id));
    return out;
  },
  setGuard(s, id, n) { s.guard = { owner: id, name: DATA.factions[id].short + ' Garrison', ships: this.team(id, n) }; },

  // Colonies the player founded besides the capital (the grace period lasts until raids().graceColonies).
  foundedColonies() { return Colonies.playerPlanets().filter(({ p }) => !p.colony.capital).length; },
  // This game's raid settings (they depend on the difficulty, see DATA.difficulty).
  raids() { return State.diff().raids; },
  // One sentence on when raids start in this game (tutorial and Overview).
  raidRule() {
    const R = this.raids();
    if (R.graceColonies) return `The xenos ignore you at first. Raids only begin once you have founded <b>${R.graceColonies}</b> colonies besides your capital.`;
    return `On <b>${State.diff().name}</b> there is no grace period: the xenos know where you are, and raids can come from Cycle <b>${R.fromCycle || 1}</b>.`;
  },
  // Raids are possible once the grace period is over. The first time, the player is warned.
  raidsOpen() {
    if (G.raidsOpen) return true;
    const R = this.raids();
    if (this.foundedColonies() < (R.graceColonies || 0) || G.cycle < (R.fromCycle || 0)) return false;
    G.raidsOpen = true;
    Log.add('⚠ The Covenant has grown loud enough to be heard. The xenos have noticed you: from now on, expect raids on your colonies.', 'bad');
    if (typeof Voice !== 'undefined' && VoiceLines.signatures) Voice.say('signatures', (VoiceTriggers.combat || {}).style);
    return true;
  },

  tick() {
    const aggro = State.mods().aiAggro;
    for (const id of this.ids) {
      const ai = G.ai[id];
      if (!ai.alive) continue;
      const owned = G.systems.filter((s) => s.owner === id);
      ai.ore += owned.length * (3 + G.cycle * 0.06) * State.diff().ai.income;

      // garrisons repair a little each Cycle
      for (const s of owned) if (s.guard) for (const sh of s.guard.ships) sh.hullNow = Math.min(sh.hull, sh.hullNow + Math.ceil(sh.hull * 0.1));

      // Expand to neighbouring empty, unguarded systems.
      if (ai.ore >= 55 && Math.random() < 0.2) {
        const targets = new Set();
        for (const s of owned) for (const n of s.lanes) { const t = G.systems[n]; if (!t.owner && !Missions.guard(t)) targets.add(n); }
        if (targets.size) {
          const t = G.systems[U.pick([...targets])];
          ai.ore -= 55;
          Colonies.found(t.id, Galaxy.bestPlanet(t), id, Math.random() < 0.5 ? { bastion: 1 } : {});
          this.setGuard(t, id, 1);
          if (Explore.isSeen(t.id)) Log.add(`${DATA.factions[id].name} spreads to ${t.name}.`, 'bad');
        }
      }

      // Reinforce garrisons: the home system up to a full five, other worlds up to two or three.
      const order = owned.slice().sort((a, b) => (b.id === ai.homeId) - (a.id === ai.homeId));
      for (const s of order) {
        if (!s.guard) s.guard = { owner: id, name: DATA.factions[id].short + ' Garrison', ships: [] };
        const want = s.id === ai.homeId ? DATA.fleetMax : G.cycle > 40 ? 3 : 2;
        while (s.guard.ships.length < want) {
          const size = this.pickSize();
          if (ai.ore < this.shipCost[size]) break;
          ai.ore -= this.shipCost[size];
          s.guard.ships.push(this.makeShip(id, size));
        }
      }
      // A full home garrison gets refitted: the weakest ship is replaced.
      const home = G.systems[ai.homeId];
      if (home.owner === id && home.guard && home.guard.ships.length >= DATA.fleetMax && ai.ore > 90 && Math.random() < 0.2) {
        const weakest = home.guard.ships.reduce((a, b) => (Ships.power(a) < Ships.power(b) ? a : b));
        const size = this.pickSize();
        ai.ore -= this.shipCost[size];
        home.guard.ships[home.guard.ships.indexOf(weakest)] = this.makeShip(id, size);
      }

      // Raids on the Covenant (after the grace period; see DATA.raids and DATA.difficulty).
      const R = this.raids();
      if (this.raidsOpen() && !G.threats.some((t) => t.owner === id) && G.cycle - (ai.lastRaid || -999) >= R.cooldown
          && Math.random() < R.chance * (ai.aggro + aggro)) {
        const n = Math.min(DATA.fleetMax, 2 + (R.extraShips || 0) + Math.floor(Math.max(0, G.cycle - 20) / 30));
        const cost = n * 16;
        const target = this.pickTarget(id);
        if (target && ai.ore >= cost) {
          ai.ore -= cost;
          ai.lastRaid = G.cycle;
          const eta = Math.max(2, target.d);
          G.threats.push({ id: 't' + (G.nextThreatId++), owner: id, name: `${DATA.factions[id].short} Raid`, target: target.s.id, eta, total: eta, ships: this.team(id, n) });
          Log.add(`⚠ Long-range augurs detect a ${DATA.factions[id].short} raid of ${n} ships moving toward ${target.s.name}. Arrival in ${eta} Cycles.`, 'bad');
        }
      }
    }
  },

  // The Covenant system nearest to this faction's worlds. Raids go for the outlying colonies first: the capital
  // system is only targeted when it is the only one left (or the only one they can reach).
  pickTarget(id) {
    const mine = G.systems.filter((s) => s.owner === id);
    let best = null, capital = null;
    for (const s of mine) {
      const d = U.distances(s.id);
      for (const t of Colonies.playerSystems()) {
        if (d[t.id] == null) continue;
        if (t.id === G.homeId) { if (!capital || d[t.id] < capital.d) capital = { s: t, d: d[t.id] }; continue; }
        if (!best || d[t.id] < best.d) best = { s: t, d: d[t.id] };
      }
    }
    return best || capital;
  },
};
