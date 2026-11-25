// Voyager — the star system map, drawn on a small canvas and scaled up with crisp pixels.

const StarMap = {
  W: 400, H: 250,
  bg: null,

  pos(s) { return { x: Math.round(s.x * this.W), y: Math.round(s.y * this.H) }; },

  background() {
    if (this.bg) return this.bg;
    const c = Sprites.canvas(this.W, this.H), ctx = c.getContext('2d');
    const rnd = Sprites.seeded('voyager-bg');
    ctx.fillStyle = '#070606'; ctx.fillRect(0, 0, this.W, this.H);
    // dithered nebula blotches
    const blobs = [[0.7, 0.3, 90, '#1a0d14'], [0.25, 0.75, 110, '#0d1214'], [0.55, 0.8, 70, '#14100a']];
    for (const [bx, by, br, col] of blobs) {
      ctx.fillStyle = col;
      for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
        const d = Math.hypot(x - bx * this.W, y - by * this.H) / br;
        if (d < 1 && Sprites.bayer[y % 4][x % 4] / 16 > d * 1.1) ctx.fillRect(x, y, 1, 1);
      }
    }
    for (let i = 0; i < 260; i++) {
      const v = rnd();
      ctx.fillStyle = v > 0.97 ? '#e8e0d0' : v > 0.85 ? '#807870' : '#3a3632';
      ctx.fillRect(Math.floor(rnd() * this.W), Math.floor(rnd() * this.H), 1, 1);
    }
    return (this.bg = c);
  },

  line(ctx, a, b, color, dotted) {
    let x0 = a.x, y0 = a.y; const x1 = b.x, y1 = b.y;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, i = 0;
    ctx.fillStyle = color;
    for (;;) {
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

  draw(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.background(), 0, 0);
    const S = G.systems;
    const visible = (s) => s.explored || Explore.isSeen(s.id);

    // lanes
    for (const s of S) for (const n of s.lanes) {
      if (n < s.id) continue;
      const t = S[n];
      if (!(s.explored || t.explored)) continue;
      if (!visible(s) || !visible(t)) continue;
      this.line(ctx, this.pos(s), this.pos(t), s.explored && t.explored ? '#4a4038' : '#2a2420', true);
    }

    // planned paths
    for (const f of G.fleets) {
      if (f.owner !== 'player' || !f.path.length) continue;
      let prev = this.pos(S[f.sys]);
      for (const id of f.path) { const p = this.pos(S[id]); this.line(ctx, prev, p, f.id === UI.selFleet ? '#e0c060' : '#8a7040', false); prev = p; }
    }
    // visible hostile movements
    for (const f of G.fleets) {
      if (f.owner === 'player' || !f.path.length || !S[f.sys].explored) continue;
      this.line(ctx, this.pos(S[f.sys]), this.pos(S[f.path[0]]), '#a03030', false);
    }

    // systems
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    for (const s of S) {
      if (!visible(s)) continue;
      const p = this.pos(s);
      if (s.explored) {
        ctx.drawImage(Sprites.planetCanvas(s.type, 12, s.id), p.x - 6, p.y - 6);
        if (s.owner) this.brackets(ctx, p, 8, DATA.factions[s.owner].color);
        ctx.fillStyle = s.owner ? DATA.factions[s.owner].color : '#8a8070';
        const label = s.name.toUpperCase(), half = ctx.measureText(label).width / 2 + 2;
        ctx.fillText(label, Math.max(half, Math.min(this.W - half, p.x)), p.y + 16);
      } else {
        ctx.fillStyle = '#3a3430'; ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
        ctx.fillStyle = '#5a5048'; ctx.fillText('?', p.x, p.y - 4);
      }
      if (s.id === UI.selSys) this.brackets(ctx, p, 11, '#f0e8d0');
      // fleets as stacked pips
      if (s.explored) {
        const here = Fleets.at(s.id);
        here.forEach((f, i) => {
          const fx = p.x + 9, fy = p.y - 7 + i * 4;
          ctx.fillStyle = f.id === UI.selFleet ? '#ffffff' : DATA.factions[f.owner].color;
          ctx.fillRect(fx, fy, 3, 1); ctx.fillRect(fx, fy + 1, 2, 1); ctx.fillRect(fx, fy + 2, 1, 1);
        });
      }
    }
  },

  hit(canvas, ev) {
    const r = canvas.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width * this.W, y = (ev.clientY - r.top) / r.height * this.H;
    let best = null, bd = 14;
    for (const s of G.systems) {
      if (!(s.explored || Explore.isSeen(s.id))) continue;
      const p = this.pos(s), d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  },
};
