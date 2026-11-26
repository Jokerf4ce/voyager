// Voyager — procedural placeholder pixel art (planets, portraits, ships).
// Real hand-drawn sprites can replace these later: anything here returns an image URL.

const Sprites = {
  cache: {},

  seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  },

  bayer: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]],

  canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },

  // p = planet object (comp/size/temp). Size in pixels comes from the planet's size class unless px is given.
  planet(p, seedKey, px) {
    const type = Planets.classKey(p), size = px || DATA.planetSizes[p.size].sprite;
    const key = `p:${type}:${size}:${seedKey}`;
    if (this.cache[key]) return this.cache[key];
    const pal = Planets.cls(p).palette;
    const rnd = this.seeded(key);
    const c = this.canvas(size, size), ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const r = size / 2 - 1;
    // coarse noise grid for continents/bands
    const g = 6, grid = [];
    for (let i = 0; i < g * g; i++) grid.push(rnd());
    const noise = (x, y) => {
      const gx = (x / size) * (g - 1), gy = (y / size) * (g - 1);
      const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      const v = (i, j) => grid[Math.min(g - 1, j) * g + Math.min(g - 1, i)];
      return (v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx) * (1 - fy) + (v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx) * fy;
    };
    const banded = p.comp === 'gas';
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - size / 2) / r, dy = (y + 0.5 - size / 2) / r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const z = Math.sqrt(1 - d2);
      let light = (-dx * 0.55 - dy * 0.45 + z * 0.7);
      const n = banded ? (Math.sin(dy * 9 + noise(x, y) * 3) * 0.5 + 0.5) : noise(x, y);
      let v = light * 0.75 + n * 0.45 - 0.1;
      v += (this.bayer[y % 4][x % 4] / 16 - 0.5) * 0.25;
      let idx = Math.max(0, Math.min(3, Math.floor(v * 4)));
      if (d2 > 0.86) idx = Math.max(0, idx - 1);
      const col = pal[idx];
      const o = (y * size + x) * 4;
      img.data[o] = parseInt(col.slice(1, 3), 16);
      img.data[o + 1] = parseInt(col.slice(3, 5), 16);
      img.data[o + 2] = parseInt(col.slice(5, 7), 16);
      img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.cache['cv:' + key] = c;
    return (this.cache[key] = c.toDataURL());
  },

  planetCanvas(p, seedKey, px) {
    const size = px || DATA.planetSizes[p.size].sprite;
    this.planet(p, seedKey, size);
    return this.cache[`cv:p:${Planets.classKey(p)}:${size}:${seedKey}`];
  },

  mix(hex, to, t) {
    const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
  },

  // Star portraits, in the same dithered pixel style as the planets. 32×32, transparent background.
  // Normal stars: a glowing disc with granulation and limb darkening, sized by class.
  // White dwarf: a tiny hot point. Pulsar: a point with two beams. Black hole: dark disc and accretion disc.
  star(cls, seedKey) {
    const key = `st:${cls}:${seedKey}`;
    if (this.cache[key]) return this.cache[key];
    const st = DATA.starClasses[cls];
    const S = 32, c = S / 2;
    const cv = this.canvas(S, S), ctx = cv.getContext('2d');
    const rnd = this.seeded(key);
    const px = (x, y, col, alpha = 1) => { if (x < 0 || y < 0 || x >= S || y >= S) return; ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = 1; };
    const dith = (x, y) => this.bayer[((y % 4) + 4) % 4][((x % 4) + 4) % 4] / 16;
    const glow = (r0, r1, col, strength) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
        if (d <= r0 || d > r1) continue;
        const k = 1 - (d - r0) / (r1 - r0);
        if (dith(x, y) < k * strength) px(x, y, col, 0.35 + 0.5 * k);
      }
    };

    if (st.kind === 'blackhole') {
      const hot = '#fff0c0', warm = st.color, cool = '#a03818';
      const disc = (front) => {
        for (let y = -14; y <= 14; y++) for (let x = -15; x <= 15; x++) {
          const d = Math.hypot(x, y / 0.32);
          if (d < 6 || d > 15 || (y > 0) !== front) continue;
          const t = (d - 6) / 9;
          if (dith(x + 64, y + 64) > 1.15 - t) continue;
          px(c + x, c + y, t < 0.25 ? hot : t < 0.6 ? warm : cool);
        }
      };
      disc(false);
      for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
        const d = Math.hypot(x, y);
        if (d <= 5) px(c + x, c + y, '#000000');
        else if (d <= 6.2) px(c + x, c + y, hot);
      }
      disc(true);
    } else if (st.kind === 'pulsar') {
      const ang = -0.8 + rnd() * 0.3;
      for (const dir of [1, -1]) for (let r = 2; r < 22; r++) {
        const spread = r * 0.18;
        for (let w = -spread; w <= spread; w += 0.7) {
          const x = Math.round(c + dir * (Math.cos(ang) * r - Math.sin(ang) * w)), y = Math.round(c + dir * (Math.sin(ang) * r + Math.cos(ang) * w));
          const fade = 1 - r / 22 - Math.abs(w) / (spread + 1) * 0.5;
          if (dith(x, y) < fade) px(x, y, st.color, 0.6);
        }
      }
      glow(1.5, 6, st.color, 0.9);
      for (const [x, y] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) px(c - 1 + x, c - 1 + y, x || y ? st.color : '#ffffff');
    } else {
      // radius by class; the hypergiant fills the whole frame
      const R = { O: 13, B: 12, A: 11, F: 10, G: 10, K: 9, M: 7, H: 15.5, D: 3 }[cls] || 9;
      const shades = [this.mix(st.color, '#000000', 0.5), this.mix(st.color, '#000000', 0.22), st.color, this.mix(st.color, '#ffffff', 0.45)];
      glow(R, Math.min(15.5, R + (cls === 'D' ? 6 : 4)), st.color, cls === 'D' ? 1 : 0.8);
      // coarse noise for convection cells and starspots
      const g = 7, grid = [];
      for (let i = 0; i < g * g; i++) grid.push(rnd());
      const noise = (x, y) => {
        const gx = (x / S) * (g - 1), gy = (y / S) * (g - 1), x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
        const v = (i, j) => grid[Math.min(g - 1, j) * g + Math.min(g - 1, i)];
        return (v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx) * (1 - fy) + (v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx) * fy;
      };
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
        if (d > R) continue;
        const limb = Math.sqrt(Math.max(0, 1 - (d / R) * (d / R)));  // darker towards the edge
        let v = limb * 0.75 + noise(x, y) * (cls === 'D' ? 0.1 : 0.45) - 0.05 + (dith(x, y) - 0.5) * 0.25;
        if (cls === 'D') v += 0.35;
        px(x, y, shades[Math.max(0, Math.min(3, Math.floor(v * 4)))]);
      }
    }
    return (this.cache[key] = cv.toDataURL());
  },

  // Symmetric masked faces: leaders and relics.
  portrait(id, rarity, kind) {
    const key = `f:${id}`;
    if (this.cache[key]) return this.cache[key];
    const rnd = this.seeded(id);
    const W = 16, H = 16;
    const c = this.canvas(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = '#0c0b0a'; ctx.fillRect(0, 0, W, H);
    const accent = DATA.rarities[rarity].color;
    if (kind === 'blueprint') {
      ctx.fillStyle = '#16222c'; ctx.fillRect(1, 1, W - 2, H - 2);
      ctx.fillStyle = accent;
      for (let i = 2; i < W - 2; i += 3) { ctx.fillRect(i, 2, 1, H - 4); }
      this.drawShip(ctx, id === 'bp_dread' ? 'dread' : 'lancer', 2, 4, '#c8d8e0');
      return (this.cache[key] = c.toDataURL());
    }
    const bone = kind === 'relic' ? ['#3a2a1a', '#6a5030', '#a08050'] : ['#3a3430', '#7a6e60', '#c8bca0'];
    for (let y = 2; y < H - 1; y++) for (let x = 0; x < W / 2; x++) {
      const cx = x, cy = Math.abs(y - H / 2 - 1);
      const p = 1.05 - cx * 0.1 - cy * 0.06 - (x > 5 && y > 11 ? 0.5 : 0);
      if (rnd() < p) {
        const shade = bone[Math.min(2, Math.floor(rnd() * 2 + (y < H / 2 ? 1 : 0)))];
        ctx.fillStyle = shade;
        ctx.fillRect(W / 2 - 1 - x, y, 1, 1);
        ctx.fillRect(W / 2 + x, y, 1, 1);
      }
    }
    // hood / helmet shadow
    ctx.fillStyle = '#0c0b0a';
    for (let x = 0; x < W; x++) if (rnd() < 0.5) ctx.fillRect(x, 2, 1, 1);
    // eyes
    const ey = 6 + Math.floor(rnd() * 3), ex = 2 + Math.floor(rnd() * 2);
    ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - ex - 2, ey, 2, 2); ctx.fillRect(W / 2 + ex, ey, 2, 2);
    ctx.fillStyle = accent; ctx.fillRect(W / 2 - ex - 1, ey, 1, 1); ctx.fillRect(W / 2 + ex, ey, 1, 1);
    // mouth grille
    ctx.fillStyle = '#1a1614';
    for (let x = W / 2 - 2; x < W / 2 + 2; x++) if (x % 2 === 0) ctx.fillRect(x, ey + 4, 1, 2);
    return (this.cache[key] = c.toDataURL());
  },

  shipArt: {
    scout:    ['....#....', '...###...', '..#.+.#..', '....o....'],
    ark:      ['..#####..', '.#+++++#.', '#########', '.#+++++#.', '..o.o.o..'],
    corvette: ['....#....', '...#+#...', '..#####..', '.#.#.#.#.', '...o.o...'],
    frigate:  ['....#....', '...###...', '.#######.', '##+###+##', '.#######.', '..o...o..'],
    lancer:   ['....#....', '....#....', '...#+#...', '..#####..', '.##.#.##.', '..o...o..'],
    dread:    ['...###...', '..#+#+#..', '.#######.', '#########', '##+###+##', '.#######.', '.o.o.o.o.'],
    lurker:   ['.#.....#.', '..#...#..', '.#######.', '##+...+##', '.#######.', '#.#.#.#.#'],
  },

  drawShip(ctx, type, ox, oy, color) {
    const art = this.shipArt[type];
    art.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = ch === '#' ? color : ch === '+' ? '#f0e0a0' : '#e07030';
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }));
  },

  ship(type, color) {
    const key = `s:${type}:${color}`;
    if (this.cache[key]) return this.cache[key];
    const c = this.canvas(11, 9), ctx = c.getContext('2d');
    this.drawShip(ctx, type, 1, 1, color);
    return (this.cache[key] = c.toDataURL());
  },
};
