// Voyager — screens for ships: ship cards, the Shipyard (build gacha, Arks, weapon forge),
// the Fleets screen (fleets, hangar, armory, refits) and the Battle board. Extends UI (js/ui.js).

Object.assign(UI, {
  selShip: null,      // ship id selected on the Fleets screen
  lastShip: null,     // ship just built (shown big on the Shipyard)
  lastWeapon: null,   // weapon just forged
  bWeapon: null,      // weapon picked in battle, waiting for a target

  factionColor(owner) { return (DATA.factions[owner] || DATA.factions.player).color; },

  // ---------- pieces ----------
  weaponChip(w, extra = '') {
    if (!w) return '<span class="wchip empty">empty slot</span>';
    const dt = DATA.damageTypes[w.kind], rar = DATA.shipRarities[w.rarity] || DATA.shipRarities.normal;
    return `<span class="wchip" style="--wc:${dt.color};--rc:${rar.color}" title="${U.esc(rar.name)} ${U.esc(w.name)} · ${dt.name}: ×${dt.shield} vs shields, ×${dt.hull} vs hull · accuracy ${w.acc}%${w.cd ? ` · recharges ${w.cd} turn${w.cd > 1 ? 's' : ''} after firing` : ''}">
      <i>${dt.icon}</i><em>${U.esc(w.name)}</em><b>${w.dmg}</b>${w.cd ? `<small>⟳${w.cd}</small>` : ''}${extra}</span>`;
  },

  bar(cls, now, max) {
    const pct = max > 0 ? Math.max(0, Math.min(100, now / max * 100)) : 0;
    return `<div class="sbar ${cls}" title="${cls === 'sh' ? 'Shield' : 'Hull'} ${Math.round(now)}/${Math.round(max)}"><i style="width:${pct}%"></i><span>${Math.round(now)}</span></div>`;
  },

  // A ship card. d: a ship or a battle unit. opts: { act, a, cls, flip, color, extra, small }
  shipCard(d, opts = {}) {
    const t = DATA.shipTypes[d.type], rar = DATA.shipRarities[d.rarity] || DATA.shipRarities.normal;
    const color = opts.color || this.factionColor(d.owner || 'player');
    const sz = Sprites.shipSize(d.type), scale = opts.small ? 3 : 4;
    const shield = d.shieldMax != null ? d.shield : d.shield, shieldMax = d.shieldMax != null ? d.shieldMax : d.shield;
    const hull = d.hullMax != null ? d.hull : d.hullNow, hullMax = d.hullMax != null ? d.hullMax : d.hull;
    const act = opts.act ? `data-act="${opts.act}" data-a="${opts.a}"` : '';
    return `<div class="scard r-${d.rarity} ${opts.cls || ''} ${opts.small ? 'small' : ''}" style="--rc:${rar.color}" ${act}>
      <div class="sc-top"><span class="sc-size" title="${DATA.sizes[d.size].name}: beats ${DATA.sizes[DATA.sizes[d.size].beats].name}">${d.size}</span><span class="sc-rar">${rar.name}</span></div>
      <div class="sc-img"><img class="px" src="${Sprites.ship(d.type, color, !!opts.flip)}" width="${sz.w * scale}" height="${sz.h * scale}" alt=""></div>
      <b class="sc-name" title="${U.esc(d.name)}">${U.esc(d.name)}</b><small class="sc-type">${t.name}</small>
      ${this.bar('sh', shield, shieldMax)}${this.bar('hu', hull, hullMax)}
      <div class="sc-stats"><span title="Speed (turn order)">»${d.speed}</span><span title="Maneuverability (evasion chance)">◌${d.maneuver}%</span>${d.upkeep != null && !opts.small && !t.monster && !t.structure ? `<span title="Maintenance per Cycle">⚙${d.upkeep}</span>` : ''}</div>
      ${opts.small ? '' : `<div class="sc-weps">${d.weapons.map((w) => this.weaponChip(w)).join('')}</div>`}
      ${opts.extra || ''}
    </div>`;
  },

  emptySlot(act, a, label = '＋') {
    return `<div class="scard empty" ${act ? `data-act="${act}" data-a="${a}"` : ''}><span>${label}</span></div>`;
  },

  rarityRates() {
    return Object.values(DATA.shipRarities).map((r) => `<span style="color:${r.color}">${r.name} ${+(r.rate * 100).toFixed(1)}%</span>`).join(' · ');
  },

  // ---------- Shipyard ----------
  screen_shipyard() {
    const yards = Colonies.yards();
    if (!yards.length) return this.panel('Shipyard', '<p>No planet has an Orbital Shipyard. Build one in orbit on the Buildings or Colonies screen.</p>');
    const best = Math.max(...yards.map(({ p }) => p.colony.orbit.shipyard || 0));
    const tile = (size) => {
      const z = DATA.sizes[size], why = Ships.blocker(size);
      const types = Object.values(DATA.shipTypes).filter((t) => t.size === size && !t.monster && !t.structure);
      return `<div class="buildtile ${Ships.unlocked(size) ? '' : 'locked'}">
        <h3>${z.name} hull <span class="sc-size">${size}</span></h3>
        <div class="small muted">Beats ${DATA.sizes[z.beats].name}, weak to ${DATA.sizes[Object.keys(DATA.sizes).find((k) => DATA.sizes[k].beats === size)].name}.</div>
        <div class="tile-ships">${types.map((t) => `<span title="${U.esc(t.desc)}"><img class="px" src="${Sprites.ship(Object.keys(DATA.shipTypes).find((k) => DATA.shipTypes[k] === t), '#d8c8a0')}" width="${Sprites.shipSize(Object.keys(DATA.shipTypes).find((k) => DATA.shipTypes[k] === t)).w * 3}">${t.name}</span>`).join('')}</div>
        <div>${U.costText(Ships.buildCost(size))}</div>
        ${why && why !== 'Not enough resources' ? `<small class="bad">${why}</small>` : ''}
        ${this.btn('Lay down a hull', 'buildship', size, !!why, 'gold')}
      </div>`;
    };
    const last = this.lastShip && G.ships[this.lastShip];
    const reveal = last ? `<div class="reveal r-${last.rarity}">${this.shipCard(last, { cls: 'big' })}
        <div><h3 style="color:${DATA.shipRarities[last.rarity].color}">${DATA.shipRarities[last.rarity].name.toUpperCase()}</h3>
        <p class="small">${DATA.shipTypes[last.type].desc}</p>
        <p class="small muted">${Ships.fleetOf(last.id) ? 'Joined ' + U.esc(Ships.fleetOf(last.id).name) + '.' : 'Waiting in the hangar.'}</p>
        <div class="btnrow">${this.btn('Show in Fleets', 'gofleets')}</div></div></div>` : '';
    const lw = this.lastWeapon && G.armory.find((w) => w.id === this.lastWeapon);
    return this.panel('Shipyard', `<p class="flavor">Every hull is laid down blind. The forge-priests swear the machine-spirit chooses what it becomes.</p>
        <p class="small muted">Choose a size and pay; the type, rarity, stats and weapons are rolled. Rates: ${this.rarityRates()}. Your best shipyard (Lv ${best}) cuts costs by ${Math.round(Math.min(40, 5 * (best - 1)))}%.</p>
        <div class="buildtiles">${['S', 'M', 'L'].map(tile).join('')}</div>${reveal}`) +
      `<div class="grid2">` +
      this.panel('Colony Ark', `<p class="small">${DATA.ark.desc} Send it from a system on the Star Map.</p>
        <div class="kv"><span>Arks ready</span><b>${G.arks}</b></div>
        ${G.arkMissions.length ? `<div class="small muted">${G.arkMissions.map((m) => `On its way to ${U.esc(G.systems[m.target].name)} · ${m.eta}`).join('<br>')}</div>` : ''}
        <div class="btnrow">${this.btn(`Build an Ark <small>${U.costText(Ships.arkCost())}</small>`, 'buildark', '', !Colonies.canAfford(Ships.arkCost()))}</div>`) +
      this.panel('Weapon Forge', `<p class="small">${DATA.forge.desc} Fit forged weapons to ships on the Fleets screen.</p>
        <div class="btnrow">${['S', 'M', 'L'].map((z) => this.btn(`${DATA.sizes[z].name} weapon <small class="res-shards">◆${DATA.forge.cost.shards}</small>`, 'forge', z, !Ships.unlocked(z) || G.res.shards < DATA.forge.cost.shards)).join('')}</div>
        ${lw ? `<div class="forged">New: ${this.weaponChip(lw)} <small class="muted">(${DATA.sizes[lw.size].name})</small></div>` : ''}`) +
      `</div>`;
  },

  // ---------- Fleets ----------
  screen_fleets() {
    const sel = this.selShip && G.ships[this.selShip] ? G.ships[this.selShip] : null;
    if (!sel) this.selShip = null;
    const selFleet = sel ? Ships.fleetOf(sel.id) : null;
    const cardOf = (sh, busy) => this.shipCard(sh, { act: 'selship', a: sh.id, cls: (sh.id === this.selShip ? 'sel' : '') + (busy ? ' busy' : '') });
    const fleets = G.fleets.map((f) => {
      const ships = Ships.fleetShips(f);
      const canDrop = sel && !f.mission && selFleet !== f && !(selFleet && selFleet.mission);
      const slots = [];
      for (let i = 0; i < DATA.fleetMax; i++) {
        if (ships[i]) slots.push(cardOf(ships[i], !!f.mission));
        else slots.push(canDrop ? this.emptySlot('assign', `${sel.id}|${f.id}`, '＋ move here') : this.emptySlot());
      }
      const status = f.mission ? `<span class="res-power">${U.esc(Missions.label(f.mission))}</span> ${f.mission.phase === 'out' ? this.btn('Recall', 'recall', f.id, false, 'small') : ''}` : '<span class="muted">at home · ready</span>';
      return `<div class="fleetrow"><div class="fleethead"><b>${U.esc(f.name)}</b> <button class="icon-btn small" data-act="renamefleet" data-a="${f.id}" title="Rename">✎</button>
          <span class="small">${status}</span><span class="small muted">power ${Ships.groupPower(ships)} · ${ships.length}/${DATA.fleetMax}${Ships.hasScout(f) ? ' · can explore' : ''}</span></div>
        <div class="cardrow">${slots.join('')}</div></div>`;
    }).join('');
    const hangar = Ships.hangar();
    const up = Ships.upkeep();
    const left = this.panel('Fleets', `<p class="small muted">Click a ship to select it, then click a free slot to move it. Fleets on a mission can't be changed. Up to ${DATA.fleetMax} ships per fleet. Send fleets out from the Star Map.</p>
        <div class="small">${Ships.all().length} ships · maintenance <b class="res-metal">${U.fmt1(up)}</b> Metals + <b class="res-chemicals">${U.fmt1(up / 2)}</b> Chemicals per Cycle${G.unpaid ? ' · <span class="bad">unpaid: no repairs</span>' : ''}</div>
        ${fleets || '<p class="muted">No fleets. Build ships at the Shipyard.</p>'}`) +
      this.panel(`Hangar (${hangar.length})`, `<div class="cardrow wrap">${hangar.map((sh) => cardOf(sh)).join('')}
        ${sel && selFleet && !selFleet.mission ? this.emptySlot('assign', `${sel.id}|hangar`, '＋ to hangar') : ''}</div>
        ${hangar.length ? '' : '<p class="muted small">Empty. New ships join a fleet at home with room, or wait here.</p>'}`) +
      this.panel(`Armory (${G.armory.length})`, G.armory.length ? ['S', 'M', 'L'].map((z) => {
        const ws = G.armory.filter((w) => w.size === z);
        return ws.length ? `<div class="kv"><span>${DATA.sizes[z].name}</span><span class="wlist">${ws.map((w) => this.weaponChip(w)).join('')}</span></div>` : '';
      }).join('') : '<p class="muted small">No spare weapons. Scrap ships, salvage wrecks or use the Weapon Forge.</p>');
    return `<div class="fleetscreen"><div>${left}</div><aside class="side">${sel ? this.shipDetail(sel) : this.panel('Ship', '<p class="muted">Select a ship to see its stats, refit its weapons or move it.</p>')}</aside></div>`;
  },

  shipDetail(sh) {
    const f = Ships.fleetOf(sh.id), busy = f && f.mission;
    const t = DATA.shipTypes[sh.type];
    const slots = Ships.slotCount(sh);
    const spare = G.armory.filter((w) => w.size === sh.size);
    let weps = '';
    for (let i = 0; i < slots; i++) {
      const w = sh.weapons[i];
      weps += `<div class="wslot"><div>${this.weaponChip(w)}</div>
        ${!busy && spare.length ? `<details data-key="fit-${sh.id}-${i}"><summary>Swap (${spare.length} in armory)</summary>${spare.map((x) => `<div class="kv">${this.weaponChip(x)}${this.btn('Fit', 'fit', `${sh.id}|${i}|${x.id}`, false, 'small')}</div>`).join('')}</details>` : ''}</div>`;
    }
    const moves = busy ? '<p class="small muted">On a mission: no changes until it returns.</p>' : `<div class="btnrow">
        ${G.fleets.filter((x) => x !== f && !x.mission && x.ships.length < DATA.fleetMax).map((x) => this.btn('→ ' + U.esc(x.name), 'assign', `${sh.id}|${x.id}`, false, 'small')).join('')}
        ${f ? this.btn('→ Hangar', 'assign', `${sh.id}|hangar`, false, 'small') : ''}
        ${this.btn('New fleet with it', 'newfleet', sh.id, false, 'small')}
        ${this.btn('Scrap', 'scrap', sh.id, false, 'small danger')}</div>`;
    return this.panel('Ship', `${this.shipCard(sh, { cls: 'big' })}
      <p class="small">${t.desc}</p>
      <div class="kv"><span>Class</span><b>${t.name} · ${DATA.sizes[sh.size].name}</b></div>
      <div class="kv"><span>Shield / Hull</span><b>${sh.shield} / ${Math.round(sh.hullNow)}${sh.hullNow < sh.hull ? ` of ${sh.hull}` : ''}</b></div>
      <div class="kv"><span>Speed · Evasion</span><b>${sh.speed} · ${sh.maneuver}%</b></div>
      <div class="kv"><span>Maintenance</span><b>${sh.upkeep} / Cycle</b></div>
      <div class="kv"><span>Fleet</span><b>${f ? U.esc(f.name) : 'Hangar'}</b></div>
      <h4>Weapons (${slots} slot${slots > 1 ? 's' : ''})</h4>${weps}
      ${moves}`);
  },

  // ---------- Star map: missions for a system ----------
  missionPanel(s) {
    let out = '';
    const idle = Ships.idleFleets();
    const g = Missions.guard(s);
    if (s.explored && g) {
      out += `<h4>${U.esc(g.name)} <span class="muted small">power ${Ships.groupPower(g.ships)}</span></h4>
        <div class="cardrow wrap">${g.ships.map((sh) => this.shipCard(sh, { small: true, flip: true, color: this.factionColor(g.owner) })).join('')}</div>`;
    }
    const opts = [];
    if (!s.explored && Explore.isSeen(s.id)) {
      const can = idle.filter((f) => !Missions.blocker(f.id, 'explore', s.id));
      opts.push(`<h4>Explore</h4>` + (can.length ? `<div class="btnrow">${can.map((f) => this.btn(`Send ${U.esc(f.name)} <small>${Missions.distance(s.id)} Cycle${Missions.distance(s.id) > 1 ? 's' : ''}</small>`, 'mission', `${f.id}|explore|${s.id}`)).join('')}</div>`
        : '<p class="small muted">No fleet with a Scout is free.</p>'));
    }
    if (s.explored && Missions.hostile(s)) {
      const enemyPower = g ? Ships.groupPower(g.ships) : 0;
      opts.push(`<h4>Attack</h4>` + (idle.length ? `<div class="btnrow">${idle.map((f) => {
        const p = Ships.groupPower(Ships.fleetShips(f));
        return this.btn(`${U.esc(f.name)} <small>power ${p}${enemyPower ? (p >= enemyPower ? ' ✓' : ' ⚠') : ''} · ${Missions.distance(s.id) || '?'} Cycles</small>`, 'mission', `${f.id}|attack|${s.id}`, !!Missions.blocker(f.id, 'attack', s.id));
      }).join('')}</div>` : '<p class="small muted">No fleet is free.</p>'));
    }
    if (s.explored && !s.owner && !g) {
      const why = Missions.colonizeBlocker(s.id);
      opts.push(`<h4>Settle</h4><div class="btnrow">${this.btn(`Send a Colony Ark <small>${G.arks} ready${why ? '' : ' · ' + Missions.distance(s.id) + ' Cycles'}</small>`, 'sendark', s.id, !!why, 'gold')}</div>${why ? `<small class="muted">${why}</small>` : ''}`);
    }
    const coming = G.fleets.filter((f) => f.mission && f.mission.target === s.id);
    const arks = G.arkMissions.filter((m) => m.target === s.id);
    const threats = G.threats.filter((t) => t.target === s.id);
    const notes = [
      ...coming.map((f) => `<div class="small res-power">➤ ${U.esc(f.name)}: ${U.esc(Missions.label(f.mission))}</div>`),
      ...arks.map((m) => `<div class="small good">➤ Colony Ark arrives in ${m.eta}</div>`),
      ...threats.map((t) => `<div class="small bad">⚠ ${U.esc(t.name)} (${t.ships.length} ships, power ${Ships.groupPower(t.ships)}) arrives in ${t.eta}</div>`),
    ];
    return out + opts.join('') + notes.join('');
  },

  // ---------- Battle ----------
  screen_battle() {
    const b = G.battle;
    if (!b) {
      return this.panel('No battle', '<p class="muted">All quiet. For now.</p>') + this.panel('Battle Reports', this.reportList(10));
    }
    const s = G.systems[b.sys];
    if (b.phase === 'setup') {
      const idle = Ships.idleFleets();
      const def = Ships.defenseCard(s);
      return this.panel(`⚠ ${U.esc(b.threat.name)} at ${U.esc(s.name)}`, `<p class="flavor">${DATA.factions[b.threat.owner].name} drops out of the warp above ${U.esc(s.name)}. Choose who stands between them and your people.</p>
        <div class="cardrow wrap">${b.threat.ships.map((sh) => this.shipCard(sh, { flip: true, color: this.factionColor(b.threat.owner), small: true })).join('')}</div>
        <p class="small muted">Enemy power ${Ships.groupPower(b.threat.ships)}.${def ? ' Your Planetary Defenses fight alongside whoever you send.' : ' This system has no Bastions or Defense Platforms.'}</p>
        <div class="btnrow big">${idle.map((f) => this.btn(`Defend with ${U.esc(f.name)} <small>power ${Ships.groupPower(Ships.fleetShips(f))} · ${f.ships.length} ships</small>`, 'bdefend', f.id, false, 'gold')).join('')}
        ${this.btn(def ? 'Defenses only' : 'Leave them undefended', 'bdefend', '', false, 'danger')}</div>
        ${idle.length ? '' : '<p class="small bad">Every fleet is away.</p>'}`);
    }
    const cur = Battle.current();
    const curIdx = cur ? b.units.indexOf(cur) : -1;
    const myTurn = Battle.waiting();
    const w = myTurn && this.bWeapon != null ? cur.weapons[this.bWeapon] : null;
    const hit = b.lastHit && Date.now() - b.lastHit.t < 900 ? b.lastHit : null;
    const unitCard = (u, i) => {
      const cls = [u.dead ? 'dead' : '', i === curIdx ? 'acting' : '', hit && hit.to === i ? 'hit' : '', w && u.side === 'enemy' && !u.dead ? 'target' : ''].join(' ');
      let extra = '';
      if (w && u.side === 'enemy' && !u.dead) {
        const d = Battle.preview(cur, w, u);
        extra = `<div class="preview">≈${Math.round(d.shield)}<i class="sh">sh</i> ${Math.round(d.hull)}<i class="hu">hu</i> · ${Math.round(Battle.hitChance(w, u) * 100)}%${Battle.sizeMult(cur, u) > 1 ? ' ★' : Battle.sizeMult(cur, u) < 1 ? ' ▽' : ''}</div>`;
      }
      const owner = u.side === 'player' ? 'player' : (b.kind === 'attack' ? (s.guard && s.guard.owner) || s.owner : b.threat.owner);
      return this.shipCard(u, { flip: u.side === 'enemy', color: this.factionColor(owner), cls, extra, act: w && u.side === 'enemy' && !u.dead ? 'btarget' : '', a: i });
    };
    const side = (name) => b.units.map((u, i) => [u, i]).filter(([u]) => u.side === name).map(([u, i]) => unitCard(u, i)).join('');
    const order = b.order.map((i) => b.units[i]).map((u, k) => `<span class="ord ${u.side} ${u.dead ? 'dead' : ''} ${k === b.turn ? 'now' : ''}" title="${U.esc(u.name)} · speed ${u.speed}">${U.esc(u.name.split(' ')[0])}</span>`).join('');
    let controls = '';
    if (b.phase === 'over') {
      const res = { win: ['VICTORY', 'good'], lose: ['DEFEAT', 'bad'], retreat: ['WITHDRAWN', ''], draw: ['STALEMATE', ''] }[b.result];
      controls = `<div class="bresult ${res[1]}"><h2>${res[0]}</h2><p>${U.esc(b.log[b.log.length - 1].t)}</p>${this.btn(G.battleQueue.length ? 'Next battle ▸' : 'Continue', 'bclose', '', false, 'gold')}</div>`;
    } else if (myTurn) {
      controls = `<div class="bprompt">Your turn: <b>${U.esc(cur.name)}</b>. ${w ? 'Now pick a target.' : 'Pick a weapon.'}</div>
        <div class="btnrow">${cur.weapons.map((x, i) => `<button class="btn wbtn ${this.bWeapon === i ? 'on' : ''}" data-act="bweapon" data-a="${i}" ${x.cdLeft > 0 ? 'disabled' : ''}>${this.weaponChip(x)}${x.cdLeft > 0 ? `<small>recharging ${x.cdLeft}</small>` : ''}</button>`).join('')}</div>`;
    } else if (cur) {
      controls = `<div class="bprompt muted">${cur.side === 'enemy' ? 'Enemy turn' : 'Auto'}: ${U.esc(cur.name)}…</div>`;
    }
    const tools = b.phase === 'fight' ? `<div class="btnrow">${this.btn(b.auto ? '❚❚ Auto: on' : '▶ Auto', 'battleauto', '', false, b.auto ? 'on' : '')}${this.btn('Resolve instantly', 'bresolve')}${this.btn('Retreat', 'bretreat', '', false, 'danger')}</div>` : '';
    return `<div class="board">
      <div class="bhead2"><h3>⚔ ${U.esc(s.name)}</h3><span class="muted small">${b.kind === 'attack' ? 'Attack' : 'Defense'} · Round ${b.round}${G.battleQueue.length ? ` · ${G.battleQueue.length} more battle${G.battleQueue.length > 1 ? 's' : ''} waiting` : ''}</span>${tools}</div>
      <div class="bside enemy">${side('enemy')}</div>
      <div class="border">${order}</div>
      <div class="bside player">${side('player')}</div>
      <div class="bcontrols">${controls}</div>
      <div class="blog">${b.log.slice(-9).reverse().map((l) => `<div class="${l.s}">${U.esc(l.t)}</div>`).join('')}</div>
      <p class="small muted">Shields absorb damage first. ${DATA.damageTypes.physical.icon} Physical: ×${DATA.damageTypes.physical.shield} vs shields, ×${DATA.damageTypes.physical.hull} vs hull. ${DATA.damageTypes.energy.icon} Energy: ×${DATA.damageTypes.energy.shield} vs shields, ×${DATA.damageTypes.energy.hull} vs hull. Small beats Large, Large beats Medium, Medium beats Small (★ ×${DATA.sizeAdvantage}, ▽ ×${DATA.sizeDisadvantage}).</p>
    </div>`;
  },

  reportList(n = 5) {
    return G.reports.slice(0, n).map((r) => `<div class="report ${r.won ? 'good' : 'bad'}">
      <b>C${r.c} · ${U.esc(r.sys)}</b> vs ${U.esc(r.enemy)}<br><small>Lost: ${r.myLost.map(U.esc).join(', ') || 'none'} · Destroyed: ${r.theirLost.map(U.esc).join(', ') || 'none'}</small><br><small>${U.esc(r.outcome)}</small></div>`).join('') || '<p class="muted">No battles yet. That will change.</p>';
  },
});
