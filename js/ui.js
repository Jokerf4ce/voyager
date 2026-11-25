// Voyager — menus and screens. Everything is re-rendered from G; buttons use data-act.

const UI = {
  screen: 'map',
  selSys: null,
  selFleet: null,
  yard: null,
  colSys: null,
  lastPull: null,
  modalOpen: false,

  screens: [
    ['overview', '☩', 'Overview'],
    ['map', '✦', 'Star Map'],
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
    this.lastScreen = this.screen;
    if (this.screen === 'map') {
      const cv = this.$('mapcanvas');
      StarMap.draw(cv);
      cv.onclick = (ev) => this.mapClick(cv, ev);
    }
    this.renderTicker();
  },

  renderTop() {
    const net = Economy.net();
    const r = (k, val, perCycle) => `<div class="res res-${k}" title="${DATA.resources[k].name}: ${DATA.resources[k].desc}">
      <span class="ico">${DATA.resources[k].icon}</span><b>${U.fmt(val)}</b>
      ${perCycle != null ? `<small class="${perCycle < 0 ? 'neg' : ''}">${perCycle >= 0 ? '+' : ''}${U.fmt1(perCycle)}</small>` : ''}</div>`;
    const inf = net.infra;
    this.$('top-res').innerHTML = ['metal', 'rare', 'polymers', 'compute', 'shards'].map((k) => r(k, G.res[k], net[k])).join('') +
      `<div class="res res-infra ${inf.used > inf.cap ? 'over' : ''}" title="Infrastructure: power, life support, meals. Used / capacity. Over capacity means rationing.">
        <span class="ico">${DATA.infra.icon}</span><b>${U.fmt(inf.used)}/${U.fmt(inf.cap)}</b>${inf.eff < 1 ? `<small class="neg">${Math.round(inf.eff * 100)}%</small>` : ''}</div>`;
    this.$('cycle').textContent = 'CYCLE ' + G.cycle;
    this.$('btn-auto').classList.toggle('on', !!Game.autoTimer);
    this.$('btn-auto').textContent = Game.autoTimer ? '❚❚ AUTO' : '▶ AUTO';
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
    const y = Economy.planetYield(p, Economy.infra().eff);
    const parts = ['metal', 'rare', 'polymers', 'compute'].filter((k) => y[k] > 0)
      .map((k) => `<span class="res-${k}">${DATA.resources[k].icon}${U.fmt1(y[k])}</span>`);
    return parts.join(' ') + (y.refMetal ? ` <small class="muted">(refinery eats ${U.fmt1(y.refMetal)}▣ ${U.fmt1(y.refRare)}◇)</small>` : '');
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
  planetMods(p) {
    return Object.entries(Planets.mult(p)).map(([k, v]) => k === 'infra' ? `${DATA.infra.icon}×${v}` : `${DATA.resources[k].icon}×${v}`).join(' ');
  },
  shipsText(ships) {
    return Object.entries(ships).filter(([, n]) => n > 0).map(([t, n]) => `${n}× ${DATA.ships[t].name}`).join(', ') || '—';
  },

  // ---------- screens ----------
  screen_overview() {
    const net = Economy.net(), inc = Economy.income(), inf = net.infra;
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
        <div class="kv"><span>Metal <small class="muted">(mined ${U.fmt1(inc.metal)}, refineries use ${U.fmt1(inc.refMetal)})</small></span><b class="res-metal">${U.fmt1(net.metal)}</b></div>
        <div class="kv"><span>Rare Minerals <small class="muted">(drilled ${U.fmt1(inc.rare)}, refineries use ${U.fmt1(inc.refRare)})</small></span><b class="res-rare">${U.fmt1(net.rare)}</b></div>
        <div class="kv"><span>Polymers</span><b class="res-polymers">+${U.fmt1(net.polymers)}</b></div>
        <div class="kv"><span>Compute</span><b class="res-compute">+${U.fmt1(net.compute)}</b></div>
        <div class="kv"><span>Void Shards</span><b class="res-shards">+${U.fmt1(net.shards)} <small>(+1 every 5 Cycles)</small></b></div>
        <h4>Infrastructure</h4>
        <div class="kv"><span>Capacity (colonies, Habitat Rings, Fusion Cores)</span><b class="res-infra">${U.fmt1(inf.cap)}</b></div>
        <div class="kv"><span>Used by buildings</span><b>${U.fmt1(inf.buildings)}</b></div>
        <div class="kv"><span>Used by ship crews</span><b>${U.fmt1(inf.ships)}</b></div>
        <div class="bar infra ${inf.used > inf.cap ? 'over' : ''}"><i style="width:${Math.min(100, inf.used / Math.max(1, inf.cap) * 100)}%"></i></div>
        ${inf.eff < 1 ? `<p class="bad small">Over capacity. Rationing has cut all production to ${Math.round(inf.eff * 100)}%.</p>` : `<p class="muted small">${U.fmt1(inf.cap - inf.used)} free. You cannot build past the cap.</p>`}
        <p class="muted small">While the game is closed, your empire keeps producing at ${DATA.config.offlineEfficiency * 100}% efficiency (1 Cycle per ${DATA.config.offlineSecondsPerCycle}s, max ${DATA.config.offlineMaxCycles}).</p>`)}
      ${this.panel('Xenos', ['chorus', 'remnant'].map(factionRow).join('') + `<p class="muted small">Destroy every alien world to win. Lose all your colonies and the Covenant ends.</p>`)}
      ${this.panel('Battle Reports', reps)}
    </div>`;
  },

  screen_map() {
    return `<div class="mapwrap">
      <div class="mapbox"><canvas id="mapcanvas" width="${StarMap.W}" height="${StarMap.H}"></canvas>
        <div class="maphint">${this.selFleet ? `<b>${U.esc((Fleets.get(this.selFleet) || {}).name || '')}</b> selected. Click a system to send it there.` : 'Click a system to inspect it. Select one of your fleets to give it orders.'}</div></div>
      <aside class="side">${this.systemPanel()}</aside>
    </div>`;
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
    let body = `<h3>${U.esc(s.name)}</h3>
      <div style="color:${owner ? owner.color : '#8a8070'}">${owner ? owner.name : 'Unclaimed'}</div>
      ${s.owner ? `<div class="muted small">Garrison ${Math.round(s.garrison)}/${Colonies.maxGarrison(s)}</div>` : ''}
      <h4>Planets</h4>`;
    body += s.planets.map((p) => {
      let act = '';
      if (!p.colony && !hostile) {
        if (ark && (!s.owner || s.owner === 'player') && p.slots.surface + p.slots.orbit > 0) act = this.btn('Settle with Ark', 'colonize', ark.id + ':' + p.idx, false, 'gold small');
        else if (s.owner === 'player') { const sc = Colonies.settleCost(p); act = this.btn(`Settle ${U.costText(sc)}`, 'settle', s.id + ':' + p.idx, !Colonies.canAfford(sc), 'small'); }
      }
      return `<div class="planet-row ${p.colony ? 'settled' : ''}">${this.planetImg(s, p, 40)}
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
    const systems = Colonies.playerSystems();
    if (!systems.length) return this.panel('No colonies', '<p>The Covenant has no worlds left.</p>');
    if (!systems.some((s) => s.id === this.colSys)) this.colSys = systems[0].id;
    const s = G.systems[this.colSys];
    const tabs = `<div class="btnrow">${systems.map((x) => this.btn(`${U.esc(x.name)} <small>${x.planets.filter((p) => p.colony).length}/${x.planets.length}</small>`, 'colsys', x.id, false, x.id === s.id ? 'on' : '')).join('')}</div>`;
    const planets = s.planets.map((p) => {
      if (!p.colony) {
        return `<div class="panel planet-panel unsettled"><div class="sys-head">${this.planetImg(s, p, 64)}
          <div><h3>${U.esc(Colonies.planetName(s, p))}</h3><div class="muted">${Planets.label(p)} · ${this.planetMods(p)} · surface ${p.slots.surface} · orbit ${p.slots.orbit}</div>
          <div class="small">${this.habText(p)}</div>
          <div class="btnrow">${this.btn(`Settle ${U.costText(Colonies.settleCost(p))}`, 'settle', s.id + ':' + p.idx, !Colonies.canAfford(Colonies.settleCost(p)) || Fleets.at(s.id).some((f) => f.owner !== 'player'))}</div></div></div></div>`;
      }
      const layer = (L) => {
        const used = Colonies.slotsUsed(p, L), max = Colonies.slots(p, L);
        if (!max) return `<div class="layer"><h4>${DATA.layers[L]} <span class="muted">no ${L}</span></h4><p class="muted small">${p.comp === 'gas' ? 'Nothing stands on a gas giant. Build in orbit.' : 'Extremely hazardous. Nothing can be built on the surface. Build in orbit.'}</p></div>`;
        const keys = Object.keys(DATA.buildings).filter((k) => DATA.buildings[k].layers.includes(L));
        const built = keys.filter((k) => p.colony[L][k] > 0), avail = keys.filter((k) => !(p.colony[L][k] > 0));
        const row = (k) => {
          const b = DATA.buildings[k], lvl = p.colony[L][k] || 0;
          const cost = Colonies.buildCost(p, L, k), why = Colonies.blocker(p, L, k);
          const inf = b.infra > 0 ? `<span class="res-infra">uses ${b.infra}${DATA.infra.icon}</span>` : b.infra < 0 ? `<span class="res-infra">gives ${-b.infra}${DATA.infra.icon}</span>` : '';
          return `<div class="bld ${lvl ? '' : 'new'}"><div><b>${b.name}</b>${lvl ? ` <span class="lvl">Lv ${lvl}</span>` : ''}<br><small class="muted">${b.desc}</small> <small>${inf}</small></div>
            <div class="right">${U.costText(cost)}<br>${why && why !== 'Not enough resources' ? `<small class="bad">${why}</small><br>` : ''}${this.btn(lvl ? 'Upgrade' : 'Build', 'build', `${s.id}:${p.idx}:${L}:${k}`, !!why)}</div></div>`;
        };
        return `<div class="layer"><h4>${DATA.layers[L]} <span class="${used >= max ? 'bad' : 'muted'}">${used}/${max} slots</span></h4>
          ${built.map(row).join('')}
          ${used < max ? `<details data-key="${s.id}:${p.idx}:${L}" ${built.length ? '' : 'open'}><summary>Construct new (${avail.length})</summary>${avail.map(row).join('')}</details>` : ''}</div>`;
      };
      return `<div class="panel planet-panel"><div class="sys-head">${this.planetImg(s, p, 64)}
        <div><h3>${U.esc(Colonies.planetName(s, p))}${s.id === G.homeId && p.idx === (G.homePlanet || 0) ? ' <span class="lvl">Capital</span>' : ''}</h3>
        <div class="muted">${Planets.label(p)} · ${this.planetMods(p)}</div>
        <div class="small muted">${Planets.factors(p)}</div>
        <div class="small">${this.habText(p)}</div>
        <div>${this.yieldText(p)}</div>
        <div class="small res-infra">Infrastructure: provides ${U.fmt1(Economy.planetInfraCap(p))}, buildings use ${U.fmt1(Economy.planetInfraUsed(p))}</div></div></div>
        <div class="layers">${layer('surface')}${layer('orbit')}</div></div>`;
    }).join('');
    return tabs + `<p class="muted small">Garrison of ${U.esc(s.name)}: ${Math.round(s.garrison)}/${Colonies.maxGarrison(s)} (Bastions and Defense Platforms from every planet add up).</p>` + planets;
  },

  screen_research() {
    const cur = G.researching;
    const curHtml = cur ? `<div class="kv"><span><b>${DATA.techs[cur].name}</b>${DATA.techs[cur].repeat ? ' ' + (Research.level(cur) + 1) : ''}</span><span>${U.fmt(G.researchProgress)} / ${U.fmt(Research.cost(cur))}</span></div>
      <div class="bar"><i style="width:${Math.min(100, G.researchProgress / Research.cost(cur) * 100)}%"></i></div>` : '<p class="muted">Nothing selected. Compute is piling up.</p>';
    const list = Object.entries(DATA.techs).map(([id, t]) => {
      const lvl = Research.level(id), avail = Research.available(id);
      return `<div class="tech ${cur === id ? 'cur' : ''} ${!avail ? 'done' : ''}">
        <div><b>${t.name}</b>${t.repeat ? ` <span class="lvl">Lv ${lvl}</span>` : lvl ? ' <span class="lvl">✓</span>' : ''}<br><small class="muted">${t.desc}</small></div>
        <div class="right"><span class="res-compute">☍${U.fmt(Research.cost(id))}</span><br>${avail ? this.btn(cur === id ? 'Researching' : 'Research', 'research', id, cur === id) : ''}</div></div>`;
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
        <div><b>${d.name}</b><br><small class="muted">${d.role} · ATK ${d.atk} · HULL ${d.hp} · crew <span class="res-infra">${d.infra}${DATA.infra.icon}</span></small>${!ok ? `<br><small class="bad">${req}</small>` : ''}</div></div>
        <div class="right">${U.costText(cost)}<br>${why === 'Not enough Infrastructure for the crew' ? '<small class="bad">Infrastructure full</small><br>' : ''}${this.btn('Build', 'buildship', t, !!why)}</div></div>`;
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
        <div><small>Metal</small><b>${pct(m.metal)}</b></div><div><small>Rare Minerals</small><b>${pct(m.rare)}</b></div>
        <div><small>Polymers</small><b>${pct(m.polymers)}</b></div><div><small>Compute</small><b>${pct(m.compute)}</b></div>
        <div><small>Infrastructure</small><b>${pct(m.infra)}</b></div><div><small>All production</small><b>${pct(m.all)}</b></div>
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
      <div class="kv"><span>Auto-cycle speed</span><span class="btnrow">${[5000, 3000, 1500, 700].map((ms) => this.btn(ms / 1000 + 's', 'autospeed', ms, false, Game.autoMs === ms ? 'on' : '')).join('')}</span></div>
      <div class="btnrow">${this.btn('Save now', 'save')}${this.btn('Export save', 'export')}${this.btn('Import save', 'import')}</div>
      <textarea id="savebox" placeholder="Exported save appears here. Paste a save here, then press Import."></textarea>
      <div class="btnrow">${this.btn('Abandon and start a new galaxy', 'newgame', '', false, 'danger')}</div>
      <p class="muted small">Voyager POC v0.1 · saves stay in this browser (localStorage).</p>`);
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
      <img class="px event-img" src="${Sprites.planet(G.systems[pe.sys].planets[0], pe.sys + '-0')}" width="128" height="128">
      <p class="flavor">${ev.text}</p><div class="btnrow col">${ev.choices.map((c, i) => this.btn(c.label, 'eventchoice', i)).join('')}</div>`);
    return true;
  },
};
