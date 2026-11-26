// Voyager — turn-based card battles. Two sides of up to five ships face each other.
// Every round each ship acts once, fastest first: it fires one ready weapon.
// Ships stand in lanes (their position in the fleet). Targeting is automatic: the ship opposite, else the
// nearest one by DATA.targetOrder (right, left, two right, two left …). Shots across lanes hit far less often.
// Shields soak damage first, then hull. Physical weapons hit hull hard, energy weapons strip shields.
// Sizes beat each other: Small > Large > Medium > Small.
//
// G.battle (saved, so a battle survives a reload):
//   { kind: 'attack' | 'defend', sys, fleetId, threat, phase: 'setup' | 'fight' | 'over',
//     units: [unit], order: [unit index], turn, round, log: [text], result, auto }
// G.battleQueue: battles waiting their turn.

const Battle = {
  maxRounds: 25,

  queue(setup) {
    G.battleQueue.push(setup);
    if (!G.battle) this.next();
  },

  next() {
    const s = G.battleQueue.shift();
    if (!s) return;
    G.battle = Object.assign({ phase: s.kind === 'defend' ? 'setup' : 'fight', units: [], order: [], turn: 0, round: 0, log: [], result: null, auto: false }, s);
    if (G.battle.phase === 'fight') this.begin();
    if (typeof Music !== 'undefined') Music.battle(0.8);
    if (typeof Voice !== 'undefined') Voice.trigger('combat', true); // a warning from the Assistant, in red
  },

  // ---------- setting up ----------
  unitFrom(ship, side, ref) {
    const m = side === 'player' ? State.mods() : { hp: 1, atk: 1 };
    return {
      side, ref, name: ship.name, type: ship.type, size: ship.size, rarity: ship.rarity,
      shieldMax: Math.round(ship.shield * m.hp), shield: Math.round(ship.shield * m.hp),
      hullMax: Math.round(ship.hull * m.hp), hull: Math.max(1, Math.round((ship.hullNow == null ? ship.hull : ship.hullNow) * m.hp)),
      speed: ship.speed, maneuver: ship.maneuver, dmgMult: m.atk,
      weapons: ship.weapons.filter(Boolean).map((w) => Object.assign({}, w, { cdLeft: 0 })),
      dead: false,
    };
  },

  // The defending side chooses a fleet (or none) before a raid battle starts.
  defendWith(fleetId) {
    const b = G.battle;
    if (!b || b.phase !== 'setup') return;
    const f = fleetId ? Ships.fleet(+fleetId) : null;
    if (f && (f.mission || !f.ships.length)) return;
    b.fleetId = f ? f.id : null;
    if (f) { f.mission = { kind: 'defend', target: b.sys, phase: 'battle', eta: 0, total: 0 }; }
    b.phase = 'fight';
    this.begin();
  },

  begin() {
    const b = G.battle, s = G.systems[b.sys];
    const units = [];
    const f = b.fleetId != null ? Ships.fleet(b.fleetId) : null;
    if (f) for (const ship of Ships.fleetShips(f)) units.push(this.unitFrom(ship, 'player', ship.id));
    if (b.kind === 'attack') {
      const g = Missions.guard(s);
      if (g) g.ships.slice(0, DATA.fleetMax).forEach((ship, i) => units.push(this.unitFrom(ship, 'enemy', i)));
      const def = s.owner && s.owner !== 'player' ? Ships.defenseCard(s) : null;
      if (def) units.push(this.unitFrom(def, 'enemy', 'defense'));
    } else {
      const def = Ships.defenseCard(s);
      if (def) units.push(this.unitFrom(def, 'player', 'defense'));
      b.threat.ships.forEach((ship, i) => units.push(this.unitFrom(ship, 'enemy', i)));
    }
    b.units = units;
    this.lanes();
    b.round = 0;
    this.say(b.kind === 'attack' ? `Battle at ${s.name}: ${f ? f.name : 'your fleet'} engages ${(Missions.guard(s) || { name: DATA.factions[s.owner].name }).name}.`
      : `${b.threat.name} reaches ${s.name}!`);
    if (!this.alive('player').length) return this.finish('lose');
    if (!this.alive('enemy').length) return this.finish('win');
    this.newRound();
  },

  // ---------- lanes and targets ----------
  // Lane = position on its side, in fleet order (the Planetary Defenses take the next free lane).
  lanes() {
    for (const side of ['player', 'enemy']) G.battle.units.filter((u) => u.side === side).forEach((u, i) => { if (u.lane == null) u.lane = i; });
  },
  laneCount() { return Math.max(DATA.fleetMax, ...G.battle.units.map((u) => u.lane + 1)); },

  // The ship this unit shoots at: the one opposite, else by DATA.targetOrder.
  targetFor(u) {
    this.lanes();
    const foes = this.alive(u.side === 'player' ? 'enemy' : 'player');
    for (const off of DATA.targetOrder) {
      const t = foes.find((f) => f.lane === u.lane + off);
      if (t) return t;
    }
    return foes[0] || null;
  },

  // ---------- turn flow ----------
  alive(side) { return G.battle.units.filter((u) => u.side === side && !u.dead); },
  current() { const b = G.battle; return b && b.phase === 'fight' ? b.units[b.order[b.turn]] : null; },
  // Is the game waiting for the player to pick an action?
  waiting() { const u = this.current(); return !!u && u.side === 'player' && !G.battle.auto; },

  newRound() {
    const b = G.battle;
    b.round++;
    if (b.round > this.maxRounds) return this.finish(b.kind === 'attack' ? 'draw' : 'win');
    // fastest first; ties broken at random
    b.order = b.units.map((u, i) => ({ i, k: u.speed + Math.random() * 0.5 })).filter((x) => !b.units[x.i].dead).sort((a, c) => c.k - a.k).map((x) => x.i);
    b.turn = 0;
    this.say(`— Round ${b.round} —`);
    this.startTurn();
  },

  startTurn() {
    const b = G.battle;
    while (b.turn < b.order.length && b.units[b.order[b.turn]].dead) b.turn++;
    if (b.turn >= b.order.length) return this.newRound();
    const u = b.units[b.order[b.turn]];
    for (const w of u.weapons) w.cdLeft = Math.max(0, w.cdLeft - 1);
    if (!u.weapons.some((w) => w.cdLeft === 0)) { this.say(`${u.name} recharges its weapons.`); return this.endTurn(); }
  },

  endTurn() {
    const b = G.battle;
    if (!this.alive('enemy').length) return this.finish('win');
    if (!this.alive('player').length) return this.finish('lose');
    b.turn++;
    this.startTurn();
  },

  // Advance one step for a computer-controlled ship (enemy, or yours on Auto). Returns false if waiting for the player.
  step() {
    const b = G.battle;
    if (!b || b.phase !== 'fight') return false;
    const u = this.current();
    if (!u) return false;
    if (u.side === 'player' && !b.auto) return false;
    const pick = this.choose(u);
    if (pick) this.fire(u, pick.w, pick.t); else { this.say(`${u.name} holds.`); this.endTurn(); }
    return true;
  },

  // The player's action: which weapon to fire. The target is automatic.
  act(wIdx) {
    const u = this.current();
    if (!u || u.side !== 'player') return false;
    const w = u.weapons[wIdx], t = this.targetFor(u);
    if (!w || w.cdLeft > 0 || !t) return false;
    this.fire(u, w, t);
    return true;
  },

  // Play the rest of the battle instantly (both sides on Auto).
  resolve() {
    const b = G.battle;
    if (!b || b.phase !== 'fight') return;
    b.auto = true;
    let guard = 0;
    while (G.battle === b && b.phase === 'fight' && guard++ < 2000) this.step();
  },

  retreat() {
    const b = G.battle;
    if (!b || b.phase !== 'fight') return;
    this.say('Your ships break off and run.');
    this.finish(b.kind === 'attack' ? 'retreat' : 'lose');
  },

  // ---------- damage ----------
  sizeMult(a, t) {
    if (DATA.sizes[a.size].beats === t.size) return DATA.sizeAdvantage;
    if (DATA.sizes[t.size].beats === a.size) return DATA.sizeDisadvantage;
    return 1;
  },
  // a = attacker (for the lane penalty); without it, the chance as if shooting straight ahead
  hitChance(w, t, a) {
    const lane = a && a.lane !== t.lane ? DATA.offLaneHit : 1;
    return Math.max(0.05, (w.acc / 100) * (1 - t.maneuver / 100) * lane);
  },

  // Damage a weapon would do right now: { shield, hull } taken off the target (before randomness).
  preview(a, w, t, roll = 1) {
    const dt = DATA.damageTypes[w.kind];
    const base = w.dmg * a.dmgMult * this.sizeMult(a, t) * roll;
    let toShield = 0, toHull = 0;
    if (t.shield > 0) {
      const eff = base * dt.shield;
      if (eff <= t.shield) toShield = eff;
      else { toShield = t.shield; toHull = base * (1 - t.shield / eff) * dt.hull; }
    } else toHull = base * dt.hull;
    return { shield: toShield, hull: Math.min(t.hull, toHull) };
  },

  fire(a, w, t) {
    const b = G.battle;
    w.cdLeft = w.cd + 1;
    const across = a.lane !== t.lane ? ' (across lanes)' : '';
    if (Math.random() > this.hitChance(w, t, a)) {
      this.say(`${a.name} fires ${w.name} at ${t.name}${across}: missed.`, a.side);
      return this.endTurn();
    }
    const d = this.preview(a, w, t, U.rand(0.9, 1.1));
    t.shield = Math.max(0, Math.round((t.shield - d.shield) * 10) / 10);
    t.hull = Math.max(0, Math.round((t.hull - d.hull) * 10) / 10);
    const sm = this.sizeMult(a, t);
    const parts = [];
    if (d.shield >= 0.5) parts.push(`${Math.round(d.shield)} shield`);
    if (d.hull >= 0.5) parts.push(`${Math.round(d.hull)} hull`);
    let line = `${a.name} hits ${t.name}${across} with ${w.name}: ${parts.join(' + ') || 'no damage'}${sm > 1 ? ' (size advantage!)' : sm < 1 ? ' (size disadvantage)' : ''}.`;
    if (t.hull <= 0) { t.dead = true; line += ` ${t.name} is destroyed!`; }
    this.say(line, a.side);
    b.lastHit = { from: b.units.indexOf(a), to: b.units.indexOf(t), t: Date.now() };
    this.endTurn();
  },

  // Enemy (and Auto) choice: the target is fixed by lane; pick the weapon with the best expected damage.
  choose(u) {
    const t = this.targetFor(u);
    if (!t) return null;
    let best = null;
    for (const w of u.weapons) {
      if (w.cdLeft > 0) continue;
      const v = this.expected(u, w, t) * U.rand(0.9, 1.1);
      if (!best || v > best.v) best = { w, t, v };
    }
    return best;
  },
  // Expected value of a shot (hull counts more, kills count most).
  expected(u, w, t) {
    const d = this.preview(u, w, t);
    let v = (d.shield * 0.6 + d.hull) * this.hitChance(w, t, u);
    if (d.hull >= t.hull) v *= 2.5;
    return v;
  },

  say(text, side) {
    const b = G.battle;
    b.log.push({ t: text, s: side || '' });
    if (b.log.length > 80) b.log.shift();
  },

  // ---------- the end ----------
  finish(result) {
    const b = G.battle, s = G.systems[b.sys];
    b.phase = 'over';
    b.result = result;
    const m = State.mods();
    const myLost = [], theirLost = [];
    // your ships: losses are permanent, damage carries over
    for (const u of b.units.filter((x) => x.side === 'player' && x.ref !== 'defense')) {
      const ship = G.ships[u.ref];
      if (!ship) continue;
      if (u.dead) { myLost.push(ship.name); delete G.ships[u.ref]; } else ship.hullNow = Math.max(1, Math.round(u.hull / m.hp));
    }
    // their ships
    const enemyShips = b.kind === 'attack' ? (s.guard ? s.guard.ships : []) : b.threat.ships;
    const deadIdx = new Set();
    for (const u of b.units.filter((x) => x.side === 'enemy' && x.ref !== 'defense')) {
      const ship = enemyShips[u.ref];
      if (!ship) continue;
      if (u.dead) { theirLost.push(ship.name); deadIdx.add(u.ref); } else ship.hullNow = Math.max(1, Math.round(u.hull));
    }
    const survivors = enemyShips.filter((x, i) => !deadIdx.has(i));
    if (b.kind === 'attack' && s.guard) s.guard.ships = survivors;
    if (b.kind === 'defend') b.threat.ships = survivors;

    const won = result === 'win';
    let outcome = '';
    if (won) {
      G.stats.battlesWon++;
      const shards = 3 + theirLost.length * 2;
      G.res.shards += shards;
      // wrecks may leave usable weapons behind (monster claws are no use to anyone)
      const drops = [];
      b.units.filter((x) => x.side === 'enemy' && x.dead && x.ref !== 'defense' && !DATA.shipTypes[x.type].monster).forEach((x) => {
        if (Math.random() < 0.3 && x.weapons.length) { const w = Object.assign({}, U.pick(x.weapons)); delete w.cdLeft; w.id = 'w' + (G.nextWeaponId++); G.armory.push(w); drops.push(w.name); }
      });
      outcome = `Victory. +${shards} Shards${drops.length ? `, salvaged ${drops.join(', ')}` : ''}.`;
      if (b.kind === 'attack') {
        if (s.owner && s.owner !== 'player') {
          const old = Colonies.capture(s.id, 'player');
          s.guard = null;
          G.stats.coloniesTaken++;
          G.res.shards += 10;
          Explore.reveal(s.id);
          outcome += ` ${s.name} falls to the Covenant. Survivors of ${DATA.factions[old].name} are put to work. +10 Shards.`;
        } else {
          s.guard = null;
          outcome += ` ${s.name} is clear.`;
        }
      } else outcome += ` ${s.name} holds.`;
    } else {
      G.stats.battlesLost++;
      if (b.kind === 'defend') {
        const att = b.threat.owner;
        Colonies.capture(s.id, att);
        s.guard = { owner: att, name: DATA.factions[att].short + ' Garrison', ships: survivors.slice(0, DATA.fleetMax) };
        outcome = `Defeat. ☠ ${s.name} has fallen to ${DATA.factions[att].name}. Its people will not be seen again.`;
      } else outcome = result === 'retreat' ? 'Your ships withdraw.' : result === 'draw' ? 'Neither side breaks. Your ships withdraw.' : 'Defeat. Your ships are gone, and so are their crews.';
    }
    const enemyName = b.kind === 'attack' ? (s.guard && s.guard.name) || (DATA.factions[s.owner] || {}).name || 'Lurkers' : b.threat.name;
    this.say(outcome);
    const rep = { c: G.cycle, sys: s.name, enemy: enemyName, myLost, theirLost, outcome, won, lost: !won };
    G.reports.unshift(rep);
    if (G.reports.length > 30) G.reports.length = 30;
    Log.add(`⚔ Battle at ${s.name}. Lost: ${myLost.join(', ') || 'none'}. Destroyed: ${theirLost.join(', ') || 'none'}. ${outcome}`, won ? 'good' : 'bad');

    // the fleet heads home (or is gone)
    Ships.cleanup();
    const f = b.fleetId != null ? Ships.fleet(b.fleetId) : null;
    if (f) { if (b.kind === 'attack') Missions.sendHome(f.id); else f.mission = null; }
    this.checkFactions();
    if (typeof Music !== 'undefined') Music.battle(won ? 0.5 : 1);
  },

  // Leave the result screen; start the next queued battle, if any.
  close() {
    if (!G.battle || G.battle.phase !== 'over') return;
    G.battle = null;
    this.next();
  },

  checkFactions() {
    for (const id of AI.ids) {
      const ai = G.ai[id];
      if (!ai.alive || G.systems.some((s) => s.owner === id)) continue;
      ai.alive = false;
      G.threats = G.threats.filter((t) => t.owner !== id);
      Log.add(`${DATA.factions[id].name} is extinguished. Its last ships drift dark and silent.`, 'good');
      G.res.shards += 30;
    }
    if (!G.systems.some((s) => s.owner === 'player')) G.over = 'lose';
    else if (!G.ai.chorus.alive && !G.ai.remnant.alive) G.over = 'win';
  },
};
