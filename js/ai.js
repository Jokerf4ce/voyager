// Voyager — alien AI empires. Simple but relentless: grow, expand, build, attack.

const AI = {
  ids: ['chorus', 'remnant'],

  tick() {
    const aggroBonus = State.mods().aiAggro;
    for (const id of this.ids) {
      const ai = G.ai[id];
      if (!ai.alive) continue;
      const owned = G.systems.filter((s) => s.owner === id);
      ai.ore += owned.length * (3 + G.cycle * 0.06);

      // Expand to neighbouring empty systems.
      if (ai.ore >= 55 && Math.random() < 0.2) {
        const targets = new Set();
        for (const s of owned) for (const n of s.lanes) {
          const t = G.systems[n];
          if (!t.owner && !G.fleets.some((f) => f.sys === n && f.owner !== id && Fleets.size(f) > 0)) targets.add(n);
        }
        if (targets.size) {
          const t = U.pick([...targets]);
          ai.ore -= 55;
          Colonies.found(t, id, Math.random() < 0.5 ? { bastion: 1 } : {});
          if (Explore.isSeen(t)) Log.add(`${DATA.factions[id].name} spreads to ${G.systems[t].name}.`, 'bad');
        }
      }

      // Build warships at home (or any colony if home is lost).
      const yard = G.systems[ai.homeId].owner === id ? ai.homeId : (owned[0] && owned[0].id);
      if (yard == null) continue;
      let homeFleet = G.fleets.find((f) => f.owner === id && f.sys === yard && !f.path.length);
      while (ai.ore >= 25) {
        if (!homeFleet) homeFleet = Fleets.create(id, yard, {}, DATA.factions[id].short + ' Host');
        const type = G.cycle > 25 && Math.random() < 0.4 ? 'frigate' : 'corvette';
        const cost = type === 'frigate' ? 50 : 22;
        if (ai.ore < cost) break;
        ai.ore -= cost;
        homeFleet.ships[type] = (homeFleet.ships[type] || 0) + 1;
      }

      // Idle warhosts in the field look for their next victim.
      for (const f of G.fleets) {
        if (f.owner !== id || f.path.length || f === homeFleet || f.sys === yard) continue;
        const target = this.pickTarget(id, f.sys);
        const p = target != null && U.path(f.sys, target);
        if (p && p.length && Math.random() < 0.5) f.path = p;
      }

      // Launch an attack once the host is strong enough.
      if (homeFleet && G.cycle >= 14) {
        const threshold = (30 + G.cycle * 1.4) / (ai.aggro + aggroBonus);
        const atk = Fleets.stats(homeFleet).atk;
        if (atk >= threshold) {
          const target = this.pickTarget(id, yard);
          if (target != null) {
            const p = U.path(yard, target);
            if (p && p.length) {
              homeFleet.path = p;
              homeFleet.name = DATA.factions[id].short + ' Warhost';
              if (G.systems[target].owner === 'player') Log.add(`⚠ Long-range augurs detect a ${DATA.factions[id].short} warhost moving toward ${G.systems[target].name}.`, 'bad');
            }
          }
        }
      }
    }
  },

  // Nearest enemy colony, preferring the player.
  pickTarget(id, from) {
    const d = U.distances(from);
    const enemy = G.systems.filter((s) => s.colony && s.owner && s.owner !== id && s.owner !== 'monster' && d[s.id] != null);
    if (!enemy.length) return null;
    enemy.sort((a, b) => (d[a.id] - (a.owner === 'player' ? 2 : 0)) - (d[b.id] - (b.owner === 'player' ? 2 : 0)));
    return enemy[0].id;
  },
};
