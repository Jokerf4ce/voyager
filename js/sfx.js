// Voyager — sound effects, synthesised in the browser (no audio files).
//
// Each effect is a recipe that draws into an OfflineAudioContext. It is rendered once into an AudioBuffer the
// first time it is needed and then played from that buffer, so playing a sound costs almost nothing (and phones
// don't crackle). Playback shares the Assistant's audio context, which in turn shares the music's.
//
//   Sfx.play('lever')  — End Cycle: one heavy industrial lever thrown home ("ka-CHUNK")
//   Sfx.play('blip')   — a star is picked on the Star Map: a short digital chirp
//   Sfx.play('reveal') — a new ship on the splash: fabricator whine, clamp release, confirm tones
//   Sfx.play('rare')   — added for Epic and better: a dark shimmering chord

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
    // A heavy industrial lever thrown home: one "ka-CHUNK". A brief low grind as the arm swings runs straight into
    // the impact: a deep thud, a dull knock of thick steel, the latch biting a moment later, and a short ring of
    // heavy, damped metal in a concrete hall. Driven slightly into saturation for weight.
    lever: {
      seconds: 1.0,
      peak: 0.85,
      draw(ctx) {
        const master = ctx.createGain(); master.gain.value = 1;
        const shaper = ctx.createWaveShaper(); // soft saturation: a heavier, denser impact
        const curve = new Float32Array(1024);
        for (let i = 0; i < curve.length; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
        shaper.curve = curve;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000; // keep it dull, not tinny
        master.connect(shaper); shaper.connect(lp); lp.connect(ctx.destination);
        const room = this.hall(ctx, 0.6, 0.22);
        room.output.connect(lp);
        const dry = ctx.createGain();
        dry.connect(master); dry.connect(room.input);

        // the swing: a short low grind of the arm in its guide, swelling into the hit
        const hit = 0.1;
        {
          const src = ctx.createBufferSource(); src.buffer = this.noise(ctx, hit + 0.02);
          const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.5;
          f.frequency.setValueAtTime(250, 0); f.frequency.exponentialRampToValueAtTime(600, hit);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.12, hit - 0.005); g.gain.linearRampToValueAtTime(0, hit + 0.01);
          src.connect(f); f.connect(g); g.connect(dry);
          src.start(0);
        }

        // the impact
        this.ring(ctx, dry, hit, { freq: 75, freq2: 42, gain: 1.0, decay: 0.07 });                     // deep thud
        this.ring(ctx, dry, hit, { freq: 150, freq2: 95, gain: 0.5, decay: 0.04, type: 'triangle' });  // body
        this.burst(ctx, dry, hit, { type: 'lowpass', freq: 700, gain: 1.0, decay: 0.016 });           // the knock
        this.burst(ctx, dry, hit, { freq: 1600, q: 1.2, gain: 0.35, decay: 0.005 });                 // steel on steel
        for (const [f, g, d] of [[212, 0.12, 0.06], [389, 0.08, 0.045], [611, 0.05, 0.035], [947, 0.03, 0.025]]) {
          this.ring(ctx, dry, hit + 0.001, { freq: f, gain: g, decay: d });                            // thick, damped metal
        }
        // the latch bites, close enough to be part of the same hit
        const latch = hit + 0.028;
        this.burst(ctx, dry, latch, { type: 'lowpass', freq: 1200, gain: 0.45, decay: 0.008 });
        this.ring(ctx, dry, latch, { freq: 520, gain: 0.06, decay: 0.03 });
      },
    },

    // A ship leaves the slipway: a rising fabricator whine, a heavy clamp letting go, and a two-note confirm.
    reveal: {
      seconds: 1.2,
      peak: 0.6,
      draw(ctx) {
        const out = ctx.createGain(); out.connect(ctx.destination);
        const room = this.hall(ctx, 0.7, 0.25); room.output.connect(ctx.destination);
        out.connect(room.input);
        // the fabricator: filtered noise and a whine sweeping up
        {
          const src = ctx.createBufferSource(); src.buffer = this.noise(ctx, 0.5);
          const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 5;
          f.frequency.setValueAtTime(300, 0); f.frequency.exponentialRampToValueAtTime(3500, 0.42);
          const g = ctx.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.35, 0.38); g.gain.linearRampToValueAtTime(0, 0.46);
          src.connect(f); f.connect(g); g.connect(out); src.start(0);
          const o = ctx.createOscillator(); o.type = 'sawtooth';
          o.frequency.setValueAtTime(120, 0); o.frequency.exponentialRampToValueAtTime(900, 0.42);
          const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
          const og = ctx.createGain(); og.gain.setValueAtTime(0, 0); og.gain.linearRampToValueAtTime(0.08, 0.36); og.gain.linearRampToValueAtTime(0, 0.45);
          o.connect(lp); lp.connect(og); og.connect(out); o.start(0); o.stop(0.5);
        }
        // the clamp lets go
        const t = 0.45;
        this.ring(ctx, out, t, { freq: 90, freq2: 50, gain: 0.7, decay: 0.05 });
        this.burst(ctx, out, t, { type: 'lowpass', freq: 900, gain: 0.6, decay: 0.012 });
        this.burst(ctx, out, t, { type: 'highpass', freq: 3000, gain: 0.2, decay: 0.004 });
        // confirm: two clean tones a fifth apart
        this.ring(ctx, out, t + 0.06, { freq: 587, gain: 0.16, decay: 0.08, type: 'triangle' });
        this.ring(ctx, out, t + 0.15, { freq: 880, gain: 0.16, decay: 0.1, type: 'triangle' });
      },
    },

    // Epic and better: a dark, shimmering chord swells in after the reveal (played slower and lower for Omega).
    rare: {
      seconds: 2.6,
      peak: 0.5,
      draw(ctx) {
        const out = ctx.createGain(); out.gain.setValueAtTime(0, 0);
        out.gain.linearRampToValueAtTime(1, 0.35); out.gain.setValueAtTime(1, 0.9); out.gain.exponentialRampToValueAtTime(0.0001, 2.55);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(600, 0); lp.frequency.exponentialRampToValueAtTime(4000, 0.6); lp.frequency.exponentialRampToValueAtTime(1200, 2.4);
        out.connect(lp);
        const room = this.hall(ctx, 1.6, 0.5); room.output.connect(ctx.destination);
        lp.connect(ctx.destination); lp.connect(room.input);
        // D minor with an added ninth, each note doubled and detuned for a choir-like shimmer
        for (const [f, g] of [[146.8, 0.5], [293.7, 0.35], [349.2, 0.3], [440, 0.3], [659.3, 0.18]]) {
          for (const det of [-6, 6]) {
            const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
            const og = ctx.createGain(); og.gain.value = g * 0.12;
            o.connect(og); og.connect(out); o.start(0); o.stop(2.6);
          }
        }
        // a bell on top
        this.ring(ctx, ctx.destination, 0.02, { freq: 1174.7, gain: 0.12, decay: 0.25 });
        this.ring(ctx, room.input, 0.02, { freq: 1760, gain: 0.06, decay: 0.2 });
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
