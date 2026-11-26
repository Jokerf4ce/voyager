// Voyager — turn loop, auto-cycle (idle), input handling and boot.

const Game = {
  autoTimer: null,
  autoMs: DATA.config.autoCycleMs,

  endCycle() {
    if (G.over || UI.modalOpen) return;
    Fleets.moveAll();
    const reportsBefore = G.reports.length && G.reports[0];
    Combat.resolveAll();
    if (G.reports[0] && G.reports[0] !== reportsBefore) Music.battle(G.reports[0].lost ? 1 : 0.7);
    Economy.tick();
    Research.tick();
    AI.tick();
    Fleets.cleanup();
    if (UI.selFleet && !Fleets.get(UI.selFleet)) UI.selFleet = null;
    G.cycle++;
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
    UI.selSys = null; UI.selFleet = null; UI.lastPull = null; UI.yard = null;
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
    selfleet: (a) => { const id = +a; UI.selFleet = UI.selFleet === id ? null : id; },
    halt: (a) => { const f = Fleets.get(+a); if (f) f.path = []; },
    split: (a) => { const [id, t] = a.split(':'); Fleets.split(+id, t); },
    merge: (a) => { Fleets.mergeAt(+a); },
    colonize: (a) => { const [fid, pi] = a.split(':'); Fleets.colonize(+fid, +pi); UI.selFleet = null; },
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
    goyard: (a) => { UI.yard = a; UI.screen = 'shipyard'; },
    yard: (a) => { UI.yard = a; },
    build: (a) => { const [sid, pi, layer, k] = a.split(':'); Colonies.build(sid + ':' + pi, layer, k); },
    buildship: (a) => { Fleets.build(a, UI.yard); },
    research: (a) => { Research.select(a); Research.tick(); },
    bopen: (a) => { UI.bOpen = UI.bOpen === a ? null : a; },
    bshow: (a) => { UI.bOpen = a; UI.screen = 'buildings'; },
    bauto: (a) => { Colonies.buildAuto(a); },
    bplace: (a) => { const [sid, pi, layer, k] = a.split(':'); Colonies.build(sid + ':' + pi, layer, k); },
    mapmode: (a) => { UI.mapMode = a; UI.selPlanet = null; },
    selplanet: (a) => { UI.mapMode = 'system'; UI.selPlanet = +a; },
    mapfleet: (a) => { const f = Fleets.get(+a); UI.selFleet = f.id; UI.selSys = f.sys; UI.screen = 'map'; },
    pull: (a) => { const r = Gacha.pull(+a); if (r) UI.lastPull = r; },
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
});

document.addEventListener('keydown', (ev) => {
  if (ev.target.tagName === 'TEXTAREA') return;
  if (ev.code === 'Space' || ev.code === 'Enter') { ev.preventDefault(); if (!UI.modalOpen) Game.endCycle(); }
  if (ev.code === 'Escape') { if (UI.mapMode === 'system') UI.mapMode = 'galaxy'; else UI.selFleet = null; UI.render(); }
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
  UI.$('btn-menu').onclick = () => document.body.classList.toggle('nav-collapsed');
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
  window.addEventListener('beforeunload', () => State.save());
});
