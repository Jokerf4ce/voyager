// Voyager — the first-play tutorial: a guided tour of the screens (steps in DATA.tutorial).
// A panel in the corner explains one thing at a time and outlines it on screen; the game stays usable.
// Shown once per browser on the first real game; Settings → Replay tutorial shows it again.

const Tutorial = {
  key: 'voyager_tutorial_done',
  i: -1,
  get active() { return this.i >= 0; },

  done() { try { return localStorage.getItem(this.key) === '1'; } catch (e) { return true; } },
  maybeStart() { if (State.slot !== 'tester' && !this.done()) this.start(); },
  start() { this.i = 0; this.go(); },
  finish() {
    this.i = -1;
    try { localStorage.setItem(this.key, '1'); } catch (e) { /* private mode: it shows again next time */ }
    this.clear();
    const box = document.getElementById('tutorial');
    if (box) box.remove();
  },
  next() { if (this.i < DATA.tutorial.length - 1) { this.i++; this.go(); } else this.finish(); },
  back() { if (this.i > 0) { this.i--; this.go(); } },

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
    return st.text.replace('{survey}', U.costText(DATA.survey.cost)).replace('{colonize}', U.costText(DATA.colonize.cost)).replace('{grace}', DATA.raids.graceColonies).replace('{hangar}', DATA.hangar.base);
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
    box.innerHTML = `<div class="tut-head"><span class="tut-step">${this.i + 1} / ${n}</span><h2>${st.title}</h2></div>
      <p>${this.text(st)}</p>
      <div class="tut-dots">${DATA.tutorial.map((_, k) => `<i class="${k === this.i ? 'on' : k < this.i ? 'past' : ''}"></i>`).join('')}</div>
      <div class="btnrow">
        ${this.i < n - 1 ? UI.btn('Skip tutorial', 'tutskip', '', false, 'small') : ''}
        <span class="grow"></span>
        ${this.i > 0 ? UI.btn('◂ Back', 'tutback') : ''}
        ${UI.btn(this.i < n - 1 ? 'Next ▸' : 'Begin', 'tutnext', '', false, 'gold')}
      </div>`;
    // Keep the panel clear of what it points at: bottom corner, unless the target sits low on the screen.
    const r = ts.length && ts[0].getBoundingClientRect();
    const low = r && r.top > window.innerHeight * 0.55 && r.height < window.innerHeight * 0.5;
    box.classList.toggle('top', !!low);
    box.classList.toggle('center', !ts.length);
  },
};
