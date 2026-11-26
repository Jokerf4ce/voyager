// Voyager — small helpers shared by every system.

const U = {
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  // A normally distributed random number (Box–Muller), clamped to ±3 standard deviations.
  gauss(mean = 0, sd = 1) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const z = Math.max(-3, Math.min(3, Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)));
    return mean + z * sd;
  },
  shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
  fmt: (n) => {
    n = Math.floor(n);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  },
  fmt1: (n) => (Math.round(n * 10) / 10).toString(),
  // A resource amount: whole numbers, or with DATA.resources[k].decimals (Crypto Shards: 0.05).
  amount: (k, n) => { const d = (DATA.resources[k] || {}).decimals; return d ? (Math.abs(n) >= 1000 ? U.fmt(n) : (Math.floor(n * 10 ** d + 1e-6) / 10 ** d).toFixed(d)) : U.fmt(n); },
  rate: (k, n) => { const d = (DATA.resources[k] || {}).decimals; return d ? (Math.round(n * 10 ** d) / 10 ** d).toFixed(d) : U.fmt1(n); },
  esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  costText: (cost) => Object.entries(cost).filter(([, v]) => v > 0)
    .map(([k, v]) => `<span class="res-${k}">${DATA.resources[k].icon}${U.amount(k, v)}</span>`).join(' '),

  // Mouse position in canvas pixels. The canvas is scaled with object-fit: contain, so the drawing
  // can be letterboxed inside the element: account for that, not just the element's box.
  canvasPoint(canvas, ev, W, H) {
    const r = canvas.getBoundingClientRect();
    const scale = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * scale) / 2, oy = (r.height - H * scale) / 2;
    return { x: (ev.clientX - r.left - ox) / scale, y: (ev.clientY - r.top - oy) / scale };
  },

  // Breadth-first path over lanes. allow(sysId) can restrict traversal. Returns [next, ..., dest] or null.
  path(from, to, allow) {
    if (from === to) return [];
    const prev = { [from]: null };
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const n of G.systems[cur].lanes) {
        if (n in prev) continue;
        if (allow && n !== to && !allow(n)) continue;
        prev[n] = cur;
        if (n === to) {
          const out = [];
          let p = to;
          while (p !== from) { out.unshift(p); p = prev[p]; }
          return out;
        }
        q.push(n);
      }
    }
    return null;
  },

  // Hop distances from one system to all others.
  distances(from) {
    const d = { [from]: 0 };
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const n of G.systems[cur].lanes) if (!(n in d)) { d[n] = d[cur] + 1; q.push(n); }
    }
    return d;
  },
};
