// Voyager — exploration, fog of war and exploration events.

const Explore = {
  // A system is "seen" when it neighbours something you explored or own.
  isSeen(id) {
    const s = G.systems[id];
    if (s.explored) return true;
    return s.lanes.some((n) => G.systems[n].explored);
  },

  reveal(id) {
    const s = G.systems[id];
    if (!s.explored) {
      s.explored = true;
      if (s.id !== G.homeId) G.stats.explored++;
    }
  },

  // A survey probe (or a fleet, f) reaches the system.
  arrive(f, sysId) {
    const s = G.systems[sysId];
    if (s.explored) return;
    this.reveal(s.id);
    const bonus = 2 + State.mods().exploreShards;
    G.res.shards += bonus;
    const hostile = !!Missions.guard(s);
    Log.add(`${f ? f.name : 'A survey probe'} charts ${s.name}, ${DATA.starClasses[s.star].name}: ${s.planets.length} planets (${s.planets.map((p) => Planets.label(p)).join(', ')}). +${bonus} Shards.${hostile ? ` Hostile contacts: ${s.guard.name}, ${s.guard.ships.length} ship${s.guard.ships.length > 1 ? 's' : ''}.` : ''}`);
    if (s.owner && s.owner !== 'player') Log.add(`${s.name} belongs to ${DATA.factions[s.owner].name}. ${DATA.factions[s.owner].desc}`, 'bad');
    if (s.anomaly) {
      G.pendingEvents.push({ ev: s.anomaly, sys: s.id, fleetId: f ? f.id : null });
      s.anomaly = null;
    }
  },

  resolveEvent(choiceIdx) {
    const pe = G.pendingEvents.shift();
    if (!pe) return;
    const ev = DATA.events[pe.ev];
    const ch = ev.choices[choiceIdx] || ev.choices[0];
    const text = ch.effect(G, { sysId: pe.sys, fleetId: pe.fleetId });
    Log.add(`[${G.systems[pe.sys].name}] ${text}`, 'story');
  },
};
