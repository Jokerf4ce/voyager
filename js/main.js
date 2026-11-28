// Voyager — turn loop, input handling and boot.

const Game = {

  endCycle() {
    if (G.over || UI.modalOpen || Tutorial.sandboxed) return;
    if (Tutorial.active) { Tutorial.nudge(); return; }
    if (UI.splash) UI.closeSplash();
    if (G.battle && G.battle.phase === 'over') Battle.close(); // a finished battle is put away (the next queued one may start)
    if (G.battle) { UI.screen = 'battle'; UI.render(); return; } // finish the battle first
    Sfx.play('cycle');
    Ships.tickMaint();
    Missions.tick();
    Economy.tick();
    Economy.record();
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
    if (G.over === 'lose' && !this.overShown) { this.overShown = true; UI.screen = 'gameover'; UI.render(); return; }
    if (G.over && !this.overShown) {
      this.overShown = true;
      const win = G.over === 'win';
      UI.modal(`<h2>${win ? 'The Shroud is Silent' : 'The Covenant Ends'}</h2>
        <p class="flavor">${win
          ? 'The xenos are dead and their worlds are yours, along with the graves. The Covenant has survived, for now. The void keeps listening.'
          : 'The last colony falls. The frozen souls in the Ark-holds will never wake. Something in the dark sings over the ruins.'}</p>
        <p class="small muted">Cycle ${G.cycle} · ${G.stats.explored} systems charted · ${G.stats.battlesWon} battles won · ${G.stats.coloniesTaken} worlds taken.</p>
        <div class="btnrow">${UI.btn('New galaxy', 'newgame-confirm', '', false, 'gold')}${UI.btn('Look around', 'close')}</div>`);
    }
  },

  newGame() {
    this.overShown = false;
    UI.selSys = null; UI.selShip = null; UI.lastShip = null; UI.lastWeapon = null; UI.closeSplash();
    if (State.slot === 'tester') Tester.newTestGame(); else State.newGame();
    UI.selSys = G.homeId;
    UI.screen = 'map';
    State.save();
    UI.render();
    if (State.slot === 'tester') return;
    this.welcome();
  },

  // A new real game opens with the tour, then asks for the difficulty when the tour ends or is skipped
  // (Tutorial.finish). The Assistant wakes you; before the first click the browser blocks sound, so the first click plays it.
  welcome() {
    Tutorial.start();
    if (this.gestured) Voice.trigger('first', true); else this.fresh = true;
  },

  // The difficulty is picked: apply it and the game begins.
  startWith(id) {
    if (!State.setDifficulty(id)) return;
    UI.pickingDifficulty = false;
    UI.modalOpen = false; UI.$('modal').classList.remove('show'); UI.$('modal').innerHTML = '';
    State.save();
    UI.render();
  },

  // While the tutorial runs the game is locked: you can look around, change audio settings and use the tutorial,
  // and on its practice steps fight the practice battle. Anything else nudges the tutorial panel instead.
  tourSafe: new Set(['screen', 'close', 'selship', 'gofleets', 'gobattle', 'gocolony', 'colsys', 'colopen', 'goyard', 'hangarsort', 'statsmetric', 'statsview', 'statsrange', 'statsscale', 'statspreset',
    'bopen', 'bshow', 'selplanet', 'mapsys', 'opensys', 'mapzoom', 'maphome', 'mapcenter', 'splashclose',
    'rules', 'officerinfo', 'tutorial', 'tutnext', 'tutback', 'tutskip', 'tutmin', 'music', 'musicplay', 'musicskip', 'musicmode', 'voice', 'voicetest', 'sfx', 'subtitles']),
  // Actions that make their own sound (or one that follows right away), so they don't also click.
  ownSound: new Set(['officer', 'buildship', 'forge', 'bfire', 'brestore', 'build', 'project', 'buildauto', 'bauto', 'bplace', 'sfx', 'voicetest', 'difficulty']),
  tourPractice: new Set(['officer', 'bfire', 'bswapnav', 'brestore', 'bswapconfirm', 'battleauto', 'bresolve', 'bretreat', 'bdefend']),
  lockedByTour(act) {
    if (!Tutorial.active || this.tourSafe.has(act)) return false;
    return !(Tutorial.sandboxed && this.tourPractice.has(act));
  },

  // Switch between the real game and tester mode (separate save slots).
  switchSlot(slot) {
    State.save();
    State.slot = slot;
    history.replaceState(null, '', slot === 'tester' ? '#tester' : location.pathname + location.search);
    if (State.load()) { this.overShown = !!G.over; UI.selSys = G.homeId; UI.screen = 'overview'; UI.render(); if (G.difficulty === null && slot === 'main') Game.welcome(); }
    else this.newGame();
  },

  actions: {
    screen: (a) => { if (UI.screen === 'battle' && a !== 'battle' && G.battle && G.battle.phase === 'over') Battle.close(); UI.screen = a; },
    slot: (a) => { Game.switchSlot(a); },
    close: () => { UI.closeModal(); },
    // fleets and ships
    selship: (a) => { UI.selShip = UI.selShip === a ? null : a; if (UI.selShip && UI.narrow()) UI.scrollToShip = true; },
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
    colonize: (a) => { const [sid, pi] = a.split(':').map(Number); Missions.colonize(sid, pi); },
    resetcolors: () => { Sprites.resetPlayerColors(); },
    gofleets: (a) => { UI.screen = 'fleets'; if (a) UI.selShip = null; },
    // battles
    gobattle: () => { UI.screen = 'battle'; },
    bfire: (a) => { Battle.act(+a); },
    bswapnav: (a) => { UI.swapNav(+a); },
    brestore: () => { Battle.restoreTurn(); },
    hangarsort: (a) => { UI.hangarSort = a; },
    statsmetric: (a) => { // toggle a metric on or off; at least one stays, at most DATA.config.statsMax
      const on = UI.statsKeys();
      UI.statsSel = on.includes(a) ? (on.length > 1 ? on.filter((k) => k !== a) : on) : [...on, a].slice(-DATA.config.statsMax);
    },
    statsscale: (a) => { UI.statsScale = a; },
    statspreset: (a) => { const p = DATA.statsPresets[+a]; if (p) { UI.statsSel = [...p[1]]; UI.statsScale = p[1].length > 1 ? 'own' : 'shared'; } },
    statsview: (a) => { UI.statsView = a; },
    statsrange: (a) => { UI.statsRange = +a; },
    scrapf: (a) => {
      const f = Ships.scrapFilter(), [k, v] = a.split(':');
      if (k === 'rarity') f.rarity = v;
      if (k === 'size') f.sizes = f.sizes.includes(v) ? f.sizes.filter((z) => z !== v) : [...f.sizes, v];
      if (k === 'quality') f.quality = +v;
      if (k === 'fleets') f.fleets = v === '1';
      if (k === 'auto') f.auto = v === '1';
    },
    autoscrap: () => {
      const list = Ships.scrapList();
      if (!list.length) return;
      const names = list.slice(0, 8).map((s) => `<span style="color:${DATA.shipRarities[s.rarity].color}">${U.esc(s.name)}</span> <small class="muted">${DATA.shipTypes[s.type].name}</small>`).join(', ');
      UI.modal(`<h2>Scrap ${list.length} ship${list.length > 1 ? 's' : ''}?</h2><p>${names}${list.length > 8 ? ` and ${list.length - 8} more` : ''}.</p>
        <p>You get back <b>${U.costText(Ships.scrapRefund(list))}</b>, and their weapons go to the armory. This can't be undone.</p>
        <div class="btnrow">${UI.btn('Scrap them', 'autoscrap-confirm', '', false, 'danger')}${UI.btn('Cancel', 'close')}</div>`);
    },
    'autoscrap-confirm': () => { UI.closeModal(); Ships.scrapMany(Ships.scrapList().map((s) => s.id)); if (UI.selShip && !G.ships[UI.selShip]) UI.selShip = null; },
    bswapconfirm: () => { if (UI.swapPick && UI.swapPick.lane != null) Battle.swapTurn(UI.swapPick.lane); UI.swapPick = null; },
    battleauto: () => { if (G.battle) G.battle.auto = !G.battle.auto; },
    bresolve: () => { Battle.resolve(); },
    bretreat: () => { Battle.retreat(); },
    bdefend: (a) => { Battle.defendWith(a ? +a : null); },
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
    demolish: (a) => {
      const [sid, pi, layer, k] = a.split(':'), { s, p } = Colonies.get(sid + ':' + pi);
      if (!p || !p.colony || !(p.colony[layer][k] > 0)) return;
      const d = DATA.buildings[k], refund = Colonies.demolishRefund(p, layer, k), fx = Colonies.demolishEffect(p, layer, k);
      const warn = fx.short.length
        ? `<p class="bad">This leaves ${fx.short.map((c) => DATA.capacities[c].name).join(' and ')} short: production drops to ${Math.round(fx.eff * 100)} %${fx.effBefore < 1 ? ` (now ${Math.round(fx.effBefore * 100)} %)` : ''}.</p>` : '';
      UI.modal(`<h2>Demolish ${U.esc(d.name)} Lv ${p.colony[layer][k]}?</h2>
        <p>On ${U.esc(Colonies.planetName(s, p))} (${DATA.layers[layer].toLowerCase()}). The slot is freed and you salvage ${Math.round(DATA.demolishRefund * 100)} % of everything invested in it:</p>
        <p><b>${U.costText(refund) || 'nothing'}</b> <span class="muted small">of ${U.costText(Colonies.invested(p, layer, k))} invested</span></p>${warn}
        <div class="btnrow">${UI.btn('Demolish', 'demolish-confirm', a, false, 'danger')}${UI.btn('Cancel', 'close')}</div>`);
    },
    'demolish-confirm': (a) => { UI.closeModal(); const [sid, pi, layer, k] = a.split(':'); Colonies.demolish(sid + ':' + pi, layer, k); },
    tutorial: () => { Tutorial.start(); },
    tutnext: () => { Tutorial.next(); },
    tutback: () => { Tutorial.back(); },
    tutskip: () => { Tutorial.finish(); },
    tutmin: () => { Tutorial.min = !Tutorial.min; },
    build: (a) => { const [sid, pi, layer, k] = a.split(':'); Colonies.build(sid + ':' + pi, layer, k); },
    buildship: (a) => { const s = Ships.build(a); if (s) { UI.lastShip = s.id; UI.lastScrapped = s.scrapped ? s : null; UI.lastWeapon = null; UI.splashShip(s); } },
    splashclose: () => { UI.closeSplash(); },
    rules: () => { UI.rulesModal(); },
    officer: () => { Battle.useOfficer(); },
    officerpick: (a) => { UI.officerPicker(+a); },
    officerset: (a) => { const [key, fid] = a.split('|'); Ships.assignOfficer(key, fid); UI.closeModal(); },
    officeroff: (a) => { Ships.unassignOfficer(a); },
    officerinfo: (a) => { UI.officerModal(a); },
    project: (a) => { const [sid, key] = a.split(':'); Colonies.buildProject(+sid, key); },
    splashhangar: () => { const id = UI.splash; UI.closeSplash(); UI.screen = 'fleets'; if (id && G.ships[id]) UI.selShip = id; },
    forge: (a) => { const w = Ships.forge(a); if (w) { UI.lastWeapon = w.id; UI.lastShip = null; Sfx.play('forge'); if (['epic', 'legendary', 'omega'].includes(w.rarity)) setTimeout(() => Sfx.play('rare', { rate: w.rarity === 'omega' ? 0.84 : 1 }), 450); } },
    research: (a) => { Research.select(a); Research.tick(); },
    bopen: (a) => { UI.bOpen = UI.bOpen === a ? null : a; },
    bshow: (a) => { UI.bOpen = a; UI.screen = 'buildings'; },
    bauto: (a) => { Colonies.buildAuto(a); },
    bplace: (a) => { const [sid, pi, layer, k] = a.split(':'); Colonies.build(sid + ':' + pi, layer, k); },
    selplanet: (a) => { UI.selPlanet = UI.selPlanet === +a ? null : +a; },
    mapsys: (a) => { UI.selSys = +a; UI.screen = 'map'; StarMap.centerOn(G.systems[+a]); },
    opensys: () => { UI.openSystem(); },
    mapzoom: (a) => { StarMap.zoomBy(+a); },
    maphome: () => { StarMap.centerOn(G.systems[G.homeId]); },
    mapcenter: () => { if (UI.selSys != null) StarMap.centerOn(G.systems[UI.selSys]); },
    eventchoice: (a) => { Explore.resolveEvent(+a); UI.closeModal(); },
    music: () => { Music.toggle(); },
    musicplay: (a) => { Music.play(a); },
    musicskip: () => { Music.skip(); },
    musicmode: (a) => { Music.setMode(a); },
    voice: () => { Voice.toggle(); },
    voicetest: () => { Voice.enabled = true; Voice.savePrefs(); Voice.failedAt = {}; Voice.trigger('test', true); },
    sfx: () => { Sfx.toggle(); if (Sfx.enabled) Sfx.play('blip'); },
    subtitles: () => { Voice.subtitles = !Voice.subtitles; Voice.savePrefs(); },
    save: () => { State.save(); Log.add('Chronicle saved.'); },
    export: () => { UI.$('savebox').value = State.exportSave(); },
    import: () => {
      try { State.importSave(UI.$('savebox').value); Game.overShown = false; State.save(); Log.add('Save imported.'); }
      catch (e) { alertLog('Import failed: ' + e.message); }
    },
    newgame: () => {
      UI.modal(State.slot === 'tester' ? `<h2>Regenerate the tester game?</h2><p>A new random test galaxy replaces this one. Your real game is not touched.</p>
        <div class="btnrow">${UI.btn('Regenerate', 'newgame-confirm', '', false, 'danger')}${UI.btn('Cancel', 'close')}</div>` : `<h2>Abandon this galaxy?</h2><p>Your current game will be lost.</p>
        <div class="btnrow">${UI.btn('Yes, start over', 'newgame-confirm', '', false, 'danger')}${UI.btn('Cancel', 'close')}</div>`);
    },
    difficulty: (a) => { Game.startWith(a); },
    'newgame-confirm': () => { UI.modalOpen = false; UI.$('modal').classList.remove('show'); Game.newGame(); },
  },
};

