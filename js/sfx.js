// Voyager — sound effects: synthesised in the browser, or recorded files (mp3 or any format the browser plays).
//
// Files are listed in Sfx.files (name -> { src, gain, fallback }) and take priority over a recipe of the same
// name. A file is fetched and decoded once, then played from its buffer like a recipe. When it can't be fetched
// (missing, or the page opened from disk) it plays through a plain <audio> element, and if that fails too, the
// fallback recipe plays instead. To swap a synthesised sound for a recording, drop the file in assets/sfx/ and
// add a line to Sfx.files.
//
// Each synthesised effect is a recipe that draws into an OfflineAudioContext. It is rendered once into an AudioBuffer the
// first time it is needed and then played from that buffer, so playing a sound costs almost nothing (and phones
// don't crackle). Playback shares the Assistant's audio context, which in turn shares the music's.
//
//   Sfx.play('cycle')  — End Cycle: assets/sfx/cycle.mp3 (falls back to 'lever', a synthesised "ka-CHUNK")
//   Sfx.play('blip')   — a star is picked on the Star Map: a short digital chirp
//   Sfx.play('reveal') — a new ship on the splash: fabricator whine, clamp release, confirm tones
//   Sfx.play('rare')   — added for Epic and better: a dark shimmering chord
//   UI: click (ordinary buttons), construct (a build or upgrade starts), research (a level is done), forge (a weapon is forged)
//   battle: shield / hull (a hit, by where the damage went: shield.mp3 / hull.mp3), miss (evade.mp3), explode (a ship destroyed), restore, victory, defeat

