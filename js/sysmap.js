// Voyager — the solar system map: one star with its planets on their orbits.
// Sizes are to scale (real radius ratios between planets and stars); distances are compressed.
// Stars are so much bigger than planets that only the edge of the star fits on the left.

const SystemMap = {
  W: 400, H: 250,
  earthPx: 3,        // pixels per Earth radius
  limbX: 26,         // where the star's edge sits on the centre line
  cy: 125,

  // Planet radius in Earth radii, fixed per planet (seeded) within its size class.
  radiusEarth(s, p) {
    let [lo, hi] = DATA.planetSizes[p.size].radius;
    if (p.size === 'giant') [lo, hi] = p.temp === 'hot' ? [9, 14] : [3.9, 11]; // hot Jupiters are puffed up
    const rnd = Sprites.seeded('r' + s.id + '-' + p.idx)();
    return lo + (hi - lo) * rnd;
  },

  starRadiusPx(s) { return DATA.starClasses[s.star].radius * DATA.solarRadiusInEarths * this.earthPx; },

  // Lay planets out left to right with equal gaps between their edges.
  layout(s) {
    const radii = s.planets.map((p) => Math.max(2, Math.round(this.radiusEarth(s, p) * this.earthPx)));
    const start = this.limbX + (DATA.starClasses[s.star].size >= 4 ? 52 : 22), end = this.W - 14;
    const used = radii.reduce((a, r) => a + r * 2, 0);
    const gap = Math.max(6, (end - start - used) / Math.max(1, radii.length));
    let x = start + gap / 2;
    return s.planets.map((p, i) => {
      const r = radii[i];
      x += r;
      const pos = { x: Math.round(x), y: this.cy + Math.round(Math.sin(s.id * 3 + i * 2.1) * 18), r };
      x += r + gap;
      return pos;
    });
  },

  mix(hex, to, t) {
    const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
  },

  // Smooth seeded noise for star surfaces (granulation, starspots).
  noise(x, y, cell, seed) {
    const h = (i, j) => { let n = (i * 374761393 + j * 668265263 + seed * 982451653) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (h(x0, y0) * (1 - sx) + h(x0 + 1, y0) * sx) * (1 - sy) + (h(x0, y0 + 1) * (1 - sx) + h(x0 + 1, y0 + 1) * sx) * sy;
  },

  drawStar(ctx, s) {
    const st = DATA.starClasses[s.star];
    const R = this.starRadiusPx(s);
    const cx = this.limbX - R;
    const hyper = st.size >= 4;
    const corona = hyper ? 46 : 14;
    const shades = [this.mix(st.color, '#000000', 0.45), this.mix(st.color, '#000000', 0.2), st.color, this.mix(st.color, '#ffffff', 0.35)];
    const maxX = Math.min(this.W, this.limbX + corona + 1);
    for (let y = 0; y < this.H; y++) for (let x = 0; x < maxX; x++) {
      const d = Math.hypot(x - cx, y - this.cy);
      const dither = Sprites.bayer[y % 4][x % 4] / 16;
      if (d <= R) {
        // convection cells and starspots, darker towards the limb
        const n = this.noise(x, y, hyper ? 9 : 5, s.id) * 0.7 + this.noise(x, y, hyper ? 23 : 11, s.id + 7) * 0.3;
        const limb = Math.min(1, (R - d) / 10);
        const v = n * 0.75 + limb * 0.45 - 0.2 + (dither - 0.5) * 0.25;
        ctx.fillStyle = shades[Math.max(0, Math.min(3, Math.floor(v * 4)))];
        ctx.fillRect(x, y, 1, 1);
      } else if (d - R < corona) {
        // corona; a hypergiant also throws off streamers of its own atmosphere
        let k = (d - R) / corona;
        if (hyper) k -= (this.noise(0, y, 14, s.id + 3) - 0.5) * 0.9 * (1 - k);
        if (dither > k) {
          ctx.fillStyle = k < 0.3 ? st.color : shades[1];
          ctx.globalAlpha = hyper ? 0.45 * (1 - k) + 0.1 : 0.3;
          ctx.fillRect(x, y, 1, 1);
          ctx.globalAlpha = 1;
        }
      }
    }
  },

  // Orbits are circles around the star's centre (nearly straight lines around giant stars).
  orbit(ctx, s, pos) {
    const R = this.starRadiusPx(s), cx = this.limbX - R;
    const r = Math.hypot(pos.x - cx, pos.y - this.cy);
    ctx.fillStyle = '#4a4038';
    for (let y = 0; y < this.H; y += 3) {
      const dy = y - this.cy;
      if (Math.abs(dy) > r) continue;
      const x = Math.round(cx + Math.sqrt(r * r - dy * dy));
      if (x >= 0 && x < this.W && Math.abs(y - pos.y) > pos.r + 3) ctx.fillRect(x, y, 1, 1);
    }
  },

  draw(canvas) {
    const s = G.systems[UI.selSys];
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(StarMap.background(), 0, 0);
    const lay = this.layout(s);
    s.planets.forEach((p, i) => this.orbit(ctx, s, lay[i]));
    this.drawStar(ctx, s);
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    s.planets.forEach((p, i) => {
      const pos = lay[i];
      const img = Sprites.planetCanvas(p, s.id + '-' + p.idx, pos.r * 2 + 2);
      ctx.drawImage(img, pos.x - img.width / 2, pos.y - img.height / 2);
      const half = pos.r + 4;
      if (p.colony && s.owner) {
        StarMap.brackets(ctx, pos, half, DATA.factions[s.owner].color);
        // a little station above planets with orbital buildings
        if (Object.values(p.colony.orbit).some((l) => l > 0)) {
          ctx.fillStyle = DATA.factions[s.owner].color;
          ctx.fillRect(pos.x - 4, pos.y - half - 5, 9, 1);
          ctx.fillRect(pos.x - 1, pos.y - half - 7, 3, 3);
        }
      }
      if (UI.selPlanet === p.idx) StarMap.brackets(ctx, pos, half + 3, '#f0e8d0');
      ctx.fillStyle = p.colony && s.owner ? DATA.factions[s.owner].color : '#a89a80';
      ctx.fillText(ROMAN[p.idx], pos.x, pos.y + half + 9);
      ctx.fillStyle = DATA.habitability[p.hab].color;
      ctx.fillText('●'.repeat(p.hab), pos.x, pos.y + half + 17);
    });
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5a5048';
    ctx.fillText('SIZES TO SCALE · DISTANCES NOT', this.limbX + 22, this.H - 6);
    // fleets wait at the jump point
    const here = Fleets.at(s.id);
    if (here.length) {
      const jx = this.W - 18, jy = 14;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#5a5048';
      ctx.fillText('JUMP', jx, jy - 4);
      here.forEach((f, i) => {
        const fx = jx - 4, fy = jy + i * 6;
        ctx.fillStyle = f.id === UI.selFleet ? '#ffffff' : DATA.factions[f.owner].color;
        ctx.fillRect(fx, fy, 5, 1); ctx.fillRect(fx, fy + 1, 3, 1); ctx.fillRect(fx, fy + 2, 1, 1);
        ctx.fillText(String(Fleets.size(f)), fx + 12, fy + 4);
      });
    }
  },

  hit(canvas, ev) {
    const s = G.systems[UI.selSys];
    const r = canvas.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width * this.W, y = (ev.clientY - r.top) / r.height * this.H;
    const lay = this.layout(s);
    let best = null, bd = Infinity;
    s.planets.forEach((p, i) => {
      const d = Math.hypot(lay[i].x - x, lay[i].y - y);
      if (d < lay[i].r + 10 && d < bd) { bd = d; best = p; }
    });
    return best;
  },
};