function alertLog(msg) { Log.add(msg, 'bad'); }

document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]');
  // a click on the dark backdrop around the new-ship splash closes it (not in its first moment, so a double click doesn't)
  if (!b && UI.splash && ev.target.closest('.splash') && !ev.target.closest('.sp-box') && Date.now() - UI.splashAt > 600) { UI.closeSplash(); return; }
  if (!b || b.disabled) return;
  const fn = Game.actions[b.dataset.act];
  if (!fn) return;
  if (Game.lockedByTour(b.dataset.act)) { Tutorial.nudge(); return; }
  if (!Game.ownSound.has(b.dataset.act)) Sfx.play('click'); // actions with their own sound skip the click
  fn(b.dataset.a);
  if (G) { State.save(); UI.render(); }
});

// Hover cards on the top bar (resources and capacities). Touch: tap to show, tap elsewhere to hide.
document.addEventListener('pointerover', (ev) => {
  if (ev.pointerType !== 'mouse') return;
  const el = ev.target.closest && ev.target.closest('#top-res [data-tip]');
  if (el) UI.showTip(el);
});
document.addEventListener('pointerout', (ev) => {
  if (ev.pointerType !== 'mouse') return;
  const el = ev.target.closest && ev.target.closest('#top-res [data-tip]');
  if (el && !(ev.relatedTarget && el.contains(ev.relatedTarget))) UI.hideTip();
});
document.addEventListener('pointerdown', (ev) => {
  if (ev.pointerType === 'mouse') return;
  const el = ev.target.closest && ev.target.closest('#top-res [data-tip]');
  if (el && UI.tipKey !== el.dataset.tip) UI.showTip(el); else UI.hideTip();
});
document.addEventListener('focusin', (ev) => { const el = ev.target.closest && ev.target.closest('#top-res [data-tip]'); if (el) UI.showTip(el); });
document.addEventListener('focusout', (ev) => { if (ev.target.closest && ev.target.closest('#top-res [data-tip]')) UI.hideTip(); });

