// Voyager — soundtrack tracks. Each track is a little composition played by the Music engine (js/music.js).
//
// Generative track: { id, name, mood, root (MIDI), scale, bpm, bars, bar(M, t, i) }
//   bar() is called once per bar with the engine M, the start time t and the bar number i within the track,
//   and schedules notes with M's instruments: M.voice, M.strings, M.drone, M.drum, M.bell, M.brass.
//   Use M.degree(d, octave) / M.triad(d, octave) for notes in the track's scale; M.intensity is 0..1 (battles).
// Recorded track: { id, name, mood, src: 'assets/music/file.mp3' } plays an audio file instead.

const MusicTracks = [
  // ---------------------------------------------------------------------------
  {
    id: 'cathedral',
    name: 'Cathedral of Ash',
    mood: 'Monk choir over a drone; strings and war drums rise and fall.',
    root: 38,                          // D2
    scale: [0, 2, 3, 5, 7, 8, 10],     // D natural minor
    bpm: 54,
    bars: 7 * 4 * 2,                   // the whole form twice
    // Chord roots as scale degrees: i VI VII v / i iv VI VII / i VII VI v
    progressions: [[0, 5, 6, 4], [0, 3, 5, 6], [0, 6, 5, 4]],
    form: ['chant', 'chant', 'choir', 'rise', 'rise', 'choir', 'hush'],

    // A plainchant-like phrase over 4 bars: stepwise random walk, long final note on a chord tone.
    chant(M, t, prog) {
      let deg = 7 + [0, 2, 4][Math.floor(Math.random() * 3)];
      let beat = 0;
      const total = 16;
      while (beat < total - 4) {
        const len = Math.random() < 0.65 ? 1 : 2;
        const vowel = Math.random() < 0.7 ? 'ah' : 'oh';
        M.voice(t + beat * M.beat, M.degree(deg, 1), len * M.beat * 1.05, 0.22, vowel, 2);
        beat += len;
        const r = Math.random();
        deg += r < 0.4 ? -1 : r < 0.75 ? 1 : r < 0.87 ? -2 : 2;
        deg = Math.max(5, Math.min(12, deg));
      }
      const last = prog[3];
      const target = 7 + (Math.random() < 0.5 ? last : last + 4) % 7;
      M.voice(t + beat * M.beat, M.degree(target, 1), (total - beat) * M.beat, 0.24, 'oh', 2);
    },

    bar(M, t, i) {
      const phrase = Math.floor(i / 4), inPhrase = i % 4;
      const section = this.form[phrase % this.form.length];
      const prog = this.progressions[Math.floor(phrase / this.form.length) % this.progressions.length];
      const chord = prog[inPhrase];
      const hot = M.intensity;

      if (inPhrase === 0) M.drone(t, this.root, M.barLen * 4, section === 'hush' ? 0.16 : 0.22);

      if (section !== 'hush') {
        const [a, b, c] = M.triad(chord, 1);
        const vel = section === 'chant' ? 0.07 : 0.11;
        for (const m of [a - 12, a, b, c]) M.voice(t, m, M.barLen * 1.02, vel, section === 'chant' ? 'oo' : 'ah');
      }

      if (section === 'chant' && inPhrase === 0) this.chant(M, t, prog);
      if (section === 'rise' && inPhrase === 0 && Math.random() < 0.7) this.chant(M, t, prog);

      if (section === 'choir' || section === 'rise' || hot > 0.3) {
        const [a, , c] = M.triad(chord, 0);
        M.strings(t, a, M.barLen, 0.05 + 0.05 * hot);
        M.strings(t, c, M.barLen, 0.035 + 0.04 * hot);
      }

      const drums = section === 'rise' ? 0.6 + 0.4 * hot : hot;
      if (drums > 0.15) {
        M.drum(t, 0.5 * drums, 1);
        M.drum(t + M.beat * 2, 0.35 * drums, 1.15);
        if (drums > 0.5) M.drum(t + M.beat * 2.5, 0.25 * drums, 1.3);
        if (inPhrase === 3 && drums > 0.4) {
          for (let k = 0; k < 6; k++) M.drum(t + M.beat * (3 + k / 6), (0.15 + k * 0.05) * drums, 1.2);
        }
      }
    },
  },

  // ---------------------------------------------------------------------------
  {
    id: 'drift',
    name: 'Cold Drift',
    mood: 'Exploring the dark: slow pads, distant bells, a faint choir.',
    root: 40,                          // E2
    scale: [0, 2, 3, 5, 7, 9, 10],     // E Dorian: minor, with a glimmer of hope in the raised 6th
    bpm: 46,
    bars: 48,
    progressions: [[0, 3, 0, 6], [0, 5, 3, 4], [0, 6, 5, 3]],

    bar(M, t, i) {
      const phrase = Math.floor(i / 4), inPhrase = i % 4;
      const prog = this.progressions[phrase % this.progressions.length];
      const chord = prog[inPhrase];
      const hot = M.intensity;

      if (inPhrase === 0) M.drone(t, this.root, M.barLen * 4, 0.18);

      // wide, soft pad: open fifths in strings plus a hushed 'oo' choir
      const [a, b, c] = M.triad(chord, 1);
      M.strings(t, a - 12, M.barLen * 1.05, 0.04);
      M.strings(t, c - 12, M.barLen * 1.05, 0.03);
      if (phrase % 3 !== 2) for (const m of [a, b]) M.voice(t, m, M.barLen * 1.05, 0.05, 'oo');

      // bells: a few notes per bar, drifting high over the chord
      let beat = Math.random() < 0.5 ? 0 : 1;
      while (beat < 4) {
        if (Math.random() < 0.55) {
          const d = chord + [0, 2, 4, 7, 9][Math.floor(Math.random() * 5)];
          M.bell(t + beat * M.beat + Math.random() * 0.05, M.degree(d, 3), 0.09 + Math.random() * 0.05);
        }
        beat += Math.random() < 0.5 ? 1 : 1.5;
      }

      // battles still bring a heartbeat of drums
      if (hot > 0.2) {
        M.drum(t, 0.45 * hot, 0.9);
        M.drum(t + M.beat * 2.5, 0.3 * hot, 1);
      }
    },
  },

  // ---------------------------------------------------------------------------
  {
    id: 'tide',
    name: 'Iron Tide',
    mood: 'War: a driving drum ostinato, low brass and a choir crying out.',
    root: 36,                          // C2
    scale: [0, 2, 3, 5, 7, 8, 11],     // C harmonic minor: the raised 7th sounds menacing
    bpm: 72,
    bars: 48,
    progressions: [[0, 5, 3, 4], [0, 0, 5, 4], [0, 3, 5, 4]],
    form: ['build', 'war', 'war', 'choir', 'war', 'fall'],

    bar(M, t, i) {
      const phrase = Math.floor(i / 4), inPhrase = i % 4;
      const section = this.form[phrase % this.form.length];
      const prog = this.progressions[phrase % this.progressions.length];
      const chord = prog[inPhrase];
      const hot = M.intensity;
      const loud = section === 'war' || section === 'choir' ? 1 : section === 'build' ? 0.4 + inPhrase * 0.15 : 0.5;

      if (inPhrase === 0) M.drone(t, this.root, M.barLen * 4, 0.2);

      // drum ostinato: BOOM . boom boom | BOOM . boom . (with fills at the end of each phrase)
      const dv = Math.min(1, loud * 0.85 + hot * 0.3);
      if (section !== 'fall' || inPhrase < 2) {
        M.drum(t, 0.55 * dv, 0.9);
        M.drum(t + M.beat * 1.5, 0.3 * dv, 1.2);
        M.drum(t + M.beat * 2, 0.45 * dv, 1);
        if (inPhrase % 2 === 0) M.drum(t + M.beat * 3, 0.3 * dv, 1.2);
        if (inPhrase === 3 && section !== 'fall') for (let k = 0; k < 8; k++) M.drum(t + M.beat * (3 + k / 8), (0.12 + k * 0.05) * dv, 1.3);
      }

      // strings: pulsing eighth notes on the chord root
      const [a, b, c] = M.triad(chord, 0);
      for (let k = 0; k < 8; k++) M.strings(t + k * M.beat / 2, a + 12, M.beat * 0.45, (0.025 + 0.02 * loud) * (k % 2 ? 0.7 : 1));

      // low brass on the chord, swelling each bar
      if (section !== 'build' || inPhrase >= 2) {
        M.brass(t, a, M.barLen * 0.95, 0.06 * loud);
        M.brass(t, c, M.barLen * 0.95, 0.045 * loud);
      }

      // choir crying out on long chord tones
      if (section === 'choir' || (section === 'war' && inPhrase === 2)) {
        for (const m of [a + 12, b + 12, c + 12]) M.voice(t, m, M.barLen * 1.02, 0.09, 'ah');
        if (inPhrase === 0) M.voice(t, M.degree(chord + 7, 2), M.barLen * 2, 0.16, 'ah', 2);
      }
    },
  },
];
