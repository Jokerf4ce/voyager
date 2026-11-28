// Voyager — modular face portraits (officers, and anyone else who needs a face).
//
// A face is a spec: one choice per part slot plus a few colours, for example
//   { head: 'oval', eyes: 'narrow', brows: 'stern', nose: 'straight', mouth: 'grim', hair: 'bun', beard: 'none',
//     headgear: 'none', outfit: 'admiral', marks: ['scar', 'wrinkles'], bg: 'banner',
//     colors: { skin: '#d0a080', hair: '#b8b0a4', iris: '#5a90c0', cloth: '#2e3c4e', trim: '#d0a040', bg: '#4a1418', glow: '#50e0f0' } }
// Faces.render(spec) draws it at 80×72 (Faces.W × Faces.H) and returns a data URL (cached).
//
// Every part paints into a grid of (material, tone) cells. Each material has four tones made from its colour:
// 0 deep shadow, 1 shadow, 2 base, 3 light. Round shapes are lit from the upper left: a part gives a light value
// (0…1, from the surface normal) and the grid turns it into a tone with ordered dithering, so forms shade smoothly
// in pixels. The figure gets a dark outline against the background.
// Parts live in Faces.parts[slot][name]: add a function there and it is available to every face and in the
// Face Workshop (tools/faces/index.html).

