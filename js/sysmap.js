// Voyager — the solar system map: one star with its planets on their orbits.

const SystemMap = {
  W: 400, H: 250,
  star: { x: 34, y: 125 },

  orbitRadius(i, n) {
    const span = this.W - this.star.x - 52;
    return 60 + (span - 60) * (n > 1 ? i / (n - 1) : 0);
  },

  // Planet position on its orbit. Angles are fixed per planet so the layout stays put.
  planetPos(s, p) {
    const r = this.orbitRadius(p.idx, s.planets.length);
    const a = (((s.id * 7 + p.idx * 13) % 11) / 10 - 0.5) * 0.6;
    return { x: Math.round(this.star.x + r * Math.cos(a)), y: Math.round(this.star.y + r * 0.42 * Math.sin(a) * 2.2), r };
  },

  drawStar(ctx, s) {
    const st = DATA.starClasses[s.star];
    const R = { O: 22, B: 20, A: 17, F: 15, G: 14, K: 12, M: 9 }[s.star];
    const { x: cx, y: cy } = this.star;
    // dithered corona, then the disc with a bright core
    for (let y = -R * 2; y <= R * 2; y++) for (let x = -R * 2; x <= R * 2; x++) {
      const d = Math.hypot(x, y);
      if (d <= R) {
        ctx.fillStyle = d < R * 0.55 ? '#ffffff' : st.color;
        ctx.fillRect(cx + x, cy + y, 1, 1);
      } else if (d < R * 2 && Sprites.bayer[(cy + y + 64) % 4][(cx + x + 64) % 4] / 16 > (d - R) / R) {
        ctx.fillStyle = st.color;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(cx + x, cy + y, 1, 1);
        ctx.globalAlpha = 1;
      }
    }
  },

  orbit(ctx, r) {
    ctx.fillStyle = '#4a4038';
    const steps = Math.round(r * 3);
    for (let i = 0; i < steps; i++) {
      if (i % 3) continue;
      const a = (i / steps) * Math.PI * 2;
      const x = Math.round(this.star.x + r * Math.cos(a)), y = Math.round(this.star.y + r * 0.42 * Math.sin(a) * 2.2);
      if (x >= 0 && x < this.W && y >= 0 && y < this.H) ctx.fillRect(x, y, 1, 1);
    }
  },

  draw(canvas) {
    const s = G.systems[UI.selSys];
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(StarMap.background(), 0, 0);
    for (const p of s.planets) this.orbit(ctx, this.orbitRadius(p.idx, s.planets.length));
    this.drawStar(ctx, s);
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    for (const p of s.planets) {
      const pos = this.planetPos(s, p);
      const img = Sprites.planetCanvas(p, s.id + '-' + p.idx);
      ctx.drawImage(img, pos.x - img.width / 2, pos.y - img.height / 2);
      const half = img.width / 2 + 3;
      if (p.colony && s.owner) {
        StarMap.brackets(ctx, pos, half, DATA.factions[s.owner].color);
        // a little station ring above planets with orbital buildings
        if (Object.values(p.colony.orbit).some((l) => l > 0)) {
          ctx.fillStyle = DATA.factions[s.owner].color;
          ctx.fillRect(pos.x - 4, pos.y - half - 4, 9, 1);
          ctx.fillRect(pos.x - 1, pos.y - half - 6, 3, 3);
        }
      }
      if (UI.selPlanet === p.idx) StarMap.brackets(ctx, pos, half + 3, '#f0e8d0');
      ctx.fillStyle = p.colony && s.owner ? DATA.factions[s.owner].color : '#a89a80';
      ctx.fillText(ROMAN[p.idx], pos.x, pos.y + half + 9);
      ctx.fillStyle = DATA.habitability[p.hab].color;
      ctx.fillText('●'.repeat(p.hab), pos.x, pos.y + half + 17);
    }
    // fleets wait at the jump point
    const here = Fleets.at(s.id);
    if (here.length) {
      const jx = this.W - 18, jy = 14;
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
    let best = null, bd = 22;
    for (const p of s.planets) {
      const pos = this.planetPos(s, p), d = Math.hypot(pos.x - x, pos.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  },
};
