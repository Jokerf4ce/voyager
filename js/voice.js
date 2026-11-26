// Voyager — the ship's computer voice: a lightly distorted, glitching British female voice.
// Lines and triggers live in js/voicelines.js. Call Voice.trigger(name) from anywhere in the game.
//
// Each line is an mp3 file, by default assets/voice/<line id>.mp3. It is played through Web Audio with
// radio filtering, soft distortion and random stutters/dropouts, over a bed of static and digital glitches,
// and shown on screen as a "SHIP AI" transmission. If the file is missing, only the transmission is shown.

const Voice = {
  enabled: true,
  volume: 0.8,
  ctx: null,
  speaking: false,
  lastPlayed: {},           // trigger -> time (ms)
  lastActivity: Date.now(),
  hiddenAt: null,
  subtitles: true,          // show lines as on-screen transmissions
  folder: 'assets/voice/',
  buffers: {},              // line id -> decoded AudioBuffer
  missing: new Set(),       // line ids whose file could not be loaded
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
  },

  audio() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { this.ctx = new AC(); } catch (e) { return null; }
    return this.ctx;
  },

  // ---- triggers ----
  trigger(name) {
    if (!this.enabled || this.speaking) return false;
    const cfg = VoiceTriggers[name] || {};
    const now = Date.now();
    if (cfg.cooldown && this.lastPlayed[name] && now - this.lastPlayed[name] < cfg.cooldown * 1000) return false;
    const lines = Object.entries(VoiceLines).filter(([, l]) => (l.triggers || []).includes(name) && Math.random() < (l.chance ?? 1));
    if (!lines.length) return false;
    const [id] = lines[Math.floor(Math.random() * lines.length)];
    this.lastPlayed[name] = now;
    return this.say(id);
  },

  say(id) {
    const line = VoiceLines[id];
    if (!line || !this.enabled) return false;
    const ctx = this.audio();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    this.speaking = true;
    this.duck(true);
    const done = () => { this.speaking = false; this.duck(false); };
    this.playFile(id, line, done);
    return true;
  },

  // Lower the music while she speaks.
  duck(on) {
    if (typeof Music === 'undefined' || !Music.ctx || !Music.timer) return;
    const g = Music.out.gain, t = Music.ctx.currentTime, target = Music.gainFor(Music.volume) * (on ? 0.35 : 1);
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(target, t + (on ? 0.25 : 1.2));
  },

  // Static, clicks and digital squelches under the voice, so it sounds like a damaged ship's computer.
  glitchBed(seconds, glitch) {
    const ctx = this.audio();
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.05;
    const out = ctx.createGain(); out.gain.value = this.volume * 0.5; out.connect(ctx.destination);
    // a short burst of static at the start and end, like a comm channel opening and closing
    for (const [at, len, v] of [[0, 0.18, 0.5], [seconds, 0.22, 0.4]]) this.noise(t0 + at, len, v, 2500, out);
    // a faint hum bed
    const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 50;
    const hl = ctx.createBiquadFilter(); hl.type = 'lowpass'; hl.frequency.value = 180;
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0, t0); hg.gain.linearRampToValueAtTime(0.05, t0 + 0.1);
    hg.gain.setValueAtTime(0.05, t0 + seconds); hg.gain.linearRampToValueAtTime(0, t0 + seconds + 0.3);
    hum.connect(hl); hl.connect(hg); hg.connect(out); hum.start(t0); hum.stop(t0 + seconds + 0.4);
    // random glitches while she speaks
    const n = Math.round(seconds * (2 + glitch * 8));
    for (let i = 0; i < n; i++) {
      const at = t0 + 0.15 + Math.random() * seconds;
      const r = Math.random();
      if (r < 0.45) this.noise(at, 0.02 + Math.random() * 0.06, 0.25 + Math.random() * 0.3, 1500 + Math.random() * 5000, out);
      else if (r < 0.8) this.click(at, 0.3 + Math.random() * 0.4, out);
      else this.squelch(at, 0.05 + Math.random() * 0.1, out);
    }
  },

  noise(t, len, vel, freq, out) {
    const ctx = this.ctx, n = Math.max(1, Math.floor(ctx.sampleRate * len));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.4); // crackly
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.linearRampToValueAtTime(0, t + len);
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t);
  },

  click(t, vel, out) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 1200 + Math.random() * 2400;
    g.gain.setValueAtTime(vel * 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.02);
  },

  // A falling digital chirp, like data corruption.
  squelch(t, len, out) {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(2200 + Math.random() * 1500, t);
    o.frequency.exponentialRampToValueAtTime(180, t + len);
    g.gain.setValueAtTime(0.06, t); g.gain.linearRampToValueAtTime(0, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.01);
  },

  src(id, line) { return line.src || this.folder + id + '.mp3'; },

  async load(id, line) {
    if (this.buffers[id]) return this.buffers[id];
    const res = await fetch(this.src(id, line));
    if (!res.ok) throw new Error('missing');
    return (this.buffers[id] = await this.ctx.decodeAudioData(await res.arrayBuffer()));
  },

  // ---- playing a line: real distortion and stutter ----
  async playFile(id, line, done) {
    const ctx = this.audio();
    const glitch = line.glitch ?? 0.35;
    let buf = null;
    try { if (ctx) buf = await this.load(id, line); this.missing.delete(id); } catch (e) { this.missing.add(id); }
    const seconds = buf ? buf.duration : line.text.length * 0.075 + 1;
    if (this.subtitles || !buf) this.subtitle(line.text, seconds + 2, glitch);
    if (!buf) {
      // no file yet: just open and close the comm channel
      if (ctx) this.glitchBed(0.6, glitch * 0.5);
      setTimeout(done, 1200);
      return;
    }
    // radio tone: band-limit, then soft-clip
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 280;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024), k = 4 + glitch * 20;
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    shaper.curve = curve;
    const g = ctx.createGain(); g.gain.value = this.volume * 0.8;
    hp.connect(lp); lp.connect(shaper); shaper.connect(g); g.connect(ctx.destination);
    // play in slices; now and then repeat a slice (stutter) or drop it (dropout)
    const t0 = ctx.currentTime + 0.05;
    let t = t0, pos = 0;
    const slice = 0.09;
    while (pos < buf.duration) {
      const len = Math.min(slice, buf.duration - pos);
      const reps = Math.random() < glitch * 0.08 ? 2 + Math.floor(Math.random() * 2) : 1;
      for (let r = 0; r < reps; r++) {
        if (Math.random() < glitch * 0.03) { t += len; continue; } // dropout
        const src = ctx.createBufferSource(); src.buffer = buf;
        src.playbackRate.value = Math.random() < glitch * 0.05 ? 0.92 : 1;
        src.connect(hp); src.start(t, pos, len); t += len / src.playbackRate.value;
      }
      pos += len;
    }
    this.glitchBed(t - t0, glitch * 0.6);
    setTimeout(done, (t - t0 + 0.4) * 1000);
  },

  // On-screen transmission: the line types out with glitching characters, then fades.
  subtitle(text, seconds, glitch) {
    let box = document.getElementById('comms');
    if (!box) { box = document.createElement('div'); box.id = 'comms'; document.body.appendChild(box); }
    clearInterval(this.subTimer); clearTimeout(this.subHide);
    box.innerHTML = '<span class="comms-src">◆ SHIP AI</span><span class="comms-text"></span>';
    box.className = 'show';
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
