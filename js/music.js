// Voyager — generative soundtrack, synthesised live with the Web Audio API (no audio files).
// Mood: a solemn monk choir chanting in a minor key over a low drone, slow strings,
// and distant war drums that swell when battles break out. Original music: melodies are
// generated as a random walk over the scale, so it never repeats exactly.

const Music = {
  ctx: null,
  enabled: true,
  volume: 0.6,
  intensity: 0,          // 0..1, raised by battles, decays over time
  bar: 0,
  nextBarTime: 0,
  timer: null,
  prefsKey: 'voyager_audio',

  // ---- music theory ----
  root: 38,                                   // D2 (MIDI)
  scale: [0, 2, 3, 5, 7, 8, 10],              // D natural minor (Aeolian)
  bpm: 54,
  get beat() { return 60 / this.bpm; },
  get barLen() { return this.beat * 4; },
  // Chord roots as scale degrees: i, VI, VII, v / i, iv, VI, VII / i, VII, VI, v
  progressions: [[0, 5, 6, 4], [0, 3, 5, 6], [0, 6, 5, 4]],
  // Song form, one entry per 4-bar phrase.
  form: ['chant', 'chant', 'choir', 'rise', 'rise', 'choir', 'hush'],
  vowels: {
    ah: [700, 1100, 2600],
    oh: [450, 800, 2830],
    oo: [325, 700, 2530],
  },

  midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  // MIDI note of a scale degree (degrees beyond 7 wrap into higher octaves).
  degree(d, octave = 0) {
    const n = this.scale.length;
    const o = Math.floor(d / n), i = ((d % n) + n) % n;
    return this.root + 12 * (octave + o) + this.scale[i];
  },
  triad(d, octave) { return [this.degree(d, octave), this.degree(d + 2, octave), this.degree(d + 4, octave)]; },

  // ---- preferences ----
  loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(this.prefsKey) || '{}');
      if (typeof p.enabled === 'boolean') this.enabled = p.enabled;
      if (typeof p.volume === 'number') this.volume = p.volume;
    } catch (e) { /* storage unavailable */ }
  },
  savePrefs() {
    try { localStorage.setItem(this.prefsKey, JSON.stringify({ enabled: this.enabled, volume: this.volume })); } catch (e) { /* ignore */ }
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

  // Low bowed strings: soft saws through a slowly opening low-pass filter.
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
    g.gain.setValueAtTime(vel, t);
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

  // ---- composition ----
  // A plainchant-like phrase over 4 bars: stepwise random walk, long final note on a chord tone.
  chantPhrase(t, prog) {
    let deg = 7 + [0, 2, 4][Math.floor(Math.random() * 3)];
    let beat = 0;
    const total = 16;
    while (beat < total - 4) {
      const len = Math.random() < 0.65 ? 1 : 2;
      const vowel = Math.random() < 0.7 ? 'ah' : 'oh';
      this.voice(t + beat * this.beat, this.degree(deg, 1), len * this.beat * 1.05, 0.22, vowel, 2);
      beat += len;
      const r = Math.random();
      deg += r < 0.4 ? -1 : r < 0.75 ? 1 : r < 0.87 ? -2 : 2;
      deg = Math.max(5, Math.min(12, deg));
    }
    // cadence: land on the root or fifth of the last chord and hold
    const last = prog[3];
    const target = 7 + (Math.random() < 0.5 ? last : last + 4) % 7;
    this.voice(t + beat * this.beat, this.degree(target, 1), (total - beat) * this.beat, 0.24, 'oh', 2);
  },

  scheduleBar(t) {
    const phrase = Math.floor(this.bar / 4), inPhrase = this.bar % 4;
    const section = this.form[phrase % this.form.length];
    const prog = this.progressions[Math.floor(phrase / this.form.length) % this.progressions.length];
    const chord = prog[inPhrase];
    const hot = this.intensity;

    if (inPhrase === 0) this.drone(t, this.root, this.barLen * 4, section === 'hush' ? 0.16 : 0.22);

    // choir pad on the chord (low male voices)
    if (section !== 'hush') {
      const [a, b, c] = this.triad(chord, 1);
      const vel = section === 'chant' ? 0.07 : 0.11;
      for (const m of [a - 12, a, b, c]) this.voice(t, m, this.barLen * 1.02, vel, section === 'chant' ? 'oo' : 'ah');
    }

    if (section === 'chant' && inPhrase === 0) this.chantPhrase(t, prog);
    if (section === 'rise' && inPhrase === 0 && Math.random() < 0.7) this.chantPhrase(t, prog);

    // strings in the louder sections, or when battle is near
    if (section === 'choir' || section === 'rise' || hot > 0.3) {
      const [a, , c] = this.triad(chord, 0);
      this.strings(t, a, this.barLen, 0.05 + 0.05 * hot);
      this.strings(t, c, this.barLen, 0.035 + 0.04 * hot);
    }

    // war drums: on in 'rise', and pulled in by battles
    const drums = section === 'rise' ? 0.6 + 0.4 * hot : hot;
    if (drums > 0.15) {
      this.drum(t, 0.5 * drums, 1);
      this.drum(t + this.beat * 2, 0.35 * drums, 1.15);
      if (drums > 0.5) this.drum(t + this.beat * 2.5, 0.25 * drums, 1.3);
      if (inPhrase === 3 && drums > 0.4) {
        for (let i = 0; i < 6; i++) this.drum(t + this.beat * (3 + i / 6), (0.15 + i * 0.05) * drums, 1.2);
      }
    }

    this.intensity *= 0.85;
    this.bar++;
  },

  // ---- playback ----
  // Browsers only allow audio after a user gesture, so this is called from the first click.
  start() {
    if (!this.enabled || this.timer) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      if (!this.ctx || this.ctx instanceof (window.OfflineAudioContext || Object)) this.build(new AC());
      this.ctx.resume();
    } catch (e) { return; }
    this.out.gain.cancelScheduledValues(this.ctx.currentTime);
    this.out.gain.setValueAtTime(0, this.ctx.currentTime);
    this.out.gain.linearRampToValueAtTime(this.gainFor(this.volume), this.ctx.currentTime + 3);
    this.nextBarTime = this.ctx.currentTime + 0.2;
    this.timer = setInterval(() => {
      while (this.nextBarTime < this.ctx.currentTime + 1.5) { this.scheduleBar(this.nextBarTime); this.nextBarTime += this.barLen; }
    }, 250);
  },

  stop() {
    clearInterval(this.timer); this.timer = null;
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

  // Render a stretch of music offline (for testing or exporting a sample).
  async render(seconds = 30, sampleRate = 44100) {
    const off = new OfflineAudioContext(2, Math.floor(seconds * sampleRate), sampleRate);
    const keep = { ctx: this.ctx, out: this.out, dry: this.dry, verb: this.verb, wet: this.wet, bar: this.bar };
    this.build(off);
    this.bar = 0;
    for (let t = 0.1; t < seconds; t += this.barLen) this.scheduleBar(t);
    const buf = await off.startRendering();
    Object.assign(this, keep);
    return buf;
  },
};
