// Voyager — planet classification: composition × size × temperature → class, habitability, slots, bonuses.

const Planets = {
  classKey(p) { return p.comp + '_' + p.temp; },
  cls(p) { return DATA.planetClasses[this.classKey(p)]; },

  // e.g. "Large Ocean World", "Hot Gas Giant" (giants don't repeat their size)
  label(p) { return (p.size === 'giant' ? '' : DATA.planetSizes[p.size].name + ' ') + this.cls(p).name; },
  // e.g. "Silicate · Average · Temperate"
  factors(p) { return `${DATA.compositions[p.comp].name} · ${DATA.planetSizes[p.size].name} · ${DATA.temperatures[p.temp].name}`; },

  // Resource multipliers from composition and temperature, combined.
  mult(p) {
    const out = {};
    // Capacity and resource bonuses from composition, temperature and the star (starlight is handled
    // separately: it only scales a colony's base Power and its Solar Arrays).
    const st = DATA.starClasses[p.star || 'G'];
    for (const src of [DATA.compositions[p.comp].mult, DATA.temperatures[p.temp].mult, st.mult || {}]) {
      for (const k in src) out[k] = Math.round((out[k] || 1) * src[k] * 100) / 100;
    }
    for (const k in out) if (out[k] === 1) delete out[k];
    return out;
  },

  slots(size, hab) {
    const base = DATA.planetSizes[size].slots;
    return { surface: hab <= 1 ? 0 : base.surface, orbit: base.orbit };
  },

  // Build a planet from its three factors. hab can be forced (e.g. the capital).
  make(idx, comp, size, temp, hab, star = 'G') {
    const c = DATA.planetClasses[comp + '_' + temp];
    if (hab == null) hab = Math.max(1, Math.min(5, U.randInt(c.hab[0], c.hab[1]) + (DATA.planetSizes[size].habMod || 0) + DATA.starClasses[star].habMod));
    return { idx, comp, size, temp, hab, star, colony: null, slots: this.slots(size, hab) };
  },

  // Weighted pick from {key: weight}.
  weighted(table) {
    const total = Object.values(table).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [k, w] of Object.entries(table)) { r -= w; if (r <= 0) return k; }
    return Object.keys(table)[0];
  },

  random(idx, star = 'G') {
    const bias = DATA.starClasses[star].temps;
    const table = {};
    for (const [k, c] of Object.entries(DATA.planetClasses)) table[k] = c.weight * (bias[k.split('_')[1]] || 1);
    const [comp, temp] = this.weighted(table).split('_');
    const size = U.pick(DATA.compositions[comp].sizes);
    return this.make(idx, comp, size, temp, null, star);
  },
};
