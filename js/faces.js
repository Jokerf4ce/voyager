// Voyager — modular face portraits (officers, and anyone else who needs a face).
//
// A face is a spec: one choice per part slot plus a few colours, for example
//   { head: 'oval', eyes: 'narrow', brows: 'stern', nose: 'straight', mouth: 'grim', hair: 'bun', beard: 'none',
//     headgear: 'none', outfit: 'admiral', marks: ['scar', 'wrinkles'], bg: 'banner',
//     colors: { skin: '#d0a080', hair: '#b8b0a4', iris: '#5a90c0', cloth: '#2e3c4e', trim: '#d0a040', bg: '#4a1418', glow: '#50e0f0' } }
// Faces.render(spec) draws it at 32×32 and returns a data URL (cached). Every part paints into a grid of
// (material, shade) cells: shapes are shaded on their own (light from the upper left: highlight, base, shadow), the
// figure gets a dark outline against the background, and each material's three tones come from its colour.
// Parts live in Faces.parts[slot][name]: add a function there and it is available to every face and in the
// Face Workshop (tools/faces/index.html).

const Faces = {
  W: 32, H: 32,
  cache: {},

  // ---- the grid ----
  grid: null,
  begin() { this.grid = Array.from({ length: this.H }, () => new Array(this.W).fill(null)); },
  px(x, y, m, s = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    this.grid[y][x] = { m, s };
  },
  get(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H ? null : this.grid[y][x]; },
  // Light comes from the upper left. n = position inside the shape, -1…1 on each axis.
  shadeAt(nx, ny) {
    const d = -(nx * 0.62 + ny * 0.78);
    if (d > 0.42) return 2;
    if (d < -0.42 || nx * nx + ny * ny > 0.86 && d < -0.05) return 0;
    return 1;
  },
  // A filled ellipse, shaded as a rounded form (flat: one shade). clip(x, y) can skip pixels.
  ellipse(cx, cy, rx, ry, m, opt = {}) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      if (opt.clip && !opt.clip(x, y)) continue;
      this.px(x, y, m, opt.flat != null ? opt.flat : this.shadeAt(nx, ny));
    }
  },
  // A filled rectangle (inclusive), shaded left-light to right-dark unless flat.
  rect(x0, y0, x1, y1, m, opt = {}) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (opt.clip && !opt.clip(x, y)) continue;
      const nx = x1 === x0 ? 0 : ((x - x0) / (x1 - x0)) * 2 - 1, ny = y1 === y0 ? 0 : ((y - y0) / (y1 - y0)) * 2 - 1;
      this.px(x, y, m, opt.flat != null ? opt.flat : this.shadeAt(nx * 0.9, ny * 0.5));
    }
  },
  // A polygon given as rows: [[y, x0, x1], …], shaded by position inside its bounding box.
  rows(list, m, opt = {}) {
    const ys = list.map((r) => r[0]), xs = list.flatMap((r) => [r[1], r[2]]);
    const [ya, yb, xa, xb] = [Math.min(...ys), Math.max(...ys), Math.min(...xs), Math.max(...xs)];
    for (const [y, x0, x1] of list) for (let x = x0; x <= x1; x++) {
      const nx = xb === xa ? 0 : ((x - xa) / (xb - xa)) * 2 - 1, ny = yb === ya ? 0 : ((y - ya) / (yb - ya)) * 2 - 1;
      this.px(x, y, m, opt.flat != null ? opt.flat : this.shadeAt(nx, ny * 0.7));
    }
  },
  line(x0, y0, x1, y1, m, s = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, m, s);
  },
  // Both sides at once: f(sideSign, mirrorX) with mirrorX(x) giving the x on that side of the face's centre line.
  mirror(f) { f(-1, (x) => x); f(1, (x) => 31 - x); },

  // The face's frame (set per head shape): centre, half-width, top of the forehead, chin.
  F: { cx: 15.5, cy: 13.5, rx: 6.5, ry: 8, eyeY: 13, top: 6, chin: 21 },

  // ---- the parts ----
  parts: {
    bg: {
      plain(c) { c.rect(0, 0, 31, 31, 'bg', { flat: 1 }); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if ((x + y) % 2 === 0 && (x < 3 || x > 28 || y < 3)) c.px(x, y, 'bg', 0); },
      banner(c) {
        c.rect(0, 0, 31, 31, 'bg', { flat: 0 });
        c.rect(8, 0, 23, 31, 'bg', { flat: 1 });
        for (let y = 0; y < 32; y += 4) { c.px(8, y, 'trim', 1); c.px(23, y, 'trim', 1); }
      },
      stars(c) {
        c.rect(0, 0, 31, 31, 'bg', { flat: 0 });
        for (const [x, y, s] of [[3, 4, 2], [27, 3, 2], [6, 18, 1], [25, 13, 2], [29, 22, 1], [2, 27, 1], [21, 2, 1], [10, 2, 1], [28, 8, 1]]) c.px(x, y, 'glow', s);
      },
      halo(c) {
        c.rect(0, 0, 31, 31, 'bg', { flat: 0 });
        c.ellipse(15.5, 12, 12, 12, 'bg', { flat: 1 });
        c.ellipse(15.5, 12, 9, 9, 'bg', { flat: 2 });
      },
      none() {},
    },

    // shoulders and chest, from y ≈ 22 down
    outfit: {
      uniform(c) {
        c.rows([[23, 7, 24], [24, 5, 26], [25, 3, 28], [26, 2, 29], [27, 1, 30], [28, 1, 30], [29, 0, 31], [30, 0, 31], [31, 0, 31]], 'cloth');
        c.rows([[22, 12, 19], [23, 11, 20], [24, 12, 19]], 'cloth', { flat: 0 });                    // high collar
        c.line(15, 25, 15, 31, 'cloth', 0); c.line(16, 25, 16, 31, 'cloth', 0);
        for (const y of [26, 28, 30]) c.px(17, y, 'trim', 2);
      },
      admiral(c) {
        Faces.parts.outfit.uniform(c);
        c.mirror((sd, mx) => {                                                                          // epaulettes
          c.rows([[24, mx(2), mx(7)], [25, mx(1), mx(8)], [26, mx(1), mx(8)]].map(([y, a, b]) => [y, Math.min(a, b), Math.max(a, b)]), 'trim');
          for (let x = 1; x <= 8; x += 2) c.px(mx(x), 27, 'trim', 0);
        });
        c.line(5, 26, 13, 31, 'trim', 1); c.line(6, 26, 14, 31, 'trim', 2);                             // sash
        c.rect(19, 27, 21, 29, 'trim', { flat: 1 }); c.px(20, 28, 'glow', 2);                           // medal
        c.rows([[22, 12, 19]], 'trim', { flat: 1 });                                                     // collar braid
      },
      coat(c) {
        c.rows([[23, 6, 25], [24, 4, 27], [25, 2, 29], [26, 1, 30], [27, 0, 31], [28, 0, 31], [29, 0, 31], [30, 0, 31], [31, 0, 31]], 'cloth');
        c.mirror((sd, mx) => c.rows([[23, mx(8), mx(12)], [24, mx(7), mx(13)], [25, mx(7), mx(13)], [26, mx(8), mx(14)], [27, mx(9), mx(14)], [28, mx(10), mx(15)]]
          .map(([y, a, b]) => [y, Math.min(a, b), Math.max(a, b)]), 'cloth', { flat: 0 }));              // lapels
        c.rows([[23, 13, 18], [24, 13, 18], [25, 14, 17], [26, 14, 17], [27, 15, 16]], 'cloth2');        // shirt
        c.px(4, 27, 'trim', 2); c.px(27, 27, 'trim', 2);
      },
      robe(c) {
        c.rows([[22, 9, 22], [23, 7, 24], [24, 5, 26], [25, 3, 28], [26, 2, 29], [27, 1, 30], [28, 1, 30], [29, 0, 31], [30, 0, 31], [31, 0, 31]], 'cloth');
        c.rows([[22, 12, 19], [23, 12, 19], [24, 13, 18], [25, 13, 18], [26, 14, 17], [27, 14, 17], [28, 15, 16]], 'cloth', { flat: 0 });   // the opening
        c.mirror((sd, mx) => { c.line(mx(11), 22, mx(14), 31, 'trim', 1); c.line(mx(10), 23, mx(13), 31, 'trim', 2); });
        c.rect(14, 29, 17, 31, 'trim', { flat: 1 }); c.px(15, 30, 'glow', 2); c.px(16, 30, 'glow', 2); // pendant
      },
      armor(c) {
        c.rows([[23, 7, 24], [24, 5, 26], [25, 3, 28], [26, 2, 29], [27, 1, 30], [28, 1, 30], [29, 0, 31], [30, 0, 31], [31, 0, 31]], 'cloth');
        c.rows([[24, 11, 20], [25, 10, 21], [26, 10, 21], [27, 11, 20], [28, 11, 20], [29, 12, 19], [30, 12, 19], [31, 12, 19]], 'metal'); // breastplate
        c.mirror((sd, mx) => { c.ellipse(mx(5) + 0.5, 26, 4, 3, 'metal'); c.line(Math.min(mx(2), mx(8)), 28, Math.max(mx(2), mx(8)), 28, 'trim', 0); });  // pauldrons
        c.line(15, 24, 15, 31, 'metal', 0);
        c.line(11, 29, 20, 29, 'trim', 1);
        c.px(14, 26, 'glow', 2); c.px(16, 26, 'glow', 2); c.px(15, 26, 'glow', 1);
      },
    },

    // the head: neck, ears, face. Sets Faces.F.
    head: {
      oval(c) { Faces.headShape(c, { rx: 6.3, ry: 8, jaw: 0.75 }); },
      square(c) { Faces.headShape(c, { rx: 6.8, ry: 7.8, jaw: 0.95 }); },
      long(c) { Faces.headShape(c, { rx: 5.9, ry: 8.6, jaw: 0.7 }); },
      gaunt(c) { Faces.headShape(c, { rx: 5.8, ry: 8.2, jaw: 0.6, hollow: true }); },
    },

    eyes: {
      normal(c) { Faces.eyePair(c, (x, y) => { c.px(x - 1, y, 'eye', 2); c.px(x, y, 'iris', 1); c.px(x + 1, y, 'eye', 1); c.px(x, y - 1, 'skin', 0); c.px(x - 1, y - 1, 'skin', 0); c.px(x + 1, y - 1, 'skin', 0); }); },
      narrow(c) { Faces.eyePair(c, (x, y) => { c.px(x - 1, y, 'ink', 1); c.px(x, y, 'iris', 2); c.px(x + 1, y, 'ink', 1); c.px(x, y - 1, 'skin', 0); c.px(x + 1, y - 1, 'skin', 0); }); },
      wide(c) { Faces.eyePair(c, (x, y) => { c.px(x - 1, y, 'eye', 2); c.px(x, y, 'iris', 1); c.px(x + 1, y, 'eye', 2); c.px(x, y + 1, 'eye', 1); c.px(x, y - 1, 'ink', 1); c.px(x - 1, y - 1, 'ink', 1); c.px(x + 1, y - 1, 'ink', 1); }); },
      closed(c) { Faces.eyePair(c, (x, y) => { c.line(x - 1, y, x + 1, y, 'ink', 1); c.px(x, y + 1, 'skin', 0); }); },
      cyber(c) {
        Faces.parts.eyes.normal(c);
        const { cx, eyeY } = Faces.F, x = Math.round(cx + 2.5);
        c.rect(x - 2, eyeY - 2, x + 2, eyeY + 1, 'metal', { flat: 1 }); c.px(x, eyeY, 'glow', 2); c.px(x + 1, eyeY, 'glow', 1); c.px(x - 2, eyeY - 2, 'metal', 2);
      },
    },

    brows: {
      flat(c) { Faces.eyePair(c, (x, y, sd) => c.line(x - 1, y - 2, x + 1, y - 2, 'hair', 0)); },
      stern(c) { Faces.eyePair(c, (x, y, sd) => { c.px(x - sd, y - 3, 'hair', 0); c.px(x, y - 2, 'hair', 0); c.px(x + sd, y - 2, 'hair', 0); }); },
      raised(c) { Faces.eyePair(c, (x, y, sd) => { c.px(x - 1, y - 2, 'hair', 0); c.px(x, y - 3, 'hair', 0); c.px(x + 1, y - 3, 'hair', 0); }); },
      heavy(c) { Faces.eyePair(c, (x, y, sd) => { c.line(x - 2, y - 2, x + 1, y - 2, 'hair', 0); c.px(x - sd, y - 3, 'hair', 0); }); },
      none() {},
    },

    nose: {
      straight(c) { const { cx, eyeY } = Faces.F, x = Math.round(cx); c.px(x + 1, eyeY + 1, 'skin', 0); c.px(x + 1, eyeY + 2, 'skin', 0); c.px(x + 1, eyeY + 3, 'skin', 0); c.px(x, eyeY + 4, 'skin', 0); c.px(x + 1, eyeY + 4, 'skin', 0); c.px(x - 1, eyeY + 3, 'skin', 2); },
      hooked(c) { const { cx, eyeY } = Faces.F, x = Math.round(cx); c.px(x + 1, eyeY + 1, 'skin', 0); c.px(x + 2, eyeY + 2, 'skin', 0); c.px(x + 2, eyeY + 3, 'skin', 0); c.px(x + 1, eyeY + 4, 'skin', 0); c.px(x, eyeY + 4, 'skin', 0); c.px(x, eyeY + 2, 'skin', 2); },
      broad(c) { const { cx, eyeY } = Faces.F, x = Math.round(cx); c.px(x + 1, eyeY + 2, 'skin', 0); c.line(x - 1, eyeY + 4, x + 2, eyeY + 4, 'skin', 0); c.px(x - 1, eyeY + 3, 'skin', 2); },
      none() {},
    },

    mouth: {
      neutral(c) { const { cx, eyeY } = Faces.F, x = Math.round(cx); c.line(x - 1, eyeY + 6, x + 2, eyeY + 6, 'lips', 0); c.px(x, eyeY + 7, 'skin', 2); },
      grim(c) { const { cx, eyeY } = Faces.F, x = Math.round(cx); c.line(x - 2, eyeY + 6, x + 2, eyeY + 6, 'ink', 1); c.px(x - 2, eyeY + 7, 'skin', 0); c.px(x + 2, eyeY + 7, 'skin', 0); },
      frown(c) { const { cx, eyeY } = Faces.F, x = Math.round(cx); c.line(x - 1, eyeY + 6, x + 1, eyeY + 6, 'lips', 0); c.px(x - 2, eyeY + 7, 'lips', 0); c.px(x + 2, eyeY + 7, 'lips', 0); },
      smirk(c) { const { cx, eyeY } = Faces.F, x = Math.round(cx); c.line(x - 1, eyeY + 6, x + 1, eyeY + 6, 'lips', 0); c.px(x + 2, eyeY + 5, 'lips', 0); c.px(x - 1, eyeY + 7, 'skin', 2); },
      snarl(c) { const { cx, eyeY } = Faces.F, x = Math.round(cx); c.line(x - 2, eyeY + 6, x + 2, eyeY + 6, 'ink', 1); c.px(x - 1, eyeY + 6, 'eye', 2); c.px(x + 1, eyeY + 6, 'eye', 2); },
    },

    // hair: back parts are drawn before the head (Faces.backHair), the rest here on top
    hair: {
      bald(c) { const { cx, top } = Faces.F; c.px(Math.round(cx) - 2, top + 1, 'skin', 2); c.px(Math.round(cx) - 1, top + 1, 'skin', 2); },
      short(c) { Faces.hairCap(c, 2.2); },
      crop(c) { Faces.hairCap(c, 1.4, { stubble: true }); },
      slick(c) { Faces.hairCap(c, 2.4); const { cx, top } = Faces.F; for (let x = cx - 5; x <= cx + 4; x += 2) c.line(x, top, x + 2, top + 2, 'hair', 2); },
      bun(c) {
        Faces.hairCap(c, 2.0);
        const { cx, top } = Faces.F;
        c.ellipse(cx, top - 2.5, 3.2, 2.8, 'hair');
        c.line(cx - 3, top - 1, cx + 3, top - 1, 'trim', 1);                                             // the pin
      },
      long(c) { Faces.hairCap(c, 2.4, { part: true }); },
      mohawk(c) {
        const { cx, top } = Faces.F;
        c.rows([[top - 3, Math.round(cx) - 1, Math.round(cx) + 1], [top - 2, Math.round(cx) - 1, Math.round(cx) + 1], [top - 1, Math.round(cx) - 2, Math.round(cx) + 2], [top, Math.round(cx) - 2, Math.round(cx) + 2], [top + 1, Math.round(cx) - 1, Math.round(cx) + 1]], 'hair');
      },
      braids(c) { Faces.hairCap(c, 2.2, { part: true }); },
    },

    beard: {
      none() {},
      stubble(c) { Faces.jaw(c, (x, y) => y >= Faces.F.eyeY + 6 && (x * 3 + y * 5) % 4 === 0 && c.px(x, y, 'hair', 1)); },
      full(c) { Faces.jaw(c, (x, y) => c.px(x, y, 'hair', y > Faces.F.chin - 2 ? 0 : 1)); Faces.parts.mouth.grim(c); },
      goatee(c) { const { cx, chin } = Faces.F; c.rect(Math.round(cx) - 1, chin - 3, Math.round(cx) + 1, chin, 'hair'); },
      moustache(c) { const { cx, eyeY } = Faces.F, x = Math.round(cx); c.line(x - 3, eyeY + 5, x + 3, eyeY + 5, 'hair', 1); c.px(x - 3, eyeY + 6, 'hair', 0); c.px(x + 3, eyeY + 6, 'hair', 0); },
    },

    headgear: {
      none() {},
      hood(c) {
        const { cx, cy, rx, ry, top } = Faces.F;
        for (let y = top - 4; y <= cy + ry + 2; y++) for (let x = 0; x < 32; x++) {
          const nx = (x + 0.5 - cx) / (rx + 3), ny = (y + 0.5 - (cy - 1)) / (ry + 4);
          const inside = nx * nx + ny * ny <= 1, face = ((x + 0.5 - cx) / (rx - 0.4)) ** 2 + ((y + 0.5 - (cy + 1.5)) / (ry - 0.6)) ** 2 <= 1;
          if (inside && !face) c.px(x, y, 'cloth', c.shadeAt(nx, ny));
        }
        for (let x = Math.round(cx - rx); x <= Math.round(cx + rx); x++) if (c.get(x, Math.round(top + 2)) && c.get(x, Math.round(top + 2)).m === 'skin') c.px(x, Math.round(top + 2), 'skin', 0); // shadow under the hood
      },
      cap(c) {
        const { cx, top } = Faces.F;
        c.rows([[top - 4, Math.round(cx) - 5, Math.round(cx) + 6], [top - 3, Math.round(cx) - 6, Math.round(cx) + 7], [top - 2, Math.round(cx) - 7, Math.round(cx) + 7], [top - 1, Math.round(cx) - 7, Math.round(cx) + 7]], 'cloth');
        c.rows([[top, Math.round(cx) - 8, Math.round(cx) + 8], [top + 1, Math.round(cx) - 6, Math.round(cx) + 7]], 'cloth', { flat: 0 });   // visor
        c.line(Math.round(cx) - 7, top - 1, Math.round(cx) + 7, top - 1, 'trim', 1);
        c.rect(Math.round(cx) - 1, top - 4, Math.round(cx) + 1, top - 2, 'trim', { flat: 2 });
      },
      helmet(c) {
        const { cx, cy, rx, top } = Faces.F;
        c.ellipse(cx, top + 2, rx + 1.6, 6, 'metal', { clip: (x, y) => y <= top + 3 });
        c.line(Math.round(cx - rx - 1), top + 3, Math.round(cx + rx + 1), top + 3, 'trim', 1);
        c.mirror((sd, mx) => c.rect(Math.min(mx(Math.round(cx - rx - 1)), mx(Math.round(cx - rx))), top + 3, Math.max(mx(Math.round(cx - rx - 1)), mx(Math.round(cx - rx))), cy + 4, 'metal'));
        c.line(Math.round(cx), top - 3, Math.round(cx), top + 2, 'metal', 2);
      },
      circlet(c) {
        const { cx, top } = Faces.F;
        c.line(Math.round(cx - 6), top + 3, Math.round(cx + 6), top + 3, 'trim', 1);
        c.px(Math.round(cx), top + 2, 'trim', 2); c.px(Math.round(cx), top + 3, 'glow', 2);
      },
      visor(c) {
        const { cx, rx, eyeY } = Faces.F;
        c.rect(Math.round(cx - rx - 0.5), eyeY - 1, Math.round(cx + rx + 0.5), eyeY + 1, 'metal', { flat: 0 });
        c.line(Math.round(cx - rx + 1), eyeY, Math.round(cx + rx - 1), eyeY, 'glow', 1);
        c.px(Math.round(cx - 2), eyeY, 'glow', 2); c.px(Math.round(cx + 3), eyeY, 'glow', 2);
      },
    },

    // extra details, any number of them
    marks: {
      scar(c) { const { cx, eyeY } = Faces.F, x = Math.round(cx) - 4; c.line(x, eyeY - 3, x + 2, eyeY + 3, 'scar', 1); },
      eyepatch(c) {
        const { cx, eyeY, top } = Faces.F, x = Math.round(cx) - 3;
        c.rect(x - 1, eyeY - 1, x + 1, eyeY + 1, 'ink', { flat: 1 });
        c.line(x + 1, eyeY - 1, Math.round(cx) + 6, top + 1, 'ink', 1);
      },
      bandage(c) {
        const { cx, rx, eyeY } = Faces.F;
        c.rect(Math.round(cx - rx), eyeY - 1, Math.round(cx + rx), eyeY + 1, 'cloth2', { flat: 2 });
        c.line(Math.round(cx - rx), eyeY + 1, Math.round(cx + rx), eyeY + 1, 'cloth2', 1);
        c.px(Math.round(cx) - 3, eyeY, 'blood', 1); c.px(Math.round(cx) + 3, eyeY, 'blood', 1);
      },
      thirdeye(c) { const { cx, top } = Faces.F, x = Math.round(cx); c.px(x, top + 3, 'glow', 2); c.px(x - 1, top + 3, 'glow', 0); c.px(x + 1, top + 3, 'glow', 0); c.px(x, top + 2, 'skin', 0); c.px(x, top + 4, 'skin', 0); },
      tattoo(c) {
        const { cx, eyeY } = Faces.F;
        c.mirror((sd, mx) => { const x = mx(Math.round(cx - 4.5)); c.px(x, eyeY + 2, 'glow', 0); c.px(x, eyeY + 3, 'glow', 0); c.px(x - sd, eyeY + 4, 'glow', 0); });
      },
      wrinkles(c) {
        const { cx, eyeY } = Faces.F;
        c.mirror((sd, mx) => { c.px(mx(Math.round(cx - 4)), eyeY + 1, 'skin', 0); c.px(mx(Math.round(cx - 2)), eyeY + 5, 'skin', 0); c.px(mx(Math.round(cx - 2)), eyeY + 6, 'skin', 0); });
        c.line(Math.round(cx) - 2, eyeY - 5, Math.round(cx) + 2, eyeY - 5, 'skin', 0);
      },
      cyberjaw(c) {
        const { cx, chin, rx } = Faces.F;
        c.rect(Math.round(cx + 1), chin - 4, Math.round(cx + rx - 0.5), chin - 1, 'metal');
        c.px(Math.round(cx + 3), chin - 3, 'glow', 1); c.px(Math.round(cx + 5), chin - 3, 'glow', 1);
      },
      monocle(c) { const { cx, eyeY } = Faces.F, x = Math.round(cx) + 3; c.px(x - 2, eyeY, 'trim', 1); c.px(x + 2, eyeY, 'trim', 1); c.px(x, eyeY - 2, 'trim', 2); c.px(x, eyeY + 2, 'trim', 0); c.line(x + 2, eyeY + 1, x + 4, eyeY + 8, 'trim', 0); },
      earring(c) { const { cx, rx, eyeY } = Faces.F; c.px(Math.round(cx + rx + 0.5), eyeY + 4, 'trim', 2); c.px(Math.round(cx + rx + 0.5), eyeY + 5, 'trim', 1); },
      visor(c) { Faces.parts.headgear.visor(c); },                                                      // a visor under a hood or cap
      freckles(c) { const { cx, eyeY } = Faces.F; for (const [dx, dy] of [[-3, 2], [-4, 3], [-2, 3], [3, 2], [4, 3], [2, 3]]) c.px(Math.round(cx) + dx, eyeY + dy, 'skin', 0); },
    },
  },

  // ---- shared shapes ----
  headShape(c, o) {
    const F = this.F;
    F.rx = o.rx; F.ry = o.ry; F.cx = 15.5; F.cy = 13.5;
    F.top = Math.round(F.cy - F.ry) + 1; F.chin = Math.round(F.cy + F.ry); F.eyeY = Math.round(F.cy - 0.5);
    c.rect(13, F.chin - 3, 18, 24, 'skin', { flat: 0 });                                            // neck
    c.rect(14, F.chin - 3, 15, 24, 'skin', { flat: 1 });
    c.mirror((sd, mx) => c.ellipse(mx(Math.round(F.cx - F.rx)) + 0.5, F.eyeY + 1.5, 1.4, 2.2, 'skin')); // ears
    // the face: an ellipse whose lower half narrows toward the jaw
    for (let y = Math.floor(F.cy - F.ry); y <= Math.ceil(F.cy + F.ry); y++) for (let x = 0; x < 32; x++) {
      const ny = (y + 0.5 - F.cy) / F.ry, w = ny > 0.15 ? F.rx * (1 - (1 - o.jaw) * ((ny - 0.15) / 0.85)) : F.rx;
      const nx = (x + 0.5 - F.cx) / w;
      if (nx * nx + ny * ny > 1) continue;
      let s = this.shadeAt(nx, ny);
      if (o.hollow && Math.abs(nx) > 0.45 && ny > 0.1 && ny < 0.5) s = 0;                              // hollow cheeks
      c.px(x, y, 'skin', s);
    }
    for (let y = F.eyeY + 1; y <= F.eyeY + 4; y++) c.px(Math.round(F.cx + F.rx) - 1, y, 'skin', 0);  // shadow side of the face
  },
  eyePair(c, f) {
    const { cx, eyeY } = this.F;
    f(Math.round(cx - 2.5), eyeY, -1);
    f(Math.round(cx + 2.5), eyeY, 1);
  },
  hairCap(c, depth, o = {}) {
    const { cx, cy, rx, ry, top } = this.F;
    for (let y = top - 2; y <= top + depth + 1; y++) for (let x = 0; x < 32; x++) {
      const nx = (x + 0.5 - cx) / (rx + 0.9), ny = (y + 0.5 - (cy - 0.5)) / (ry + 0.9);
      if (nx * nx + ny * ny > 1) continue;
      const edge = top + depth - Math.abs(nx) * 1.5 + (Math.abs(nx) > 0.8 ? 3 : 0);                    // sideburns
      if (y > edge) continue;
      c.px(x, y, 'hair', o.stubble ? ((x + y) % 2 ? 0 : 1) : this.shadeAt(nx, ny * 1.6));
    }
    if (o.part) c.line(Math.round(cx) - 1, top - 1, Math.round(cx) - 2, top + 2, 'hair', 0);
  },
  // drawn behind the head: long hair and braids hang down to the shoulders
  backHair(c, style) {
    const { cx, top } = this.F;
    if (style === 'long') c.rows(Array.from({ length: 16 }, (_, i) => [top + 2 + i, Math.round(cx - 8.5 + Math.min(i, 4) * 0), Math.round(cx + 8.5)]), 'hair');
    if (style === 'braids') this.mirror((sd, mx) => { for (let y = top + 6; y < top + 20; y++) c.px(mx(Math.round(cx - 7.5)), y, 'hair', y % 2 ? 0 : 1), c.px(mx(Math.round(cx - 6.5)), y, 'hair', y % 2 ? 1 : 2); });
  },
  jaw(c, f) {
    const { cx, cy, rx, ry, eyeY, chin } = this.F;
    for (let y = eyeY + 4; y <= chin; y++) for (let x = 0; x < 32; x++) {
      const cell = c.get(x, y);
      if (!cell || cell.m !== 'skin') continue;
      const ny = (y + 0.5 - cy) / ry, nx = (x + 0.5 - cx) / rx;
      if (Math.abs(nx) < 0.3 && y < eyeY + 7) continue;                                                // keep the upper lip clear
      if (y >= eyeY + 4) f(x, y);
    }
  },

  // ---- colours ----
  // Three tones per material from one colour: shadow (darker, cooler), base, highlight (lighter, warmer).
  hex(c) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); },
  toHex(rgb) { return '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); },
  tones(base) {
    const [r, g, b] = this.hex(base);
    return [this.toHex([r * 0.58, g * 0.6, b * 0.68]), base, this.toHex([r + (255 - r) * 0.3 + 6, g + (255 - g) * 0.27 + 3, b + (255 - b) * 0.2])];
  },
  palette(colors) {
    const c = Object.assign({ skin: '#c89a78', hair: '#3a2a20', iris: '#5a7090', cloth: '#3a3a44', cloth2: '#8a8070', trim: '#c8a040', metal: '#5c5c66', glow: '#50e0f0', bg: '#2a2026' }, colors);
    const pal = {};
    for (const k of Object.keys(c)) pal[k] = this.tones(c[k]);
    const sk = this.hex(c.skin);
    pal.skin[0] = this.toHex([sk[0] * 0.76, sk[1] * 0.6, sk[2] * 0.56]);                                // warm shadows, not grey
    pal.lips = this.tones(this.toHex([sk[0] * 0.8, sk[1] * 0.55, sk[2] * 0.55]));
    pal.eye = ['#a8a090', '#d8d0c0', '#f0ece0'];
    pal.ink = ['#120c0a', '#1c1412', '#2a201c'];
    pal.scar = this.tones(this.toHex([sk[0] * 0.75 + 40, sk[1] * 0.6, sk[2] * 0.6]));
    pal.blood = ['#4a0a0a', '#7a1414', '#a02020'];
    return pal;
  },

  // ---- drawing a face ----
  order: ['bg', 'outfit', 'head', 'eyes', 'brows', 'nose', 'mouth', 'beard', 'hair', 'headgear'],
  render(spec) {
    const key = JSON.stringify(spec);
    if (this.cache[key]) return this.cache[key];
    this.begin();
    const P = this.parts, call = (slot, name) => { const f = P[slot][name] || P[slot][Object.keys(P[slot])[0]]; f(this); };
    call('bg', spec.bg || 'plain');
    call('outfit', spec.outfit || 'uniform');
    // the head sets the face frame; long hair hangs behind it
    const saved = this.grid.map((r) => r.slice());
    call('head', spec.head || 'oval');
    if (spec.hair === 'long' || spec.hair === 'braids') { this.grid = saved; this.backHair(this, spec.hair); call('head', spec.head || 'oval'); }
    call('outfit', spec.outfit || 'uniform');                                                           // the collar sits over the neck
    for (const slot of ['eyes', 'brows', 'nose', 'mouth', 'beard', 'hair']) call(slot, spec[slot] || Object.keys(P[slot])[0]);
    for (const m of spec.marks || []) if (P.marks[m]) P.marks[m](this);
    call('headgear', spec.headgear || 'none');
    for (const m of spec.marks || []) if (['eyepatch', 'monocle'].includes(m)) P.marks[m](this);        // worn over a hood or visor
    return (this.cache[key] = this.paint(this.palette(spec.colors || {})));
  },
  // Paint the grid, with a dark outline where the figure meets the background.
  paint(pal) {
    const c = document.createElement('canvas'); c.width = this.W; c.height = this.H;
    const ctx = c.getContext('2d'), G = this.grid, outline = '#0a0807';
    const isBg = (x, y) => { const g = this.get(x, y); return !g || g.m === 'bg' || (g.m === 'glow' && this.bgStar(x, y)); };
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      const g = G[y][x];
      if (!g) continue;
      let col = (pal[g.m] || pal.cloth)[g.s];
      if (g.m === 'bg' && (!isBg(x - 1, y) || !isBg(x + 1, y) || !isBg(x, y - 1) || !isBg(x, y + 1))) col = outline;
      ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
    }
    return c.toDataURL();
  },
  bgStar() { return false; },
};
