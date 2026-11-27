// Voyager — screens for ships: ship cards, the Shipyard (build gacha, Arks, weapon forge),
// the Hangar screen (fleets, hangar, armory, refits) and the Battle board. Extends UI (js/ui.js).

Object.assign(UI, {
  selShip: null,      // ship id selected on the Hangar screen
  hangarSort: 'built', // how the hangar is sorted (see hangarSorts)
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
    return `<div class="scard r-${d.rarity} ${opts.cls || ''} ${opts.small ? 'small' : ''}" style="--rc:${rar.color};${opts.style || ''}" ${act}>
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

  // ---------- officers ----------
  // The source is 32×32: whole multiples (32, 64) keep the pixels crisp.
  portrait(key, size = 64) { return `<img class="px portrait" src="${Sprites.portrait(key)}" width="${size}" height="${size}" alt="">`; },
  // An officer card: portrait, name, passives and the ability. opts.foot: extra html at the bottom.
  officerCard(key, opts = {}) {
    const o = DATA.officers[key];
    return `<div class="ocard ${opts.cls || ''}">
      <div class="ohead">${this.portrait(key, 64)}<div><small class="muted">${U.esc(o.rank)}</small><br><b>${U.esc(o.name)}</b><br><i>${U.esc(o.title)}</i></div></div>
      <ul class="opass">${o.passives.map((p) => `<li>${U.esc(p.text)}</li>`).join('')}</ul>
      <div class="oabil"><b>★ ${U.esc(o.ability.name)}</b> <small class="muted">once per battle · free action</small><br><small>${U.esc(o.ability.text)}</small></div>
      ${opts.flavor ? `<p class="flavor small">${U.esc(o.flavor)}</p>` : ''}${opts.foot || ''}</div>`;
  },
  officerModal(key) {
    if (!DATA.officers[key]) return;
    const f = Ships.officerFleet(key);
    this.modal(`${this.officerCard(key, { flavor: true })}<p class="small muted">${f ? `Leads ${U.esc(f.name)}.` : 'Not leading a fleet.'}</p><div class="btnrow">${this.btn('Close', 'close', '', false, 'gold')}</div>`);
  },
  // Pick an officer for a fleet: every officer you command, taken from another fleet if needed.
  officerPicker(fleetId) {
    const f = Ships.fleet(fleetId);
    if (!f) return;
    const cards = Ships.officers().map((k) => {
      const from = Ships.officerFleet(k), here = from === f, busy = from && from.mission;
      return this.officerCard(k, { cls: here ? 'sel' : '', foot: `<div class="btnrow">${here ? '<span class="lvl">Leading this fleet</span>'
        : this.btn(from ? `Take from ${U.esc(from.name)}` : 'Assign', 'officerset', `${k}|${f.id}`, !!busy, 'gold')}${busy ? '<small class="bad">its fleet is away</small>' : ''}</div>` });
    }).join('');
    this.modal(`<h2>Officer for ${U.esc(f.name)}</h2><p class="small muted">An officer's passives apply to the fleet's ships in battle; the ability can be used once per battle on your turn, without using the ship's turn.</p>
      <div class="ocards">${cards}</div><div class="btnrow">${this.btn('Close', 'close', '', false)}</div>`);
    this.$('modal').querySelector('.modal-box').classList.add('wide');
  },
  // The officer slot in a fleet's header on the Hangar screen.
  officerSlot(f) {
    if (f.officer && DATA.officers[f.officer]) {
      const o = DATA.officers[f.officer];
      return `<span class="oslot"><button class="ochip" data-act="officerinfo" data-a="${f.officer}" title="${U.esc(o.passives.map((p) => p.text).join(' · ') + ' · ★ ' + o.ability.name)}">${this.portrait(f.officer, 32)}<span>${U.esc(o.rank)} <b>${U.esc(o.name)}</b></span></button>${f.mission ? '' : `<button class="icon-btn small" data-act="officerpick" data-a="${f.id}" title="Change officer">⇄</button><button class="icon-btn small" data-act="officeroff" data-a="${f.id}" title="Relieve of command">✕</button>`}</span>`;
    }
    return f.mission || !Ships.officers().length ? '' : `<button class="btn small oadd" data-act="officerpick" data-a="${f.id}">＋ Officer</button>`;
  },

  // The officer in battle: portrait, name and the ability button (once per battle, on your turn).
  battleOfficer(b) {
    const o = DATA.officers[b.officer.key], can = Battle.canUseOfficer() && Battle.waiting();
    return `<span class="bofficer"><button class="ochip" data-act="officerinfo" data-a="${b.officer.key}" title="${U.esc(o.passives.map((p) => p.text).join(' · '))}">${this.portrait(b.officer.key, 32)}<span>${U.esc(o.name)}</span></button>
      <button class="btn small oability ${b.officer.used ? 'used' : can ? 'ready' : ''}" data-act="officer" ${can ? '' : 'disabled'} title="${U.esc(o.ability.text)} Once per battle, on your turn; does not use the ship's turn.">★ ${U.esc(o.ability.name)}${b.officer.used ? ' · used' : ''}</button></span>`;
  },

  // ---------- rules of engagement (pop-up from the battle screen) ----------
  rulesModal() {
    const P = DATA.damageTypes.physical, E = DATA.damageTypes.energy, adv = DATA.sizeAdvantage, dis = DATA.sizeDisadvantage;
    // size triangle: S beats L, L beats M, M beats S
    const node = (x, y, s, name, above) => `<g class="rn"><rect x="${x - 26}" y="${y - 18}" width="52" height="36"/><text x="${x}" y="${y + 1}" class="rs">${s}</text><text x="${x}" y="${above ? y - 26 : y + 34}" class="rl">${name}</text></g>`;
    const arrow = (x1, y1, x2, y2, lx, ly) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ra" marker-end="url(#rh)"/><text x="${lx}" y="${ly}" class="rx">×${adv}</text>`;
    const tri = `<svg class="rsvg" viewBox="0 0 240 200" role="img" aria-label="Small beats Large, Large beats Medium, Medium beats Small">
      <defs><marker id="rh" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="rhd"/></marker></defs>
      ${arrow(148, 60, 190, 126, 192, 86)}${arrow(170, 152, 72, 152, 121, 142)}${arrow(50, 126, 92, 60, 48, 86)}
      ${node(120, 50, 'S', 'Small', true)}${node(200, 152, 'L', 'Large')}${node(40, 152, 'M', 'Medium')}</svg>`;
    // targeting: the shooter in lane 3 and the order it picks targets in
    const lanes = 5, me = 2, w = 44, gap = 6, x0 = 10, prio = {};
    DATA.targetOrder.forEach((d, k) => { const l = me + d; if (l >= 0 && l < lanes && prio[l] == null) prio[l] = Object.keys(prio).length + 1; });
    const lx = (l) => x0 + l * (w + gap) + w / 2;
    const tgt = `<svg class="rsvg" viewBox="0 0 260 190" role="img" aria-label="Target priority: opposite lane, then right, left, two right, two left">
      ${[...Array(lanes).keys()].map((l) => `<g class="rt ${l === me ? 'first' : ''}"><rect x="${lx(l) - w / 2}" y="14" width="${w}" height="40"/><text x="${lx(l)}" y="40">${prio[l]}</text></g>`).join('')}
      ${[...Array(lanes).keys()].map((l) => `<line x1="${lx(me)}" y1="132" x2="${lx(l)}" y2="58" class="ra ${l === me ? '' : 'off'}" marker-end="url(#rh)"/>`).join('')}
      <g class="rn me"><rect x="${lx(me) - w / 2}" y="134" width="${w}" height="40"/><text x="${lx(me)}" y="160" class="rs">▲</text></g>
      <text x="${lx(me) + w / 2 + 8}" y="${158}" class="rl left">your ship</text>
      <text x="${x0}" y="${10}" class="rl left">enemy lanes</text></svg>`;
    // a weapon button, numbered
    const k = (n) => `<sup class="rkey">${n}</sup>`;
    const sample = `<div class="rsample bweps"><span class="btn wbtn"><span class="wchip" style="--wc:${P.color};--rc:${DATA.shipRarities.epic.color}">${k(1)}<i>${P.icon}</i>${k(2)}<em>Mass Driver</em>${k(3)}<b>12</b>${k(4)}<small>⟳2</small></span><small>${k(5)}≈4 sh + 13 hu · ${k(6)}62% hit ${k(7)}★</small></span></div>`;
    const card = `<div class="rsample"><span class="rcard"><b>Cinder Saint</b><span class="rbar sh"></span><span class="rbar hu"></span><small>${k(8)}»9 &nbsp;${k(9)}○23%</small></span></div>`;
    this.modal(`<div class="rules"><h2>Rules of engagement</h2>
      <div class="rgrid">
        <section><h4>Size triangle</h4>${tri}
          <p>The arrow points at the size it beats: <b>Small beats Large, Large beats Medium, Medium beats Small</b>. Firing along an arrow does <b class="good">×${adv}</b> damage (★), against it <b class="bad">×${dis}</b> (▽); the same size ×1. The tag on the target arrow shows it in battle.</p></section>
        <section><h4>Who shoots whom</h4>${tgt}
          <p>Each ship fires at the ship <b>opposite</b> (1). If that lane is empty or wrecked, it takes the next in this order: right, left, two right, two left. Shots across lanes have <b class="bad">×${DATA.offLaneHit}</b> hit chance, and Large guns track Small ships at only ×${DATA.largeVsSmallHit}.</p></section>
        <section><h4>Shields, hull and damage types</h4>
          <table class="rtab"><tr><th></th><th>vs shields</th><th>vs hull</th></tr>
            <tr><td><i style="color:${P.color}">${P.icon}</i> ${P.name}</td><td class="${P.shield < 1 ? 'bad' : 'good'}">×${P.shield}</td><td class="${P.hull < 1 ? 'bad' : 'good'}">×${P.hull}</td></tr>
            <tr><td><i style="color:${E.color}">${E.icon}</i> ${E.name}</td><td class="${E.shield < 1 ? 'bad' : 'good'}">×${E.shield}</td><td class="${E.hull < 1 ? 'bad' : 'good'}">×${E.hull}</td></tr></table>
          <p>Damage hits <b>shields</b> first; only what gets through reaches the <b>hull</b>. At 0 hull the ship is destroyed. Strip shields with energy, then finish the hull with physical weapons.</p>
          <p><b>On your turn</b>, a ship does one thing: <b>fire</b> a weapon, <b>Restore</b> (regain ${Math.round(DATA.restore.shield * 100)} % of max shields and ${Math.round(DATA.restore.hull * 100)} % of max hull), or <b>move</b> to another lane (ships in between slide over).</p></section>
        <section><h4>Reading a weapon button</h4>${sample}
          <ol class="rlist">
            <li value="1">Damage type: ${P.icon} physical or ${E.icon} energy. The left edge shows the weapon's rarity.</li>
            <li value="2">Weapon name.</li>
            <li value="3">Base damage per hit, before shields, hull and size.</li>
            <li value="4">Recharge: after firing it waits this many turns. A weapon still recharging shows <i>recharging 1</i>.</li>
            <li value="5">Expected damage on <b>this</b> target: to its shields (sh) and its hull (hu), with type and size included. Hits vary a little.</li>
            <li value="6">Chance to hit: accuracy, reduced by the target's evasion, and by firing across lanes or Large at Small (the turn prompt names these).</li>
            <li value="7">★ size advantage (×${adv}) or ▽ disadvantage (×${dis}).</li>
          </ol>
          ${card}
          <ol class="rlist">
            <li value="8">Speed: faster ships act earlier in the round (the turn order at the bottom).</li>
            <li value="9">Evasion: the share of shots this ship dodges.</li>
          </ol>
          <p class="small muted">Blue bar: shields. Orange bar: hull. <b>Restore</b> shows what it would give back.</p>
          <p><b>Officers:</b> the officer leading your fleet (next to its name) gives its ships passive bonuses for the whole battle. Its <b>★ ability</b> can be used once per battle on your turn and doesn't use the ship's turn.</p></section>
      </div>
      <div class="btnrow">${this.btn('Close', 'close', '', false, 'gold')}</div></div>`);
    this.$('modal').querySelector('.modal-box').classList.add('wide');
  },

  // ---------- new-ship splash ----------
  // A full-screen reveal when a ship leaves the slipway: the hull is "printed" from the bottom up in a flash of its
  // rarity colour, then its name, rolls and weapons come in. Epic and better get turning light rays.
  splash: null,       // id of the ship on the splash, or null
  splashShip(ship) {
    const el = this.$('splash');
    if (!el || !ship) return;
    this.splash = ship.id;
    const t = DATA.shipTypes[ship.type], rar = DATA.shipRarities[ship.rarity] || DATA.shipRarities.normal;
    const glow = ship.rarity === 'omega' ? '#ff4040' : ship.rarity === 'normal' ? '#d8d0c0' : rar.color;
    const fleet = !ship.scrapped && Ships.fleetOf(ship.id);
    const where = ship.scrapped ? '<span class="bad">Auto scrap: broken up for parts right away.</span>'
      : fleet ? `Joined <b>${U.esc(fleet.name)}</b>.` : 'Waiting in the hangar.';
    const why = Ships.blocker(ship.size);
    const qc = ship.quality >= 110 ? 'hi' : ship.quality <= 90 ? 'lo' : '';
    const stat = (icon, val, label) => `<span title="${label}"><i>${icon}</i>${val}</span>`;
    const rare = ['epic', 'legendary', 'omega'].includes(ship.rarity);
    el.innerHTML = `<div class="splash r-${ship.rarity} ${rare ? 'rare' : ''}" style="--rc:${rar.color};--glow:${glow}" role="dialog" aria-label="New ship">
      ${rare ? '<div class="sp-rays"></div>' : ''}<div class="sp-flash"></div>
      <div class="sp-box">
        <div class="sp-kicker">◆ New hull commissioned ◆</div>
        <div class="sp-rarity">${U.esc(rar.name.toUpperCase())}</div>
        <div class="sp-ship"><img class="px" src="${Sprites.shipImg(ship.type, 'player', ship.variant || 0)}" alt="${U.esc(t.name)}"><i class="sp-scan"></i></div>
        <div class="sp-info">
          <div class="sp-name">"${U.esc(ship.name)}"</div>
          <div class="sp-type">${U.esc(t.name)} · ${DATA.sizes[ship.size].name} hull · <span class="q ${qc}" title="Stat roll compared with the average ${U.esc(t.name)} of this rarity (100 = average)">Q${ship.quality}</span></div>
          <div class="sp-stats">${stat('◈', ship.shieldMax ?? ship.shield, 'Shield')}${stat('▦', ship.hullMax ?? ship.hull, 'Hull')}${stat('»', ship.speed, 'Speed (turn order)')}${stat('◌', ship.maneuver + '%', 'Maneuverability (evasion chance)')}${stat('⚙', ship.upkeep, 'Maintenance per Cycle (Metals, plus a quarter as much Chemicals)')}</div>
          <div class="sp-weps">${ship.weapons.map((w) => this.weaponChip(w)).join('')}</div>
          <div class="sp-where small">${where}</div>
          <div class="btnrow">${ship.scrapped ? '' : this.btn('Show in Hangar', 'splashhangar')}${this.btn(`Build another ${DATA.sizes[ship.size].name} <small>${U.costText(Ships.buildCost(ship.size))}</small>`, 'buildship', ship.size, !!why)}${this.btn('Close', 'splashclose', '', false, 'gold')}</div>
        </div>
      </div></div>`;
    el.classList.add('show');
    document.body.classList.add('splashing');
    this.splashAt = Date.now();
    if (typeof Sfx !== 'undefined') {
      Sfx.play('reveal');
      if (rare) setTimeout(() => Sfx.play('rare', { rate: ship.rarity === 'omega' ? 0.84 : ship.rarity === 'legendary' ? 1.12 : 1 }), 380);
    }
  },
  closeSplash() {
    const el = this.$('splash');
    this.splash = null;
    document.body.classList.remove('splashing');
    if (el) { el.classList.remove('show'); el.innerHTML = ''; }
  },

  // ---------- Shipyard ----------
  screen_shipyard() {
    const yards = Colonies.yards();
    if (!yards.length) return this.panel('Shipyard', '<p>No planet has an Orbital Shipyard. Build one in orbit on the Buildings or Colonies screen.</p>');
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
    const last = this.lastShip && (G.ships[this.lastShip] || (this.lastScrapped && this.lastScrapped.id === this.lastShip ? this.lastScrapped : null));
    const reveal = last ? `<div class="reveal r-${last.rarity}">${this.shipCard(last, { cls: 'big' })}
        <div><h3 style="color:${DATA.shipRarities[last.rarity].color}">${DATA.shipRarities[last.rarity].name.toUpperCase()}</h3>
        <p class="small">${DATA.shipTypes[last.type].desc}</p>
        <p class="small muted">${last.scrapped ? '<span class="bad">Auto scrap: broken up for parts right away.</span>' : Ships.fleetOf(last.id) ? 'Joined ' + U.esc(Ships.fleetOf(last.id).name) + '.' : 'Waiting in the hangar.'}</p>
        ${last.scrapped ? '' : `<div class="btnrow">${this.btn('Show in Hangar', 'gofleets')}</div>`}</div></div>` : '';
    const lw = this.lastWeapon && G.armory.find((w) => w.id === this.lastWeapon);
    return this.panel('Shipyard', `<p class="flavor">Every hull is laid down blind. The forge-priests swear the machine-spirit chooses what it becomes.</p>
        <p class="small muted">Choose a size and pay; the type, rarity, stats and weapons are rolled. Every stat is drawn from a normal distribution around the type's average, so no two ships are alike; Q on a card shows how well it rolled (100 = average). Rarity shifts the average up. Rates: ${this.rarityRates()}.</p>
        <div class="buildtiles">${['S', 'M', 'L'].map(tile).join('')}</div>${reveal}`) +
      `<div class="grid2">` +
      this.panel('Weapon Forge', `<p class="small">${DATA.forge.desc} Fit forged weapons to ships on the Hangar screen.</p>
        <div class="btnrow">${['S', 'M', 'L'].map((z) => this.btn(`${DATA.sizes[z].name} weapon <small>${U.costText(State.cost(DATA.forge.cost))}</small>`, 'forge', z, !Ships.unlocked(z) || !Colonies.canAfford(State.cost(DATA.forge.cost)))).join('')}</div>
        ${lw ? `<div class="forged">New: ${this.weaponChip(lw)} <small class="muted">(${DATA.sizes[lw.size].name})</small></div>` : ''}`) +
      `</div>`;
  },

  // ---------- Fleets ----------
  screen_fleets() {
    const sel = this.selShip && G.ships[this.selShip] ? G.ships[this.selShip] : null;
    if (!sel) this.selShip = null;
    const selFleet = sel ? Ships.fleetOf(sel.id) : null;
    // every ship not on a mission can be dragged: onto a fleet slot (its lane) or into the hangar
    const cardOf = (sh, busy, drop) => this.shipCard(sh, { act: 'selship', a: sh.id, cls: (sh.id === this.selShip ? 'sel' : '') + (busy ? ' busy' : ''),
      attrs: (busy ? '' : `draggable="true" data-dragship="${sh.id}"`) + (drop ? ` data-dropship="${drop}"` : '') });
    const fleets = G.fleets.map((f) => {
      const ships = Ships.fleetShips(f);
      const canDrop = sel && !f.mission && selFleet !== f && !(selFleet && selFleet.mission);
      const slots = [];
      for (let i = 0; i < DATA.fleetMax; i++) {
        const drop = f.mission ? '' : `${f.id}|${i}`;
        if (ships[i]) slots.push(`<div class="lanewrap"><span class="lanelbl">Lane ${i + 1}</span>${cardOf(ships[i], !!f.mission, drop)}</div>`);
        else slots.push(`<div class="lanewrap" ${drop ? `data-dropship="${drop}"` : ''}>${canDrop ? this.emptySlot('assign', `${sel.id}|${f.id}`, '＋ move here') : this.emptySlot(null, null, f.mission ? '' : '＋')}</div>`);
      }
      const status = f.mission ? `<span class="res-power">${U.esc(Missions.label(f.mission))}</span> ${f.mission.phase === 'out' ? this.btn('Recall', 'recall', f.id, false, 'small') : ''}` : '<span class="muted">at home · ready</span>';
      return `<div class="fleetrow"><div class="fleethead"><b>${U.esc(f.name)}</b> <button class="icon-btn small" data-act="renamefleet" data-a="${f.id}" title="Rename">✎</button> ${this.officerSlot(f)}
          <span class="small">${status}</span><span class="small muted">power ${Ships.groupPower(ships)} · ${ships.length}/${DATA.fleetMax}</span></div>
        <div class="cardrow">${slots.join('')}</div></div>`;
    }).join('');
    const sorts = this.hangarSorts();
    const sortFn = (sorts[this.hangarSort] || sorts.built).fn;
    const hangar = Ships.hangar().sort((a, b) => sortFn(a, b) || a.built - b.built || String(a.id).localeCompare(String(b.id)));
    const cap = Ships.hangarCap(), full = hangar.length >= cap;
    const up = Ships.upkeep();
    const left = this.panel('Fleets', `<p class="small muted">Drag a ship onto a fleet slot or into the hangar (or click it, then click a free slot). A ship's position is its <b>lane in battle</b>: it shoots the enemy opposite first, so put your heaviest guns where they face the biggest threats. Fleets on a mission can't be changed. Up to ${DATA.fleetMax} ships per fleet. Send fleets out from the Star Map.</p>
        <div class="small">${Ships.all().length} ships · maintenance <b class="res-metal">${U.fmt1(up)}</b> Metals + <b class="res-chemicals">${U.fmt1(up * DATA.upkeep.chemShare)}</b> Chemicals per Cycle${G.unpaid ? ' · <span class="bad">unpaid: no repairs</span>' : ''}</div>
        ${fleets || '<p class="muted">No fleets. Build ships at the Shipyard.</p>'}`) +
      this.panel(`Hangar <span class="${hangar.length > cap ? 'bad' : full ? 'res-power' : 'muted'}">${hangar.length} / ${cap}</span>`, `
        <p class="small muted">Ships in no fleet wait here. Each Orbital Shipyard holds ${DATA.hangar.base} ships, plus ${DATA.hangar.perLevel} for every level above 1.${cap ? '' : ' <span class="bad">You have no shipyard, so there is no room.</span>'}${full ? ' <span class="res-power">Full: new ships need a fleet with room.</span>' : ''}</p>
        <div class="btnrow sortrow"><small class="muted">Sort</small>${Object.entries(sorts).map(([k, s]) => this.btn(s.label, 'hangarsort', k, false, 'small' + (this.hangarSort === k ? ' on' : ''))).join('')}</div>
        <div class="cardrow wrap hangar-drop" data-dropship="hangar">${hangar.map((sh) => cardOf(sh)).join('')}
        ${sel && selFleet && !selFleet.mission && !full ? this.emptySlot('assign', `${sel.id}|hangar`, '＋ to hangar') : ''}</div>
        ${hangar.length ? '' : '<p class="muted small">Empty. New ships join a fleet at home with room, or wait here. Drop a ship here to take it out of its fleet.</p>'}`) +
      this.autoScrapPanel() +
      this.panel(`Officers (${Ships.officers().length})`, `<p class="small muted">Each fleet can be led by one officer (＋ Officer on the fleet). Passives apply to its ships in battle; the ★ ability is used once per battle.</p>
        <div class="ocards">${Ships.officers().map((k) => { const f = Ships.officerFleet(k); return this.officerCard(k, { foot: `<small class="${f ? 'good' : 'muted'}">${f ? `Leads ${U.esc(f.name)}` : 'Not leading a fleet'}</small>` }); }).join('')}</div>`) +
      this.panel(`Armory (${G.armory.length})`, G.armory.length ? ['S', 'M', 'L'].map((z) => {
        const ws = G.armory.filter((w) => w.size === z);
        return ws.length ? `<div class="kv"><span>${DATA.sizes[z].name}</span><span class="wlist">${ws.map((w) => this.weaponChip(w)).join('')}</span></div>` : '';
      }).join('') : '<p class="muted small">No spare weapons. Scrap ships, salvage wrecks or use the Weapon Forge.</p>');
    return `<div class="fleetscreen"><div>${left}</div><aside class="side">${sel ? this.shipDetail(sel) : this.panel('Ship', '<p class="muted">Select a ship to see its stats, refit its weapons or move it.</p>')}</aside></div>`;
  },

  // Auto scrap: filters, a preview and the button (Ships.scrapFilter).
  autoScrapPanel() {
    const f = Ships.scrapFilter(), list = Ships.scrapList(), refund = Ships.scrapRefund(list);
    const opt = (key, val, label, on) => this.btn(label, 'scrapf', `${key}:${val}`, false, 'small' + (on ? ' on' : ''));
    const rars = Object.entries(DATA.shipRarities).filter(([k]) => k !== 'omega');
    return this.panel('Auto scrap', `<p class="small muted">Break up every ship that matches, at once. Weapons go to the armory; ${Math.round(DATA.scrapRefund * 100)} % of each hull's cost comes back. Omega ships are never scrapped.</p>
      <div class="kv"><span>Rarity up to</span><span class="btnrow">${rars.map(([k, r]) => opt('rarity', k, `<span style="color:${r.color}">${r.name}</span>`, f.rarity === k)).join('')}</span></div>
      <div class="kv"><span>Hull</span><span class="btnrow">${['S', 'M', 'L'].map((z) => opt('size', z, DATA.sizes[z].name, f.sizes.includes(z))).join('')}</span></div>
      <div class="kv"><span>Roll quality below</span><span class="btnrow">${[[0, 'Any'], [90, 'Q 90'], [100, 'Q 100'], [110, 'Q 110']].map(([q, l]) => opt('quality', q, l, f.quality === q)).join('')}</span></div>
      <div class="kv"><span>Where</span><span class="btnrow">${opt('fleets', 0, 'Hangar only', !f.fleets)}${opt('fleets', 1, 'Hangar + fleets at home', f.fleets)}</span></div>
      <div class="kv"><span>Matching</span><b>${list.length} ship${list.length === 1 ? '' : 's'}${list.length ? ` <small class="muted">· back: ${U.costText(refund)}</small>` : ''}</b></div>
      <div class="btnrow">${this.btn(`Scrap ${list.length} ship${list.length === 1 ? '' : 's'}`, 'autoscrap', '', !list.length, 'danger')}
        ${opt('auto', f.auto ? 0 : 1, f.auto ? '⟳ Auto: on' : '⟳ Auto: off', f.auto)}</div>
      <p class="small muted">${f.auto ? '<b>Auto is on:</b> new ships that match are scrapped as they leave the slipway.' : 'Turn on Auto to scrap new ships that match as soon as they are built.'}</p>`);
  },

  // Sort orders for the hangar. Ties fall back to build order.
  hangarSorts() {
    const size = { S: 0, M: 1, L: 2 }, rar = Object.keys(DATA.shipRarities);
    return {
      built:  { label: 'Newest', fn: (a, b) => b.built - a.built },
      hull:   { label: 'Hull', fn: (a, b) => size[b.size] - size[a.size] || DATA.shipTypes[a.type].name.localeCompare(DATA.shipTypes[b.type].name) },
      rarity: { label: 'Rarity', fn: (a, b) => rar.indexOf(b.rarity) - rar.indexOf(a.rarity) },
      power:  { label: 'Power', fn: (a, b) => Ships.groupPower([b]) - Ships.groupPower([a]) },
      type:   { label: 'Type', fn: (a, b) => DATA.shipTypes[a.type].name.localeCompare(DATA.shipTypes[b.type].name) },
      name:   { label: 'Name', fn: (a, b) => a.name.localeCompare(b.name) },
    };
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
        ${f ? this.btn('→ Hangar', 'assign', `${sh.id}|hangar`, Ships.hangarFree() <= 0, 'small') : ''}
        ${this.btn('New fleet with it', 'newfleet', sh.id, false, 'small')}
        ${this.btn('Scrap', 'scrap', sh.id, false, 'small danger')}</div>`;
    return this.panel('Ship', `${this.shipCard(sh, { cls: 'big' })}
      <p class="small">${t.desc}</p>
      <div class="kv"><span>Class</span><b>${t.name} · ${DATA.sizes[sh.size].name}</b></div>
      <div class="kv"><span>Shield / Hull</span><b>${sh.shield} / ${Math.round(sh.hullNow)}${sh.hullNow < sh.hull ? ` of ${sh.hull}` : ''}</b></div>
      <div class="kv"><span>Speed · Evasion</span><b>${sh.speed} · ${sh.maneuver}%</b></div>
      <div class="kv"><span title="Grows steeply with rarity and with the stat roll (quality), plus a personal random factor">Maintenance</span><b><span class="res-metal">${DATA.resources.metal.icon}${U.fmt1(sh.upkeep)}</span> <span class="res-chemicals">${DATA.resources.chemicals.icon}${U.fmt1(sh.upkeep * DATA.upkeep.chemShare)}</span> <small class="muted">/ Cycle</small></b></div>
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
      opts.push(`<h4>Explore</h4><div class="btnrow">${this.btn(`Launch a survey probe <small>${U.costText(State.cost(DATA.survey.cost))}${etaText}</small>`, 'survey', s.id, !!why, 'gold')}</div>${why && why !== 'Not enough resources' ? `<small class="muted">${why}</small>` : ''}`);
    }
    if (s.explored && Missions.hostile(s)) {
      const enemyPower = g ? Ships.groupPower(g.ships) : 0;
      opts.push(`<h4>Attack</h4>` + (idle.length ? `<div class="btnrow">${idle.map((f) => {
        const p = Ships.groupPower(Ships.fleetShips(f));
        return this.btn(`${U.esc(f.name)} <small>power ${p}${enemyPower ? (p >= enemyPower ? ' ✓' : ' ⚠') : ''} · ${Missions.distance(s.id) || '?'} Cycles</small>`, 'mission', `${f.id}|attack|${s.id}`, !!Missions.blocker(f.id, 'attack', s.id));
      }).join('')}</div>` : '<p class="small muted">No fleet is free.</p>'));
    }
    if (s.explored && !s.owner && !g) {
      const going = G.expeditions.find((m) => m.target === s.id);
      opts.push(`<h4>Settle</h4><p class="small">${going ? 'Colonists are on their way.' : `Choose a planet below and <b>send colonists</b> there: a colony expedition costs ${U.costText(State.cost(DATA.colonize.cost, 'colonize'))}${etaText}.`}</p>`);
    }
    const coming = G.fleets.filter((f) => f.mission && f.mission.target === s.id);
    const exps = G.expeditions.filter((m) => m.target === s.id), probes = G.surveys.filter((m) => m.target === s.id);
    const threats = G.threats.filter((t) => t.target === s.id);
    const notes = [
      ...coming.map((f) => `<div class="small res-power">➤ ${U.esc(f.name)}: ${U.esc(Missions.label(f.mission))}</div>`),
      ...probes.map((m) => `<div class="small res-research">➤ Survey probe arrives in ${m.eta}</div>`),
      ...exps.map((m) => `<div class="small good">➤ Colony expedition to ${U.esc(s.planets[m.planet] ? Colonies.planetName(s, s.planets[m.planet]) : s.name)} arrives in ${m.eta}</div>`),
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
        <div class="btnrow big">${idle.map((f) => this.btn(`Defend with ${U.esc(f.name)} <small>power ${Ships.groupPower(Ships.fleetShips(f))} · ${f.ships.length} ships${f.officer && DATA.officers[f.officer] ? ` · ${U.esc(DATA.officers[f.officer].name)}` : ''}</small>`, 'bdefend', f.id, false, 'gold')).join('')}
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
    const planned = new Map(pick != null && cur ? Battle.pushed(cur, pick).map(([x, l]) => [x, l - x.lane]) : []);
    const unitCard = (u, i) => {
      const isT = u === tgt, acting = i === curIdx;
      const struck = hit && hit.to === i;
      const cls = [u.dead ? 'dead' : '', acting ? 'acting' : '', struck && !hit.miss && !hit.restore ? 'hit' : '', struck && hit.miss ? 'missed' : '', isT ? 'target' : '', u.side === 'player' && pick === u.lane ? 'swap-dest' : ''].join(' ');
      // floating labels keep their place in the animation across re-renders (negative delay = already running)
      const fx = (b.fx || []).filter((f) => f.unit === i && Date.now() - f.t < DATA.battleFxMs).pop();
      let extra = '';
      if (fx) {
        const age = Date.now() - fx.t, timing = `animation-duration:${DATA.battleFxMs}ms;animation-delay:-${age}ms`;
        if (fx.kind === 'hit') {
          // a shield shimmer and/or hull sparks (short), and the damage numbers (they stay up a while)
          if (fx.sh > 0) extra += `<div class="hitfx shield" style="animation-delay:-${age}ms"></div>`;
          if (fx.hu > 0) extra += `<div class="hitfx hull" style="animation-delay:-${age}ms"><i></i></div>`;
          const nums = [fx.sh > 0 && `<span class="dsh">−${fx.sh}</span>`, fx.hu > 0 && `<span class="dhu">−${fx.hu}</span>`].filter(Boolean).join(' ');
          extra += `<div class="floater dmg" style="${timing}">${nums || '<span class="dsh">0</span>'}</div>`;
        } else extra += `<div class="floater ${fx.kind}" style="${timing}">${fx.kind === 'miss' ? 'MISS' : '+ RESTORED'}</div>`;
      }
      if (u.dead) extra += '<div class="wreck-stamp">✕ DESTROYED</div>';
      extra += isT ? `<div class="preview">◎ target${cur.lane !== u.lane ? `<i> · across lanes ×${DATA.offLaneHit} hit</i>` : ''}</div>` : '';
      // the acting ship gets little arrows to pick a lane to swap to
      if (acting && myTurn) {
        extra += `<div class="swapnav"><button class="btn small" data-act="bswapnav" data-a="-1" title="Pick a lane to the left">◀</button><span>swap</span><button class="btn small" data-act="bswapnav" data-a="1" title="Pick a lane to the right">▶</button></div>`;
      }
      const attrs = `data-unit="${i}"` + (u.side === 'player' ? ` data-droplane="${u.lane}"` : '') + (acting && myTurn ? ' draggable="true" data-drag="1"' : '');
      // a planned move (arrows) shows the ships that would make room, nudged aside
      const nudge = planned.get(u);
      return this.shipCard(u, { owner: u.side === 'player' ? 'player' : enemyOwner, cls, extra, attrs, style: nudge ? `--shift:${nudge * 26}px` : '' });
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
        return `<small>≈${Math.round(d.shield)} sh + ${Math.round(d.hull)} hu · ${Math.round(Battle.hitChance(x, tgt, cur) * 100)}% hit${sm > 1 ? ' ★' : sm < 1 ? ' ▽' : ''}</small>`;
      };
      const pushedN = pick != null ? Battle.pushed(cur, pick).filter(([x]) => !x.dead).length : 0;
      const rg = Battle.restoreGain(cur);
      const notes = [cur.lane !== tgt.lane ? `across lanes ×${DATA.offLaneHit} hit` : '', cur.size === 'L' && tgt.size === 'S' ? `small target ×${DATA.largeVsSmallHit} hit` : ''].filter(Boolean);
      controls = `<div class="bprompt">Your turn: <b>${U.esc(cur.name)}</b> targets <b>${U.esc(tgt.name)}</b>${notes.length ? ` <span class="bad">(${notes.join(', ')})</span>` : ''}.</div>
        <div class="bweps">${cur.weapons.map((x, i) => `<button class="btn wbtn" data-act="bfire" data-a="${i}" ${x.cdLeft > 0 ? 'disabled' : ''}>${this.weaponChip(x)}${pv(x)}</button>`).join('')}</div>
        <div class="btnrow swaprow">${pick != null
          ? `${this.btn(`⇄ Confirm: move to lane ${pick + 1}${pushedN ? ` (pushes ${pushedN} aside)` : ''}`, 'bswapconfirm', '', false, 'gold')}${this.btn('Cancel', 'bswapnav', 0, false, 'small')}`
          : `<button class="btn small brestore" data-act="brestore" ${Battle.canRestore(cur) ? '' : 'disabled'} title="Hold position: regain ${Math.round(DATA.restore.shield * 100)} % of max shields and ${Math.round(DATA.restore.hull * 100)} % of max hull. Uses this turn."><span class="wchip">⟲ Restore</span><small>${rg.shield || rg.hull ? `+${Math.round(rg.shield)} sh + ${Math.round(rg.hull)} hu` : 'undamaged'}</small></button><small class="muted">or move: drag the ship, or ◀ ▶ on its card</small>`}</div>`;
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
    return `<div class="battlescreen fitscreen"><div class="board ${myTurn && cur.weapons.length >= 3 ? 'tight' : ''}" id="board">
      ${powerBar}
      <div class="bhead2"><h3>⚔ ${U.esc(s.name)}</h3><span class="muted small">${b.kind === 'attack' ? 'Attack' : 'Defense'} · Round ${b.round}${G.battleQueue.length ? ` · ${G.battleQueue.length} more battle${G.battleQueue.length > 1 ? 's' : ''} waiting` : ''}</span>${tools}</div>
      <div class="bpower enemy" style="--fc:${this.factionColor(enemyOwner)}"><b>${U.esc(enemyName)}</b><span>fleet power <b>${pE}</b></span></div>
      <div class="bside enemy" style="--lanes:${lanes}">${side('enemy')}</div>
      <div class="bgap"></div>
      <div class="bside player" style="--lanes:${lanes}">${side('player')}</div>
      <div class="bpower player" style="--fc:${this.factionColor('player')}"><b>${U.esc(myName)}</b>${b.officer ? this.battleOfficer(b) : ''}<span>fleet power <b>${pP}</b></span></div>
      <svg class="barrow" id="barrow"></svg>
      <div class="bcontrols">${controls}</div>
      ${order}
    </div>
    <aside class="side bside-col">
      <h4>Battle log</h4>
      <div class="blog">${b.log.slice(-30).reverse().map((l) => `<div class="${l.s}">${U.esc(l.t)}</div>`).join('')}</div>
      ${this.btn('⚖ Rules of engagement', 'rules', '', false, 'small rulesbtn')}
    </aside></div>`;
  },

  // While a ship is dragged over a lane: nudge the ships that would make room, opening a gap (null = reset).
  previewMove(lane) {
    const b = G.battle, cur = b && Battle.current();
    document.querySelectorAll('.bside.player .scard[data-unit]').forEach((c) => c.style.removeProperty('--shift'));
    if (lane == null || !cur || !Battle.canSwapTo(cur, lane)) return;
    for (const [x, l] of Battle.pushed(cur, lane)) {
      const c = document.querySelector(`.bside.player .scard[data-unit="${b.units.indexOf(x)}"]`);
      if (c) c.style.setProperty('--shift', `${(l - x.lane) * 26}px`);
    }
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
    // the size multiplier, on a little tag at the middle of the curve (Small > Large > Medium > Small)
    const sm = Battle.sizeMult(cur, tgt);
    const label = sm > 1 ? `×${sm} ★` : sm < 1 ? `×${sm} ▽` : '×1';
    const tcol = sm > 1 ? '#9ae070' : sm < 1 ? '#ff7060' : '#b0a490';
    const tx = 0.25 * x1 + 0.5 * cx + 0.25 * x2, ty = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
    const tw = label.length * 8 + 12;
    const tag = `<g class="arrow-tag"><title>Size ${cur.size} vs ${tgt.size}: damage ×${sm}</title>
        <rect x="${tx - tw / 2}" y="${ty - 10}" width="${tw}" height="20" fill="#0c0b0a" stroke="${tcol}" stroke-width="1.5"/>
        <text x="${tx}" y="${ty + 5}" text-anchor="middle" fill="${tcol}" font-family="VT323, monospace" font-size="17">${label}</text></g>`;
    svg.innerHTML = `<defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${col}"/></marker></defs>
      <g class="arrow-bob"><path d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" fill="none" stroke="#000" stroke-width="7" stroke-linecap="round" opacity=".55"/>
      <path class="arrow-flow" d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-dasharray="10 7" marker-end="url(#ah)"/>${tag}</g>`;
  },
  reportList(n = 5) {
    return G.reports.slice(0, n).map((r) => `<div class="report ${r.won ? 'good' : 'bad'}">
      <b>C${r.c} · ${U.esc(r.sys)}</b> vs ${U.esc(r.enemy)}<br><small>Lost: ${r.myLost.map(U.esc).join(', ') || 'none'} · Destroyed: ${r.theirLost.map(U.esc).join(', ') || 'none'}</small><br><small>${U.esc(r.outcome)}</small></div>`).join('') || '<p class="muted">No battles yet. That will change.</p>';
  },
});
