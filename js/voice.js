// Voyager — the ship's computer voice: a lightly distorted, glitching British female voice.
// Lines and triggers live in js/voicelines.js. Call Voice.trigger(name) from anywhere in the game.
//
// Two ways a line can sound:
//  - Browser speech (default): the browser's built-in en-GB female voice. Browsers do not let a page
//    process that audio, so the glitch is built around it: the text is cut into stuttering fragments with
//    small pitch slips, and static, clicks and digital squelches are played underneath.
//  - Recorded file (line.src): the file is played through Web Audio with real distortion (waveshaper,
//    band-limited radio tone) and random stutters.

const Voice = {
  enabled: true,
  volume: 0.8,
  ctx: null,
  speaking: false,
  lastPlayed: {},           // trigger -> time (ms)
  lastActivity: Date.now(),
  hiddenAt: null,
  voice: null,              // chosen SpeechSynthesisVoice
  subtitles: true,          // show lines as on-screen transmissions
  speechBroken: false,      // set when the browser accepted speech but never spoke (e.g. Brave)
  prefsKey: 'voyager_voice',

  // Voice names to prefer, in order (Chrome, Edge/Windows, macOS/iOS, Android).
  preferred: ['Google UK English Female', 'Microsoft Sonia', 'Microsoft Libby', 'Microsoft Hazel', 'Microsoft Maisie', 'Serena', 'Kate', 'Martha', 'Stephanie', 'Moira'],

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

  // Can this browser actually speak? Brave (and Firefox with fingerprinting resistance) hide the voices.
  canSpeak() {
    return 'speechSynthesis' in window && !this.speechBroken && speechSynthesis.getVoices().length > 0;
  },

  // ---- choosing a voice ----
  pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const all = speechSynthesis.getVoices();
    if (!all.length) return null;
    for (const name of this.preferred) {
      const v = all.find((x) => x.name.includes(name));
      if (v) return (this.voice = v);
    }
    const gb = all.filter((x) => /en[-_]GB/i.test(x.lang));
    return (this.voice = gb.find((x) => /female|woman|sonia|libby|hazel|serena|kate|martha/i.test(x.name)) || gb[0] || all.find((x) => /^en/i.test(x.lang)) || null);
  },

  voiceName() {
    if (!('speechSynthesis' in window)) return 'this browser has no speech engine';
    if (this.speechBroken) return 'this browser blocked speech';
    const v = this.voice || this.pickVoice();
    return v ? `${v.name} (${v.lang})` : 'this browser offers no voices (Brave hides them for privacy)';
  },

  init() {
    this.loadPrefs();
    if ('speechSynthesis' in window) {
      this.pickVoice();
      speechSynthesis.onvoiceschanged = () => this.pickVoice();
    }
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
    const glitch = line.glitch ?? 0.35;
    if (this.subtitles || (!line.src && !this.canSpeak())) this.subtitle(line.text, line.text.length * 0.075 + 2.2, glitch);
    if (line.src) this.playFile(line, done);
    else this.speak(line, done);
    return true;
  },

  // Lower the music while she speaks.
  duck(on) {
    if (typeof Music === 'undefined' || !Music.ctx || !Music.timer) return;
    const g = Music.out.gain, t = Music.ctx.currentTime, target = Music.gainFor(Music.volume) * (on ? 0.35 : 1);
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(target, t + (on ? 0.25 : 1.2));
  },

  // ---- browser speech with glitches ----
  // Cut the text into fragments, sometimes repeating the start of a word: "Com— Commander".
  fragments(text, glitch) {
    const words = text.split(/\s+/);
    const out = [];
    let cur = [];
    words.forEach((w, i) => {
      const bare = w.replace(/[^A-Za-z']/g, '');
      if (bare.length >= 5 && Math.random() < glitch) {
        if (cur.length) out.push(cur.join(' '));
        cur = [];
        out.push(bare.slice(0, Math.max(2, Math.ceil(bare.length / 3)))); // the stutter
      }
      cur.push(w);
    });
    if (cur.length) out.push(cur.join(' '));
    return out;
  },

  speak(line, done) {
    // No usable voice: just open and close the comm channel; the line is shown on screen.
    if (!this.canSpeak()) { this.glitchBed(0.6, (line.glitch ?? 0.35) * 0.5); setTimeout(done, 1200); return; }
    speechSynthesis.cancel();
    const glitch = line.glitch ?? 0.35;
    const parts = this.fragments(line.text, glitch);
    const voice = this.voice || this.pickVoice();
    const est = line.text.length * 0.075 + parts.length * 0.25 + 0.6; // seconds, for the static bed
    this.glitchBed(est, glitch);
    let finished = false, started = false;
    const finish = () => { if (!finished) { finished = true; done(); } };
    // Some browsers accept the request but never speak. Notice that and stop trying.
    setTimeout(() => { if (!started && !finished) { this.speechBroken = true; speechSynthesis.cancel(); finish(); } }, 2500);
    parts.forEach((txt, i) => {
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = 'en-GB';
      try { if (voice) { u.voice = voice; u.lang = voice.lang; } } catch (e) { /* odd voice object: let the browser choose */ }
      u.volume = this.volume;
      u.rate = 0.94 + (Math.random() - 0.5) * 0.08 * glitch;
      u.pitch = 1.05 + (Math.random() - 0.5) * 0.35 * glitch;
      u.onstart = () => { started = true; };
      if (i === parts.length - 1) { u.onend = finish; u.onerror = finish; }
      speechSynthesis.speak(u);
    });
    setTimeout(finish, (est + 3) * 1000); // in case the browser never reports the end
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

  // ---- recorded lines: real distortion and stutter ----
  async playFile(line, done) {
    const ctx = this.audio();
    if (!ctx) { done(); return; }
    try {
      const res = await fetch(line.src);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      const glitch = line.glitch ?? 0.35;
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
          const s = ctx.createBufferSource(); s.buffer = buf;
          s.playbackRate.value = Math.random() < glitch * 0.05 ? 0.92 : 1;
          s.connect(hp); s.start(t, pos, len); t += len / s.playbackRate.value;
        }
        pos += len;
      }
      this.glitchBed(t - t0, glitch * 0.6);
      setTimeout(done, (t - t0 + 0.4) * 1000);
    } catch (e) {
      // file missing or unreadable: fall back to the browser voice
      this.speak(line, done);
    }
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

  toggle() { this.enabled = !this.enabled; this.savePrefs(); if (!this.enabled && 'speechSynthesis' in window) speechSynthesis.cancel(); },
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); this.savePrefs(); },
};
