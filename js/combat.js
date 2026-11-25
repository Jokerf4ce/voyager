// Voyager — battles between fleets and sieges of colonies.

const Combat = {
  hpMod(owner) { return owner === 'player' ? State.mods().hp : 1 + G.cycle / 80; },

  // Applies damage to random ships of the given fleets. Returns {type: lost}.
  applyDamage(fleets, dmg, hpMod) {
    const lost = {};
    let guard = 0;
    while (dmg > 0 && guard++ < 500) {
      const pool = [];
      for (const f of fleets) for (const [t, n] of Object.entries(f.ships)) for (let i = 0; i < n; i++) pool.push([f, t]);
      if (!pool.length) break;
      const [f, t] = U.pick(pool);
      const hp = DATA.ships[t].hp * hpMod;
      if (dmg >= hp || Math.random() < dmg / hp) {
        f.ships[t]--;
        lost[t] = (lost[t] || 0) + 1;
      }
      dmg -= hp;
    }
    return lost;
  },

  sideAtk(fleets) { return fleets.reduce((a, f) => a + Fleets.stats(f).atk, 0); },
  sideSize(fleets) { return fleets.reduce((a, f) => a + Fleets.size(f), 0); },
  bastionAtk(s) { return s.colony ? s.colony.buildings.bastion * 6 * (s.owner === 'player' ? State.mods().bastion : 1 + G.cycle / 80) : 0; },

  lostText(lost) {
    const parts = Object.entries(lost).map(([t, n]) => `${n} ${DATA.ships[t].name}${n > 1 ? 's' : ''}`);
    return parts.length ? parts.join(', ') : 'nothing';
  },

  battle(s, a, b) {
    const A = Fleets.at(s.id, a), B = Fleets.at(s.id, b);
    const lostA = {}, lostB = {};
    const merge = (into, from) => { for (const k in from) into[k] = (into[k] || 0) + from[k]; };
    for (let round = 0; round < 3; round++) {
      if (!this.sideSize(A) || !this.sideSize(B)) break;
      let dA = this.sideAtk(A) * U.rand(0.8, 1.2);
      let dB = this.sideAtk(B) * U.rand(0.8, 1.2);
      if (s.owner === a) dA += this.bastionAtk(s);
      if (s.owner === b) dB += this.bastionAtk(s);
      merge(lostB, this.applyDamage(B, dA, this.hpMod(b)));
      merge(lostA, this.applyDamage(A, dB, this.hpMod(a)));
    }
    const aliveA = this.sideSize(A) > 0, aliveB = this.sideSize(B) > 0;
    Fleets.cleanup();

    if (a === 'player' || b === 'player') {
      const enemy = a === 'player' ? b : a;
      const myLost = a === 'player' ? lostA : lostB, theirLost = a === 'player' ? lostB : lostA;
      const iWon = a === 'player' ? aliveA && !aliveB : aliveB && !aliveA;
      const iLost = a === 'player' ? !aliveA : !aliveB;
      let outcome = 'The battle rages on.';
      if (iWon) {
        G.stats.battlesWon++;
        const kills = Object.values(theirLost).reduce((x, y) => x + y, 0);
        const shards = 3 + (enemy === 'monster' ? kills * 2 : kills);
        G.res.shards += shards;
        outcome = `Victory. +${shards} Shards harvested from the wrecks.`;
      } else if (iLost) {
        G.stats.battlesLost++;
        outcome = 'Defeat. Your ships are gone, and so are their crews.';
      }
      const rep = { c: G.cycle, sys: s.name, enemy: DATA.factions[enemy].name, myLost, theirLost, outcome, won: iWon, lost: iLost };
      G.reports.unshift(rep);
      if (G.reports.length > 30) G.reports.length = 30;
      Log.add(`⚔ Battle at ${s.name} vs ${rep.enemy}. Lost ${this.lostText(myLost)}; destroyed ${this.lostText(theirLost)}. ${outcome}`, iWon ? 'good' : iLost ? 'bad' : '');
    }
  },

  resolveAll() {
    for (const s of G.systems) {
      const owners = [...new Set(Fleets.at(s.id).map((f) => f.owner))];
      if (owners.length < 2) continue;
      // One battle per system per Cycle. The player is always involved if present, then the system owner.
      owners.sort((x, y) => (y === 'player') - (x === 'player') || (y === s.owner) - (x === s.owner));
      // Unarmed fleets (scouts, arks) usually slip past unseen.
      const unarmed = (o) => !Fleets.at(s.id, o).some((f) => Fleets.isCombat(f));
      if ((unarmed(owners[0]) || unarmed(owners[1])) && Math.random() < 0.7) continue;
      this.battle(s, owners[0], owners[1]);
    }
    this.sieges();
  },

  sieges() {
    for (const s of G.systems) {
      if (!s.colony || !s.owner) continue;
      const present = Fleets.at(s.id).filter((f) => f.owner !== s.owner && Fleets.isCombat(f) && f.owner !== 'monster');
      if (!present.length || Fleets.at(s.id, s.owner).length) continue;
      const attacker = present[0].owner;
      const atk = this.sideAtk(present.filter((f) => f.owner === attacker));
      // The bastion fires on the besiegers.
      const bAtk = this.bastionAtk(s);
      if (bAtk > 0) {
        const lost = this.applyDamage(present.filter((f) => f.owner === attacker), bAtk, this.hpMod(attacker));
        Fleets.cleanup();
        if (attacker === 'player' && Object.keys(lost).length) Log.add(`The bastion of ${s.name} destroys ${this.lostText(lost)}.`, 'bad');
      }
      s.colony.garrison -= atk * 0.6;
      if (s.colony.garrison > 0) {
        if (s.owner === 'player') Log.add(`⚠ ${s.name} is under siege by ${DATA.factions[attacker].name}! Garrison: ${Math.round(s.colony.garrison)}.`, 'bad');
        if (attacker === 'player') Log.add(`Sieging ${s.name}: garrison ${Math.round(s.colony.garrison)} left.`);
        continue;
      }
      const old = Colonies.capture(s.id, attacker);
      if (attacker === 'player') {
        G.stats.coloniesTaken++;
        G.res.shards += 10;
        s.explored = true;
        Log.add(`${s.name} falls to the Covenant. The ${DATA.factions[old].name} survivors are put to work. +10 Shards.`, 'good');
      } else if (old === 'player') {
        Log.add(`☠ ${s.name} has fallen to ${DATA.factions[attacker].name}. Its people will not be seen again.`, 'bad');
      }
    }
    this.checkFactions();
  },

  checkFactions() {
    for (const id of ['chorus', 'remnant']) {
      const ai = G.ai[id];
      if (!ai.alive) continue;
      if (!G.systems.some((s) => s.owner === id)) {
        ai.alive = false;
        G.fleets = G.fleets.filter((f) => f.owner !== id);
        Log.add(`${DATA.factions[id].name} is extinguished. Its last ships drift dark and silent.`, 'good');
        G.res.shards += 30;
      }
    }
    if (!G.systems.some((s) => s.owner === 'player')) G.over = 'lose';
    else if (!G.ai.chorus.alive && !G.ai.remnant.alive) G.over = 'win';
  },
};
