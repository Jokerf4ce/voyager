// Voyager — music engine: a playlist of tracks (js/tracks.js), synthesised live with the Web Audio API.
// Generative tracks are composed bar by bar; recorded tracks (src: audio file) are played as-is.
// Battles raise `intensity`, which every track can use (usually: more drums and strings).

const Music = {
  ctx: null,
  enabled: true,
  volume: 0.3,
  mode: 'order',         // 'order' | 'shuffle' | 'repeat'
  trackId: null,         // the track playing (or last played)
  track: null,
  trackBar: 0,           // bar within the current track
  intensity: 0,          // 0..1, raised by battles, decays over time
  nextBarTime: 0,
  timer: null,
  audioEl: null,         // for recorded tracks
  prefsKey: 'voyager_audio',

  vowels: {
    ah: [700, 1100, 2600],
    oh: [450, 800, 2830],
    oo: [325, 700, 2530],
  },

  get tracks() { return MusicTracks; },
  get beat() { return 60 / (this.track && this.track.bpm || 60); },
  get barLen() { return this.beat * 4; },

  midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  // MIDI note of a scale degree of the current track (degrees beyond 7 wrap into higher octaves).
  degree(d, octave = 0) {
    const scale = this.track.scale, n = scale.length;
    const o = Math.floor(d / n), i = ((d % n) + n) % n;
    return this.track.root + 12 * (octave + o) + scale[i];
  },
  triad(d, octave) { return [this.degree(d, octave), this.degree(d + 2, octave), this.degree(d + 4, octave)]; },

  // ---- preferences ----
  loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(this.prefsKey) || '{}');
      if (typeof p.enabled === 'boolean') this.enabled = p.enabled;
      if (typeof p.volume === 'number') this.volume = p.volume;
      if (['order', 'shuffle', 'repeat'].includes(p.mode)) this.mode = p.mode;
      if (this.tracks.some((t) => t.id === p.trackId)) this.trackId = p.trackId;
    } catch (e) { /* storage unavailable */ }
    if (!this.trackId) this.trackId = this.tracks[0].id;
  },
  savePrefs() {
    try { localStorage.setItem(this.prefsKey, JSON.stringify({ enabled: this.enabled, volume: this.volume, mode: this.mode, trackId: this.trackId })); } catch (e) { /* ignore */ }
  },

  // ---- audio graph ----
  build(ctx) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = this.gainFor(this.volume);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
    const makeup = ctx.createGain(); makeup.gain.value = 1.8;
    this.out.connect(comp); comp.connect(makeup); makeup.connect(ctx.destination);
    this.dry = ctx.createGain(); this.dry.gain.value = 0.55; this.dry.connect(this.out);
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(ctx, 5.5, 2.6);
    this.wet = ctx.createGain(); this.wet.gain.value = 0.9;
    this.verb.connect(this.wet); this.wet.connect(this.out);
  },

  gainFor(v) { return Math.pow(v, 1.5); },

  // A cathedral-sized reverb: stereo noise with an exponential tail.
  impulse(ctx, seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  },

  send(node, dry, wet) {
    const a = this.ctx.createGain(); a.gain.value = dry; node.connect(a); a.connect(this.dry);
    const b = this.ctx.createGain(); b.gain.value = wet; node.connect(b); b.connect(this.verb);
  },

  // ---- instruments ----
  // A choir voice: detuned saws shaped by vowel formant filters, with slow vibrato.
  voice(t, midi, dur, vel, vowel = 'ah', voices = 3) {
    const ctx = this.ctx, f0 = this.midiHz(midi);
    const env = ctx.createGain();
    const att = Math.min(0.9, dur * 0.3), rel = Math.min(1.6, dur * 0.4);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vel, t + att);
    env.gain.setValueAtTime(vel, t + dur - rel);
    env.gain.linearRampToValueAtTime(0, t + dur);
    const mix = ctx.createGain(); mix.gain.value = 1 / voices;
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = 4.6 + Math.random() * 0.8;
    lfoGain.gain.setValueAtTime(0, t);
    lfoGain.gain.linearRampToValueAtTime(f0 * 0.006, t + att + 0.4);
    lfo.connect(lfoGain);
    for (let i = 0; i < voices; i++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f0;
      o.detune.value = (i - (voices - 1) / 2) * 7 + (Math.random() - 0.5) * 4;
      lfoGain.connect(o.frequency);
      o.connect(mix);
      o.start(t); o.stop(t + dur + 0.05);
    }
    lfo.start(t); lfo.stop(t + dur + 0.05);
    const [f1, f2, f3] = this.vowels[vowel];
    [[f1, 1, 9], [f2, 0.5, 12], [f3, 0.18, 14]].forEach(([f, g, q]) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const gg = ctx.createGain(); gg.gain.value = g * 3;
      mix.connect(bp); bp.connect(gg); gg.connect(env);
    });
    this.send(env, 0.5, 0.8);
  },

  // Bowed strings: soft saws through a slowly opening low-pass filter.
  strings(t, midi, dur, vel) {
    const ctx = this.ctx, f0 = this.midiHz(midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vel, t + dur * 0.45);
    env.gain.linearRampToValueAtTime(0, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.linearRampToValueAtTime(1400, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(400, t + dur);
    for (const d of [-8, 8]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0; o.detune.value = d;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
    lp.connect(env);
    this.send(env, 0.6, 0.6);
  },

  // A deep drone under everything.
  drone(t, midi, dur, vel) {
    const ctx = this.ctx;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vel, t + 2.5);
    env.gain.setValueAtTime(vel, t + dur - 2.5);
    env.gain.linearRampToValueAtTime(0, t + dur);
    for (const [m, type, g] of [[midi, 'sine', 1], [midi + 12, 'triangle', 0.35], [midi + 7, 'sine', 0.25]]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = this.midiHz(m);
      const gg = ctx.createGain(); gg.gain.value = g;
      o.connect(gg); gg.connect(env); o.start(t); o.stop(t + dur + 0.05);
    }
    this.send(env, 0.7, 0.4);
  },

  // A distant war drum: a falling sine thump plus a burst of low noise.
  drum(t, vel, pitch = 1) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(95 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(42 * pitch, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0001, vel), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
    o.connect(g); o.start(t); o.stop(t + 1);
    const len = Math.floor(ctx.sampleRate * 0.25);
    const nb = ctx.createBuffer(1, len, ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const n = ctx.createBufferSource(); n.buffer = nb;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const ng = ctx.createGain(); ng.gain.value = vel * 0.5;
    n.connect(lp); lp.connect(ng); ng.connect(g);
    n.start(t);
    this.send(g, 0.35, 0.9);
  },

  // A cold metallic bell: two-operator FM with a long decay.
  bell(t, midi, vel) {
    const ctx = this.ctx, f0 = this.midiHz(midi);
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), modGain = ctx.createGain();
    car.frequency.value = f0; mod.frequency.value = f0 * 3.5;
    modGain.gain.setValueAtTime(f0 * 2.2, t);
    modGain.gain.exponentialRampToValueAtTime(f0 * 0.05, t + 2.5);
    mod.connect(modGain); modGain.connect(car.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vel, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0005, t + 4);
    car.connect(env);
    car.start(t); mod.start(t); car.stop(t + 4.1); mod.stop(t + 4.1);
    this.send(env, 0.35, 1);
  },

  // Low brass: bright saws through a swelling filter, a little growl.
  brass(t, midi, dur, vel) {
    const ctx = this.ctx, f0 = this.midiHz(midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vel, t + 0.12);
    env.gain.linearRampToValueAtTime(vel * 0.75, t + dur * 0.6);
    env.gain.linearRampToValueAtTime(0, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(250, t);
    lp.frequency.linearRampToValueAtTime(1100, t + 0.25);
    lp.frequency.linearRampToValueAtTime(500, t + dur);
    for (const [d, type] of [[-5, 'sawtooth'], [5, 'sawtooth'], [0, 'square']]) {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f0; o.detune.value = d;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
    lp.connect(env);
    this.send(env, 0.6, 0.5);
  },

  // A shared buffer of white noise (2 s), made once per audio context.
  noiseBuffer() {
    if (this.noiseBuf && this.noiseBuf.ctx === this.ctx) return this.noiseBuf.buf;
    const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = { ctx: this.ctx, buf };
    return buf;
  },

  // Wind, breath or radio static: band-passed noise swelling in and out while its band sweeps from → to (Hz).
  noise(t, dur, vel, from = 300, to = 900, q = 6) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuffer(); n.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(from, t);
    bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vel, t + dur * 0.5);
    env.gain.linearRampToValueAtTime(0, t + dur);
    n.connect(bp); bp.connect(env);
    n.start(t, Math.random() * 1.5); n.stop(t + dur + 0.05);
    this.send(env, 0.4, 0.9);
  },

  // A moaning tone sliding from one pitch to another (hull groans, distant sirens). Fractional MIDI is fine.
  glide(t, from, to, dur, vel, type = 'triangle') {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(this.midiHz(from), t);
    o.frequency.exponentialRampToValueAtTime(this.midiHz(to), t + dur);
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.3 + Math.random() * 3; lg.gain.value = this.midiHz(from) * 0.012;
    lfo.connect(lg); lg.connect(o.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vel, t + dur * 0.35);
    env.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(lp); lp.connect(env);
    o.start(t); o.stop(t + dur + 0.05); lfo.start(t); lfo.stop(t + dur + 0.05);
    this.send(env, 0.35, 1);
  },

  // A struck metal plate: inharmonic FM with a long ring, far off in the reverb.
  metal(t, midi, vel) {
    const ctx = this.ctx, f0 = this.midiHz(midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vel, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0005, t + 5);
    for (const [ratio, idx, g] of [[1.414, 2.8, 1], [2.76, 1.6, 0.5]]) {
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), cg = ctx.createGain();
      car.frequency.value = f0 * (g === 1 ? 1 : 1.19); mod.frequency.value = f0 * ratio;
      mg.gain.setValueAtTime(f0 * idx, t); mg.gain.exponentialRampToValueAtTime(f0 * 0.1, t + 3);
      mod.connect(mg); mg.connect(car.frequency); cg.gain.value = g;
      car.connect(cg); cg.connect(env);
      car.start(t); mod.start(t); car.stop(t + 5.1); mod.stop(t + 5.1);
    }
    this.send(env, 0.15, 1);
  },

  // A short tick of static (Geiger counter, a dying radio).
  crackle(t, vel, freq = 3000) {
    const ctx = this.ctx;
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuffer();
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = freq; hp.Q.value = 1.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(vel, t); env.gain.exponentialRampToValueAtTime(0.0005, t + 0.03);
    n.connect(hp); hp.connect(env);
    n.start(t, Math.random() * 1.5); n.stop(t + 0.05);
    this.send(env, 0.7, 0.3);
  },

  // ---- playlist ----
  find(id) { return this.tracks.find((t) => t.id === id) || this.tracks[0]; },

  nextTrackId() {
    const list = this.tracks, i = list.findIndex((t) => t.id === this.trackId);
    if (this.mode === 'repeat') return this.trackId;
    if (this.mode === 'shuffle' && list.length > 1) {
      let j; do { j = Math.floor(Math.random() * list.length); } while (j === i);
      return list[j].id;
    }
    return list[(i + 1) % list.length].id;
  },

  // Switch to a track. Generative notes already scheduled ring out under the new track.
  load(id) {
    this.stopRecorded();
    this.trackId = id;
    this.track = this.find(id);
    this.trackBar = 0;
    this.savePrefs();
    if (this.track.src) this.playRecorded(this.track);
    if (typeof UI !== 'undefined' && G) UI.renderTop();
  },

  // Play a specific track now (from the Settings list).
  play(id) {
    if (!this.timer) { this.enabled = true; this.trackId = id; this.start(); return; }
    this.load(id);
    this.nextBarTime = this.ctx.currentTime + 0.3; // start now; the old track's last notes ring out underneath
    this.tick();
  },

  skip() { if (this.timer) this.play(this.nextTrackId()); },

  setMode(m) { this.mode = m; this.savePrefs(); },

  playRecorded(track) {
    try {
      const a = new Audio(track.src);
      a.onended = () => { if (this.audioEl === a && this.timer) { this.load(this.nextTrackId()); this.nextBarTime = this.ctx.currentTime + 0.3; } };
      const src = this.ctx.createMediaElementSource(a);
      src.connect(this.out);
      this.audioEl = a;
      a.play().catch(() => {});
    } catch (e) { this.audioEl = null; }
  },
  stopRecorded() { if (this.audioEl) { this.audioEl.onended = null; this.audioEl.pause(); this.audioEl = null; } },

  tick() {
    if (!this.track || this.track.src) return; // recorded tracks run on their own
    while (this.nextBarTime < this.ctx.currentTime + 1.5) {
      if (this.trackBar >= this.track.bars) {
        this.load(this.nextTrackId());
        this.nextBarTime += this.beat; // a breath between tracks
        if (this.track.src) return;
      }
      this.track.bar(this, this.nextBarTime, this.trackBar);
      this.trackBar++;
      this.intensity *= 0.85;
      this.nextBarTime += this.barLen;
    }
  },

  // ---- playback ----
  // Browsers only allow audio after a user gesture, so this is called from the first click.
  start() {
    if (!this.enabled || this.timer) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!this.ctx || !(this.ctx instanceof AC)) this.build(new AC());
      this.ctx.resume();
    } catch (e) { return; }
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setValueAtTime(0, this.ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(this.gainFor(this.volume), this.ctx.currentTime + 3);
    this.nextBarTime = this.ctx.currentTime + 0.2;
    this.timer = setInterval(() => this.tick(), 250);
    this.load(this.trackId || this.tracks[0].id);
    this.tick();
  },

  stop() {
    clearInterval(this.timer); this.timer = null;
    this.stopRecorded();
    if (this.ctx && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(this.out.gain.value, now);
      this.out.gain.linearRampToValueAtTime(0, now + 1.5);
      setTimeout(() => { if (!this.timer && this.ctx) this.ctx.suspend(); }, 1600);
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    this.savePrefs();
    this.enabled ? this.start() : this.stop();
  },

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.savePrefs();
    if (this.ctx && this.timer) this.out.gain.setTargetAtTime(this.gainFor(this.volume), this.ctx.currentTime, 0.2);
  },

  // Battles push the music towards drums and strings.
  battle(strength = 0.7) { this.intensity = Math.min(1, this.intensity + strength); },

  // Render part of a generative track offline (for testing or exporting a sample).
  async render(seconds = 30, trackId = this.tracks[0].id, sampleRate = 44100) {
    const off = new OfflineAudioContext(2, Math.floor(seconds * sampleRate), sampleRate);
    const keep = { ctx: this.ctx, out: this.out, dry: this.dry, verb: this.verb, wet: this.wet, track: this.track, trackBar: this.trackBar };
    this.build(off);
    this.track = this.find(trackId);
    let i = 0;
    for (let t = 0.1; t < seconds; t += this.barLen) this.track.bar(this, t, i++);
    const buf = await off.startRendering();
    Object.assign(this, keep);
    return buf;
  },
};