// Sliders and other inputs use data-input instead of data-act.
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-input]');
  if (el && el.dataset.input === 'volume') Music.setVolume(el.value / 100);
  if (el && el.dataset.input === 'voicevol') Voice.setVolume(el.value / 100);
  if (el && el.dataset.input === 'sfxvol') Sfx.setVolume(el.value / 100);
  if (el && el.dataset.input === 'shipcolor') {
    Sprites.setPlayerColor(el.dataset.mat, el.value);
    const prev = document.getElementById('color-preview');
    if (prev) prev.innerHTML = UI.colorPreview();
  }
});

// Hangar: drag a ship card onto a fleet slot (its lane; the others move along) or into the hangar.
document.addEventListener('dragstart', (ev) => {
  const card = ev.target.closest && ev.target.closest('[data-dragship]');
  if (!card) return;
  if (Tutorial.active) { ev.preventDefault(); Tutorial.nudge(); return; }
  ev.dataTransfer.setData('text/plain', 'ship:' + card.dataset.dragship);
  ev.dataTransfer.effectAllowed = 'move';
  UI.dragShip = card.dataset.dragship;
  card.classList.add('dragging');
});
document.addEventListener('dragend', () => { UI.dragShip = null; document.querySelectorAll('.dragging, .dragover').forEach((x) => x.classList.remove('dragging', 'dragover')); });
document.addEventListener('dragover', (ev) => {
  if (!UI.dragShip) return;
  const el = ev.target.closest && ev.target.closest('[data-dropship]');
  if (!el) return;
  ev.preventDefault();
  document.querySelectorAll('.dragover').forEach((x) => x !== el && x.classList.remove('dragover'));
  el.classList.add('dragover');
});
document.addEventListener('drop', (ev) => {
  if (!UI.dragShip) return;
  const el = ev.target.closest && ev.target.closest('[data-dropship]');
  const id = UI.dragShip;
  UI.dragShip = null;
  if (!el || !G) return;
  ev.preventDefault();
  const d = el.dataset.dropship;
  if (d === 'hangar') { if (!Ships.place(id, null)) Log.add('The hangar is full.', 'bad'); }
  else { const [fid, pos] = d.split('|').map(Number); Ships.place(id, fid, pos); }
  UI.selShip = id;
  State.save(); UI.render();
});