const Sfx = {
  enabled: true,
  volume: 0.7,
  prefsKey: 'voyager_sfx',
  quiet: false,
  buffers: {},          // name -> AudioBuffer
  pending: {},          // name -> Promise<AudioBuffer>
  rate: 44100,
  failed: {},           // file name -> true once it could not be fetched/decoded (then <audio> or the fallback is used)

  // Recorded effects. src is relative to index.html; gain scales this file only; fallback names the recipe to
  // play when the file can't (default: the recipe of the same name).
  files: {
    cycle: { src: 'assets/sfx/cycle.mp3', gain: 1 },
    hull: { src: 'assets/sfx/hull.mp3', gain: 1 },
    shield: { src: 'assets/sfx/shield.mp3', gain: 1 },
    miss: { src: 'assets/sfx/evade.mp3', gain: 1 },
    explode: { src: 'assets/sfx/explode.mp3', gain: 1 },
    construct: { src: 'assets/sfx/construct.mp3', gain: 1 },
  },

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
  // opts.rate: playback speed (1 = as rendered), opts.gain: extra loudness for this one play,
  // opts.synth: play the synthesised recipe even when a file of that name is listed (used for fallbacks)
  play(name, opts = {}) {
    if (!this.enabled || this.quiet) return; // quiet: a battle resolved instantly stays silent
    const file = !opts.synth && this.files[name];
    if (!file && !this.recipes[name]) return;
    if (typeof Voice === 'undefined' || !Voice.activated) return; // browsers block sound before the first click
    const ctx = Voice.audio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const go = (gain) => (buf) => {
      try {
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = buf;
        src.playbackRate.value = opts.rate || 1;
        g.gain.value = this.volume * (opts.gain ?? 1) * gain;
        src.connect(g); g.connect(ctx.destination);
        src.start(ctx.currentTime + 0.01 + (opts.delay || 0));
      } catch (e) { /* audio unavailable */ }
    };
    if (!file) { this.render(name).then(go(1), () => {}); return; }
    const key = 'file:' + name;
    if (this.buffers[key]) { go(file.gain ?? 1)(this.buffers[key]); return; }
    if (this.failed[name]) { this.playBasic(name, opts); return; }
    this.loadFile(name).then(go(file.gain ?? 1), () => this.playBasic(name, opts));
  },

  // The recipe a file falls back to: its own fallback, else the recipe of the same name.
  fallbackOf(name) {
    const f = this.files[name].fallback || name;
    return this.recipes[f] ? f : null;
  },

  // A file that could not be decoded (e.g. opened from disk, where fetch() is blocked): try an <audio> element,
  // then the fallback recipe.
  playBasic(name, opts) {
    const file = this.files[name];
    let done = false;
    const fallback = () => {
      if (done) return; done = true;
      const f = this.fallbackOf(name); if (f) this.play(f, { ...opts, synth: true });
    };
    let a = null;
    try { a = new Audio(file.src); } catch (e) { /* no <audio> */ }
    if (!a) { fallback(); return; }
    a.volume = Math.max(0, Math.min(1, this.volume * (opts.gain ?? 1) * (file.gain ?? 1)));
    if (opts.rate) { a.playbackRate = opts.rate; a.preservesPitch = false; }
    const start = () => a.play().then(() => { done = true; }, fallback);
    a.onerror = fallback;
    if (opts.delay) setTimeout(start, opts.delay * 1000); else start();
  },

  // Fetches and decodes a recorded file once (buffer kept under 'file:<name>').
  loadFile(name) {
    const key = 'file:' + name, file = this.files[name];
    if (this.buffers[key]) return Promise.resolve(this.buffers[key]);
    if (this.failed[name]) return Promise.reject(new Error('failed'));
    if (this.pending[key]) return this.pending[key];
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC || !window.fetch) return Promise.reject(new Error('no audio decoding'));
    const dec = new OAC(1, 1, this.rate); // decoding needs no user gesture on an offline context
    this.pending[key] = fetch(file.src)
      .then((res) => { if (!res.ok) throw new Error('missing ' + file.src); return res.arrayBuffer(); })
      .then((data) => new Promise((ok, bad) => dec.decodeAudioData(data, ok, bad)))
      .then((buf) => { this.buffers[key] = buf; delete this.pending[key]; return buf; },
        (e) => { this.failed[name] = true; delete this.pending[key]; throw e; });
    return this.pending[key];
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

  // Load the files and render the recipes nobody replaced, in the background, so the first play is instant.
  // (Fallback recipes are rendered on demand.)
  warm() {
    for (const n of Object.keys(this.files)) this.loadFile(n).catch(() => {});
    for (const n of Object.keys(this.recipes)) if (!this.files[n] && !Object.values(this.files).some((f) => f.fallback === n)) this.render(n).catch(() => {});
  },

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
  // Brass-like chords (filtered saws) for battle stingers: steps = [[time, [freqs]], …], all fading out by `end`.
  brass(ctx, steps, end) {
    const room = this.hall(ctx, 1.4, 0.4); room.output.connect(ctx.destination);
    const out = ctx.createGain(); out.connect(ctx.destination); out.connect(room.input);
    steps.forEach(([t, freqs], i) => {
      const until = i < steps.length - 1 ? steps[i + 1][0] + 0.05 : end;
      for (const f of freqs) for (const det of [-5, 5]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(1800, t + 0.12); lp.frequency.exponentialRampToValueAtTime(700, until);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.06);
        g.gain.setValueAtTime(0.12, Math.max(t + 0.07, until - 0.15)); g.gain.linearRampToValueAtTime(0, until);
        o.connect(lp); lp.connect(g); g.connect(out); o.start(t); o.stop(until + 0.05);
      }
    });
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

    // ---- UI ----
    // A dry little tick for ordinary buttons.
    click: {
      seconds: 0.06, peak: 0.13,
      draw(ctx) {
        this.burst(ctx, ctx.destination, 0, { freq: 3200, q: 3, gain: 0.6, decay: 0.002 });
        this.ring(ctx, ctx.destination, 0, { freq: 1900, gain: 0.25, decay: 0.006, type: 'square' });
      },
    },
    // Construction begins: a pneumatic ratchet, three quick clanks and a hiss.
    construct: {
      seconds: 0.6, peak: 0.35,
      draw(ctx) {
        for (const [t, f] of [[0, 900], [0.09, 1000], [0.18, 1150]]) {
          this.burst(ctx, ctx.destination, t, { type: 'lowpass', freq: 1400, gain: 0.8, decay: 0.008 });
          this.ring(ctx, ctx.destination, t, { freq: f, gain: 0.12, decay: 0.02 });
          this.ring(ctx, ctx.destination, t, { freq: 140, freq2: 90, gain: 0.4, decay: 0.02 });
        }
        this.burst(ctx, ctx.destination, 0.26, { type: 'highpass', freq: 4000, gain: 0.25, decay: 0.05, len: 0.4 });
      },
    },
    // Research complete: a falling-rising data chime with an echo.
    research: {
      seconds: 1.2, peak: 0.3,
      draw(ctx) {
        const room = this.hall(ctx, 0.9, 0.4); room.output.connect(ctx.destination);
        const out = ctx.createGain(); out.connect(ctx.destination); out.connect(room.input);
        [659.3, 784, 987.8, 1318.5].forEach((f, i) => {
          this.ring(ctx, out, i * 0.07, { freq: f, gain: 0.3, decay: 0.09, type: 'triangle' });
          this.ring(ctx, out, i * 0.07 + 0.25, { freq: f * 2, gain: 0.05, decay: 0.05 });
        });
      },
    },
    // The Weapon Forge: a grinding press, a hiss of steam and the clang of a finished barrel.
    forge: {
      seconds: 1.2, peak: 0.5,
      draw(ctx) {
        const room = this.hall(ctx, 0.8, 0.25); room.output.connect(ctx.destination);
        const out = ctx.createGain(); out.connect(ctx.destination); out.connect(room.input);
        { // grinding press
          const src = ctx.createBufferSource(); src.buffer = this.noise(ctx, 0.5);
          const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
          f.frequency.setValueAtTime(200, 0); f.frequency.exponentialRampToValueAtTime(700, 0.42);
          const g = ctx.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(2.2, 0.3); g.gain.linearRampToValueAtTime(0, 0.44);
          const lfo = ctx.createOscillator(); lfo.frequency.value = 22; const lg = ctx.createGain(); lg.gain.value = 0.25;
          lfo.connect(lg); lg.connect(g.gain); lfo.start(0); lfo.stop(0.5);
          src.connect(f); f.connect(g); g.connect(out); src.start(0);
        }
        const t = 0.45; // the clang
        this.ring(ctx, out, t, { freq: 110, freq2: 70, gain: 0.6, decay: 0.05 });
        this.burst(ctx, out, t, { type: 'lowpass', freq: 1500, gain: 0.6, decay: 0.01 });
        for (const [f, g, d] of [[523, 0.12, 0.15], [1187, 0.08, 0.12], [1843, 0.05, 0.1], [2797, 0.03, 0.07]]) this.ring(ctx, out, t, { freq: f, gain: g, decay: d });
        this.burst(ctx, out, t + 0.05, { type: 'highpass', freq: 3500, gain: 0.3, decay: 0.08, len: 0.6 });   // steam
      },
    },

    // An officer's ability: a radio click and a short rising horn call.
    officer: {
      seconds: 1.2, peak: 0.38,
      draw(ctx) {
        this.burst(ctx, ctx.destination, 0, { type: 'bandpass', freq: 2500, q: 1, gain: 0.5, decay: 0.01, len: 0.1 });
        this.brass(ctx, [[0.06, [196, 293.7]], [0.26, [261.6, 392, 523.3]]], 0.95);
      },
    },
    // ---- battle ----
    // A shot splashes on shields: a bright electric crackle sliding down.
    shield: {
      seconds: 0.45, peak: 0.32,
      draw(ctx) {
        const out = ctx.createGain(); out.connect(ctx.destination);
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.setValueAtTime(1400, 0); o.frequency.exponentialRampToValueAtTime(300, 0.3);
        const fm = ctx.createOscillator(); fm.frequency.value = 55; const fg = ctx.createGain(); fg.gain.value = 300;
        fm.connect(fg); fg.connect(o.frequency);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2; bp.frequency.setValueAtTime(3000, 0); bp.frequency.exponentialRampToValueAtTime(800, 0.3);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.4, 0.005); g.gain.exponentialRampToValueAtTime(0.001, 0.38);
        o.connect(bp); bp.connect(g); g.connect(out); o.start(0); o.stop(0.4); fm.start(0); fm.stop(0.4);
        this.burst(ctx, out, 0, { type: 'highpass', freq: 5000, gain: 0.35, decay: 0.03, len: 0.3 });
      },
    },
    // A shot tears into the hull: a heavy metallic knock with a short ring.
    hull: {
      seconds: 0.5, peak: 0.42,
      draw(ctx) {
        const out = ctx.createGain(); out.connect(ctx.destination);
        this.ring(ctx, out, 0, { freq: 95, freq2: 45, gain: 1, decay: 0.05 });
        this.burst(ctx, out, 0, { type: 'lowpass', freq: 1200, gain: 0.9, decay: 0.012 });
        this.burst(ctx, out, 0, { freq: 2500, q: 2, gain: 0.3, decay: 0.004 });
        for (const [f, g, d] of [[337, 0.1, 0.08], [719, 0.06, 0.06], [1133, 0.04, 0.05]]) this.ring(ctx, out, 0.002, { freq: f, gain: g, decay: d });
        this.burst(ctx, out, 0.06, { freq: 1800, q: 4, gain: 0.12, decay: 0.01 });                            // debris
      },
    },
    // A miss: the shot whistles past.
    miss: {
      seconds: 0.35, peak: 0.22,
      draw(ctx) {
        const src = ctx.createBufferSource(); src.buffer = this.noise(ctx, 0.35);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 6;
        f.frequency.setValueAtTime(2600, 0); f.frequency.exponentialRampToValueAtTime(500, 0.3);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.6, 0.06); g.gain.exponentialRampToValueAtTime(0.001, 0.32);
        src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(0);
      },
    },
    // A ship is destroyed: a deep boom, a roar of fire and crackling debris.
    explode: {
      seconds: 1.6, peak: 0.7,
      draw(ctx) {
        const room = this.hall(ctx, 1.2, 0.35); room.output.connect(ctx.destination);
        const out = ctx.createGain(); out.connect(ctx.destination); out.connect(room.input);
        this.ring(ctx, out, 0, { freq: 70, freq2: 28, gain: 1, decay: 0.12 });
        this.burst(ctx, out, 0, { type: 'lowpass', freq: 900, gain: 1, decay: 0.08, len: 1.0 });
        this.burst(ctx, out, 0, { type: 'lowpass', freq: 300, gain: 0.8, decay: 0.15, len: 1.2 });
        for (let i = 0; i < 14; i++) {                                                                         // crackle
          const t = 0.08 + Math.random() * 0.9;
          this.burst(ctx, out, t, { freq: 1500 + Math.random() * 2500, q: 3, gain: 0.25 * (1 - t), decay: 0.003 });
        }
      },
    },
    // Restore: a soft rising hum as shields and plating knit back.
    restore: {
      seconds: 0.8, peak: 0.25,
      draw(ctx) {
        const out = ctx.createGain(); out.gain.setValueAtTime(0, 0); out.gain.linearRampToValueAtTime(1, 0.2); out.gain.setValueAtTime(1, 0.45); out.gain.linearRampToValueAtTime(0, 0.75);
        out.connect(ctx.destination);
        for (const [f, type] of [[280, 'triangle'], [420, 'sine'], [560, 'sine']]) {
          const o = ctx.createOscillator(); o.type = type;
          o.frequency.setValueAtTime(f, 0); o.frequency.exponentialRampToValueAtTime(f * 1.6, 0.7);
          const g = ctx.createGain(); g.gain.value = 0.25;
          const trem = ctx.createOscillator(); trem.frequency.value = 12; const tg = ctx.createGain(); tg.gain.value = 0.1;
          trem.connect(tg); tg.connect(g.gain);
          o.connect(g); g.connect(out); o.start(0); o.stop(0.8); trem.start(0); trem.stop(0.8);
        }
      },
    },
    // The battle is won: a rising brass chord.
    victory: {
      seconds: 2.0, peak: 0.42,
      draw(ctx) { this.brass(ctx, [[0, [146.8, 220]], [0.28, [146.8, 220, 293.7, 370]]], 1.6); },
    },
    // The battle is lost: a sinking minor line.
    defeat: {
      seconds: 2.2, peak: 0.42,
      draw(ctx) { this.brass(ctx, [[0, [293.7, 349.2]], [0.35, [233.1, 293.7]], [0.75, [220, 261.6, 110]]], 1.9); },
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