const Faces = {
  W: 80, H: 72,
  cache: {},

  // ---- the grid ----
  grid: null,
  inBg: false,
  begin() { this.grid = Array.from({ length: this.H }, () => new Array(this.W).fill(null)); },
  // 4×4 ordered dither, 0…1
  bayer: [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16),
  // light value (0…1) → tone (0…3), dithered between tones
  tone(L, x, y) {
    const v = Math.max(0, Math.min(1, L)) * 3.4 - 0.2 + (this.bayer[(y & 3) * 4 + (x & 3)] - 0.5) * 0.3;
    return Math.max(0, Math.min(3, Math.round(v)));
  },
  // Lambert light from the upper left for a surface normal (nx, ny pointing right/down, nz toward the viewer).
  lit(nx, ny, nz) {
    if (nz == null) nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const d = -nx * 0.46 - ny * 0.52 + nz * 0.72;
    return 0.12 + 0.88 * Math.max(0, d);
  },
  // light for a point inside a round form: n = position inside it, −1…1 on each axis
  round(nx, ny) { return this.lit(nx, ny); },
  px(x, y, m, s = 2) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    this.grid[y][x] = { m, s, bgLayer: this.inBg };
  },
  // paint with a light value instead of a tone
  pl(x, y, m, L) { x = Math.round(x); y = Math.round(y); this.px(x, y, m, this.tone(L, x, y)); },
  get(x, y) { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= this.W || y >= this.H ? null : this.grid[y][x]; },
  is(x, y, m) { const g = this.get(x, y); return !!g && (Array.isArray(m) ? m.includes(g.m) : g.m === m); },
  // darken / lighten what is already there by a number of tones (only on the given materials, if any)
  shift(x, y, by, only) {
    const g = this.get(x, y);
    if (!g || (only && !only.includes(g.m))) return;
    this.px(x, y, g.m, Math.max(0, Math.min(3, g.s + by)));
  },

  // A filled ellipse, lit as a rounded form (opt.flat: one tone; opt.light(nx, ny, x, y): own light; opt.clip(x, y)).
  ellipse(cx, cy, rx, ry, m, opt = {}) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      if (opt.clip && !opt.clip(x, y)) continue;
      if (opt.flat != null) this.px(x, y, m, opt.flat);
      else this.pl(x, y, m, opt.light ? opt.light(nx, ny, x, y) : this.round(nx * 0.95, ny * 0.95) + (opt.bias || 0));
    }
  },
  // A filled rectangle (inclusive), lit as a slightly curved panel unless flat.
  rect(x0, y0, x1, y1, m, opt = {}) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (opt.clip && !opt.clip(x, y)) continue;
      if (opt.flat != null) { this.px(x, y, m, opt.flat); continue; }
      const nx = x1 === x0 ? 0 : ((x - x0) / (x1 - x0)) * 2 - 1, ny = y1 === y0 ? 0 : ((y - y0) / (y1 - y0)) * 2 - 1;
      this.pl(x, y, m, this.lit(nx * 0.7, ny * 0.35) + (opt.bias || 0));
    }
  },
  // A shape given by its half width per row around a centre line: hw(y) → half width (or null to skip the row).
  profile(cx, y0, y1, hw, m, opt = {}) {
    for (let y = y0; y <= y1; y++) {
      const w = hw(y);
      if (w == null || w <= 0) continue;
      for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
        const nx = (x + 0.5 - cx) / w;
        if (Math.abs(nx) > 1) continue;
        if (opt.clip && !opt.clip(x, y)) continue;
        if (opt.flat != null) this.px(x, y, m, opt.flat);
        else this.pl(x, y, m, opt.light ? opt.light(nx, (y - y0) / Math.max(1, y1 - y0), x, y) : this.lit(nx * 0.85, opt.ny || 0) + (opt.bias || 0));
      }
    }
  },
  line(x0, y0, x1, y1, m, s = 2) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, m, s);
  },
  // a thick line (a stroke of round dabs)
  stroke(x0, y0, x1, y1, r, m, opt = {}) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 1.5);
    for (let i = 0; i <= n; i++) this.ellipse(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, r, r, m, opt);
  },
  // Both sides at once: f(side, mx) with side −1 (left) / 1 (right) and mx(x) giving the x on that side of the centre.
  mirror(f) { f(-1, (x) => x); f(1, (x) => this.W - 1 - x); },
  // a deterministic 0…1 noise for textures
  hash(x, y, k = 0) { const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); },

  // The face's frame (set by the head): centre, half sizes, top of the head, chin, eye line, mouth line.
  F: { cx: 39.5, cy: 31, rx: 13.5, ry: 17, top: 14, chin: 48, eyeY: 30, mouthY: 42, eyeDX: 6.5 },

  // ---- the parts ----
  parts: {
    bg: {
      // a dark vignette behind the figure
      plain(c) {
        for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) {
          const dx = (x - 40) / 46, dy = (y - 26) / 42;
          c.pl(x, y, 'bg', 0.78 - Math.sqrt(dx * dx + dy * dy) * 0.75);
        }
      },
      // a hanging war banner with a trimmed edge and a sigil above the head
      banner(c) {
        for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) c.pl(x, y, 'bg', 0.12 + (y / c.H) * 0.08);
        c.profile(39.5, 0, 71, () => 24, 'bg', { light: (nx, t, x, y) => 0.62 - Math.abs(nx) * 0.25 + Math.sin(x * 0.5) * 0.06 - t * 0.12 });
        c.mirror((sd, mx) => { c.line(mx(15), 0, mx(15), 71, 'trim', 1); c.line(mx(16), 0, mx(16), 71, 'trim', 2); });
        for (let x = 16; x <= 63; x += 4) c.px(x, 1, 'trim', 3);
        // the sigil: a winged crest
        c.mirror((sd, mx) => { c.line(mx(30), 6, mx(37), 9, 'trim', 1); c.line(mx(28), 8, mx(36), 11, 'trim', 1); });
        c.ellipse(39.5, 9, 2.6, 2.6, 'trim');
      },
      // deep space: a faint nebula and stars
      stars(c) {
        for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) {
          const neb = Math.sin(x * 0.09 + y * 0.05) * 0.5 + Math.sin(x * 0.03 - y * 0.11 + 1.7) * 0.5;
          c.pl(x, y, 'bg', 0.14 + Math.max(0, neb) * 0.32);
        }
        for (let i = 0; i < 46; i++) {
          const x = Math.floor(c.hash(i, 3) * c.W), y = Math.floor(c.hash(i, 7) * c.H), b = c.hash(i, 11);
          c.px(x, y, b > 0.8 ? 'glow' : 'eye', b > 0.8 ? 3 : b > 0.4 ? 1 : 0);
          if (b > 0.93) { c.px(x - 1, y, 'glow', 1); c.px(x + 1, y, 'glow', 1); c.px(x, y - 1, 'glow', 1); c.px(x, y + 1, 'glow', 1); }
        }
      },
      // a glowing halo behind the head
      halo(c) {
        for (let y = 0; y < c.H; y++) for (let x = 0; x < c.W; x++) {
          const r = Math.hypot(x + 0.5 - 39.5, (y + 0.5 - 27) * 1.05);
          let L = 0.12 + Math.max(0, 1 - r / 34) * 0.55;
          if (Math.abs(r - 25) < 0.8) L = 0.95;
          if (Math.abs(r - 21) < 0.5) L = 0.75;
          c.pl(x, y, 'bg', L);
        }
        for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; c.px(39.5 + Math.cos(t) * 28.5, 27 + Math.sin(t) * 27, 'glow', a % 2 ? 1 : 3); }
      },
      none() {},
    },

    // shoulders and chest, from y ≈ 52 down
    outfit: {
      uniform(c) {
        Faces.shoulders(c, 'cloth');
        Faces.collar(c, 'cloth', 10, 51, 56);
        c.mirror((sd, mx) => { for (let y = 60; y < c.H; y++) c.shift(mx(37), y, -1, ['cloth']); });        // the jacket's front edge
        for (const y of [60, 64, 68]) { c.ellipse(41.5, y, 1.1, 1.1, 'trim'); c.px(42, y + 1, 'trim', 0); }
        c.mirror((sd, mx) => c.line(mx(14), 61, mx(25), 58, 'cloth', 1));                                  // shoulder seams
        c.mirror((sd, mx) => { c.rect(Math.min(mx(23), mx(28)), 64, Math.max(mx(23), mx(28)), 66, 'cloth', { flat: 1 }); });  // pockets
      },
      admiral(c) {
        Faces.parts.outfit.uniform(c);
        c.mirror((sd, mx) => {                                                                              // epaulettes with fringe
          c.ellipse(mx(16.5), 60, 7.5, 3, 'trim');
          for (let x = 10; x <= 23; x += 2) { c.line(mx(x), 62, mx(x), 65, 'trim', 1); c.px(mx(x), 66, 'trim', 0); }
          c.px(mx(16), 59, 'glow', 3);
        });
        for (let i = 0; i < 18; i++) { c.stroke(24 + i * 1.15, 57 + i * 0.85, 24 + i * 1.15, 57 + i * 0.85, 1.6, 'trim', { light: (nx, ny) => 0.55 - ny * 0.25 }); } // sash
        const ribbons = ['blood', 'trim', 'glow', 'iris'];
        ribbons.forEach((m, i) => { c.rect(49 + i * 3, 61, 50 + i * 3, 63, m, { flat: 2 }); c.px(49 + i * 3, 61, m, 3); });
        c.ellipse(52.5, 67, 2.2, 2.2, 'trim'); c.px(52, 66, 'glow', 3);                                     // the star
        Faces.collar(c, 'cloth', 10, 51, 56); c.line(30, 55, 49, 55, 'trim', 2); c.line(30, 56, 49, 56, 'trim', 1);
      },
      coat(c) {
        Faces.shoulders(c, 'cloth', { wide: 1 });
        c.profile(39.5, 52, 71, (y) => 7 + (y - 52) * 0.25, 'cloth2', { light: (nx) => 0.7 - Math.abs(nx) * 0.2 });   // shirt
        c.mirror((sd, mx) => {                                                                              // lapels
          for (let y = 52; y < c.H; y++) {
            const a = 33 - (y - 52) * 0.55, b = a + 5 + Math.min(4, (y - 52) * 0.4);
            for (let x = Math.round(a - (b - a)); x <= Math.round(a); x++) c.pl(mx(x), y, 'cloth', 0.35 + (x - a) * 0.05);
            c.px(mx(Math.round(a)), y, 'cloth', 3);
          }
        });
        c.profile(39.5, 53, 55, () => 9, 'cloth', { flat: 0 });                                             // turned-up collar shadow
        c.mirror((sd, mx) => c.px(mx(26), 66, 'trim', 3));
      },
      robe(c) {
        Faces.shoulders(c, 'cloth', { drape: true });
        c.profile(39.5, 52, 71, (y) => Math.max(1, 11 - (y - 52) * 0.5), 'cloth', { flat: 0 });              // the opening, in shadow
        c.mirror((sd, mx) => {                                                                              // embroidered edges
          for (let y = 52; y < c.H; y++) {
            const x = 39.5 - Math.max(1, 11 - (y - 52) * 0.5);
            c.px(mx(Math.floor(x) - 1), y, 'trim', (y % 3) ? 2 : 3); c.px(mx(Math.floor(x) - 2), y, 'trim', 1);
          }
        });
        c.mirror((sd, mx) => { for (let y = 58; y < c.H; y += 5) c.line(mx(8), y, mx(20), y + 2, 'cloth', 1); });   // folds
        c.ellipse(39.5, 65, 3, 3.5, 'trim'); c.ellipse(39.5, 65, 1.5, 2, 'glow', { flat: 3 });                // pendant
        c.line(39, 53, 39, 61, 'trim', 1);
      },
      armor(c) {
        Faces.shoulders(c, 'cloth');
        c.profile(39.5, 55, 71, (y) => 13 + Math.min(5, (y - 55) * 0.6), 'metal', { light: (nx, t) => c.lit(nx * 0.9, -0.15 + t * 0.4) });  // breastplate
        c.line(39, 56, 39, 71, 'metal', 0); c.line(40, 56, 40, 71, 'metal', 3);
        for (const y of [62, 67]) c.line(27, y, 52, y, 'metal', 0);
        c.mirror((sd, mx) => { c.ellipse(mx(15.5), 60, 10, 6.5, 'metal'); c.line(mx(7), 63, mx(24), 63, 'trim', 1); c.line(mx(8), 64, mx(23), 64, 'metal', 0); });  // pauldrons
        Faces.collar(c, 'metal', 11, 51, 56);                                                                // gorget
        c.ellipse(39.5, 59, 2.2, 2.2, 'glow', { flat: 3 }); c.mirror((sd, mx) => c.px(mx(37), 59, 'glow', 1));
      },
    },

    // the head: neck, ears, face. Sets Faces.F.
    head: {
      oval(c) { Faces.headShape(c, { rx: 17, ry: 21.5, jaw: 0.72 }); },
      square(c) { Faces.headShape(c, { rx: 17.8, ry: 21, jaw: 0.9, chinW: 1 }); },
      long(c) { Faces.headShape(c, { rx: 16, ry: 22.4, jaw: 0.68 }); },
      gaunt(c) { Faces.headShape(c, { rx: 15.8, ry: 22, jaw: 0.6, hollow: true }); },
    },

    eyes: {
      normal(c) { Faces.eyePair(c, { h: 2 }); },
      narrow(c) { Faces.eyePair(c, { h: 1.4, lid: 2 }); },
      wide(c) { Faces.eyePair(c, { h: 2.6, lower: true }); },
      closed(c) {
        Faces.eachEye(c, (x, y, sd) => {
          for (let dx = -3; dx <= 3; dx++) c.px(x + dx, y + Math.round((dx * dx) / 9) - 0, 'ink', 1);           // the closed lid's line
          c.px(x - 4 * sd * -1, y + 1, 'ink', 1);
          for (let dx = -3; dx <= 3; dx++) c.shift(x + dx, y - 1, -1, ['skin']);
          for (let dx = -2; dx <= 2; dx += 2) c.px(x + dx, y + 2, 'ink', 2);                                 // lashes
        });
      },
      cyber(c) {
        Faces.eyePair(c, { h: 2 });
        const { cx, eyeY, eyeDX } = Faces.F, x = Math.round(cx + eyeDX);
        c.ellipse(x, eyeY, 5, 4.2, 'metal');
        c.ellipse(x, eyeY, 2.6, 2.6, 'ink', { flat: 1 });
        c.ellipse(x, eyeY, 1.6, 1.6, 'glow', { flat: 3 }); c.px(x - 1, eyeY - 1, 'eye', 3);
        c.line(x + 3, eyeY - 4, x + 6, eyeY - 7, 'metal', 1); c.line(x + 4, eyeY + 3, x + 7, eyeY + 6, 'metal', 1);
        c.px(x + 4, eyeY - 1, 'glow', 2);
      },
    },

    brows: {
      flat(c) { Faces.browPair(c, (t) => 0, 1.4); },
      stern(c) { Faces.browPair(c, (t) => t * 1.6, 1.6); },                                                 // pulled down toward the nose
      raised(c) { Faces.browPair(c, (t) => -1.8 * (1 - t * t) + 0.6, 1.3); },
      heavy(c) { Faces.browPair(c, (t) => t * 0.8, 2.4); },
      none() {},
    },

    nose: {
      straight(c) { Faces.nose(c, { w: 2.6 }); },
      hooked(c) { Faces.nose(c, { w: 2.6, hook: 1.4 }); },
      broad(c) { Faces.nose(c, { w: 3.8 }); },
      none() {},
    },

    mouth: {
      neutral(c) { Faces.mouth(c, { w: 5, curve: 0, upper: 1, lower: 1.4 }); },
      grim(c) { Faces.mouth(c, { w: 5.5, curve: 0.5, upper: 0.6, lower: 0.8, line: true }); },
      frown(c) { Faces.mouth(c, { w: 5, curve: 1.6, upper: 0.8, lower: 1.2 }); },
      smirk(c) { Faces.mouth(c, { w: 5, curve: 0, tilt: -1.4, upper: 0.8, lower: 1.2 }); },
      snarl(c) { Faces.mouth(c, { w: 6, curve: 0.8, upper: 1, lower: 1, teeth: true }); },
    },

    // hair: back parts are drawn before the head (Faces.backHair), the rest here on top
    hair: {
      bald(c) {
        const { cx, top } = Faces.F;
        c.ellipse(cx - 4, top + 4, 4, 2, 'skin', { flat: 3, clip: (x, y) => c.is(x, y, 'skin') && Faces.hash(x, y) > 0.35 });
      },
      short(c) { Faces.hairCap(c, { depth: 6 }); },
      crop(c) { Faces.hairCap(c, { depth: 4.5, stubble: true }); },
      slick(c) { Faces.hairCap(c, { depth: 6.5, comb: true }); },
      bun(c) {
        Faces.hairCap(c, { depth: 5.5, comb: true });
        const { cx, top } = Faces.F;
        c.ellipse(cx, top - 3.5, 6.5, 5, 'hair', { light: (nx, ny, x, y) => c.lit(nx, ny) + Math.sin((x - y) * 1.1) * 0.1 });
        c.line(cx - 8, top - 2, cx + 8, top - 5, 'trim', 2); c.line(cx - 8, top - 1, cx + 8, top - 4, 'trim', 1);  // the pin
        c.px(cx + 8, top - 5, 'glow', 3);
      },
      long(c) { Faces.hairCap(c, { depth: 6.5, part: true }); },
      mohawk(c) {
        const { cx, top } = Faces.F;
        c.profile(cx, top - 7, top + 9, (y) => 3.2 - Math.max(0, (top - y)) * 0.15, 'hair', { light: (nx, t, x, y) => c.lit(nx, -0.4) + Math.sin(y * 1.3) * 0.12 });
        for (let i = 0; i < 4; i++) c.line(cx - 2 + i * 1.4, top - 7, cx - 1 + i * 1.4, top - 10 + (i % 2), 'hair', 2);
        c.mirror((sd, mx) => c.profile(mx(Math.round(cx - 9)), top + 6, top + 12, () => 1.5, 'hair', { flat: 0, clip: (x, y) => c.is(x, y, 'skin') && Faces.hash(x, y) > 0.5 }));
      },
      braids(c) { Faces.hairCap(c, { depth: 6, part: true, comb: true }); },
    },

    beard: {
      none() {},
      stubble(c) { Faces.beardArea(c, (x, y, d) => { if (Faces.hash(x, y, 3) < 0.42) c.shift(x, y, -1, ['skin']); if (Faces.hash(x, y, 5) < 0.18) c.px(x, y, 'hair', 1); }); },
      full(c) {
        Faces.beardArea(c, (x, y, d, nx) => c.pl(x, y, 'hair', c.lit(nx * 0.9, 0.2 + d * 0.5) + (Faces.hash(x, y) - 0.5) * 0.3 + Math.sin(x * 1.7 + y * 0.4) * 0.08), { full: true });
        const { cx, mouthY } = Faces.F;
        c.line(cx - 4, mouthY, cx + 4, mouthY, 'ink', 1);
      },
      goatee(c) {
        const { cx, mouthY, chin } = Faces.F;
        c.profile(cx, mouthY + 2, chin + 1, (y) => 3.4 - (y - mouthY - 2) * 0.12, 'hair', { light: (nx, t, x, y) => c.lit(nx, 0.3) + Math.sin(x * 2) * 0.1 });
        c.mirror((sd, mx) => c.line(mx(Math.round(cx - 6)), mouthY - 2, mx(Math.round(cx - 3)), mouthY - 2, 'hair', 1));
      },
      moustache(c) {
        const { cx, mouthY } = Faces.F;
        c.mirror((sd, mx) => {
          for (let i = 0; i <= 6; i++) { const x = mx(Math.round(cx - 0.5 - i)), y = mouthY - 2 + Math.floor(i * i / 12); c.px(x, y, 'hair', i < 2 ? 3 : 2); c.px(x, y + 1, 'hair', 1); }
        });
      },
    },

    headgear: {
      none() {},
      hood(c) {
        const { cx, cy, rx, ry, top, chin } = Faces.F;
        for (let y = top - 7; y < c.H; y++) for (let x = 0; x < c.W; x++) {
          const ny = (y + 0.5 - (cy - 1)) / (ry + 8), w = rx + 8 + Math.max(0, y - cy) * 0.35;
          const nx = (x + 0.5 - cx) / w;
          if (nx * nx + Math.min(0, ny) ** 2 > 1 && y < cy) continue;
          if (Math.abs(nx) > 1) continue;
          const fx = (x + 0.5 - cx) / (rx + 0.6), fy = (y + 0.5 - (cy + 2)) / (ry + 0.5);
          if (fx * fx + fy * fy <= 1 && y > top - 1) continue;                                              // the face opening
          if (y > chin + 6 && Math.abs(x + 0.5 - cx) < 9 + (y - chin) * 0.6) continue;                       // open at the front
          c.pl(x, y, 'cloth', c.lit(nx, Math.max(-0.9, ny)) * 0.9 + Math.sin(x * 0.4 + y * 0.1) * 0.05);
        }
        for (let y = top - 1; y <= chin; y++) for (let x = 0; x < c.W; x++) {                               // shadow inside the hood
          if (!c.is(x, y, ['skin', 'hair'])) continue;
          const near = [-1, 1, -2, 2].some((d) => c.is(x + d, y, 'cloth')) || c.is(x, y - 1, 'cloth') || c.is(x, y - 2, 'cloth');
          if (near) c.shift(x, y, -2); else if (y < top + 5) c.shift(x, y, -1);
        }
      },
      cap(c) {
        const { cx, cy, rx, ry, top } = Faces.F, band = top + Math.round(ry * 0.36);
        // the crown covers the top of the skull and rises a little at the front
        for (let y = top - 6; y <= band; y++) for (let x = 0; x < c.W; x++) {
          const nx = (x + 0.5 - cx) / (rx + 1.6), ny = (y + 0.5 - (cy - 1)) / (ry + 1.8);
          const rise = (x + 0.5 - cx) / (rx + 2.5 - (band - y) * 0.12);
          if (nx * nx + ny * ny > 1 && !(y > top - 6 && Math.abs(rise) <= 1 && y < top + 2)) continue;
          c.pl(x, y, 'cloth', c.lit(nx * 0.9, Math.max(-0.8, ny * 1.4)) + Math.sin(x * 0.7) * 0.03);
        }
        c.profile(cx, band - 2, band, (y) => rx + 1.8, 'cloth', { light: (nx) => c.lit(nx, 0) - 0.12 });   // the band
        c.line(cx - rx - 1, band - 1, cx + rx + 1, band - 1, 'trim', 2);
        c.profile(cx, band + 1, band + 3, (y) => rx - 1 - (y - band - 1) * 2.5, 'ink', { light: (nx, t) => 0.55 - t * 0.4 });  // the peak
        c.line(cx - rx + 1, band + 1, cx + rx - 1, band + 1, 'ink', 3);
        c.ellipse(cx, top + 1, 3, 3.2, 'trim'); c.px(cx - 1, top, 'glow', 3);                                     // badge
        c.mirror((sd, mx) => c.line(mx(Math.round(cx - 5)), top + 1, mx(Math.round(cx - 9)), top - 1, 'trim', 1));
        for (let x = Math.round(cx - rx); x <= cx + rx; x++) for (let k = 4; k <= 5; k++) c.shift(x, band + k, -1, ['skin', 'hair']);  // shade under the peak
      },
      helmet(c) {
        const { cx, cy, rx, top, eyeY } = Faces.F;
        c.ellipse(cx, top + 6, rx + 3.5, 13, 'metal', { clip: (x, y) => y <= top + 7 });
        c.profile(cx, top + 7, top + 9, () => rx + 3.5, 'metal', { flat: 1 });
        c.line(cx - rx - 3, top + 8, cx + rx + 3, top + 8, 'trim', 2);
        c.mirror((sd, mx) => c.rect(Math.min(mx(Math.round(cx - rx - 3)), mx(Math.round(cx - rx))), top + 9, Math.max(mx(Math.round(cx - rx - 3)), mx(Math.round(cx - rx))), eyeY + 12, 'metal'));  // cheek guards
        c.profile(cx, top - 8, top + 4, () => 1.2, 'trim', { flat: 3 });                                    // crest
        c.mirror((sd, mx) => { c.px(mx(Math.round(cx - rx - 1)), top + 12, 'glow', 2); c.px(mx(Math.round(cx - rx - 1)), top + 15, 'glow', 1); });
        for (let x = Math.round(cx - rx); x <= cx + rx; x++) c.shift(x, top + 10, -2, ['skin']);
      },
      circlet(c) {
        const { cx, top, rx } = Faces.F;
        for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) {
          const y = top + 7 + Math.round(((x - cx) / rx) ** 2 * 1.5);
          if (c.is(x, y, ['skin', 'hair'])) { c.px(x, y, 'trim', x < cx ? 3 : 2); c.px(x, y + 1, 'trim', 1); c.shift(x, y + 2, -1, ['skin']); }
        }
        c.profile(cx, top + 3, top + 7, (y) => (y - top - 3) * 0.6 + 0.6, 'trim', { light: (nx) => 0.8 - nx * 0.3 });  // the peak
        c.ellipse(cx, top + 6, 1.2, 1.2, 'glow', { flat: 3 });
      },
      visor(c) {
        const { cx, rx, eyeY } = Faces.F;
        c.profile(cx, eyeY - 3, eyeY + 2, (y) => rx + 1.5 - Math.abs(y - eyeY + 0.5) * 0.3, 'metal', { light: (nx, t) => c.lit(nx, -0.4 + t * 0.8) });
        c.profile(cx, eyeY - 1, eyeY + 0, () => rx - 1, 'glow', { light: (nx, t, x) => 0.6 + Math.sin(x * 0.8) * 0.2 });
        c.mirror((sd, mx) => c.line(mx(Math.round(cx - 7)), eyeY - 1, mx(Math.round(cx - 4)), eyeY - 1, 'glow', 3));
        c.line(cx - rx - 1, eyeY - 3, cx + rx + 1, eyeY - 3, 'metal', 3);
        c.line(cx - rx - 1, eyeY + 2, cx + rx + 1, eyeY + 2, 'metal', 0);
      },
    },

    // extra details, any number of them
    marks: {
      scar(c) {
        const { cx, eyeY, eyeDX } = Faces.F, x = Math.round(cx - eyeDX) - 1;
        for (let i = 0; i <= 13; i++) { const px = x - 2 + i * 0.45, py = eyeY - 7 + i; if (c.is(px, py, ['skin', 'eye', 'iris', 'ink', 'lips'])) { c.px(px, py, 'scar', 2); c.px(px + 1, py, 'scar', 0); } }
        for (let i = 2; i <= 12; i += 3) { c.px(x - 3 + i * 0.45, eyeY - 7 + i, 'scar', 3); c.px(x - 1 + i * 0.45, eyeY - 7 + i, 'scar', 3); }   // stitch marks
      },
      eyepatch(c) {
        const { cx, eyeY, eyeDX, top, rx } = Faces.F, x = Math.round(cx - eyeDX);
        c.line(x, eyeY - 1, Math.round(cx + rx), top + 5, 'ink', 1); c.line(x, eyeY, Math.round(cx - rx), eyeY - 3, 'ink', 1);
        c.ellipse(x, eyeY + 0.5, 4.5, 3.6, 'ink', { light: (nx, ny) => c.lit(nx, ny) * 0.8 });
        c.px(x - 2, eyeY - 1, 'ink', 3);
      },
      bandage(c) {
        const { cx, rx, eyeY } = Faces.F;
        for (let x = Math.round(cx - rx - 1); x <= Math.round(cx + rx + 1); x++) for (let y = eyeY - 3; y <= eyeY + 2; y++) {
          const nx = (x - cx) / (rx + 1), yy = y - Math.round(nx * nx * 1.5);                                  // the band curves round the head
          if (yy < eyeY - 2 || !c.is(x, y, ['skin', 'eye', 'iris', 'ink', 'hair', 'lips'])) continue;
          const t = (yy - eyeY + 2) / 4;
          c.pl(x, y, 'cloth2', c.lit(nx, t * 0.6 - 0.3) + ((x + y * 2) % 7 === 0 ? -0.25 : 0));
        }
        c.ellipse(cx - 7, eyeY, 1.4, 1, 'blood'); c.ellipse(cx + 7, eyeY, 1, 0.9, 'blood');                  // seeping through
      },
      thirdeye(c) {
        const { cx, top } = Faces.F, y = top + 9;
        c.ellipse(cx, y, 3.6, 1.9, 'skin', { flat: 0 });
        c.ellipse(cx, y, 2.8, 1.3, 'glow', { flat: 2 });
        c.ellipse(cx, y, 1.2, 1.2, 'glow', { flat: 3 }); c.px(cx, y, 'eye', 3);
        c.mirror((sd, mx) => { c.px(mx(Math.round(cx - 4)), y - 1, 'glow', 1); c.px(mx(Math.round(cx - 5)), y + 1, 'glow', 1); });
      },
      tattoo(c) {
        const { cx, eyeY, eyeDX } = Faces.F;
        c.mirror((sd, mx) => {
          const x = Math.round(cx - eyeDX - 2);
          for (let i = 0; i < 8; i++) c.px(mx(x + Math.round(Math.sin(i * 0.8))), eyeY + 4 + i, 'glow', i % 3 ? 1 : 2);
          c.px(mx(x - 2), eyeY + 8, 'glow', 1); c.px(mx(x + 2), eyeY + 10, 'glow', 1);
        });
      },
      wrinkles(c) {
        const { cx, eyeY, eyeDX, mouthY, top } = Faces.F;
        c.mirror((sd, mx) => {
          const x = Math.round(cx - eyeDX - 4);
          c.shift(mx(x), eyeY - 1, -1, ['skin']); c.shift(mx(x - 1), eyeY + 1, -1, ['skin']); c.shift(mx(x), eyeY + 2, -1, ['skin']);   // crow's feet
          for (let i = 0; i < 6; i++) c.shift(mx(Math.round(cx - 4 - i * 0.5)), mouthY - 5 + i, -1, ['skin']);                       // smile lines
          for (let dx = -3; dx <= 1; dx++) c.shift(mx(Math.round(cx - eyeDX + dx)), eyeY + 2, -1, ['skin']);                        // under the eyes
        });
        for (const y of [top + 6, top + 8]) for (let x = Math.round(cx - 5); x <= cx + 5; x++) if ((x + y) % 5) c.shift(x, y, -1, ['skin']);
      },
      cyberjaw(c) {
        // a metal plate along the right jawline, from the hinge under the ear to the chin
        const { cx, cy, rx, ry, chin, eyeY } = Faces.F, FACE = ['skin', 'lips', 'hair', 'ink', 'eye', 'iris'];
        const face = (x, y) => c.is(x, y, FACE) && y <= chin + 1;
        const plate = new Set(), cells = [];
        for (let y = eyeY + 5; y <= chin + 1; y++) for (let x = Math.round(cx + 1); x < c.W; x++) {
          if (!face(x, y)) continue;
          const u = (x + 0.5 - cx) / rx, v = (y - eyeY - 5) / (chin - eyeY - 5);
          if (u * 0.9 + v * 0.55 < 0.52) continue;                                                            // the seam: from the mouth corner up to the ear
          plate.add(x + ',' + y); cells.push([x, y]);
        }
        for (const [x, y] of cells) c.pl(x, y, 'metal', c.lit(((x + 0.5 - cx) / rx) * 0.75, ((y + 0.5 - cy) / ry) * 0.6) + 0.28);
        for (const [x, y] of cells) if (!face(x + 1, y) || !face(x, y + 1)) c.px(x, y, 'metal', 1);                                     // the outer rim
        for (const [x, y] of cells) {                                                                         // the seam where metal meets skin
          if ([[-1, 0], [0, -1], [-1, -1]].some(([dx, dy]) => !plate.has((x + dx) + ',' + (y + dy)) && c.is(x + dx, y + dy, ['skin', 'lips']))) c.px(x, y, 'ink', 1);
        }
        const hx = Math.round(cx + rx - 3), hy = eyeY + 8;                                                    // the hinge
        c.ellipse(hx, hy, 2.6, 2.6, 'metal', { light: (nx, ny) => c.lit(nx, ny) + 0.1 });
        c.px(hx, hy, 'glow', 3); c.px(hx - 1, hy, 'glow', 2); c.px(hx + 1, hy, 'ink', 1);
        for (let i = 0; i < 4; i++) { const x = Math.round(cx + 2 + i * 2), y = chin - 2 - Math.round(i * 0.7); if (plate.has(x + ',' + y)) c.line(x, y, x, y + 1, 'ink', 1); }   // vents
        for (const [x, y] of cells) if ((x * 7 + y * 3) % 23 === 0 && plate.has((x - 1) + ',' + y) && plate.has((x + 1) + ',' + y)) c.px(x, y, 'metal', 3);                // rivets
      },
      monocle(c) {
        const { cx, eyeY, eyeDX } = Faces.F, x = Math.round(cx + eyeDX);
        for (let a = 0; a < 20; a++) { const t = (a / 20) * Math.PI * 2; c.px(x + Math.cos(t) * 4.3, eyeY + Math.sin(t) * 4, 'trim', Math.sin(t) < 0 && Math.cos(t) < 0.3 ? 3 : 1); }
        c.px(x - 2, eyeY - 2, 'eye', 3);
        for (let i = 0; i < 14; i++) c.px(x + 4 + i * 0.25, eyeY + 4 + i, 'trim', i % 2 ? 1 : 2);                // the chain
      },
      earring(c) {
        const { cx, rx, eyeY } = Faces.F, x = Math.round(cx + rx + 1);
        c.px(x, eyeY + 7, 'trim', 3); c.ellipse(x, eyeY + 9.5, 1.3, 1.6, 'trim'); c.px(x, eyeY + 9, 'glow', 3);
      },
      visor(c) { Faces.parts.headgear.visor(c); },                                                          // a visor under a hood or cap
      freckles(c) {
        const { cx, eyeY } = Faces.F;
        for (let i = 0; i < 26; i++) {
          const x = cx + (Faces.hash(i, 1) - 0.5) * 20, y = eyeY + 3 + Faces.hash(i, 2) * 5;
          if (Math.abs(x - cx) > 2.5 && c.is(x, y, 'skin')) c.shift(x, y, -1);
        }
      },
    },
  },

  // ---- shared shapes ----
  // shoulders and upper chest; opt.wide: broader, opt.drape: rounder (robes)
  shoulders(c, m, opt = {}) {
    const y0 = 53, span = opt.drape ? 17 : 14, top = (y) => Math.min(1, Math.max(0, (y - y0) / span));
    const hw = (y) => 8 + (opt.wide ? 33 : 31) * (1 - (1 - top(y)) ** 2.6);
    // lit as a rounded mass: the top of the shoulders catches the light, the sides turn away
    c.profile(39.5, y0, c.H - 1, hw, m, { light: (nx, t, x, y) => c.lit(nx * 0.9, -0.75 * (1 - top(y)) + 0.1) + (Faces.hash(x, y, 9) - 0.5) * 0.04 });
  },
  // a high collar around the neck
  collar(c, m, hw, y0, y1) {
    c.profile(39.5, y0, y1, (y) => hw + (y - y0) * 0.35, m, { light: (nx, t) => c.lit(nx, -0.2 + t * 0.4) });
    c.line(39.5 - hw, y0, 39.5 + hw, y0, m, 3);
  },
  headShape(c, o) {
    const F = this.F;
    F.rx = o.rx; F.ry = o.ry; F.cx = 39.5; F.cy = 29.5;
    F.top = Math.round(F.cy - F.ry); F.chin = Math.round(F.cy + F.ry); F.eyeY = Math.round(F.cy - 1);
    F.mouthY = F.eyeY + Math.round(o.ry * 0.68); F.eyeDX = Math.round(o.rx * 0.48 * 2) / 2;
    // the neck, shadowed under the jaw
    c.profile(F.cx, F.chin - 10, 58, (y) => 9 + Math.max(0, y - 52) * 0.6, 'skin', { light: (nx, t, x, y) => c.lit(nx * 0.9, 0) - (y < F.chin + 4 ? 0.35 : 0.1) });
    // ears
    c.mirror((sd, mx) => {
      const ex = mx(Math.round(F.cx - F.rx)) + (sd < 0 ? 0.6 : 0.4);
      c.ellipse(ex, F.eyeY + 3, 2.4, 4.6, 'skin', { light: (nx, ny) => c.lit(nx * 0.8 + sd * 0.3, ny) });
      c.line(ex - sd * 0.3, F.eyeY + 1, ex - sd * 0.3, F.eyeY + 5, 'skin', 0);
    });
    // the face: an ellipse whose lower half narrows toward the jaw
    for (let y = Math.floor(F.cy - F.ry); y <= Math.ceil(F.cy + F.ry); y++) for (let x = 0; x < c.W; x++) {
      const ny = (y + 0.5 - F.cy) / F.ry, k = ny > 0.05 ? (ny - 0.05) / 0.95 : 0;
      const w = F.rx * (1 - (1 - o.jaw) * Math.pow(k, o.chinW ? 2.2 : 1.4));
      const nx = (x + 0.5 - F.cx) / w;
      if (nx * nx + ny * ny > 1) continue;
      let L = c.lit(nx * 0.92, ny * 0.75);
      // eye sockets under the brow ridge, a lit forehead and cheekbones, the shadow under the nose and lip
      for (const sx of [-1, 1]) {
        const ex = (x + 0.5 - (F.cx + sx * F.eyeDX)) / 4.6, ey = (y + 0.5 - (F.eyeY - 0.6)) / 3.2;
        if (ex * ex + ey * ey < 1) L -= 0.16 * (1 - ex * ex - ey * ey);
        const kx = (x + 0.5 - (F.cx + sx * (F.eyeDX + 2))) / 3.5, ky = (y + 0.5 - (F.eyeY + 5)) / 2;
        if (kx * kx + ky * ky < 1) L += 0.1 * (sx < 0 ? 1 : 0.4);
      }
      if (o.hollow && Math.abs(nx) > 0.42 && ny > 0.12 && ny < 0.55) L -= 0.24;                            // hollow cheeks
      if (y > F.mouthY + 2 && y < F.mouthY + 4 && Math.abs(x + 0.5 - F.cx) < 3) L -= 0.15;                 // under the lower lip
      c.pl(x, y, 'skin', L);
    }
  },
  // where the eyes are: f(x, y, side) for each
  eachEye(c, f) { const { cx, eyeY, eyeDX } = this.F; f(Math.round(cx - eyeDX), eyeY, -1); f(Math.round(cx + eyeDX - 1), eyeY, 1); },
  // an almond eye: whites, iris with pupil and catch-light, the upper lid line and its shadow
  eyePair(c, o) {
    const h = o.h;
    this.eachEye(c, (x, y, sd) => {
      for (let dx = -4; dx <= 4; dx++) {
        const t = dx / 4.4, half = h * Math.sqrt(Math.max(0, 1 - t * t)) * (1 - t * sd * 0.12);
        const yt = Math.round(y - half * 0.8), yb = Math.round(y + half * 0.6);
        for (let yy = yt; yy <= yb; yy++) c.px(x + dx, yy, 'eye', yy === yt ? 1 : (dx * sd > 2 ? 1 : 2));
        if (half > 0.3) { c.px(x + dx, yt - 1, 'ink', 1); if (o.lid) c.px(x + dx, yt, 'ink', 2); }
        if (o.lower || Math.abs(dx) < 3) c.shift(x + dx, yb + 1, -1, ['skin']);
        c.shift(x + dx, yt - 2, -1, ['skin']);                                                               // the crease
      }
      c.px(x - sd * 5, y - 1, 'ink', 1);                                                                     // lashes at the outer corner
      const ix = x + (o.gaze || 0), ir = Math.min(2, h * 0.75 + 0.3);
      for (let yy = Math.floor(y - ir); yy <= Math.ceil(y + ir); yy++) for (let xx = Math.floor(ix - ir); xx <= Math.ceil(ix + ir); xx++) {
        if (!c.is(xx, yy, 'eye')) continue;
        const d = Math.hypot(xx - ix, yy - y);
        if (d > ir + 0.2) continue;
        c.px(xx, yy, 'iris', yy < y ? 1 : d > ir - 0.7 ? 1 : 2);
      }
      c.px(ix, y, 'ink', 0); if (h > 2) c.px(ix, y + 1, 'iris', 3);
      c.px(ix - 1, y - (h > 2 ? 1 : 0), 'eye', 3);                                                           // catch-light
    });
  },
  // brows: shape(t) gives the vertical offset along the brow, t from the outer end (−1) to the inner end (1)
  browPair(c, shape, thick) {
    const { eyeY } = this.F;
    this.eachEye(c, (x, y, sd) => {
      for (let i = -4; i <= 4; i++) {
        const t = (-i * sd) / 4, by = y - 5.5 + shape(t) - Math.cos(t * 1.2) * 0.8 + 0.8;
        for (let k = 0; k < thick; k++) c.px(x + i, Math.round(by + k), 'hair', k === 0 ? (i * sd < 0 ? 2 : 1) : 1);
        if (thick > 2) c.px(x + i, Math.round(by - 1), 'hair', 0);
      }
    });
  },
  nose(c, o) {
    const { cx, eyeY, ry } = this.F, x = Math.round(cx), top = eyeY + 1, tip = eyeY + Math.round(ry * 0.42), w = o.w;
    for (let y = top; y <= tip; y++) {
      const t = (y - top) / (tip - top), hook = o.hook ? Math.sin(t * Math.PI) * o.hook : 0;
      c.shift(x + 1 + Math.round(hook), y, -1, ['skin']);                                                     // the shadow side of the bridge
      if (t > 0.3) c.shift(x + 2 + Math.round(hook), y, -1, ['skin']);
      if (t > 0.15 && t < 0.85) c.shift(x - 1, y, 1, ['skin']);                                              // light down the bridge
    }
    c.ellipse(cx - 0.3, tip, w * 0.55, 1.5, 'skin', { light: (nx, ny) => c.lit(nx, ny) + 0.12 });           // the tip
    c.mirror((sd, mx) => { c.ellipse(mx(Math.round(cx - w + 0.4)), tip + 0.5, 1.2, 1.2, 'skin', { light: (nx, ny) => c.lit(nx, ny) - 0.1 }); });  // wings
    c.mirror((sd, mx) => c.px(mx(Math.round(cx - 1.5)), tip + 1, 'skin', 0));                                // nostrils
    for (let dx = -Math.round(w); dx <= Math.round(w); dx++) c.shift(x + dx, tip + 2, -1, ['skin']);         // shadow below
  },
  mouth(c, o) {
    const { cx, mouthY } = this.F, x0 = Math.round(cx);
    for (let dx = -Math.round(o.w); dx <= Math.round(o.w); dx++) {
      const t = dx / o.w, bend = Math.round(o.curve * t * t + (o.tilt || 0) * Math.max(0, t));
      const y = mouthY + bend;
      if (Math.abs(t) < 0.95) for (let k = 1; k <= Math.round(o.upper * (1 - t * t) + 0.3); k++) c.px(x0 + dx, y - k, 'lips', 1);
      c.px(x0 + dx, y, o.line || Math.abs(t) > 0.8 ? 'ink' : 'lips', o.line ? 1 : 0);
      if (o.teeth && Math.abs(t) < 0.7) c.px(x0 + dx, y, 'eye', 2);
      if (Math.abs(t) < 0.85) for (let k = 1; k <= Math.round(o.lower * (1 - t * t) + 0.2); k++) c.px(x0 + dx, y + k, 'lips', k === 1 && Math.abs(t) < 0.4 ? 3 : 2);
    }
    c.shift(x0, mouthY - 3, -1, ['skin']); c.shift(x0 + 1, mouthY - 3, -1, ['skin']);                       // the groove above the lip
  },
  // the hair over the top of the head; o.depth: how far down the forehead, o.stubble / o.comb / o.part: texture
  hairCap(c, o) {
    const { cx, cy, rx, ry, top, eyeY } = this.F, d = o.depth;
    for (let y = top - 3; y <= eyeY + 4; y++) for (let x = 0; x < c.W; x++) {
      const nx = (x + 0.5 - cx) / (rx + 1.6), ny = (y + 0.5 - (cy - 0.5)) / (ry + 1.8);
      if (nx * nx + ny * ny > 1) continue;
      const ax = Math.abs(nx);
      let edge = top + d + Math.sin(nx * 7) * 0.6 - ax * 2;                                                   // the hairline
      if (ax > 0.84) edge = eyeY + 1 + (ax > 0.93 ? 3 : 0);                                                  // temples and sideburns
      if (y > edge) continue;
      let L = c.lit(nx, ny * 1.3);
      if (o.comb) L += Math.sin(x * 1.4 - y * 0.35 * Math.sign(nx || 1)) * 0.12;
      else L += Math.sin((x + y * 0.3) * 1.9 + this.hash(x, 0) * 3) * 0.09;
      if (o.part && Math.abs(x + 0.5 - (cx - 4)) < 0.7 && y < top + d) L = 0.05;
      if (o.stubble) { if (this.hash(x, y) < 0.35) continue; L -= 0.15; }
      c.pl(x, y, 'hair', L);
    }
    // the shadow the hair casts on the forehead
    for (let x = 0; x < c.W; x++) for (let y = top; y <= eyeY; y++) if (c.is(x, y, 'skin') && c.is(x, y - 1, 'hair')) { c.shift(x, y, -1); break; }
  },
  // drawn behind the head: long hair and braids hang down to the shoulders
  backHair(c, style) {
    const { cx, top, rx } = this.F;
    if (style === 'long') {
      c.profile(cx, top + 2, 66, (y) => rx + 3 + Math.min(5, (y - top) * 0.15), 'hair', {
        light: (nx, t, x, y) => c.lit(nx * 0.7, -0.2 + t * 0.6) * 0.85 + Math.sin(x * 1.6 + y * 0.12) * 0.1 });
    }
    if (style === 'braids') this.mirror((sd, mx) => {
      for (let y = top + 10; y < 66; y++) {
        const x = mx(Math.round(cx - rx - 2.5)) + Math.round(Math.sin(y * 0.9) * 0.8);
        for (let k = -2; k <= 2; k++) c.pl(x + k, y, 'hair', 0.55 - Math.abs(k) * 0.12 + ((y + k) % 4 < 2 ? 0.15 : -0.1));
      }
      c.ellipse(mx(Math.round(cx - rx - 2.5)), 66, 2, 1.5, 'trim');
    });
  },
  // the beard area: f(x, y, depth 0…1 down the jaw, nx) for every skin pixel of the lower face
  beardArea(c, f, o = {}) {
    const { cx, rx, ry, cy, eyeY, mouthY, chin } = this.F;
    for (let y = eyeY + 6; y <= chin + 1; y++) for (let x = 0; x < c.W; x++) {
      if (!c.is(x, y, ['skin', 'lips'])) continue;
      const nx = (x + 0.5 - cx) / rx, d = (y - eyeY - 6) / (chin - eyeY - 6);
      if (Math.abs(nx) < 0.55 && y < mouthY - 1) continue;                                                     // keep the cheeks and nose clear
      if (!o.full && Math.abs(nx) < 0.45 && y < mouthY + 2 && y > mouthY - 3) continue;                        // and the mouth
      if (o.full && c.is(x, y, 'lips') && y >= mouthY) continue;
      if (Math.abs(nx) > 0.95 && y < mouthY) continue;
      f(x, y, d, nx);
    }
  },

  // ---- colours ----
  // Four tones per material from one colour: deep shadow, shadow (darker, cooler), base, light (lighter, warmer).
  hex(c) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); },
  toHex(rgb) { return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); },
  tones(base) {
    const [r, g, b] = this.hex(base);
    return [this.toHex([r * 0.36, g * 0.38, b * 0.48]), this.toHex([r * 0.64, g * 0.66, b * 0.74]), base,
      this.toHex([r + (255 - r) * 0.3 + 6, g + (255 - g) * 0.27 + 3, b + (255 - b) * 0.18])];
  },
  palette(colors) {
    const c = Object.assign({ skin: '#c89a78', hair: '#3a2a20', iris: '#5a7090', cloth: '#3a3a44', cloth2: '#8a8070', trim: '#c8a040', metal: '#5c5c66', glow: '#50e0f0', bg: '#2a2026' }, colors);
    const pal = {};
    for (const k of Object.keys(c)) pal[k] = this.tones(c[k]);
    const sk = this.hex(c.skin);
    pal.skin[0] = this.toHex([sk[0] * 0.52, sk[1] * 0.36, sk[2] * 0.34]);                                    // warm shadows, not grey
    pal.skin[1] = this.toHex([sk[0] * 0.78, sk[1] * 0.62, sk[2] * 0.56]);
    pal.lips = this.tones(this.toHex([sk[0] * 0.82, sk[1] * 0.52, sk[2] * 0.52]));
    pal.eye = ['#5a524a', '#a8a090', '#d8d0c0', '#fbf8f0'];
    pal.ink = ['#0a0706', '#1a1210', '#2a201c', '#5a4a40'];
    pal.scar = this.tones(this.toHex([sk[0] * 0.8 + 36, sk[1] * 0.62, sk[2] * 0.62]));
    pal.blood = ['#3a0808', '#6a1010', '#962020', '#c03030'];
    return pal;
  },

  // ---- drawing a face ----
  order: ['bg', 'outfit', 'head', 'eyes', 'brows', 'nose', 'mouth', 'beard', 'hair', 'headgear'],
  render(spec) {
    const key = JSON.stringify(spec);
    if (this.cache[key]) return this.cache[key];
    this.begin();
    const P = this.parts, call = (slot, name) => { const f = P[slot][name] || P[slot][Object.keys(P[slot])[0]]; f(this); };
    const bg = () => { this.inBg = true; call('bg', spec.bg || 'plain'); this.inBg = false; };   // background pixels get no outline
    bg();
    if (spec.hair === 'long' || spec.hair === 'braids') { call('head', spec.head || 'oval'); this.begin(); bg(); this.backHair(this, spec.hair); }
    call('outfit', spec.outfit || 'uniform');
    call('head', spec.head || 'oval');
    call('outfit', spec.outfit || 'uniform');                                                                   // the collar sits over the neck
    this.redrawFace(spec);
    return (this.cache[key] = this.paint(this.palette(spec.colors || {})));
  },
  redrawFace(spec) {
    const P = this.parts, call = (slot, name) => { const f = P[slot][name] || P[slot][Object.keys(P[slot])[0]]; f(this); };
    for (const slot of ['eyes', 'brows', 'nose', 'mouth', 'beard', 'hair']) call(slot, spec[slot] || Object.keys(P[slot])[0]);
    for (const m of spec.marks || []) if (P.marks[m] && !['eyepatch', 'monocle'].includes(m)) P.marks[m](this);
    call('headgear', spec.headgear || 'none');
    for (const m of spec.marks || []) if (['eyepatch', 'monocle'].includes(m)) P.marks[m](this);               // worn over a hood or visor
  },
  // Paint the grid, with a dark outline where the figure meets the background.
  paint(pal) {
    const c = document.createElement('canvas'); c.width = this.W; c.height = this.H;
    const ctx = c.getContext('2d'), G = this.grid, outline = '#0a0807';
    const img = ctx.createImageData(this.W, this.H);
    const isBg = (x, y) => { const g = this.get(x, y); return !g || g.m === 'bg' || g.bgLayer; };
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const g = G[y][x];
      if (!g) continue;
      let col = (pal[g.m] || pal.cloth)[g.s];
      if (isBg(x, y) && (!isBg(x - 1, y) || !isBg(x + 1, y) || !isBg(x, y - 1) || !isBg(x, y + 1))) col = outline;
      const [r, gg, b] = this.hex(col), i = (y * this.W + x) * 4;
      img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  },
};
