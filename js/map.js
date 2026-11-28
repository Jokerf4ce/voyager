// Voyager — the star map: a camera over an endless galaxy.
// The scene is pixel art, drawn into a small buffer (PX screen pixels per art pixel) and scaled up crisp;
// names and markers are drawn on top at full resolution so they stay readable at any zoom.
// Drag to pan, wheel or pinch to zoom, click to select; a minimap sits in the corner.

const StarMap = {
  PX: 3,                       // CSS pixels per art pixel (the chunky look)
  zoomMin: 0.35, zoomMax: 2.6,
  bg: {},                      // cached backgrounds for the solar system map
  tiles: {},                   // cached starfield tiles for the galaxy map
  cam: null,                   // { x, y, z }: world point at the centre, art pixels per world unit
  view: null,                  // last drawn view: sizes and offsets, for hit tests

  // ---------- camera ----------
  camera() {
    if (!this.cam || this.camFor !== G) { // a new game, a load or a slot switch brings its own camera
      this.camFor = G;
      const saved = G && G.mapCam;
      const h = G && G.systems[G.homeId];
      this.cam = saved ? Object.assign({}, saved) : { x: h ? h.x : 0, y: h ? h.y : 0, z: 1 };
    }
    return this.cam;
  },
  remember() { if (G) G.mapCam = Object.assign({}, this.cam); },
  centerOn(s, z) { const c = this.camera(); c.x = s.x; c.y = s.y; if (z) c.z = z; this.remember(); },
  zoomBy(f, sx, sy) {
    // zoom around a screen point (CSS px inside the canvas), keeping the world point under it in place
    const c = this.camera(), v = this.view;
    const nz = Math.max(this.zoomMin, Math.min(this.zoomMax, c.z * f));
    if (v && sx != null) {
      const w = this.toWorld(sx, sy);
      c.z = nz;
      const w2 = this.toWorld(sx, sy);
      c.x += w.x - w2.x; c.y += w.y - w2.y;
    } else c.z = nz;
    this.remember();
  },
  // CSS px inside the canvas <-> world units
  toWorld(sx, sy) {
    const c = this.camera(), v = this.view;
    return { x: c.x + (sx / this.PX - v.lw / 2) / c.z, y: c.y + (sy / this.PX - v.lh / 2) / c.z };
  },
  // world -> art pixel in the low-res buffer
  pos(s) {
    const c = this.camera(), v = this.view;
    return { x: Math.round((s.x - c.x) * c.z + v.lw / 2), y: Math.round((s.y - c.y) * c.z + v.lh / 2) };
  },

  // ---------- backgrounds ----------
  // Starfield background for the solar system map (fixed size).
  background(W, H) {
    const key = W + 'x' + H;
    if (this.bg[key]) return this.bg[key];
    const c = Sprites.canvas(W, H), ctx = c.getContext('2d');
    const rnd = Sprites.seeded('voyager-bg');
    ctx.fillStyle = '#070606'; ctx.fillRect(0, 0, W, H);
    const blobs = [[0.7, 0.3, 90, '#1a0d14'], [0.25, 0.75, 110, '#0d1214'], [0.55, 0.8, 70, '#14100a']];
    for (const [bx, by, br, col] of blobs) {
      ctx.fillStyle = col;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - bx * W, y - by * H) / br;
        if (d < 1 && Sprites.bayer[y % 4][x % 4] / 16 > d * 1.1) ctx.fillRect(x, y, 1, 1);
      }
    }
    for (let i = 0; i < 260; i++) {
      const v = rnd();
      ctx.fillStyle = v > 0.97 ? '#e8e0d0' : v > 0.85 ? '#807870' : '#3a3632';
      ctx.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 1, 1);
    }
    return (this.bg[key] = c);
  },
  // An endless starfield: 128 px tiles, each seeded by its position. The nebulae come from a value-noise field
  // over the whole plane (lattice values hashed from their coordinates), so neighbouring tiles join seamlessly.
  hash(ix, iy, k) {
    let h = (ix * 374761393 + iy * 668265263 + k * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  },
  noise(x, y, k) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = this.hash(ix, iy, k), b = this.hash(ix + 1, iy, k), c = this.hash(ix, iy + 1, k), d = this.hash(ix + 1, iy + 1, k);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  },
  tile(tx, ty) {
    const key = tx + ',' + ty;
    if (this.tiles[key]) return this.tiles[key];
    const T = 128, c = Sprites.canvas(T, T), ctx = c.getContext('2d');
    const rnd = Sprites.seeded('voyager-tile-' + key);
    const layers = [['#1a0d14', 1, 150], ['#0d1214', 2, 190], ['#14100a', 3, 120]]; // colour, noise seed, scale in px
    for (const [col, k, sc] of layers) {
      ctx.fillStyle = col;
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const wx = tx * T + x, wy = ty * T + y;
        const n = this.noise(wx / sc, wy / sc, k) * 0.7 + this.noise(wx / sc * 2.3, wy / sc * 2.3, k + 7) * 0.3;
        const dens = Math.min(0.55, (n - 0.6) * 2.2); // only the peaks of the field become thin nebula
        if (dens > 0 && Sprites.bayer[y % 4][x % 4] / 16 < dens) ctx.fillRect(x, y, 1, 1);
      }
    }
    for (let i = 0; i < 55; i++) {
      const v = rnd();
      ctx.fillStyle = v > 0.97 ? '#e8e0d0' : v > 0.85 ? '#807870' : '#3a3632';
      ctx.fillRect(Math.floor(rnd() * T), Math.floor(rnd() * T), 1, 1);
    }
    if (Object.keys(this.tiles).length > 400) this.tiles = {};
    return (this.tiles[key] = c);
  },

  // ---------- pixel drawing helpers (art pixels) ----------
  line(ctx, a, b, color, dotted) {
    let x0 = a.x, y0 = a.y; const x1 = b.x, y1 = b.y;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, i = 0;
    ctx.fillStyle = color;
    for (let guard = 0; guard < 4000; guard++) {
      if (!dotted || (i++ % 3) !== 0) ctx.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  },
  brackets(ctx, p, r, color) {
    ctx.fillStyle = color;
    const L = 3;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = p.x + sx * r, cy = p.y + sy * r;
      ctx.fillRect(Math.min(cx, cx - sx * L), cy, L, 1);
      ctx.fillRect(cx, Math.min(cy, cy - sy * L), 1, L);
    }
  },

  // Star with its planets as coloured dots on little orbits (planets only when zoomed in enough).
  drawSystem(ctx, s, p, detail) {
    const st = DATA.starClasses[s.star];
    if (st.kind === 'blackhole') {
      ctx.fillStyle = st.color;
      ctx.fillRect(p.x - 2, p.y - 1, 5, 3); ctx.fillRect(p.x - 1, p.y - 2, 3, 5);
      ctx.fillStyle = '#000000'; ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
      ctx.fillStyle = '#ffe0a0'; ctx.fillRect(p.x - 4, p.y, 2, 1); ctx.fillRect(p.x + 3, p.y, 2, 1);
    } else if (st.kind === 'pulsar') {
      ctx.fillStyle = st.color;
      for (let i = 2; i <= 6; i++) { ctx.globalAlpha = 1 - i / 8; ctx.fillRect(p.x + i, p.y - i, 1, 1); ctx.fillRect(p.x - i, p.y + i, 1, 1); }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x, p.y, 1, 1); ctx.fillStyle = st.color; ctx.fillRect(p.x - 1, p.y, 3, 1); ctx.fillRect(p.x, p.y - 1, 1, 3);
    } else if (st.kind === 'dwarf') {
      ctx.fillStyle = st.color; ctx.fillRect(p.x - 1, p.y, 3, 1); ctx.fillRect(p.x, p.y - 1, 1, 3);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x, p.y, 1, 1);
    } else {
      ctx.fillStyle = st.color;
      if (st.size >= 4) { ctx.globalAlpha = 0.35; ctx.fillRect(p.x - 3, p.y - 3, 7, 7); ctx.globalAlpha = 1; ctx.fillRect(p.x - 2, p.y - 2, 5, 5); }
      else if (st.size >= 2) ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
      const spike = st.size + 1;
      ctx.fillRect(p.x - spike, p.y, spike * 2 + 1, 1); ctx.fillRect(p.x, p.y - spike, 1, spike * 2 + 1);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x, p.y, 1, 1);
    }
    if (!detail) return;
    const base = st.kind ? 5 : 4 + st.size;
    s.planets.forEach((pl, i) => {
      const ang = (s.id * 1.7 + i * 2.4) % (Math.PI * 2), r = base + i * 1.6;
      ctx.fillStyle = pl.colony && s.owner ? DATA.factions[s.owner].color : Planets.cls(pl).palette[3];
      const d = !st.kind && (pl.size === 'giant' || pl.size === 'large') ? 2 : 1;
      ctx.fillRect(Math.round(p.x + Math.cos(ang) * r), Math.round(p.y + Math.sin(ang) * r * 0.8), d, d);
    });
  },

  visible(s) { return s.explored || Explore.isSeen(s.id); },

  // ---------- the frame ----------
  draw(canvas) {
    const cssW = canvas.clientWidth || 800, cssH = canvas.clientHeight || 400;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    }
    this.PX = cssW < 700 ? 2 : 3; // phones get finer pixels so more of the galaxy fits
    const lw = Math.ceil(cssW / this.PX), lh = Math.ceil(cssH / this.PX);
    this.view = { cssW, cssH, lw, lh, dpr };
    const c = this.camera(), z = c.z;
    const low = this.lowBuf && this.lowBuf.width === lw && this.lowBuf.height === lh ? this.lowBuf : (this.lowBuf = Sprites.canvas(lw, lh));
    const ctx = low.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // starfield, slower than the map (parallax)
    ctx.fillStyle = '#070606'; ctx.fillRect(0, 0, lw, lh);
    const par = 0.5, T = 128;
    const ox = c.x * z * par - lw / 2, oy = c.y * z * par - lh / 2;
    for (let ty = Math.floor(oy / T); ty * T < oy + lh; ty++) for (let tx = Math.floor(ox / T); tx * T < ox + lw; tx++) {
      ctx.drawImage(this.tile(tx, ty), Math.round(tx * T - ox), Math.round(ty * T - oy));
    }

    const S = G.systems, margin = 40;
    const onScreen = (p) => p.x > -margin && p.x < lw + margin && p.y > -margin && p.y < lh + margin;
    const shown = S.filter((s) => this.visible(s));
    const P = new Map(shown.map((s) => [s.id, this.pos(s)]));

    // lanes
    for (const s of shown) for (const n of s.lanes) {
      if (n < s.id || !P.has(n)) continue;
      const t = S[n];
      if (!(s.explored || t.explored)) continue;
      const a = P.get(s.id), b = P.get(n);
      if (!onScreen(a) && !onScreen(b)) continue;
      this.line(ctx, a, b, s.explored && t.explored ? '#4a4038' : '#2a2420', true);
    }

    // systems
    const detail = z >= 0.8;
    for (const s of shown) {
      const p = P.get(s.id);
      if (!onScreen(p)) continue;
      if (s.explored) {
        this.drawSystem(ctx, s, p, detail);
        if (s.owner) this.brackets(ctx, p, 8, DATA.factions[s.owner].color);
      } else {
        ctx.fillStyle = '#3a3430'; ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
      }
      if (s.id === UI.selSys) this.brackets(ctx, p, 11, '#f0e8d0');
      const pip = (fx, fy, col) => { ctx.fillStyle = col; ctx.fillRect(fx, fy, 3, 1); ctx.fillRect(fx, fy + 1, 2, 1); ctx.fillRect(fx, fy + 2, 1, 1); };
      const g = s.explored && Missions.guard(s);
      if (g) g.ships.forEach((x, i) => pip(p.x + 9 + Math.floor(i / 3) * 4, p.y - 7 + (i % 3) * 4, DATA.factions[g.owner].color));
      let row = 0;
      for (const f of G.fleets) if (f.mission && f.mission.target === s.id && f.mission.phase !== 'back') pip(p.x - 12, p.y - 7 + 4 * row++, '#e0c060');
      for (const m of G.expeditions) if (m.target === s.id) pip(p.x - 12, p.y - 7 + 4 * row++, '#9ac070');
      for (const m of G.surveys) if (m.target === s.id) pip(p.x - 12, p.y - 7 + 4 * row++, '#80c0e0');
      if (G.threats.some((t) => t.target === s.id)) this.brackets(ctx, p, 13, '#e04040');
    }

    // scale the pixel art up, crisp
    const out = canvas.getContext('2d');
    out.imageSmoothingEnabled = false;
    out.setTransform(1, 0, 0, 1, 0, 0);
    out.drawImage(low, 0, 0, lw * this.PX * dpr, lh * this.PX * dpr);

    // ---------- text at full resolution ----------
    out.setTransform(dpr, 0, 0, dpr, 0, 0);
    out.textAlign = 'center'; out.textBaseline = 'top';
    out.lineJoin = 'round';
    const taken = [];
    const free = (r) => !taken.some((t) => r.x < t.x + t.w && t.x < r.x + r.w && r.y < t.y + t.h && t.y < r.y + r.h);
    const text = (str, x, y, color, size, force) => {
      out.font = `${size}px VT323, 'Courier New', monospace`;
      const w = out.measureText(str).width + 6, r = { x: x - w / 2, y, w, h: size };
      if (!force && !free(r)) return false;
      taken.push(r);
      out.strokeStyle = 'rgba(5, 4, 4, 0.9)'; out.lineWidth = 4; out.strokeText(str, x, y);
      out.fillStyle = color; out.fillText(str, x, y);
      return true;
    };
    // most important first: selected, yours, alien, charted, then '?'
    const rank = (s) => (s.id === UI.selSys ? 0 : s.owner === 'player' ? 1 : s.owner ? 2 : s.explored ? 3 : 4);
    const size = Math.round(Math.max(15, Math.min(20, 14 + z * 3)));
    for (const s of shown.slice().sort((a, b) => rank(a) - rank(b))) {
      const p = P.get(s.id);
      if (!onScreen(p)) continue;
      const sx = (p.x + 0.5) * this.PX, sy = (p.y + 0.5) * this.PX;
      if (sx < -60 || sx > cssW + 60 || sy < -30 || sy > cssH + 30) continue;
      if (s.explored) {
        if (z >= 0.55 || s.owner || s.id === UI.selSys) {
          text(s.name.toUpperCase(), sx, sy + (detail ? 34 : 22), s.owner ? DATA.factions[s.owner].color : '#b0a490', size, s.id === UI.selSys);
        }
      } else text('?', sx, sy - 26, '#8a7c6c', size + 2, false);
      if (G.threats.some((t) => t.target === s.id)) text('! RAID', sx, sy - 52, '#ff5a4a', size, true);
      else if (s.explored && Trade.at(s.id)) text('⚖', sx, sy - 30, '#e0c070', size + 2, false); // a trading post
    }

    this.drawMinimap(out, cssW, cssH);
  },

  // ---------- minimap ----------
  mini(cssW, cssH) {
    const w = Math.min(180, Math.round(cssW * 0.22)), h = Math.round(w * 0.68);
    return { x: cssW - w - 10, y: cssH - h - 10, w, h };
  },
  drawMinimap(out, cssW, cssH) {
    const m = this.mini(cssW, cssH), shown = G.systems.filter((s) => this.visible(s));
    if (!shown.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of shown) { x0 = Math.min(x0, s.x); y0 = Math.min(y0, s.y); x1 = Math.max(x1, s.x); y1 = Math.max(y1, s.y); }
    const c = this.camera(), v = this.view;
    const vw = v.lw / c.z, vh = v.lh / c.z;           // the view in world units
    x0 = Math.min(x0, c.x - vw / 2); x1 = Math.max(x1, c.x + vw / 2); y0 = Math.min(y0, c.y - vh / 2); y1 = Math.max(y1, c.y + vh / 2);
    const pad = 40; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
    const k = Math.min(m.w / (x1 - x0), m.h / (y1 - y0));
    const ox = m.x + (m.w - (x1 - x0) * k) / 2, oy = m.y + (m.h - (y1 - y0) * k) / 2;
    this.miniMap = { x0, y0, k, ox, oy, rect: m };
    out.fillStyle = 'rgba(8, 7, 6, 0.88)'; out.fillRect(m.x, m.y, m.w, m.h);
    out.strokeStyle = '#4a4036'; out.lineWidth = 1; out.strokeRect(m.x + 0.5, m.y + 0.5, m.w - 1, m.h - 1);
    for (const s of shown) {
      out.fillStyle = s.owner ? DATA.factions[s.owner].color : s.explored ? '#8a8070' : '#3a3430';
      const r = s.owner ? 3 : 2;
      out.fillRect(Math.round(ox + (s.x - x0) * k) - 1, Math.round(oy + (s.y - y0) * k) - 1, r, r);
    }
    out.strokeStyle = '#f0e8d0';
    out.strokeRect(Math.round(ox + (c.x - vw / 2 - x0) * k) + 0.5, Math.round(oy + (c.y - vh / 2 - y0) * k) + 0.5, Math.max(4, vw * k), Math.max(4, vh * k));
  },
  // A click on the minimap: the world point under it, or null.
  miniHit(sx, sy) {
    const mm = this.miniMap;
    if (!mm) return null;
    const r = mm.rect;
    if (sx < r.x || sx > r.x + r.w || sy < r.y || sy > r.y + r.h) return null;
    return { x: mm.x0 + (sx - mm.ox) / mm.k, y: mm.y0 + (sy - mm.oy) / mm.k };
  },

  // ---------- picking ----------
  cssPoint(canvas, ev) { const r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; },
  hit(canvas, ev) {
    if (!this.view) return null;
    const { x, y } = this.cssPoint(canvas, ev);
    if (this.miniHit(x, y)) return null;
    let best = null, bd = 16; // CSS px
    for (const s of G.systems) {
      if (!this.visible(s)) continue;
      const p = this.pos(s), d = Math.hypot((p.x + 0.5) * this.PX - x, (p.y + 0.5) * this.PX - y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  },

  // ---------- input: drag to pan, wheel/pinch to zoom, click to select ----------
  attach(canvas) {
    const ptrs = new Map();
    let drag = null, pinch = null;
    canvas.style.touchAction = 'none';
    canvas.onpointerdown = (ev) => {
      canvas.setPointerCapture(ev.pointerId);
      ptrs.set(ev.pointerId, this.cssPoint(canvas, ev));
      if (ptrs.size === 1) { const p = this.cssPoint(canvas, ev); drag = { x: p.x, y: p.y, cx: this.camera().x, cy: this.camera().y, moved: false }; }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.camera().z }; drag = null; }
    };
    canvas.onpointermove = (ev) => {
      if (ev.pointerType === 'mouse' && !ptrs.size) { UI.mapHover(canvas, ev); return; }
      if (!ptrs.has(ev.pointerId)) return;
      ptrs.set(ev.pointerId, this.cssPoint(canvas, ev));
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.camera().z = pinch.z; this.zoomBy(d / pinch.d, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.dragging = true; this.draw(canvas); return;
      }
      if (!drag) return;
      const p = this.cssPoint(canvas, ev), dx = p.x - drag.x, dy = p.y - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 5) return;
      drag.moved = true; this.dragging = true;
      const c = this.camera();
      c.x = drag.cx - dx / this.PX / c.z; c.y = drag.cy - dy / this.PX / c.z;
      canvas.style.cursor = 'grabbing';
      UI.hover = null; const hv = UI.$('maphover'); if (hv) hv.classList.remove('show');
      this.draw(canvas);
    };
    const end = (ev) => {
      const wasDrag = drag && drag.moved, wasPinch = !!pinch;
      ptrs.delete(ev.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) {
        drag = null; canvas.style.cursor = '';
        if (this.dragging) { this.dragging = false; this.remember(); if (UI.renderPending) { UI.renderPending = false; UI.render(); } }
        if (!wasDrag && !wasPinch && ev.type === 'pointerup') this.click(canvas, ev);
      }
    };
    canvas.onpointerup = end; canvas.onpointercancel = end;
    canvas.onpointerleave = () => { if (!ptrs.size) { UI.hover = null; const hv = UI.$('maphover'); if (hv) hv.classList.remove('show'); } };
    canvas.onwheel = (ev) => {
      ev.preventDefault();
      const p = this.cssPoint(canvas, ev);
      this.zoomBy(Math.exp(-ev.deltaY * 0.0015), p.x, p.y);
      this.draw(canvas);
    };
  },
  click(canvas, ev) {
    const p = this.cssPoint(canvas, ev);
    const mw = this.miniHit(p.x, p.y);
    if (mw) { this.centerOn(mw); this.draw(canvas); return; }
    UI.mapClick(canvas, ev);
  },
};
