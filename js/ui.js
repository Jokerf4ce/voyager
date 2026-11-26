// Voyager — menus and screens. Everything is re-rendered from G; buttons use data-act.

const UI = {
  screen: 'map',
  selSys: null,
  selPlanet: null,
  hover: null,       // star-map hover card: { id, x, y }
  selFleet: null,
  yard: null,
  bOpen: null,        // building type expanded on the Buildings screen
  colSys: null,       // system to scroll to on the Colonies screen
  colOpen: {},        // colonies expanded on the Colonies screen, by ref
  lastPull: null,
  modalOpen: false,

  screens: [
    ['overview', '☩', 'Overview'],
    ['map', '✦', 'Star Map'],
    ['buildings', '▦', 'Buildings'],
    ['colonies', '⌂', 'Colonies'],
    ['research', '☍', 'Research'],
    ['shipyard', '⚒', 'Shipyard'],
    ['fleets', '➤', 'Fleets'],
    ['signals', '◆', 'Void Signals'],
    ['archive', '☗', 'Archive'],
    ['log', '☰', 'Chronicle'],
    ['settings', '⚙', 'Settings'],
  ],

  $(id) { return document.getElementById(id); },

  render() {
    if (!G) return;
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
    document.body.classList.toggle('map-screen', this.screen === 'map'); // the map screen hides the Chronicle
    if (this.screen === 'map') {
      const cv = this.$('mapcanvas');
      StarMap.draw(cv);
      cv.onclick = (ev) => this.mapClick(cv, ev);
      cv.onpointermove = (ev) => { if (ev.pointerType === 'mouse') this.mapHover(cv, ev); }; // no hover card on touch
      cv.onmouseleave = () => { this.hover = null; this.$('maphover').classList.remove('show'); };
      if (this.hover) this.showHover(); // keep the hover card through re-renders (e.g. Auto)
      const sc = this.$('syscanvas');
      if (sc) {
        SystemMap.draw(sc);
        sc.onclick = (ev) => { const p = SystemMap.hit(sc, ev); this.selPlanet = p ? p.idx : null; this.render(); };
      }
    }
    this.renderTicker();
  },

  renderTop() {
    const net = Economy.net();
    const r = (k, val, perCycle) => `<div class="res res-${k}" title="${DATA.resources[k].name}: ${DATA.resources[k].desc}">
      <span class="ico">${DATA.resources[k].icon}</span><b>${U.fmt(val)}</b>
      ${perCycle != null ? `<small class="${perCycle < 0 ? 'neg' : ''}">${perCycle >= 0 ? '+' : ''}${U.fmt1(perCycle)}</small>` : ''}</div>`;
    const c = net.caps;
    const cap = (k) => `<div class="res cap res-${k} ${c[k].used > c[k].cap ? 'over' : ''}" title="${DATA.capacities[k].name} (capacity, used / available): ${DATA.capacities[k].desc}">
        <span class="ico">${DATA.capacities[k].icon}</span><b>${U.fmt(c[k].used)}/${U.fmt(c[k].cap)}</b></div>`;
    this.$('top-res').innerHTML = ['metal', 'rare', 'organics', 'electronics', 'chemicals', 'research', 'shards'].map((k) => r(k, G.res[k], net[k])).join('') +
      '<span class="res-sep"></span>' + Object.keys(DATA.capacities).map(cap).join('') +
      (c.eff < 1 ? `<div class="res over" title="Over capacity: all production is rationed"><small class="neg">RATIONING ${Math.round(c.eff * 100)}%</small></div>` : '');
    this.$('cycle').textContent = (State.slot === 'admin' ? 'ADMIN TEST · ' : '') + 'CYCLE ' + G.cycle;
    this.$('cycle').classList.toggle('admin', State.slot === 'admin');
    this.$('btn-auto').classList.toggle('on', !!Game.autoTimer);
    this.$('btn-auto').textContent = Game.autoTimer ? '❚❚ AUTO' : '▶ AUTO';
    const playing = !!Music.timer;
    this.$('btn-music').classList.toggle('on', playing);
    this.$('btn-music').classList.toggle('off', !playing);
    this.$('btn-music').title = playing ? `Now playing: ${Music.find(Music.trackId).name} (click to mute)` : Music.enabled ? 'Music starts after your first click' : 'Music off (click to play)';
  },

  renderNav() {
    this.$('nav').innerHTML = this.screens.map(([id, ico, label]) =>
      `<button class="nav-btn ${this.screen === id ? 'active' : ''}" data-act="screen" data-a="${id}"><span>${ico}</span><em>${label}</em></button>`).join('');
  },

  renderTicker() {
    this.$('ticker').innerHTML = G.log.slice(0, 6).map((l) => `<div class="log ${l.cls}"><i>C${l.c}</i> ${U.esc(l.t)}</div>`).join('');
  },

  panel(title, body, cls = '') { return `<section class="panel ${cls}"><h2>${title}</h2>${body}</section>`; },
  btn(label, act, a = '', disabled = false, cls = '') {
    return `<button class="btn ${cls}" data-act="${act}" data-a="${a}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  },
  yieldText(p) {
    const y = Economy.planetYield(p, Economy.caps().eff);
    const parts = ['metal', 'rare', 'organics', 'electronics', 'chemicals', 'research'].filter((k) => y[k] > 0.05)
      .map((k) => `<span class="res-${k}">${DATA.resources[k].icon}${U.fmt1(y[k])}</span>`);
    const eats = Object.entries(y.inputs).filter(([, v]) => v > 0).map(([k, v]) => `${U.fmt1(v)}${DATA.resources[k].icon}`).join(' ');
    return (parts.join(' ') || '<span class="muted">no output</span>') + (eats ? ` <small class="muted">(refining eats ${eats})</small>` : '');
  },
  // Gathering ratings, e.g. "▣●●○ ◇●○○ ❦●●●"
  ratingText(p) {
    return ['metal', 'rare', 'organics'].map((k) => {
      const r = Math.min(4, Economy.rating(p, k));
      return `<span class="res-${k}" title="${DATA.resources[k].name} rating ${r}">${DATA.resources[k].icon}${'●'.repeat(r)}${'○'.repeat(Math.max(0, 3 - r))}</span>`;
    }).join(' ');
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
  shipsText(ships) {
    return Object.entries(ships).filter(([, n]) => n > 0).map(([t, n]) => `${n}× ${DATA.ships[t].name}`).join(', ') || '—';
  },

  // ---------- screens ----------
  screen_overview() {
    const net = Economy.net(), inc = Economy.income(), c = net.caps;
    const cols = Colonies.playerPlanets();
    const myFleets = G.fleets.filter((f) => f.owner === 'player');
    const power = myFleets.reduce((a, f) => a + Fleets.stats(f).atk, 0);
    const factionRow = (id) => {
      const f = DATA.factions[id], ai = G.ai[id];
      const known = G.systems.some((s) => s.owner === id && s.explored);
      const n = G.systems.filter((s) => s.owner === id).length;
      return `<div class="row"><span class="dot" style="background:${f.color}"></span><b style="color:${f.color}">${known ? f.name : 'Unknown signal'}</b>
        <span class="muted">${!ai.alive ? 'EXTINCT' : known ? `${n} known worlds` : 'not yet found'}</span></div>`;
    };
    const reps = G.reports.slice(0, 5).map((r) => `<div class="report ${r.won ? 'good' : r.lost ? 'bad' : ''}">
      <b>C${r.c} · ${U.esc(r.sys)}</b> vs ${U.esc(r.enemy)}<br><small>Lost: ${Combat.lostText(r.myLost)} · Destroyed: ${Combat.lostText(r.theirLost)}</small><br><small>${r.outcome}</small></div>`).join('') || '<p class="muted">No battles yet. That will change.</p>';
    return `<div class="grid2">
      ${this.panel('The Last Covenant', `
        <p class="flavor">The homeworld burned. The Covenant fled into the Shroud carrying ten thousand frozen souls, and now it has to find somewhere to survive.</p>
        <div class="stats">
          <div><small>Systems held</small><b>${Colonies.playerSystems().length}</b></div>
          <div><small>Planets settled</small><b>${cols.length}</b></div>
          <div><small>Fleets</small><b>${myFleets.length}</b></div>
          <div><small>Fleet attack</small><b>${U.fmt(power)}</b></div>
          <div><small>Systems charted</small><b>${G.stats.explored}</b></div>
          <div><small>Battles won</small><b>${G.stats.battlesWon}</b></div>
          <div><small>Worlds taken</small><b>${G.stats.coloniesTaken}</b></div>
        </div>`)}
      ${this.panel('Per Cycle', `
        ${['metal', 'rare', 'organics'].map((k) => `<div class="kv"><span>${DATA.resources[k].name} <small class="muted">(gathered ${U.fmt1(inc[k])}${inc.inputs[k] ? `, refining uses ${U.fmt1(inc.inputs[k])}` : ''})</small></span><b class="res-${k}">${net[k] >= 0 ? '+' : ''}${U.fmt1(net[k])}</b></div>`).join('')}
        <div class="kv"><span>Electronics <small class="muted">(refined)</small></span><b class="res-electronics">+${U.fmt1(net.electronics)}</b></div>
        <div class="kv"><span>Chemicals <small class="muted">(refined)</small></span><b class="res-chemicals">+${U.fmt1(net.chemicals)}</b></div>
        <div class="kv"><span>Research <small class="muted">(Research Labs)</small></span><b class="res-research">+${U.fmt1(net.research)}</b></div>
        <div class="kv"><span>Void Shards</span><b class="res-shards">+${U.fmt1(net.shards)} <small>(+1 every 5 Cycles)</small></b></div>
        <h4>Capacities</h4>
        ${Object.entries(DATA.capacities).map(([k, d]) => `<div class="kv"><span class="res-${k}">${d.icon} ${d.name}</span><b>${U.fmt1(c[k].used)} / ${U.fmt1(c[k].cap)}</b></div>
          <div class="small muted">buildings ${U.fmt1(c[k].buildings)}${c[k].ships ? ` · ships ${U.fmt1(c[k].ships)}` : ''}</div>
          <div class="bar cap-${k} ${c[k].used > c[k].cap ? 'over' : ''}"><i style="width:${Math.min(100, c[k].used / Math.max(1, c[k].cap) * 100)}%"></i></div>`).join('')}
        ${c.eff < 1 ? `<p class="bad small">Over capacity. Rationing has cut all production to ${Math.round(c.eff * 100)}%.</p>` : `<p class="muted small">You cannot build past a capacity.</p>`}
        <p class="muted small">While the game is closed, your empire keeps producing at ${DATA.config.offlineEfficiency * 100}% efficiency (1 Cycle per ${DATA.config.offlineSecondsPerCycle}s, max ${DATA.config.offlineMaxCycles}).</p>`)}
      ${this.panel('Buildings', this.buildingSummary())}
      ${this.panel('Xenos', ['chorus', 'remnant'].map(factionRow).join('') + `<p class="muted small">Destroy every alien world to win. Lose all your colonies and the Covenant ends.</p>`)}
      ${this.panel('Battle Reports', reps)}
    </div>`;
  },

  // Scroll down to the selected system's solar system map.
  openSystem() {
    this.selPlanet = null;
    this.render();
    const el = this.$('sysrow');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  // Star map across the full width (hover a star for a summary), the selected system's solar system below.
  screen_map() {
    const s = this.selSys != null ? G.systems[this.selSys] : null;
    const hint = this.selFleet
      ? `<b>${U.esc((Fleets.get(this.selFleet) || {}).name || '')}</b> selected. Click a system to send it there.`
      : 'Hover a system for a summary, click it to select it. Its solar system, planets and fleets appear below.';
    let below = '';
    if (s) {
      const sysMap = s.explored
        ? `<div class="sysmapbox"><h3 class="sysmap-title">◉ ${U.esc(s.name)}</h3><canvas id="syscanvas" width="${SystemMap.W}" height="${SystemMap.H}"></canvas>
            <div class="maphint">Click a planet to inspect it. Hot worlds orbit close to the star, frozen ones far out.</div></div>`
        : `<div class="sysmapbox"><h3 class="sysmap-title">? ${U.esc(s.name)}</h3><p class="flavor">Uncharted. Send a scout to see its star and planets.</p></div>`;
      below = `<div class="sysrow" id="sysrow">${sysMap}<aside class="side">${this.systemPanel()}</aside></div>`;
    }
    return `<div class="mapscreen">
      <div class="mapbox"><canvas id="mapcanvas" width="${StarMap.W}" height="${StarMap.H}"></canvas>
        <div id="maphover" class="maphover"></div>
        <div class="maphint">${hint}</div></div>
      ${below}
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
    const fleets = Fleets.at(s.id);
    const fleetLine = fleets.length ? `<div class="small">${fleets.map((f) => `<span style="color:${DATA.factions[f.owner].color}">${U.esc(f.name)} (${Fleets.size(f)})</span>`).join(' · ')}</div>` : '';
    if (!s.explored) return `<h4>? ${U.esc(s.name)}</h4><p class="muted small">Uncharted. Send a scout.</p>${fleetLine}`;
    const st = DATA.starClasses[s.star], owner = s.owner ? DATA.factions[s.owner] : null;
    return `<div class="sys-head">${this.starImg(s, 36)}<div><h4>${U.esc(s.name)}</h4><small style="color:${st.color}">${st.name}</small></div></div>
      <div class="small" style="color:${owner ? owner.color : '#8a8070'}">${owner ? owner.name : 'Unclaimed'}${s.owner ? ` <span class="muted">· garrison ${Math.round(s.garrison)}/${Colonies.maxGarrison(s)}</span>` : ''}</div>
      ${s.planets.map((p) => `<div class="hp-row">${this.planetImg(s, p, 20)}<span>${U.esc(Colonies.planetName(s, p))}</span>${p.colony ? '<span class="lvl">⌂</span>' : ''}<span class="hab-pips" style="color:${DATA.habitability[p.hab].color}">${'●'.repeat(p.hab)}${'○'.repeat(5 - p.hab)}</span></div>`).join('')}
      ${fleetLine}${s.anomaly ? '<div class="small res-shards">Strange signals here.</div>' : ''}`;
  },

  systemPanel() {
    const s = this.selSys != null ? G.systems[this.selSys] : null;
    if (!s) return this.panel('No system selected', '<p class="muted">Select a star on the map.</p>');
    if (!s.explored) {
      return this.panel('Uncharted', `<p class="flavor">The augurs see only static. Send a scout.</p>` + this.fleetListHere(s));
    }
    const owner = s.owner ? DATA.factions[s.owner] : null;
    const ark = Fleets.at(s.id, 'player').find((f) => Fleets.has(f, 'ark') && !f.path.length);
    const hostile = Fleets.at(s.id).some((x) => x.owner !== 'player');
    const st = DATA.starClasses[s.star];
    let body = `<div class="sys-head">${this.starImg(s, 64)}<div><h3>${U.esc(s.name)}</h3><b style="color:${st.color}">${st.name}</b></div></div>
      <div class="small muted">${st.desc} Starlight ×${st.solar} Power${st.habMod ? ', habitability ' + st.habMod : ''}${st.mult ? ', ' + Object.entries(st.mult).map(([k, v]) => (DATA.capacities[k] || DATA.resources[k]).name + ' ×' + v).join(', ') : ''}${st.shards ? `, +${st.shards} Void Shard${st.shards > 1 ? 's' : ''} per Cycle while held` : ''}.</div>
      <div style="color:${owner ? owner.color : '#8a8070'}">${owner ? owner.name : 'Unclaimed'}</div>
      ${s.owner ? `<div class="muted small">Garrison ${Math.round(s.garrison)}/${Colonies.maxGarrison(s)}</div>` : ''}
      <h4>Planets</h4>`;
    body += s.planets.map((p) => {
      let act = '';
      if (!p.colony && !hostile) {
        if (ark && (!s.owner || s.owner === 'player') && p.slots.surface + p.slots.orbit > 0) act = this.btn('Settle with Ark', 'colonize', ark.id + ':' + p.idx, false, 'gold small');
        else if (s.owner === 'player') { const sc = Colonies.settleCost(p); act = this.btn(`Settle ${U.costText(sc)}`, 'settle', s.id + ':' + p.idx, !Colonies.canAfford(sc), 'small'); }
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
      body += `<div class="btnrow">${this.btn('Manage colonies', 'gocolony', s.id)}${yard ? this.btn('Shipyard', 'goyard', s.id + ':' + yard.idx) : ''}</div>`;
    }
    body += this.fleetListHere(s);
    return this.panel('System', body);
  },

  fleetListHere(s) {
    const here = Fleets.at(s.id);
    if (!here.length) return '<p class="muted small">No fleets detected.</p>';
    return '<h4>Fleets</h4>' + here.map((f) => {
      const st = Fleets.stats(f), fac = DATA.factions[f.owner];
      const mine = f.owner === 'player';
      let actions = '';
      if (mine) {
        actions += this.btn(this.selFleet === f.id ? 'Selected' : 'Select', 'selfleet', f.id, false, this.selFleet === f.id ? 'on' : '');
        if (f.path.length) actions += this.btn('Halt', 'halt', f.id);
        if (Fleets.size(f) > 1) for (const t of Object.keys(f.ships)) actions += this.btn('Detach ' + DATA.ships[t].name, 'split', f.id + ':' + t, false, 'small');
      }
      return `<div class="fleet ${mine ? 'mine' : 'enemy'}" style="border-color:${fac.color}">
        <div><b style="color:${fac.color}">${U.esc(f.name)}</b> <span class="muted small">${fac.short}</span></div>
        <div class="ships">${Object.entries(f.ships).map(([t, n]) => `<span class="ship"><img class="px" src="${Sprites.ship(t, fac.color)}" width="33" height="27">${n}</span>`).join('')}</div>
        <div class="small muted">ATK ${U.fmt(st.atk)} · HULL ${U.fmt(st.hp)}${f.path.length && (mine || s.explored) ? ` · moving → ${U.esc(G.systems[f.path[f.path.length - 1]].name)} (${f.path.length})` : ''}</div>
        ${actions ? `<div class="btnrow">${actions}</div>` : ''}</div>`;
    }).join('') + (Fleets.at(s.id, 'player').filter((f) => !f.path.length && !Fleets.has(f, 'scout') && !Fleets.has(f, 'ark')).length > 1 ? this.btn('Merge battlegroups here', 'merge', s.id) : '');
  },

  mapClick(cv, ev) {
    const s = StarMap.hit(cv, ev);
    // The canvas is redrawn on every click, so double-clicks are detected by hand.
    const now = Date.now(), dbl = s && this.lastClick && this.lastClick.id === s.id && now - this.lastClick.t < 450;
    this.lastClick = s ? { id: s.id, t: now } : null;
    if (dbl && s.explored && !this.selFleet) { this.selSys = s.id; this.openSystem(); return; }
    if (!s) { this.selFleet = null; this.render(); return; }
    if (this.selFleet && s.id !== (Fleets.get(this.selFleet) || {}).sys) {
      if (Fleets.order(this.selFleet, s.id)) {
        const f = Fleets.get(this.selFleet);
        Log.add(`${f.name} ordered to ${s.name} (${f.path.length} Cycle${f.path.length > 1 ? 's' : ''}).`);
      } else Log.add('No known route to that system.', 'bad');
      this.selSys = s.id;
      this.render();
      return;
    }
    this.selSys = s.id;
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
        ${this.btn(`Settle ${U.costText(Colonies.settleCost(p))}`, 'settle', s.id + ':' + p.idx, !Colonies.canAfford(Colonies.settleCost(p)) || Fleets.at(s.id).some((f) => f.owner !== 'player'), 'small')}</div></div>`;
    const st = DATA.starClasses[s.star];
    return `<div class="panel csys" id="csys-${s.id}"><div class="star-line">${this.starImg(s, 32)}<h3>${U.esc(s.name)}</h3>
        <span class="small" style="color:${st.color}">${st.name}</span> <span class="muted small">· starlight ×${st.solar} Power · garrison ${Math.round(s.garrison)}/${Colonies.maxGarrison(s)}</span></div>
      ${s.planets.filter((p) => p.colony).map(colRow).join('')}
      ${free.length ? `<details data-key="free-${s.id}"><summary class="small">Unsettled planets here (${free.length})</summary>${free.map(freeRow).join('')}</details>` : ''}</div>`;
  },

  // The full build panel of one colony (both layers).
  colonyDetail(s, p) {
    const layer = (L) => {
        const used = Colonies.slotsUsed(p, L), max = Colonies.slots(p, L);
        if (!max) return `<div class="layer"><h4>${DATA.layers[L]} <span class="muted">no ${L}</span></h4><p class="muted small">${p.comp === 'gas' ? 'Nothing stands on a gas giant. Build in orbit.' : 'Extremely hazardous. Nothing can be built on the surface. Build in orbit.'}</p></div>`;
        const keys = Object.keys(DATA.buildings).filter((k) => DATA.buildings[k].layers.includes(L));
        const built = keys.filter((k) => p.colony[L][k] > 0), avail = keys.filter((k) => !(p.colony[L][k] > 0));
        const row = (k) => {
          const b = DATA.buildings[k], lvl = p.colony[L][k] || 0;
          const cost = Colonies.buildCost(p, L, k), why = Colonies.blocker(p, L, k);
          const inf = this.capText(b.cap);
          return `<div class="bld ${lvl ? '' : 'new'}">${this.bIcon(k, 24)}<div class="grow"><b>${b.name}</b>${lvl ? ` <span class="lvl">Lv ${lvl}</span>` : ''}<br><small class="muted">${b.desc}</small> <small>${inf}</small></div>
            <div class="right">${U.costText(cost)}<br>${why && why !== 'Not enough resources' ? `<small class="bad">${why}</small><br>` : ''}${this.btn(lvl ? 'Upgrade' : 'Build', 'build', `${s.id}:${p.idx}:${L}:${k}`, !!why)}</div></div>`;
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
          ${h.list.length ? h.list.map((x) => `<div class="kv"><span>${where(x)}</span><span><b class="lvl">Lv ${x.lvl}</b> ${this.btn('Open', 'gocolony', x.ref, false, 'small')}</span></div>`).join('') : '<p class="muted small">None yet.</p>'}
          <h4>Build at</h4>
          ${spots.length ? spots.map((x, i) => `<div class="kv spot ${x === best ? 'best' : ''}"><span>${where(x)} ${x.lvl ? `<span class="muted">Lv ${x.lvl} → ${x.lvl + 1}</span>` : '<span class="muted">new slot</span>'}
              ${d.gathers || Object.values(d.cap || {}).some((v) => v < 0) ? `<span class="muted">· output ×${U.fmt1(x.value)}</span>` : ''} ${x === best ? '<span class="res-power">★ Auto pick</span>' : ''}</span>
              <span>${U.costText(x.cost)} ${x.why && x.why !== 'Not enough resources' ? `<small class="bad">${x.why}</small>` : ''} ${this.btn(x.lvl ? 'Upgrade' : 'Build', 'bplace', `${x.ref}:${x.layer}:${k}`, !!x.why, 'small')}</span></div>`).join('')
            : `<p class="muted small">No colony has a free ${d.layers.join(' or ')} slot${d.gathers ? ' on a planet with this resource' : ''}. Settle more planets.</p>`}
        </div>`;
      }
      return `<div class="brow ${open ? 'open' : ''}">
        <div class="bhead" data-act="bopen" data-a="${k}" title="${U.esc(d.desc)}">
          ${this.bIcon(k, 24)}
          <div class="grow"><b>${U.esc(d.name)}</b> ${h.levels ? `<span class="lvl">Lv ${h.levels}</span><small class="muted"> on ${h.list.length}</small>` : '<small class="muted">none</small>'}
            <div class="bsub"><small class="muted">${U.esc(d.desc)} · ${d.layers.map((l) => DATA.layers[l]).join('/')}</small> <small>${this.capText(d.cap)}</small></div></div>
          ${autoBtn}
          <span class="muted">${open ? '▾' : '▸'}</span>
        </div>
        ${detail}
      </div>`;
    };
    return `<p class="muted small">Every building in your empire. <b>Auto</b> builds where it produces the most for its cost (hover it to see where). Click a row to see where it stands or to pick the colony yourself. Costs depend on the colony's habitability.</p>` +
      groups.map((g) => this.panel(g, keys.filter((k) => Colonies.group(k) === g).map(row).join(''))).join('');
  },

  screen_research() {
    const cur = G.researching;
    const curHtml = cur ? `<div class="kv"><span><b>${DATA.techs[cur].name}</b>${DATA.techs[cur].repeat ? ' ' + (Research.level(cur) + 1) : ''}</span><span>${U.fmt(G.researchProgress)} / ${U.fmt(Research.cost(cur))}</span></div>
      <div class="bar"><i style="width:${Math.min(100, G.researchProgress / Research.cost(cur) * 100)}%"></i></div>` : '<p class="muted">Nothing selected. Compute is piling up.</p>';
    const list = Object.entries(DATA.techs).map(([id, t]) => {
      const lvl = Research.level(id), avail = Research.available(id);
      return `<div class="tech ${cur === id ? 'cur' : ''} ${!avail ? 'done' : ''}">
        <div><b>${t.name}</b>${t.repeat ? ` <span class="lvl">Lv ${lvl}</span>` : lvl ? ' <span class="lvl">✓</span>' : ''}<br><small class="muted">${t.desc}</small></div>
        <div class="right"><span class="res-research">${DATA.resources.research.icon}${U.fmt(Research.cost(id))}</span><br>${avail ? this.btn(cur === id ? 'Researching' : 'Research', 'research', id, cur === id) : ''}</div></div>`;
    }).join('');
    return this.panel('Current Project', curHtml) + this.panel('Archives of the Covenant', `<p class="muted small">Research is paid in Compute. Doctrines can be researched forever, each level costing more and growing your empire further.</p>${list}`);
  },

  screen_shipyard() {
    const yards = Colonies.yards();
    if (!yards.length) return this.panel('Shipyard', '<p>No planet has an Orbital Shipyard. Build one in orbit on the Colonies screen.</p>');
    const refs = yards.map(({ s, p }) => Colonies.ref(s, p));
    if (!refs.includes(this.yard)) this.yard = refs[0];
    const sel = `<div class="btnrow">${yards.map(({ s, p }) => this.btn(U.esc(Colonies.planetName(s, p)) + ` <small>yard Lv ${p.colony.orbit.shipyard}</small>`, 'yard', Colonies.ref(s, p), false, Colonies.ref(s, p) === this.yard ? 'on' : '')).join('')}</div>`;
    const list = Object.entries(DATA.ships).filter(([, d]) => !d.monster).map(([t, d]) => {
      const ok = Fleets.unlocked(t);
      const cost = Fleets.shipCost(t, this.yard), why = Fleets.blocker(t, this.yard);
      const req = d.req ? (d.req.tech ? 'Requires ' + DATA.techs[d.req.tech].name : 'Requires ' + Gacha.item(d.req.blueprint).name + ' (Void Signals)') : '';
      return `<div class="bld ${ok ? '' : 'locked'}"><div class="shiprow"><img class="px" src="${Sprites.ship(t, '#d8c8a0')}" width="44" height="36">
        <div><b>${d.name}</b><br><small class="muted">${d.role} · ATK ${d.atk} · HULL ${d.hp} · needs ${this.capText(d.cap, false)}</small>${!ok ? `<br><small class="bad">${req}</small>` : ''}</div></div>
        <div class="right">${U.costText(cost)}<br>${why && why.startsWith('Not enough ') && why !== 'Not enough resources' ? `<small class="bad">${why}</small><br>` : ''}${this.btn('Build', 'buildship', t, !!why)}</div></div>`;
    }).join('');
    return this.panel('Shipyard', sel + list);
  },

  screen_fleets() {
    const mine = G.fleets.filter((f) => f.owner === 'player');
    return this.panel('Covenant Fleets', mine.map((f) => {
      const st = Fleets.stats(f);
      return `<div class="fleet mine"><div><b>${U.esc(f.name)}</b> <span class="muted small">at ${U.esc(G.systems[f.sys].name)}${f.path.length ? ` → ${U.esc(G.systems[f.path[f.path.length - 1]].name)} (${f.path.length})` : ''}</span></div>
        <div class="small">${this.shipsText(f.ships)} · ATK ${U.fmt(st.atk)} · HULL ${U.fmt(st.hp)}</div>
        <div class="btnrow">${this.btn('Show on map', 'mapfleet', f.id)}</div></div>`;
    }).join('') || '<p class="muted">No fleets.</p>');
  },

  card(item, extra = '') {
    const rar = DATA.rarities[item.rarity];
    return `<div class="card r-${item.rarity} ${item.cursed ? 'cursed' : ''}" style="border-color:${rar.color}">
      <img class="px" src="${Sprites.portrait(item.id, item.rarity, item.kind)}" width="64" height="64">
      <div class="card-kind" style="color:${rar.color}">${rar.name} ${item.kind}${item.cursed ? ' · CURSED' : ''}</div>
      <b>${U.esc(item.name)}</b><small>${U.esc(item.desc)}</small>${extra}</div>`;
  },

  screen_signals() {
    const can1 = G.res.shards >= DATA.pullCost, can10 = G.res.shards >= DATA.pullCost * 9;
    const last = this.lastPull ? `<div class="cards">${this.lastPull.map((r) => this.card(r.item,
      `<em class="tag">${r.result === 'new' ? 'NEW' : r.result === 'rankup' ? 'RANK ' + r.rank : r.result === 'dupe' ? 'DUPLICATE +5◆' : 'CLAIMED'}</em>`)).join('')}</div>` : '';
    return this.panel('Void Signals', `
      <p class="flavor">The listening arrays turn toward the deep void. Something always answers. Pay in Void Shards to tune into a signal. Not every voice is kind.</p>
      <div class="btnrow big">
        ${this.btn(`Listen ×1 <small>◆${DATA.pullCost}</small>`, 'pull', 1, !can1, 'gold')}
        ${this.btn(`Listen ×10 <small>◆${DATA.pullCost * 9} · rare+ guaranteed</small>`, 'pull', 10, !can10, 'gold')}
      </div>
      <div class="small muted">Rates: Common ${DATA.rarities.common.rate * 100}% · Rare ${DATA.rarities.rare.rate * 100}% · Mythic ${DATA.rarities.mythic.rate * 100}%. Mythic guaranteed within ${DATA.pity.mythic} pulls (pity ${G.pity}/${DATA.pity.mythic}). Duplicate leaders and relics rank up (+50% effect each).</div>
      ${last}`);
  },

  screen_archive() {
    const m = State.mods();
    const owned = DATA.gachaPool.filter((x) => G.collection[x.id]);
    const unknown = DATA.gachaPool.filter((x) => !G.collection[x.id] && x.kind !== 'cache').length;
    const pct = (v) => `${v >= 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`;
    return this.panel('Empire Modifiers', `<div class="stats">
        <div><small>Metals</small><b>${pct(m.metal)}</b></div><div><small>Rare Minerals</small><b>${pct(m.rare)}</b></div>
        <div><small>Organics</small><b>${pct(m.organics)}</b></div><div><small>Electronics</small><b>${pct(m.electronics)}</b></div>
        <div><small>Chemicals</small><b>${pct(m.chemicals)}</b></div><div><small>Research</small><b>${pct(m.research)}</b></div>
        <div><small>Power</small><b>${pct(m.power)}</b></div><div><small>Infrastructure</small><b>${pct(m.infra)}</b></div>
        <div><small>Compute</small><b>${pct(m.compute)}</b></div><div><small>All production</small><b>${pct(m.all)}</b></div>
        <div><small>Ship attack</small><b>${pct(m.atk)}</b></div><div><small>Ship hull</small><b>${pct(m.hp)}</b></div>
        <div><small>Garrisons</small><b>${pct(m.bastion)}</b></div><div><small>Shards/Cycle</small><b>+${m.shardIncome}</b></div></div>`) +
      this.panel(`Collection (${owned.length} found · ${unknown} unknown signals remain)`,
        owned.length ? `<div class="cards">${owned.map((i) => this.card(i, `<em class="tag">RANK ${G.collection[i.id].rank}</em>`)).join('')}</div>` : '<p class="muted">Nothing yet. Listen to the Void.</p>');
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
      <div class="kv"><span>Auto-cycle speed</span><span class="btnrow">${[5000, 3000, 1500, 700].map((ms) => this.btn(ms / 1000 + 's', 'autospeed', ms, false, Game.autoMs === ms ? 'on' : '')).join('')}</span></div>
      <div class="btnrow">${this.btn('Save now', 'save')}${this.btn('Export save', 'export')}${this.btn('Import save', 'import')}</div>
      <textarea id="savebox" placeholder="Exported save appears here. Paste a save here, then press Import."></textarea>
      <div class="btnrow">${this.btn(State.slot === 'admin' ? 'Regenerate the test game' : 'Abandon and start a new galaxy', 'newgame', '', false, 'danger')}</div>
      <div class="kv"><span>Admin test game</span><span class="btnrow">${State.slot === 'admin'
        ? this.btn('Back to the real game', 'slot', 'main', false, 'gold')
        : this.btn('Open admin test game', 'slot', 'admin')}</span></div>
      <p class="muted small">The test game has its own save (extra colonies with random buildings, plenty of resources). Your real game is not touched. You can also open it with <code>#admin</code> at the end of the address.</p>
      <p class="muted small">Voyager v${VERSION.number} (${VERSION.date}) · saves stay in this browser (localStorage).</p>`);
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