// Battle: drag the acting ship onto another of your lanes to swap places.
document.addEventListener('dragstart', (ev) => {
  const card = ev.target.closest && ev.target.closest('[data-drag]');
  if (card && Tutorial.active && !Tutorial.sandboxed) { ev.preventDefault(); Tutorial.nudge(); return; }
  if (card) { ev.dataTransfer.setData('text/plain', 'swap'); ev.dataTransfer.effectAllowed = 'move'; setTimeout(() => card.classList.add('dragging'), 0); }
});
document.addEventListener('dragover', (ev) => {
  const el = ev.target.closest && ev.target.closest('[data-droplane]');
  const cur = G && G.battle && Battle.current();
  if (!el || !cur || !Battle.waiting() || !Battle.canSwapTo(cur, +el.dataset.droplane)) return;
  ev.preventDefault();
  document.querySelectorAll('.dragover').forEach((x) => x !== el && x.classList.remove('dragover'));
  el.classList.add('dragover');
  UI.previewMove(+el.dataset.droplane);
});
document.addEventListener('dragend', () => UI.previewMove(null));
document.addEventListener('dragleave', (ev) => { const el = ev.target.closest && ev.target.closest('[data-droplane]'); if (el) el.classList.remove('dragover'); });
document.addEventListener('drop', (ev) => {
  const el = ev.target.closest && ev.target.closest('[data-droplane]');
  if (!el || !G || !G.battle) return;
  ev.preventDefault();
  UI.previewMove(null);
  if (Battle.swapTurn(+el.dataset.droplane)) { UI.swapPick = null; State.save(); }
  UI.render();
});
// The map draws its names with the VT323 web font: redraw once it has arrived.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (typeof UI !== 'undefined' && G && UI.screen === 'map') { const cv = UI.$('mapcanvas'); if (cv) StarMap.draw(cv); } });
window.addEventListener('resize', () => {
  if (typeof UI === 'undefined' || !G) return;
  if (UI.screen === 'battle') { UI.sizeOfficerCard(); UI.drawBattleArrow(); }
  if (UI.screen === 'map') {
    const n = UI.narrow();
    if (n !== UI.wasNarrow) { UI.wasNarrow = n; UI.render(); } // the hint text differs on phones
    else { const cv = UI.$('mapcanvas'); if (cv) StarMap.draw(cv); }
  }
});

