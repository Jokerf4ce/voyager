// Voyager — menus and screens. Everything is re-rendered from G; buttons use data-act.

const UI = {
  screen: 'map',
  selSys: null,
  selPlanet: null,
  hover: null,       // star-map hover card: { id, x, y }
  yard: null,
  bOpen: null,        // building type expanded on the Buildings screen
  colSys: null,       // system to scroll to on the Colonies screen
  colOpen: {},        // colonies expanded on the Colonies screen, by ref
  modalOpen: false,

  screens: [
    ['overview', '☩', 'Overview'],
    ['battle', '⚔', 'Battle'],
    ['map', '✦', 'Star Map'],
    ['system', '◉', 'Solar System'],
    ['buildings', '▦', 'Buildings'],
    ['colonies', '⌂', 'Colonies'],
    ['research', '☍', 'Research'],
    ['shipyard', '⚒', 'Shipyard'],
    ['fleets', '➤', 'Hangar'],
    ['log', '☰', 'Chronicle'],
    ['settings', '⚙', 'Settings'],
  ],

  $(id) { return document.getElementById(id); },

  render() {
    if (!G) return;
    if (this.screen === 'map' && StarMap.dragging) { this.renderPending = true; return; } // don't rebuild the map mid-drag
    this.renderTop();
    this.renderNav();
    const fn = this['screen_' + this.screen];
    // Keep expanded sections expanded across re-renders.
    const open = new Set([...this.$('main').querySelectorAll('details[data-key]')].filter((d) => d.open).map((d) => d.dataset.key));
    const scroll = this.$('main').scrollTop;
    this.$('main').innerHTML = fn ? fn.call(this) : '';
    for (const d of this.$('main').querySelectorAll('details[data-key]')) if (open.has(d.dataset.key)) d.open = true;
    if (this.screen === this.lastScreen) this.$('main').scrollTop = scroll;
    if (this.screen === 'colonies' && this.colSys != null) {
      const el = document.getElementById('csys-' + this.colSys);
      if (el) el.scrollIntoView({ block: 'start' });
      this.colSys = null;
    }
    this.lastScreen = this.screen;
    if (this.screen === 'battle') this.drawBattleArrow();
    if (this.screen === 'map') {
      const cv = this.$('mapcanvas');
      StarMap.draw(cv); StarMap.attach(cv); // drag to pan, wheel/pinch to zoom, click to select, hover card on mouse
      if (this.hover) this.showHover(); // keep the hover card through re-renders (e.g. Auto)
    }
    if (this.screen === 'system') {
      const sc = this.$('syscanvas');
      if (sc) {
        SystemMap.draw(sc);
        sc.onclick = (ev) => { const p = SystemMap.hit(sc, ev); this.selPlanet = p ? p.idx : null; this.render(); };
      }
    }
    Tutorial.refresh();
    // phones: the ship panel sits below the lists, so bring it into view when a ship is picked
    if (this.scrollToShip) { this.scrollToShip = false; const side = document.querySelector('.fleetscreen .side'); if (side) side.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  },

  renderTop() {
    const net = Economy.net();
    const r = (k, val, perCycle) => `<div class="res res-${k}" data-tip="res:${k}" tabindex="0">
      <span class="ico">${DATA.resources[k].icon}</span><b>${U.amount(k, val)}</b>
      ${perCycle != null ? `<small class="${perCycle < 0 ? 'neg' : ''}">${perCycle >= 0 ? '+' : ''}${U.rate(k, perCycle)}</small>` : ''}</div>`;
    const c = net.caps;
    const cap = (k) => `<div class="res cap res-${k} ${c[k].used > c[k].cap ? 'over' : ''}" data-tip="cap:${k}" tabindex="0">
        <span class="ico">${DATA.capacities[k].icon}</span><b>${U.fmt(c[k].used)}/${U.fmt(c[k].cap)}</b></div>`;
    this.$('top-res').innerHTML = ['metal', 'rare', 'organics', 'electronics', 'chemicals', 'crypto'].map((k) => r(k, G.res[k], net[k])).join('') +
      '<span class="res-sep"></span>' + Object.keys(DATA.capacities).map(cap).join('') + '<span class="res-sep"></span>' + r('research', G.res.research, net.research) +
      (c.eff < 1 ? `<div class="res over" data-tip="ration" tabindex="0"><small class="neg">RATIONING ${Math.round(c.eff * 100)}%</small></div>` : '');
    const fighting = !!(G.battle && G.battle.phase !== 'over');
    const touring = typeof Tutorial !== 'undefined' && Tutorial.active;
    this.$('btn-end').disabled = fighting || !!G.over || touring;
    this.$('btn-end').title = G.over ? 'The game is over' : touring ? 'Finish or skip the tutorial first' : fighting ? 'Finish the battle first' : 'Space / Enter';
    if (this.tipKey) { const el = this.$('top-res').querySelector(`[data-tip="${this.tipKey}"]`); if (el) this.showTip(el); else this.hideTip(); }
    this.$('cycle').textContent = (State.slot === 'tester' ? 'TESTER · ' : '') + 'CYCLE ' + G.cycle;
    this.$('cycle').classList.toggle('tester', State.slot === 'tester');
    const playing = !!Music.timer;
    this.$('btn-music').classList.toggle('on', playing);
    this.$('btn-music').classList.toggle('off', !playing);
    this.$('btn-music').title = playing ? `Now playing: ${Music.find(Music.trackId).name} (click to mute)` : Music.enabled ? 'Music starts after your first click' : 'Music off (click to play)';
  },

  // ---------- top-bar hover cards ----------
  // The card for a resource, a capacity or the rationing warning (data-tip on the element).
  tipHtml(key) {
    const net = Economy.net(), c = net.caps;
    const [kind, k] = key.split(':');
    if (kind === 'res') {
      const d = DATA.resources[k], per = net[k];
      const kindName = { gathered: 'Gathered resource', refined: 'Refined good', points: 'Points', currency: 'Currency' }[d.kind] || '';
      return `<div class="tip-head res-${k}"><span class="tip-ico">${d.icon}</span><div><b>${d.name}</b><small>${kindName}</small></div></div>
        <p>${d.desc}</p>
        <div class="tip-row"><span>In store</span><b>${U.amount(k, G.res[k])}</b></div>
        <div class="tip-row"><span>Per Cycle</span><b class="${per < 0 ? 'neg' : 'pos'}">${per >= 0 ? '+' : ''}${U.rate(k, per)}</b></div>`;
    }
    if (kind === 'cap') {
      const d = DATA.capacities[k], x = c[k], over = x.used > x.cap;
      const pct = x.cap ? Math.min(100, x.used / x.cap * 100) : 100;
      return `<div class="tip-head res-${k}"><span class="tip-ico">${d.icon}</span><div><b>${d.name}</b><small>Capacity · not stored</small></div></div>
        <p>${d.desc}</p>
        <div class="tip-row"><span>Used / available</span><b class="${over ? 'neg' : ''}">${U.fmt(x.used)} / ${U.fmt(x.cap)}</b></div>
        <div class="tip-bar ${over ? 'over' : ''}" style="color:${d.color}"><i style="width:${pct}%"></i></div>
        ${x.ships ? `<div class="tip-row small"><span>Buildings ${U.fmt(x.buildings)} · ships ${U.fmt(x.ships)}</span></div>` : ''}
        ${over ? '<p class="neg small">Over capacity: all production is rationed.</p>' : ''}`;
    }
    return `<div class="tip-head"><span class="tip-ico neg">⚠</span><div><b class="neg">Rationing ${Math.round(c.eff * 100)}%</b><small>Over capacity</small></div></div>
      <p>A capacity is overdrawn, so every colony produces only ${Math.round(c.eff * 100)}% of its output. Build Power Plants, Habitats or Datacenters, or demolish something.</p>`;
  },
  // The producers / consumers lists under a hover card.
  tipLists(key) {
    const { plus, minus } = Economy.breakdown(key), k = key.split(':')[1];
    const isCap = key.startsWith('cap:'), num = (v) => isCap ? U.fmt1(v) : U.rate(k, v);
    const list = (rows, sign, title, empty) => `<div class="tip-list"><h5>${title}</h5>${rows.length
      ? rows.slice(0, 6).map(([n, v]) => `<div class="tip-row"><span>${U.esc(n)}</span><b class="${sign > 0 ? 'pos' : 'neg'}">${sign > 0 ? '+' : '−'}${num(v)}</b></div>`).join('')
        + (rows.length > 6 ? `<div class="tip-row more"><span>and ${rows.length - 6} more</span></div>` : '')
      : `<div class="tip-row more"><span>${empty}</span></div>`}</div>`;
    return list(plus, 1, isCap ? 'Provided by' : 'Produced by', 'nothing yet')
      + list(minus, -1, isCap ? 'Used by' : 'Consumed by', isCap ? 'nothing' : 'nothing per Cycle (spent on building)');
  },
  showTip(el) {
    const tip = this.$('tip');
    if (!tip || !el || !G) return;
    this.tipKey = el.dataset.tip;
    tip.innerHTML = this.tipHtml(this.tipKey) + (this.tipKey === 'ration' ? '' : this.tipLists(this.tipKey));
    tip.classList.add('show');
    const r = el.getBoundingClientRect(), w = tip.offsetWidth;
    tip.style.left = Math.max(6, Math.min(window.innerWidth - w - 6, r.left + r.width / 2 - w / 2)) + 'px';
    tip.style.top = (r.bottom + 8) + 'px';
  },
  hideTip() { this.tipKey = null; const tip = this.$('tip'); if (tip) tip.classList.remove('show'); },

  renderNav() {
    const alert = { battle: G.battle ? 'alert' : '', fleets: '', gameover: 'alert' };
    const screens = G.over === 'lose' ? [['gameover', '☠', 'Fallen'], ...this.screens] : this.screens;
    this.$('nav').innerHTML = screens.map(([id, ico, label]) =>
      `<button class="nav-btn ${this.screen === id ? 'active' : ''} ${alert[id] || ''}" data-act="screen" data-a="${id}"><span>${ico}</span><em>${label}${id === 'battle' && G.battle ? ' !' : ''}</em></button>`).join('');
  },

  panel(title, body, cls = '') { return `<section class="panel ${cls}"><h2>${title}</h2>${body}</section>`; },
  btn(label, act, a = '', disabled = false, cls = '') {
    return `<button class="btn ${cls}" data-act="${act}" data-a="${a}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  },
  yieldText(p) {
    const y = Economy.planetYield(p, Economy.caps().eff);
    const parts = ['metal', 'rare', 'organics', 'electronics', 'chemicals', 'research', 'crypto'].filter((k) => y[k] > 0.001)
      .map((k) => `<span class="res-${k}">${DATA.resources[k].icon}${U.rate(k, y[k])}</span>`);
    const eats = Object.entries(y.inputs).filter(([, v]) => v > 0).map(([k, v]) => `${U.fmt1(v)}${DATA.resources[k].icon}`).join(' ');
    return (parts.join(' ') || '<span class="muted">no output</span>') + (eats ? ` <small class="muted">(refining eats ${eats})</small>` : '');
  },
  // Gathering ratings, e.g. "⬡●●○ ◇●○○ ❦●●●"
  ratingText(p) {
    return ['metal', 'rare', 'organics'].map((k) => {
      const r = Math.min(4, Economy.rating(p, k));
      return `<span class="res-${k}" title="${DATA.resources[k].name} rating ${r}">${DATA.resources[k].icon}${'●'.repeat(r)}${'○'.repeat(Math.max(0, 3 - r))}</span>`;
    }).join(' ');
  },
  // A building's effect in icons, built from its data: "+2 ⬡ × planet rating", "2 ⬡ + 0.5 ◇ → 2 ⍯", "+6 ⏻".
  // Buildings without a numeric effect keep their text, with resource names swapped for icons.
  bDesc(k) {
    const d = DATA.buildings[k];
    const ico = (r) => { const x = DATA.resources[r] || DATA.capacities[r]; return `<span class="res-${r}" title="${x.name}">${x.icon}</span>`; };
    const num = (v) => U.fmt1 ? U.fmt1(v) : v;
    if (d.gathers) return [d.gathers, d.also].filter(Boolean).map((r) => `+2 ${ico(r)}`).join(' / ') + ' <span class="muted">× planet rating</span>';
    if (d.refines) return Object.entries(d.refines.in).map(([r, v]) => `${num(v)} ${ico(r)}`).join(' + ') + ` → ${num(d.refines.amount)} ${ico(d.refines.out)}`;
    const gives = Object.entries(d.cap || {}).filter(([, v]) => v < 0);
    if (gives.length) return gives.map(([r, v]) => `+${-v} ${ico(r)}`).join(' ') + (d.solar ? ' <span class="muted">× starlight</span>' : '');
    let t = U.esc(d.desc);
    for (const [r, x] of [...Object.entries(DATA.resources), ...Object.entries(DATA.capacities)]) t = t.split(x.name).join(ico(r));
    return t;
  },
  // What a building draws per level (its "gives" are already in bDesc).
  capUses(cap) {
    const uses = Object.entries(cap || {}).filter(([, v]) => v > 0).map(([k, v]) => `<span class="res-${k}" title="${DATA.capacities[k].name}">${v}${DATA.capacities[k].icon}</span>`).join(' ');
    return uses ? `<span class="muted">uses</span> ${uses}` : '';
  },
  capText(cap, verb = true) {
    const part = (sign) => Object.entries(cap || {}).filter(([, v]) => v * sign > 0)
      .map(([k, v]) => `<span class="res-${k}" title="${DATA.capacities[k].name}">${Math.abs(v)}${DATA.capacities[k].icon}</span>`).join(' ');
    const gives = part(-1), uses = part(1);
    if (!verb) return [gives, uses].filter(Boolean).join(' ');
    return [gives && `<span class="muted">gives</span> ${gives}`, uses && `<span class="muted">uses</span> ${uses}`].filter(Boolean).join(' · ');
  },
  planetImg(s, p, size = 48) {
    // Sprites are drawn at their size class (dwarfs are small) on a fixed 32px frame.
    const px = DATA.planetSizes[p.size].sprite, scale = size / 32;
    return `<span class="planet-frame" style="width:${size}px;height:${size}px"><img class="px" src="${Sprites.planet(p, s.id + '-' + p.idx)}" width="${Math.round(px * scale)}" height="${Math.round(px * scale)}"></span>`;
  },
  habText(p, compact) {
    const h = DATA.habitability[p.hab];
    const pips = '●'.repeat(p.hab) + '○'.repeat(5 - p.hab);
    const pct = (m) => '×' + m;
    return `<span class="hab" style="color:${h.color}" title="Habitability ${p.hab}/5. Building costs ${pct(Colonies.habMult(p, 'surface'))} on the surface, ${pct(Colonies.habMult(p, 'orbit'))} in orbit.">${pips} ${h.name}</span>
      ${compact ? '' : `<span class="muted">· costs ${p.slots.surface ? pct(Colonies.habMult(p, 'surface')) + ' surface' : 'no surface'}, ${pct(Colonies.habMult(p, 'orbit'))} orbit</span>`}`;
  },
  bIcon(key, size = 24) {
    return `<img class="px bicon" src="${Sprites.building(key)}" width="${size}" height="${size}" alt="">`;
  },
  starImg(s, size = 64) {
    return `<span class="planet-frame star-frame" style="width:${size}px;height:${size}px"><img class="px" src="${Sprites.star(s.star, s.id)}" width="${size}" height="${size}" alt="${U.esc(DATA.starClasses[s.star].name)}"></span>`;
  },
  planetMods(p) {
    const icon = (k) => (DATA.capacities[k] || DATA.resources[k]).icon;
    return [this.ratingText(p), ...Object.entries(Planets.mult(p)).map(([k, v]) => `<span class="res-${k}">${icon(k)}×${v}</span>`)].join(' ');
  },

  // ---------- screens ----------
  screen_overview() {
    const net = Economy.net(), inc = Economy.income(), c = net.caps;
    const cols = Colonies.playerPlanets();
    const power = Ships.groupPower(Ships.all());
    const factionRow = (id) => {
      const f = DATA.factions[id], ai = G.ai[id];
      const known = G.systems.some((s) => s.owner === id && s.explored);
      const n = G.systems.filter((s) => s.owner === id).length;
      return `<div class="row"><span class="dot" style="background:${f.color}"></span><b style="color:${f.color}">${known ? f.name : 'Unknown signal'}</b>
        <span class="muted">${!ai.alive ? 'EXTINCT' : known ? `${n} known worlds` : 'not yet found'}</span></div>`;
    };
    const threats = G.threats.map((t) => `<div class="report bad"><b>⚠ ${U.esc(t.name)}</b> → ${U.esc(G.systems[t.target].name)} in ${t.eta} Cycle${t.eta > 1 ? 's' : ''}<br><small>${t.ships.length} ships · power ${Ships.groupPower(t.ships)}</small></div>`).join('');
    const away = G.fleets.filter((f) => f.mission).map((f) => `<div class="small"><b>${U.esc(f.name)}</b> <span class="muted">${U.esc(Missions.label(f.mission))}</span></div>`).join('');
    return `<div class="grid2">
      ${this.panel('The Last Covenant', `
        <p class="flavor">The homeworld burned. The Covenant fled into the Shroud carrying ten thousand frozen souls, and now it has to find somewhere to survive.</p>
        <div class="stats">
          <div><small>Systems held</small><b>${Colonies.playerSystems().length}</b></div>
          <div><small>Planets settled</small><b>${cols.length}</b></div>
          <div><small>Fleets</small><b>${G.fleets.length}</b></div>
          <div><small>Ships</small><b>${Ships.all().length}</b></div>
          <div><small>Fleet power</small><b>${U.fmt(power)}</b></div>
          <div><small>Expeditions</small><b>${G.surveys.length + G.expeditions.length}</b></div>
          <div><small>Systems charted</small><b>${G.stats.explored}</b></div>
          <div><small>Battles won</small><b>${G.stats.battlesWon}</b></div>
          <div><small>Worlds taken</small><b>${G.stats.coloniesTaken}</b></div>
        </div>`)}
      ${this.panel('Per Cycle', `
        ${['metal', 'rare', 'organics'].map((k) => `<div class="kv"><span>${DATA.resources[k].name} <small class="muted">(gathered ${U.fmt1(inc[k])}${inc.inputs[k] ? `, refining uses ${U.fmt1(inc.inputs[k])}` : ''})</small></span><b class="res-${k}">${net[k] >= 0 ? '+' : ''}${U.fmt1(net[k])}</b></div>`).join('')}
        <div class="kv"><span>Electronics <small class="muted">(refined)</small></span><b class="res-electronics">+${U.fmt1(net.electronics)}</b></div>
        <div class="kv"><span>Chemicals <small class="muted">(refined)</small></span><b class="res-chemicals">+${U.fmt1(net.chemicals)}</b></div>
        <div class="kv"><span>Research <small class="muted">(Research Labs)</small></span><b class="res-research">+${U.fmt1(net.research)}</b></div>
        <div class="kv"><span>Crypto Shards <small class="muted">(Finance Districts)</small></span><b class="res-crypto">+${U.rate('crypto', net.crypto)}</b></div>
        ${net.upkeep ? `<div class="kv"><span>Fleet maintenance <small class="muted">(included above)</small></span><b class="neg">−${U.fmt1(net.upkeep)} ${DATA.resources.metal.icon} −${U.fmt1(net.upkeep * DATA.upkeep.chemShare)} ${DATA.resources.chemicals.icon}</b></div>` : ''}
        <h4>Capacities</h4>
        ${Object.entries(DATA.capacities).map(([k, d]) => `<div class="kv"><span class="res-${k}">${d.icon} ${d.name}</span><b>${U.fmt1(c[k].used)} / ${U.fmt1(c[k].cap)}</b></div>
          <div class="small muted">buildings ${U.fmt1(c[k].buildings)}</div>
          <div class="bar cap-${k} ${c[k].used > c[k].cap ? 'over' : ''}"><i style="width:${Math.min(100, c[k].used / Math.max(1, c[k].cap) * 100)}%"></i></div>`).join('')}
        ${c.eff < 1 ? `<p class="bad small">Over capacity. Rationing has cut all production to ${Math.round(c.eff * 100)}%.</p>` : `<p class="muted small">You cannot build past a capacity.</p>`}
        <p class="muted small">While the game is closed, your empire keeps producing at ${DATA.config.offlineEfficiency * 100}% efficiency (1 Cycle per ${DATA.config.offlineSecondsPerCycle}s, max ${DATA.config.offlineMaxCycles}).</p>`)}
      ${this.panel('Construction', this.constructionList())}
      ${this.panel('Buildings', this.buildingSummary())}
      ${this.panel('Xenos', ['chorus', 'remnant'].map(factionRow).join('') + `<p class="muted small">Destroy every alien world to win. Lose all your colonies and the Covenant ends.</p>`)}
      ${this.panel('Threats & Missions', (threats || (G.raidsOpen ? '<p class="muted small">No raids detected.</p>' : (AI.raids().graceColonies ? `<p class="muted small">The xenos have not noticed you yet. Raids begin once you have founded ${AI.raids().graceColonies} colonies besides your capital (${Math.min(AI.foundedColonies(), AI.raids().graceColonies)}/${AI.raids().graceColonies}).</p>` : `<p class="muted small bad">No grace period on ${State.diff().name}: raids can come from Cycle ${AI.raids().fromCycle || 1}.</p>`))) + (away || '<p class="muted small">All fleets are home.</p>'), 'threats')}
      ${this.panel('Battle Reports', this.reportList(5))}
    </div>`;
  },

  // The end: every colony is lost. Shows what the Covenant achieved and offers a new start.
  screen_gameover() {
    const st = G.stats, n = (v) => `<b>${U.fmt(v)}</b>`;
    const best = G.reports.filter((r) => r.won).length;
    return `<div class="gameover">
      <div class="go-skull">☠</div>
      <h1>The Covenant Ends</h1>
      <p class="flavor">The last colony falls. The frozen souls in the Ark-holds will never wake.<br>Something in the dark sings over the ruins.</p>
      <div class="stats go-stats">
        <div><small>Difficulty</small><b>${State.diff().name}</b></div>
        <div><small>Cycles endured</small>${n(G.cycle)}</div>
        <div><small>Systems charted</small>${n(st.explored)}</div>
        <div><small>Worlds taken</small>${n(st.coloniesTaken)}</div>
        <div><small>Battles won</small>${n(st.battlesWon)}</div>
        <div><small>Battles lost</small>${n(st.battlesLost)}</div>
        <div><small>Ships still flying</small>${n(Ships.all().length)}</div>
      </div>
      <p>The void is wide, and there are other galaxies. Wake a new Ark and try again.</p>
      <div class="btnrow go-btns">${this.btn('☩ Begin anew', 'newgame-confirm', '', false, 'gold big')}${this.btn('Look at the ruins', 'screen', 'map')}</div>
      <p class="small muted">Starting anew replaces this save. The tutorial opens again; you can skip it.</p>
    </div>`;
  },

  // Open the selected system on the Solar System screen.
  openSystem() {
    this.selPlanet = null;
    this.screen = 'system';
    this.render();
  },

  // Phone-width layout (matches the 820 px breakpoint in style.css).
  narrow() { return window.matchMedia('(max-width: 820px)').matches; },

  // The star map fills the screen; the selected system's panel (missions, planets) sits beside it.
  screen_map() {
    const s = this.selSys != null ? G.systems[this.selSys] : null;
    const hint = this.narrow()
      ? 'Drag to pan, pinch to zoom, tap a system to select it. Double-tap opens its solar system.'
      : 'Drag to pan, scroll or pinch to zoom. Hover a system for a summary, click to select it, double-click to open its solar system. The galaxy grows as you explore.';
    const open = s && s.explored ? `<div class="btnrow side-top">${this.btn('◉ Open solar system', 'opensys', '', false, 'gold')}</div>` : '';
    return `<div class="mapscreen fitscreen">
      <div class="mapcol">
        <div class="mapbox"><canvas id="mapcanvas"></canvas>
          <div class="mapctl">
            <button class="btn" data-act="mapzoom" data-a="1.4" title="Zoom in">+</button>
            <button class="btn" data-act="mapzoom" data-a="0.714" title="Zoom out">−</button>
            <button class="btn" data-act="maphome" title="Centre on the home system">⌂</button>
            ${s ? `<button class="btn" data-act="mapcenter" title="Centre on ${U.esc(s.name)}">◎</button>` : ''}
          </div>
          <div id="maphover" class="maphover"></div></div>
        <div class="maphint">${hint}</div>
      </div>
      <aside class="side">${open}${this.systemPanel()}</aside>
    </div>`;
  },

  // The selected system up close: star and planets, with the same panel beside it.
  screen_system() {
    let s = this.selSys != null ? G.systems[this.selSys] : null;
    if (!s) { this.selSys = G.homeId; s = G.systems[G.homeId]; }
    const back = this.btn('✦ Star Map', 'mapsys', s.id);
    if (!s.explored) {
      return `<div class="sysscreen fitscreen"><div class="mapcol"><h3 class="sysmap-title">? ${U.esc(s.name)} ${back}</h3>
          <p class="flavor">Uncharted. Send a survey probe to see its star and planets.</p></div>
        <aside class="side">${this.systemPanel()}</aside></div>`;
    }
    return `<div class="sysscreen fitscreen">
      <div class="mapcol">
        <div class="sysmap-title"><h3>◉ ${U.esc(s.name)}</h3>${back}</div>
        <div class="sysbox"><canvas id="syscanvas" width="${SystemMap.W}" height="${SystemMap.H}"></canvas></div>
        <div class="maphint">Click a planet to inspect it. Hot worlds orbit close to the star, frozen ones far out.</div>
      </div>
      <aside class="side">${this.systemPanel()}</aside>
    </div>`;
  },

  // Hover card over the star map.
  mapHover(cv, ev) {
    const s = StarMap.hit(cv, ev);
    const box = cv.parentElement.getBoundingClientRect();
    this.hover = s ? { id: s.id, x: ev.clientX - box.left, y: ev.clientY - box.top } : null;
    cv.style.cursor = s ? 'pointer' : 'crosshair';
    this.showHover();
  },
  showHover() {
    const el = this.$('maphover');
    if (!el) return;
    if (!this.hover) { el.classList.remove('show'); return; }
    const s = G.systems[this.hover.id];
    if (el.dataset.sys !== String(s.id) || !el.classList.contains('show')) { el.innerHTML = this.hoverCard(s); el.dataset.sys = s.id; }
    el.classList.add('show');
    const W = el.parentElement.clientWidth, H = el.parentElement.clientHeight;
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = this.hover.x + 18, y = this.hover.y + 18;
    if (x + w > W) x = this.hover.x - w - 18;
    if (y + h > H) y = Math.max(0, H - h);
    el.style.left = Math.max(0, x) + 'px';
    el.style.top = y + 'px';
  },
  hoverCard(s) {
    const g = Missions.guard(s), th = G.threats.filter((t) => t.target === s.id), mine = G.fleets.filter((f) => f.mission && f.mission.target === s.id);
    const fleetLine = (g && s.explored ? `<div class="small" style="color:${this.factionColor(g.owner)}">${U.esc(g.name)}: ${g.ships.length} ship${g.ships.length > 1 ? 's' : ''} · power ${Ships.groupPower(g.ships)}</div>` : '')
      + th.map((t) => `<div class="small bad">⚠ ${U.esc(t.name)} arrives in ${t.eta}</div>`).join('')
      + mine.map((f) => `<div class="small res-power">➤ ${U.esc(f.name)} · ${U.esc(Missions.label(f.mission))}</div>`).join('');
    if (!s.explored) return `<h4>? ${U.esc(s.name)}</h4><p class="muted small">Uncharted. Send a survey probe.</p>${fleetLine}`;
    const st = DATA.starClasses[s.star], owner = s.owner ? DATA.factions[s.owner] : null;
    return `<div class="sys-head">${this.starImg(s, 36)}<div><h4>${U.esc(s.name)}</h4><small style="color:${st.color}">${st.name}</small></div></div>
      <div class="small" style="color:${owner ? owner.color : '#8a8070'}">${owner ? owner.name : 'Unclaimed'}</div>
      ${s.planets.map((p) => `<div class="hp-row">${this.planetImg(s, p, 20)}<span>${U.esc(Colonies.planetName(s, p))}</span>${p.colony ? '<span class="lvl">⌂</span>' : ''}<span class="hab-pips" style="color:${DATA.habitability[p.hab].color}">${'●'.repeat(p.hab)}${'○'.repeat(5 - p.hab)}</span></div>`).join('')}
      ${fleetLine}`;
  },

  systemPanel() {
    const s = this.selSys != null ? G.systems[this.selSys] : null;
    if (!s) return this.panel('No system selected', '<p class="muted">Select a star on the map.</p>');
    if (!s.explored) {
      return this.panel('Uncharted', `<p class="flavor">The augurs see only static. Send a survey probe.</p>` + this.missionPanel(s));
    }
    const owner = s.owner ? DATA.factions[s.owner] : null;
    const hostile = !!Missions.guard(s);
    const st = DATA.starClasses[s.star];
    let body = `<div class="sys-head">${this.starImg(s, 64)}<div><h3>${U.esc(s.name)}</h3><b style="color:${st.color}">${st.name}</b></div></div>
      <div class="small muted">${st.desc} Starlight ×${st.solar} Power${st.habMod ? ', habitability ' + st.habMod : ''}${st.mult ? ', ' + Object.entries(st.mult).map(([k, v]) => (DATA.capacities[k] || DATA.resources[k]).name + ' ×' + v).join(', ') : ''}.</div>
      <div style="color:${owner ? owner.color : '#8a8070'}">${owner ? owner.name : 'Unclaimed'}</div>
      ${this.missionPanel(s)}
      <h4>Planets</h4>`;
    body += s.planets.map((p) => {
      let act = '';
      if (!p.colony && !hostile) {
        if (s.owner === 'player') { const sc = Colonies.settleCost(p); act = this.btn(`Settle ${U.costText(sc)}`, 'settle', s.id + ':' + p.idx, !Colonies.canAfford(sc), 'small'); }
        else if (!s.owner) {
          const exp = G.expeditions.find((m) => m.target === s.id && m.planet === p.idx);
          const why = Missions.colonizeBlocker(s.id, p.idx);
          act = exp ? `<span class="small good">➤ Colonists arrive in ${exp.eta}</span>`
            : this.btn(`Send colonists <small>${U.costText(State.cost(DATA.colonize.cost, 'colonize'))}</small>`, 'colonize', `${s.id}:${p.idx}`, !!why, 'small gold') + (why && why !== 'Not enough resources' && why !== 'Colonists are on their way' ? ` <small class="muted">${why}</small>` : '');
        }
      }
      return `<div class="planet-row ${p.colony ? 'settled' : ''} ${this.selPlanet === p.idx ? 'sel' : ''}" data-act="selplanet" data-a="${p.idx}">${this.planetImg(s, p, 40)}
        <div><b>${U.esc(Colonies.planetName(s, p))}</b> <span class="muted small">${Planets.label(p)}</span>
        <div class="small">${this.habText(p, true)}</div>
        <div class="small muted">${this.planetMods(p)} · surface ${p.slots.surface} · orbit ${p.slots.orbit}</div>
        ${p.colony ? `<div class="small" style="color:${owner.color}">${s.owner === 'player' ? this.yieldText(p) : 'Colony'}</div>` : ''}
        ${act ? `<div class="btnrow">${act}</div>` : ''}</div></div>`;
    }).join('');
    if (s.owner === 'player') {
      const yard = s.planets.find((p) => p.colony && p.colony.orbit.shipyard > 0);
      body += `<div class="btnrow">${this.btn('Manage colonies', 'gocolony', s.id)}${yard ? this.btn('Shipyard', 'goyard') : ''}</div>`;
    }
    return this.panel('System', body);
  },

  mapClick(cv, ev) {
    const s = StarMap.hit(cv, ev);
    // The canvas is redrawn on every click, so double-clicks are detected by hand.
    const now = Date.now(), dbl = s && this.lastClick && this.lastClick.id === s.id && now - this.lastClick.t < 450;
    this.lastClick = s ? { id: s.id, t: now } : null;
    if (!s) return;
    Sfx.play('blip', { rate: 0.96 + Math.random() * 0.08 });
    this.selSys = s.id;
    if (dbl) { this.openSystem(); return; }
    this.render();
  },

  screen_colonies() {
    const systems = Colonies.playerSystems().slice().sort((a, b) => (b.id === G.homeId) - (a.id === G.homeId)); // home first
    if (!systems.length) return this.panel('No colonies', '<p>The Covenant has no worlds left.</p>');
    const total = systems.reduce((n, x) => n + x.planets.filter((p) => p.colony).length, 0);
    const jump = systems.length > 1 ? `<div class="btnrow">${systems.map((x) => this.btn(`${U.esc(x.name)} <small>${x.planets.filter((p) => p.colony).length}/${x.planets.length}</small>`, 'colsys', x.id, false, 'small')).join('')}</div>` : '';
    return `<p class="muted small">${total} ${total === 1 ? 'colony' : 'colonies'} in ${systems.length} ${systems.length === 1 ? 'system' : 'systems'}. Click a colony to manage its buildings.</p>` + jump +
      systems.map((x) => this.colonySystem(x)).join('');
  },

  // One system on the Colonies screen: a header line, then a compact row per planet (click to expand).
  colonySystem(s) {
    const colRow = (p) => {
      const ref = Colonies.ref(s, p), open = !!this.colOpen[ref];
      const capital = s.id === G.homeId && p.idx === (G.homePlanet || 0);
      const chips = ['surface', 'orbit'].flatMap((L) => Object.entries(p.colony[L]).filter(([, v]) => v > 0)
        .map(([k, v]) => `<span class="bchip" title="${U.esc(DATA.buildings[k].name)} Lv ${v} (${DATA.layers[L].toLowerCase()})">${this.bIcon(k, 20)}<b>${v}</b></span>`)).join('');
      const slots = ['surface', 'orbit'].map((L) => Colonies.slots(p, L) ? `${L === 'surface' ? '▤' : '◌'}${Colonies.slotsUsed(p, L)}/${Colonies.slots(p, L)}` : '').filter(Boolean).join(' ');
      return `<div class="crow ${open ? 'open' : ''}"><div class="chead" data-act="colopen" data-a="${ref}">
          ${this.planetImg(s, p, 32)}
          <div class="grow"><b>${U.esc(Colonies.planetName(s, p))}</b>${capital ? ' <span class="lvl">Capital</span>' : ''} <small class="muted">${Planets.label(p)} · ${slots} slots</small>
            <div class="small">${this.habText(p, true)} · ${this.yieldText(p)}</div>
            <div class="chips">${chips || '<small class="muted">no buildings</small>'}</div></div>
          <span class="muted">${open ? '▾' : '▸'}</span></div>
        ${open ? this.colonyDetail(s, p) : ''}</div>`;
    };
    const free = s.planets.filter((p) => !p.colony);
    const freeRow = (p) => `<div class="crow unsettled"><div class="chead">${this.planetImg(s, p, 32)}
        <div class="grow"><b>${U.esc(Colonies.planetName(s, p))}</b> <small class="muted">${Planets.label(p)} · surface ${p.slots.surface} · orbit ${p.slots.orbit}</small>
          <div class="small">${this.habText(p, true)} · ${this.planetMods(p)}</div></div>
        ${this.btn(`Settle ${U.costText(Colonies.settleCost(p))}`, 'settle', s.id + ':' + p.idx, !Colonies.canAfford(Colonies.settleCost(p)), 'small')}</div></div>`;
    const st = DATA.starClasses[s.star];
    return `<div class="panel csys" id="csys-${s.id}"><div class="star-line">${this.starImg(s, 32)}<h3>${U.esc(s.name)}</h3>
        <span class="small" style="color:${st.color}">${st.name}</span> <span class="muted small">· starlight ×${st.solar} Power</span></div>
      ${this.projectSection(s)}
      ${s.planets.filter((p) => p.colony).map(colRow).join('')}
      ${free.length ? `<details data-key="free-${s.id}"><summary class="small">Unsettled planets here (${free.length})</summary>${free.map(freeRow).join('')}</details>` : ''}</div>`;
  },

  // System projects of one system (DATA.systemProjects): built for the whole system, one slot per system.
  projectSection(s) {
    const used = Colonies.projectSlotsUsed(s), st = DATA.starClasses[s.star];
    const row = (key) => {
      const d = DATA.systemProjects[key], built = (s.projects || {})[key], c = (s.projectBuild || []).find((x) => x.key === key);
      const pw = Colonies.projectPower(s, key), why = Colonies.projectBlocker(s, key);
      const head = `${this.bIcon(key, 28)}<div class="grow"><b>${d.name}</b> <span class="res-power">${DATA.capacities.power.icon} +${U.fmt1(pw)} Power</span>
        <br><small class="muted">${d.desc}</small><br><small class="muted">Here: ${st.name}, starlight ×${st.solar}.</small></div>`;
      if (built) return `<div class="bld proj done-proj">${head}<div class="right"><span class="lvl">Online</span></div></div>`;
      if (c) return `<div class="bld proj building">${head}<div class="right"><small>${c.eta} Cycle${c.eta > 1 ? 's' : ''} left</small><div class="bar build-bar"><i style="width:${(c.total - c.eta) / c.total * 100}%"></i></div><small class="muted">site draws ${this.capText(DATA.construction.cap, false)}</small></div></div>`;
      if (used >= DATA.systemSlots) return '';
      return `<div class="bld proj new">${head}<div class="right">${U.costText(Colonies.projectCost(key))}<br><small class="muted">${d.cycles} Cycles</small><br>${why && why !== 'Not enough resources' ? `<small class="bad">${why}</small><br>` : ''}${this.btn('Build', 'project', `${s.id}:${key}`, !!why)}</div></div>`;
    };
    const rows = Object.keys(DATA.systemProjects).map(row).join('');
    return `<div class="projects"><h4>System projects <span class="muted">${used}/${DATA.systemSlots} slot${DATA.systemSlots > 1 ? 's' : ''}</span></h4>
      ${used ? rows : `<details data-key="proj-${s.id}"><summary class="small">Megastructures for the whole system (${Object.keys(DATA.systemProjects).length})</summary>${rows}</details>`}</div>`;
  },

  // The full build panel of one colony (both layers).
  colonyDetail(s, p) {
    const layer = (L) => {
        const used = Colonies.slotsUsed(p, L), max = Colonies.slots(p, L);
        if (!max) return `<div class="layer"><h4>${DATA.layers[L]} <span class="muted">no ${L}</span></h4><p class="muted small">${p.comp === 'gas' ? 'Nothing stands on a gas giant. Build in orbit.' : 'Extremely hazardous. Nothing can be built on the surface. Build in orbit.'}</p></div>`;
        const keys = Object.keys(DATA.buildings).filter((k) => DATA.buildings[k].layers.includes(L));
        const site = (k) => Colonies.constructing(p, L, k);
        const built = keys.filter((k) => p.colony[L][k] > 0 || site(k)), avail = keys.filter((k) => !(p.colony[L][k] > 0) && !site(k));
        const row = (k) => {
          const b = DATA.buildings[k], lvl = p.colony[L][k] || 0;
          const cost = Colonies.buildCost(p, L, k), why = Colonies.blocker(p, L, k), c = site(k);
          if (c) return `<div class="bld building">${this.bIcon(k, 24)}<div class="grow"><b>${b.name}</b>${lvl ? ` <span class="lvl">Lv ${lvl}</span>` : ''} <span class="res-power">⚒ ${lvl ? `→ Lv ${lvl + 1}` : 'under construction'}</span><br><small title="${U.esc(b.desc)}">${this.bDesc(k)}</small></div>
            <div class="right"><small>${c.eta} Cycle${c.eta > 1 ? 's' : ''} left</small><div class="bar build-bar"><i style="width:${(c.total - c.eta) / c.total * 100}%"></i></div><small class="muted">site draws ${this.capText(DATA.construction.cap, false)}</small></div></div>`;
          return `<div class="bld ${lvl ? '' : 'new'}">${this.bIcon(k, 24)}<div class="grow"><b>${b.name}</b>${lvl ? ` <span class="lvl">Lv ${lvl}</span>` : ''}<br><small title="${U.esc(b.desc)}">${this.bDesc(k)}</small>${this.capUses(b.cap) ? ` <small>· ${this.capUses(b.cap)}</small>` : ''}</div>
            <div class="right">${U.costText(cost)}${this.levelTag(lvl + 1)}<br>${why && why !== 'Not enough resources' ? `<small class="bad">${why}</small><br>` : ''}${this.btn(lvl ? 'Upgrade' : 'Build', 'build', `${s.id}:${p.idx}:${L}:${k}`, !!why)}${lvl ? ' ' + this.demolishBtn(`${s.id}:${p.idx}:${L}:${k}`) : ''}</div></div>`;
        };
        return `<div class="layer"><h4>${DATA.layers[L]} <span class="${used >= max ? 'bad' : 'muted'}">${used}/${max} slots</span></h4>
          ${built.map(row).join('')}
          ${used < max ? `<details data-key="${s.id}:${p.idx}:${L}" ${built.length ? '' : 'open'}><summary>Construct new (${avail.length})</summary>${avail.map(row).join('')}</details>` : ''}</div>`;
      };
      return `<div class="cdetail"><div class="sys-head">
        <div><div class="muted">${Planets.label(p)} · ${this.planetMods(p)}</div>
        <div class="small muted">${Planets.factors(p)}</div>
        <div class="small">${this.habText(p)}</div>
        <div class="small">${Object.entries(Economy.planetCaps(p)).map(([k, v]) => `<span class="res-${k}">${DATA.capacities[k].icon} ${U.fmt1(v.use)}/${U.fmt1(v.give)}</span>`).join(' · ')} <span class="muted">(used/provided here)</span></div></div></div>
        <div class="layers">${layer('surface')}${layer('orbit')}</div></div>`;
  },

  // Small button that asks before tearing a building down (a = "sysId:planetIdx:layer:key").
  demolishBtn(a) {
    return `<button class="btn small danger demolish" data-act="demolish" data-a="${a}" title="Demolish: get back ${Math.round(DATA.demolishRefund * 100)} % of everything invested">✕</button>`;
  },

  // Every construction site in the empire, soonest first.
  constructionList() {
    const sites = [];
    for (const { s, p } of Colonies.playerPlanets()) for (const c of p.colony.build || []) sites.push({ s, p, c });
    const proj = [];
    for (const s of Colonies.playerSystems()) for (const c of s.projectBuild || []) proj.push({ s, c });
    const projHtml = proj.map(({ s, c }) => `<div class="kv"><span>${this.bIcon(c.key, 20)} ${U.esc(DATA.systemProjects[c.key].name)} <small class="muted">${U.esc(s.name)} · system project</small></span><span>${c.eta} Cycle${c.eta > 1 ? 's' : ''}</span></div>`).join('');
    if (!sites.length && proj.length) return projHtml + `<p class="muted small">Each site draws ${this.capText(DATA.construction.cap, false)} until it is done.</p>`;
    if (!sites.length) return `<p class="muted small">Nothing under construction. Every build or upgrade takes ${DATA.construction.cycles} Cycles, and each site draws ${this.capText(DATA.construction.cap, false)} meanwhile.</p>`;
    return projHtml + sites.sort((a, b) => a.c.eta - b.c.eta).map(({ s, p, c }) => `<div class="kv"><span>${this.bIcon(c.key, 20)} ${U.esc(DATA.buildings[c.key].name)} <small class="muted">${U.esc(Colonies.planetName(s, p))} · ${DATA.layers[c.layer].toLowerCase()}</small></span><b class="res-power">⚒ ${c.eta}</b></div>`).join('')
      + `<p class="muted small">Each site draws ${this.capText(DATA.construction.cap, false)} until it is done.</p>`;
  },

  // Overview: every building type you own, with its total level; click to see where they are.
  buildingSummary() {
    const rows = Object.keys(DATA.buildings).map((k) => ({ k, h: Colonies.holdings(k) })).filter((x) => x.h.levels);
    if (!rows.length) return '<p class="muted">No buildings yet.</p>';
    return `<div class="bsum">${rows.map(({ k, h }) => `<button class="bsum-item" data-act="bshow" data-a="${k}">${this.bIcon(k, 24)}
      <span class="bsum-txt"><b>${U.esc(DATA.buildings[k].name)}</b><span>Lv ${h.levels} · ${h.list.length} ${h.list.length === 1 ? 'colony' : 'colonies'}</span></span></button>`).join('')}</div>
      <p class="muted small">Click a building to see which colonies it is on.</p>`;
  },

  // The empire-wide building list: build anywhere from here, by hand or with Auto.
  screen_buildings() {
    const keys = Object.keys(DATA.buildings);
    const groups = [...new Set(keys.map((k) => Colonies.group(k)))];
    const where = (x) => `${U.esc(Colonies.planetName(x.s, x.p))} <span class="muted">${DATA.layers[x.layer].toLowerCase()}</span>`;
    const row = (k) => {
      const d = DATA.buildings[k], h = Colonies.holdings(k), open = this.bOpen === k;
      const best = Colonies.best(k);
      const autoBtn = best
        ? `<button class="btn gold small bauto" data-act="bauto" data-a="${k}" ${best.why ? 'disabled' : ''} title="${best.lvl ? 'Upgrade' : 'Build'} at ${U.esc(Colonies.planetName(best.s, best.p))}${best.layer === 'orbit' ? ' (orbit)' : ''}${best.why ? ': ' + U.esc(best.why) : ''}">Auto <small>${U.costText(best.cost)}</small></button>`
        : `<button class="btn small bauto" disabled title="No colony has room">Auto <small>no room</small></button>`;
      let detail = '';
      if (open) {
        const spots = Colonies.placements(k);
        detail = `<div class="bdetail">
          <h4>On ${h.list.length} ${h.list.length === 1 ? 'colony' : 'colonies'}</h4>
          ${h.list.length ? h.list.map((x) => `<div class="kv"><span>${where(x)}</span><span><b class="lvl">Lv ${x.lvl}</b> ${this.btn('Open', 'gocolony', x.ref, false, 'small')} ${Colonies.constructing(x.p, x.layer, k) ? '<small class="res-power">⚒ upgrading</small>' : this.demolishBtn(`${x.ref}:${x.layer}:${k}`)}</span></div>`).join('') : '<p class="muted small">None yet.</p>'}
          <h4>Build at</h4>
          ${spots.length ? spots.map((x, i) => `<div class="kv spot ${x === best ? 'best' : ''}"><span>${where(x)} ${x.lvl ? `<span class="muted">Lv ${x.lvl} → ${x.lvl + 1}</span>` : '<span class="muted">new slot</span>'}
              ${d.gathers || Object.values(d.cap || {}).some((v) => v < 0) ? `<span class="muted">· output ×${U.fmt1(x.value)}</span>` : ''} ${x === best ? '<span class="res-power">★ Auto pick</span>' : ''}</span>
              <span>${U.costText(x.cost)}${this.levelTag(x.lvl + 1)} ${x.why && x.why !== 'Not enough resources' ? `<small class="bad">${x.why}</small>` : ''} ${this.btn(x.lvl ? 'Upgrade' : 'Build', 'bplace', `${x.ref}:${x.layer}:${k}`, !!x.why, 'small')}</span></div>`).join('')
            : `<p class="muted small">No colony has a free ${d.layers.join(' or ')} slot${d.gathers ? ' on a planet with this resource' : ''}. Settle more planets.</p>`}
        </div>`;
      }
      return `<div class="brow ${open ? 'open' : ''}">
        <div class="bhead" data-act="bopen" data-a="${k}" title="${U.esc(d.desc)}">
          ${this.bIcon(k, 24)}
          <div class="grow"><b>${U.esc(d.name)}</b> ${h.levels ? `<span class="lvl">Lv ${h.levels}</span><small class="muted"> on ${h.list.length}</small>` : '<small class="muted">none</small>'}
            <div class="bsub"><small>${this.bDesc(k)}</small> <small class="muted">· ${d.layers.map((l) => DATA.layers[l]).join('/')}</small>${this.capUses(d.cap) ? ` <small>· ${this.capUses(d.cap)}</small>` : ''}</div></div>
          ${autoBtn}
          <span class="muted">${open ? '▾' : '▸'}</span>
        </div>
        ${detail}
      </div>`;
    };
    return `<p class="muted small">Every building in your empire. <b>Auto</b> builds where it produces the most for its cost (hover it to see where). Click a row to see where it stands or to pick the colony yourself. Costs depend on the colony's habitability and rise with level: +15 % per level up to level 5, then doubling every level (the ×-number after a price), so new colonies beat tall towers.</p>` +
      groups.map((g) => this.panel(g, keys.filter((k) => Colonies.group(k) === g).map(row).join(''))).join('');
  },

  screen_research() {
    const cur = G.researching;
    const pips = (id) => `<span class="pips">${Array.from({ length: Research.max(id) }, (_, i) => `<i class="${i < Research.level(id) ? 'on' : ''}"></i>`).join('')}</span>`;
    const curHtml = cur ? `<div class="kv"><span><b>${DATA.techs[cur].name}</b> ${Research.level(cur) + 1}/${Research.max(cur)} <small class="muted">${DATA.techs[cur].desc}</small></span><span>${U.fmt(G.researchProgress)} / ${U.fmt(Research.cost(cur))}</span></div>
      <div class="bar"><i style="width:${Math.min(100, G.researchProgress / Research.cost(cur) * 100)}%"></i></div>
      <p class="small muted">When a level is done, the next level follows on its own until it reaches ${Research.max(cur)}.</p>` : '<p class="muted">Nothing selected. Research is piling up.</p>';
    const row = (id) => {
      const t = DATA.techs[id], lvl = Research.level(id), max = Research.maxed(id);
      return `<div class="tech ${cur === id ? 'cur' : ''} ${max ? 'done' : ''}">
        <div><b>${t.name}</b> ${pips(id)} <span class="lvl">${lvl}/${Research.max(id)}</span><br>
          <small class="muted">${t.desc} per level${lvl ? ` · now <b class="good">${Research.total(id)}</b>` : ''}</small></div>
        <div class="right">${max ? '<span class="lvl">Complete</span>' : `<span class="res-research">${DATA.resources.research.icon}${U.fmt(Research.cost(id))}</span><br>${this.btn(cur === id ? 'Researching' : 'Research', 'research', id, cur === id)}`}</div></div>`;
    };
    const group = (g) => Object.keys(DATA.techs).filter((id) => DATA.techs[id].group === g).map(row).join('');
    return this.panel('Current Project', curHtml)
      + this.panel('Archives of the Covenant · Economy', `<p class="muted small">Research is made by Research Labs. Each project gives a small bonus and can be researched up to ${DATA.techMax} times; every level costs more than the last.</p>${group('economy')}`)
      + this.panel('Archives of the Covenant · War', group('military'));
  },

  screen_log() {
    return this.panel('Chronicle', G.log.map((l) => `<div class="log ${l.cls}"><i>C${l.c}</i> ${U.esc(l.t)}</div>`).join(''));
  },

  screen_settings() {
    return this.panel('Settings', `
      <div class="kv"><span>Music</span><span class="btnrow">${this.btn(Music.enabled ? 'On' : 'Off', 'music', '', false, Music.enabled ? 'on' : '')}
        <input type="range" min="0" max="100" value="${Math.round(Music.volume * 100)}" data-input="volume" aria-label="Music volume" class="slider"></span></div>
      <div class="kv"><span>Playlist</span><span class="btnrow">${[['order', 'In order'], ['shuffle', 'Shuffle'], ['repeat', 'Repeat one']].map(([m, l]) => this.btn(l, 'musicmode', m, false, Music.mode === m ? 'on' : '')).join('')}${this.btn('Next track ▸▸', 'musicskip', '', !Music.timer)}</span></div>
      <div class="tracks">${Music.tracks.map((t) => {
        const now = Music.timer && Music.trackId === t.id;
        return `<div class="track ${now ? 'now' : ''}"><div><b>${now ? '♪ ' : ''}${U.esc(t.name)}</b><br><small class="muted">${U.esc(t.mood || '')}</small></div>
          ${this.btn(now ? 'Playing' : '▶ Play', 'musicplay', t.id, now, now ? 'on' : '')}</div>`;
      }).join('')}</div>
      <div class="kv"><span>Assistant</span><span class="btnrow">${this.btn(Voice.enabled ? 'On' : 'Off', 'voice', '', false, Voice.enabled ? 'on' : '')}
        <input type="range" min="0" max="100" value="${Math.round(Voice.volume * 100)}" data-input="voicevol" aria-label="Voice volume" class="slider">${this.btn('Subtitles: ' + (Voice.subtitles ? 'On' : 'Off'), 'subtitles', '', false, Voice.subtitles ? 'on' : '')}${this.btn('Test', 'voicetest')}</span></div>
      <div class="kv"><span>Difficulty</span><span><b class="diff-name d-${G.difficulty || 'learning'}">${State.diff().name}</b> <small class="muted">${State.achievementsAllowed() ? 'achievements can be earned' : 'no achievements'} · set when the game starts</small></span></div>
      <div class="kv"><span>Sound effects</span><span class="btnrow">${this.btn(Sfx.enabled ? 'On' : 'Off', 'sfx', '', false, Sfx.enabled ? 'on' : '')}
        <input type="range" min="0" max="100" value="${Math.round(Sfx.volume * 100)}" data-input="sfxvol" aria-label="Sound effects volume" class="slider"></span></div>
      <h4>Fleet colours</h4>
      <div class="colors">${[['hull', 'Hull'], ['metal', 'Metal'], ['accent', 'Trim'], ['glass', 'Glass'], ['glow', 'Engines'], ['halo', 'Engine glow']].map(([m, l]) =>
        `<label class="colorpick"><input type="color" value="${DATA.shipPalettes.player[m]}" data-input="shipcolor" data-mat="${m}"><span>${l}</span></label>`).join('')}
        ${this.btn('Reset', 'resetcolors', '', false, 'small')}</div>
      <div id="color-preview" class="color-preview">${this.colorPreview()}</div>
      <div class="btnrow">${this.btn('Save now', 'save')}${this.btn('Export save', 'export')}${this.btn('Import save', 'import')}</div>
      <textarea id="savebox" placeholder="Exported save appears here. Paste a save here, then press Import."></textarea>
      <div class="btnrow">${this.btn(State.slot === 'tester' ? 'Regenerate the tester game' : 'Abandon and start a new galaxy', 'newgame', '', false, 'danger')}</div>
      <div class="kv"><span>Tutorial</span><span class="btnrow">${this.btn('Replay tutorial', 'tutorial')}</span></div>
      <div class="kv"><span>Tester mode</span><span class="btnrow">${State.slot === 'tester'
        ? this.btn('Back to the real game', 'slot', 'main', false, 'gold')
        : this.btn('Open tester mode', 'slot', 'tester')}</span></div>
      <p class="muted small">Tester mode has its own save (extra colonies with random buildings, ships of every rarity, plenty of resources). Your real game is not touched. You can also open it with <code>#tester</code> at the end of the address.</p>
      <p class="muted small">Voyager v${VERSION.number} (${VERSION.date}) · saves stay in this browser (localStorage).</p>`);
  },

  // "×1.45" after a cost; red once a level is past the soft cap (expanding wide is cheaper).
  levelTag(level) {
    const m = Colonies.levelMult(level);
    if (level <= 1) return '';
    const steep = level > DATA.levelCost.softCap;
    return ` <small class="${steep ? 'bad' : 'muted'}" title="Level ${level} costs ×${+m.toFixed(2)} the base price${steep ? `. Past level ${DATA.levelCost.softCap} every level doubles: a new colony is cheaper.` : ''}">×${+m.toFixed(2)}</small>`;
  },

  colorPreview() {
    return ['fighter', 'frigate', 'battleship'].map((t) => `<img class="px" src="${Sprites.shipImg(t, 'player')}" alt="">`).join('');
  },

  // ---------- difficulty ----------
  // Shown when a new real game starts. It can't be dismissed: a difficulty has to be picked.
  difficultyPicker() {
    this.pickingDifficulty = true;
    const card = ([id, d]) => `<button class="diffcard d-${id}" ${d.locked ? 'disabled' : `data-act="difficulty" data-a="${id}"`}>
        <h3>${d.name}</h3><em>${U.esc(d.tag)}</em>
        <p>${State.diffText(id, d.desc)}</p>
        <ul>${d.points.map((x) => `<li>${State.diffText(id, x)}</li>`).join('')}</ul>
        ${d.locked ? '<span class="diff-lock">Locked</span>' : ''}</button>`;
    this.modal(`<h2>Choose your difficulty</h2>
      <p class="flavor small">This can't be changed once the voyage has begun.</p>
      <div class="diffcards">${Object.entries(DATA.difficulty).map(card).join('')}</div>`);
    this.$('modal').querySelector('.modal-box').classList.add('wide');
  },

  // ---------- modal ----------
  modal(html) {
    this.modalOpen = true;
    this.$('modal').innerHTML = `<div class="modal-box">${html}</div>`;
    this.$('modal').classList.add('show');
  },
  closeModal() {
    this.modalOpen = false;
    this.$('modal').classList.remove('show');
    this.$('modal').innerHTML = '';
    Game.afterModal();
  },

  showEvent() {
    const pe = G.pendingEvents[0];
    if (!pe) return false;
    const ev = DATA.events[pe.ev];
    this.modal(`<h2>${ev.title}</h2><div class="muted small">${U.esc(G.systems[pe.sys].name)}</div>
      <img class="px event-img" src="${Sprites.star(G.systems[pe.sys].star, pe.sys)}" width="128" height="128">
      <p class="flavor">${ev.text}</p><div class="btnrow col">${ev.choices.map((c, i) => this.btn(c.label, 'eventchoice', i)).join('')}</div>`);
    return true;
  },
};
