// Voyager — sound effects, synthesised in the browser (no audio files).
//
// Each effect is a recipe that draws into an OfflineAudioContext. It is rendered once into an AudioBuffer the
// first time it is needed and then played from that buffer, so playing a sound costs almost nothing (and phones
// don't crackle). Playback shares the Assistant's audio context, which in turn shares the music's.
//
//   Sfx.play('lever')  — End Cycle: a heavy power-plant lever (ratchet, slam, a surge of mains hum)
//   Sfx.play('blip')   — a star is picked on the Star Map: a short digital chirp

const Sfx = {
  enabled: true,
  volume: 0.7,
  prefsKey: 'voyager_sfx',
  buffers: {},          // name -> AudioBuffer
  pending: {},          // name -> Promise<AudioBuffer>
  rate: 44100,

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
  toggle() { this.enabled = !this.enabled; this.savePrefs(); },
  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); this.savePrefs(); },

  // ---- playback ----
  // opts.rate: playback speed (1 = as rendered), opts.gain: extra loudness for this one play
  play(name, opts = {}) {
    if (!this.enabled || !this.recipes[name]) return;
    if (typeof Voice === 'undefined' || !Voice.activated) return; // browsers block sound before the first click
    const ctx = Voice.audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const go = (buf) => {
      try {
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = buf;
        src.playbackRate.value = opts.rate || 1;
        g.gain.value = this.volume * (opts.gain ?? 1);
        src.connect(g); g.connect(ctx.destination);
        src.start(ctx.currentTime + 0.01);
      } catch (e) { /* audio unavailable */ }
    };
    if (this.buffers[name]) go(this.buffers[name]);
    else this.render(name).then(go, () => {});
  },

  // Renders a recipe once; later calls get the same buffer.
  render(name) {
    if (this.buffers[name]) return Promise.resolve(this.buffers[name]);
    if (this.pending[name]) return this.pending[name];
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return Promise.reject(new Error('no OfflineAudioContext'));
    const r = this.recipes[name];
    const off = new OAC(1, Math.ceil(r.seconds * this.rate), this.rate);
    r.draw.call(this, off);
    this.pending[name] = off.startRendering().then((buf) => {
      // scale to the recipe's peak level, so effects sit at a known loudness and never clip
      const d = buf.getChannelData(0); let peak = 0;
      for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      if (peak > 0) { const k = (r.peak || 0.8) / peak; for (let i = 0; i < d.length; i++) d[i] *= k; }
      this.buffers[name] = buf; delete this.pending[name]; return buf; });
    return this.pending[name];
  },

  // Render everything in the background so the first play is instant.
  warm() { for (const n of Object.keys(this.recipes)) this.render(n).catch(() => {}); },

  // ---- building blocks (all take the offline context) ----
  noise(ctx, seconds) {
    const buf = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },
  // A short burst of filtered noise: type/freq/q of the filter, peak gain, decay time.
  burst(ctx, out, t, { type = 'bandpass', freq = 2000, q = 1, gain = 0.5, decay = 0.02, len = 0.2 } = {}) {
    const src = ctx.createBufferSource(); src.buffer = this.noise(ctx, len);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 6);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t); src.stop(t + len);
  },
  // A decaying sine (a resonance): frequency (optionally gliding to freq2), peak gain, decay time.
  ring(ctx, out, t, { freq, freq2, gain = 0.1, decay = 0.3, type = 'sine' }) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freq2) o.frequency.exponentialRampToValueAtTime(freq2, t + decay * 2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 6);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + decay * 6 + 0.05);
  },
  // A big empty hall: a convolver fed with decaying noise.
  hall(ctx, seconds, wet) {
    const len = Math.ceil(seconds * ctx.sampleRate), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const conv = ctx.createConvolver(); conv.buffer = ir;
    const g = ctx.createGain(); g.gain.value = wet;
    conv.connect(g);
    return { input: conv, output: g };
  },

  recipes: {
    // A heavy lever in a power plant: the catch lets go, the ratchet clatters faster as the arm swings down,
    // it slams into its stop (a deep thud and ringing steel), and the mains hum surges as the circuit closes.
    lever: {
      seconds: 2.2,
      peak: 0.85,
      draw(ctx) {
        const master = ctx.createGain(); master.gain.value = 0.9;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -10; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.15;
        master.connect(comp); comp.connect(ctx.destination);
        const room = this.hall(ctx, 1.1, 0.35);
        room.output.connect(master);
        const dry = ctx.createGain(); dry.gain.value = 1;
        dry.connect(master); dry.connect(room.input);

        // the catch releases
        this.burst(ctx, dry, 0.0, { type: 'highpass', freq: 2500, gain: 0.7, decay: 0.005 });
        this.ring(ctx, dry, 0.0, { freq: 2300, gain: 0.05, decay: 0.02 });

        // the ratchet: teeth come faster as the arm gains speed
        const slam = 0.42;
        let t = 0.05, gap = 0.075;
        while (t < slam - 0.02) {
          this.burst(ctx, dry, t, { freq: 2600 + Math.random() * 500, q: 6, gain: 0.75, decay: 0.006 });
          this.ring(ctx, dry, t, { freq: 1700 + Math.random() * 200, gain: 0.08, decay: 0.014 });
          t += gap; gap *= 0.8;
        }
        // metal grinding along the guide
        {
          const src = ctx.createBufferSource(); src.buffer = this.noise(ctx, slam);
          const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4;
          f.frequency.setValueAtTime(500, 0.04); f.frequency.exponentialRampToValueAtTime(1500, slam);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, 0.04); g.gain.linearRampToValueAtTime(0.2, slam - 0.03); g.gain.linearRampToValueAtTime(0, slam);
          src.connect(f); f.connect(g); g.connect(dry);
          src.start(0.04);
        }

        // the slam: a deep thud, the crack of steel on steel, and the frame ringing
        this.ring(ctx, dry, slam, { freq: 95, freq2: 38, gain: 1.0, decay: 0.09 });
        this.ring(ctx, dry, slam, { freq: 170, freq2: 70, gain: 0.35, decay: 0.05, type: 'triangle' });
        this.burst(ctx, dry, slam, { type: 'lowpass', freq: 1100, gain: 0.8, decay: 0.018 });
        this.burst(ctx, dry, slam, { freq: 3200, q: 2, gain: 0.3, decay: 0.006 });
        for (const [f, g, d] of [[347, 0.07, 0.12], [829, 0.05, 0.1], [1263, 0.035, 0.08], [1957, 0.02, 0.06], [2741, 0.012, 0.05]]) {
          this.ring(ctx, dry, slam + 0.002, { freq: f, gain: g, decay: d });
        }
        // a small rattle as it settles
        this.burst(ctx, dry, slam + 0.09, { freq: 2200, q: 5, gain: 0.08, decay: 0.004 });
        this.burst(ctx, dry, slam + 0.15, { freq: 2000, q: 5, gain: 0.04, decay: 0.004 });

        // the circuit closes: a contactor snap and a surge of 50 Hz mains hum
        const on = slam + 0.06;
        this.burst(ctx, dry, on, { type: 'highpass', freq: 4000, gain: 0.12, decay: 0.003 });
        {
          const hum = ctx.createGain();
          hum.gain.setValueAtTime(0, on);
          hum.gain.linearRampToValueAtTime(0.16, on + 0.18);
          hum.gain.setValueAtTime(0.16, on + 0.4);
          hum.gain.exponentialRampToValueAtTime(0.0001, 2.15);
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
          lp.frequency.setValueAtTime(150, on); lp.frequency.exponentialRampToValueAtTime(700, on + 0.25); lp.frequency.exponentialRampToValueAtTime(250, 2.1);
          lp.connect(hum); hum.connect(dry);
          for (const [f, type, g] of [[50, 'sawtooth', 0.6], [100, 'square', 0.25], [150, 'sine', 0.2]]) {
            const o = ctx.createOscillator(); o.type = type;
            o.frequency.setValueAtTime(f * 0.92, on); o.frequency.exponentialRampToValueAtTime(f, on + 0.3); // spins up to speed
            const og = ctx.createGain(); og.gain.value = g;
            o.connect(og); og.connect(lp);
            o.start(on); o.stop(2.2);
          }
        }
      },
    },

    // A short digital chirp: two square-wave tones and a tiny falling sweep.
    blip: {
      seconds: 0.2,
      peak: 0.35,
      draw(ctx) {
        const out = ctx.createGain(); out.gain.value = 0.5;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
        out.connect(lp); lp.connect(ctx.destination);
        const tone = (t, f, len, g) => {
          const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
          const e = ctx.createGain();
          e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(g, t + 0.002);
          e.gain.setValueAtTime(g, t + len - 0.006); e.gain.linearRampToValueAtTime(0, t + len);
          o.connect(e); e.connect(out); o.start(t); o.stop(t + len + 0.01);
        };
        tone(0.0, 1320, 0.032, 0.22);
        tone(0.038, 1980, 0.028, 0.18);
        this.ring(ctx, out, 0.07, { freq: 3400, freq2: 1500, gain: 0.12, decay: 0.012, type: 'square' });
        this.burst(ctx, out, 0.0, { type: 'highpass', freq: 5000, gain: 0.06, decay: 0.003 });
      },
    },
  },
};
