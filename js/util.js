// Voyager — small helpers shared by every system.

const U = {
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  shuffle: (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
  fmt: (n) => {
    n = Math.floor(n);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  },
  fmt1: (n) => (Math.round(n * 10) / 10).toString(),
  esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  costText: (cost) => Object.entries(cost).filter(([, v]) => v > 0)
    .map(([k, v]) => `<span class="res-${k}">${DATA.resources[k].icon}${U.fmt(v)}</span>`).join(' '),

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
