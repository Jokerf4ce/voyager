// Voyager — menus and screens. Everything is re-rendered from G; buttons use data-act.

const UI = {
  screen: 'map',
  selSys: null,
  selFleet: null,
  yardSys: null,
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
    this.$('main').innerHTML = fn ? fn.call(this) : '';
    if (this.screen === 'map') {
      const cv = this.$('mapcanvas');
      StarMap.draw(cv);
      cv.onclick = (ev) => this.mapClick(cv, ev);
    }
    this.renderTicker();
  },

  renderTop() {
    const inc = Economy.income();
    const r = (k, val, perCycle) => `<div class="res res-${k}" title="${DATA.resources[k].name}">
      <span class="ico">${DATA.resources[k].icon}</span><b>${U.fmt(val)}</b>
      ${perCycle != null ? `<small class="${perCycle < 0 ? 'neg' : ''}">${perCycle >= 0 ? '+' : ''}${U.fmt1(perCycle)}</small>` : ''}</div>`;
    this.$('top-res').innerHTML =
      r('ore', G.res.ore, inc.ore) + r('energy', G.res.energy, inc.energy - inc.upkeep) +
      r('research', G.res.research, inc.research) + r('shards', G.res.shards, inc.shards);
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
  shipsText(ships) {
    return Object.entries(ships).filter(([, n]) => n > 0).map(([t, n]) => `${n}× ${DATA.ships[t].name}`).join(', ') || '—';
  },

  // ---------- screens ----------
  screen_overview() {
    const inc = Economy.income();
    const cols = Colonies.playerColonies();
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
          <div><small>Colonies</small><b>${cols.length}</b></div>
          <div><small>Fleets</small><b>${myFleets.length}</b></div>
          <div><small>Fleet attack</small><b>${U.fmt(power)}</b></div>
          <div><small>Systems charted</small><b>${G.stats.explored}</b></div>
          <div><small>Battles won</small><b>${G.stats.battlesWon}</b></div>
          <div><small>Worlds taken</small><b>${G.stats.coloniesTaken}</b></div>
        </div>`)}
      ${this.panel('Per Cycle', `
        <div class="kv"><span>Ore</span><b class="res-ore">+${U.fmt1(inc.ore)}</b></div>
        <div class="kv"><span>Energy (after ${U.fmt1(inc.upkeep)} upkeep)</span><b class="res-energy">${U.fmt1(inc.energy - inc.upkeep)}</b></div>
        <div class="kv"><span>Research</span><b class="res-research">+${U.fmt1(inc.research)}</b></div>
        <div class="kv"><span>Void Shards</span><b class="res-shards">+${U.fmt1(inc.shards)} <small>(+1 every 5 Cycles)</small></b></div>
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
    const pt = DATA.planetTypes[s.type];
    const owner = s.owner ? DATA.factions[s.owner] : null;
    const bonus = Object.entries(pt.mult).map(([k, v]) => `${DATA.resources[k].icon} ×${v}`).join(' ');
    let body = `<div class="sys-head"><img class="px" src="${Sprites.planet(s.type, 32, s.id)}" width="96" height="96">
      <div><h3>${U.esc(s.name)}</h3><div class="muted">${pt.name} · ${bonus}</div>
      <div style="color:${owner ? owner.color : '#8a8070'}">${owner ? owner.name : 'Unclaimed'}</div>
      ${s.colony ? `<div class="muted small">Garrison ${Math.round(s.colony.garrison)}/${Colonies.maxGarrison(s)} · Bastion ${s.colony.buildings.bastion}</div>` : ''}</div></div>`;
    if (s.owner === 'player') {
      const y = Economy.colonyYield(s);
      body += `<div class="small">Yields ${DATA.resources.ore.icon}${U.fmt1(y.ore)} ${DATA.resources.energy.icon}${U.fmt1(y.energy)} ${DATA.resources.research.icon}${U.fmt1(y.research)}</div>
        <div class="btnrow">${this.btn('Manage colony', 'gocolony', s.id)}${s.colony.buildings.shipyard ? this.btn('Shipyard', 'goyard', s.id) : ''}</div>`;
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
        if (Fleets.has(f, 'ark') && !s.owner && !Fleets.at(s.id).some((x) => x.owner !== 'player')) actions += this.btn('Found colony', 'colonize', f.id, false, 'gold');
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
    const cols = Colonies.playerColonies();
    return cols.map((s) => {
      const y = Economy.colonyYield(s);
      const rows = Object.entries(DATA.buildings).map(([k, b]) => {
        const cost = Colonies.buildCost(s, k);
        return `<div class="bld"><div><b>${b.name}</b> <span class="lvl">Lv ${s.colony.buildings[k]}</span><br><small class="muted">${b.desc}</small></div>
          <div class="right">${U.costText(cost)}<br>${this.btn(s.colony.buildings[k] ? 'Upgrade' : 'Build', 'build', s.id + ':' + k, !Colonies.canAfford(cost))}</div></div>`;
      }).join('');
      return this.panel(U.esc(s.name), `<div class="sys-head"><img class="px" src="${Sprites.planet(s.type, 32, s.id)}" width="96" height="96">
        <div><div class="muted">${DATA.planetTypes[s.type].name}${s.id === G.homeId ? ' · Capital' : ''}</div>
        <div>Yields ${DATA.resources.ore.icon}${U.fmt1(y.ore)} ${DATA.resources.energy.icon}${U.fmt1(y.energy)} ${DATA.resources.research.icon}${U.fmt1(y.research)}</div>
        <div class="muted small">Garrison ${Math.round(s.colony.garrison)}/${Colonies.maxGarrison(s)}</div></div></div>${rows}`, 'colony');
    }).join('') || this.panel('No colonies', '<p>The Covenant has no worlds left.</p>');
  },

  screen_research() {
    const cur = G.researching;
    const curHtml = cur ? `<div class="kv"><span><b>${DATA.techs[cur].name}</b>${DATA.techs[cur].repeat ? ' ' + (Research.level(cur) + 1) : ''}</span><span>${U.fmt(G.researchProgress)} / ${U.fmt(Research.cost(cur))}</span></div>
      <div class="bar"><i style="width:${Math.min(100, G.researchProgress / Research.cost(cur) * 100)}%"></i></div>` : '<p class="muted">Nothing selected. Research is piling up.</p>';
    const list = Object.entries(DATA.techs).map(([id, t]) => {
      const lvl = Research.level(id), avail = Research.available(id);
      return `<div class="tech ${cur === id ? 'cur' : ''} ${!avail ? 'done' : ''}">
        <div><b>${t.name}</b>${t.repeat ? ` <span class="lvl">Lv ${lvl}</span>` : lvl ? ' <span class="lvl">✓</span>' : ''}<br><small class="muted">${t.desc}</small></div>
        <div class="right"><span class="res-research">☍${U.fmt(Research.cost(id))}</span><br>${avail ? this.btn(cur === id ? 'Researching' : 'Research', 'research', id, cur === id) : ''}</div></div>`;
    }).join('');
    return this.panel('Current Project', curHtml) + this.panel('Archives of the Covenant', `<p class="muted small">Doctrines can be researched forever. Each level costs more and grows your empire further.</p>${list}`);
  },

  screen_shipyard() {
    const yards = Colonies.playerColonies().filter((s) => s.colony.buildings.shipyard > 0);
    if (!yards.length) return this.panel('Shipyard', '<p>No colony has a shipyard. Build one in the Colonies screen.</p>');
    if (!yards.some((s) => s.id === this.yardSys)) this.yardSys = yards[0].id;
    const sel = `<div class="btnrow">${yards.map((s) => this.btn(U.esc(s.name), 'yard', s.id, false, s.id === this.yardSys ? 'on' : '')).join('')}</div>`;
    const list = Object.entries(DATA.ships).filter(([, d]) => !d.monster).map(([t, d]) => {
      const ok = Fleets.unlocked(t);
      const cost = Fleets.shipCost(t, this.yardSys);
      const req = d.req ? (d.req.tech ? 'Requires ' + DATA.techs[d.req.tech].name : 'Requires ' + Gacha.item(d.req.blueprint).name + ' (Void Signals)') : '';
      return `<div class="bld ${ok ? '' : 'locked'}"><div class="shiprow"><img class="px" src="${Sprites.ship(t, '#d8c8a0')}" width="44" height="36">
        <div><b>${d.name}</b><br><small class="muted">${d.role} · ATK ${d.atk} · HULL ${d.hp} · upkeep ${d.upkeep}⚡</small>${!ok ? `<br><small class="bad">${req}</small>` : ''}</div></div>
        <div class="right">${U.costText(cost)}<br>${this.btn('Build', 'buildship', t, !ok || !Colonies.canAfford(cost))}</div></div>`;
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
        <div><small>Ore</small><b>${pct(m.ore)}</b></div><div><small>Energy</small><b>${pct(m.energy)}</b></div>
        <div><small>Research</small><b>${pct(m.research)}</b></div><div><small>All production</small><b>${pct(m.all)}</b></div>
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
      <img class="px event-img" src="${Sprites.planet(G.systems[pe.sys].type, 32, pe.sys)}" width="128" height="128">
      <p class="flavor">${ev.text}</p><div class="btnrow col">${ev.choices.map((c, i) => this.btn(c.label, 'eventchoice', i)).join('')}</div>`);
    return true;
  },
};
