// Voyager — pixel art: procedural planets, stars and building icons; ship sprites recoloured from grey templates.
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

  // ---------- ship sprites: grey templates (js/shipsprites.js) recoloured on the fly ----------
  shipTpl: {},          // type -> ImageData of the template, once decoded
  shipCache: {},        // 'type|palette' -> data URL of the coloured sprite
  shipKey: {},          // template grey level -> [material, shade]
  shipKeyPoint: { hull: 5, metal: 3, accent: 3, glass: 4, glow: 0, halo: 0, void: 0, outline: 0 }, // where the base colour sits in each ramp
  shipDefaults: { void: '#050404', outline: '#0a0807' },

  loadShipTemplates() {
    if (typeof ShipSprites === 'undefined') return;
    for (const [g, v] of Object.entries(ShipSprites.greys)) this.shipKey[+g] = v;
    for (const [type, uri] of Object.entries(ShipSprites.images)) {
      const img = new Image();
      img.onload = () => {
        const c = this.canvas(img.width, img.height), ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        this.shipTpl[type] = ctx.getImageData(0, 0, img.width, img.height);
        // once every template is in, redraw whatever shows grey placeholders
        if (Object.keys(this.shipTpl).length === Object.keys(ShipSprites.images).length && typeof G !== 'undefined' && G && typeof UI !== 'undefined') UI.render();
      };
      img.src = uri;
    }
  },

  hexRgb(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); },
  // Shades for one material from a base colour: darker toward black below it, lighter toward white above.
  ramp(mat, base, n) {
    if (Array.isArray(base)) return base.map((h) => this.hexRgb(h));
    const c = this.hexRgb(base), k = Math.min(n - 1, this.shipKeyPoint[mat] || 0), out = [];
    for (let i = 0; i < n; i++) {
      let t, to;
      if (mat === 'halo') { t = i * 0.45; to = [40, 8, 4]; }                 // inner glow, then a darker outer ring
      else if (i < k) { t = (k - i) / k * 0.88; to = [0, 0, 0]; }
      else if (i > k) { t = (i - k) / Math.max(1, n - 1 - k) * 0.45; to = [255, 255, 255]; }
      else { t = 0; to = c; }
      out.push(c.map((v, j) => Math.round(v + (to[j] - v) * t)));
    }
    return out;
  },
  shipRamps(pal) {
    const out = {};
    for (const [mat, n] of Object.entries(ShipSprites.ramps)) out[mat] = this.ramp(mat, pal[mat] || this.shipDefaults[mat] || '#808080', n);
    return out;
  },
  shipPaletteKey(type, owner) {
    if (DATA.shipTypes[type] && DATA.shipTypes[type].monster) return 'monster';
    return DATA.shipPalettes[owner] ? owner : 'player';
  },
  // How many designs a ship type has (1 if it has no variants).
  shipVariants(type) { return (typeof ShipSprites !== 'undefined' && ShipSprites.variants && ShipSprites.variants[type]) || 1; },
  // Template name of a design: 'scout' (design 0), 'scout_2', 'scout_3'.
  shipTplName(type, variant = 0) {
    const n = variant > 0 ? `${type}_${variant + 1}` : type;
    return typeof ShipSprites !== 'undefined' && ShipSprites.images[n] ? n : type;
  },
  // The sprite of a ship type (and design variant) for an owner (faction) or an explicit palette object.
  shipImg(type, owner = 'player', variant = 0) {
    const name = this.shipTplName(type, variant || 0);
    const palKey = typeof owner === 'object' ? JSON.stringify(owner) : this.shipPaletteKey(type, owner);
    const key = name + '|' + palKey;
    if (this.shipCache[key]) return this.shipCache[key];
    const tpl = this.shipTpl[name];
    if (!tpl) return (typeof ShipSprites !== 'undefined' && ShipSprites.images[name]) || ''; // grey until decoded
    const ramps = this.shipRamps(typeof owner === 'object' ? owner : DATA.shipPalettes[palKey]);
    const c = this.canvas(tpl.width, tpl.height), ctx = c.getContext('2d');
    const img = ctx.createImageData(tpl.width, tpl.height), src = tpl.data, dst = img.data;
    for (let i = 0; i < src.length; i += 4) {
      if (!src[i + 3]) continue;
      const m = this.shipKey[src[i]];
      const col = m ? ramps[m[0]][m[1]] : [src[i], src[i + 1], src[i + 2]];
      dst[i] = col[0]; dst[i + 1] = col[1]; dst[i + 2] = col[2]; dst[i + 3] = src[i + 3];
    }
    ctx.putImageData(img, 0, 0);
    return (this.shipCache[key] = c.toDataURL());
  },
  // Your own fleet colours (Settings), kept in this browser.
  colorsKey: 'voyager_shipcolors',
  playerDefaults: null,
  loadPlayerColors() {
    this.playerDefaults = Object.assign({}, DATA.shipPalettes.player);
    try { const c = JSON.parse(localStorage.getItem(this.colorsKey) || 'null'); if (c) this.setShipPalette('player', c); } catch (e) { /* ignore */ }
  },
  setPlayerColor(mat, hex) {
    this.setShipPalette('player', { [mat]: hex });
    try { localStorage.setItem(this.colorsKey, JSON.stringify(DATA.shipPalettes.player)); } catch (e) { /* ignore */ }
  },
  resetPlayerColors() {
    DATA.shipPalettes.player = Object.assign({}, this.playerDefaults);
    this.setShipPalette('player', {});
    try { localStorage.removeItem(this.colorsKey); } catch (e) { /* ignore */ }
  },

  // Change a faction's colours at runtime (e.g. from Settings); every sprite of it is repainted.
  setShipPalette(key, pal) {
    DATA.shipPalettes[key] = Object.assign({}, DATA.shipPalettes[key], pal);
    for (const k of Object.keys(this.shipCache)) if (k.endsWith('|' + key)) delete this.shipCache[k];
  },

  // 12×12 building icons. k outline, = light metal, # dark metal, o ember, y light, w glint, b glass, g bio, p rare, r blood.
  buildingArt: {
    mine: ['.....kk.....', '....k==k....', '....k==k....', '...k====k...', '...k#==#k...', '..k##==##k..', '..k#.==.#k..', '.k#..==..#k.', '.k#..oo..#k.', 'kkkkkookkkkk', '#=#=#oo=#=#=', '############'],
    drill: ['...kkkkkk...', '...k====k...', '...k====k...', '....k==k....', '....k==k....', '.....kk.....', '.....==.....', '.kk..==..kk.', 'kpk..==..kpk', 'kppk.oo.kppk', 'kpppkookpppk', '############'],
    harvester: ['....kkkk....', '..kkbbbbkk..', '.kb..gg..bk.', '.kb.g..g.bk.', 'kb...gg...bk', 'kb.gggggg.bk', 'kb..g.g.g.bk', 'kbgggggggbbk', 'kkkkkkkkkkkk', 'k=#=#=#=#=#k', 'k##########k', '............'],
    skimmer: ['.k........k.', '.k=kkkkkk=k.', '..k======k..', '...k#==#k...', '....k##k....', '.....==.....', '.....==.....', '....o==o....', '.....oo.....', 'bbbbbbbbbbbb', 'gbbbbggbbbbg', 'bbggbbbbggbb'],
    refinery: ['.kk.........', '.k=k........', '.k=k....kk..', '.k=k...k=k..', 'kk=kkkkk==k.', 'k=====k===k.', 'k=y=y=k=y=k.', 'k=====k===k.', 'k#y#y#k#y#k.', 'k#########k.', 'kkkkkkkkkkk.', '............'],
    chemplant: ['...kkk......', '..k===k.kkk.', '..k=g=k.k=k.', '..kgggk.k=k.', '..kgggk.k=k.', '..kgggk.kgk.', '..k===k.kgk.', '..kk=kkkkkk.', '...k=====k..', '...k#####k..', '.kkkkkkkkkk.', '............'],
    fusion: ['....kkkk....', '..kk====kk..', '.k==yyyy==k.', '.k=yywwyy=k.', 'k=yywwwwyy=k', 'k=yywwwwyy=k', '.k=yywwyy=k.', '.k==yyyy==k.', '..kk====kk..', '...k#kk#k...', '..kk#kk#kk..', '.kkkkkkkkkk.'],
    solar: ['............', 'kkkkk..kkkkk', 'kbwbk..kbwbk', 'kbbbkkkkbbbk', 'kbbbk==kbbbk', 'kbbbkkkkbbbk', 'kbbbk..kbbbk', 'kkkkk..kkkkk', '.....kk.....', '....kook....', '.....kk.....', '............'],
    dome: ['............', '....kkkk....', '..kkbwbbkk..', '.kbwbbbbbbk.', '.kbbbbbbbbk.', 'kbbbyb#ybbbk', 'kbby##y#ybbk', 'kkkkkkkkkkkk', 'k=#=#=#=#=#k', 'kkkkkkkkkkkk', '............', '............'],
    ring: ['...kkkkkk...', '..k=y==y=k..', '.k=kkkkkk=k.', 'k=k......k=k', 'ky=..kk..=yk', 'k=..k==k..=k', 'k=..k==k..=k', 'ky=..kk..=yk', 'k=k......k=k', '.k=kkkkkk=k.', '..k=y==y=k..', '...kkkkkk...'],
    cogitator: ['kkkkkkkkkkkk', 'k==========k', 'k=g=b======k', 'kkkkkkkkkkkk', 'k==========k', 'k=b=g=g====k', 'kkkkkkkkkkkk', 'k==========k', 'k=g=b======k', 'kkkkkkkkkkkk', '.k#......#k.', '............'],
    lab: ['....kkkk....', '.....kk.....', '.....k=k....', '.....k=k....', '....k==pk...', '...kpppppk..', '..kpppwpppk.', '..kppppwppk.', '.kpppppppppk', '.kpppppppppk', '..kkkkkkkkk.', '............'],
    shipyard: ['k..........k', 'k=kkkkkkkk=k', 'k=........=k', 'k=..kkk...=k', 'k=.k=o=kk.=k', 'k=k=====wk=k', 'k=.k===kk.=k', 'k=..kkk...=k', 'k=........=k', 'k=kkkkkkkk=k', 'k..........k', '............'],
    bastion: ['.k.k.k.k.k..', '.kkkkkkkkk..', '.k=======k..', '.k=kk=kk=k..', '.k=======k..', '.k==rrr==k..', '.k=r###r=k..', '.k=r###r=k..', 'kk=======kk.', 'k#########k.', 'kkkkkkkkkkk.', '............'],
    platform: ['............', '........kk..', '.......kwk..', '......k=k...', '...kkk=k....', '..k===kk....', '.k=rr===k...', '.k=rr====kkk', '..k========k', '...kkkkkkkk.', '....k....k..', '............'],
  },
  buildingPal: { k: '#14100c', '=': '#9a8c78', '#': '#4e443a', o: '#e07030', y: '#f0d060', w: '#f4ecd8', b: '#4f8fb8', g: '#6f9a3c', p: '#9a6cc8', r: '#b03030' },

  building(key) {
    const k = 'b:' + key;
    if (this.cache[k]) return this.cache[k];
    const art = this.buildingArt[key];
    const c = this.canvas(12, 12), ctx = c.getContext('2d');
    if (art) art.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      ctx.fillStyle = this.buildingPal[ch] || '#ff00ff';
      ctx.fillRect(x, y, 1, 1);
    }));
    return (this.cache[k] = c.toDataURL());
  },

};

Sprites.loadShipTemplates();
Sprites.loadPlayerColors();
