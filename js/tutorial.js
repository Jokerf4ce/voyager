// Voyager — the first-play tutorial: a guided tour of the screens (steps in DATA.tutorial).
// A panel in the corner explains one thing at a time and outlines it on screen; the game stays usable.
// Shown once per browser on the first real game; Settings → Replay tutorial shows it again.

const Tutorial = {
  key: 'voyager_tutorial_done',
  i: -1,
  min: false, // the panel folded down to its header (click the header to toggle)
  get active() { return this.i >= 0; },

  done() { try { return localStorage.getItem(this.key) === '1'; } catch (e) { return true; } },
  maybeStart() { if (State.slot !== 'tester' && !this.done()) this.start(); },
  start() { this.i = 0; document.body.classList.add('touring'); this.go(); },
  finish() {
    this.i = -1;
    this.leaveSandbox();
    document.body.classList.remove('touring');
    try { localStorage.setItem(this.key, '1'); } catch (e) { /* private mode: it shows again next time */ }
    this.clear();
    const box = document.getElementById('tutorial');
    if (box) box.remove();
    UI.render();
    // a new game is set up once the tour ends or is skipped: now pick the difficulty
    if (G && G.difficulty === null && State.slot === 'main') UI.difficultyPicker();
  },
  // Something was clicked that the tour doesn't allow: shake the panel and say why.
  nudge() {
    const box = document.getElementById('tutorial');
    if (!box) return;
    let m = box.querySelector('.tut-lock');
    if (!m) { m = document.createElement('div'); m.className = 'tut-lock'; box.insertBefore(m, box.querySelector('.btnrow')); }
    m.textContent = 'The game is paused during the tutorial. Finish or skip it to start playing.';
    box.classList.remove('nudge'); void box.offsetWidth; box.classList.add('nudge');
    clearTimeout(this.nudgeT); this.nudgeT = setTimeout(() => { m.remove(); box.classList.remove('nudge'); }, 2600);
  },
  next() { if (this.i < DATA.tutorial.length - 1) { this.i++; this.go(); } else this.finish(); },
  back() { if (this.i > 0) { this.i--; this.go(); } },

  // ---- the practice battle ----
  // Steps marked demo: true run in a sandbox: a throwaway copy of the game with a staged raid. Nothing done there
  // is saved, ends a Cycle or touches the real game, which comes back as soon as a step without demo is shown.
  realG: null,
  get sandboxed() { return !!this.realG; },
  enterSandbox() {
    if (this.realG) return;
    this.realG = G;
    G = JSON.parse(JSON.stringify(G));
    G.battleQueue = [];
  },
  leaveSandbox() {
    if (!this.realG) return;
    G = this.realG;
    this.realG = null;
    UI.selShip = null;
  },
  // The staged raid: three small Chorus ships heading for an outlying colony (or the capital, early on).
  demoThreat() {
    const out = Colonies.playerSystems().filter((s) => s.id !== G.homeId);
    const target = (out[0] || G.systems[G.homeId]).id;
    const ships = ['fighter', 'corvette', 'fighter'].map((t) => Ships.make(t, { owner: 'chorus', kindBias: 'energy', bias: 0, name: 'Chorus ' + DATA.shipTypes[t].name }));
    return { id: 'tdemo', owner: 'chorus', name: 'Chorus Raid', target, eta: 3, total: 4, ships };
  },
  demo: {
    raid() { G.battle = null; G.threats = [Tutorial.demoThreat()]; },
    setup() {
      const t = Tutorial.demoThreat();
      G.threats = [];
      for (const f of G.fleets) if (f.mission && f.mission.kind === 'defend') f.mission = null;
      G.battle = { kind: 'defend', sys: t.target, threat: t, phase: 'setup', units: [], order: [], turn: 0, round: 0, log: [], result: null, auto: false };
    },
    fight() {
      if (G.battle && G.battle.phase === 'fight') return; // keep the fight going between steps
      Tutorial.demo.setup();
      const f = Ships.idleFleets().sort((a, b) => Ships.groupPower(Ships.fleetShips(b)) - Ships.groupPower(Ships.fleetShips(a)))[0];
      Battle.defendWith(f ? f.id : null);
    },
  },

  // Setup some steps need before their screen makes sense.
  prepare: {
    // Select an uncharted system next to known space, so the panel shows the survey option.
    uncharted() {
      const s = G.systems.find((x) => !x.explored && Explore.isSeen(x.id) && Missions.distance(x.id) != null);
      if (s) { UI.selSys = s.id; StarMap.centerOn(s); }
    },
  },

  // Open this step's screen, then draw the panel and the outline.
  go() {
    const st = DATA.tutorial[this.i];
    if (st.demo) { this.enterSandbox(); this.demo[st.demo](); } else this.leaveSandbox();
    if (st.prepare && this.prepare[st.prepare]) this.prepare[st.prepare]();
    if (st.screen) { UI.screen = st.screen; }
    if (st.nav) document.body.classList.remove('nav-collapsed');
    UI.render(); // calls refresh()
    const t = this.targets()[0];
    if (t && t.scrollIntoView) t.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  },

  targets() {
    const st = DATA.tutorial[this.i];
    if (!st || !st.target) return [];
    const all = [...document.querySelectorAll(st.target)].filter((el) => el.offsetParent || el.getClientRects().length);
    return st.all ? all : all.slice(0, 1);
  },
  clear() { document.querySelectorAll('.tut-focus').forEach((el) => el.classList.remove('tut-focus')); },

  text(st) {
    return st.text.replace('{survey}', U.costText(State.cost(DATA.survey.cost))).replace('{colonize}', U.costText(State.cost(DATA.colonize.cost, 'colonize'))).replace('{raids}', AI.raidRule()).replace('{hangar}', DATA.hangar.base).replace('{build}', DATA.construction.cycles).replace('{offlane}', DATA.offLaneHit).replace('{adv}', DATA.sizeAdvantage).replace('{disadv}', DATA.sizeDisadvantage).replace('{restore}', `${Math.round(DATA.restore.shield * 100)} % of its shields and ${Math.round(DATA.restore.hull * 100)} % of its hull`).replace('{repair}', Math.round(DATA.repairPerCycle * 100));
  },

  // Called after every UI.render (the screens are rebuilt, so the outline has to be put back).
  refresh() {
    if (!this.active) return;
    const st = DATA.tutorial[this.i], n = DATA.tutorial.length;
    this.clear();
    const ts = this.targets();
    ts.forEach((el) => el.classList.add('tut-focus'));
    let box = document.getElementById('tutorial');
    if (!box) {
      box = document.createElement('div');
      box.id = 'tutorial';
      box.setAttribute('role', 'dialog');
      document.body.appendChild(box);
    }
    const html = `<div class="tut-head" data-act="tutmin" title="${this.min ? 'Show' : 'Hide'} the text"><span class="tut-step">${this.i + 1} / ${n}</span><h2>${st.title}</h2>${st.demo ? '<span class="tut-demo">Practice · nothing here counts</span>' : ''}<span class="tut-min">${this.min ? '▴' : '▾'}</span></div>
      <p>${this.text(st)}</p>
      <div class="tut-dots">${DATA.tutorial.map((_, k) => `<i class="${k === this.i ? 'on' : k < this.i ? 'past' : ''}"></i>`).join('')}</div>
      <div class="btnrow">
        ${this.i < n - 1 ? UI.btn('Skip tutorial', 'tutskip', '', false, 'small') : ''}
        <span class="grow"></span>
        ${this.i > 0 ? UI.btn('◂ Back', 'tutback') : ''}
        ${UI.btn(this.i < n - 1 ? 'Next ▸' : 'Begin', 'tutnext', '', false, 'gold')}
      </div>`;
    // only rebuild when it changed: battles re-render several times a second, and that must not reset the scroll
    if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
    // Keep the panel clear of what it points at: bottom corner, unless the target sits low on the screen.
    const r = ts.length && ts[0].getBoundingClientRect();
    const low = r && r.top > window.innerHeight * 0.55 && r.height < window.innerHeight * 0.5;
    // placed steps keep their spot on wide screens; on phones the panel still jumps to the top when the target is low
    box.classList.toggle('top', !!low && (!st.pos || window.innerWidth <= 820));
    box.classList.toggle('center', !ts.length);
    box.classList.toggle('left', st.pos === 'left');
    box.classList.toggle('side', st.pos === 'side');
    box.classList.toggle('min', !!this.min);
  },
};
