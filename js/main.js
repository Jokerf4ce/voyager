// Voyager — turn loop, auto-cycle (idle), input handling and boot.

const Game = {
  autoTimer: null,
  autoMs: DATA.config.autoCycleMs,

  endCycle() {
    if (G.over || UI.modalOpen) return;
    if (G.battle) { UI.screen = 'battle'; UI.render(); return; } // finish the battle first
    Missions.tick();
    Economy.tick();
    Ships.repair();
    Research.tick();
    AI.tick();
    Battle.checkFactions();
    G.cycle++;
    if (G.battle) UI.screen = 'battle';
    State.save();
    UI.render();
    this.afterModal();
  },

  // Shows the next thing that needs attention: events, then the end screen.
  afterModal() {
    if (UI.modalOpen) return;
    if (G.pendingEvents.length) { UI.showEvent(); return; }
    if (G.over && !this.overShown) {
      this.overShown = true;
      this.stopAuto();
      const win = G.over === 'win';
      UI.modal(`<h2>${win ? 'The Shroud is Silent' : 'The Covenant Ends'}</h2>
        <p class="flavor">${win
          ? 'The xenos are dead and their worlds are yours, along with the graves. The Covenant has survived, for now. The void keeps listening.'
          : 'The last colony falls. The frozen souls in the Ark-holds will never wake. Something in the dark sings over the ruins.'}</p>
        <p class="small muted">Cycle ${G.cycle} · ${G.stats.explored} systems charted · ${G.stats.battlesWon} battles won · ${G.stats.coloniesTaken} worlds taken.</p>
        <div class="btnrow">${UI.btn('New galaxy', 'newgame-confirm', '', false, 'gold')}${UI.btn('Look around', 'close')}</div>`);
    }
  },

  toggleAuto() { this.autoTimer ? this.stopAuto() : this.startAuto(); UI.render(); },
  startAuto() {
    this.stopAuto();
    this.autoTimer = setInterval(() => { if (!UI.modalOpen && !G.over) this.endCycle(); }, this.autoMs);
  },
  stopAuto() { clearInterval(this.autoTimer); this.autoTimer = null; },

  newGame() {
    this.stopAuto();
    this.overShown = false;
    UI.selSys = null; UI.selShip = null; UI.lastShip = null; UI.lastWeapon = null;
    if (State.slot === 'admin') Admin.newTestGame(); else State.newGame();
    UI.selSys = G.homeId;
    UI.screen = 'map';
    State.save();
    UI.render();
  },

  // Switch between the real game and the admin test game (separate save slots).
  switchSlot(slot) {
    State.save();
    this.stopAuto();
    State.slot = slot;
    history.replaceState(null, '', slot === 'admin' ? '#admin' : location.pathname + location.search);
    if (State.load()) { this.overShown = !!G.over; UI.selSys = G.homeId; UI.screen = 'overview'; UI.render(); }
    else this.newGame();
  },

  actions: {
    screen: (a) => { UI.screen = a; },
    slot: (a) => { Game.switchSlot(a); },
    close: () => { UI.closeModal(); },
    // fleets and ships
    selship: (a) => { UI.selShip = UI.selShip === a ? null : a; },
    shift: (a) => { const [sid, d] = a.split('|'); Ships.shift(sid, +d); },
    assign: (a) => { const [sid, fid] = a.split('|'); Ships.assign(sid, fid === 'hangar' ? null : +fid); },
    newfleet: (a) => { const f = Ships.newFleet(); f.keep = true; if (a) Ships.assign(a, f.id); delete f.keep; Ships.cleanup(); },
    fit: (a) => { const [sid, slot, wid] = a.split('|'); Ships.fit(sid, +slot, wid); },
    scrap: (a) => {
      const sh = G.ships[a];
      if (!sh) return;
      UI.modal(`<h2>Scrap "${U.esc(sh.name)}"?</h2><p>The ship is broken up. Its weapons go to the armory and you get back ${Math.round(DATA.scrapRefund * 100)}% of a ${DATA.sizes[sh.size].name} hull's cost.</p>
        <div class="btnrow">${UI.btn('Scrap it', 'scrap-confirm', a, false, 'danger')}${UI.btn('Cancel', 'close')}</div>`);
    },
    'scrap-confirm': (a) => { UI.closeModal(); Ships.scrap(a); if (UI.selShip === a) UI.selShip = null; },
    renamefleet: (a) => { const f = Ships.fleet(+a); if (!f) return; const n = window.prompt('Fleet name', f.name); if (n) Ships.rename(f.id, n.trim()); },
    mission: (a) => { const [fid, kind, sid] = a.split('|'); Missions.launch(+fid, kind, +sid); },
    recall: (a) => { Missions.recall(+a); },
    survey: (a) => { Missions.survey(+a); },
    colonize: (a) => { Missions.colonize(+a); },
    resetcolors: () => { Sprites.resetPlayerColors(); },
    gofleets: (a) => { UI.screen = 'fleets'; if (a) UI.selShip = null; },
    // battles
    gobattle: () => { UI.screen = 'battle'; },
    bfire: (a) => { Battle.act(+a); },
    bswap: (a) => { Battle.swapTurn(+a); },
    battleauto: () => { if (G.battle) G.battle.auto = !G.battle.auto; },
    bresolve: () => { Battle.resolve(); },
    bretreat: () => { Battle.retreat(); },
    bdefend: (a) => { Battle.defendWith(a ? +a : null); },
    bclose: () => { Battle.close(); if (!G.battle) UI.screen = UI.afterBattle || 'map'; },
    settle: (a) => { const [sid, pi] = a.split(':'); Colonies.settle(+sid, +pi); },
    // a = "sysId" (open that system's colonies) or "sysId:planetIdx" (open one colony).
    gocolony: (a) => {
      const [sid, pi] = String(a).split(':').map(Number);
      const s = G.systems[sid];
      for (const p of s.planets) if (p.colony && (pi == null || isNaN(pi) || p.idx === pi)) UI.colOpen[Colonies.ref(s, p)] = true;
      UI.colSys = sid; UI.screen = 'colonies';
    },
    colsys: (a) => { UI.colSys = +a; },
    colopen: (a) => { UI.colOpen[a] = !UI.colOpen[a]; },
    goyard: () => { UI.screen = 'shipyard'; },
    build: (a) => { const [sid, pi, layer, k] = a.split(':'); Colonies.build(sid + ':' + pi, layer, k); },
    buildship: (a) => { const s = Ships.build(a); if (s) { UI.lastShip = s.id; UI.lastWeapon = null; } },
    forge: (a) => { const w = Ships.forge(a); if (w) { UI.lastWeapon = w.id; UI.lastShip = null; } },
    research: (a) => { Research.select(a); Research.tick(); },
    bopen: (a) => { UI.bOpen = UI.bOpen === a ? null : a; },
    bshow: (a) => { UI.bOpen = a; UI.screen = 'buildings'; },
    bauto: (a) => { Colonies.buildAuto(a); },
    bplace: (a) => { const [sid, pi, layer, k] = a.split(':'); Colonies.build(sid + ':' + pi, layer, k); },
    selplanet: (a) => { UI.selPlanet = UI.selPlanet === +a ? null : +a; },
    mapsys: (a) => { UI.selSys = +a; UI.screen = 'map'; },
    eventchoice: (a) => { Explore.resolveEvent(+a); UI.closeModal(); },
    music: () => { Music.toggle(); },
    musicplay: (a) => { Music.play(a); },
    musicskip: () => { Music.skip(); },
    musicmode: (a) => { Music.setMode(a); },
    voice: () => { Voice.toggle(); },
    voicetest: () => { Voice.enabled = true; Voice.savePrefs(); Voice.failedAt = {}; Voice.trigger('test', true); },
    subtitles: () => { Voice.subtitles = !Voice.subtitles; Voice.savePrefs(); },
    autospeed: (a) => { Game.autoMs = +a; if (Game.autoTimer) Game.startAuto(); },
    save: () => { State.save(); Log.add('Chronicle saved.'); },
    export: () => { UI.$('savebox').value = State.exportSave(); },
    import: () => {
      try { State.importSave(UI.$('savebox').value); Game.overShown = false; State.save(); Log.add('Save imported.'); }
      catch (e) { alertLog('Import failed: ' + e.message); }
    },
    newgame: () => {
      UI.modal(State.slot === 'admin' ? `<h2>Regenerate the test game?</h2><p>A new random test galaxy replaces this one. Your real game is not touched.</p>
        <div class="btnrow">${UI.btn('Regenerate', 'newgame-confirm', '', false, 'danger')}${UI.btn('Cancel', 'close')}</div>` : `<h2>Abandon this galaxy?</h2><p>Your current game will be lost.</p>
        <div class="btnrow">${UI.btn('Yes, start over', 'newgame-confirm', '', false, 'danger')}${UI.btn('Cancel', 'close')}</div>`);
    },
    'newgame-confirm': () => { UI.modalOpen = false; UI.$('modal').classList.remove('show'); Game.newGame(); },
  },
};

