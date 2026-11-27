// Voyager — missions. Fleets have no position on the map: they are sent out on missions that take Cycles.
// Exploring and settling don't need ships: they cost a flat fee (DATA.survey, DATA.colonize).
//
// fleet.mission = { kind: 'attack', target: sysId, phase: 'out' | 'battle' | 'back', eta, total }
// G.surveys     = [{ target, eta, total }]         survey probes on their way
// G.expeditions = [{ target, planet, eta, total }] colony expeditions on their way (planet = index in the system)
// G.threats     = [{ id, owner, name, target, eta, total, ships: [ship] }]   alien raids on their way

const Missions = {
  known(id) { return G.systems[id].explored || Explore.isSeen(id); },

  // Hyperlane hops from the nearest Covenant system to the target, through known space. null = unreachable.
  distance(targetId) {
    let best = Infinity;
    for (const s of Colonies.playerSystems()) {
      if (s.id === targetId) return 1;
      const p = U.path(s.id, targetId, (id) => this.known(id));
      if (p) best = Math.min(best, p.length);
    }
    return best === Infinity ? null : Math.max(1, best);
  },

  targeted(sysId, kind) {
    if (kind === 'explore') return G.surveys.some((m) => m.target === sysId);
    if (kind === 'colonize') return G.expeditions.some((m) => m.target === sysId);
    return G.fleets.some((f) => f.mission && f.mission.target === sysId && f.mission.kind === kind && f.mission.phase !== 'back');
  },

  // Hostile ships in a system: a monster lair or an alien garrison.
  guard(s) { return s.guard && s.guard.ships.length ? s.guard : null; },
  hostile(s) { return !!this.guard(s) || (s.owner && s.owner !== 'player'); },

  // Why a fleet can't take this mission, or null.
  blocker(fleetId, kind, sysId) {
    const f = Ships.fleet(fleetId), s = G.systems[sysId];
    if (!f || !f.ships.length) return 'No ships';
    if (f.mission) return 'Busy';
    if (this.distance(sysId) == null) return 'No known route';
    if (kind === 'attack') {
      if (!s.explored) return 'Uncharted';
      if (!this.hostile(s)) return 'Nothing to fight';
    }
    return null;
  },

  launch(fleetId, kind, sysId) {
    if (this.blocker(fleetId, kind, sysId)) return false;
    const f = Ships.fleet(fleetId), eta = this.distance(sysId);
    f.mission = { kind, target: sysId, phase: 'out', eta, total: eta };
    Log.add(`${f.name} sets out to attack ${G.systems[sysId].name} (${eta} Cycle${eta > 1 ? 's' : ''}).`);
    return true;
  },

  recall(fleetId) {
    const f = Ships.fleet(fleetId);
    if (!f || !f.mission || f.mission.phase !== 'out') return false;
    const back = Math.max(1, f.mission.total - f.mission.eta);
    f.mission = { kind: f.mission.kind, target: f.mission.target, phase: 'back', eta: back, total: back };
    Log.add(`${f.name} is recalled.`);
    return true;
  },

  // ---------- survey probes (exploring) ----------
  surveyBlocker(sysId) {
    const s = G.systems[sysId];
    if (s.explored) return 'Already charted';
    if (!Explore.isSeen(s.id)) return 'Out of sight';
    if (this.targeted(sysId, 'explore')) return 'A probe is on its way';
    if (this.distance(sysId) == null) return 'No known route';
    if (!Colonies.canAfford(State.cost(DATA.survey.cost))) return 'Not enough resources';
    return null;
  },
  survey(sysId) {
    if (this.surveyBlocker(sysId)) return false;
    Colonies.pay(State.cost(DATA.survey.cost));
    const eta = this.distance(sysId);
    G.surveys.push({ target: sysId, eta, total: eta });
    Log.add(`A survey probe is launched toward ${G.systems[sysId].name} (${eta} Cycle${eta > 1 ? 's' : ''}).`);
    return true;
  },

  // ---------- colony expeditions (settling) ----------
  // An expedition goes to one planet you choose. One expedition per system at a time: once the colony
  // stands, the rest of the system is settled from there (Colonies.settle).
  colonizeBlocker(sysId, pIdx) {
    const s = G.systems[sysId], p = s.planets[pIdx];
    if (!s.explored) return 'Uncharted';
    if (!p) return 'No such planet';
    if (p.colony) return 'Already settled';
    if (!(p.slots.surface + p.slots.orbit)) return 'Nothing can be built there';
    if (s.owner) return s.owner === 'player' ? 'Already yours' : 'Claimed by ' + DATA.factions[s.owner].name;
    if (this.guard(s)) return 'Guarded: clear it first';
    if (this.targeted(sysId, 'colonize')) return 'Colonists are on their way';
    if (this.distance(sysId) == null) return 'No known route';
    if (!Colonies.canAfford(State.cost(DATA.colonize.cost))) return 'Not enough resources';
    return null;
  },
  colonize(sysId, pIdx) {
    if (this.colonizeBlocker(sysId, pIdx)) return false;
    Colonies.pay(State.cost(DATA.colonize.cost));
    const eta = this.distance(sysId), s = G.systems[sysId];
    G.expeditions.push({ target: sysId, planet: pIdx, eta, total: eta });
    Log.add(`A colony expedition departs for ${Colonies.planetName(s, s.planets[pIdx])} (${eta} Cycle${eta > 1 ? 's' : ''}).`);
    return true;
  },

  // ---------- each Cycle ----------
  tick() {
    for (const f of G.fleets) {
      const m = f.mission;
      if (!m || m.phase === 'battle') continue;
      m.eta--;
      if (m.eta > 0) continue;
      if (m.phase === 'back') { f.mission = null; Log.add(`${f.name} is home.`); continue; }
      this.arrive(f);
    }
    for (const m of G.surveys.slice()) {
      if (--m.eta > 0) continue;
      G.surveys.splice(G.surveys.indexOf(m), 1);
      Explore.arrive(null, m.target);
    }
    Galaxy.grow();
    for (const m of G.expeditions.slice()) {
      if (--m.eta > 0) continue;
      G.expeditions.splice(G.expeditions.indexOf(m), 1);
      const s = G.systems[m.target];
      if (s.owner || this.guard(s)) {
        { const c = State.cost(DATA.colonize.cost); for (const k in c) G.res[k] += Math.floor(c[k] / 2); }
        Log.add(`The colonists find ${s.name} taken or guarded and turn back. Half of the supplies are recovered.`, 'bad');
        continue;
      }
      const want = s.planets[m.planet];
      const p = want && !want.colony ? m.planet : Galaxy.bestPlanet(s); // the chosen planet (older saves: the best one)
      Colonies.found(s.id, p, 'player');
      Explore.reveal(s.id);
      Log.add(`A colony is founded on ${Colonies.planetName(s, s.planets[p])}. The colonists bury their dead first, then start building.`, 'good');
      if (typeof Voice !== 'undefined') Voice.trigger('colony');
    }
    for (const t of G.threats.slice()) {
      if (--t.eta > 0) continue;
      G.threats.splice(G.threats.indexOf(t), 1);
      const s = G.systems[t.target];
      if (s.owner !== 'player') continue; // the target is gone already
      Battle.queue({ kind: 'defend', sys: s.id, threat: t });
    }
  },

  arrive(f) {
    const m = f.mission, s = G.systems[m.target];
    const home = () => { const d = this.distance(s.id) || 1; f.mission = { kind: m.kind, target: m.target, phase: 'back', eta: d, total: d }; };
    if (m.kind === 'attack') {
      if (!this.hostile(s)) { Log.add(`${f.name} finds ${s.name} empty and turns home.`); home(); return; }
      m.phase = 'battle';
      Battle.queue({ kind: 'attack', sys: s.id, fleetId: f.id });
    }
  },

  // After an attack battle, the survivors head home.
  sendHome(fleetId) {
    const f = Ships.fleet(fleetId);
    if (!f || !f.mission) return;
    const d = this.distance(f.mission.target) || 1;
    f.mission = { kind: f.mission.kind, target: f.mission.target, phase: 'back', eta: d, total: d };
  },

  label(m) {
    const s = G.systems[m.target];
    if (m.phase === 'back') return `returning from ${s.name} · ${m.eta} Cycle${m.eta > 1 ? 's' : ''}`;
    if (m.phase === 'battle') return `in battle at ${s.name}`;
    return `attacking ${s.name} · arrives in ${m.eta}`;
  },
};
