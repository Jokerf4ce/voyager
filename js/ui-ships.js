// Voyager — screens for ships: ship cards, the Shipyard (build gacha, Arks, weapon forge),
// the Fleets screen (fleets, hangar, armory, refits) and the Battle board. Extends UI (js/ui.js).

Object.assign(UI, {
  selShip: null,      // ship id selected on the Fleets screen
  lastShip: null,     // ship just built (shown big on the Shipyard)
  lastWeapon: null,   // weapon just forged

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

  // A ship card. d: a ship or a battle unit. opts: { act, a, cls, owner, extra, small, attrs (extra HTML attributes) }
  shipCard(d, opts = {}) {
    const t = DATA.shipTypes[d.type], rar = DATA.shipRarities[d.rarity] || DATA.shipRarities.normal;
    const owner = opts.owner || d.owner || 'player';
    const shield = d.shieldMax != null ? d.shield : d.shield, shieldMax = d.shieldMax != null ? d.shieldMax : d.shield;
    const hull = d.hullMax != null ? d.hull : d.hullNow, hullMax = d.hullMax != null ? d.hullMax : d.hull;
    const act = (opts.act ? `data-act="${opts.act}" data-a="${opts.a}"` : '') + (opts.attrs ? ' ' + opts.attrs : '');
    return `<div class="scard r-${d.rarity} ${opts.cls || ''} ${opts.small ? 'small' : ''}" style="--rc:${rar.color}" ${act}>
      <div class="sc-top"><span class="sc-size" title="${DATA.sizes[d.size].name}: beats ${DATA.sizes[DATA.sizes[d.size].beats].name}">${d.size}</span><span class="sc-rar">${rar.name}</span></div>
      <div class="sc-img"><img class="px" src="${Sprites.shipImg(d.type, owner, d.variant || 0)}" alt="${U.esc(t.name)}"></div>
      <b class="sc-name" title="${U.esc(d.name)}">${U.esc(d.name)}</b><small class="sc-type">${t.name}</small>
      ${this.bar('sh', shield, shieldMax)}${this.bar('hu', hull, hullMax)}
      <div class="sc-stats"><span title="Speed (turn order)">»${d.speed}</span><span title="Maneuverability (evasion chance)">◌${d.maneuver}%</span>${d.upkeep != null && !opts.small && !t.monster && !t.structure ? `<span title="Maintenance per Cycle">⚙${d.upkeep}</span>` : ''}${d.quality != null && !opts.small && !t.structure ? `<span class="q ${d.quality >= 110 ? 'hi' : d.quality <= 90 ? 'lo' : ''}" title="Stat roll compared with the average ${U.esc(t.name)} of this rarity (100 = average)">Q${d.quality}</span>` : ''}</div>
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
        <div class="tile-ships">${types.map((t) => `<span title="${U.esc(t.desc)}"><img class="px" src="${Sprites.shipImg(Object.keys(DATA.shipTypes).find((k) => DATA.shipTypes[k] === t))}" alt="">${t.name}</span>`).join('')}</div>
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
        <p class="small muted">Choose a size and pay; the type, rarity, stats and weapons are rolled. Every stat is drawn from a normal distribution around the type's average, so no two ships are alike; Q on a card shows how well it rolled (100 = average). Rarity shifts the average up. Rates: ${this.rarityRates()}. Your best shipyard (Lv ${best}) cuts costs by ${Math.round(Math.min(40, 5 * (best - 1)))}%.</p>
        <div class="buildtiles">${['S', 'M', 'L'].map(tile).join('')}</div>${reveal}`) +
      `<div class="grid2">` +
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
        if (ships[i]) slots.push(`<div class="lanewrap"><span class="lanelbl">Lane ${i + 1}</span>${cardOf(ships[i], !!f.mission)}</div>`);
        else slots.push(canDrop ? this.emptySlot('assign', `${sel.id}|${f.id}`, '＋ move here') : this.emptySlot());
      }
      const status = f.mission ? `<span class="res-power">${U.esc(Missions.label(f.mission))}</span> ${f.mission.phase === 'out' ? this.btn('Recall', 'recall', f.id, false, 'small') : ''}` : '<span class="muted">at home · ready</span>';
      return `<div class="fleetrow"><div class="fleethead"><b>${U.esc(f.name)}</b> <button class="icon-btn small" data-act="renamefleet" data-a="${f.id}" title="Rename">✎</button>
          <span class="small">${status}</span><span class="small muted">power ${Ships.groupPower(ships)} · ${ships.length}/${DATA.fleetMax}</span></div>
        <div class="cardrow">${slots.join('')}</div></div>`;
    }).join('');
    const hangar = Ships.hangar();
    const up = Ships.upkeep();
    const left = this.panel('Fleets', `<p class="small muted">Click a ship to select it, then click a free slot to move it. A ship's position is its <b>lane in battle</b>: it shoots the enemy opposite first, so put your heaviest guns where they face the biggest threats. Fleets on a mission can't be changed. Up to ${DATA.fleetMax} ships per fleet. Send fleets out from the Star Map.</p>
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
    const pos = f ? f.ships.indexOf(sh.id) : -1;
    const lane = f && !busy ? `<div class="kv"><span>Lane</span><span class="btnrow">${this.btn('◀', 'shift', `${sh.id}|-1`, pos <= 0, 'small')}<b>${pos + 1} of ${f.ships.length}</b>${this.btn('▶', 'shift', `${sh.id}|1`, pos >= f.ships.length - 1, 'small')}</span></div>` : '';
    const moves = busy ? '<p class="small muted">On a mission: no changes until it returns.</p>' : lane + `<div class="btnrow">
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
      <div class="kv"><span>Roll quality</span><b>${sh.quality}% <small class="muted">of an average ${DATA.shipRarities[sh.rarity].name} ${t.name}</small></b></div>
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
        <div class="cardrow wrap">${g.ships.map((sh) => this.shipCard(sh, { small: true, owner: g.owner })).join('')}</div>`;
    }
    const opts = [];
    const eta = Missions.distance(s.id);
    const etaText = eta ? ` · ${eta} Cycle${eta > 1 ? 's' : ''}` : '';
    if (!s.explored && Explore.isSeen(s.id)) {
      const why = Missions.surveyBlocker(s.id);
      opts.push(`<h4>Explore</h4><div class="btnrow">${this.btn(`Launch a survey probe <small>${U.costText(DATA.survey.cost)}${etaText}</small>`, 'survey', s.id, !!why, 'gold')}</div>${why && why !== 'Not enough resources' ? `<small class="muted">${why}</small>` : ''}`);
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
      opts.push(`<h4>Settle</h4><div class="btnrow">${this.btn(`Send a colony expedition <small>${U.costText(DATA.colonize.cost)}${etaText}</small>`, 'colonize', s.id, !!why, 'gold')}</div>${why && why !== 'Not enough resources' ? `<small class="muted">${why}</small>` : ''}`);
    }
    const coming = G.fleets.filter((f) => f.mission && f.mission.target === s.id);
    const exps = G.expeditions.filter((m) => m.target === s.id), probes = G.surveys.filter((m) => m.target === s.id);
    const threats = G.threats.filter((t) => t.target === s.id);
    const notes = [
      ...coming.map((f) => `<div class="small res-power">➤ ${U.esc(f.name)}: ${U.esc(Missions.label(f.mission))}</div>`),
      ...probes.map((m) => `<div class="small res-research">➤ Survey probe arrives in ${m.eta}</div>`),
      ...exps.map((m) => `<div class="small good">➤ Colony expedition arrives in ${m.eta}</div>`),
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
        <div class="cardrow wrap">${b.threat.ships.map((sh) => this.shipCard(sh, { owner: b.threat.owner, small: true })).join('')}</div>
        <p class="small muted">Enemy power ${Ships.groupPower(b.threat.ships)}.${def ? ' Your Planetary Defenses fight alongside whoever you send.' : ' This system has no Bastions or Defense Platforms.'}</p>
        <div class="btnrow big">${idle.map((f) => this.btn(`Defend with ${U.esc(f.name)} <small>power ${Ships.groupPower(Ships.fleetShips(f))} · ${f.ships.length} ships</small>`, 'bdefend', f.id, false, 'gold')).join('')}
        ${this.btn(def ? 'Defenses only' : 'Leave them undefended', 'bdefend', '', false, 'danger')}</div>
        ${idle.length ? '' : '<p class="small bad">Every fleet is away.</p>'}`);
    }
    const cur = Battle.current();
    const curIdx = cur ? b.units.indexOf(cur) : -1;
    const myTurn = Battle.waiting();
    const tgt = cur ? Battle.targetFor(cur) : null;
    const hit = b.lastHit && Date.now() - b.lastHit.t < 900 ? b.lastHit : null;
    const lanes = Battle.laneCount();
    // a planned swap (chosen with the little arrows, then confirmed); forgotten when the turn changes
    const turnKey = `${b.round}:${b.turn}`;
    if (!this.swapPick || this.swapPick.key !== turnKey || !myTurn) this.swapPick = { key: turnKey, lane: null };
    const pick = this.swapPick.lane;
    const enemyOwner = b.kind === 'attack' ? (s.guard && s.guard.owner) || s.owner : b.threat.owner;
    const unitCard = (u, i) => {
      const isT = u === tgt, acting = i === curIdx;
      const struck = hit && hit.to === i;
      const cls = [u.dead ? 'dead' : '', acting ? 'acting' : '', struck && !hit.miss && !hit.restore ? 'hit' : '', struck && hit.miss ? 'missed' : '', isT ? 'target' : '', u.side === 'player' && pick === u.lane ? 'swap-dest' : ''].join(' ');
      let extra = struck && hit.miss ? '<div class="floater miss">MISS</div>' : struck && hit.restore ? '<div class="floater restore">+ RESTORED</div>' : '';
      extra += isT ? `<div class="preview">◎ target${cur.lane !== u.lane ? ` · across lanes ×${DATA.offLaneHit} hit` : ''}</div>` : '';
      // the acting ship gets little arrows to pick a lane to swap to
      if (acting && myTurn && !DATA.shipTypes[u.type].structure) {
        extra += `<div class="swapnav"><button class="btn small" data-act="bswapnav" data-a="-1" title="Pick a lane to the left">◀</button><span>swap</span><button class="btn small" data-act="bswapnav" data-a="1" title="Pick a lane to the right">▶</button></div>`;
      }
      const attrs = `data-unit="${i}"` + (u.side === 'player' ? ` data-droplane="${u.lane}"` : '') + (acting && myTurn ? ' draggable="true" data-drag="1"' : '');
      return this.shipCard(u, { owner: u.side === 'player' ? 'player' : enemyOwner, cls, extra, attrs });
    };
    // each side is a row of lanes; lane i faces lane i on the other side
    const side = (name) => {
      const cells = [];
      for (let l = 0; l < lanes; l++) {
        const i = b.units.findIndex((u) => u.side === name && u.lane === l);
        cells.push(i >= 0 ? unitCard(b.units[i], i)
          : `<div class="lane-empty ${name === 'player' && pick === l ? 'swap-dest' : ''}" ${name === 'player' ? `data-droplane="${l}"` : ''}>${name === 'player' && pick === l ? '⇄ here' : ''}</div>`);
      }
      return cells.join('');
    };
    // turn order, pinned to the bottom of the screen
    const order = `<div class="border"><span class="ord-lbl">Turn order · Round ${b.round}</span>${b.order.map((i) => b.units[i]).map((u, k) =>
      `<span class="ord ${u.side} ${u.dead ? 'dead' : ''} ${k === b.turn && b.phase === 'fight' ? 'now' : ''} ${k < b.turn ? 'done' : ''}" title="${U.esc(u.name)} · speed ${u.speed}">${k === b.turn && b.phase === 'fight' ? '▶ ' : ''}${U.esc(u.name.length > 14 ? u.name.slice(0, 13) + '…' : u.name)} <small>»${u.speed}</small></span>`).join('')}</div>`;
    let controls = '';
    if (b.phase === 'over') {
      const res = { win: ['VICTORY', 'good'], lose: ['DEFEAT', 'bad'], retreat: ['WITHDRAWN', ''], draw: ['STALEMATE', ''] }[b.result];
      controls = `<div class="bresult ${res[1]}"><h2>${res[0]}</h2><p>${U.esc(b.log[b.log.length - 1].t)}</p><p class="small muted">${G.battleQueue.length ? 'The next battle begins in a moment…' : 'End the Cycle or open another screen to move on.'}</p></div>`;
    } else if (myTurn) {
      const pv = (x) => {
        if (x.cdLeft > 0 || !tgt) return `<small>recharging ${x.cdLeft}</small>`;
        const d = Battle.preview(cur, x, tgt), sm = Battle.sizeMult(cur, tgt);
        return `<small>≈${Math.round(d.shield)} sh + ${Math.round(d.hull)} hu · ${Math.round(Battle.hitChance(x, tgt, cur) * 100)}% hit${sm > 1 ? ' ★' : sm < 1 ? ' ▽' : ''}${cur.size === 'L' && tgt.size === 'S' ? ' (small target)' : ''}</small>`;
      };
      const pushedN = pick != null ? Battle.pushed(cur, pick).filter(([x]) => !x.dead).length : 0;
      const rg = Battle.restoreGain(cur);
      controls = `<div class="bprompt">Your turn: <b>${U.esc(cur.name)}</b> targets <b>${U.esc(tgt.name)}</b>${cur.lane !== tgt.lane ? ' <span class="bad">(across lanes: half the hit chance)</span>' : ''}. Fire a weapon, restore, or move.</div>
        <div class="btnrow">${cur.weapons.map((x, i) => `<button class="btn wbtn" data-act="bfire" data-a="${i}" ${x.cdLeft > 0 ? 'disabled' : ''}>${this.weaponChip(x)}${pv(x)}</button>`).join('')}
          <button class="btn wbtn restore" data-act="brestore" ${Battle.canRestore(cur) ? '' : 'disabled'} title="Hold position: regain ${Math.round(DATA.restore.shield * 100)} % of max shields and ${Math.round(DATA.restore.hull * 100)} % of max hull. Uses this turn."><span class="wchip">⟲ Restore</span><small>${rg.shield || rg.hull ? `+${rg.shield} sh + ${rg.hull} hu` : 'undamaged'}</small></button></div>
        <div class="btnrow swaprow">${pick != null
          ? `${this.btn(`⇄ Confirm: move to lane ${pick + 1}${pushedN ? ` (pushes ${pushedN} aside)` : ''}`, 'bswapconfirm', '', false, 'gold')}${this.btn('Cancel', 'bswapnav', 0, false, 'small')}`
          : '<small class="muted">Or move instead of firing: drag this ship to another lane, or use ◀ ▶ on its card and confirm. Ships in between slide over. Uses this turn.</small>'}</div>`;
    } else if (cur) {
      controls = `<div class="bprompt muted">${cur.side === 'enemy' ? 'Enemy turn' : 'Auto'}: ${U.esc(cur.name)} → ${tgt ? U.esc(tgt.name) : '…'}</div>`;
    }
    const tools = b.phase === 'fight' ? `<div class="btnrow">${this.btn(b.auto ? '❚❚ Auto: on' : '▶ Auto', 'battleauto', '', false, b.auto ? 'on' : '')}${this.btn('Resolve instantly', 'bresolve')}${this.btn('Retreat', 'bretreat', '', false, 'danger')}</div>` : '';
    // fleet power of each side, with a tug-of-war bar
    const pE = Battle.sidePower('enemy'), pP = Battle.sidePower('player'), share = pP + pE ? Math.round(pP / (pP + pE) * 100) : 50;
    const enemyName = b.kind === 'attack' ? ((s.guard && s.guard.name) || (DATA.factions[s.owner] || {}).name || 'Enemy') : b.threat.name;
    const f = b.fleetId != null ? Ships.fleet(b.fleetId) : null;
    const myName = f ? f.name : 'Planetary Defenses';
    const powerBar = `<div class="pbar" title="Fleet power: yours ${pP}, theirs ${pE}"><i style="width:${share}%"></i></div>`;
    return `<div class="battlescreen fitscreen"><div class="board" id="board">
      ${powerBar}
      <div class="bhead2"><h3>⚔ ${U.esc(s.name)}</h3><span class="muted small">${b.kind === 'attack' ? 'Attack' : 'Defense'} · Round ${b.round}${G.battleQueue.length ? ` · ${G.battleQueue.length} more battle${G.battleQueue.length > 1 ? 's' : ''} waiting` : ''}</span>${tools}</div>
      <div class="bpower enemy" style="--fc:${this.factionColor(enemyOwner)}"><b>${U.esc(enemyName)}</b><span>fleet power <b>${pE}</b></span></div>
      <div class="bside enemy" style="--lanes:${lanes}">${side('enemy')}</div>
      <div class="bgap"></div>
      <div class="bside player" style="--lanes:${lanes}">${side('player')}</div>
      <div class="bpower player" style="--fc:${this.factionColor('player')}"><b>${U.esc(myName)}</b><span>fleet power <b>${pP}</b></span></div>
      <svg class="barrow" id="barrow"></svg>
      <div class="bcontrols">${controls}</div>
      ${order}
    </div>
    <aside class="side bside-col">
      <h4>Battle log</h4>
      <div class="blog">${b.log.slice(-30).reverse().map((l) => `<div class="${l.s}">${U.esc(l.t)}</div>`).join('')}</div>
      <details data-key="battle-rules"><summary class="small">Rules of engagement</summary><p class="small muted">Shields absorb damage first. ${DATA.damageTypes.physical.icon} Physical: ×${DATA.damageTypes.physical.shield} vs shields, ×${DATA.damageTypes.physical.hull} vs hull. ${DATA.damageTypes.energy.icon} Energy: ×${DATA.damageTypes.energy.shield} vs shields, ×${DATA.damageTypes.energy.hull} vs hull. Small beats Large, Large beats Medium, Medium beats Small (★ ×${DATA.sizeAdvantage}, ▽ ×${DATA.sizeDisadvantage}). Each ship shoots the ship opposite; if that one is gone, the nearest to its right, then left, then two right, two left. Shots across lanes have ×${DATA.offLaneHit} hit chance, and Large ships hit Small ones at ×${DATA.largeVsSmallHit}. Instead of firing, a ship can <b>move</b> to any lane on its side (the ships in between slide over), or <b>Restore</b>: regain ${Math.round(DATA.restore.shield * 100)} % of its max shields and ${Math.round(DATA.restore.hull * 100)} % of its max hull.</p></details>
    </aside></div>`;
  },

  // Move the planned swap one lane left/right (skipping lanes it can't go to); 0 cancels.
  swapNav(dir) {
    const cur = Battle.current();
    if (!cur || !Battle.waiting() || !this.swapPick) return;
    if (!dir) { this.swapPick.lane = null; return; }
    const n = Battle.laneCount();
    let l = this.swapPick.lane == null ? cur.lane : this.swapPick.lane;
    for (let k = 0; k < n; k++) {
      l = (l + dir + n) % n;
      if (l === cur.lane) { this.swapPick.lane = null; return; }      // back at its own lane: no swap
      if (Battle.canSwapTo(cur, l)) { this.swapPick.lane = l; return; }
    }
  },

  // The target arrow: a curved arrow from the acting ship to its target, floating between the rows.
  drawBattleArrow() {
    const svg = this.$('barrow'), board = this.$('board');
    const b = G.battle;
    if (!svg || !board || !b || b.phase !== 'fight') return;
    const cur = Battle.current(), tgt = cur && Battle.targetFor(cur);
    if (!cur || !tgt) { svg.innerHTML = ''; return; }
    const A = board.querySelector(`[data-unit="${b.units.indexOf(cur)}"]`), T = board.querySelector(`[data-unit="${b.units.indexOf(tgt)}"]`);
    if (!A || !T) { svg.innerHTML = ''; return; }
    const R = board.getBoundingClientRect(), a = A.getBoundingClientRect(), t = T.getBoundingClientRect();
    svg.setAttribute('width', R.width); svg.setAttribute('height', R.height);
    svg.setAttribute('viewBox', `0 0 ${R.width} ${R.height}`);
    const up = cur.side === 'player'; // your ships fire upward
    const x1 = a.left + a.width / 2 - R.left, y1 = (up ? a.top : a.bottom) - R.top + (up ? 6 : -6);
    const x2 = t.left + t.width / 2 - R.left, y2 = (up ? t.bottom : t.top) - R.top + (up ? 4 : -4);
    const mx = (x1 + x2) / 2 + (x1 === x2 ? 0 : 0), my = (y1 + y2) / 2, bend = Math.max(30, Math.abs(x2 - x1) * 0.25);
    const cx = mx + (x2 >= x1 ? -1 : 1) * (x1 === x2 ? 0 : bend * 0.6), cy = my;
    const col = cur.side === 'player' ? '#f0d060' : '#ff5a4a';
    svg.innerHTML = `<defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${col}"/></marker></defs>
      <g class="arrow-bob"><path d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" fill="none" stroke="#000" stroke-width="7" stroke-linecap="round" opacity=".55"/>
      <path class="arrow-flow" d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-dasharray="10 7" marker-end="url(#ah)"/></g>`;
  },
  reportList(n = 5) {
    return G.reports.slice(0, n).map((r) => `<div class="report ${r.won ? 'good' : 'bad'}">
      <b>C${r.c} · ${U.esc(r.sys)}</b> vs ${U.esc(r.enemy)}<br><small>Lost: ${r.myLost.map(U.esc).join(', ') || 'none'} · Destroyed: ${r.theirLost.map(U.esc).join(', ') || 'none'}</small><br><small>${U.esc(r.outcome)}</small></div>`).join('') || '<p class="muted">No battles yet. That will change.</p>';
  },
});
