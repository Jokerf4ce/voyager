// Voyager — the Assistant: the ship's computer voice.
// Lines and triggers live in js/voicelines.js. Call Voice.trigger(name) from anywhere in the game.
//
// Each line is an mp3 file, by default assets/voice/<line id>.mp3, played exactly as recorded (the robotic
// effect is part of the file). The line is also shown on screen as a "SHIP AI" transmission. If the file
// cannot be played, only the transmission is shown.

const Voice = {
  enabled: true,
  volume: 0.8,
  ctx: null,
  speaking: false,
  lastPlayed: {},           // trigger -> time (ms)
  lastLine: {},             // trigger -> id of the line it played last
  randomTimer: null,
  activated: false,         // set on the player's first click or key press (sound is blocked before that)
  lastSpokeAt: 0,           // time (ms) the last line started
  nextRandomAt: null,       // time (ms) of the next random announcement
  lastActivity: Date.now(),
  hiddenAt: null,
  subtitles: true,          // show lines as on-screen transmissions
  folder: 'assets/voice/',
  buffers: {},              // line id -> decoded AudioBuffer
  status: {},               // line id -> 'ready' (with effects) | 'basic' (plain playback) | 'missing'
  failedAt: {},             // line id -> time of the last failed load (retried after 30 s)
  get missing() { return new Set(Object.keys(this.status).filter((id) => this.status[id] === 'missing')); },
  prefsKey: 'voyager_voice',

  // ---- preferences ----
  loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(this.prefsKey) || '{}');
      if (typeof p.enabled === 'boolean') this.enabled = p.enabled;
      if (typeof p.volume === 'number') this.volume = p.volume;
      if (typeof p.subtitles === 'boolean') this.subtitles = p.subtitles;
    } catch (e) { /* storage unavailable */ }
  },
  savePrefs() {
    try { localStorage.setItem(this.prefsKey, JSON.stringify({ enabled: this.enabled, volume: this.volume, subtitles: this.subtitles })); } catch (e) { /* ignore */ }
  },

  init() {
    this.loadPrefs();
    // Activity tracking for the "return" trigger.
    const idleLimit = () => (VoiceTriggers.return.idleMinutes || 5) * 60000;
    const activity = () => {
      const now = Date.now();
      this.activated = true;
      if (now - this.lastActivity > idleLimit()) this.trigger('return');
      this.lastActivity = now;
    };
    for (const ev of ['pointerdown', 'keydown', 'wheel']) document.addEventListener(ev, activity, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { this.hiddenAt = Date.now(); return; }
      const away = Math.max(this.hiddenAt ? Date.now() - this.hiddenAt : 0, Date.now() - this.lastActivity);
      this.hiddenAt = null;
      if (away > idleLimit()) this.trigger('return');
      this.lastActivity = Date.now();
    });
    this.scheduleRandom();
  },

  // ---- random announcements ----
  // Every 5–30 minutes (VoiceTriggers.random) a random line with the 'random' trigger plays. It waits while the tab
  // is hidden, the Assistant is talking, or before the player's first click (browsers block sound until then).
  scheduleRandom(delayMs) {
    clearTimeout(this.randomTimer);
    const cfg = VoiceTriggers.random;
    if (!cfg) return;
    if (delayMs == null) {
      const lo = (cfg.minMinutes ?? 5) * 60000, hi = (cfg.maxMinutes ?? 30) * 60000;
      delayMs = lo + Math.random() * (hi - lo);
    }
    this.nextRandomAt = Date.now() + delayMs;
    this.randomTimer = setTimeout(() => this.randomTick(), delayMs);
  },

  randomTick() {
    // not yet: before the first click, while hidden, or within a minute of another line
    if (!this.activated || document.hidden || Date.now() - this.lastSpokeAt < 60000) { this.scheduleRandom(20000); return; }
    if (this.speaking) { this.scheduleRandom(5000); return; }
    this.trigger('random');
    this.scheduleRandom();
  },

  // Share the music's audio context when it exists: one context is more reliable than two.
  audio() {
    if (typeof Music !== 'undefined' && Music.ctx && Music.timer && typeof Music.ctx.resume === 'function' && !(window.OfflineAudioContext && Music.ctx instanceof OfflineAudioContext)) {
      if (this.ctx !== Music.ctx) { this.ctx = Music.ctx; this.buffers = {}; }
      return this.ctx;
    }
    if (this.ctx && !(window.OfflineAudioContext && this.ctx instanceof OfflineAudioContext)) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { this.ctx = Music.newContext(AC); } catch (e) { return null; } // large buffers, like the music
    return this.ctx;
  },

  // ---- triggers ----
  trigger(name, force = false) {
    if (!this.enabled || (this.speaking && !force)) return false;
    const cfg = VoiceTriggers[name] || {};
    if (cfg.chance != null && Math.random() >= cfg.chance) return false; // some triggers only speak now and then
    const now = Date.now();
    if (!force && cfg.cooldown && this.lastPlayed[name] && now - this.lastPlayed[name] < cfg.cooldown * 1000) return false;
    // 'test' (the Test button) can play any line; other triggers play the lines that list them
    let lines = Object.entries(VoiceLines).filter(([, l]) => (name === 'test' || (l.triggers || []).includes(name)) && Math.random() < (l.chance ?? 1));
    if (!lines.length) return false;
    // triggers with noRepeat never play the same line twice in a row (when there is another one)
    if (cfg.noRepeat && lines.length > 1) lines = lines.filter(([lid]) => lid !== this.lastLine[name]);
    const [id] = lines[Math.floor(Math.random() * lines.length)];
    this.lastPlayed[name] = now;
    this.lastLine[name] = id;
    // the look of the transmission: the line's own style, else the trigger's
    // (the Test button borrows the style of the line's first trigger that has one)
    const line = VoiceLines[id];
    const styleOf = (t) => (VoiceTriggers[t] || {}).style;
    const style = line.style || styleOf(name) || (name === 'test' ? (line.triggers || []).map(styleOf).find(Boolean) : '') || '';
    return this.say(id, style);
  },

  say(id, style = '') {
    const line = VoiceLines[id];
    if (!line || !this.enabled) return false;
    this.style = style || line.style || '';
    const ctx = this.audio();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    this.speaking = true;
    this.lastSpokeAt = Date.now();
    this.duck(true);
    const done = () => {
      this.speaking = false; this.duck(false);
      if (typeof UI !== 'undefined' && UI.screen === 'settings') UI.render(); // refresh the file status list
    };
    this.playFile(id, line, done);
    return true;
  },

  // Lower the music while she speaks.
  duck(on) {
    if (typeof Music === 'undefined' || !Music.ctx || !Music.timer) return;
    const g = Music.out.gain, t = Music.ctx.currentTime, target = Music.gainFor(Music.volume) * (on ? 0.35 : 1);
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(target, t + (on ? 0.25 : 1.2));
  },

  src(id, line) { return line.src || this.folder + id + '.mp3'; },

  // Load and decode a line for Web Audio playback. Fails on missing files, and when the page is opened
  // straight from disk (file://), where browsers block fetch().
  async load(id, line) {
    if (this.buffers[id]) return this.buffers[id];
    if (this.failedAt[id] && Date.now() - this.failedAt[id] < 30000) throw new Error('failed recently');
    const res = await fetch(this.src(id, line));
    if (!res.ok) throw new Error('missing');
    return (this.buffers[id] = await this.ctx.decodeAudioData(await res.arrayBuffer()));
  },

  // Plain playback with an <audio> element: works almost everywhere, also when opened from disk.
  playBasic(id, line, glitch, done) {
    let a;
    try { a = new Audio(this.src(id, line)); } catch (e) { a = null; }
    if (!a) { this.noFile(id, line, glitch, done); return; }
    a.volume = Math.min(1, this.volume);
    let ended = false;
    const end = () => { if (!ended) { ended = true; done(); } };
    a.onended = end;
    a.onerror = () => { if (!ended) { ended = true; this.noFile(id, line, glitch, done); } };
    a.play().then(() => {
      this.status[id] = 'basic';
      if (this.subtitles && line.text) this.subtitle(line.text, (a.duration || 2) + 2, glitch);
      setTimeout(end, ((a.duration || 3) + 1) * 1000);
    }).catch(() => { if (!ended) { ended = true; this.noFile(id, line, glitch, done); } });
  },

  // No playable file: show the transmission only.
  noFile(id, line, glitch, done) {
    this.status[id] = 'missing';
    this.failedAt[id] = Date.now();
    if (line.text) this.subtitle(line.text, line.text.length * 0.075 + 3, glitch);
    setTimeout(done, 1200);
    if (typeof UI !== 'undefined' && UI.screen === 'settings') UI.render();
  },

  // ---- playing a line, exactly as recorded ----
  async playFile(id, line, done) {
    const ctx = this.audio();
    const glitch = line.glitch ?? 0.35;
    let buf = null;
    try { if (ctx) buf = await this.load(id, line); } catch (e) { /* fall back to plain playback */ }
    if (!buf) { this.playBasic(id, line, glitch, done); return; }
    this.status[id] = 'ready';
    delete this.failedAt[id];
    if (ctx.state === 'suspended') ctx.resume();
    if (this.subtitles && line.text) this.subtitle(line.text, buf.duration + 2, glitch);
    const g = ctx.createGain(); g.gain.value = this.volume;
    g.connect(ctx.destination);
    const src = ctx.createBufferSource(); src.buffer = buf;
    src.connect(g);
    let finished = false;
    const finish = () => { if (!finished) { finished = true; done(); } };
    src.onended = finish;
    src.start(ctx.currentTime + 0.05);
    setTimeout(finish, (buf.duration + 1.5) * 1000); // in case onended never fires
  },

  // On-screen transmission: the line types out with glitching characters, then fades.
  subtitle(text, seconds, glitch) {
    let box = document.getElementById('comms');
    if (!box) { box = document.createElement('div'); box.id = 'comms'; document.body.appendChild(box); }
    clearInterval(this.subTimer); clearTimeout(this.subHide);
    box.innerHTML = '<span class="comms-src">◆ AI Assistant</span><span class="comms-text"></span>';
    box.className = 'show' + (this.style ? ' ' + this.style : '');
    box.querySelector('.comms-src').textContent = this.style === 'danger' ? '▲ AI Assistant · Alert' : '◆ AI Assistant';
    const el = box.querySelector('.comms-text');
    const junk = '█▓▒░#%&@$<>/\\|';
    let i = 0;
    this.subTimer = setInterval(() => {
      i = Math.min(text.length, i + 1);
      let shown = text.slice(0, i);
      if (i < text.length && Math.random() < 0.6) shown += junk[Math.floor(Math.random() * junk.length)];
      // now and then corrupt a letter that is already shown
      if (Math.random() < glitch * 0.25 && shown.length > 2) {
        const k = Math.floor(Math.random() * (shown.length - 1));
        shown = shown.slice(0, k) + junk[Math.floor(Math.random() * junk.length)] + shown.slice(k + 1);
        box.classList.add('jolt'); setTimeout(() => box.classList.remove('jolt'), 90);
      }
      el.textContent = shown;
      if (i >= text.length) { clearInterval(this.subTimer); el.textContent = text; }
    }, 45);
    this.subHide = setTimeout(() => { box.className = ''; }, seconds * 1000);
  },

  toggle() { this.enabled = !this.enabled; this.savePrefs(); },
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); this.savePrefs(); },
};