document.addEventListener('keydown', (ev) => {
  if (ev.target.tagName === 'TEXTAREA') return;
  if (UI.splash && ['Space', 'Enter', 'Escape'].includes(ev.code)) { ev.preventDefault(); if (Date.now() - UI.splashAt > 400) UI.closeSplash(); return; }
  if (ev.code === 'Space' || ev.code === 'Enter') { ev.preventDefault(); if (!UI.modalOpen) Game.endCycle(); }
  if (ev.code === 'Escape' && UI.modalOpen && !UI.pickingDifficulty && UI.$('modal').querySelector('.rules')) { UI.closeModal(); return; }
  if (ev.code === 'Escape') { if (UI.selShip) UI.selShip = null; else if (UI.selPlanet != null) UI.selPlanet = null; else UI.selSys = null; UI.render(); }
});

window.addEventListener('DOMContentLoaded', () => {
  UI.$('version').textContent = `v${VERSION.number}`;
  UI.$('version').title = `Voyager v${VERSION.number} · ${VERSION.date}`;
  UI.$('btn-end').onclick = () => Game.endCycle();
  // Music: browsers only allow sound after the first click or key press.
  Music.loadPrefs();
  UI.$('btn-music').onclick = (ev) => { ev.stopPropagation(); if (!Music.timer && Music.enabled) Music.start(); else Music.toggle(); UI.renderTop(); if (UI.screen === 'settings') UI.render(); };
  // Only refresh the top bar here: a full re-render would replace the element being clicked and swallow the click.
  Voice.init();
  Sfx.loadPrefs();
  // The first click or key: music starts and the Assistant greets you (a new game gets its own greeting).
  const firstGesture = () => { Game.gestured = true; Voice.activated = true; Sfx.warm(); Music.start(); if (!UI.pickingDifficulty) Voice.trigger(Game.fresh ? 'first' : 'start'); Game.fresh = false; UI.renderTop(); };
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
  if (location.hash === '#tester' || location.hash === '#admin') { // #admin: the old name
    State.slot = 'tester';
    if (location.hash === '#admin') history.replaceState(null, '', '#tester');
  }
  if (State.load()) {
    State.applyOffline(); // the empire keeps producing while the game was closed; the result is in the Chronicle, no popup
    UI.selSys = G.homeId;
    UI.render();
    if (G.over) Game.overShown = true;
    if (G.over === 'lose') { UI.screen = 'gameover'; UI.render(); }
    if (G.difficulty === null && State.slot === 'main') Game.welcome(); // closed before the game was set up: tour, then difficulty
  } else {
    Game.newGame(); // starts the tutorial
  }
  setInterval(() => State.save(), 10000);
  // Battles: enemy ships (and yours on Auto) act one at a time so you can follow along.
  setInterval(() => {
    if (G && G.battle && G.battle.phase === 'over' && G.battleQueue.length && !UI.modalOpen) {
      G.battle.overTicks = (G.battle.overTicks || 0) + 1;
      if (G.battle.overTicks >= 5) { Battle.close(); State.save(); UI.render(); } // the next battle starts on its own (about 3 s)
      return;
    }
    if (!G || !G.battle || G.battle.phase !== 'fight' || UI.screen !== 'battle' || UI.modalOpen) return;
    // a new fight on screen holds for DATA.battleStartMs before the first shot, so it doesn't land on the warning
    if (Battle.heldFor !== G.battle) { Battle.heldFor = G.battle; Battle.holdUntil = Date.now() + DATA.battleStartMs; }
    if (Date.now() < Battle.holdUntil) return;
    if (Battle.step()) { State.save(); UI.render(); }
  }, 650);
  window.addEventListener('beforeunload', () => State.save());
});

// Letting go of the effects slider plays a blip at the new volume.
document.addEventListener('change', (ev) => { const el = ev.target.closest && ev.target.closest('[data-input="sfxvol"]'); if (el) Sfx.play('blip'); });