function alertLog(msg) { Log.add(msg, 'bad'); }

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const fn = Game.actions[b.dataset.act];
  if (!fn) return;
  fn(b.dataset.a);
  if (G) { State.save(); UI.render(); }
});

// Sliders and other inputs use data-input instead of data-act.
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-input]');
  if (el && el.dataset.input === 'volume') Music.setVolume(el.value / 100);
  if (el && el.dataset.input === 'voicevol') Voice.setVolume(el.value / 100);
  if (el && el.dataset.input === 'shipcolor') {
    Sprites.setPlayerColor(el.dataset.mat, el.value);
    const prev = document.getElementById('color-preview');
    if (prev) prev.innerHTML = UI.colorPreview();
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.target.tagName === 'TEXTAREA') return;
  if (ev.code === 'Space' || ev.code === 'Enter') { ev.preventDefault(); if (!UI.modalOpen) Game.endCycle(); }
  if (ev.code === 'Escape') { if (UI.selShip) UI.selShip = null; else if (UI.selPlanet != null) UI.selPlanet = null; else UI.selSys = null; UI.render(); }
});

window.addEventListener('DOMContentLoaded', () => {
  UI.$('version').textContent = `v${VERSION.number}`;
  UI.$('version').title = `Voyager v${VERSION.number} · ${VERSION.date}`;
  UI.$('btn-end').onclick = () => Game.endCycle();
  UI.$('btn-auto').onclick = () => Game.toggleAuto();
  // Music: browsers only allow sound after the first click or key press.
  Music.loadPrefs();
  UI.$('btn-music').onclick = (ev) => { ev.stopPropagation(); if (!Music.timer && Music.enabled) Music.start(); else Music.toggle(); UI.renderTop(); if (UI.screen === 'settings') UI.render(); };
  // Only refresh the top bar here: a full re-render would replace the element being clicked and swallow the click.
  Voice.init();
  const firstGesture = () => { Music.start(); Voice.trigger('start'); UI.renderTop(); };
  document.addEventListener('pointerdown', firstGesture, { once: true });
  document.addEventListener('keydown', firstGesture, { once: true });
  // Side menu: ☰ toggles it; it collapses on its own 10 s after the cursor leaves it.
  const nav = UI.$('nav');
  let navTimer = null;
  const armNav = () => { clearTimeout(navTimer); navTimer = setTimeout(() => document.body.classList.add('nav-collapsed'), 10000); };
  nav.addEventListener('mouseenter', () => clearTimeout(navTimer));
  nav.addEventListener('mouseleave', armNav);
  UI.$('btn-menu').onclick = () => { document.body.classList.toggle('nav-collapsed'); if (!nav.matches(':hover')) armNav(); };
  armNav();
  if (location.hash === '#admin') State.slot = 'admin';
  if (State.load()) {
    const off = State.applyOffline();
    UI.selSys = G.homeId;
    UI.render();
    if (off) {
      UI.modal(`<h2>While You Were Gone</h2><p class="flavor">You were away for ${off.mins} minutes. The Covenant endured without you.</p>
        ${Object.entries(off.gained).map(([k, v]) => `<div class="kv"><span>${DATA.resources[k].name}</span><b class="res-${k}">+${U.fmt(v)}</b></div>`).join('')}
        ${off.completed.length ? `<p class="small">Completed: ${off.completed.map(U.esc).join(', ')}</p>` : ''}
        <div class="btnrow">${UI.btn('Continue', 'close', '', false, 'gold')}</div>`);
    }
    if (G.over) Game.overShown = true;
  } else {
    Game.newGame();
  }
  setInterval(() => State.save(), 10000);
  // Battles: enemy ships (and yours on Auto) act one at a time so you can follow along.
  setInterval(() => {
    if (!G || !G.battle || G.battle.phase !== 'fight' || UI.screen !== 'battle' || UI.modalOpen) return;
    if (Battle.step()) { State.save(); UI.render(); }
  }, 650);
  window.addEventListener('beforeunload', () => State.save());
});
